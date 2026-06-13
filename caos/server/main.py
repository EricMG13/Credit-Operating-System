"""CAOS — single-process Databricks App.

One FastAPI service serves both the JSON API (under /api) and the static
Next.js frontend export (everything else). Databricks Apps handles TLS and
authentication at the platform edge; locally the same process runs with a
dev identity, SQLite, and on-disk storage.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import AsyncSessionLocal, init_db
from engine.fixtures import ensure_reference_deal
from routes import auth, chat, health, ingestion, issuers, runs
from seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("caos")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAOS starting (environment=%s)", settings.environment)
    await init_db()
    if settings.caos_demo_seed:
        await seed_demo_data()
        async with AsyncSessionLocal() as session:
            await ensure_reference_deal(session)
    yield
    logger.info("CAOS shutting down")


app = FastAPI(
    title="Credit Agent OS (CAOS)",
    version="2.0.0",
    description="Credit analysis workspace — Databricks App build.",
    lifespan=lifespan,
)

# ─── API routes ───────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(issuers.router, prefix="/api/issuers", tags=["issuers"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])

# ─── Static frontend (Next.js export) ─────────────────────────────────────
_static = Path(settings.caos_static_dir)
if _static.is_dir():
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="frontend")

    @app.exception_handler(404)
    async def spa_not_found(request: Request, exc):  # type: ignore[no-untyped-def]
        """Serve the exported 404 page for unknown non-API paths."""
        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        not_found = _static / "404.html"
        if not_found.is_file():
            return FileResponse(not_found, status_code=404)
        return JSONResponse({"detail": "Not Found"}, status_code=404)
else:
    logger.warning(
        "Static frontend not found at %s — API-only mode. "
        "Build it with: scripts/build_frontend.sh",
        _static,
    )
