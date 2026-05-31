import uuid
from datetime import datetime
from typing import Optional
from uuid import UUID

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import and_, or_
from sqlmodel import Session as DBSession
from sqlmodel import select

from src.db.dbs import get_db
from src.models.models import Message, User
from src.models.models import Session as SessionModel
from src.models.schema import (
    ChatMessage,
    PaginatedMessageResponse,
    PaginatedSessionResponse,
    SessionResponse,
    TitleResponse,
    TitleUpdateRequest,
)
from src.router.auth import get_current_user
from src.router.limiter import limiter
from sqlalchemy.ext.asyncio import AsyncSession
from src.service.utils import decode_cursor, encode_cursor
from src.db.redis_client import aredis as redis


class CreateSessionRequest(BaseModel):
    session_id: Optional[str] = None


logger.add("logs/api.log", rotation="1 MB", retention="10 days", level="INFO")
logger.info("Server started")

router = APIRouter()
load_dotenv()

# -------------------------------------------------------------------------
# ROUTES
# -------------------------------------------------------------------------


@router.post("/new", response_model=SessionResponse)
@limiter.limit("10/minute")
async def create_new_session(
    request: Request,
    body: CreateSessionRequest | None = None,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    session_id = body.session_id if body and body.session_id else str(uuid.uuid4())
    try:
        new_session = SessionModel(
            user_id=user.userid,
            session_id=session_id,
            title="New Chat",
            model="default",
        )
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        return new_session
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save new session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}")
@limiter.limit("30/minute")
async def get_chat_history(
    request: Request,
    session_id: str,
    db: DBSession = Depends(get_db),
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    response_format=PaginatedMessageResponse,
):
    """Get messages for a session. Pass `cursor` from previous response to load older messages."""
    query = select(Message).where(Message.session_id == session_id)
    result = await db.execute(query)
    query = result.scalars().all()

    if cursor:
        timestamp, _id = decode_cursor(cursor)
        # Scroll UP — load messages OLDER than the cursor
        query = query.filter(
            or_(
                Message.timestamp < timestamp,
                and_(
                    Message.timestamp == timestamp,
                    Message.message_id < str(_id),
                ),
            )
        )

    # Fetch limit+1 to detect if there are more pages
    rows = (
        query.order_by(Message.timestamp.desc(), Message.message_id.desc())
        .limit(limit + 1)
        .all()
    )

    has_more = len(rows) > limit
    items = rows[:limit]
    # Reverse so oldest is first (correct display order)
    items = list(reversed(items))

    next_cursor = None
    if has_more:
        # Cursor points to the oldest message in the current page (first after reversal)
        next_cursor = encode_cursor(items[0].timestamp, str(items[0].message_id))

    messages = [ChatMessage.model_validate(msg) for msg in items]

    return PaginatedMessageResponse(
        messages=messages,
        next_cursor=next_cursor,
        has_more=has_more,
    )


@router.patch("/{session_id}/title", response_model=TitleResponse)
@limiter.limit("20/minute")
async def update_session_title(
    request: Request,
    session_id: str,
    body: TitleUpdateRequest,
    user: User = Depends(get_current_user),
    db:AsyncSession =Depends(get_db),
):
    """Update session title"""
    try:
        session_uuid = str(UUID(session_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    try:
        session_uuid  = session_id
        session_query = select(SessionModel).where(
            SessionModel.session_id == session_uuid
        )
        result = await db.execute(session_query)
        session = result.scalars().first()

        if session:
            session.title = body.title
            session.updated_at = datetime.utcnow()
            db.add(session)  # add() is always sync on AsyncSession
            await db.commit()

            logger.info(f"Updated title for session {session.session_id}: {body.title}")
            await redis.delete(f"user:{user.userid}:sessions")
        else:
            logger.warning(f"Session {session_id} not found for title update")
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating session title: {str(e)}")

    return TitleResponse(title=body.title)


@router.delete("/{session_id}")
@limiter.limit("20/minute")
async def delete_session(
    request: Request,
    session_id: str,
    db: DBSession = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(400, "Invalid session ID format")

    stmt = select(SessionModel).where(SessionModel.session_id == sid)
    result = await db.execute(stmt)
    session_row = result.scalars().first()
    if not session_row:
        raise HTTPException(404, "Session not found")

    if str(session_row.user_id) != str(user.userid):
        raise HTTPException(403, "Not authorized to delete this session")

    # FIXED: keyword argument updated from 'user' to 'user_id' to match task signature
    try:
        # 1. Delete all Messages linked to it
        msg_stmt = select(Message).where(Message.session_id == sid)
        result = await db.execute(msg_stmt)
        messages = result.scalars().all()
        for m in messages:
            db.delete(m)

        # 2. Delete the Session row itself
        session_stmt = select(SessionModel).where(SessionModel.session_id == sid)
        result = await db.execute(session_stmt)
        session_row = result.scalars().first()
        if session_row:
            db.delete(session_row)

        await db.commit()

        # 3. Redis cleanup
        await redis.delete(f"sessions:{session_id}")
        await redis.delete(f"user:{user.userid}:sessions")
        logger.info(f"Successfully deleted session data and cache for {session_id}")
    except Exception as e:
        await db.rollback()
        logger.error(f"Error during background session deletion: {str(e)}")
    return {"status": "success"}


# -------------------------------------------------------------------------
# CURSOR HELPERS
# -------------------------------------------------------------------------


@router.get("/getAll")
@limiter.limit("30/minute")
async def get_all_sessions(
    request: Request,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
    cursor: Optional[str] = Query(
        None, description="Opaque pagination cursor from previous response"
    ),
    limit: int = Query(20, ge=1, le=50),
    response_format=PaginatedSessionResponse,
):
    """Get sessions for the current user with cursor-based pagination."""
    try:
        from src.models.models import KnowledgeBase

        query = (
            select(SessionModel, KnowledgeBase)
            .outerjoin(KnowledgeBase, SessionModel.kb_id == KnowledgeBase.kb_id)
            .where(SessionModel.user_id == user.userid)
        )

        if cursor:
            cursor_updated_at, cursor_id = decode_cursor(cursor)
            if cursor_updated_at:
                query = query.where(
                    or_(
                        SessionModel.updated_at < cursor_updated_at,
                        and_(
                            SessionModel.updated_at == cursor_updated_at,
                            SessionModel.session_id < cursor_id,
                        ),
                    )
                )

        query = query.order_by(SessionModel.updated_at.desc()).limit(limit + 1)
        results = await db.execute(query)
        results = results.all()  # .scalars() would drop the KnowledgeBase join column
        has_more = len(results) > limit
        page = results[:limit]
        next_cursor = None

        session_list = []
        for session, kb in page:
            source_type = None
            if kb:
                source_type = (
                    kb.source_type.value
                    if hasattr(kb.source_type, "value")
                    else str(kb.source_type)
                )
            session_dict = session.model_dump()
            session_dict["source_type"] = source_type
            session_list.append(SessionResponse.model_validate(session_dict))

        if has_more:
            last = page[-1][0]  # last SessionModel
            next_cursor = encode_cursor(
                last.updated_at or last.created_at,
                str(last.session_id),
            )

        return PaginatedSessionResponse(
            sessions=session_list,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    except Exception as e:
        logger.error(f"Error fetching sessions for user {user.userid}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch sessions")
