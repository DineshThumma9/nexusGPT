import asyncio
import hashlib

import bcrypt
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from src.config.settings import settings
from src.db.dbs import get_db
from src.models.models import User
from src.models.schema import Token, UserPayload
from src.service.auth_service import (
    create_tokens,
    get_current_user,
    _get_user_by_username
)
from src.db.redis_client import aredis
router = APIRouter()


@router.post("/register", response_model=Token)
async def register(user: UserPayload, db: AsyncSession = Depends(get_db)):

    result = await db.execute(select(User).where(User.email == user.email))
    existing_user = result.scalars().first()
    if existing_user:
        return JSONResponse(
            content={"detail": "Email already registered"}, status_code=400
        )

    hash_password = hashlib.sha256(user.password.encode()).hexdigest()
    salt = bcrypt.gensalt(rounds=10)

    hashed_password = (await asyncio.to_thread(bcrypt.hashpw, hash_password.encode("utf-8"), salt)).decode("utf-8")

    new_user = User(username=user.username, email=user.email, hpassword=hashed_password)

    try:
        db.add(new_user)
        await db.commit()
        return await create_tokens({"sub": user.email}, db)
    except Exception as e:
        await db.rollback()
        logger.exception("User registration failed")
        return JSONResponse(
            content={"detail": f"Registration failed: {str(e)}"}, status_code=500
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):

    user = await _get_user_by_username(form_data.username,db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")


    hash_password = hashlib.sha256(form_data.password.encode("utf-8")).hexdigest()
    pass_valid = await asyncio.to_thread(
        bcrypt.checkpw, hash_password.encode("utf-8"), user.hpassword.encode("utf-8")
    )

    if not pass_valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return await create_tokens({"sub": user.email}, db)


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh: str = Form(...), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(
            refresh, settings.secret_key, algorithms=[settings.algorithm]
        )
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        cached_email = await aredis.get(f"refresh:{refresh}")
        if not cached_email:
            raise HTTPException(status_code=401, detail="Refresh token not found or expired")
        
        # Delete the old refresh token to rotate it
        await aredis.delete(f"refresh:{refresh}")

        return await create_tokens({"sub": email}, db)
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")




oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login",auto_error=False)

@router.post("/logout")
async def logout(
    current_user:User = Depends(get_current_user),
    token:str = Depends(oauth2_scheme)
):

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            import datetime
            ttl = exp - int(datetime.datetime.utcnow().timestamp())
            if ttl > 0:
                await aredis.setex(f"revoked:{jti}",ttl,"1")
    except Exception:
        pass

    return JSONResponse(content={"detail":"Logged out successfully"}, status_code=200)
    
@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": str(current_user.userid),
        "username": current_user.username,
        "email": current_user.email,
    }
