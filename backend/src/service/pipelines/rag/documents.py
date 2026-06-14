import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredPowerPointLoader,
    UnstructuredWordDocumentLoader,
)
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from langchain_text_splitters import RecursiveCharacterTextSplitter
from loguru import logger

from src.db.vectordb import COLLECTION, _get_sync_client, get_embeddings
from src.service.s3 import S3Service


class RAGPipeline:
    """Parallel document ingestion pipeline: S3 → parse → chunk → Qdrant."""

    LOADERS = {
        ".txt": TextLoader,
        ".docx": UnstructuredWordDocumentLoader,
        ".doc": UnstructuredWordDocumentLoader,
        ".pptx": UnstructuredPowerPointLoader,
        ".ppt": UnstructuredPowerPointLoader,
        ".pdf": PyPDFLoader,
    }

    def __init__(self, kb_id: str):
        self.kb_id = kb_id
        self.ns = str(kb_id)
        self.s3 = S3Service()
        self.store = QdrantVectorStore(
            client=_get_sync_client(),
            collection_name=COLLECTION,
            embedding=get_embeddings(),
            retrieval_mode=RetrievalMode.DENSE,
        )

    # ------------------------------------------------------------------
    # Stage 1 — Download
    # ------------------------------------------------------------------

    def download_single_file(self, s3_key: str) -> tuple[str, str]:
        """Download one S3 object to a temp file. Returns (tmp_path, s3_key)."""
        tmp_path = self.s3.download_s3_to_tempfile(s3_key)
        logger.info(f"Downloaded: {s3_key} → {tmp_path}")
        return tmp_path, s3_key

    def download_files(
        self, s3_keys: list[str], workers: int = 4
    ) -> list[tuple[str, str]]:
        """Parallel S3 download. Returns list of (tmp_path, s3_key) tuples."""
        logger.info(f"Downloading {len(s3_keys)} files with {workers} workers")
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(self.download_single_file, key): key for key in s3_keys
            }
            results = []
            for future in as_completed(futures):
                s3_key = futures[future]
                try:
                    results.append(future.result())
                except Exception as e:
                    logger.error(f"Download failed for {s3_key}: {e}")
        return results

    # ------------------------------------------------------------------
    # Stage 2 — Parse
    # ------------------------------------------------------------------

    def parse_single_file(self, tmp_path: str, s3_key: str) -> list:
        """Load one file with the right loader. Cleans up tmp file after."""
        ext = os.path.splitext(s3_key)[1].lower()
        LoaderClass = self.LOADERS.get(ext)
        if not LoaderClass:
            logger.info(f"Skipping unsupported extension: {ext} ({s3_key})")
            return []
        try:
            docs = LoaderClass(tmp_path).load()
            for doc in docs:
                doc.metadata["source"] = os.path.basename(s3_key)
            logger.info(f"Parsed {len(docs)} pages from {s3_key}")
            return docs
        except Exception as e:
            logger.error(f"Parse failed for {s3_key}: {e}")
            return []
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def parser(self, downloaded: list[tuple[str, str]], workers: int = 4) -> list:
        """Parallel parse of all downloaded files. Returns flat doc list."""
        logger.info(f"Parsing {len(downloaded)} files with {workers} workers")
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(self.parse_single_file, tmp, key): key
                for tmp, key in downloaded
            }
            all_docs = []
            for future in as_completed(futures):
                s3_key = futures[future]
                try:
                    all_docs.extend(future.result())
                except Exception as e:
                    logger.error(f"Parser future failed for {s3_key}: {e}")
        logger.info(f"Total pages parsed: {len(all_docs)}")
        return all_docs

    # ------------------------------------------------------------------
    # Stage 3 — Chunk
    # ------------------------------------------------------------------

    def chunk(self, docs: list, chunk_size: int = 512, chunk_overlap: int = 24) -> list:
        """Split docs into chunks and stamp each with the kb namespace."""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )
        chunks = splitter.split_documents(docs)
        for c in chunks:
            c.metadata["kb_id"] = self.ns
        logger.info(f"Chunked into {len(chunks)} segments (ns={self.ns})")
        return chunks

    # ------------------------------------------------------------------
    # Stage 4 — Embed & index
    # ------------------------------------------------------------------

    def embed_index(self, chunks: list) -> None:
        """Upsert chunks to Qdrant."""
        if not chunks:
            logger.warning(f"No chunks to index for kb={self.kb_id}")
            return
        logger.info(f"Upserting {len(chunks)} chunks to Qdrant (ns={self.ns})")
        self.store.add_documents(chunks)

    # ------------------------------------------------------------------
    # Orchestrator
    # ------------------------------------------------------------------

    def run(self, s3_keys: list[str], workers: int = 4) -> int:
        """
        Full pipeline: download → parse → chunk → index.
        Returns the number of chunks indexed.
        """
        logger.info(f"RAG pipeline start — kb={self.kb_id}, files={len(s3_keys)}")

        downloaded = self.download_files(s3_keys, workers=workers)
        docs = self.parser(downloaded, workers=workers)
        chunks = self.chunk(docs)
        self.embed_index(chunks)

        logger.info(
            f"RAG pipeline done — {len(chunks)} chunks indexed for kb={self.kb_id}"
        )
        return len(chunks)
