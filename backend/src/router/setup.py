import json
from typing import Dict, List

import requests as _requests
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, HTTPException
from loguru import logger

from src.db import get_db
from src.db.redis_client import redis
from src.models.models import APIKEYS, User, UserLLMConfig, UserMCPConfig
from src.models.schema import API_KEY_REQUEST, MCPModel
from src.router.auth import get_current_user
from src.service.setup_service import (
    VALID_PROVIDERS,
    get_valid_models,
)
from src.service.utils import decrypt, encrypt

load_dotenv()
router = APIRouter()

# ---------------------------------------------------------------------------
# API key validation: cheap test call to each provider's models endpoint
# ---------------------------------------------------------------------------

_VALIDATION_URLS: dict[str, str] = {
    "groq": "https://api.groq.com/openai/v1/models",
    "openai": "https://api.openai.com/v1/models",
    "anthropic": "https://api.anthropic.com/v1/models",
    "mistralai": "https://api.mistral.ai/v1/models",
    "openrouter": "https://openrouter.ai/api/v1/models",
    "google_genai": "https://generativelanguage.googleapis.com/v1beta/models",
    "huggingface": "https://router.huggingface.co/v1/models",
}


def _validate_api_key(provider: str, api_key: str) -> tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    url = _VALIDATION_URLS.get(provider)
    if not url:
        return True, ""  # Unknown provider — don't block

    try:
        if provider == "google_genai":
            r = _requests.get(f"{url}?key={api_key}", timeout=8)
        elif provider == "anthropic":
            r = _requests.get(
                url,
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                timeout=8,
            )
        else:
            r = _requests.get(
                url, headers={"Authorization": f"Bearer {api_key}"}, timeout=8
            )
    except Exception as e:
        logger.warning(f"Key validation network error for {provider}: {e}")
        return True, ""  # Network issue — don't block saving

    if r.status_code in (401, 403):
        return False, f"API key rejected by {provider} (HTTP {r.status_code})"
    return True, ""


@router.post("/init")
def set_api_provider(
    req: API_KEY_REQUEST, current_user=Depends(get_current_user), db=Depends(get_db)
):
    api_provider = req.api_prov.strip().lower().replace(" ", "_")
    api_key = req.api_key.strip()

    logger.info(f"API PROVIDER:{req.api_prov}")

    if api_provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=404, detail="api provider doesnt exists")

    # Validate the key before storing it
    is_valid, err_msg = _validate_api_key(api_provider, api_key)
    if not is_valid:
        logger.warning(f"Invalid API key rejected for {api_provider}: {err_msg}")
        raise HTTPException(
            status_code=422,
            detail={"error_type": "invalid_api_key", "message": err_msg},
        )

    encrypted_key = encrypt(api_key)

    existing = (
        db.query(APIKEYS)
        .filter_by(user_id=current_user.userid, provider=api_provider)
        .first()
    )

    if existing:
        existing.encrypted_key = encrypted_key
    else:
        new_key = APIKEYS(
            user_id=current_user.userid,
            provider=api_provider,
            encrypted_key=encrypted_key,
        )
        db.add(new_key)
        logger.info(f"Added new key for {api_provider}")
    db.commit()
    return {"message": "Successfully key added", "status_code": 200}


@router.post("/providers")
async def choose_llm_provider(
    body: Dict = Body(...), db=Depends(get_db), user=Depends(get_current_user)
):
    provider = body.get("provider")

    logger.info(f"provider is {provider}")
    if not provider:
        raise HTTPException(status_code=400, detail="Provider is required")

    provider = provider.strip().lower()
    if not provider:
        raise HTTPException(status_code=400, detail="Provider cannot be empty")

    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=404, detail="Provider not supported")

    config = db.query(UserLLMConfig).filter_by(user_id=user.userid).first()

    if config:
        config.provider = provider.lower()
    else:
        config = UserLLMConfig(user_id=user.userid, provider=provider, model="")

        db.add(config)
    db.commit()

    return {"message": f"provider choosed success fully {config}"}


@router.post("/models")
async def choose_model(
    body: Dict = Body(...), db=Depends(get_db), user=Depends(get_current_user)
):
    model = body.get("model")

    if not model:
        raise HTTPException(status_code=400, detail="Model is required")

    model = model.strip()
    if not model:
        raise HTTPException(status_code=400, detail="Model cannot be empty")

    config = db.query(UserLLMConfig).filter_by(user_id=user.userid).first()

    if not config:
        raise HTTPException(status_code=404, detail=f"Config not found {config}")

    config.model = model
    db.commit()

    return {"message": f"Model has been set to {model}"}


@router.get("/api-config")
def api_config(db=Depends(get_db), user=Depends(get_current_user)):
    api_configs = db.query(APIKEYS).filter_by(user_id=user.userid).all()

    result = []
    for api_config in api_configs:
        result.append(
            {
                "provider": api_config.provider,
                "encrypted_key": decrypt(api_config.encrypted_key),
            }
        )

    return result


@router.get("/api-models")
def valid_models():

    return get_valid_models()


@router.post("/mcp-config")
def setup_mcp(
    mcp_list: List[MCPModel] = Body(...),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):

    # 1. Extract incoming server URLs
    incoming_urls = [item.server_url for item in mcp_list]

    # 2. Delete any existing servers for this user that are NOT in the incoming list
    if incoming_urls:
        db.query(UserMCPConfig).filter(
            UserMCPConfig.user_id == user.userid,
            UserMCPConfig.server_url.notin_(incoming_urls),
        ).delete(synchronize_session=False)
    else:
        # If the incoming list is totally empty, delete all of them
        db.query(UserMCPConfig).filter(UserMCPConfig.user_id == user.userid).delete(
            synchronize_session=False
        )

    # 3. Insert or update the incoming servers
    for item in mcp_list:
        try:
            api_key = item.api_key

            if not api_key:
                logger.info("No api key for " + item.server_url)
                encrypt_key = None
            else:
                encrypt_key = encrypt(api_key)

            mcp = (
                db.query(UserMCPConfig)
                .filter_by(user_id=user.userid, server_url=item.server_url)
                .first()
            )
            if mcp:
                mcp.type = item.type
                mcp.auth_header = item.auth_header
                mcp.gallery = item.gallery
                mcp.version = item.version
                if encrypt_key:
                    mcp.api_key = encrypt_key
            else:
                mcp = UserMCPConfig(
                    user_id=user.userid,
                    server_url=item.server_url,
                    type=item.type,
                    auth_header=item.auth_header,
                    gallery=item.gallery,
                    version=item.version,
                    api_key=encrypt_key,
                )
                db.add(mcp)
        except Exception as e:
            logger.error(f"Error parsing mcp config: {e}")
            continue

    db.commit()

    try:
        redis.delete(f"mcp_config_client:{user.userid}")
        redis.delete(f"mcp_config_ui:{user.userid}")
    except Exception as e:
        logger.error(f"Failed to clear Redis cache: {e}")

    return {"message": "MCP Config saved successfully", "status_code": 200}


@router.get("/mcp-config")
def get_mcp_config(user: User = Depends(get_current_user), db=Depends(get_db)):

    cache_key = f"mcp_config_ui:{user.userid}"
    try:
        cached_ui_config = redis.get(cache_key)
        if cached_ui_config:
            return json.loads(cached_ui_config)
    except Exception as e:
        logger.error(f"Redis get error: {e}")

    mcp_configs = db.query(UserMCPConfig).filter_by(user_id=user.userid).all()

    result = []
    for c in mcp_configs:
        decrypted_key = decrypt(c.api_key) if c.api_key else None
        result.append(
            {
                "type": c.type,
                "server_url": c.server_url,
                "auth_header": c.auth_header,
                "gallery": c.gallery,
                "version": c.version,
                "api_key": decrypted_key,
            }
        )

    try:
        redis.setex(cache_key, 86400, json.dumps(result))
    except Exception as e:
        logger.error(f"Redis set error: {e}")

    return result
