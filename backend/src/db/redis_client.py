from redis import Redis
from redis.asyncio import Redis as AsyncRedis

from src.config.settings import settings

# Synchronous client (used in Celery tasks, sessions, and sync code)

_sredis, _aredis = None, None


class RedisProxy:
    def __init__(self, is_async=False):
        self.is_async = is_async

    def __getattr__(self, name):
        global _sredis, _aredis
        target = _aredis if self.is_async else _sredis
        if target is None:
            # Lazy initialization for Celery workers or script runners
            # that bypass the FastAPI lifespan hook.
            init_redis()
            target = _aredis if self.is_async else _sredis

        return getattr(target, name)


sredis = RedisProxy(is_async=False)
aredis = RedisProxy(is_async=True)


def init_redis():
    global _sredis, _aredis
    _sredis = Redis.from_url(settings.redis_url)
    _aredis = AsyncRedis.from_url(settings.redis_url)


async def close_redis():
    global _sredis, _aredis
    if _sredis is not None:
        _sredis.close()
    if _aredis is not None:
        await _aredis.aclose()
    _sredis = None
    _aredis = None
