import datetime
import os
import uuid
from collections import defaultdict
from typing import Dict, List

import httpx
from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from jose.exceptions import JWTError
from loguru import logger
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.config.settings import settings
from src.db.dbs import get_db
from src.db.redisdb import aredis
from src.models.models import APIKEYS, User
from src.models.schema import Token
from src.service.constants import _VALIDATION_URLS
from src.service.crypto import CyrptoService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

_USER_CACHE_TTL = 300


class AuthService:
    """Handles authentication, token lifecycle, and API key management."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.crypto = CyrptoService()

    async def _get_user_by_email(self, email: str) -> User | None:
        cache_key = f"user:email:{email}"
        try:
            cached = await aredis.get(cache_key)
            if cached:
                return User.model_validate_json(cached)
        except Exception:
            pass

        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if user:
            try:
                await aredis.setex(cache_key, _USER_CACHE_TTL, user.model_dump_json())
            except Exception:
                pass
        return user

    async def _get_user_by_username(self, username: str) -> User | None:
        cache_key = f"user:username:{username}"
        try:
            cached = await aredis.get(cache_key)
            if cached:
                return User.model_validate_json(cached)
        except Exception:
            pass

        result = await self.db.execute(select(User).where(User.username == username))
        user = result.scalars().first()
        if user:
            try:
                await aredis.setex(cache_key, _USER_CACHE_TTL, user.model_dump_json())
            except Exception:
                pass
        return user

    async def get_current_user(self, token: str | None) -> User:
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        if not token:
            raise credentials_exception

        try:
            payload = jwt.decode(
                token, settings.secret_key, algorithms=[settings.algorithm]
            )
            email: str = payload.get("sub")
            if email is None:
                raise credentials_exception
        except JWTError:
            raise credentials_exception

        jti = payload.get("jti")
        if jti:
            try:
                revoked = await aredis.get(f"revoked:{jti}")
                if revoked:
                    raise credentials_exception
            except HTTPException:
                raise
            except Exception:
                pass

        user = await self._get_user_by_email(email)
        if user is None:
            raise credentials_exception
        return user

    async def create_tokens(self, data: dict):
        now = datetime.datetime.utcnow()
        email = data.get("sub")

        access_payload = {
            **data,
            "exp": now + datetime.timedelta(minutes=settings.access_token_expiry_min),
            "jti": uuid.uuid4().hex,
        }
        refresh_payload = {
            **data,
            "exp": now + datetime.timedelta(days=settings.refresh_token_expiry_days),
            "jti": uuid.uuid4().hex,
        }

        try:
            access_token = jwt.encode(
                access_payload, settings.secret_key, algorithm=settings.algorithm
            )
            refresh_token = jwt.encode(
                refresh_payload, settings.secret_key, algorithm=settings.algorithm
            )
        except Exception:
            logger.exception("JWT encoding failed")
            return JSONResponse(
                content={"detail": "Token generation failed"}, status_code=500
            )

        try:
            await aredis.setex(
                f"refresh:{refresh_token}",
                int(
                    datetime.timedelta(
                        days=settings.refresh_token_expiry_days
                    ).total_seconds()
                ),
                email,
            )
        except Exception:
            logger.exception("Redis setex failed")
            return JSONResponse(
                content={"detail": "Token generation failed"}, status_code=500
            )

        return JSONResponse(
            content=Token(access=access_token, refresh=refresh_token).model_dump(),
            status_code=200,
        )

    async def get_api_key(self, provider: str, user: User) -> str:
        result = await self.db.execute(
            select(APIKEYS).where(
                APIKEYS.user_id == user.userid,
                APIKEYS.provider == provider,
            )
        )
        api_key = result.scalars().first()
        if not api_key:
            raise HTTPException(
                status_code=404, detail=f"API KEY NOT FOUND: {provider}"
            )
        return self.crypto.decrypt(api_key.encrypted_key)

    async def get_all_api_keys(self, user: User) -> Dict[str, str]:
        result = await self.db.execute(
            select(APIKEYS).where(APIKEYS.user_id == user.userid)
        )
        return {
            entry.provider: self.crypto.decrypt(entry.encrypted_key)
            for entry in result.scalars().all()
        }

    async def get_valid_models(self, user: User) -> Dict[str, List[str]]:
        """Probe each provider's API with the user's stored key and return available models."""
        api_keys = await self.get_all_api_keys(user)
        valid_models: Dict[str, List[str]] = defaultdict(list)

        async with httpx.AsyncClient(timeout=8.0) as client:
            for provider, url in _VALIDATION_URLS.items():
                key = api_keys.get(provider)
                if not key:
                    continue
                try:
                    resp = await client.get(
                        url, headers={"Authorization": f"Bearer {key}"}
                    )
                    if resp.status_code == 200:
                        valid_models[provider] = [
                            m["id"] for m in resp.json().get("data", [])
                        ]
                except Exception as e:
                    logger.info(f"{provider} validation failed: {e}")

            # Gemini uses a query-param key, not a Bearer header
            google_key = api_keys.get("google_genai") or os.getenv("GOOGLE_API_KEY")
            if google_key:
                try:
                    resp = await client.get(
                        f"https://generativelanguage.googleapis.com/v1beta/models"
                        f"?key={google_key}",
                        headers={"Content-Type": "application/json"},
                    )
                    if resp.status_code == 200:
                        valid_models["google_genai"] = [
                            m["name"].split("/")[-1]
                            for m in resp.json().get("models", [])
                            if "generateContent"
                            in m.get("supportedGenerationMethods", [])
                        ]
                except Exception as e:
                    logger.info(f"google_genai validation failed: {e}")

        return dict(valid_models)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await AuthService(db).get_current_user(token)
