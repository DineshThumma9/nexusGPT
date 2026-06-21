from typing import Any
from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import StructuredTool
from langchain_groq import ChatGroq
from langchain_neo4j import GraphCypherQAChain, Neo4jGraph
from loguru import logger
from qdrant_client.http import models

from src.config.settings import settings
from src.service.agent.prompts import CYPHER_GENERATION_TEMPLATE
from src.db.vectordb import get_qdrant

Groq = ChatGroq

async def _resolve_file_id(target: str, async_driver: Any, neo4j_ns: str) -> str | None:
    """
    Resolves a partial path or filename to a full file_id instantly using Neo4j Lucene.
    """
    if not async_driver or not neo4j_ns:
        return None

    clean_target = target.split("/")[-1].replace('"', "").strip()
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


class CodeTools:
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
        self.cypher_chain = None
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
    ) -> "CodeTools":
        instance = cls(user_id, vector_db, neo4j_ns, graph_obj, async_neo4j, llm)

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
                    "Use this to see what is inside a folder or to list the classes and functions in a file. "
                    "Accepts a 'limit' parameter to control the maximum number of files returned (default 20, max 50)."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.search_syntax,
                name="search_syntax",
                description=(
                    "Instantly searches for exact function names, class names, or file paths. "
                    "Use this FIRST to locate where a symbol is defined before trying to read the code. "
                    "Accepts a 'limit' parameter to control the maximum number of matches returned (default 15, max 50)."
                ),
            ),
            StructuredTool.from_function(
                coroutine=instance.read_code,
                name="read_code",
                description=(
                    "CRITICAL: DO NOT use this tool to read an entire file without a symbol unless you know the file is under 50 lines. "
                    "You MUST use 'explore_codebase' first to find the exact class or function name, "
                    "and then pass that exact name into the 'symbol' parameter. "
                    "If you omit the symbol, the file WILL be heavily truncated and you will fail your task."
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
        ]

        return instance

    def _require_graph(self) -> bool:
        return bool(self.async_neo4j and self.neo4j_ns)

    def _require_vector(self) -> bool:
        return bool(self.vector_db)

    async def get_project_context(self) -> str:
        """Returns the project README, high-level overview, and the full file hierarchy."""
        if not self._require_vector() or not self._require_graph():
            return "<error>No codebase is currently loaded.</error>"

        context_str = "<project_context>\n"

        async with self.async_neo4j.session() as session:
            results = await session.run(
                "MATCH (n:CodeNode {ns: $ns, kind: 'File'}) WHERE toLower(n.id) CONTAINS 'readme' RETURN n.id AS path",
                {"ns": self.neo4j_ns},
            )
            readme_records = await results.data()

        if readme_records:
            r = readme_records[0]
            content = await self.read_code(r["path"])
            context_str += f"<readme path='{r['path']}'>\n{content}\n</readme>\n"
        else:
            context_str += "<readme>No project README available.</readme>\n"

        async with self.async_neo4j.session() as session:
            results = await session.run(
                "MATCH (n:CodeNode {ns: $ns, kind: 'File'}) RETURN n.id AS path ORDER BY n.id",
                {"ns": self.neo4j_ns},
            )
            records = await results.data()

        if records:
            hierarchy = "\n".join(f"<file path='{r['path']}'/>" for r in records)
            if len(hierarchy) > 3000:
                hierarchy = hierarchy[:3000] + "\n<!-- [truncated to save tokens] -->"
            context_str += f"\n<file_hierarchy>\n{hierarchy}\n</file_hierarchy>"
        else:
            context_str += "\n<file_hierarchy>No files found in the knowledge base.</file_hierarchy>"

        context_str += "\n</project_context>"
        return context_str

    async def explore_codebase(self, path: str = "", limit: int = 20) -> str:
        """Explore the contents of a directory or a specific file to see its structure(Functions,Classes and Methods it contain)."""
        if not self._require_graph():
            return "<error>No codebase is currently loaded.</error>"

        limit = min(limit, 50)

        async with self.async_neo4j.session() as session:
            results = await session.run(
                """
                MATCH (file:CodeNode {ns: $ns, kind: 'File'}) WHERE file.id CONTAINS $path
                OPTIONAL MATCH (file)-[:CONTAINS]->(symbol:CodeNode {ns: $ns}) WHERE symbol.kind IN ['Class', 'Function']
                RETURN file.id AS path, collect('[' + symbol.kind + '] ' + symbol.name) AS symbols LIMIT toInteger($limit)
                """,
                {"ns": self.neo4j_ns, "path": path, "limit": limit},
            )
            records = await results.data()

        if not records:
            return f"<result>No files found matching path '{path}'.</result>"

        output_lines = ["<directory_exploration>"]
        for r in records:
            file_path = r["path"]
            symbols = r["symbols"]
            output_lines.append(f"  <file path='{file_path}'>")
            if symbols and any(symbols):
                for s in symbols:
                    if s:
                        output_lines.append(f"    <symbol>{s}</symbol>")
            output_lines.append("  </file>")
        output_lines.append("</directory_exploration>")

        return "\n".join(output_lines)

    async def search_syntax(self, keyword: str, limit: int = 15) -> str:
        if not self._require_graph():
            return "<error>No codebase is currently loaded.</error>"

        clean_kw = keyword.replace('"', "").strip()
        lucene_query = f"*{clean_kw}* OR {clean_kw}~1"
        limit = min(limit, 50)

        async with self.async_neo4j.session() as session:
            result = await session.run(
                """
                    CALL db.index.fulltext.queryNodes("code_search_index", $query)
                    YIELD node, score
                    WHERE node.ns = $ns
                    RETURN node.kind AS kind, node.name AS name, node.id AS id
                    ORDER BY score DESC LIMIT toInteger($limit)
                    """,
                {"query": lucene_query, "ns": self.neo4j_ns, "limit": limit},
            )

            records = await result.data()

        if not records:
            return f"<result>No exact or close syntax matches found for '{keyword}'.</result>"

        output = ["<syntax_search_results>"]
        for r in records:
            output.append(f"  <match kind='{r['kind']}' name='{r['name']}' path='{r['id']}' />")
        output.append("</syntax_search_results>")

        return "\n".join(output)

    async def read_code(self, path: str, symbol: str | None = None) -> str:
        """Reads the complete content of a file or retrieves exact source code for a specific class/function."""
        if not self._require_vector():
            return "<error>No codebase is currently loaded.</error>"
        if not path or not path.strip():
            return "<error>'path' must not be empty.</error>"

        actual = await _resolve_file_id(path, self.async_neo4j, self.neo4j_ns)
        if not actual:
            return f"<error>File not found: '{path}'. Use explore_codebase to browse available files.</error>"

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
                        f"<error>File '{actual}' exists (verified via graph) but has no content indexed in Qdrant. "
                        "This typically means the file is empty, contains only unparseable types, or was skipped.</error>"
                    )
            return f"<error>No content found for '{actual}'.</error>"

        if symbol:
            symbol_pattern = symbol.strip()
            records = [
                r
                for r in records
                if symbol_pattern in r.payload.get("page_content", "")
            ]
            if not records:
                return (
                    f"<error>No code found for '{symbol}' in '{actual}'. "
                    "Try explore_codebase to confirm the symbol name.</error>"
                )
            title = f"<code_content file='{actual}' symbol='{symbol}'>\n"
        else:
            title = f"<code_content file='{actual}'>\n"

        sorted_records = sorted(
            records, key=lambda r: r.payload.get("metadata", {}).get("start_byte") or 0
        )

        if not symbol and len(sorted_records) > 10:
            raw_content = "\n".join(
                r.payload.get("page_content", "") for r in sorted_records[:10]
            )
            return (
                title
                + f"<![CDATA[\n{raw_content}\n]]>"
                + "\n\n<!-- WARNING: File truncated due to context bloat. "
                "Use the 'symbol' parameter in read_code to extract specific classes or functions. -->\n</code_content>"
            )

        raw_content = "\n".join(
            r.payload.get("page_content", "") for r in sorted_records
        )
        return f"{title}<![CDATA[\n{raw_content}\n]]>\n</code_content>"

    async def find_callers(self, function_name: str) -> str:
        """Returns all callers of the given function from the call graph."""
        if not self._require_graph():
            return "<error>No codebase is currently loaded.</error>"

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
            return f"<result>No callers found for '{function_name}'.</result>"
        lines = [f"  <caller name='{r['caller']}' id='{r['caller_id']}' />" for r in records]
        return f"<callers_of function='{function_name}'>\n" + "\n".join(lines) + "\n</callers_of>"

    async def find_callees(self, function_name: str) -> str:
        """Returns all functions called by the given function."""
        if not self._require_graph():
            return "<error>No codebase is currently loaded.</error>"

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
            return f"<result>No callees found for '{function_name}'.</result>"
        lines = [f"  <callee name='{r['callee']}' id='{r['callee_id']}' />" for r in records]
        return f"<callees_of function='{function_name}'>\n" + "\n".join(lines) + "\n</callees_of>"

    async def search_code(self, query: str) -> str:
        """Semantic search over all indexed code chunks."""
        if not self._require_vector():
            return "<error>No knowledge base is currently loaded.</error>"
        if not query or not query.strip():
            return "<error>query must not be empty.</error>"

        docs = await self.vector_db.asimilarity_search(query.strip(), k=5)
        if not docs:
            return "<result>No relevant code found.</result>"

        results = []
        for d in docs:
            results.append(f"  <chunk file='{d.metadata.get('file_path', '?')}'>\n<![CDATA[\n{d.page_content}\n]]>\n  </chunk>")
        
        return "<semantic_search_results>\n" + "\n".join(results) + "\n</semantic_search_results>"

    async def ask_architecture(self, query: str) -> str:
        """Natural-language architecture queries backed by GraphCypherQAChain."""
        if not self._require_graph():
            return "<error>No codebase is currently loaded.</error>"
        if not query:
            return "<error>Please provide a query.</error>"
        if not self.cypher_chain:
            return "<error>Architecture query is unavailable (graph not configured).</error>"

        try:
            result = await self.cypher_chain.ainvoke({"query": query})
            return f"<architecture_result>\n{result.get('result', result)}\n</architecture_result>"
        except Exception as e:
            error_str = str(e)
            if "SyntaxError" in error_str and "Invalid input" in error_str:
                logger.warning("Cypher generation failed — query too vague.")
                return "<error>Could not query the architecture: the query was too vague. Try asking specifically about imports, dependencies, or call relationships.</error>"
            logger.error(f"Error in ask_architecture: {e}")
            return f"<error>Error querying architecture: {e}</error>"
