import datetime
import os

from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from jose.exceptions import JWTError
from loguru import logger
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.db.dbs import get_db
from src.models.models import APIKEYS, RefreshToken, User
from src.models.schema import Token

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM")
ACCESS_TOKEN_EXPIRY_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRY_MIN"))
REFRESH_TOKEN_EXPIRY_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRY_DAYS"))


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


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
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user


async def create_tokens(data: dict, db: AsyncSession):
    now = datetime.datetime.utcnow()

    access_payload = data.copy()
    access_payload["exp"] = now + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRY_MIN)

    refresh_payload = data.copy()
    refresh_payload["exp"] = now + datetime.timedelta(days=REFRESH_TOKEN_EXPIRY_DAYS)

    try:
        access_token = jwt.encode(access_payload, SECRET_KEY, algorithm=ALGORITHM)
        refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm=ALGORITHM)
    except Exception:
        logger.exception("JWT encoding failed")
        return JSONResponse(
            content={"detail": "Token generation failed"}, status_code=500
        )

    email = data.get("sub")
    db_token = RefreshToken(
        email=email,
        token=refresh_token,
        expiry_date=now + datetime.timedelta(days=REFRESH_TOKEN_EXPIRY_DAYS),
    )

    try:
        db.add(db_token)
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.exception(f"Failed to store refresh token in DB {e} {e.__class__}")
        return JSONResponse(content={"detail": "Database error"}, status_code=500)

    tokens = Token(access=access_token, refresh=refresh_token)
    return JSONResponse(content=tokens.model_dump(), status_code=200)


async def get_all_api_keys(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKEYS).where(APIKEYS.user_id == user.userid))
    api_val_keys = result.scalars().all()
    return {entry.provider: entry.encrypted_key for entry in api_val_keys}
