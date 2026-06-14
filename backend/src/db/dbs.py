from contextlib import contextmanager

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from loguru import logger
from psycopg_pool import AsyncConnectionPool
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from src.config.settings import settings

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None


engine = None
async_engine = None
SessionLocal = None
AsyncSessionLocal = None
_connection_failed = False


def _init_db():
    """Initialize database connection on first use"""
    global engine, async_engine, SessionLocal, AsyncSessionLocal, _connection_failed

    if engine is not None:
        return

    if _connection_failed:
        raise RuntimeError("Database connection was already attempted and failed")

    if not settings.database_url:
        logger.critical("DATABASE_URL environment variable not set")
        _connection_failed = True
        raise RuntimeError("DATABASE_URL not configured")

    try:
        logger.info("Connecting to database...")
        engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_recycle=settings.db_pool_recycle,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            connect_args={"connect_timeout": 5},
        )
        # psycopg requires the postgresql+psycopg:// scheme for async operations
        async_url = settings.database_url.replace(
            "postgresql://", "postgresql+psycopg://", 1
        )
        async_engine = create_async_engine(
            async_url,
            pool_pre_ping=True,
            pool_recycle=settings.db_pool_recycle,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            connect_args={"prepare_threshold": None},
        )
        SessionLocal = sessionmaker(autoflush=False, autocommit=False, bind=engine)
        AsyncSessionLocal = async_sessionmaker(
            async_engine, class_=AsyncSession, expire_on_commit=False
        )
        logger.info("Database connection established")
    except Exception as e:
        logger.critical(f"Failed to connect to database: {str(e)}")
        _connection_failed = True
        raise SystemExit("Database connection failed")


async def get_db():
    _init_db()
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database error: {e}")
            raise


@contextmanager
def get_task_db():
    _init_db()  # Celery workers don't go through lifespan, so init lazily here
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def create_all_tables():
    # Ensure engine is initialised before using it
    _init_db()
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def init_checkpointer():
    global _pool, _checkpointer
    _pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        max_size=settings.db_checkpointer_pool_size,
        max_lifetime=300,
        max_idle=30,
        kwargs={
            "autocommit": True,
            "prepare_threshold": None,
            "keepalives": 1,
            "keepalives_idle": 10,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
        check=AsyncConnectionPool.check_connection,
        open=False,
    )
    await _pool.open()
    _checkpointer = AsyncPostgresSaver(_pool)
    await _checkpointer.setup()


def get_checkpointer() -> AsyncPostgresSaver:
    return _checkpointer


async def close_checkpointer():
    if _pool:
        await _pool.close()
