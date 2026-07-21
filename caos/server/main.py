"""CAOS — single-process app.

One FastAPI service serves both the JSON API (under /api) and the static
Next.js frontend export (everything else). The edge (Caddy + oauth2-proxy)
terminates TLS and authenticates the caller; on top of that, analysts hold a
code-gated in-app profile (routes/auth.py) that supplies the app-level identity.
Locally the same process runs with a dev identity, SQLite, and on-disk storage.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from access_log import access_event, client_source, principal
from config import (
    get_settings,
    is_deployed,
    require_malware_scanner_in_production,
    require_postgres_in_production,
    require_sane_environment,
)
from csrf import csrf_rejection
from database import AsyncSessionLocal, init_db
from engine import presets
from engine.fixtures import ensure_reference_deal
from routes import analysis, analysis_insights, alerts, auth, chat, committee, decisions, digest, edgar, health, ingestion, issuers, market_import, model_v2, model_workbook as model_workbook_routes, models, notifications, opinions, portfolio, portfolios, qa, query, reports, research, runs, rv, scenario, sector, settings as settings_routes, sponsors, thesis, autonomy, watch_rules
from research_executor import get_research_executor
from research_report_executor import get_report_executor
from request_limits import RequestBodyLimitMiddleware
from engine.pipeline_executor import PipelineExecutor
from run_executor import get_executor
from seed import seed_demo_data, seed_demo_documents, seed_metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("caos")
access_logger = logging.getLogger("caos.access")
settings = get_settings()

_MIN_EDGE_SECRET_BYTES = 32
_MIN_SESSION_SECRET_BYTES = 32
_MIN_SIGNUP_CODE_BYTES = 16


def _require_deployed_credential_strength(
    name: str,
    value: str,
    *,
    min_bytes: int,
) -> None:
    """Reject obviously weak operator credentials without exposing their values."""
    try:
        encoded = value.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise RuntimeError(f"{name} must be valid UTF-8.") from exc
    minimum_characters = max(8, min_bytes // 2)
    if (
        len(encoded) < min_bytes
        or len(value) < minimum_characters
        or len(set(value)) < 4
        or value != value.strip()
    ):
        raise RuntimeError(
            f"{name} is too weak for production — use at least {min_bytes} UTF-8 "
            "bytes of randomly generated, non-repeating material with no surrounding "
            "whitespace."
        )


def _observe_warmup_completion(task: asyncio.Task) -> None:
    if task.cancelled():
        return
    try:
        error = task.exception()
    except asyncio.CancelledError:
        return
    if error is not None:
        logger.error(
            "Embeddings warmup task terminated unexpectedly",
            exc_info=(type(error), error, error.__traceback__),
        )


async def _cancel_and_drain(task: asyncio.Task) -> None:
    if not task.done():
        task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def _require_safe_deployment_configuration() -> None:
    """Fail closed before startup work when deployed settings are unsafe."""
    require_sane_environment(settings)
    if not is_deployed(settings):
        require_postgres_in_production(settings)
        require_malware_scanner_in_production(settings)
        return

    if not settings.edge_proxy_secret:
        raise RuntimeError(
            "EDGE_PROXY_SECRET must be set in production — forwarded-identity trust "
            "would otherwise rest on network isolation alone. Set it and have the "
            "edge inject X-Edge-Authorization (the deploy Caddyfile already does). "
            'Generate one with: python -c "import secrets;print(secrets.token_urlsafe(32))"'
        )
    _require_deployed_credential_strength(
        "EDGE_PROXY_SECRET",
        settings.edge_proxy_secret,
        min_bytes=_MIN_EDGE_SECRET_BYTES,
    )
    if settings.session_secret in ("", "dev-insecure-session-secret"):
        raise RuntimeError(
            "SESSION_SECRET must be set to a random value in production — the dev "
            "default lets analyst login cookies be forged. Generate one with: "
            'python -c "import secrets;print(secrets.token_urlsafe(32))"'
        )
    _require_deployed_credential_strength(
        "SESSION_SECRET",
        settings.session_secret,
        min_bytes=_MIN_SESSION_SECRET_BYTES,
    )
    if settings.analyst_signup_code in ("", "131113", "change-me-private-code"):
        raise RuntimeError(
            "ANALYST_SIGNUP_CODE must be set to a private value in production — the "
            "in-source defaults/placeholders are public and would leave analyst "
            "profile self-registration open. Set ANALYST_SIGNUP_CODE."
        )
    _require_deployed_credential_strength(
        "ANALYST_SIGNUP_CODE",
        settings.analyst_signup_code,
        min_bytes=_MIN_SIGNUP_CODE_BYTES,
    )
    if settings.caos_demo_seed:
        raise RuntimeError(
            "CAOS_DEMO_SEED must not be set in production — it would seed fictional "
            "demo issuers + the ATLF reference deal into the production database. "
            "Leave it unset (default off) for a non-demo deployment."
        )
    require_postgres_in_production(settings)
    require_malware_scanner_in_production(settings)
    if not _INLINE_SCRIPT_HASHES:
        raise RuntimeError(
            "The production static export contains no hashable Next.js bootstrap "
            "scripts; refusing to boot with a CSP that would require unsafe-inline."
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAOS starting (environment=%s)", settings.environment)
    _require_safe_deployment_configuration()
    await init_db()
    if settings.caos_demo_seed:
        await seed_demo_data()
        async with AsyncSessionLocal() as session:
            await ensure_reference_deal(session)
        await seed_demo_documents()  # distinctive source text for cross-issuer semantic query
        await seed_metrics()  # illustrative headline metrics for cross-issuer NL query
    app.state.executor = get_executor()
    await app.state.executor.start()
    logger.info("CAOS run executor started (%s)", app.state.executor.name)
    # Durable Deep Research (M-3): background jobs the client polls, swept on boot.
    app.state.research_executor = get_research_executor()
    await app.state.research_executor.start()
    logger.info("CAOS research executor started (%s)", app.state.research_executor.name)
    # Autonomous-pipeline executor (Phase 3 remainder): claims pipeline_runs rows
    # the autonomy route enqueues, runs the Sentinel→Analyst→Reporter cycle off
    # the request thread. Continuously reclaims expired leases after hard crashes.
    app.state.pipeline_executor = PipelineExecutor()
    await app.state.pipeline_executor.start()
    logger.info("CAOS pipeline executor started (%s)", app.state.pipeline_executor.name)
    # Durable Issuer Research Report synthesis: background jobs the client polls,
    # swept on boot. Mirrors ResearchExecutor.
    app.state.research_report_executor = get_report_executor()
    await app.state.research_report_executor.start()
    logger.info("CAOS research report executor started (%s)", app.state.research_report_executor.name)

    async def run_warmup():
        try:
            from engine.embeddings import warmup_embeddings_task
            async with AsyncSessionLocal() as session:
                await warmup_embeddings_task(session)
        except Exception:
            logger.exception("Failed to run embeddings warmup task")

    app.state.embeddings_warmup_task = asyncio.create_task(
        run_warmup(), name="caos-embeddings-warmup"
    )
    app.state.embeddings_warmup_task.add_done_callback(_observe_warmup_completion)

    yield
    await _cancel_and_drain(app.state.embeddings_warmup_task)
    await app.state.pipeline_executor.stop()
    await app.state.research_report_executor.stop()
    await app.state.research_executor.stop()
    await app.state.executor.stop()
    logger.info("CAOS shutting down")


async def set_model_mode(request: Request) -> None:
    """Carry the analyst's model mode (X-Model-Mode header) and query model override (X-Query-Model header) into request context.

    A global dependency, so every in-request /api lane — issuer chat, NL-query
    translate/plan, scenario translate, document extract — runs under the chosen
    TEST/LITE/BALANCED/MAX tier (engine/presets.py). Runs read the mode off the
    persisted Run.model_mode instead, since they execute in a worker task. An
    unknown / missing header normalizes to the default mode."""
    presets.set_mode(request.headers.get("x-model-mode"))
    presets.set_query_model(request.headers.get("x-query-model"))


# Close the interactive API docs in ANY deployed context (not just exact
# "production"), matching the fail-closed posture of the boot guards. (is_deployed)
_PROD = is_deployed(settings)
app = FastAPI(
    title="Credit Agent OS (CAOS)",
    version="2.0.0",
    description="Credit analysis workspace — single-container API + UI.",
    lifespan=lifespan,
    # Resolve the analyst's model mode from X-Model-Mode on every request.
    dependencies=[Depends(set_model_mode)],
    # Interactive API docs / schema are exploration aids — keep them in dev but
    # close them in production (no reason to publish the API surface there, even
    # behind the authenticated edge).
    docs_url=None if _PROD else "/docs",
    redoc_url=None if _PROD else "/redoc",
    openapi_url=None if _PROD else "/openapi.json",
)
# Route validation and per-caller rate limits run after body parsing. Keep JSON
# requests from borrowing the full document-upload allowance, and enforce the
# configured upload ceiling for direct/internal requests that do not cross Caddy.
# Registered first so the existing edge, CSRF, access-log, and security-header
# middleware remain the outer policy/telemetry layers.
app.add_middleware(
    RequestBodyLimitMiddleware,
    default_limit_bytes=settings.max_upload_mb * 1024 * 1024,
)

# ─── Security headers ───────────────────────────────────────────────────────
# Applied to every response (API + static).
_INLINE_SCRIPT_RE = re.compile(
    rb"<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script\s*>",
    re.IGNORECASE | re.DOTALL,
)


def _static_inline_script_hashes(static_dir: Path) -> tuple[str, ...]:
    """CSP hashes for every inline bootstrap block in the static Next export."""
    if not static_dir.is_dir():
        return ()
    hashes: set[str] = set()
    for html_path in static_dir.rglob("*.html"):
        try:
            html = html_path.read_bytes()
        except OSError:
            continue
        for script in _INLINE_SCRIPT_RE.findall(html):
            digest = base64.b64encode(hashlib.sha256(script).digest()).decode("ascii")
            hashes.add(f"'sha256-{digest}'")
    return tuple(sorted(hashes))


_STATIC_DIR = Path(settings.caos_static_dir)
_INLINE_SCRIPT_HASHES = _static_inline_script_hashes(_STATIC_DIR)
_SCRIPT_SRC = " ".join(("'self'", *_INLINE_SCRIPT_HASHES))

# A static export cannot carry per-request nonces. Hash its actual bootstrap
# blocks instead, so executable script no longer needs unsafe-inline. Inline
# style attributes remain necessary for current chart/layout surfaces.
_CSP = (
    "default-src 'self'; "
    f"script-src {_SCRIPT_SRC}; "
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
    # Legacy clickjacking belt for browsers that ignore CSP frame-ancestors; kept
    # in lockstep with it (both 'self'/SAMEORIGIN).
    "X-Frame-Options": "SAMEORIGIN",
    # Switch off powerful browser features the app never uses, so a future XSS or
    # injected iframe can't reach the camera/mic/geolocation/etc. ()=deny for all.
    "Permissions-Policy": (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    ),
    # HSTS deliberately omits `preload`: that's a public-CA, hard-to-reverse
    # browser-list commitment, unsuitable for the internal / self-signed-CA hosts.
}


def _apply_policy_headers(
    message: Message, *, is_api: bool, path: str
) -> tuple[int, int]:
    headers = MutableHeaders(scope=message)
    for key, value in _SECURITY_HEADERS.items():
        if key not in headers:
            headers[key] = value

    if "cache-control" not in headers:
        if is_api:
            headers["Cache-Control"] = "private, no-store"
        elif path.startswith("/_next/static/"):
            headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path == "/" or path.endswith(".html") or "." not in path.rsplit("/", 1)[-1]:
            headers["Cache-Control"] = "no-cache"

    try:
        volume = int(headers.get("content-length", "0"))
    except (TypeError, ValueError):
        volume = 0
    return int(message["status"]), volume


def _edge_request_is_rejected(request: Request, *, is_api: bool, path: str) -> bool:
    current_settings = get_settings()
    return (
        is_deployed(current_settings)
        and bool(current_settings.edge_proxy_secret)
        and is_api
        and path != "/api/health"
        and not hmac.compare_digest(
            request.headers.get("x-edge-authorization", "").encode("utf-8", "ignore"),
            current_settings.edge_proxy_secret.encode("utf-8"),
        )
    )


# ─── Edge-origin guard (single chokepoint) ──────────────────────────────────
# The edge proof (X-Edge-Authorization) must gate EVERY deployed /api request, not
# only those that depend on get_identity. Enforcing it per-route let create_profile
# and logout (which read cookies/headers directly, no get_identity dep) skip the
# check; a future route could too. This middleware closes that — get_identity keeps
# its own (now redundant) check. /api/health is exempt so monitors can probe
# liveness. The raw ASGI policy layer below preserves the prior runtime order:
# access telemetry → CSRF → edge proof → response headers → request limits. (#31)


class HTTPPolicyMiddleware:
    """Apply CAOS HTTP policy without BaseHTTPMiddleware stream/task overhead."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        path = request.url.path
        is_api = path.startswith("/api/")
        started = time.perf_counter() if is_api else 0.0
        response_status = 500
        response_volume = 0

        async def send_with_policy(message: Message) -> None:
            nonlocal response_status, response_volume
            if message["type"] == "http.response.start":
                response_status, response_volume = _apply_policy_headers(
                    message, is_api=is_api, path=path
                )
            await send(message)

        reason = csrf_rejection(request)
        if reason:
            response = JSONResponse({"detail": reason}, status_code=403)
            await response(scope, receive, send_with_policy)
        else:
            if _edge_request_is_rejected(request, is_api=is_api, path=path):
                response = JSONResponse(
                    {"detail": "Request did not carry a valid edge credential."},
                    status_code=401,
                )
                await response(scope, receive, send_with_policy)
            else:
                await self.app(scope, receive, send_with_policy)

        # One structured line per completed API request. Logging after the ASGI
        # app returns makes streaming duration honest without buffering the body.
        if is_api:
            access_logger.info(
                json.dumps(
                    access_event(
                        method=request.method,
                        path=path,
                        status=response_status,
                        entity=principal(request.headers),
                        source=client_source(
                            request.headers,
                            request.client.host if request.client else None,
                        ),
                        volume=response_volume,
                        dur_ms=round((time.perf_counter() - started) * 1000, 1),
                    )
                )
            )


# Registered after RequestBodyLimitMiddleware, so this policy is outermost and
# headers/telemetry cover 413/414 short-circuits from that inner layer.
app.add_middleware(HTTPPolicyMiddleware)


# ─── Error monitoring ───────────────────────────────────────────────────────
# Log-based: every unhandled exception is logged with request context (method,
# path, caller) before a clean 500 goes back. The pilot's monitoring surface is
# `docker compose logs app` (LAUNCH_PHASE1 §8) — no external APM, by design
# (no-paid-services). HTTPException keeps its own handler; this catches the rest.
@app.exception_handler(RequestValidationError)
async def normalize_typed_artifact_validation(request: Request, exc: RequestValidationError):
    """Hide only unsupported typed artifact kinds at the context write boundary.

    Other request validation remains FastAPI's normal 422 response. The custom
    error type is emitted by ContextCreate/ContextPatch before Literal validation,
    so the response never enumerates the closed vocabulary.
    """
    path = request.url.path
    context_write = (
        request.method == "POST" and path == "/api/analysis/contexts"
    ) or (
        request.method == "PATCH"
        and path.startswith("/api/analysis/contexts/")
        and path.count("/") == 4
    )
    if context_write and any(
        error.get("type") == "artifact_not_found" for error in exc.errors()
    ):
        return JSONResponse(
            {"detail": "Artifact not found."},
            status_code=404,
            headers=dict(_SECURITY_HEADERS),
        )
    return await request_validation_exception_handler(request, exc)


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
app.include_router(opinions.router, prefix="/api/issuers", tags=["analyst-opinions"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
app.include_router(edgar.router, prefix="/api/edgar", tags=["edgar"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(model_v2.router, prefix="/api/models", tags=["model-v2"])
app.include_router(model_workbook_routes.router, prefix="/api/models", tags=["model-v2"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(portfolios.router, prefix="/api/portfolios", tags=["portfolios"])
app.include_router(sponsors.router, prefix="/api/sponsors", tags=["sponsors"])
app.include_router(digest.router, prefix="/api/digest", tags=["digest"])
app.include_router(qa.router, prefix="/api/qa", tags=["qa"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(analysis_insights.router, prefix="/api/analysis", tags=["analysis-insights"])
app.include_router(query.router, prefix="/api/query", tags=["query"])
app.include_router(scenario.router, prefix="/api/scenario", tags=["scenario"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(sector.router, prefix="/api/sector", tags=["sector"])
app.include_router(rv.router, prefix="/api/rv", tags=["rv"])
app.include_router(market_import.router, prefix="/api/rv", tags=["rv"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(autonomy.router, prefix="/api/autonomy", tags=["autonomy"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(watch_rules.router, prefix="/api/watch-rules", tags=["watch-rules"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(decisions.router, prefix="/api/decisions", tags=["decisions"])
app.include_router(committee.router, prefix="/api/committee", tags=["committee"])
app.include_router(thesis.router, prefix="/api/thesis", tags=["thesis"])


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
_static = _STATIC_DIR
if _static.is_dir():
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="frontend")

    @app.exception_handler(404)
    async def spa_not_found(request: Request, exc):  # type: ignore[no-untyped-def]
        """Serve the exported 404 page for unknown non-API paths."""
        if request.url.path.startswith("/api/"):
            # Keep the endpoint's own 404 detail ("Issuer not found", "No analyst
            # profile — settings not saved.") — this handler also catches every
            # HTTPException(404) raised inside /api routes, not just unmatched paths.
            detail = getattr(exc, "detail", None) or "Not Found"
            return JSONResponse({"detail": detail}, status_code=404)
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
