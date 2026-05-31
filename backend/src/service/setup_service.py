import os
from collections import defaultdict

import requests
from fastapi import Depends, HTTPException
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool, ToolException
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langgraph.checkpoint.base import BaseCheckpointSaver
from loguru import logger

from src.db import get_db
from src.db.dbs import get_checkpointer
from src.db.neo4j import get_graph
from src.db.qdrant_client import get_user_vector_db
from src.models.models import APIKEYS, KnowledgeBase, Session, UserLLMConfig
from src.service.auth_service import get_current_user
from src.service.middleware import middleware_setup
from src.service.prompts import system_prompt
from src.service.tasks import session_title_gen
from src.service.tools import make_tools
from src.service.utils import decrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.models import User
from typing import Dict, List
from src.service.constansts import links,api_keys,VALID_PROVIDERS
import httpx



def build_agent(
    llm: BaseChatModel,
    tools: list[BaseTool],
    checkpointer: BaseCheckpointSaver,
    source_type: str | None = None,
    source_ref: str | None = None,
):
    """
    Compiles a fresh LangGraph ReAct agent.
    Called once per request — compilation is fast (microseconds).
    Tools are correct per-user-per-kb, so we never cache them globally.
    The checkpointer (singleton) carries conversation memory across turns.
    """

    agent_prompt = system_prompt
    if source_ref and source_type:
        agent_prompt += (
            f"\n\nActive Knowledge Base Context:\n"
            f"- Type: {source_type.upper()}\n"
            f"- Reference: {source_ref}\n\n"
            f"Use the relevant tools at your disposal to interact with this specific knowledge base."
        )

    return create_agent(
        model=llm,
        tools=tools,
        checkpointer=checkpointer,
        system_prompt=agent_prompt,
        middleware=middleware_setup(),
    )


async def get_api_key(provider: str, db:AsyncSession, user:User) -> str:
    result = await db.execute(
        select(APIKEYS).where(APIKEYS.user_id == user.userid, APIKEYS.provider == provider)
    )
    api_key = result.scalars().first()
    if not api_key:
        raise HTTPException(status_code=404, detail=f"API KEY NOT FOUND: {provider}")
    return decrypt(api_key.encrypted_key)


async def get_llm_instance(db:AsyncSession, user:User):
    result = await db.execute(select(UserLLMConfig).where(UserLLMConfig.user_id == user.userid))
    config = result.scalars().first()

    logger.info(config)

    if not config:
        raise HTTPException(status_code=404, detail="Config is'nt Setup")

    logger.info(f"Config: {config.model} Provider: {config.provider}")

    decrypted_key = await get_api_key(config.provider, db=db, user=user)

    logger.info(f"Model: {config.model} Provider: {config.provider} using key: {decrypted_key[:4]}...")

    if config.provider == "huggingface":
        # Force the Inference API instead of local pipeline
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


async def get_valid_models() -> Dict[str,List[str]]:

    valid_models = defaultdict(list)
    client = httpx.AsyncClient()

    for model, model_url in links.items():
        if api_keys[model] is None:
            continue
        try:
            response = await client.get(
                model_url, headers={"Authorization": f"Bearer {api_keys[model]}"}
            )
            if response.status_code == 200:
                valid_models[model].append(
                    [model_json["id"] for model_json in response.json()["data"]]
                )
        except Exception:
            logger.info(f"{model} is not available")

    try:
        gemini_model = await client.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={os.getenv('GOOGLE_API_KEY')}",
            headers={"Content-Type": "application/json"},
        )
        if gemini_model.status_code == 200:
            valid_models["google_genai"] = [
                model_json["name"] for model_json in gemini_model.json()["models"]
            ]
    except Exception:
        logger.info("Gemini is not available")

    return valid_models


async def setup_agent_for_session(db, session_id: str, user, msg: str):
    result = await db.execute(select(Session).where(Session.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if str(session.user_id) != str(user.userid):
        raise HTTPException(status_code=403, detail="Forbidden")

    kb_id: str | None = session.kb_id
    source_type = None

    vector_db = None
    ns = None
    graph_obj_instance = None

    try:
        if session.title == "New Chat":
            session_title_gen.delay(msg, str(session_id), str(user.userid))
    except Exception:
        logger.info("Failed to generate session title")

    kb = None
    if kb_id is not None:
        result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.kb_id == kb_id))
        kb = result.scalars().first()

        if kb:
            kb_status = (
                kb.status.value if hasattr(kb.status, "value") else str(kb.status)
            )
            if kb_status.lower() != "ready":
                raise HTTPException(
                    status_code=400,
                    detail=f"Knowledge Base is currently {kb_status.lower()}. Please wait until processing is complete.",
                )

            source_type = (
                kb.source_type.value
                if hasattr(kb.source_type, "value")
                else str(kb.source_type)
            )
        ns = str(kb_id)
        vector_db = get_user_vector_db(ns, source_type=source_type)
        graph_obj_instance = get_graph()

    llm = await get_llm_instance(db=db, user=user)

    tools = await make_tools(
        user_id=user.userid,
        vector_db=vector_db,
        neo4j_ns=ns,
        graph_obj=graph_obj_instance,
        llm=llm,
    )

    checkpointer = get_checkpointer()
    agent = build_agent(
        llm=llm,
        tools=tools,
        checkpointer=checkpointer,
        source_type=source_type if kb_id else None,
        source_ref=kb.source_ref if (kb_id and kb) else None,
    )
    return agent
