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
    vector_db: Any,
    neo4j_ns: str,
    graph_obj: Neo4jGraph,
    source_type: str = "github",
) -> list:
    """
    Tool factory. All tools close over the session-specific clients.
    enriched is None for vanilla (no RAG context) mode.
    """

    from langchain_groq import ChatGroq as Groq

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
        try:
            res = cypher_chain.invoke({"query": question})
            return res.get("result", str(res))
        except Exception as e:
            return f"Error querying architecture graph: {e}"

    def _resolve_path(target: str) -> str | None:
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
        res = graph_obj.query(
            "MATCH (f:File {ns: $ns}) RETURN f.id AS path", {"ns": neo4j_ns}
        )
        paths = [r["path"] for r in res]
        return "\n".join(sorted(paths)) if paths else "No files found."

    @tool
    def get_file_context(file_path: str) -> str:
        """Lists functions and classes inside a specific file."""
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
    def search_code(query: str) -> str:
        """Semantic search across the codebase. Use for 'where is X implemented?' questions."""
        docs = vector_db.similarity_search(query, k=4)
        return (
            "\n---\n".join(
                f"Source: {d.metadata.get('source', '?')}\n{d.page_content}"
                for d in docs
            )
            or "No results."
        )

    @tool
    def query_dependencies(file_path: str, direction: str) -> str:
        """
        Explore import relationships.
        direction: 'imports' (what this file depends on) or 'imported_by' (what uses it)
        """
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

    if str(source_type).lower() in ["pdf", "url", "notes"]:
        return [search_documents]

    try:
        mcp_tools = await get_mcp_tools()
    except Exception as e:
        import logging

        logging.getLogger("tools").error(f"Error loading MCP tools: {e}")
        mcp_tools = []
    
    
    return [
        get_project_context,
        get_project_hierarchy,
        get_file_context,
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
        # Your trigger looks fine, but tweak keep/fraction if you want more raw buffer
        trigger=[("messages", 10), ("tokens", 6000)],
        keep=("messages",8),
        summarization_prompt=summarization_prompt,
    )
    call_tracker = ModelCallLimitMiddleware(
        thread_limit=10, run_limit=5, exit_behavior="end"
    )

    tool_tracker = ToolCallLimitMiddleware(
        thread_limit=50, run_limit=50, exit_behavior="continue"
    )
    
    orphan_cleaner = CleanToolMessagesMiddleware()

    return [summarization, orphan_cleaner, call_tracker, tool_tracker]
