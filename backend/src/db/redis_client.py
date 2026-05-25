import os

from celery import Celery
from dotenv import load_dotenv
from redis import Redis
from redis.asyncio import Redis as AsyncRedis

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Synchronous client (used in Celery tasks, sessions, and sync code)
redis = Redis.from_url(REDIS_URL)

# Asynchronous client (used in async FastAPI routes / RAG status check)
redis_client = AsyncRedis.from_url(REDIS_URL)

# Celery App
queue = Celery(
    "app",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["src.service.tasks", "src.router.sessions"],
)
