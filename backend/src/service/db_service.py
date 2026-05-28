import uuid
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from loguru import logger
from sqlmodel import Session

from src.db import dbs
from src.db.redis_client import redis_client
from src.models.enums import KBSourceType, KBStatus
from src.models.models import KnowledgeBase, Message
from src.models.models import Session as DBSession


def update_kb(kb_id, status):
    # Update Postgres status
    dbs._init_db()
    db = dbs.SessionLocal()
    try:
        kb = db.query(KnowledgeBase).filter_by(kb_id=kb_id).first()
        if kb:
            kb.status = status
            db.add(kb)
            db.commit()
    except Exception as dbe:
        db.rollback()
        print(f"Error updating Postgres KB status to {status}: {dbe}")
    finally:
        db.close()


async def add_message(db, session_id, sender, content):
    try:
        session_uuid = UUID(session_id)
        message = Message(session_id=session_uuid, sender=sender, content=content)
        db.add(message)

        from sqlalchemy import update

        db.execute(
            update(DBSession)
            .where(DBSession.session_id == session_uuid)
            .values(updated_at=datetime.utcnow())
        )
        db.commit()
        db.refresh(message)
        await redis_client.delete(f"sessions:{session_id}")
        return message
    except Exception as e:
        logger.error(f"Failed to save message: {e}")
        db.rollback()


def ensure_kb(
    kb_id: str, session_id: str, db: Session, source_ref: str, source_type: KBSourceType
):
    """Ensures that the knowledge base exists in PostgreSQL and links it to the Session."""
    try:
        session_uuid = uuid.UUID(session_id)

        # Link Session to this KB
        db_session = db.query(DBSession).filter_by(session_id=session_uuid).first()
        if db_session:
            db_session.kb_id = kb_id
            db.add(db_session)

        # Ensure KnowledgeBase row exists
        kb = db.query(KnowledgeBase).filter_by(kb_id=kb_id).first()
        if not kb:
            kb = KnowledgeBase(
                kb_id=kb_id,
                user_id=db_session.user_id
                if db_session
                else uuid.UUID(
                    session_id
                ),  # Fallback to session_id isn't exactly correct but keeps legacy behavior
                source_type=source_type,
                source_ref=source_ref,
                status=KBStatus.PENDING,
                created_at=datetime.utcnow(),
            )
            db.add(kb)

        db.commit()
        return kb
    except Exception as dbe:
        logger.error(f"Postgres update failed: {dbe}")
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database association failed: {dbe}"
        )
