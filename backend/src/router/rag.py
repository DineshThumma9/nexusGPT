import json
import logging
import os
import shutil
import uuid
from datetime import datetime
from typing import List, Optional

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


import requests

from src.models.models import User
from src.router.auth import get_current_user


@router.post("/git")
async def git_rag(
    req: GitRequest,
    session_id: str,
    kb_id: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Triggers the background ingestion of a Git repository via Celery."""
    # Fetch latest SHA from GitHub
    headers = {}
    github_token = os.getenv("GITHUB_TOKEN")
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    ref = req.commit or req.branch or "HEAD"
    resp = requests.get(
        f"https://api.github.com/repos/{req.owner}/{req.repo}/commits/{ref}",
        headers=headers,
    )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=400, detail=f"Failed to fetch repo from GitHub: {resp.text}"
        )

    # Override the frontend's kb_id with a deterministic UUID based on the SHA
    sha = resp.json()["sha"]
    kb_id = str(uuid.uuid5(uuid.NAMESPACE_OID, sha))

    logger.info(
        f"Triggering Git ingestion: session={session_id}, kb_id={kb_id}, sha={sha}"
    )

    logger.info(f"Owner:{req.owner}  Repo:{req.repo} req:{req}")

    kb = ensure_kb(
        kb_id=kb_id,
        session_id=session_id,
        db=db,
        source_type=KBSourceType.GITHUB,
        source_ref=f"{req.owner}/{req.repo}",
    )

    if (
        kb.status in (KBStatus.READY, KBStatus.INDEXING, KBStatus.PENDING)
        and kb.created_at
    ):
        # If the KB was created in the past and not FAILED, check if we really need to ingest again.
        # Actually, if it's already READY or currently INDEXING, skip Celery task.
        if kb.status in (KBStatus.READY, KBStatus.INDEXING):
            logger.info(
                f"KB {kb_id} (SHA: {sha}) already exists with status {kb.status}. Skipping ingestion."
            )
            return {
                "status": "indexing" if kb.status == KBStatus.INDEXING else "ready",
                "kb_id": kb_id,
            }

    # Update Redis status key
    await redis_client.set(
        f"kb:{kb_id}:status",
        json.dumps({"status": "processing", "detail": "Indexing initialized..."}),
        ex=86400,
    )

    # Trigger Celery Task asynchronously
    ingest_git_repo_task.delay(req.model_dump(), kb_id, session_id, str(user.userid))

    return {
        "status": "indexing",
        "kb_id": kb_id,
    }


from botocore.exceptions import ClientError

from src.service.s3 import delete_prefix_from_s3, upload_file_to_s3


@router.post("/upload")
async def get_rag(
    files: List[UploadFile] = File(...),
    session_id: str = Form(...),
    kb_id: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
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
        # Upload to S3
        try:
            s3_key = await upload_file_to_s3(file=file, kb_id=kb_id)
        except ClientError as e:
            logger.error(f"Failed to upload file to S3: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload file to S3")

        # We append the S3 key to file_paths so Celery can download it
        file_paths.append(s3_key)

    # Update Redis status key
    await redis_client.set(
        f"kb:{kb_id}:status",
        json.dumps({"status": "processing", "detail": "Indexing initialized..."}),
        ex=86400,
    )

    # Trigger Celery Task asynchronously
    ingest_pdf_task.delay(file_paths, kb_id, session_id, str(user.userid))

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
async def get_status(
    kb_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
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
        kb = db.query(KnowledgeBase).filter_by(kb_id=kb_id).first()
        if kb:
            # Handle DB status enum cleanly
            status_str = (
                kb.status.value if hasattr(kb.status, "value") else str(kb.status)
            )
            logger.info(f"Postgres status for KB {kb_id}: {status_str}")

            if status_str.upper() == "INDEXING":
                return {
                    "status": "processing",
                    "detail": "Initializing worker...",
                    "kb_id": kb_id,
                }
            elif status_str.upper() == "READY":
                return {
                    "status": "ready",
                    "detail": "Ingestion complete",
                    "kb_id": kb_id,
                }
            elif status_str.upper() == "FAILED":
                return {"status": "failed", "detail": "Task failed", "kb_id": kb_id}
            else:
                return {
                    "status": status_str.lower(),
                    "detail": status_str,
                    "kb_id": kb_id,
                }

        return {
            "status": "missing",
            "detail": "Knowledge base not found",
            "kb_id": kb_id,
        }
    except Exception as e:
        logger.error(f"Error getting status for KB {kb_id}: {e}")
        return {"status": "error", "detail": str(e), "kb_id": kb_id}


mock_status_counters = {}


@router.get("/mock/status")
async def get_mock_status(kb_id: str, db: Session = Depends(get_db)):
    """Retrieves a mock sequence of ingestion statuses."""
    global mock_status_counters

    if kb_id not in mock_status_counters:
        mock_status_counters[kb_id] = 0

    count = mock_status_counters[kb_id]
    mock_status_counters[kb_id] += 1

    if count == 0:
        return {
            "kb_id": kb_id,
            "status": "processing",
            "detail": "Indexing has been Initialized",
        }
    elif count == 1:
        return {
            "kb_id": kb_id,
            "status": "processing",
            "detail": "Fetching Github Repository",
        }
    elif count == 2:
        return {"kb_id": kb_id, "status": "processing", "detail": "Analyzing Structure"}
    elif count == 3:
        return {"kb_id": kb_id, "status": "processing", "detail": "Parsing Code"}
    elif count == 4:
        return {
            "kb_id": kb_id,
            "status": "processing",
            "detail": "Uploading to Databases",
        }
    else:
        import random

        fail = random.randint(0, 1) <= 0.2
        if fail:
            return {"kb_id": kb_id, "status": "failed", "detail": "Indexing Failed"}
        return {"kb_id": kb_id, "status": "ready", "detail": "Query Now"}
