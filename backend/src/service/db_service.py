import uuid
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from loguru import logger
from sqlmodel import Session,select

from src.db import dbs
from src.db.redis_client import aredis as redis_client
from src.models.enums import KBSourceType, KBStatus
from src.models.models import KnowledgeBase, Message
from src.models.models import Session as DBSession
from sqlalchemy.ext.asyncio import AsyncSession



def update_kb(kb_id: str, status: KBStatus):
    """Sync — called from Celery tasks which cannot use AsyncSession."""
    with dbs.get_task_db() as db:
        result = db.execute(select(KnowledgeBase).where(KnowledgeBase.kb_id == kb_id))
        kb = result.scalars().first()
        if kb:
            kb.status = status
            db.add(kb)
            db.commit()


async def add_message(db: AsyncSession, session_id: str, sender: str, content: str) -> None:
    try:
        session_uuid = UUID(session_id)
        message = Message(session_id=session_uuid, sender=sender, content=content)
        db.add(message)

        from sqlalchemy import update

        await db.execute(
            update(DBSession)
            .where(DBSession.session_id == session_uuid)
            .values(updated_at=datetime.utcnow())
        )
        await db.commit()
        await db.refresh(message)
        await redis_client.delete(f"sessions:{session_id}")
        return message
    except Exception as e:
        logger.error(f"Failed to save message: {e}")
        await db.rollback()


async def ensure_kb(kb_id: str, session_id: str, db: AsyncSession, source_ref: str, source_type: KBSourceType):
    """Ensures that the knowledge base exists in PostgreSQL and links it to the Session."""
    try:
        session_uuid = uuid.UUID(session_id)

        # 1. First, find the session to get the user_id
        result = await db.execute(select(DBSession).where(DBSession.session_id == session_uuid))
        db_session = result.scalars().first()
        
        if not db_session:
            raise HTTPException(status_code=400, detail="Session not found — cannot create KB without a valid user")

        # 2. Ensure KnowledgeBase row exists FIRST to avoid FK violations on autoflush
        result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.kb_id == kb_id))
        kb = result.scalars().first()
        
        if not kb:
            kb = KnowledgeBase(
                kb_id=kb_id,
                user_id=db_session.user_id,
                source_type=source_type,
                source_ref=source_ref,
                status=KBStatus.PENDING,
                created_at=datetime.utcnow(),
            )
            db.add(kb)
            # Flush here to guarantee the KB exists before we link the session
            await db.flush()

        # 3. Now link the Session to this KB
        db_session.kb_id = kb_id
        db.add(db_session)

        await db.commit()
        return kb
    except HTTPException:
        raise
    except Exception as dbe:
        logger.error(f"Postgres update failed: {dbe}")
        await db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database association failed: {dbe}"
        )
