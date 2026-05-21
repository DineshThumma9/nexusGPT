import datetime
from uuid import UUID

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlmodel import Session as DBSession
from sqlmodel import select

from src.db.dbs import get_db
from src.db.redis_client import redis, redis_client
from src.models.models import Message, User
from src.models.models import Session as SessionModel
from src.models.schema import (
    SessionResponse,
    TitleResponse,
    TitleUpdateRequest,
)
from src.router.auth import get_current_user

logger.add("logs/api.log", rotation="1 MB", retention="10 days", level="INFO")

logger.info("Server started")

router = APIRouter()

load_dotenv()


@router.post("/new", response_model=SessionResponse)
async def create_new_session(
    user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    try:
        try:
            new_session = SessionModel(
                user_id=user.userid,
                title="New Chat",
                model="default",
            )
        except Exception as model_error:
            raise HTTPException(
                status_code=422, detail=f"Model creation failed: {str(model_error)}"
            )

        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        await redis_client.delete(f"user:{user.userid}:sessions")
        return SessionResponse(session_id=str(new_session.session_id))

    except HTTPException:
        raise
    except Exception as e:
        try:
            db.rollback()
        except:
            pass

        raise HTTPException(
            status_code=500, detail=f"Session creation failed: {str(e)}"
        )


@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, db: DBSession = Depends(get_db)):
    """Get all messages in a chat session"""

    cached_key = f"sessions:{session_id}"
    sessions_history = await redis_client.get(cached_key)
    if sessions_history:
        return json.loads(sessions_history)
    else:
        messages = (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .order_by(Message.timestamp)
            .all()
        )
        messages = [
            {
                "id": str(msg.message_id),
                "role": msg.sender.value
                if hasattr(msg.sender, "value")
                else str(msg.sender),
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
            }
            for msg in messages
        ]
        await redis_client.set(cached_key, json.dumps(messages), ex=3600)

    return messages


@router.patch("/{session_id}/title", response_model=TitleResponse)
async def update_session_title(
    session_id: str,
    request: TitleUpdateRequest,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update session title"""
    try:
        session_uuid = UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    session_query = select(SessionModel).where(SessionModel.session_id == session_uuid)
    session = db.execute(session_query).scalars().first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.title = request.title
    session.updated_at = datetime.datetime.utcnow()

    # Invalidate the cache so it fetches fresh data next time!
    await redis_client.delete(f"user:{user.userid}:sessions")

    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info(f"Updated title for session {session_id}: {request.title}")
    return TitleResponse(title=session.title)


@router.delete("/{session_id}")
async def delete_session(
    session_id: str, db: DBSession = Depends(get_db), user=Depends(get_current_user)
):
    # 1. Parse & validate UUID
    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(400, "Invalid session ID format")

    # 2. Fetch the Session row
    stmt = select(SessionModel).where(SessionModel.session_id == sid)
    result = db.execute(stmt)
    session_row = result.scalars().first()
    if not session_row:
        raise HTTPException(404, "Session not found")

    # 3. (Optional) Authorization check here:
    if str(session_row.user_id) != str(user.userid):
        raise HTTPException(403)

    # 4. Delete all Messages linked to it
    msg_stmt = select(Message).where(Message.session_id == sid)
    messages = db.execute(msg_stmt).scalars().all()
    for m in messages:
        db.delete(m)

    # 5. Delete the Session row itself
    db.delete(session_row)
    db.commit()

    # 6. Redis cleanup, etc.

    await redis_client.delete(f"sessions:{session_id}")
    await redis_client.delete(f"user:{user.userid}:sessions")

    return True


import json


@router.get("/getAll")
async def get_all_sessions(
    db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Get all sessions for the current user"""
    try:
        cached_sessions = await redis_client.get(f"user:{user.userid}:sessions")
        if cached_sessions:
            return json.loads(cached_sessions)

        session_query = (
            select(SessionModel)
            .where(SessionModel.user_id == user.userid)
            .order_by(SessionModel.updated_at)
        )
        sessions = db.execute(session_query).scalars().all()

        from src.models.models import KnowledgeBase

        session_list = []
        for session in sessions:
            kb_id_str = str(session.kb_id) if session.kb_id else None
            source_type = None
            if session.kb_id:
                kb = db.query(KnowledgeBase).filter_by(kb_id=session.kb_id).first()
                if kb:
                    source_type = (
                        kb.source_type.value
                        if hasattr(kb.source_type, "value")
                        else str(kb.source_type)
                    )

            session_list.append(
                {
                    "id": str(session.session_id),
                    "session_id": str(session.session_id),
                    "title": session.title,
                    "kb_id": kb_id_str,
                    "source_type": source_type,
                    "created_at": session.created_at.isoformat(),
                    "updated_at": (
                        session.updated_at.isoformat() if session.updated_at else None
                    ),
                }
            )

        await redis_client.set(
            f"user:{user.userid}:sessions", json.dumps(session_list), ex=3600
        )
        return session_list

    except Exception as e:
        logger.error(f"Error fetching sessions for user {user.userid}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch sessions")
