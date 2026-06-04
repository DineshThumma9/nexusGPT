import asyncio
import hashlib

import bcrypt
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.config.settings import settings
from src.db.dbs import get_db
from src.models.models import RefreshToken, User
from src.models.schema import Token, UserPayload
from src.service.auth_service import (
    create_tokens,
    get_current_user,
)

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
    salt = bcrypt.gensalt()

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
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()

    hash_password = hashlib.sha256(form_data.password.encode("utf-8")).hexdigest()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    password_valid = await asyncio.to_thread(bcrypt.checkpw, hash_password.encode("utf-8"), user.hpassword.encode("utf-8"))
    if not password_valid:
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

        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token == refresh)
        )
        db_token = result.scalars().first()
        if not db_token:
            raise HTTPException(status_code=401, detail="Refresh token not found")

        return await create_tokens({"sub": email}, db)
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": str(current_user.userid),
        "username": current_user.username,
        "email": current_user.email,
    }
