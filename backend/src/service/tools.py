import difflib
import os
from typing import Any

from dotenv import load_dotenv
from github import Auth, Github
from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
)
from langchain.tools import tool
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_community.tools import DuckDuckGoSearchResults, DuckDuckGoSearchRun
from langchain_groq import ChatGroq
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_neo4j import GraphCypherQAChain, Neo4jGraph
from src.service.prompt import summarization_prompt


load_dotenv()


token = os.getenv("GITHUB_TOKEN")
if token:
    auth = Auth.Token(token)
    g = Github(auth=auth)
else:
    g = Github()


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


import json


async def get_mcp_tools():
    if not os.path.exists("mcp_config.json"):
        return []
    try:
        with open("mcp_config.json", "r") as f:
            config = json.load(f)
        client = MultiServerMCPClient(config)
        tools = await client.get_tools()
        return tools
    except Exception as e:
        import logging

        logging.getLogger("tools").error(f"Error loading MCP tools: {e}")
        return []


async def make_tools(
    vector_db: Any | None = None,
    neo4j_ns: str | None = None,
    graph_obj: Neo4jGraph | None = None,
) -> list:
    """
    Tool factory. All tools close over the session-specific clients.
    enriched is None for vanilla (no RAG context) mode.
    """

    from langchain_groq import ChatGroq as Groq

    cypher_chain = None
    if graph_obj:
        cypher_chain = GraphCypherQAChain.from_llm(
            cypher_llm=Groq(model="compound-beta"),
            qa_llm=Groq(model="compound-beta"),
            graph=graph_obj,
            allow_dangerous_requests=True,
            verbose=True,
        )

    @tool
    def ask_architecture(question: str) -> str:
        """Ask natural language questions about the codebase architecture, file dependencies, and structural relationships. (e.g. 'What files import X?')"""
        if not cypher_chain: return "No codebase is currently loaded. Cannot answer architecture questions."
        try:
            res = cypher_chain.invoke({"query": question})
            return res.get("result", str(res))
        except Exception as e:
            return f"Error querying architecture graph: {e}"

    def _resolve_path(target: str) -> str | None:
        if not graph_obj or not neo4j_ns: return None
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

    @tool
    def get_project_context() -> str:
        """Always call this first. Returns README and high-level project info."""
        if not vector_db: return "No knowledge base is currently loaded."
        docs = vector_db.similarity_search("README", k=4)
        readme_docs = [
            d for d in docs if "readme" in str(d.metadata.get("source", "")).lower()
        ]
        if readme_docs:
            return f"--- README ---\n" + "\n".join(
                [d.page_content for d in readme_docs]
            )
        return "No README found or context loaded."

    @tool
    def get_project_hierarchy() -> str:
        """Returns the full file tree of the loaded repository."""
        if not graph_obj or not neo4j_ns: return "No codebase is currently loaded."
        res = graph_obj.query(
            "MATCH (f:File {ns: $ns}) RETURN f.id AS path", {"ns": neo4j_ns}
        )
        paths = [r["path"] for r in res]
        return "\n".join(sorted(paths)) if paths else "No files found."

    @tool
    def get_file_context(file_path: str) -> str:
        """Lists functions and classes inside a specific file."""
        if not graph_obj or not neo4j_ns: return "No codebase is currently loaded."
        actual = _resolve_path(file_path)
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
        if not vector_db: return "No knowledge base is currently loaded."
        actual = _resolve_path(file_path)
        if not actual:
            # Maybe it's a file that didn't get mapped in Neo4j but exists in Qdrant (like README.md)
            # Try falling back to raw path string if resolution fails
            actual = file_path
            
        client = vector_db.client
        collection_name = vector_db.collection_name
        from qdrant_client.http import models
        
        try:
            records, _ = client.scroll(
                collection_name=collection_name,
                scroll_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="metadata.source",
                            match=models.MatchValue(value=actual)
                        )
                    ]
                ),
                limit=1000,
                with_payload=True,
                with_vectors=False
            )
            
            if not records:
                return f"No content found for '{actual}' in the vector store."
                
            # Sort by start_byte or start_line to reconstruct
            def get_start(r):
                meta = r.payload.get("metadata", {})
                return meta.get("start_byte") or meta.get("start_line") or 0
                
            sorted_records = sorted(records, key=get_start)
            content = "\n".join(r.payload.get("page_content", "") for r in sorted_records)
            return f"--- {actual} ---\n{content}"
        except Exception as e:
            return f"Error reading file content: {e}"

    @tool
    def search_code(query: str) -> str:
        """Semantic search across the codebase. Use for 'where is X implemented?' questions."""
        if not vector_db: return "No knowledge base is currently loaded."
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
        if not vector_db: return "No knowledge base is currently loaded."
        actual = _resolve_path(file_path)
        if not actual:
            return f"Error: '{file_path}' not found."
            
        from qdrant_client.http import models
        docs = vector_db.similarity_search(
            query=target_name,
            k=3,
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="metadata.source",
                        match=models.MatchValue(value=actual)
                    )
                ]
            )
        )

        if not docs:
            return f"Could not find exact code for '{target_name}' in {actual}."

        docs = sorted(
            docs, 
            key=lambda d: d.metadata.get("start_line") or d.metadata.get("start_byte") or 0
        )


        content = "\n".join(d.page_content for d in docs)
        
        return f"--- Code for '{target_name}' in {actual} ---\n{content}"
    @tool
    def query_dependencies(file_path: str, direction: str) -> str:
        """
        Explore import relationships.
        direction: 'imports' (what this file depends on) or 'imported_by' (what uses it)
        """
        if not graph_obj or not neo4j_ns: return "No codebase is currently loaded."
        actual = _resolve_path(file_path)
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
        if not vector_db: return "No knowledge base is currently loaded."
        import logging

        logger = logging.getLogger("tools")
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
        mcp_tools = await get_mcp_tools()
    except Exception as e:
        import logging

        logging.getLogger("tools").error(f"Error loading MCP tools: {e}")
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


from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import RemoveMessage


class CleanToolMessagesMiddleware(AgentMiddleware):
    """
    Cleans up orphaned ToolMessages that lost their parent AIMessage
    due to context window summarization. This prevents strict APIs like
    Mistral from crashing with a 400 Bad Request error.
    """

    def before_model(self, state, runtime):
        messages = state.get("messages", [])
        if not messages:
            return None

        ai_tool_call_ids = set()
        for msg in messages:
            if msg.type == "ai" and getattr(msg, "tool_calls", None):
                for tc in msg.tool_calls:
                    if tc.get("id"):
                        ai_tool_call_ids.add(tc["id"])

        to_remove = []
        for msg in messages:
            if msg.type == "tool":
                if getattr(msg, "tool_call_id", None) not in ai_tool_call_ids:
                    if hasattr(msg, "id") and msg.id:
                        to_remove.append(RemoveMessage(id=msg.id))

        if to_remove:
            return {"messages": to_remove}
        return None

def middleware_setup():
    summarization = SummarizationMiddleware(
        model=ChatGroq(model="compound_beta"),
        trigger=[("messages", 10), ("tokens", 6000)],
        keep=("messages", 8),
        summarization_prompt=summarization_prompt,
    )
    
    # Caps the LLM thinking loops (e.g. LLM getting confused and talking to itself)
    call_tracker = ModelCallLimitMiddleware(
        thread_limit=50, 
        run_limit=6,  # Slightly higher than tool limit to allow a final synthesis call
        exit_behavior="end" 
    )

    # Caps the actual tool execution (RAG searches, MCP actions)
    tool_tracker = ToolCallLimitMiddleware(
        thread_limit=50, 
        run_limit=5,  # Your ideal 5 calls per "round"
        exit_behavior="continue" # Forces the LLM to summarize its failures rather than crashing
    )
    
    orphan_cleaner = CleanToolMessagesMiddleware()

    # Order matters: Clean orphans first, track limits, then summarize if needed
    return [orphan_cleaner, tool_tracker, call_tracker, summarization]