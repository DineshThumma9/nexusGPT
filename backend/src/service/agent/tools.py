from typing import Any

from github import Auth, Github
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import StructuredTool
from langchain_groq import ChatGroq
from langchain_neo4j import GraphCypherQAChain, Neo4jGraph
from loguru import logger
from qdrant_client.http import models

from src.config.settings import settings
from src.service.agent.mcp import MCPService
from src.service.agent.prompts import CYPHER_GENERATION_TEMPLATE

Groq = ChatGroq

g = Github(auth=Auth.Token(settings.github_token))


async def _resolve_file_id(target: str, async_driver: Any, neo4j_ns: str) -> str | None:
    """
    Resolves a partial path or filename to a full file_id instantly using Neo4j Lucene.
    """
    if not async_driver or not neo4j_ns:
        return None

    # Clean the target (e.g., grab just the filename, remove quotes)
    clean_target = target.split("/")[-1].replace('"', "").strip()

    # Lucene syntax: Allow wildcards for partial paths, or ~1 for minor typos
    lucene_query = f"*{clean_target}* OR {clean_target}~1"

    async with async_driver.session() as session:
        result = await session.run(
            """
            CALL db.index.fulltext.queryNodes("code_search_index", $query)
            YIELD node, score
            WHERE node.ns = $ns AND node.kind = 'File'
            RETURN node.id AS path
            ORDER BY score DESC
            LIMIT 1
            """,
            {"query": lucene_query, "ns": neo4j_ns},
        )
        records = await result.data()

    return records[0]["path"] if records else None


class Tools:
    def __init__(
        self,
        user_id: str,
        vector_db: Any | None = None,
        neo4j_ns: str | None = None,
        graph_obj: Neo4jGraph | None = None,
        async_neo4j=None,
        llm: BaseChatModel | None = None,
    ):
        self.user_id = user_id
        self.vector_db = vector_db
        self.neo4j_ns = neo4j_ns
        self.graph_obj = graph_obj
        self.async_neo4j = async_neo4j
        self.llm = llm
        self.mcp_service: MCPService | None = None
        self.mcp_tools: list = []
        self.tools: list = []

        if self.graph_obj:
            self.cypher_chain = GraphCypherQAChain.from_llm(
                cypher_llm=Groq(
                    model=settings.cypher_llm, api_key=settings.groq_api_key
                ),
                qa_llm=llm,
                graph=self.graph_obj,
                cypher_prompt=PromptTemplate(
                    template=CYPHER_GENERATION_TEMPLATE,
                    input_variables=["schema", "question"],
                ),
                allow_dangerous_requests=True,
                verbose=True,
                return_direct=True,
            )

    @classmethod
    async def build(
        cls,
        user_id: str,
        vector_db: Any | None = None,
        neo4j_ns: str | None = None,
        graph_obj: Neo4jGraph | None = None,
        async_neo4j=None,
        llm: BaseChatModel | None = None,
        mcp_enabled: bool = True,
    ) -> "Tools":
        instance = cls(user_id, vector_db, neo4j_ns, graph_obj, async_neo4j, llm)
        mcp_service = MCPService(user_id)
        instance.mcp_service = mcp_service

        if mcp_enabled:
            instance.mcp_tools = await mcp_service.load_tools()
        else:
            instance.mcp_tools = []

        instance.tools = [
            StructuredTool.from_function(
                coroutine=instance.get_project_context,
                name="get_project_context",
                description=(
                    "Returns the project README, high-level overview, and the complete file hierarchy. "
                    "Use this as your very first step when exploring a new codebase to orient yourself."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.explore_codebase,
                name="explore_codebase",
                description=(
                    "Explore the contents of a directory or a specific file to see its structure. "
                    "Use this to see what is inside a folder or to list the classes and functions in a file."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.search_syntax,
                name="search_syntax",
                description=(
                    "Instantly searches for exact function names, class names, or file paths. "
                    "Use this FIRST to locate where a symbol is defined before trying to read the code."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.read_code,
                name="read_code",
                description=(
                    "Reads the complete content of a file or retrieves the exact source code for a specific class or function. "
                    "Use this when you need to understand the context, imports, and logic. "
                    "If the file is too large, specify the 'symbol' parameter to extract only the needed parts."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.find_callers,
                name="find_callers",
                description=(
                    "Finds all functions that call a specific function by name. "
                    "Use when tracing where a function is invoked from."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.find_callees,
                name="find_callees",
                description=(
                    "Finds all functions that a specific function calls. "
                    "Use when tracing what a function depends on or what it delegates to."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.search_code,
                name="search_code",
                description=(
                    "Semantically searches the codebase chunks for a concept, pattern, "
                    "or piece of logic. Use when you need to find code by meaning rather "
                    "than exact name — e.g. 'authentication middleware', 'retry logic'."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.ask_architecture,
                name="ask_architecture",
                description=(
                    "Answers complex architecture questions using natural language — "
                    "file dependencies, module structure, call chains. Use when standard "
                    "tools would take multiple hops or consume too many tokens."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.search_documents,
                name="search_documents",
                description=(
                    "Queries the user's uploaded documents (PDFs, markdown, text files) "
                    "to find answers. Use when the question is about documentation, "
                    "specs, or non-code files."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.list_mcp_resources,
                name="list_mcp_resources",
                description="List available resources from all configured MCP servers.",
            ),
            StructuredTool.from_function(
                coroutine=instance.read_mcp_resource,
                name="read_mcp_resource",
                description="Read a specific resource by URI from MCP servers.",
            ),
            StructuredTool.from_function(
                coroutine=instance.load_mcp_prompts,
                name="load_mcp_prompts",
                description="Load prompts from all configured MCP servers.",
            ),
            DuckDuckGoSearchRun(),
            *instance.mcp_tools,
        ]

        return instance

    def _require_graph(self) -> bool:
        return bool(self.async_neo4j and self.neo4j_ns)

    def _require_vector(self) -> bool:
        return bool(self.vector_db)

    async def list_mcp_resources(self) -> str:
        """List available resources from all configured MCP servers."""
        if not self.mcp_service:
            return "MCP service not initialized."
        resources = await self.mcp_service.list_resources()
        if not resources:
            return "No MCP resources found."

        result = []
        for r in resources:
            try:
                res_dict = r.model_dump()
            except AttributeError:
                res_dict = (
                    dict(r)
                    if hasattr(r, "keys")
                    else {
                        "uri": getattr(r, "uri", str(r)),
                        "name": getattr(r, "name", ""),
                    }
                )
            result.append(
                f"URI: {res_dict.get('uri')} | Name: {res_dict.get('name')} | MimeType: {res_dict.get('mimeType')}"
            )
        return "\n".join(result)

    async def read_mcp_resource(self, uri: str, server_name: str | None = None) -> str:
        """Read a specific resource by URI from MCP servers."""
        if not self.mcp_service:
            return "MCP service not initialized."
        resource = await self.mcp_service.read_resource(uri, server_name)
        if not resource:
            return f"Resource {uri} not found or could not be read."
        try:
            return getattr(resource, "text", str(resource))
        except Exception as e:
            return f"Error reading resource content: {e}"

    async def load_mcp_prompts(self) -> str:
        """Load prompts from all configured MCP servers."""
        if not self.mcp_service:
            return "MCP service not initialized."
        prompts = await self.mcp_service.load_prompts()
        if not prompts:
            return "No MCP prompts found."

        result = []
        for p in prompts:
            try:
                p_dict = p.model_dump()
            except AttributeError:
                p_dict = (
                    dict(p)
                    if hasattr(p, "keys")
                    else {
                        "name": getattr(p, "name", str(p)),
                        "description": getattr(p, "description", ""),
                    }
                )
            result.append(
                f"Name: {p_dict.get('name')} | Description: {p_dict.get('description')}"
            )
        return "\n".join(result)

    async def get_project_context(self) -> str:
        """Returns the project README, high-level overview, and the full file hierarchy."""
        if not self._require_vector() or not self._require_graph():
            return "No codebase is currently loaded."

        context_str = "---- Project Context -----\n"

        async with self.async_neo4j.session() as session:
            results = await session.run(
                "MATCH (n:CodeNode {ns: $ns, kind: 'File'}) WHERE toLower(n.id) CONTAINS 'readme' RETURN n.id AS path",
                {"ns": self.neo4j_ns},
            )
            readme_records = await results.data()

        if readme_records:
            readme_contents = []
            for r in readme_records:
                content = await self.read_code(r["path"])
                readme_contents.append(content)
            context_str += "\n\n".join(readme_contents)
        else:
            context_str += "No project README available.\n"

        context_str += "\n\n---- Project File Hierarchy -----\n"

        async with self.async_neo4j.session() as session:
            results = await session.run(
                "MATCH (n:CodeNode {ns: $ns, kind: 'File'}) RETURN n.id AS path ORDER BY n.id",
                {"ns": self.neo4j_ns},
            )
            records = await results.data()

        if records:
            hierarchy = "\n".join(f"- {r['path']}" for r in records)
            if len(hierarchy) > 3000:
                hierarchy = hierarchy[:3000] + "\n... [truncated to save tokens]"
            context_str += hierarchy
        else:
            context_str += "No files found in the knowledge base."

        return context_str

    async def explore_codebase(self, path: str = "") -> str:
        """Explore the contents of a directory or a specific file to see its structure(Functions,Classes and Methods it contain)."""
        if not self._require_graph():
            return "No codebase is currently loaded."

        async with self.async_neo4j.session() as session:
            results = await session.run(
                """
                MATCH (file:CodeNode {ns: $ns, kind: 'File'}) WHERE file.id CONTAINS $path
                OPTIONAL MATCH (file)-[:CONTAINS]->(symbol:CodeNode {ns: $ns}) WHERE symbol.kind IN ['Class', 'Function']
                RETURN file.id AS path, collect('[' + symbol.kind + '] ' + symbol.name) AS symbols LIMIT 8
                """,
                {"ns": self.neo4j_ns, "path": path},
            )
            records = await results.data()

        if not records:
            return f"No files found matching path '{path}'."

        output_lines = []
        for r in records:
            file_path = r["path"]
            symbols = r["symbols"]
            if symbols and any(symbols):
                output_lines.append(
                    f"File: {file_path}\n  Symbols: {', '.join([s for s in symbols if s])}"
                )
            else:
                output_lines.append(f"File: {file_path}")

        return "\n".join(output_lines)

    async def search_syntax(self, keyword: str) -> str:
        if not self.async_neo4j or not self.neo4j_ns:
            return "No codebase is currently loaded."

        clean_kw = keyword.replace('"', "").strip()
        lucene_query = f"*{clean_kw}* OR {clean_kw}~1"

        async with self.async_neo4j.session() as session:
            result = await session.run(
                """
                    CALL db.index.fulltext.queryNodes("code_search_index", $query)
                    YIELD node, score
                    WHERE node.ns = $ns
                    RETURN node.kind AS kind, node.name AS name, node.id AS id
                    ORDER BY score DESC LIMIT 5
                    """,
                {"query": lucene_query, "ns": self.neo4j_ns},
            )

            records = await result.data()

        if not records:
            return f"No exact or close syntax matches found for '{keyword}'."

        output = []
        for r in records:
            entry = f"[{r['kind']}] {r['name']}\n  ID/Path: {r['id']}"
            output.append(entry)

        return "\n\n".join(output)

    async def read_code(self, path: str, symbol: str | None = None) -> str:
        """Reads the complete content of a file or retrieves exact source code for a specific class/function."""
        if not self._require_vector():
            return "No codebase is currently loaded."
        if not path or not path.strip():
            return "Error: 'path' must not be empty."

        actual = await _resolve_file_id(path, self.async_neo4j, self.neo4j_ns)
        if not actual:
            return f"File not found: '{path}'. Use explore_codebase to browse available files."

        from src.db.vectordb import get_qdrant

        q_client = get_qdrant()

        file_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.file_path",
                    match=models.MatchValue(value=actual),
                ),
                models.FieldCondition(
                    key="metadata.kb_id",
                    match=models.MatchValue(value=self.neo4j_ns),
                ),
            ]
        )

        records, _ = await q_client.scroll(
            collection_name=self.vector_db.collection_name,
            scroll_filter=file_filter,
            limit=500,
            with_payload=True,
        )

        if not records:
            # Check if file exists in Neo4j to differentiate between "missing" and "empty/unparseable"
            async with self.async_neo4j.session() as session:
                res = await session.run(
                    "MATCH (n:CodeNode {ns: $ns, id: $id, kind: 'File'}) RETURN n.id LIMIT 1",
                    {"ns": self.neo4j_ns, "id": actual},
                )
                if await res.single():
                    return (
                        f"File '{actual}' exists (verified via graph) but has no content indexed in Qdrant. "
                        "This typically means the file is empty, contains only unparseable types, or was skipped."
                    )
            return f"No content found for '{actual}'."

        if symbol:
            symbol_pattern = symbol.strip()
            records = [
                r
                for r in records
                if symbol_pattern in r.payload.get("page_content", "")
            ]
            if not records:
                return (
                    f"No code found for '{symbol}' in '{actual}'. "
                    "Try explore_codebase to confirm the symbol name."
                )
            title = f"--- Source of '{symbol}' in {actual} ---\n"
        else:
            title = f"--- Content of {actual} ---\n"

        sorted_records = sorted(
            records, key=lambda r: r.payload.get("metadata", {}).get("start_byte") or 0
        )

        if not symbol and len(sorted_records) > 10:
            content = "\n".join(
                r.payload.get("page_content", "") for r in sorted_records[:10]
            )
            return (
                title
                + content
                + "\n\n... [WARNING: File truncated due to context bloat. "
                "Use the 'symbol' parameter in read_code to extract specific classes or functions.]"
            )

        return title + "\n".join(
            r.payload.get("page_content", "") for r in sorted_records
        )

    async def find_callers(self, function_name: str) -> str:
        """Returns all callers of the given function from the call graph."""
        if not self._require_graph():
            return "No codebase is currently loaded."

        async with self.async_neo4j.session() as session:
            results = await session.run(
                """
                MATCH (caller:CodeNode {ns: $ns})-[:CALLS]->(target:CodeNode {ns: $ns})
                WHERE target.name = $fn
                RETURN caller.name AS caller, caller.id AS caller_id
                ORDER BY caller.id
                LIMIT 30
                """,
                {"ns": self.neo4j_ns, "fn": function_name},
            )
            records = await results.data()

        if not records:
            return f"No callers found for '{function_name}'."
        lines = [f"- {r['caller']} ({r['caller_id']})" for r in records]
        return f"Functions that call '{function_name}':\n" + "\n".join(lines)

    async def find_callees(self, function_name: str) -> str:
        """Returns all functions called by the given function."""
        if not self._require_graph():
            return "No codebase is currently loaded."

        async with self.async_neo4j.session() as session:
            results = await session.run(
                """
                MATCH (caller:CodeNode {ns: $ns, name: $fn})-[:CALLS]->(target:CodeNode {ns: $ns})
                RETURN target.name AS callee, target.id AS callee_id
                ORDER BY target.name
                LIMIT 30
                """,
                {"ns": self.neo4j_ns, "fn": function_name},
            )
            records = await results.data()

        if not records:
            return f"No callees found for '{function_name}'."
        lines = [f"- {r['callee']} ({r['callee_id']})" for r in records]
        return f"Functions called by '{function_name}':\n" + "\n".join(lines)

    async def search_code(self, query: str) -> str:
        """Semantic search over all indexed code chunks."""
        if not self._require_vector():
            return "No knowledge base is currently loaded."
        if not query or not query.strip():
            return "Error: query must not be empty."

        docs = await self.vector_db.asimilarity_search(query.strip(), k=5)
        if not docs:
            return "No relevant code found."

        return "\n\n---\n".join(
            f"file: {d.metadata.get('file_path', '?')}\n{d.page_content}" for d in docs
        )

    async def ask_architecture(self, query: str) -> str:
        """Natural-language architecture queries backed by GraphCypherQAChain."""
        if not self._require_graph():
            return "No codebase is currently loaded."
        if not query:
            return "Please provide a query."
        if not self.cypher_chain:
            return "Architecture query is unavailable (graph not configured)."

        try:
            result = await self.cypher_chain.ainvoke({"query": query})
            return str(result.get("result", result))
        except Exception as e:
            error_str = str(e)
            if "SyntaxError" in error_str and "Invalid input" in error_str:
                logger.warning("Cypher generation failed — query too vague.")
                return (
                    "Could not query the architecture: the query was too vague. "
                    "Try asking specifically about imports, dependencies, or call relationships."
                )
            logger.error(f"Error in ask_architecture: {e}")
            return f"Error querying architecture: {e}"

    async def search_documents(self, query: str) -> str:
        """Semantic search over uploaded documents."""
        if not self._require_vector():
            return "No document knowledge base is currently loaded."
        if not query:
            return "Error: Please provide a search query."

        docs = await self.vector_db.asimilarity_search(query, k=5)
        if not docs:
            return "No relevant document context found."

        return "---- Document Context -----\n" + "\n\n".join(
            f"source: {d.metadata.get('source', 'Unknown')}\ncontent: {d.page_content}"
            for d in docs
        )
