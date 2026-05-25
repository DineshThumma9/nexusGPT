import logging
from typing import Dict

from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, HTTPException

from src.db import get_db
from src.models.models import APIKEYS, User, UserLLMConfig, UserMCPConfig
from src.models.schema import API_KEY_REQUEST, MCPModel
from src.router.auth import get_current_user
from src.service.set_up_service import (
    api_providers,
    decrypt,
    encrypt,
    get_valid_models,
    llm_providers,
)

logger = logging.getLogger("basic_router")
load_dotenv()
router = APIRouter()


@router.post("/init")
def set_api_provider(
    req: API_KEY_REQUEST, current_user=Depends(get_current_user), db=Depends(get_db)
):
    api_provider = req.api_prov.upper().strip()
    api_key = req.api_key.strip()

    logger.info(f"API PROVIDER:{req.api_prov}")
    print(f"API PROVIDER:{req.api_prov}")
    logger.info(f"API KEY:{req.api_key}")
    print(f"API KEY:{req.api_key}")

    if api_provider not in api_providers:
        raise HTTPException(status_code=404, detail="api provider doesnt exists")

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
        logger.info(f"Added new key  {new_key}")
    db.commit()
    return {"message": "Succesfully key added", "status_code": 200}


@router.post("/providers")
async def choose_llm_provider(
    body: Dict = Body(...), db=Depends(get_db), user=Depends(get_current_user)
):
    provider = body.get("provider")

    logger.info(f"provider is {provider}")
    if not provider:
        raise HTTPException(status_code=400, detail="Provider is required")

    provider = provider.strip()
    if not provider:
        raise HTTPException(status_code=400, detail="Provider cannot be empty")

    if provider.lower() not in llm_providers:
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


#


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


# @router.get("/mcp-config")
# def get_mcp_config(current_user=Depends(get_current_user)):
#     import os
#     import json

#     filepath = "mcp_config.json"
#     if not os.path.exists(filepath):
#         return {"mcpServers": {}}
#     try:
#         with open(filepath, "r") as f:
#             content = f.read().strip()
#             if not content:
#                 return {"mcpServers": {}}
#             try:
#                 return json.loads(content)
#             except json.JSONDecodeError:
#                 return {"mcpServers": {}}
#     except Exception as e:
#         logger.error(f"Error reading mcp_config.json: {e}")
#         return {"mcpServers": {}}


# @router.post("/mcp-config")
# def save_mcp_config(config: Dict = Body(...), current_user=Depends(get_current_user)):
#     import json

#     filepath = "mcp_config.json"
#     try:
#         with open(filepath, "w") as f:
#             json.dump(config, f, indent=2)
#         return {"message": "MCP Config saved successfully", "status_code": 200}
#     except Exception as e:
#         logger.error(f"Error writing mcp_config.json: {e}")
#         raise HTTPException(status_code=500, detail=f"Failed to save MCP config: {str(e)}")


from typing import List

from src.models.schema import MCPModel


@router.post("/mcp-config")
def setup_mcp(
    mcp_list: List[MCPModel] = Body(...),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    from src.service.set_up_service import encrypt

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

    # Invalidate Redis caches using the synchronous client since this is a sync route
    from src.db.redis_client import redis

    try:
        redis.delete(f"mcp_config_client:{user.userid}")
        redis.delete(f"mcp_config_ui:{user.userid}")
    except Exception as e:
        logger.error(f"Failed to clear Redis cache: {e}")

    return {"message": "MCP Config saved successfully", "status_code": 200}


@router.get("/mcp-config")
def get_mcp_config(user: User = Depends(get_current_user), db=Depends(get_db)):
    import json

    from src.db.redis_client import redis
    from src.service.set_up_service import decrypt

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
