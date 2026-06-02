import json
import os
import uuid
from typing import List

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from loguru import logger
from sqlmodel import Session, select

from src.config.settings import settings
from src.db.dbs import get_db
from src.db.redis_client import aredis as redis_client
from src.models.enums import KBSourceType, KBStatus
from src.models.models import KnowledgeBase, User
from src.models.schema import GitRequest, GitSpec
from src.router.auth import get_current_user
from src.router.limiter import limiter
from src.service.db_service import ensure_kb
from src.service.repo_limits import RepoTooLargeError, enforce_repo_limits
from src.service.s3 import upload_file_to_s3
from src.service.tasks import ingest_git_repo_task, ingest_pdf_task
from src.service.utils import get_dir_struct

router = APIRouter()


async def validate_and_get_commit_sha(req: GitRequest) -> tuple[str, str]:
    """
    Validates the GitHub repository, finds the appropriate branch/commit,
    and returns the commit SHA and resolved branch/ref.
    """
    headers = {}
    github_token = req.token or settings.github_token
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            meta = await client.get(
                f"https://api.github.com/repos/{req.owner}/{req.repo}",
                headers=headers,
            )
            if meta.status_code == 404 or meta.status_code == 301:
                raise HTTPException(
                    status_code=400,
                    detail=f"Repository '{req.owner}/{req.repo}' not found or not accessible.",
                )
            meta.raise_for_status()

            ref = req.commit or req.branch or meta.json()["default_branch"]

            resp = await client.get(
                f"https://api.github.com/repos/{req.owner}/{req.repo}/commits/{ref}",
                headers=headers,
            )

            # if resp.status_code == 422 and req.branch == "main" and not req.commit:
            #     default_branch = meta.json()["default_branch"]
            #     if default_branch != "main":
            #         ref = default_branch
            #         resp = await client.get(
            #             f"https://api.github.com/repos/{req.owner}/{req.repo}/commits/{ref}",
            #             headers=headers,
            #         )

        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch repo from GitHub: {resp.text}",
            )

        return resp.json()["sha"], ref

    except httpx.RequestError as exc:
        logger.error(f"GitHub API connection error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Failed to connect to GitHub. Please check your network or try again.",
        )


@router.post("/git")
@limiter.limit("5/minute")
async def git_rag(
    request: Request,
    req: GitRequest,
    session_id: str,
    kb_id: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Triggers the background ingestion of a Git repository via Celery."""
    sha, ref = await validate_and_get_commit_sha(req)

    try:
        await enforce_repo_limits(req, ref)
    except RepoTooLargeError as e:
        logger.warning(f"Repo rejected for size: {req.owner}/{req.repo}: {e}")
        raise HTTPException(status_code=413, detail=str(e))

    kb_id = str(uuid.uuid5(uuid.NAMESPACE_OID, sha))

    logger.info(
        f"Triggering Git ingestion: session={session_id}, kb_id={kb_id}, sha={sha}"
    )

    logger.info(f"Owner:{req.owner}  Repo:{req.repo} req:{req}")

    kb = await ensure_kb(
        kb_id=kb_id,
        session_id=session_id,
        db=db,
        source_type=KBSourceType.GITHUB,
        source_ref=f"{req.owner}/{req.repo}",
    )

    if kb.status == KBStatus.READY:
        logger.info(f"KB {kb_id} already READY. Skipping ingestion.")
        return {"status": "ready", "kb_id": kb_id}

    if kb.status in (KBStatus.INDEXING, KBStatus.PENDING):
        redis_key = f"kb:{kb_id}:status"
        redis_val = await redis_client.get(redis_key)

        should_skip = False
        if redis_val is not None:
            try:
                if isinstance(redis_val, bytes):
                    redis_val = redis_val.decode()
                status_data = json.loads(redis_val)
                if status_data.get("status") in ("processing", "indexing", "pending"):
                    should_skip = True
            except (json.JSONDecodeError, AttributeError):
                should_skip = True

        if should_skip:
            logger.info(
                f"KB {kb_id} has status {kb.status} and live processing Redis key. "
                "Skipping re-dispatch."
            )
            return {
                "status": "indexing" if kb.status == KBStatus.INDEXING else "pending",
                "kb_id": kb_id,
            }

        logger.warning(
            f"KB {kb_id} is stuck in {kb.status} (Redis says not processing). "
            "Resetting and re-dispatching Celery task."
        )
        kb.status = KBStatus.PENDING
        db.add(kb)
        await db.commit()

    await redis_client.set(
        f"kb:{kb_id}:status",
        json.dumps({"status": "processing", "detail": "Indexing initialized..."}),
        ex=180,
    )

    req_data = req.model_dump()
    req_data["branch"] = ref
    ingest_git_repo_task.delay(req_data, kb_id, session_id, str(user.userid))

    return {
        "status": "indexing",
        "kb_id": kb_id,
    }


@router.post("/upload")
@limiter.limit("5/minute")
async def get_rag(
    request: Request,
    files: List[UploadFile] = File(...),
    session_id: str = Form(...),
    kb_id: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Saves uploaded files and triggers background PDF ingestion via Celery."""
    logger.info(f"Triggering PDF ingestion: session={session_id}, kb_id={kb_id}")

    source_ref = ",".join([f.filename for f in files if f.filename])

    await ensure_kb(
        kb_id=kb_id,
        session_id=session_id,
        db=db,
        source_type=KBSourceType.PDF,
        source_ref=source_ref,
    )

    file_paths = []
    for file in files:
        if not file.filename:
            continue
        try:
            s3_key = await upload_file_to_s3(file=file, kb_id=kb_id)
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        file_paths.append(s3_key)

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
    tree = await get_dir_struct(reques)
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
        result = await db.execute(
            select(KnowledgeBase).where(KnowledgeBase.kb_id == kb_id)
        )
        kb = result.scalars().first()
        if kb:
            # Handle DB status enum cleanly
            status_str = (
                kb.status.value if hasattr(kb.status, "value") else str(kb.status)
            )
            logger.info(f"Postgres status for KB {kb_id}: {status_str}")

            if status_str.upper() == "INDEXING":
                # Redis key is gone but Postgres says INDEXING → worker died.
                # Return 'stale' so the frontend can surface a retry option.

                if redis_client.get(kb_key) is None:
                    # Set it to stale in db
                    kb.status = KBStatus.STALE
                    db.add(kb)
                    await db.commit()

                return {
                    "status": "stale",
                    "detail": "Worker stopped mid-task. Re-submit the repository to restart indexing.",
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
            elif status_str.upper() == "REJECTED":
                return {
                    "status": "rejected",
                    "detail": "Repository rejected",
                    "kb_id": kb_id,
                }
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
