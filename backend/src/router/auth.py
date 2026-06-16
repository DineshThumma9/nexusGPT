import asyncio
import datetime
import hashlib

import bcrypt
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.redisdb import aredis

from ..config.settings import settings
from ..db.dbs import get_db
from ..models.models import User
from ..models.schema import Token, UserPayload
from ..service.auth_service import AuthService, get_current_user

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


@router.post("/register", response_model=Token)
async def register(
    user: UserPayload,
    auth: AuthService = Depends(get_auth_service),
):
    existing = await auth._get_user_by_email(user.email)
    if existing:
        return JSONResponse(
            content={"detail": "Email already registered"}, status_code=400
        )

    hash_password = hashlib.sha256(user.password.encode()).hexdigest()
    salt = bcrypt.gensalt(rounds=10)
    hashed_password = (
        await asyncio.to_thread(bcrypt.hashpw, hash_password.encode("utf-8"), salt)
    ).decode("utf-8")

    new_user = User(username=user.username, email=user.email, hpassword=hashed_password)
    try:
        auth.db.add(new_user)
        await auth.db.commit()
        # Automatically whitelisted on creation now!
        return await auth.create_tokens(user.email)
    except Exception as e:
        await auth.db.rollback()
        logger.exception("User registration failed")
        return JSONResponse(
            content={"detail": f"Registration failed: {str(e)}"}, status_code=500
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth: AuthService = Depends(get_auth_service),
):
    user = await auth._get_user_by_username(form_data.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    hash_password = hashlib.sha256(form_data.password.encode("utf-8")).hexdigest()
    pass_valid = await asyncio.to_thread(
        bcrypt.checkpw,
        hash_password.encode("utf-8"),
        user.hpassword.encode("utf-8"),
    )
    if not pass_valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return await auth.create_tokens(user.email)


@router.post("/logout")
async def logout(
    refresh: str = Form(...),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    try:
        # 1. Blacklist the access token
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        access_jti = payload.get("jti")
        exp = payload.get("exp")
        now = datetime.datetime.now(datetime.timezone.utc).timestamp()
        ttl = int(exp - now)
        if ttl > 0:
            await aredis.setex(f"blacklist:{access_jti}", ttl, "1")

        # 2. Remove the refresh token from the whitelist
        refresh_payload = jwt.decode(
            refresh, settings.secret_key, algorithms=[settings.algorithm]
        )
        refresh_sub = refresh_payload.get("sub")
        if refresh_sub != current_user.email:
            raise HTTPException(
                status_code=401, detail="Refresh token subject mismatch"
            )
        refresh_jti = refresh_payload.get("jti")
        await aredis.delete(f"whitelist:{current_user.email}:{refresh_jti}")

    except JWTError:  # Fixed: Catches python-jose library native error type
        logger.warning("Malformed or un-decodable token parsed during logout")
        raise HTTPException(status_code=400, detail="Malformed token context")
    except Exception:
        logger.exception("Logout cache mutation failure")
        raise HTTPException(status_code=500, detail="Internal session tear-down failed")

    return JSONResponse(content={"detail": "Logged out successfully"}, status_code=200)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh: str = Form(...),
    auth: AuthService = Depends(get_auth_service),
):
    try:
        payload = jwt.decode(
            refresh, settings.secret_key, algorithms=[settings.algorithm]
        )
        email = payload.get("sub")
        jti = payload.get("jti")
        if not email or not jti:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    redis_key = f"whitelist:{email}:{jti}"
    is_whitelisted = await aredis.get(redis_key)

    if not is_whitelisted:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    await aredis.delete(redis_key)

    new_token = await auth.create_tokens(email)

    return new_token


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": str(current_user.userid),
        "username": current_user.username,
        "email": current_user.email,
    }
