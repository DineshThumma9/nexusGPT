import hashlib

import bcrypt
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from loguru import logger
from sqlalchemy.orm import Session

from src.db.dbs import get_db
from src.models.models import RefreshToken, User
from src.models.schema import Token, UserPayload
from src.service.auth_service import (
    ALGORITHM,
    SECRET_KEY,
    create_tokens,
    get_current_user,
    pwd_context,
)

router = APIRouter()


@router.post("/register", response_model=Token)
def register(user: UserPayload, db: Session = Depends(get_db)):
    logger.info("Accessing register")
    logger.info(user)
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        return JSONResponse(
            content={"detail": "Email already registered"}, status_code=400
        )

    hash_password = hashlib.sha256(user.password.encode()).hexdigest()
    salt = bcrypt.gensalt()

    # ADDED .decode('utf-8') HERE to store it as a clean string in DB
    hashed_password = bcrypt.hashpw(hash_password.encode("utf-8"), salt).decode("utf-8")

    new_user = User(username=user.username, email=user.email, hpassword=hashed_password)

    try:
        db.add(new_user)
        db.commit()
        return create_tokens({"sub": user.email}, db)
    except Exception as e:
        db.rollback()
        logger.exception("User registration failed")
        return JSONResponse(
            content={"detail": f"Registration failed: {str(e)}"}, status_code=500
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    # This works perfectly now because user.hpassword is saved as a clean string
    user = db.query(User).filter(User.username == form_data.username).first()

    hash_password = hashlib.sha256(form_data.password.encode("utf-8")).hexdigest()

    if not user or not bcrypt.checkpw(
        hash_password.encode("utf-8"), user.hpassword.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return create_tokens({"sub": user.email}, db)


@router.post("/refresh", response_model=Token)
def refresh_token(refresh: str = Form(...), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(refresh, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh).first()
        if not db_token:
            raise HTTPException(status_code=401, detail="Refresh token not found")

        return create_tokens({"sub": email}, db)
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
