from typing import Any
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import StructuredTool

class DocumentTools:
    def __init__(
        self,
        user_id: str,
        vector_db: Any | None = None,
        llm: BaseChatModel | None = None,
    ):
        self.user_id = user_id
        self.vector_db = vector_db
        self.llm = llm
        self.tools: list = []

    @classmethod
    async def build(
        cls,
        user_id: str,
        vector_db: Any | None = None,
        llm: BaseChatModel | None = None,
    ) -> "DocumentTools":
        instance = cls(user_id, vector_db, llm)

        instance.tools = [
            StructuredTool.from_function(
                coroutine=instance.search_documents,
                name="search_documents",
                description=(
                    "Queries the user's uploaded documents (PDFs, markdown, text files) "
                    "to find answers. Use when the question is about documentation, "
                    "specs, or non-code files."
                ),
            ),
        ]

        return instance

    def _require_vector(self) -> bool:
        return bool(self.vector_db)

    async def search_documents(self, query: str) -> str:
        """Semantic search over uploaded documents."""
        if not self._require_vector():
            return "<error>No document knowledge base is currently loaded.</error>"
        if not query:
            return "<error>Please provide a search query.</error>"

        docs = await self.vector_db.asimilarity_search(query, k=5)
        if not docs:
            return "<result>No relevant document context found.</result>"

        results = []
        for d in docs:
            source = d.metadata.get('source', 'Unknown')
            content = d.page_content
            results.append(f"<document>\n<source>{source}</source>\n<content>\n{content}\n</content>\n</document>")

        return "<retrieved_context>\n" + "\n".join(results) + "\n</retrieved_context>"
