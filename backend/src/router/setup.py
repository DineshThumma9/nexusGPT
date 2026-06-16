import json
from typing import Dict, List, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.redisdb import aredis as redis

from ..db import get_db
from ..models.models import APIKEYS, User, UserLLMConfig, UserMCPConfig
from ..models.schema import API_KEY_REQUEST, API_KEY_RESPONSE, MCPModel
from ..service.auth_service import AuthService, get_current_user
from ..service.constants import _VALIDATION_URLS, VALID_PROVIDERS
from ..service.crypto import CyrptoService

load_dotenv()
router = APIRouter()
crypto = CyrptoService()

# Global httpx client with connection pooling
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """Get or create a shared httpx async client with connection pooling."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            timeout=5.0,  # 5 second timeout (was 8)
        )
    return _http_client


async def close_http_client():
    """Close the shared httpx client (call on app shutdown)."""
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None


async def _validate_api_key(provider: str, api_key: str) -> Tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    url = _VALIDATION_URLS.get(provider)
    if not url:
        return True, ""  # Unknown provider — don't block

    client = get_http_client()
    try:
        if provider == "google_genai":
            r = await client.get(f"{url}?key={api_key}")
        elif provider == "anthropic":
            r = await client.get(
                url,
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            )
        else:
            r = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
    except httpx.TimeoutException:
        logger.warning(f"Key validation timeout for {provider} (5s)")
        return True, ""  # Timeout — don't block, assume valid
    except Exception as e:
        logger.warning(f"Key validation network error for {provider}: {e}")
        return True, ""  # Network issue — don't block saving

    if r.status_code in (401, 403):
        return False, f"API key rejected by {provider} (HTTP {r.status_code})"
    return True, ""


@router.post("/init")
async def set_api_provider(
    req: API_KEY_REQUEST,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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

    encrypted_key = crypto.encrypt(api_key)

    existing = await db.execute(
        select(APIKEYS).where(
            APIKEYS.user_id == current_user.userid, APIKEYS.provider == api_provider
        )
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
    body: Dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
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
    stmt = (
        pg_insert(UserLLMConfig)
        .values(
            user_id=user.userid,
            provider=provider,
            model="",
        )
        .on_conflict_do_update(
            index_elements=["user_id"],
            set_={
                "provider": provider,
                "model": "",
            },  # Reset model when switching providers
        )
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": f"Provider set to {provider}"}


@router.post("/models")
async def choose_llm_model(
    request: Request,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    model = body.get("model")
    provider = body.get("provider")
    logger.info(f"model is {model}, provider is {provider}")

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

    # UPSERT: update the single user config row
    stmt = (
        pg_insert(UserLLMConfig)
        .values(
            user_id=user.userid,
            provider=provider,
            model=model,
        )
        .on_conflict_do_update(
            index_elements=["user_id"],
            set_={"provider": provider, "model": model},
        )
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": f"Model set to {model} for {provider}"}


@router.get("/api-config", response_model=List[API_KEY_RESPONSE])
async def api_config(
    db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    api_configs = await db.execute(
        select(APIKEYS).where(APIKEYS.user_id == user.userid)
    )
    api_configs = api_configs.scalars().all()
    return api_configs


@router.get("/api-models")
async def valid_models(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await AuthService(db).get_valid_models(user)


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
                encrypt_key = crypto.encrypt(api_key)

            item.api_key = encrypt_key

            stmt = (
                pg_insert(UserMCPConfig)
                .values(user_id=user.userid, **item.model_dump())
                .on_conflict_do_update(
                    index_elements=["user_id", "server_url"],
                    set_={
                        "type": item.type,
                        "auth_header": item.auth_header,
                        "gallery": item.gallery,
                        "version": item.version,
                        "api_key": encrypt_key,
                        "is_active": item.is_active,
                    },
                )
            )
            await db.execute(stmt)

        except Exception as e:
            logger.error(f"Error parsing mcp config: {e}")
            continue

    await db.commit()

    try:
        await redis.delete(f"mcp_config_client:{user.userid}")
        await redis.delete(f"mcp_config_ui:{user.userid}")
    except Exception as e:
        logger.error(f"Failed to clear Redis cache: {e}")

    return {"message": "MCP Config saved successfully", "status_code": 200}


@router.get("/mcp-config", response_model=List[MCPModel])
async def get_mcp_config(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):

    cache_key = f"mcp_config_ui:{user.userid}"
    try:
        # Use async Redis client for non-blocking I/O
        cached_ui_config = await redis.get(cache_key)
        if cached_ui_config:
            logger.info(f"Cache hit for {cache_key}")
            return json.loads(cached_ui_config)
    except Exception as e:
        logger.warning(f"Redis get error: {e}")
        # Continue to DB if cache fails

    mcp_configs = (
        (
            await db.execute(
                select(UserMCPConfig).where(UserMCPConfig.user_id == user.userid)
            )
        )
        .scalars()
        .all()
    )

    result = []
    for c in mcp_configs:
        decrypted_key = crypto.decrypt(c.api_key) if c.api_key else None
        c.api_key = decrypted_key
        result.append(MCPModel(**c.model_dump()))

    try:
        # Cache with async Redis for non-blocking I/O
        await redis.setex(
            cache_key,
            86400,  # 24 hour TTL
            json.dumps([m.model_dump() for m in result], default=str),
        )
        logger.info(f"Cached MCP config for {cache_key}")
    except Exception as e:
        logger.warning(f"Redis set error: {e}")
        # Continue even if cache write fails

    return result


@router.get("/mcp-tools/count")
async def get_mcp_tools_count(user: User = Depends(get_current_user)):
    from src.service.agent.mcp import MCPService

    mcp_service = MCPService(user.userid)
    count_data = await mcp_service.get_tools_count()
    return count_data


@router.get("/model-context-limit")
async def get_model_context_limit(model: str):
    try:
        from litellm import model_cost

        cost = model_cost.get(model, {})
        max_tokens = cost.get("max_input_tokens") or cost.get("max_tokens")
        if max_tokens:
            return {"model": model, "context_limit": max_tokens}
    except ImportError:
        logger.warning(
            "litellm is not installed, cannot fetch dynamic model context limits."
        )
    except Exception as e:
        logger.warning(f"Failed to fetch context limit for {model}: {e}")

    # Fallback default if not found
    return {"model": model, "context_limit": 128000}
