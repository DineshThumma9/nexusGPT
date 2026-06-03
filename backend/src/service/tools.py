import asyncio
import difflib
import json
import time
from typing import Any
from urllib.parse import urlparse

from github import Auth, Github
from langchain.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.language_models import BaseChatModel
from langchain_groq import ChatGroq
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_neo4j import GraphCypherQAChain, Neo4jGraph
from loguru import logger
from qdrant_client.http import models
from sqlalchemy import select

from src.config.settings import settings
from src.db.dbs import get_db
from src.db.redis_client import aredis as redis_client
from src.models.models import UserMCPConfig
from src.service.utils import decrypt

Groq = ChatGroq


g = Github(auth=Auth.Token(settings.github_token))


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
            async for db in get_db():
                result = await db.execute(
                    select(UserMCPConfig).where(UserMCPConfig.user_id == user_id)
                )
                configs = result.scalars().all()

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
        target.split("/")[-1], basenames, n=1, cutoff=0.8
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
        cypher_chain = GraphCypherQAChain.from_llm(
            cypher_llm=Groq(model=settings.cypher_llm, api_key=settings.groq_api_key),
            qa_llm=Groq(model=settings.qa_llm, api_key=settings.groq_api_key),
            graph=graph_obj,
            allow_dangerous_requests=True,
            verbose=True,
        )

    @tool(
        description="Use this tool at the start of a conversation or when the user asks what the project is about, its tech stack, or how to get started."
    )
    def get_project_context():
        """Returns the project overview and tech stack from the README and indexed docs."""
        if not vector_db:
            logger.info(
                f"Vector DB not configured for user_id: {user_id}, ns: {neo4j_ns}"
            )
            return "No knowledge base is currently loaded."

        docs = vector_db.similarity_search("README project overview tech stack", k=5)
        readme_docs = [
            doc for doc in docs if "readme" in doc.metadata.get("source", "").lower()
        ]

        if readme_docs:
            return "---README---\n" + "\n".join(
                [doc.page_content for doc in readme_docs]
            )

        return "\n----\n".join(
            f"source: {doc.metadata.get('source', '?')}\ncontent: {doc.page_content}"
            for doc in docs
        )

    @tool(
        description="Returns the full file and folder hierarchy of the loaded repository. Use this when the user asks about project structure, what files exist, or wants to navigate the codebase."
    )
    def get_project_hierarchy():
        """Returns the full file tree of the loaded repository from the graph database."""
        if not graph_obj or not neo4j_ns:
            return "No codebase is currently loaded."

        query = """
        MATCH (f:File {ns: $ns})
        RETURN f.id AS path
        ORDER BY f.id
        """

        results = graph_obj.query(query, {"ns": neo4j_ns})

        if not results:
            return "No files found."

        paths = [r["path"] for r in results]
        output = "\n".join(f"- {p}" for p in paths)
        if len(output) > 3000:
            output = output[:3000] + "\n... [truncated to save tokens]"
        return output

    @tool(
        description="Returns all files inside a specific directory. Use this when the user asks about a specific folder, module, or package within the project."
    )
    def get_dir_context(dir: str):
        """Lists all files under the given directory path prefix."""
        if not graph_obj or not neo4j_ns:
            return "No codebase is currently loaded."

        dir_query = """
            MATCH (f:File {ns: $ns})
            WHERE f.id STARTS WITH $dir OR f.id CONTAINS $dir
            RETURN f.id AS path
            ORDER BY f.id
        """

        results = graph_obj.query(dir_query, {"ns": neo4j_ns, "dir": dir})

        if not results:
            return f"No files found under directory '{dir}'."

        return "\n".join(f"- {r['path']}" for r in results)

    @tool(
        description="This tool provides overview of file gives classes,function,interface or any other symbol it contain"
    )
    def get_file_context(path: str):
        "Gives Context of file and functions and classes and flow"

        if not graph_obj:
            logger.info(
                "Graph obj has not been configured tried to make a file context call user_id:{user_id} and ns: {neo4j_ns}"
            )
            return

        actual = _resolve_path(path, graph_obj, neo4j_ns)

        if not actual:
            return f"No File found {path}"

        file_query = """
            MATCH (f:File {id: $path, ns: $ns}) - [:CONTAINS] -> (s:Symbol)
            RETURN s.type as kind, s.name as name
            ORDER BY s.name
        """

        results = graph_obj.query(file_query, {"path": actual, "ns": neo4j_ns})

        if not results:
            return f"No symbols found in '{actual}'. The file exists but may have no parsed symbols (e.g. config/text file)."

        return "\n".join([f"Kind: {r['kind']} | Name: {r['name']}" for r in results])

    @tool(
        description="Fetches the exact source code of a specific function, class, or symbol within a file. Use this when you know the file path and the name of the symbol you want to read."
    )
    def get_source_code(path: str, symbol: str):
        """Returns the source code of the specified symbol from the given file."""
        if not vector_db:
            logger.info(
                f"Vector DB not configured for user_id: {user_id}, ns: {neo4j_ns}"
            )
            return "No knowledge base is currently loaded."

        if not path or not path.strip():
            return "Error: 'path' must not be empty. Provide the file path (e.g. 'src/service/tools.py')."
        if not symbol or not symbol.strip():
            return "Error: 'symbol' must not be empty. Provide the function or class name to look up."

        actual = _resolve_path(path, graph_obj, neo4j_ns)
        if not actual:
            return f"File not found: '{path}'"

        docs = vector_db.similarity_search(
            symbol.strip(),
            k=4,
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="metadata.source",
                        match=models.MatchValue(value=actual),
                    )
                ]
            ),
        )

        if not docs:
            return f"No code found for symbol '{symbol}' in '{actual}'. Try get_file_context first to see what symbols exist in this file."

        sorted_docs = sorted(
            docs,
            key=lambda d: (
                d.metadata.get("start_line") or d.metadata.get("start_byte") or 0
            ),
        )

        content = "\n".join(doc.page_content for doc in sorted_docs)
        return f"--- Source of '{symbol}' in {actual} ---\n{content}"

    @tool(
        description="This tool provides enables natural language to query on codebase architecture and flow use it when query is complex and standard tools will result in more tokens"
    )
    def ask_architecture(query: str):
        """
        A Tool which answers complex architecture related queries on basis of file dependency and file imports and code structure
        Use it for when question is ambigous and standard tools might leads to more token consumptions

        """

        if not graph_obj:
            logger.info(
                "Graph obj has not been configured tried to make a file context call user_id:{user_id} and ns: {neo4j_ns}"
            )
            return

        if not query:
            return "please provide query"

        try:
            result = cypher_chain.invoke({"query": query})
            return result.get("result", str(result))
        except Exception as e:
            error_str = str(e)
            if "SyntaxError" in error_str and "Invalid input" in error_str:
                logger.warning(
                    f"Cypher generation failed (likely LLM output natural text instead of query)."
                )
                return "Could not query the architecture: The query was too vague or unrelated to the graph structure, so the system failed to generate a valid database query. Try asking more specifically about file dependencies, imports, or modules."

            logger.error(f"Error in ask_architecture: {e}")
            return f"Error in ask_architecture: {e}"

    @tool(
        description="Queries the user's uploaded documents (e.g., PDFs, text files) to find answers and context based on a search query."
    )
    def search_documents(query: str):
        """
        This tool provides a way to semantic-search the user's uploaded documents (like PDFs)
        and provides context to answer their query.
        """
        if not vector_db:
            logger.info("Vector DB not configured")
            return "No document knowledge base is currently loaded."

        if not query:
            return "Error: Please provide a search query."

        docs = vector_db.similarity_search(query, k=5)

        if not docs:
            return "No relevant document context found."

        formatted_docs = [
            f"source: {doc.metadata.get('source', 'Unknown')}\ncontent: {doc.page_content}"
            for doc in docs
        ]

        return "---- Document Context ----- \n" + "\n\n".join(formatted_docs)

    try:
        mcp_tools = await get_mcp_tools(user_id)
    except Exception as e:
        logger.error(f"Error loading MCP tools: {e}")
        mcp_tools = []

    return [
        get_project_context,
        get_project_hierarchy,
        get_dir_context,
        get_file_context,
        get_source_code,
        ask_architecture,
        DuckDuckGoSearchRun(),
        search_documents,
    ] + mcp_tools
