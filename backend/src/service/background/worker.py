import logging
import sys

from celery import Celery
from celery.signals import setup_logging, worker_process_init
from loguru import logger

from src.config.settings import settings


class InterceptHandler(logging.Handler):
    def emit(self, record):
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


@setup_logging.connect
def config_loggers(*args, **kwargs):
    logging.basicConfig(handlers=[InterceptHandler()], level=logging.INFO)
    # Remove all existing loguru handlers
    logger.remove()
    # Add stderr handler
    logger.add(sys.stderr, level="INFO")
    # Add file handler
    logger.add("logs/celery.log", rotation="1 MB", retention="10 days", level="INFO")


# Celery App
queue = Celery(
    "app",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["src.service.background.tasks"],
)

queue.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_send_task_events=True,
)


@worker_process_init.connect
def celery_worker_init(*args, **kwargs):
    """Ensure database connections are clean when celery workers fork and initialize Sentry."""
    import asyncio

    import sentry_sdk

    from src.db.dbs import engine
    from src.db.graphdb import init_graph
    from src.db.redisdb import init_redis
    from src.db.vectordb import init_qdrant

    if engine is not None:
        engine.dispose()

    init_redis()
    init_graph(force_reconnect=True)
    asyncio.run(init_qdrant())

    sentry_dsn = settings.sentry_dsn
    if sentry_dsn:
        from sentry_sdk.integrations.celery import CeleryIntegration

        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            integrations=[CeleryIntegration()],
        )
