from fastapi import HTTPException
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.dbs import get_checkpointer
from src.db.graphdb import get_async_graph, get_graph
from src.db.vectordb import get_user_vector_db
from src.models.models import KnowledgeBase, Session, User, UserLLMConfig
from src.service.agent.middleware import middleware_setup
from src.service.agent.prompts import system_prompt
from src.service.agent.tools import Tools
from src.service.auth_service import AuthService
from src.service.background.tasks import session_title_gen


class AgentService:
    def __init__(self, db: AsyncSession, user: User, session_id: str):
        self.db = db
        self.user = user
        self.session_id = session_id
        self.auth = AuthService(db)

    async def get_llm_instance(self):

        result = await self.db.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == self.user.userid)
        )
        config = result.scalars().first()

        logger.info(config)

        if not config:
            raise HTTPException(status_code=404, detail="Config is'nt Setup")

        logger.info(f"Config: {config.model} Provider: {config.provider}")

        decrypted_key = await self.auth.get_api_key(config.provider, self.user)

        logger.info(
            f"Model: {config.model} Provider: {config.provider} using key: {decrypted_key[:4]}..."
        )

        if config.provider == "huggingface":
            hf_llm = HuggingFaceEndpoint(
                repo_id=config.model,
                huggingfacehub_api_token=decrypted_key,
                task="text-generation",
                max_new_tokens=5162,
            )
            return ChatHuggingFace(llm=hf_llm, trust_remote_code=True)

        return init_chat_model(
            model=config.model,
            model_provider=config.provider,
            api_key=decrypted_key,
            max_tokens=5162,
        )

    async def get_session_kb_context(self):

        result = await self.db.execute(
            select(Session).where(Session.session_id == self.session_id)
        )
        session = result.scalars().first()

        if not session:
            raise HTTPException(status_code=404, detail="Session Not Found")
        if str(session.user_id) != str(self.user.userid):
            raise HTTPException(status_code=403, detail="Forbidden")

        kb, source_type, ns = None, None, None

        if session.kb_id:
            result = await self.db.execute(
                select(KnowledgeBase).where(KnowledgeBase.kb_id == session.kb_id)
            )
            kb = result.scalars().first()

            if kb:
                kb_status = kb.status.value
                if kb_status.lower() != "ready":
                    msg = f"KB {kb.kb_id} is not ready (current status: {kb_status}). "
                    if kb_status.lower() in ["failed", "stale"]:
                        msg += "Please re-submit the repository."
                    else:
                        msg += "Please wait for ingestion to complete."
                    raise HTTPException(status_code=400, detail=msg)
                ns = str(session.kb_id)
                source_type = kb.source_type.value if kb.source_type else None

        return session, kb, source_type, ns

    async def build(self, msg: str, mcp_enabled: bool = True):

        session, kb, source_type, ns = await self.get_session_kb_context()

        if session.title == "New Chat":
            session_title_gen.delay(msg, str(self.session_id), str(self.user.userid))

        vector_db = None
        graph_obj_instance = None

        if ns:
            vector_db = get_user_vector_db(ns, source_type)
            graph_obj_instance = get_graph()

        llm = await self.get_llm_instance()
        tools_instance = await Tools.build(
            user_id=self.user.userid,
            vector_db=vector_db,
            neo4j_ns=ns,
            graph_obj=graph_obj_instance,
            async_neo4j=get_async_graph(),
            llm=llm,
            mcp_enabled=mcp_enabled,
        )
        tools = tools_instance.tools

        agent_prompt = system_prompt

        if kb and source_type:
            agent_prompt += (
                f"\n\nActive Knowledge Base Context:\n"
                f"- Type: {source_type.upper()}\n"
                f"- Reference: {kb.source_ref}\n\n"
                f"Use the relevant tools at your disposal to interact with this specific knowledge base."
            )

        return create_agent(
            model=llm,
            tools=tools,
            checkpointer=get_checkpointer(),
            system_prompt=agent_prompt,
            middleware=middleware_setup(),
        )
