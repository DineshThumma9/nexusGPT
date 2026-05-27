import asyncio
import json
import logging
import os
from datetime import datetime
from typing import List
from uuid import UUID

from celery.signals import worker_process_init
from langchain_community.document_loaders import (
    DirectoryLoader,
    PyPDFLoader,
    TextLoader,
    UnstructuredPowerPointLoader,
    UnstructuredWordDocumentLoader,
)
from langchain_groq import ChatGroq as Groq
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel, Field
from sqlmodel import select

from src.db import dbs
from src.db.dbs import SessionLocal, get_db
from src.db.qdrant_client import (
    COLLECTION,
    _get_sync_client,
    get_embeddings,
)
from src.db.redis_client import queue, redis
from src.models.enums import KBStatus
from src.models.models import KnowledgeBase
from src.models.models import Session as SessionModel
from src.models.schema import GitRequest
from src.service.ingesation import (
    build_hierarchy,
    build_relation_and_index,
    fetch_repo,
    insert_to_databases,
)
from src.service.prompt import title_prompt


@worker_process_init.connect
def celery_worker_init(*args, **kwargs):
    """Ensure database connections are clean when celery workers fork and initialize Sentry."""
    import sentry_sdk

    from src.db.dbs import engine

    if engine is not None:
        engine.dispose()

    sentry_dsn = os.getenv("SENTRY_DSN")
    if sentry_dsn:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration

        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            integrations=[CeleryIntegration()],
        )


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


logger = logging.getLogger()


@queue.task(time_limit=60)
def update_session(
    session_id: str, title: str, user_id: str
):  # FIXED: Changed from 'async def' to standard 'def'

    dbs._init_db()
    db = dbs.SessionLocal()
    try:
        session_uuid = UUID(session_id)
        session_query = select(SessionModel).where(
            SessionModel.session_id == session_uuid
        )
        session = db.execute(session_query).scalars().first()

        if session and session.title == "New Chat":
            session.title = title
            session.updated_at = datetime.utcnow()
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


class Title(BaseModel):
    title: str = Field(description="Title of the session .Be Consise and Precise.")


@queue.task(time_limit=60)
def session_title_gen(query: str, session_id: str, user_id: str):
    try:
        model = Groq(
            model=os.getenv("TITLE_MODEL"), api_key=os.getenv("GROQ_API_KEY")
        ).with_structured_output(Title)

        session_title = model.invoke(title_prompt.format(query=query))

        if isinstance(session_title, Title):
            result = session_title.title
        else:
            result = getattr(session_title, "content", str(session_title))

        cleaned_title = "New Chat"
        if result:
            cleaned_title = result.strip().strip('"').strip("'")
            if not cleaned_title or len(cleaned_title) == 0:
                cleaned_title = "New Chat"

        # Save the generated title using the existing update_session logic
        update_session(session_id, cleaned_title, user_id)
        return cleaned_title

    except Exception as e:
        logger.error(f"Error in session_title_gen: {e}")
        # In case of failure, don't update anything so we can potentially try again later, or just return default
        return "New Chat"


@queue.task(time_limit=3600)
def ingest_git_repo_task(
    req_dict: dict, kb_id: str, session_id: str = None, user_id: str = None
):
    """Celery background task to fully ingest a Github repository."""
    redis.set(
        f"kb:{kb_id}:status",
        json.dumps({"status": "processing", "detail": "Indexing initialized..."}),
        ex=86400,
    )
    update_kb(kb_id=kb_id, status=KBStatus.INDEXING)

    try:
        req = GitRequest(**req_dict)

        # 1. FETCHING
        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "processing", "detail": "Fetching repo..."}),
            ex=86400,
        )

        # Run async Github fetch synchronously inside Celery worker
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, fetch_repo(req))
                documents = future.result()
        else:
            documents = asyncio.run(fetch_repo(req))

        if not documents:
            raise ValueError(
                f"No documents fetched from repository {req.owner}/{req.repo}. Check repository name, branch, and permissions."
            )

        # 2. BUILDING HIERARCHY
        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "processing", "detail": "Analyzing structure..."}),
            ex=86400,
        )
        enriched_docs = build_hierarchy(documents)

        # 3. SPLITTING AND PARSING AST
        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "processing", "detail": "Parsing code chunks..."}),
            ex=86400,
        )
        (
            batch_files,
            batch_file_dir_relations,
            batch_directories,
            batch_dir_relations,
            batch_imports,
            batch_symbols,
            ast_docs,
        ) = build_relation_and_index(enriched_docs)

        # 4. INDEXING TO DATABASES (Neo4j & Qdrant)
        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "processing", "detail": "Uploading to databases..."}),
            ex=86400,
        )
        insert_to_databases(
            kb_id=kb_id,
            batch_directories=batch_directories,
            batch_dir_relations=batch_dir_relations,
            batch_files=batch_files,
            batch_file_dir_relations=batch_file_dir_relations,
            batch_imports=batch_imports,
            batch_symbols=batch_symbols,
            ast_docs=ast_docs,
        )

        # 5. READY
        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "ready", "detail": "Ingestion complete"}),
            ex=86400,
        )
        update_kb(kb_id=kb_id, status=KBStatus.READY)

        update_session.delay(
            session_id=session_id, title=f"{req.owner}/{req.repo} Repo", user_id=user_id
        )

        print(f"Ingestion pipeline completed successfully for Git KB: {kb_id}")

    except Exception as e:
        import traceback

        traceback.print_exc()

        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "failed", "detail": str(e)}),
            ex=86400,
        )

        update_kb(kb_id, KBStatus.FAILED)

        raise e


# Map file extensions to their respective LangChain loader classes
map_loaders = {
    ".txt": TextLoader,
    ".docx": UnstructuredWordDocumentLoader,
    ".doc": UnstructuredWordDocumentLoader,
    ".pptx": UnstructuredPowerPointLoader,
    ".ppt": UnstructuredPowerPointLoader,
    ".pdf": PyPDFLoader,
}


@queue.task(time_limit=120)
def ingest_pdf_task(
    file_paths: List[str], kb_id: str, session_id: str = None, user_id: str = None
):
    """Celery background task to fully ingest uploaded PDF files."""
    ns = str(kb_id)
    redis.set(
        f"kb:{kb_id}:status",
        json.dumps({"status": "processing", "detail": "Indexing initialized..."}),
        ex=86400,
    )
    update_kb(kb_id=kb_id, status=KBStatus.INDEXING)

    try:
        all_nodes = []
        from src.service.s3 import download_s3_to_tempfile

        for s3_key in file_paths:
            print(f"Downloading PDF from S3: {s3_key}")

            file_ext = os.path.splitext(s3_key)[1].lower()
            LoaderClass = map_loaders.get(file_ext)
            if not LoaderClass:
                print(f"Skipping unsupported file extension: {file_ext}")
                continue

            tmp_path = download_s3_to_tempfile(s3_key)
            try:
                loader = LoaderClass(tmp_path)
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=512, chunk_overlap=24
                )
                nodes = loader.load_and_split(splitter)

                for node in nodes:
                    node.metadata["kb_id"] = ns
                    node.metadata["source"] = os.path.basename(s3_key)

                all_nodes.extend(nodes)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        if all_nodes:
            print(
                f"Upserting {len(all_nodes)} PDF chunks to Qdrant under namespace {ns}..."
            )
            dense_emb = get_embeddings()
            store = QdrantVectorStore(
                client=_get_sync_client(),
                collection_name=COLLECTION,
                embedding=dense_emb,
                retrieval_mode=RetrievalMode.DENSE,
            )
            store.add_documents(all_nodes)

        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "ready", "detail": "Ingestion complete"}),
            ex=86400,
        )
        update_kb(kb_id=kb_id, status=KBStatus.READY)

        first_file = os.path.basename(file_paths[0]) if file_paths else "PDF Upload"
        update_session.delay(session_id=session_id, title=first_file, user_id=user_id)

    except Exception as e:
        import traceback

        traceback.print_exc()

        redis.set(
            f"kb:{kb_id}:status",
            json.dumps({"status": "failed", "detail": str(e)}),
            ex=86400,
        )
        update_kb(kb_id=kb_id, status=KBStatus.FAILED)
        raise e
