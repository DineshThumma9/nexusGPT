import os

from celery import Celery
from celery.signals import worker_process_init

from src.db.redis_client import REDIS_URL

# Celery App
queue = Celery(
    "app",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["src.service.tasks"],
)


@worker_process_init.connect
def celery_worker_init(*args, **kwargs):
    """Ensure database connections are clean when celery workers fork and initialize Sentry."""
    import sentry_sdk

    from src.db.dbs import engine

    if engine is not None:
        engine.dispose()

    sentry_dsn = os.getenv("SENTRY_DSN")
    if sentry_dsn:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration

        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            integrations=[CeleryIntegration()],
        )
