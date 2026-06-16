import json
import os
from datetime import datetime, timezone
from typing import List
from uuid import UUID

import celery
from celery.exceptions import SoftTimeLimitExceeded
from langchain_groq import ChatGroq as Groq
from loguru import logger
from sqlmodel import select

from src.config.settings import settings
from src.db import dbs
from src.db.redisdb import sredis as redis
from src.models.enums import KBStatus
from src.models.models import Session as SessionModel
from src.models.schema import GitRequest
from src.service.agent.prompts import title_prompt
from src.service.background.worker import queue
from src.service.chat_service import update_kb
from src.service.pipelines.code.scip.scip_pipeline import SCIPPipeline
from src.service.pipelines.code.tree_sitter.cleanup import wipe_kb_data
from src.service.pipelines.rag.documents import RAGPipeline

STATUS_TTL = 240  # 4 min — well above the 3-min soft limit, covers one full ingest


def _set_status(kb_id: str, status: str, detail: str) -> None:
    try:
        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": status, "detail": detail}),
            ex=STATUS_TTL,
        )
    except Exception as e:
        logger.warning(f"Failed to write Redis status for {kb_id}: {e}")


class IngestTask(celery.Task):
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        kb_id = kwargs.get("kb_id")
        if not kb_id and len(args) > 1:
            kb_id = args[1]

        logger.exception(
            f"Task {self.name} failed kb_id={kb_id} task_id={task_id} exc={exc!r}"
        )

        if kb_id:
            try:
                _set_status(kb_id, "failed", str(exc))
            except Exception:
                logger.exception("Failed to write failure status to Redis")
            try:
                update_kb(kb_id, KBStatus.FAILED)
            except Exception:
                logger.exception("Failed to update KB status to FAILED")


@queue.task(time_limit=300, soft_time_limit=180, base=IngestTask)
def ingest_git_repo_task(
    req_dict: dict, kb_id: str, session_id: str = None, user_id: str = None
):
    """Celery background task to fully ingest a Github repository."""
    wipe_kb_data(kb_id)
    _set_status(kb_id, "processing", "Indexing initialized...")
    update_kb(kb_id=kb_id, status=KBStatus.INDEXING)

    req = GitRequest(**req_dict)

    try:
        service = SCIPPipeline(req=req, kb_id=kb_id, branch=req.branch, token=req.token)
        _set_status(kb_id, "processing", "Processing repository...")
        service.build_kb()
    except Exception as e:
        raise ValueError(f"Failed to process repository: {e}") from e

    _set_status(kb_id, "ready", "Ingestion complete")
    update_kb(kb_id=kb_id, status=KBStatus.READY)

    update_session.delay(
        session_id=session_id, title=f"{req.owner}/{req.repo} Repo", user_id=user_id
    )
    logger.info(f"Ingestion pipeline completed for Git KB: {kb_id}")


@queue.task(time_limit=120, soft_time_limit=90, base=IngestTask)
def ingest_pdf_task(
    file_paths: List[str], kb_id: str, session_id: str = None, user_id: str = None
):
    """Celery background task to fully ingest uploaded PDF files."""
    wipe_kb_data(kb_id)
    _set_status(kb_id, "processing", "Indexing initialized...")
    update_kb(kb_id=kb_id, status=KBStatus.INDEXING)

    RAGPipeline(kb_id=kb_id).run(file_paths)

    _set_status(kb_id, "ready", "Ingestion complete")
    update_kb(kb_id=kb_id, status=KBStatus.READY)

    first_file = os.path.basename(file_paths[0]) if file_paths else "PDF Upload"
    update_session.delay(session_id=session_id, title=first_file, user_id=user_id)


@queue.task(time_limit=60, soft_time_limit=45)
def update_session(session_id: str, title: str, user_id: str):
    try:
        with dbs.get_task_db() as db:
            session_uuid = UUID(session_id)
            session = (
                db.execute(
                    select(SessionModel).where(SessionModel.session_id == session_uuid)
                )
                .scalars()
                .first()
            )

            if session and session.title == "New Chat":
                session.title = title
                session.updated_at = datetime.now(timezone.utc)
                db.add(session)
                db.commit()
                logger.info(f"Updated title for session {session.session_id}: {title}")
                redis.delete(f"user:{user_id}:sessions")
            else:
                logger.warning(f"Session {session_id} not found for title update")
    except SoftTimeLimitExceeded:
        raise
    except Exception as e:
        logger.error(f"Error updating session title: {e}")


@queue.task(time_limit=60, soft_time_limit=45)
def session_title_gen(query: str, session_id: str, user_id: str):
    try:
        model = Groq(model=settings.title_llm, api_key=settings.groq_api_key)
        result = model.invoke(title_prompt.format(query=query))
        raw = getattr(result, "content", str(result))
        cleaned = raw.strip().strip('"').strip("'") if raw else ""
        if not cleaned:
            cleaned = "New Chat"

        update_session.delay(session_id=session_id, title=cleaned, user_id=user_id)
        return cleaned
    except Exception as e:
        logger.error(f"Error in session_title_gen: {e}")
        return "New Chat"
