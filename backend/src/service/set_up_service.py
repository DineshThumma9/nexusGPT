import logging
import os

from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langchain.agents import create_agent

from src.db import get_db
from src.models.models import APIKEYS, UserLLMConfig
from src.service.auth_service import get_current_user
from src.service.tools import middleware_setup


logger = logging.getLogger("set_up_service")
fernet_key = os.getenv("FERNET_KEY", "d3FVcotBFzBnqZ4BE0zlgji_YYZiK5hkDO3EzX9H7fs=")
fernet = Fernet(fernet_key)

api_providers = [
    "GOOGLE GENAI",
    "ANTHROPIC",
    "OPENAI",
    "OLLAMA",
    "MISTRAL",
    "OPENROUTER",
    "GROQ",
    "HUGGING FACE",
]
llm_providers = [
    "google_genai",
    "anthropic",
    "openai",
    "ollama",
    "mistralai",
    "openrouter",
    "huggingface",
    "groq"
]


def encrypt(key: str) -> str:
    return fernet.encrypt(key.encode()).decode()


def decrypt(key: str) -> str:
    return fernet.decrypt(key.encode()).decode()


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
    system_prompt = (
        "You are CentralGPT, a highly capable AI assistant equipped with a variety of tools to search "
        "and retrieve information from the user's knowledge bases, which may include codebases, PDFs, "
        "documents, URLs, or notes.\n\n"
        "Analyze the user's request and the available tools to determine the best course of action. "
        "You have the autonomy to choose whichever tool fits the situation best to explore the knowledge base, "
        "retrieve context, and provide accurate answers. Do not guess information; always rely on your tools first."
    )
    
    if source_ref and source_type:
        system_prompt += (
            f"\n\nActive Knowledge Base Context:\n"
            f"- Type: {source_type.upper()}\n"
            f"- Reference: {source_ref}\n\n"
            f"Use the relevant tools at your disposal to interact with this specific knowledge base."
        )

    return create_agent(
        model=llm,
        tools=tools,
        checkpointer=checkpointer,
        system_prompt=system_prompt,
        middleware=middleware_setup(),
    )


def get_api_key(provider: str, db=Depends(get_db), user=Depends(get_current_user)):
    api_key = (
        db.query(APIKEYS).filter_by(user_id=user.userid, provider=provider).first()
    )
    if not api_key:
        raise HTTPException(status_code=404, detail="API KEY NOT FOUND")
    return decrypt(api_key.encrypted_key)


def get_llm_instance(db=Depends(get_db), user=Depends(get_current_user)):
    config = db.query(UserLLMConfig).filter_by(user_id=user.userid).first()

    logger.info(config)

    if not config:
        raise HTTPException(status_code=404, detail="Config is'nt Setup")

    logger.info(f"Config : {config.model} Provider:{config.provider}")

    if config.provider.lower() == "ollama":
        decrypted_key = "ollama"
    else:
        provider_upper = config.provider.upper()
        provider_normalized = provider_upper.replace("_", " ")
        if "MISTRAL" in provider_normalized:
            provider_normalized = "MISTRAL"
        if "HUGGING" in provider_normalized:
            provider_normalized = "HUGGING FACE"

        api_record = (
            db.query(APIKEYS)
            .filter(
                (APIKEYS.user_id == user.userid)
                & (
                    (APIKEYS.provider == provider_upper)
                    | (APIKEYS.provider == provider_normalized)
                    | (APIKEYS.provider == config.provider)
                )
            )
            .first()
        )

        if not api_record:
            raise HTTPException(status_code=404, detail="API KEY ISNT SET")

        decrypted_key = decrypt(api_record.encrypted_key)

    from langchain.chat_models import init_chat_model

    logger.info(f"Model: {config.model} Provider: {config.provider} API Key: {decrypted_key} `{config.provider}/{config.model}`")
    return init_chat_model(
        model=config.model, model_provider=config.provider, api_key=decrypted_key
    )


from collections import defaultdict
import requests


def get_valid_models():

    links = {
        "mistral": "https://api.mistral.ai/v1/models",
        "openai": "https://api.openai.ai/v1/models",
        "groq": "https://api.groq.com/openai/v1/models",
        "openrouter": "https://openrouter.ai/v1/models",
        "hugging face": "https://router.huggingface.co/v1/models",
    }

    api_keys = {
        "mistral": os.getenv("MISTRAL_API_KEY"),
        "openai": os.getenv("OPENAI_API_KEY"),
        "groq": os.getenv("GROQ_API_KEY"),
        "openrouter": os.getenv("OPENROUTER_API_KEY"),
        "hugging face": os.getenv("HF_TOKEN"),
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
        except:
            logger.info(f"{model} is not available")

    try:
        gemini_model = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={os.getenv('GOOGLE_API_KEY')}",
            headers={"Content-Type": "application/json"},
        )
        if gemini_model.status_code == 200:
            valid_models["gemini"] = [
                model_json["name"] for model_json in gemini_model.json()["models"]
            ]
    except:
        logger.info("Gemini is not available")

    return valid_models
