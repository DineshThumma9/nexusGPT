import asyncio
import json
import os
from typing import List
from uuid import UUID

from langchain_community.document_loaders import PyPDFLoader
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.db.dbs import get_db
from src.db.qdrant_client import (
    COLLECTION,
    _get_sync_client,
    get_embeddings,
)
from src.db.redis_client import queue, redis
from src.models.enums import KBStatus
from src.models.models import KnowledgeBase
from src.models.schema import GitRequest
from src.service.ingesation import (
    build_hierarchy,
    build_relation_and_index,
    fetch_repo,
    insert_to_databases,
)


def update_kb(kb_id, status):

    # Update Postgres status to INDEXING
    db_gen = get_db()
    db = next(db_gen)
    try:
        kb = db.query(KnowledgeBase).filter_by(kb_id=UUID(kb_id)).first()
        if kb:
            kb.status = status
            db.add(kb)
            db.commit()
    except Exception as dbe:
        print(f"Error updating Postgres KB status to INDEXING: {dbe}")
    finally:
        db_gen.close()


@queue.task(time_limit=3600)
def ingest_git_repo_task(req_dict: dict, kb_id: str):
    """Celery background task to fully ingest a Github repository."""
    redis.set(f"kb:{kb_id}:status", json.dumps({"status": "processing", "detail": "Indexing initialized..."}), ex=86400)
    update_kb(kb_id=kb_id, status=KBStatus.INDEXING)

    try:
        req = GitRequest(**req_dict)

        # 1. FETCHING
        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "processing", "detail": "Fetching repo..."}), ex=86400)

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
        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "processing", "detail": "Analyzing structure..."}), ex=86400)
        enriched_docs = build_hierarchy(documents)

        # 3. SPLITTING AND PARSING AST
        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "processing", "detail": "Parsing code chunks..."}), ex=86400)
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
        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "processing", "detail": "Uploading to databases..."}), ex=86400)
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
        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "ready", "detail": "Ingestion complete"}), ex=86400)
        update_kb(kb_id=kb_id, status=KBStatus.READY)

        print(f"Ingestion pipeline completed successfully for Git KB: {kb_id}")

    except Exception as e:
        import traceback

        traceback.print_exc()

        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "failed", "detail": str(e)}), ex=86400)

        update_kb(kb_id, KBStatus.FAILED)

        raise e



from langchain_community.document_loaders import DirectoryLoader
from langchain_community.document_loaders import TextLoader, UnstructuredWordDocumentLoader, UnstructuredPowerPointLoader, PyPDFLoader

# Map file extensions to their respective LangChain loader classes
map_loaders = {
    ".txt": TextLoader,
    ".docx": UnstructuredWordDocumentLoader,
    ".doc": UnstructuredWordDocumentLoader,
    ".pptx": UnstructuredPowerPointLoader,
    ".ppt": UnstructuredPowerPointLoader,
    ".pdf": PyPDFLoader
}

@queue.task(time_limit=120)
def ingest_pdf_task(file_paths: List[str], kb_id: str):
    """Celery background task to fully ingest uploaded PDF files."""
    ns = str(kb_id)
    redis.set(f"kb:{kb_id}:status", json.dumps({"status": "processing", "detail": "Indexing initialized..."}), ex=86400)
    update_kb(kb_id=kb_id, status=KBStatus.INDEXING)

    try:
        all_nodes = []
        for file_path in file_paths:
            print(f"Ingesting PDF file path: {file_path}")
            

            file_ext = os.path.splitext(file_path)[1].lower()
            LoaderClass = map_loaders.get(file_ext)
            if not LoaderClass:
                print(f"Skipping unsupported file extension: {file_ext}")
                continue
            
            loader = LoaderClass(file_path)



            splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=24)
            nodes = loader.load_and_split(splitter)

            for node in nodes:
                node.metadata["kb_id"] = ns
                node.metadata["source"] = os.path.basename(file_path)

            all_nodes.extend(nodes)

        if all_nodes:
            print(
                f"Upserting {len(all_nodes)} PDF chunks to Qdrant under namespace {ns}..."
            )
            dense_emb, sparse_emb = get_embeddings()
            store = QdrantVectorStore(
                client=_get_sync_client(),
                collection_name=COLLECTION,
                embedding=dense_emb,
                sparse_embedding=sparse_emb,
                retrieval_mode=RetrievalMode.HYBRID,
            )
            store.add_documents(all_nodes)

        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "ready", "detail": "Ingestion complete"}), ex=86400)
        update_kb(kb_id=kb_id, status=KBStatus.READY)

    except Exception as e:
        import traceback

        traceback.print_exc()

        redis.set(f"kb:{kb_id}:status", json.dumps({"status": "failed", "detail": str(e)}), ex=86400)
        update_kb(kb_id=kb_id, status=KBStatus.FAILED)
        raise e
