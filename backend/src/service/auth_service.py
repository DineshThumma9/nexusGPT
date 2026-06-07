import datetime
import uuid

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
from src.models.models import APIKEYS, User
from src.models.schema import Token
from src.db.redis_client import aredis


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)



_USER_CACHE_TTL = 300


async def _get_user_by_email(email:str,db:AsyncSession) -> User | None:

    cache_key = f"user:email:{email}"

    try:
        cached = await aredis.get(cache_key)
        if cached:
            return User.model_validate_json(cached)
    except Exception:
        pass

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user:
        try:
            await aredis.setex(
                cache_key,
                _USER_CACHE_TTL,
                user.model_dump_json(),
            )
        except Exception:
            pass
    return user



async def _get_user_by_username(username:str,db:AsyncSession) -> User | None:

    cache_key = f"user:username:{username}"

    try:
        cached = await aredis.get(cache_key)
        if cached:
            return User.model_validate_json(cached)
    except Exception:
        pass

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if user:
        try:
            await aredis.setex(
                cache_key,
                _USER_CACHE_TTL,
                user.model_dump_json(),
            )
        except Exception:
            pass
    return user


async def get_current_user(
    token: str | None = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
):
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
            pass
        except Exception:
            pass
    


    user = await _get_user_by_email(email,db)
    if user is None:
        raise credentials_exception
    return user


async def create_tokens(data: dict, db: AsyncSession):
    now = datetime.datetime.utcnow()
    email = data.get("sub")

    access_payload = data.copy()
    access_payload["exp"] = now + datetime.timedelta(
        minutes=settings.access_token_expiry_min
    )
    access_payload["jti"] = uuid.uuid4().hex

    refresh_payload = data.copy()
    refresh_payload["exp"] = now + datetime.timedelta(
        days=settings.refresh_token_expiry_days
    )
    refresh_payload["jti"] = uuid.uuid4().hex

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
            int(datetime.timedelta(days=settings.refresh_token_expiry_days).total_seconds()),
            email,
            
        )
    except Exception:
        logger.exception("Redis setex failed")
        return JSONResponse(content={"detail": "Token generation failed"}, status_code=500)
    

    tokens = Token(access=access_token, refresh=refresh_token)

    return JSONResponse(content=tokens.model_dump(), status_code=200)


async def get_all_api_keys(
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(APIKEYS).where(APIKEYS.user_id == user.userid))
    api_val_keys = result.scalars().all()
    return {entry.provider: entry.encrypted_key for entry in api_val_keys}
