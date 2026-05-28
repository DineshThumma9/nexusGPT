import logging
import os
import time
from contextlib import asynccontextmanager

import sentry_sdk
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request

from src.db.dbs import close_checkpointer, create_all_tables, init_checkpointer
from src.db.qdrant_client import init_qdrant
from src.router import (
    auth_router,
    basic_router,
    message_router,
    rag_router,
    session_router,
)
from src.router.limiter import limiter

# ---------------------------------------------------------
# 1. Configuration & Global Setup
# ---------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "../logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    filename=os.path.join(LOG_DIR, "app.log"),
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger.add("logs/api.log", rotation="1 MB", retention="10 days", level="INFO")

sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    try:
        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
        )
        logger.info("Sentry monitoring initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Sentry: {e}")
else:
    logger.info("Sentry monitoring disabled (SENTRY_DSN not configured)")


# ---------------------------------------------------------
# 2. Application Lifespan
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_all_tables()
    await init_checkpointer()
    try:
        await init_qdrant()
        logger.info("Qdrant initialized and collections verified")
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant collections: {e}")
    yield
    await close_checkpointer()


# ---------------------------------------------------------
# 3. App Initialization
# ---------------------------------------------------------
app = FastAPI(
    title="CentralGPT API",
    description="Backend services for CentralGPT",
    version="1.0.0",
    lifespan=lifespan,
)

logger.info("Server application initialized")

# ---------------------------------------------------------
# 4. Exception Handlers & Rate Limiting
# ---------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------
# 5. Middlewares
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://central-gpt.vercel.app",
        "https://central-gpt-frontend.vercel.app",
        "https://main.d2r3zpg0x741h8.amplifyapp.com",
        "https://centralgpt.app",
        "https://www.centralgpt.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)"
    )
    return response


# ---------------------------------------------------------
# 6. Routers
# ---------------------------------------------------------
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(basic_router, prefix="/setup", tags=["Chat API"])
app.include_router(session_router, prefix="/sessions", tags=["Session"])
app.include_router(message_router, prefix="/messages", tags=["Message"])
app.include_router(rag_router, prefix="/rag", tags=["Rag"])


# ---------------------------------------------------------
# 7. Base Routes
# ---------------------------------------------------------
@app.get("/")
@app.get("/health")
async def root():
    return {"message": "API is running"}


# ---------------------------------------------------------
# 8. Execution
# ---------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run("src.main:app", port=port, reload=True, log_level="info")
