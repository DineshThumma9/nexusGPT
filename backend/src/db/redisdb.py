import threading

from redis import Redis
from redis.asyncio import Redis as AsyncRedis

from src.config.settings import settings

_sredis, _aredis = None, None
_redis_init_attempted = False
_redis_lock = threading.Lock()


class RedisProxy:
    def __init__(self, is_async=False):
        self.is_async = is_async

    def __getattr__(self, name):
        global _sredis, _aredis, _redis_init_attempted
        target = _aredis if self.is_async else _sredis
        if target is None:
            with _redis_lock:
                target = _aredis if self.is_async else _sredis
                if target is None:
                    if not _redis_init_attempted:
                        _redis_init_attempted = True
                        init_redis()
                        target = _aredis if self.is_async else _sredis
                    else:
                        raise RuntimeError(
                            "Redis initialization failed previously or is unavailable"
                        )

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
