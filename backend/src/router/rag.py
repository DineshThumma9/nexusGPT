import json
import logging
import os
import shutil
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session

from src.db.dbs import get_db
from src.db.redis_client import redis, redis_client
from src.models.enums import KBSourceType, KBStatus
from src.models.models import KnowledgeBase
from src.models.models import Session as DBSession
from src.models.schema import GitRequest, GitSpec
from src.service.tasks import ingest_git_repo_task, ingest_pdf_task
from src.service.tools import get_dir_struct

router = APIRouter()
logger = logging.getLogger("rag")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
UPLOADS_DIR = os.path.join(os.path.dirname(PROJECT_ROOT), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


def ensure_kb(
    kb_id: str, session_id: str, db: Session, source_ref: str, source_type: KBSourceType
):
    """Ensures that the knowledge base exists in PostgreSQL and links it to the Session."""
    try:
        kb_uuid = UUID(kb_id)
        session_uuid = UUID(session_id)

        # Link Session to this KB
        db_session = db.query(DBSession).filter_by(session_id=session_uuid).first()
        if db_session:
            db_session.kb_id = kb_uuid
            db.add(db_session)

        # Ensure KnowledgeBase row exists
        kb = db.query(KnowledgeBase).filter_by(kb_id=kb_uuid).first()
        if not kb:
            kb = KnowledgeBase(
                kb_id=kb_uuid,
                user_id=db_session.user_id if db_session else kb_uuid,  # Fallback
                source_type=source_type,
                source_ref=source_ref,
                status=KBStatus.PENDING,
                created_at=datetime.utcnow(),
            )
            db.add(kb)

        db.commit()
    except Exception as dbe:
        logger.error(f"Postgres update failed: {dbe}")
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database association failed: {dbe}"
        )


@router.post("/git")
async def git_rag(
    req: GitRequest, session_id: str, kb_id: str, db: Session = Depends(get_db)
):
    """Triggers the background ingestion of a Git repository via Celery."""
    logger.info(f"Triggering Git ingestion: session={session_id}, kb_id={kb_id}")

    logger.info(f"Owner:{req.owner}  Repo:{req.repo} req:{req}")

    ensure_kb(
        kb_id=kb_id,
        session_id=session_id,
        db=db,
        source_type=KBSourceType.GITHUB,
        source_ref=f"{req.owner}/{req.repo}",
    )

    # Update Redis status key
    await redis_client.set(
        f"kb:{kb_id}:status",
        json.dumps({"status": "processing", "detail": "Indexing initialized..."}),
        ex=86400,
    )

    # Trigger Celery Task asynchronously
    ingest_git_repo_task.delay(req.model_dump(), kb_id)

    return {
        "status": "indexing",
        "kb_id": kb_id,
    }


@router.post("/upload")
async def get_rag(
    files: List[UploadFile] = File(...),
    session_id: str = Form(...),
    kb_id: str = Form(...),
    db: Session = Depends(get_db),
):
    """Saves uploaded files and triggers background PDF ingestion via Celery."""
    logger.info(f"Triggering PDF ingestion: session={session_id}, kb_id={kb_id}")

    source_ref = ",".join([f.filename for f in files if f.filename])

    ensure_kb(
        kb_id=kb_id,
        session_id=session_id,
        db=db,
        source_type=KBSourceType.PDF,
        source_ref=source_ref,
    )

    # Save uploaded files locally so Celery worker can read them
    file_paths = []
    for file in files:
        if not file.filename:
            continue
        # Use safe name prefix to avoid collision
        safe_filename = f"{kb_id}_{file.filename}"
        file_path = os.path.join(UPLOADS_DIR, safe_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_paths.append(file_path)

    # Update Redis status key
    await redis_client.set(
        f"kb:{kb_id}:status",
        json.dumps({"status": "processing", "detail": "Indexing initialized..."}),
        ex=86400,
    )

    # Trigger Celery Task asynchronously
    ingest_pdf_task.delay(file_paths, kb_id)

    return {
        "status": "indexing",
        "kb_id": kb_id,
    }


@router.post("/tree")
async def get_tree(reques: GitSpec):
    logger.info(f"Directory structure request received: {reques}")
    tree = get_dir_struct(reques)
    return tree


@router.get("/status")
async def get_status(kb_id: str, db: Session = Depends(get_db)):
    """Retrieves the ingestion status. Checks Redis first, then falls back to Postgres."""
    try:
        if not kb_id:
            raise HTTPException(
                status_code=400, detail="kb_id query parameter is required"
            )

        # Check standard namespace key in Redis
        kb_key = f"kb:{kb_id}:status"
        status_val = await redis_client.get(kb_key)

        if status_val is not None:
            if isinstance(status_val, bytes):
                status_val = status_val.decode()
            try:
                status_data = json.loads(status_val)
                logger.info(f"Redis status for KB {kb_id}: {status_data['status']}")
                return {
                    "status": status_data["status"],
                    "detail": status_data.get("detail", ""),
                    "kb_id": kb_id,
                }
            except json.JSONDecodeError:
                # Fallback if old raw string is still in Redis
                return {"status": "processing", "detail": status_val, "kb_id": kb_id}

        # Fallback to Postgres
        kb_uuid = UUID(kb_id)
        kb = db.query(KnowledgeBase).filter_by(kb_id=kb_uuid).first()
        if kb:
            # Handle DB status enum cleanly
            status_str = (
                kb.status.value if hasattr(kb.status, "value") else str(kb.status)
            )
            logger.info(f"Postgres status for KB {kb_id}: {status_str}")
            
            if status_str.upper() == "INDEXING":
                return {"status": "processing", "detail": "Initializing worker...", "kb_id": kb_id}
            elif status_str.upper() == "READY":
                return {"status": "ready", "detail": "Ingestion complete", "kb_id": kb_id}
            elif status_str.upper() == "FAILED":
                return {"status": "failed", "detail": "Task failed", "kb_id": kb_id}
            else:
                return {"status": status_str.lower(), "detail": status_str, "kb_id": kb_id}

        return {"status": "missing", "detail": "Knowledge base not found", "kb_id": kb_id}
    except Exception as e:
        logger.error(f"Error getting status for KB {kb_id}: {e}")
        return {"status": "error", "detail": str(e), "kb_id": kb_id}
