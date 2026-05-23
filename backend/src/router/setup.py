import logging
from typing import Dict

from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, HTTPException

from src.db import get_db
from src.models.models import APIKEYS, UserLLMConfig
from src.models.schema import API_KEY_REQUEST
from src.router.auth import get_current_user
from src.service.set_up_service import api_providers, encrypt, llm_providers,decrypt

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




from src.service.set_up_service import get_valid_models


@router.get("/api-models")
def valid_models():


    return get_valid_models()

@router.get("/mcp-config")
def get_mcp_config(current_user=Depends(get_current_user)):
    import os
    import json
    
    filepath = "mcp_config.json"
    if not os.path.exists(filepath):
        return {"mcpServers": {}}
    try:
        with open(filepath, "r") as f:
            content = f.read().strip()
            if not content:
                return {"mcpServers": {}}
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {"mcpServers": {}}
    except Exception as e:
        logger.error(f"Error reading mcp_config.json: {e}")
        return {"mcpServers": {}}


@router.post("/mcp-config")
def save_mcp_config(config: Dict = Body(...), current_user=Depends(get_current_user)):
    import json
    
    filepath = "mcp_config.json"
    try:
        with open(filepath, "w") as f:
            json.dump(config, f, indent=2)
        return {"message": "MCP Config saved successfully", "status_code": 200}
    except Exception as e:
        logger.error(f"Error writing mcp_config.json: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save MCP config: {str(e)}")
    
