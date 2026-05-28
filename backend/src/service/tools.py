import difflib
import json
import os
import time
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from github import Auth, Github
from langchain.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.language_models import BaseChatModel
from langchain_groq import ChatGroq
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_neo4j import GraphCypherQAChain, Neo4jGraph
from loguru import logger
from qdrant_client.http import models
from sqlmodel import Session

from src.db.dbs import get_db
from src.db.redis_client import redis_client
from src.models.models import UserMCPConfig
from src.service.utils import decrypt

Groq = ChatGroq

load_dotenv()


token = os.getenv("GITHUB_TOKEN")
g = Github(auth=Auth.Token(token))


def build_tree(tree_lis):
    root = {"name": "/", "type": "tree", "children": []}
    path_map = {"/": root}

    for item in tree_lis:
        parts = item["path"].split("/")
        for i in range(1, len(parts) + 1):
            sub_path = "/".join(parts[:i])
            if sub_path not in path_map:
                parent_path = "/".join(parts[: i - 1]) or "/"
                parent = path_map[parent_path]
                node_type = "tree" if i < len(parts) else item["type"]
                node = {
                    "name": parts[i - 1],
                    "path": sub_path,
                    "type": node_type,
                    "children": [] if node_type == "tree" else None,
                }

                if node_type == "blob":  # file
                    node["sha"] = item.get("sha")
                    node["size"] = item.get("size")

                parent["children"].append(node)
                path_map[sub_path] = node

    return root["children"]


def get_dir_struct(req):
    if hasattr(req, "token") and req.token:
        github_client = Github(auth=Auth.Token(req.token))
    else:
        github_client = g
    repo = github_client.get_repo(f"{req.owner}/{req.repo}")
    tree_sha = repo.default_branch
    tree = repo.get_git_tree(sha=tree_sha, recursive=True)
    lis = []

    for item in tree.tree:
        lis.append(
            {"type": item.type, "path": item.path, "size": item.size, "sha": item.sha}
        )

    return build_tree(lis)


async def get_mcp_tools(user_id):
    logger.info("starting getting mcp tools")
    try:
        start = time.time()
        cache_key = f"mcp_config_client:{user_id}"
        cached_config = await redis_client.get(cache_key)

        if cached_config:
            client_config = json.loads(cached_config)
            end = time.time()
            logger.info(f"Retrieved MCP configs from Redis in {end - start} seconds")
        else:
            for db in get_db():
                configs = db.query(UserMCPConfig).filter_by(user_id=user_id).all()

            if not configs:
                return []

            client_config = {}
            for c in configs:
                # Name the server based on its URL host for MultiServerMCPClient
                server_name = (
                    urlparse(c.server_url).hostname or f"mcp_{len(client_config)}"
                )
                server_name = server_name.replace(".", "_")

                headers = {}
                if c.auth_header and c.api_key:
                    try:
                        decrypted_key = decrypt(c.api_key)
                        headers[c.auth_header] = decrypted_key
                    except Exception as e:
                        logger.error(f"Error decrypting MCP key: {e}")

                # Use the user-provided transport type exactly as defined (http maps to streamable_http internally in langchain_mcp_adapters)
                transport_type = c.type.lower()

                client_config[server_name] = {
                    "transport": transport_type,
                    "url": c.server_url,
                }
                if headers:
                    client_config[server_name]["headers"] = headers

            if not client_config:
                return []

            await redis_client.setex(cache_key, 86400, json.dumps(client_config))
            end = time.time()
            logger.info(
                f"Retrieved MCP configs from DB and cached in {end - start} seconds"
            )

        client = MultiServerMCPClient(client_config)
        logger.info(f"Client config keys: {list(client_config.keys())}")
        logger.info("Loading MCP tools...")

        start = time.time()
        import asyncio

        # Load tools concurrently but handle exceptions gracefully so one bad server doesn't crash all
        tasks = []
        server_names = list(client_config.keys())
        for name in server_names:
            tasks.append(client.get_tools(server_name=name))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        tools = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(
                    f"Failed to load MCP tools from '{server_names[i]}': {res}"
                )
            else:
                tools.extend(res)

        end = time.time()
        logger.info(
            f"Loaded {len(tools)} MCP tools from {len(server_names)} servers in {end - start:.2f} seconds"
        )
        return tools
    except Exception as e:
        logger.error(f"Error loading MCP tools: {e}")
        return []


def _resolve_path(target: str, graph_obj: Neo4jGraph, neo4j_ns: str) -> str | None:
    if not graph_obj or not neo4j_ns:
        return None
    res = graph_obj.query(
        "MATCH (f:File {ns: $ns}) RETURN f.id AS path", {"ns": neo4j_ns}
    )
    paths = [r["path"] for r in res]
    if not paths:
        return None
    for p in paths:
        if target in p:
            return p
    basenames = {p.split("/")[-1]: p for p in paths}
    matches = difflib.get_close_matches(
        target.split("/")[-1], basenames, n=1, cutoff=0.6
    )
    return basenames[matches[0]] if matches else None


async def make_tools(
    user_id: str,
    vector_db: Any | None = None,
    neo4j_ns: str | None = None,
    graph_obj: Neo4jGraph | None = None,
    llm: BaseChatModel | None = None,
) -> list:
    """
    Tool factory. All tools close over the session-specific clients.
    """

    cypher_chain = None
    if graph_obj:
        c_model = os.getenv("CYPHER_LLM") or "llama-3.1-8b-instant"
        q_model = os.getenv("QA_LLM") or "llama-3.1-8b-instant"

        cypher_chain = GraphCypherQAChain.from_llm(
            cypher_llm=Groq(model=c_model),
            qa_llm=Groq(model=q_model),
            graph=graph_obj,
            allow_dangerous_requests=True,
            verbose=True,
        )

    @tool
    def ask_architecture(question: str) -> str:
        """Ask natural language questions about the codebase architecture, file dependencies, and structural relationships. (e.g. 'What files import X?')"""
        if not cypher_chain:
            return (
                "No codebase is currently loaded. Cannot answer architecture questions."
            )
        try:
            res = cypher_chain.invoke({"query": question})
            return res.get("result", str(res))
        except Exception as e:
            return f"Error querying architecture graph: {e}"

    @tool
    def get_project_context() -> str:
        """Always call this first. Returns README and high-level project info."""
        if not vector_db:
            return "No knowledge base is currently loaded."
        docs = vector_db.similarity_search("README", k=4)
        readme_docs = [
            d for d in docs if "readme" in str(d.metadata.get("source", "")).lower()
        ]
        if readme_docs:
            return "--- README ---\n" + "\n".join([d.page_content for d in readme_docs])
        return "No README found or context loaded."

    @tool
    def get_project_hierarchy() -> str:
        """Returns the full file tree of the loaded repository."""
        if not graph_obj or not neo4j_ns:
            return "No codebase is currently loaded."
        res = graph_obj.query(
            "MATCH (f:File {ns: $ns}) RETURN f.id AS path", {"ns": neo4j_ns}
        )
        paths = [r["path"] for r in res]
        result = "\n".join(sorted(paths)) if paths else "No files found."
        if len(result) > 3000:
            result = result[:3000] + "\n... [Output truncated to save tokens]"
        return result

    @tool
    def get_file_context(file_path: str) -> str:
        """Lists functions and classes inside a specific file."""
        if not graph_obj or not neo4j_ns:
            return "No codebase is currently loaded."
        actual = _resolve_path(file_path, graph_obj=graph_obj, neo4j_ns=neo4j_ns)
        if not actual:
            return f"File '{file_path}' not found."
        result = graph_obj.query(
            "MATCH (f:File {id: $path, ns: $ns})-[:CONTAINS]->(s:Symbol) RETURN s.type AS kind, s.name AS name",
            {"path": actual, "ns": neo4j_ns},
        )
        lines = [f"- [{r['kind']}] {r['name']}" for r in result]
        return (
            f"Contents of {actual}:\n" + "\n".join(lines)
            if lines
            else "No symbols found."
        )

    @tool
    def read_file_content(file_path: str) -> str:
        """
        Reads the full content of a file (e.g., README.md, package.json).
        Use this when you need the exact content of a non-code file or the full file context.
        """
        if not vector_db:
            return "No knowledge base is currently loaded."
        actual = _resolve_path(file_path, graph_obj=graph_obj, neo4j_ns=neo4j_ns)
        if not actual:
            actual = file_path

        client = vector_db.client
        collection_name = vector_db.collection_name

        try:
            records, _ = client.scroll(
                collection_name=collection_name,
                scroll_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="metadata.source", match=models.MatchValue(value=actual)
                        )
                    ]
                ),
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )

            if not records:
                return f"No content found for '{actual}' in the vector store."

            def get_start(r):
                meta = r.payload.get("metadata", {})
                return meta.get("start_byte") or meta.get("start_line") or 0

            sorted_records = sorted(records, key=get_start)
            content = "\n".join(
                r.payload.get("page_content", "") for r in sorted_records
            )
            if len(content) > 3500:
                content = (
                    content[:3500]
                    + "\n\n... [Content truncated due to length to fit LLM token limits]"
                )
            return f"--- {actual} ---\n{content}"
        except Exception as e:
            return f"Error reading file content: {e}"

    @tool
    def search_code(query: str) -> str:
        """Semantic search across the codebase. Use for 'where is X implemented?' questions."""
        if not vector_db:
            return "No knowledge base is currently loaded."
        docs = vector_db.similarity_search(query, k=4)
        return (
            "\n---\n".join(
                f"Source: {d.metadata.get('source', '?')}\n{d.page_content}"
                for d in docs
            )
            or "No results."
        )

    @tool
    def get_specific_code(file_path: str, target_name: str) -> str:
        """
        Fetches the exact source code chunk of a specific function or class from a specific file.
        Args:
            file_path: e.g., 'src/service/auth_service.py'
            target_name: The exact name of the function/class (e.g., 'get_current_user')
        """
        if not vector_db:
            return "No knowledge base is currently loaded."
        actual = _resolve_path(file_path, graph_obj=graph_obj, neo4j_ns=neo4j_ns)
        if not actual:
            return f"Error: '{file_path}' not found."

        docs = vector_db.similarity_search(
            query=target_name,
            k=3,
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="metadata.source", match=models.MatchValue(value=actual)
                    )
                ]
            ),
        )

        if not docs:
            return f"Could not find exact code for '{target_name}' in {actual}."

        docs = sorted(
            docs,
            key=lambda d: (
                d.metadata.get("start_line") or d.metadata.get("start_byte") or 0
            ),
        )

        content = "\n".join(d.page_content for d in docs)

        return f"--- Code for '{target_name}' in {actual} ---\n{content}"

    @tool
    def query_dependencies(file_path: str, direction: str) -> str:
        """
        Explore import relationships.
        direction: 'imports' (what this file depends on) or 'imported_by' (what uses it)
        """
        if not graph_obj or not neo4j_ns:
            return "No codebase is currently loaded."
        actual = _resolve_path(file_path, graph_obj=graph_obj, neo4j_ns=neo4j_ns)
        if not actual:
            return f"File '{file_path}' not found."
        if direction == "imports":
            res = graph_obj.query(
                "MATCH (f:File {id: $p, ns: $ns})-[:IMPORTS]->(m:Module) RETURN m.name AS name",
                {"p": actual, "ns": neo4j_ns},
            )
        else:
            res = graph_obj.query(
                "MATCH (f:File {ns: $ns})-[:IMPORTS]->(m:Module) WHERE m.name CONTAINS $t RETURN f.id AS name",
                {"t": file_path, "ns": neo4j_ns},
            )
        return "\n".join(f"- {r['name']}" for r in res) or "None found."

    @tool
    def search_documents(query: str) -> str:
        """Semantic search across the uploaded document/PDF. Use for asking questions about the document, PDF, or files."""
        if not vector_db:
            return "No knowledge base is currently loaded."

        logger.info(f"search_documents called with query: '{query}'")
        docs = vector_db.similarity_search(query, k=4)
        return (
            "\n---\n".join(
                f"Source: {d.metadata.get('source', '?')}\n{d.page_content}"
                for d in docs
            )
            or "No results."
        )

    try:
        mcp_tools = await get_mcp_tools(user_id)
    except Exception as e:
        logger.error(f"Error loading MCP tools: {e}")
        mcp_tools = []

    return [
        search_documents,
        get_project_context,
        get_project_hierarchy,
        get_file_context,
        read_file_content,
        get_specific_code,
        search_code,
        query_dependencies,
        ask_architecture,
        DuckDuckGoSearchRun(),
    ] + mcp_tools
