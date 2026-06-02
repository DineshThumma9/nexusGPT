from celery import Celery
from celery.signals import worker_process_init

from src.config.settings import settings

# Celery App
queue = Celery(
    "app",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["src.service.tasks"],
)

queue.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_send_task_events=True,
)


@worker_process_init.connect
def celery_worker_init(*args, **kwargs):
    """Ensure database connections are clean when celery workers fork and initialize Sentry."""
    import sentry_sdk

    from src.db.dbs import engine
    from src.db.neo4j import init_graph
    from src.db.redis_client import init_redis

    if engine is not None:
        engine.dispose()

    init_redis()
    init_graph(force_reconnect=True)

    sentry_dsn = settings.sentry_dsn
    if sentry_dsn:
        from sentry_sdk.integrations.celery import CeleryIntegration

        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            integrations=[CeleryIntegration()],
        )
