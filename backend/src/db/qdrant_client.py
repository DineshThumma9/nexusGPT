import os

from dotenv import load_dotenv
from langchain_nomic import NomicEmbeddings
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from langchain_voyageai import VoyageAIEmbeddings
from loguru import logger
from qdrant_client import AsyncQdrantClient, QdrantClient, models
from qdrant_client.models import (
    FieldCondition,
    Filter,
    MatchValue,
)

from src.config.settings import settings

_client: AsyncQdrantClient | None = None
_sync_client: QdrantClient | None = None

COLLECTION_CODE = "centralGPT_code"
COLLECTION = "centralGPT"
VECTOR_DIM = 768

_dense_embeddings = None
_sparse_embeddings = None
_code_embeddings = None


def get_embeddings():
    global _dense_embeddings
    if _dense_embeddings is None:
        _dense_embeddings = NomicEmbeddings(
            model=settings.nomic_embedding_model,
            nomic_api_key=settings.nomic_api_key,
        )
    return _dense_embeddings


def get_code_embeddings():
    global _code_embeddings
    if _code_embeddings is None:
        _code_embeddings = VoyageAIEmbeddings(
            model=settings.voyage_embedding_model,
            api_key=settings.voyage_api_key,
            batch_size=1000,
        )
    return _code_embeddings


def _setup_collections(client: QdrantClient):
    for name in [COLLECTION_CODE, COLLECTION]:
        if not client.collection_exists(name):
            if name == COLLECTION:
                client.create_collection(
                    collection_name=name,
                    vectors_config=models.VectorParams(
                        size=VECTOR_DIM, distance=models.Distance.COSINE
                    ),
                )
            else:
                client.create_collection(
                    collection_name=name,
                    vectors_config=models.VectorParams(
                        size=1024, distance=models.Distance.COSINE
                    ),
                    shard_number=1,
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
    _client = AsyncQdrantClient(
        url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=90
    )
    _get_sync_client()


def get_qdrant() -> AsyncQdrantClient:
    return _client


def _get_sync_client() -> QdrantClient:
    global _sync_client
    if _sync_client is None:
        _sync_client = QdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=90
        )
        _setup_collections(_sync_client)
    return _sync_client


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
        dense_emb = get_embeddings()
        store = QdrantVectorStore(
            client=_get_sync_client(),
            collection_name=collection,
            embedding=dense_emb,
            retrieval_mode=RetrievalMode.DENSE,
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
