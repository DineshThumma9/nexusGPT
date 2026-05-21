from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import FastEmbedSparse

_dense_embeddings = FastEmbedEmbeddings(
    model_name="nomic-ai/nomic-embed-text-v1.5",
    max_length=512,
    cache_dir="/home/dinesh/Desktop/projects/centralGPT/centralGPT-backend/storage/fastembed_cache",
    batch_size=300,
    parallel=0,
    threads=None,
)


_sparse_embeddings = FastEmbedSparse(
    model_name="Qdrant/bm25",
    cache_dir="/home/dinesh/Desktop/projects/centralGPT/centralGPT-backend/storage/fastembed_cache",
)


_code_embeddings = FastEmbedEmbeddings(
    model_name="jinaai/jina-embeddings-v2-base-code",
    max_length=4096,
    cache_dir="/home/dinesh/Desktop/projects/centralGPT/centralGPT-backend/storage/fastembed_cache",
    parallel=-0,
    threads=None,
)
