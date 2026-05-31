import json
from typing import Dict, List,Tuple


import requests as _requests
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, HTTPException
from loguru import logger

from src.db import get_db
from src.db.redis_client import sredis as redis
from src.models.models import APIKEYS, User, UserLLMConfig, UserMCPConfig
from src.models.schema import API_KEY_REQUEST, MCPModel,API_KEY_RESPONSE
from src.router.auth import get_current_user
from src.service.setup_service import (
    VALID_PROVIDERS,
    get_valid_models,
)
from src.service.utils import decrypt, encrypt
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from src.service.constansts import _VALIDATION_URLS
import httpx


load_dotenv()
router = APIRouter()

# ---------------------------------------------------------------------------
# API key validation: cheap test call to each provider's models endpoint
# ---------------------------------------------------------------------------



async def _validate_api_key(provider: str, api_key: str) ->  Tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    url = _VALIDATION_URLS.get(provider)
    if not url:
        return True, ""  # Unknown provider — don't block
    
    client = httpx.AsyncClient()
    try:
        if provider == "google_genai":
            r = await client.get(f"{url}?key={api_key}", timeout=8)
        elif provider == "anthropic":
            r = await client.get(
                url,
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                timeout=8,
            )
        else:
            r = await client.get(
                    url, headers={"Authorization": f"Bearer {api_key}"}, timeout=8
                )
    except Exception as e:
        logger.warning(f"Key validation network error for {provider}: {e}")
        return True, ""  # Network issue — don't block saving

    if r.status_code in (401, 403):
        return False, f"API key rejected by {provider} (HTTP {r.status_code})"
    return True, ""


@router.post("/init")
async def set_api_provider(
    req: API_KEY_REQUEST, current_user=Depends(get_current_user), db:AsyncSession=Depends(get_db)
):
    api_provider = req.api_provider.strip().lower().replace(" ", "_")
    api_key = req.api_key.strip()


    if api_provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=404, detail="api provider doesnt exists")

    is_valid, err_msg = await _validate_api_key(api_provider, api_key)
    if not is_valid:
        logger.warning(f"Invalid API key rejected for {api_provider}: {err_msg}")
        raise HTTPException(
            status_code=422,
            detail={"error_type": "invalid_api_key", "message": err_msg},
        )

    encrypted_key = encrypt(api_key)

    existing = await db.execute(
        select(APIKEYS)
        .where(APIKEYS.user_id == current_user.userid, APIKEYS.provider == api_provider)
    )

    existing = existing.scalars().first()

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
    await db.commit()
    return {"message": "Successfully key added", "status_code": 200}


@router.post("/providers")
async def choose_llm_provider(
    body: Dict = Body(...), db:AsyncSession =Depends(get_db), user=Depends(get_current_user)
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

    # PostgreSQL UPSERT — atomic, handles both insert and update correctly.
    # The old SELECT+mutate approach broke when config.provider (part of PK) was changed:
    # SQLAlchemy emitted DELETE+INSERT, failing if the target row already existed.
    stmt = pg_insert(UserLLMConfig).values(
        user_id=user.userid,
        provider=provider,
        model="",
    ).on_conflict_do_update(
        index_elements=["user_id", "provider"],
        set_={"model": UserLLMConfig.__table__.c.model},  # preserve existing model
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": f"Provider set to {provider}"}


@router.post("/models")
async def choose_model(
    body: Dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    model = body.get("model")
    provider = body.get("provider")

    if not model:
        raise HTTPException(status_code=400, detail="Model is required")
    if not provider:
        raise HTTPException(status_code=400, detail="Provider is required")

    model = model.strip()
    provider = provider.strip().lower()

    if not model:
        raise HTTPException(status_code=400, detail="Model cannot be empty")
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=404, detail="Provider not supported")

    # UPSERT: create the config row if it doesn't exist, otherwise update model
    stmt = pg_insert(UserLLMConfig).values(
        user_id=user.userid,
        provider=provider,
        model=model,
    ).on_conflict_do_update(
        index_elements=["user_id", "provider"],
        set_={"model": model},
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": f"Model set to {model} for {provider}"}




@router.get("/api-config",response_model=List[API_KEY_RESPONSE])
async def api_config(db:AsyncSession=Depends(get_db), user=Depends(get_current_user)):
    api_configs = await db.execute(select(APIKEYS).where(APIKEYS.user_id == user.userid))
    api_configs = api_configs.scalars().all()
    return api_configs



@router.get("/api-models")
async def valid_models():
    return await get_valid_models()


@router.post("/mcp-config")
async def setup_mcp(
    mcp_list: List[MCPModel] = Body(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    # 1. Extract incoming server URLs
    incoming_urls = [item.server_url for item in mcp_list]

    # 2. Delete any existing servers for this user that are NOT in the incoming list
    if incoming_urls:
        stmt = delete(UserMCPConfig).where(
            UserMCPConfig.user_id == user.userid,
            UserMCPConfig.server_url.notin_(incoming_urls),
        )
        await db.execute(stmt)
    else:
        # If the incoming list is totally empty, delete all of them
        stmt = delete(UserMCPConfig).where(UserMCPConfig.user_id == user.userid)
        await db.execute(stmt)

    # 3. Insert or update the incoming servers
    for item in mcp_list:
        try:
            api_key = item.api_key

            if not api_key:
                logger.info("No api key for " + item.server_url)
                encrypt_key = None
            else:
                encrypt_key = encrypt(api_key)

            mcp = await db.execute(
                select(UserMCPConfig)
                .where(UserMCPConfig.user_id == user.userid, UserMCPConfig.server_url == item.server_url)
            )

            mcp = mcp.scalars().first()
            if mcp:
                await db.execute(
                    delete(UserMCPConfig)
                    .where(UserMCPConfig.user_id == user.userid, UserMCPConfig.server_url == item.server_url)
                )
            mcp = UserMCPConfig(
                    **item.model_dump(),api_key = encrypt_key
                )
            db.add(mcp)

            
        except Exception as e:
            logger.error(f"Error parsing mcp config: {e}")
            continue

    await db.commit()

    try:
        redis.delete(f"mcp_config_client:{user.userid}")
        redis.delete(f"mcp_config_ui:{user.userid}")
    except Exception as e:
        logger.error(f"Failed to clear Redis cache: {e}")

    return {"message": "MCP Config saved successfully", "status_code": 200}


@router.get("/mcp-config",response_model=List[MCPModel])
async def get_mcp_config(user: User = Depends(get_current_user), db:AsyncSession=Depends(get_db)):

    cache_key = f"mcp_config_ui:{user.userid}"
    try:
        cached_ui_config = redis.get(cache_key)
        if cached_ui_config:
            return json.loads(cached_ui_config)
    except Exception as e:
        logger.error(f"Redis get error: {e}")

    mcp_configs = (await db.execute(select(UserMCPConfig).where(UserMCPConfig.user_id == user.userid))).scalars().all()

    result = []
    for c in mcp_configs:
        decrypted_key = decrypt(c.api_key) if c.api_key else None
        result.append(MCPModel(**c.model_dump(),api_key=decrypted_key))

    try:
        redis.setex(cache_key, 86400, json.dumps(result))
    except Exception as e:
        logger.error(f"Redis set error: {e}")

    return result
