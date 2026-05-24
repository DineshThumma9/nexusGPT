import logging
import os

from dotenv import load_dotenv
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_nomic import NomicEmbeddings
from langchain_qdrant import FastEmbedSparse, QdrantVectorStore, RetrievalMode
from langchain_voyageai import VoyageAIEmbeddings
from qdrant_client import AsyncQdrantClient, QdrantClient, models
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    VectorParams,
)

from langchain_community.embeddings import JinaEmbeddings


load_dotenv()

logger = logging.getLogger("qdrant_client")

_client: AsyncQdrantClient | None = None
_sync_client: QdrantClient | None = None

COLLECTION_CODE = "centralGPT_code"  # all code chunks, all users
COLLECTION = (
    "centralGPT"  # all doc/pdf chunks, all users       # alias for compatibility
)
VECTOR_DIM = 768  # depends on your embed model

_dense_embeddings = None
_sparse_embeddings = None
_code_embeddings = None

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_CURRENT_DIR))
FASTEMBED_CACHE_DIR = os.path.join(_PROJECT_ROOT, "storage", "fastembed_cache")


def get_embeddings():
    global _dense_embeddings, _sparse_embeddings
    if _dense_embeddings is None or _sparse_embeddings is None:
        _dense_embeddings = NomicEmbeddings(
            model="nomic-embed-text-v1.5",
            nomic_api_key=os.getenv("NOMIC_API_KEY"),
        )
        _sparse_embeddings = FastEmbedSparse(
            model_name="Qdrant/bm25",
            cache_dir=FASTEMBED_CACHE_DIR,
        )
    return _dense_embeddings, _sparse_embeddings


def get_code_embeddings():
    global _code_embeddings
    if _code_embeddings is None:
        _code_embeddings = VoyageAIEmbeddings(
            model="voyage-code-3", api_key=os.getenv("VOYAGE_API_KEY"), batch_size=1000
        )
    return _code_embeddings


def _get_qdrant_credentials() -> tuple[str | None, str | None]:
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    logger.info(f"URL: {url}")
    logger.info(f"API KEY: {'***' if api_key else 'None'}")
    return url, api_key


def _setup_collections(client: QdrantClient):
    for name in [COLLECTION_CODE, COLLECTION]:
        if not client.collection_exists(name):
            if name == COLLECTION:
                client.create_collection(
                    collection_name=name,
                    vectors_config=models.VectorParams(
                        size=VECTOR_DIM, distance=models.Distance.COSINE
                    ),
                    sparse_vectors_config={
                        "langchain-sparse": models.SparseVectorParams()
                    },
                )
            else:
                client.create_collection(
                    collection_name=name,
                    vectors_config=models.VectorParams(
                        size=1024, distance=models.Distance.COSINE, on_disk=True
                    ),
                    shard_number=4,
                )

            client.create_payload_index(
                collection_name=name,
                field_name="metadata.kb_id",
                field_schema=models.KeywordIndexParams(
                    type=models.PayloadSchemaType.KEYWORD,
                    is_tenant=True,
                ),
            )


async def init_qdrant():
    global _client
    url, api_key = _get_qdrant_credentials()
    _client = AsyncQdrantClient(url=url, api_key=api_key, timeout=90)
    _get_sync_client()


def get_qdrant() -> AsyncQdrantClient:
    return _client


def _get_sync_client() -> QdrantClient:
    global _sync_client
    if _sync_client is None:
        url, api_key = _get_qdrant_credentials()
        _sync_client = QdrantClient(url=url, api_key=api_key, timeout=90)
        _setup_collections(_sync_client)
    return _sync_client


# Lazy wrapper to act as the global vector_db for ingestion
class LazyVectorDB:
    def __getattr__(self, name):
        store = QdrantVectorStore(
            client=_get_sync_client(),
            collection_name=COLLECTION_CODE,
            embedding=get_code_embeddings(),
        )
        return getattr(store, name)


vector_db = LazyVectorDB()


# Namespace-isolated vector store helper — ns = str(kb_id)
def get_user_vector_db(ns: str, source_type: str | None = None):
    collection = (
        COLLECTION
        if source_type and str(source_type).lower() in ["pdf", "url", "notes"]
        else COLLECTION_CODE
    )
    if collection == COLLECTION_CODE:
        store = QdrantVectorStore(
            client=_get_sync_client(),
            collection_name=collection,
            embedding=get_code_embeddings(),
        )
    else:
        dense_emb, sparse_emb = get_embeddings()
        store = QdrantVectorStore(
            client=_get_sync_client(),
            collection_name=collection,
            embedding=dense_emb,
            sparse_embedding=sparse_emb,
            retrieval_mode=RetrievalMode.HYBRID,
        )
    kb_filter = Filter(
        must=[FieldCondition(key="metadata.kb_id", match=MatchValue(value=ns))]
    )

    class FilteredVectorStore:
        def __init__(self, store, kb_filter):
            self.store = store
            self.kb_filter = kb_filter

        def similarity_search(self, query: str, k: int = 4, **kwargs):
            kwargs["filter"] = self.kb_filter
            return self.store.similarity_search(query, k=k, **kwargs)

        async def asimilarity_search(self, query: str, k: int = 4, **kwargs):
            kwargs["filter"] = self.kb_filter
            return await self.store.asimilarity_search(query, k=k, **kwargs)

        def __getattr__(self, name):
            return getattr(self.store, name)

    return FilteredVectorStore(store, kb_filter)
