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
from routes import auth, chat, edgar, health, ingestion, issuers, query, runs, scenario
from run_executor import get_executor
from seed import seed_demo_data, seed_demo_documents, seed_metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("caos")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAOS starting (environment=%s)", settings.environment)
    await init_db()
    if settings.caos_demo_seed:
        if settings.environment == "production":
            logger.warning(
                "CAOS_DEMO_SEED is on in production — seeding demo issuers + the ATLF "
                "reference deal into the database. Set CAOS_DEMO_SEED=false for a "
                "non-demo deployment so the registry starts empty."
            )
        await seed_demo_data()
        async with AsyncSessionLocal() as session:
            await ensure_reference_deal(session)
        await seed_demo_documents()  # distinctive source text for cross-issuer semantic query
        await seed_metrics()  # illustrative headline metrics for cross-issuer NL query
    app.state.executor = get_executor()
    await app.state.executor.start()
    logger.info("CAOS run executor started (%s)", app.state.executor.name)
    yield
    await app.state.executor.stop()
    logger.info("CAOS shutting down")


_PROD = settings.environment == "production"
app = FastAPI(
    title="Credit Agent OS (CAOS)",
    version="2.0.0",
    description="Credit analysis workspace — Databricks App build.",
    lifespan=lifespan,
    # Interactive API docs / schema are exploration aids — keep them in dev but
    # close them in production (no reason to publish the API surface there, even
    # behind the authenticated edge).
    docs_url=None if _PROD else "/docs",
    redoc_url=None if _PROD else "/redoc",
    openapi_url=None if _PROD else "/openapi.json",
)

# ─── Security headers ───────────────────────────────────────────────────────
# Applied to every response (API + static). The Next static export ships inline
# bootstrap/RSC scripts and uses inline style attributes throughout, so the CSP
# must allow 'unsafe-inline' for script/style — a static export can't carry a
# per-request nonce. The remaining directives still constrain origins, framing,
# base-uri and form targets. frame-ancestors is 'self'; relax it only if the app
# is ever embedded cross-origin (e.g. inside the Databricks workspace UI).
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'self'"
)
_SECURITY_HEADERS = {
    "Content-Security-Policy": _CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
    response = await call_next(request)
    for key, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(key, value)
    return response


# ─── API routes ───────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(issuers.router, prefix="/api/issuers", tags=["issuers"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
app.include_router(edgar.router, prefix="/api/edgar", tags=["edgar"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(query.router, prefix="/api/query", tags=["query"])
app.include_router(scenario.router, prefix="/api/scenario", tags=["scenario"])

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
