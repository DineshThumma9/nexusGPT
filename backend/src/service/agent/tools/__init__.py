from typing import Any
from langchain_core.language_models import BaseChatModel
from langchain_neo4j import Neo4jGraph

from src.service.agent.tools.generic import GenericTools
from src.service.agent.tools.document import DocumentTools
from src.service.agent.tools.code import CodeTools
from src.service.agent.tools.mcp import MCPTools

from typing import Literal


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

        self.mcp_tools = None
        self.code_tools = None
        self.doc_tools = None
        self.general_tools = None
        self.tools = []

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
        kb_type: Literal["GITHUB", "DOCUMENT"] | str | None = None,
    ) -> "Tools":
        instance = cls(user_id, vector_db, neo4j_ns, graph_obj, async_neo4j, llm)

        instance.general_tools = await GenericTools.build(user_id, llm)
        instance.tools.extend(instance.general_tools.tools)

        if mcp_enabled:
            instance.mcp_tools = await MCPTools.build(user_id, mcp_enabled)
            instance.tools.extend(instance.mcp_tools.tools)

        if kb_type:
            if kb_type.upper() == "GITHUB" and neo4j_ns:
                instance.code_tools = await CodeTools.build(
                    user_id, vector_db, neo4j_ns, graph_obj, async_neo4j, llm
                )
                instance.tools.extend(instance.code_tools.tools)
            elif kb_type.upper() == "DOCUMENT" and vector_db:
                instance.doc_tools = await DocumentTools.build(user_id, vector_db, llm)
                instance.tools.extend(instance.doc_tools.tools)

        return instance