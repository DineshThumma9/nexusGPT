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

VALID_PROVIDERS = [
    "google_genai",
    "anthropic",
    "openai",
    "mistralai",
    "openrouter",
    "huggingface",
    "groq",
]


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


def get_api_key(provider: str, db, user):
    api_key = (
        db.query(APIKEYS).filter_by(user_id=user.userid, provider=provider).first()
    )
    if not api_key:
        raise HTTPException(status_code=404, detail=f"API KEY NOT FOUND: {provider}")
    return decrypt(api_key.encrypted_key)


def get_llm_instance(db=Depends(get_db), user=Depends(get_current_user)):
    config = db.query(UserLLMConfig).filter_by(user_id=user.userid).first()

    logger.info(config)

    if not config:
        raise HTTPException(status_code=404, detail="Config is'nt Setup")

    logger.info(f"Config: {config.model} Provider: {config.provider}")

    decrypted_key = get_api_key(config.provider, db=db, user=user)

    logger.info(
        f"Model: {config.model} Provider: {config.provider} API Key: {decrypted_key} `{config.provider}/{config.model}`"
    )

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


def get_valid_models():

    links = {
        "mistralai": "https://api.mistral.ai/v1/models",
        "openai": "https://api.openai.com/v1/models",
        "groq": "https://api.groq.com/openai/v1/models",
        "openrouter": "https://openrouter.ai/api/v1/models",
        "huggingface": "https://router.huggingface.co/v1/models",
    }

    api_keys = {
        "mistralai": os.getenv("MISTRAL_API_KEY"),
        "openai": os.getenv("OPENAI_API_KEY"),
        "groq": os.getenv("GROQ_API_KEY"),
        "openrouter": os.getenv("OPENROUTER_API_KEY"),
        "huggingface": os.getenv("HF_TOKEN"),
    }

    valid_models = defaultdict(list)

    for model, model_url in links.items():
        if api_keys[model] is None:
            continue
        try:
            response = requests.get(
                model_url, headers={"Authorization": f"Bearer {api_keys[model]}"}
            )
            if response.status_code == 200:
                valid_models[model].append(
                    [model_json["id"] for model_json in response.json()["data"]]
                )
        except Exception:
            logger.info(f"{model} is not available")

    try:
        gemini_model = requests.get(
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
    session = db.query(Session).filter_by(session_id=session_id).first()
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
        kb = db.query(KnowledgeBase).filter_by(kb_id=kb_id).first()
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

    llm = get_llm_instance(db=db, user=user)

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
