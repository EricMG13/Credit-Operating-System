"""
CAOS FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from api.routes import agents, auth, chat, health, ingestion, issuers, webhooks
from core.config import get_settings
from db.session import engine

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAOS starting up", environment=settings.environment)
    # Schema lives in infra/postgres/init.sql (dev, via docker-entrypoint)
    # and Alembic migrations (staging/prod). We deliberately do NOT call
    # Base.metadata.create_all because the ORM omits the pgvector `embedding`
    # column and would create document_chunks without it.
    yield
    logger.info("CAOS shutting down")
    await engine.dispose()


app = FastAPI(
    title="Credit Agent OS (CAOS)",
    version="1.0.0",
    description="Enterprise-grade multi-agent credit analysis platform.",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────
# Allowed origins come from CAOS_ALLOWED_ORIGINS (comma-separated). In dev,
# http://localhost:3000 is always permitted so the Next.js app works out of
# the box. Refuse to start in prod without any configured origin.
_configured_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
if settings.environment == "development":
    _cors_origins = list({"http://localhost:3000", *_configured_origins})
else:
    _cors_origins = _configured_origins
    if not _cors_origins:
        raise RuntimeError(
            "CAOS_ALLOWED_ORIGINS must be set in non-development environments."
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Prometheus metrics ────────────────────────────────────────────────────
Instrumentator().instrument(app).expose(app)

# ─── Routes ───────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(issuers.router, prefix="/api/issuers", tags=["issuers"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
