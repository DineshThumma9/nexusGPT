import logging
import os
from typing import Generator

from dotenv import load_dotenv
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

# Import models to register them with SQLModel.metadata
from src.models.models import Session

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None


logger = logging.getLogger("database")
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# Lazy initialization - connect only when needed
engine = None
SessionLocal = None
_connection_failed = False


def _init_db():
    """Initialize database connection on first use"""
    global engine, SessionLocal, _connection_failed

    if engine is not None:
        return  # Already initialized

    if _connection_failed:
        raise RuntimeError("Database connection was already attempted and failed")

    if not DATABASE_URL:
        logger.critical("DATABASE_URL environment variable not set")
        _connection_failed = True
        raise RuntimeError("DATABASE_URL not configured")

    try:
        logger.info("Connecting to database...")
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args={"connect_timeout": 5},
        )
        SessionLocal = sessionmaker(autoflush=False, autocommit=False, bind=engine)
        logger.info("Database connection established")
    except Exception as e:
        logger.critical(f"Failed to connect to database: {str(e)}")
        _connection_failed = True
        raise SystemExit("Database connection failed")


def get_db() -> Generator[Session, None, None]:
    _init_db()
    db = SessionLocal()
    try:
        logger.debug("Database session created")
        yield db
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        raise
    finally:
        logger.debug("Database session closed")
        db.close()


def create_all_tables():
    try:
        _init_db()
        logger.info("Creating database tables")
        SQLModel.metadata.create_all(engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating tables: {str(e)}")
        # Don't raise - let the app start even if table creation fails
        logger.warning("Continuing startup despite table creation failure")
        raise


async def init_checkpointer():
    global _pool, _checkpointer
    _pool = AsyncConnectionPool(
        conninfo=os.getenv("DATABASE_URL"),
        max_size=20,
        max_lifetime=300,
        max_idle=30,
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
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







