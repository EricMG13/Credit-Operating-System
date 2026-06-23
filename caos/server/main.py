"""CAOS — single-process Databricks App.

One FastAPI service serves both the JSON API (under /api) and the static
Next.js frontend export (everything else). The edge (Caddy + oauth2-proxy)
terminates TLS and authenticates the caller; on top of that, analysts hold a
code-gated in-app profile (routes/auth.py) that supplies the app-level identity.
Locally the same process runs with a dev identity, SQLite, and on-disk storage.
"""

from __future__ import annotations

import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from access_log import access_event, client_source, principal
from config import get_settings
from database import AsyncSessionLocal, init_db
from engine.fixtures import ensure_reference_deal
from routes import auth, chat, edgar, health, ingestion, issuers, query, research, runs, scenario, settings as settings_routes
from run_executor import get_executor
from seed import seed_demo_data, seed_demo_documents, seed_metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("caos")
access_logger = logging.getLogger("caos.access")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAOS starting (environment=%s)", settings.environment)
    if settings.environment == "production" and not settings.edge_proxy_secret:
        logger.warning(
            "EDGE_PROXY_SECRET is unset in production — forwarded-identity trust "
            "rests on network isolation alone (no proxy-origin check). Set "
            "EDGE_PROXY_SECRET and have the edge inject X-Edge-Authorization to "
            "enforce that requests came through the proxy. See SECURITY.md §1."
        )
    if settings.environment == "production" and settings.session_secret in ("", "dev-insecure-session-secret"):
        # Fail closed: the dev default is public (in source), so it would let
        # anyone forge an analyst login cookie. Refuse to start without a real one.
        raise RuntimeError(
            "SESSION_SECRET must be set to a random value in production — the dev "
            "default lets analyst login cookies be forged. Generate one with: "
            'python -c "import secrets;print(secrets.token_urlsafe(32))"'
        )
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
    # Static-asset caching: Next's content-hashed bundles are immutable and safe
    # to cache forever; HTML documents must revalidate so a redeploy's new
    # index.html isn't served stale (pointing at chunks that no longer exist). D6.
    path = request.url.path
    if not path.startswith("/api/"):
        if path.startswith("/_next/static/"):
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        elif path == "/" or path.endswith(".html") or "." not in path.rsplit("/", 1)[-1]:
            response.headers.setdefault("Cache-Control", "no-cache")
    return response


# ─── Access log (threat-detection app/auth feed) ────────────────────────────
# One structured JSON line per /api request on `caos.access`. Feeds the
# threat_signal_analyzer anomaly hunt: 401-by-source = brute force, auth_ok-by-
# entity off-hours = account abuse, response-volume-by-entity = bulk pull/exfil.
# /api only — static-asset requests are noise. See access_log.py for the
# jq that extracts the analyzer events schema from these lines.
@app.middleware("http")
async def access_log(request: Request, call_next):  # type: ignore[no-untyped-def]
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)  # static-asset requests are noise — no timing/log
    start = time.perf_counter()
    response = await call_next(request)
    try:
        volume = int(response.headers.get("content-length", 0))
    except (TypeError, ValueError):
        volume = 0  # streaming/chunked responses omit Content-Length
    access_logger.info(json.dumps(access_event(
        method=request.method,
        path=path,
        status=response.status_code,
        entity=principal(request.headers),
        source=client_source(request.headers, request.client.host if request.client else None),
        volume=volume,
        dur_ms=round((time.perf_counter() - start) * 1000, 1),
    )))
    return response


# ─── Error monitoring ───────────────────────────────────────────────────────
# Log-based: every unhandled exception is logged with request context (method,
# path, caller) before a clean 500 goes back. The pilot's monitoring surface is
# `docker compose logs app` (LAUNCH_PHASE1 §8) — no external APM, by design
# (no-paid-services). HTTPException keeps its own handler; this catches the rest.
@app.exception_handler(Exception)
async def log_unhandled(request: Request, exc: Exception):  # type: ignore[no-untyped-def]
    logger.exception(
        "unhandled exception: %s %s (caller=%s)",
        request.method,
        request.url.path,
        principal(request.headers),  # same canonical caller id as the access log
    )
    return JSONResponse({"detail": "Internal Server Error"}, status_code=500)


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
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])


# Unmatched /api/* → JSON 404. Must sit before the "/" StaticFiles mount: that
# mount is a sub-app whose own 404 (404.html) bypasses our exception_handler, so
# without this an unknown API path returns the SPA HTML and logs a large access
# `volume`. ponytail: catch-all route beats the mount by registration order.
@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
)
async def api_not_found(path: str):  # type: ignore[no-untyped-def]
    return JSONResponse({"detail": "Not Found"}, status_code=404)


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
