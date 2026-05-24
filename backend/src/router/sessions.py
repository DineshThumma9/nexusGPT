import datetime
import json  # Moved to the top to avoid hidden scope bugs
import uuid
from uuid import UUID

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlmodel import Session as DBSession
from sqlmodel import select

from src.db.dbs import get_db, SessionLocal  # Extracted from lower import for cleanliness
from src.db.redis_client import redis, redis_client
from src.models.models import Message, User
from src.models.models import Session as SessionModel
from src.models.schema import (
    SessionResponse,
    TitleResponse,
    TitleUpdateRequest,
)
from pydantic import BaseModel
from typing import Optional

class CreateSessionRequest(BaseModel):
    session_id: Optional[str] = None
from src.router.auth import get_current_user
from src.db.redis_client import queue

logger.add("logs/api.log", rotation="1 MB", retention="10 days", level="INFO")
logger.info("Server started")

router = APIRouter()
load_dotenv()

# -------------------------------------------------------------------------
# ROUTES
# -------------------------------------------------------------------------

@router.post("/new", response_model=SessionResponse)
async def create_new_session(
    request: CreateSessionRequest | None = None,
    user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    session_id = request.session_id if request and request.session_id else str(uuid.uuid4())
    write_new_session.delay(session_id, str(user.userid))
    return SessionResponse(session_id=session_id)


@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, db: DBSession = Depends(get_db)):
    """Get all messages in a chat session"""
    cached_key = f"sessions:{session_id}"
    sessions_history = await redis_client.get(cached_key)
    if sessions_history:
        return json.loads(sessions_history)
        
    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.timestamp)
        .all()
    )
    messages = [
        {
            "id": str(msg.message_id),
            "sender": msg.sender.value if hasattr(msg.sender, "value") else str(msg.sender),
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
    user: User = Depends(get_current_user),
):
    """Update session title"""
    try:
        session_uuid = str(UUID(session_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    write_session.delay(session_uuid, request.title, str(user.userid))
    return TitleResponse(title=request.title)


@router.delete("/{session_id}")
async def delete_session(
    session_id: str, db: DBSession = Depends(get_db), user=Depends(get_current_user)
):
    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(400, "Invalid session ID format")

    stmt = select(SessionModel).where(SessionModel.session_id == sid)
    result = db.execute(stmt)
    session_row = result.scalars().first()
    if not session_row:
        raise HTTPException(404, "Session not found")

    if str(session_row.user_id) != str(user.userid):
        raise HTTPException(403, "Not authorized to delete this session")

    # FIXED: keyword argument updated from 'user' to 'user_id' to match task signature
    delete_session_background.delay(session_id=str(sid), user_id=str(user.userid))

    return {"status": "success"}


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
                        kb.source_type.value if hasattr(kb.source_type, "value") else str(kb.source_type)
                    )

            session_list.append(
                {
                    "id": str(session.session_id),
                    "session_id": str(session.session_id),
                    "title": session.title,
                    "kb_id": kb_id_str,
                    "source_type": source_type,
                    "created_at": session.created_at.isoformat(),
                    "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                }
            )

        await redis_client.set(f"user:{user.userid}:sessions", json.dumps(session_list), ex=3600)
        return session_list

    except Exception as e:
        logger.error(f"Error fetching sessions for user {user.userid}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch sessions")


# -------------------------------------------------------------------------
# BACKGROUND TASKS (Worker Executed)
# -------------------------------------------------------------------------


from src.db import dbs


@queue.task(time_limit=90)  # FIXED: typo 'tie_limit' corrected to 'time_limit'
def write_new_session(session_id: str, user_id: str):

    dbs._init_db()

    db = dbs.SessionLocal()
    try:
        new_session = SessionModel(
            user_id=UUID(user_id),
            session_id=UUID(session_id),
            title="New Chat",
            model="default",
        )
        db.add(new_session)
        db.commit()
        redis.delete(f"user:{user_id}:sessions")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save new session: {str(e)}")
    finally:
        db.close()


@queue.task(time_limit=60)
def write_session(session_id: str, title: str, user_id: str):  # FIXED: Changed from 'async def' to standard 'def'
    
    dbs._init_db()
    db = dbs.SessionLocal()
    try:
        session_uuid = UUID(session_id)
        session_query = select(SessionModel).where(SessionModel.session_id == session_uuid)
        session = db.execute(session_query).scalars().first()
        
        if session:
            session.title = title
            session.updated_at = datetime.datetime.utcnow()
            db.add(session)
            db.commit()
            
            logger.info(f"Updated title for session {session.session_id}: {title}")
            redis.delete(f"user:{user_id}:sessions")
        else:
            logger.warning(f"Session {session_id} not found for title update")
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating session title: {str(e)}")
    finally:
        db.close()
    # FIXED: Removed the duplicate, unprotected logger.info from down here


@queue.task(time_limit=120)
def delete_session_background(session_id: str, user_id: str):

    dbs._init_db()
    
    db = dbs.SessionLocal()
    sid = UUID(session_id)
    try:
        # 1. Delete all Messages linked to it
        msg_stmt = select(Message).where(Message.session_id == sid)
        messages = db.execute(msg_stmt).scalars().all()
        for m in messages:
            db.delete(m)

        # 2. Delete the Session row itself
        session_stmt = select(SessionModel).where(SessionModel.session_id == sid)
        session_row = db.execute(session_stmt).scalars().first()
        if session_row:
            db.delete(session_row)
            
        db.commit()

        # 3. Redis cleanup
        redis.delete(f"sessions:{session_id}")
        redis.delete(f"user:{user_id}:sessions")
        logger.info(f"Successfully deleted session data and cache for {session_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error during background session deletion: {str(e)}")
    finally:
        db.close()
    return True