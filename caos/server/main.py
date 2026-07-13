"""CAOS — single-process app.

One FastAPI service serves both the JSON API (under /api) and the static
Next.js frontend export (everything else). The edge (Caddy + oauth2-proxy)
terminates TLS and authenticates the caller; on top of that, analysts hold a
code-gated in-app profile (routes/auth.py) that supplies the app-level identity.
Locally the same process runs with a dev identity, SQLite, and on-disk storage.
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from access_log import access_event, client_source, principal
from config import get_settings, is_deployed, require_postgres_in_production, require_sane_environment
from database import AsyncSessionLocal, init_db
from engine import presets
from engine.fixtures import ensure_reference_deal
from routes import analysis, analysis_insights, alerts, auth, chat, committee, decisions, digest, edgar, health, ingestion, issuers, models, portfolio, portfolios, qa, query, reports, research, runs, rv, scenario, sector, settings as settings_routes, sponsors, thesis, autonomy
from research_executor import get_research_executor
from research_report_executor import get_report_executor
from engine.pipeline_executor import PipelineExecutor
from run_executor import get_executor
from seed import seed_demo_data, seed_demo_documents, seed_metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("caos")
access_logger = logging.getLogger("caos.access")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAOS starting (environment=%s)", settings.environment)
    # Refuse a real deployment left on the dev ENVIRONMENT sentinel (which would
    # silently re-enable the dev identity fallback + public defaults). See config.
    require_sane_environment(settings)
    # Fail-closed boot guards key on is_deployed (any ENVIRONMENT != "development",
    # typo/unset included), not the exact string "production" — a mistyped or
    # dropped env value must NOT silently disable the secret / signup-code guards.
    if is_deployed(settings) and not settings.edge_proxy_secret:
        # Fail closed (was warn-only): without the edge secret the app trusts the
        # X-Forwarded-* identity headers on network isolation alone, so a rogue
        # container on the internal net could hit app:8000 directly with forged
        # identity. The deploy edge (Caddy) already injects X-Edge-Authorization
        # and compose passes EDGE_PROXY_SECRET to both, so a prod boot without it
        # is a misconfiguration — same posture as the SESSION_SECRET guard below.
        raise RuntimeError(
            "EDGE_PROXY_SECRET must be set in production — forwarded-identity trust "
            "would otherwise rest on network isolation alone. Set it and have the "
            "edge inject X-Edge-Authorization (the deploy Caddyfile already does). "
            'Generate one with: python -c "import secrets;print(secrets.token_urlsafe(32))"'
        )
    if is_deployed(settings) and settings.session_secret in ("", "dev-insecure-session-secret"):
        # Fail closed: the dev default is public (in source), so it would let
        # anyone forge an analyst login cookie. Refuse to start without a real one.
        raise RuntimeError(
            "SESSION_SECRET must be set to a random value in production — the dev "
            "default lets analyst login cookies be forged. Generate one with: "
            'python -c "import secrets;print(secrets.token_urlsafe(32))"'
        )
    if is_deployed(settings) and settings.analyst_signup_code in (
        "", "131113", "change-me-private-code",
    ):
        # Fail closed (was M-4 warn-only): the default code is public (in source). SSO
        # in front makes it defense-in-depth, but a non-SSO or trusted-network deploy
        # would ship a known self-registration gate by omission. Refuse to start
        # without a private one — same posture as the SESSION_SECRET guard above.
        # The deny-list includes the historical .env.example placeholder: a deploy
        # that shipped `cp .env.example .env` unedited booted cleanly with a
        # repo-public signup code (audit 2026-07-10 DEP-3).
        raise RuntimeError(
            "ANALYST_SIGNUP_CODE must be set to a private value in production — the "
            "in-source defaults/placeholders are public and would leave analyst "
            "profile self-registration open. Set ANALYST_SIGNUP_CODE."
        )
    if is_deployed(settings) and settings.caos_demo_seed:
        # Fail closed (was warn-only): demo seeding ships fictional issuers + the
        # ATLF reference deal + illustrative metrics. Refuse to seed demo data into
        # a production database — same posture as the secret guards above. An
        # operator who genuinely wants a prod demo must set ENVIRONMENT≠production.
        raise RuntimeError(
            "CAOS_DEMO_SEED must not be set in production — it would seed fictional "
            "demo issuers + the ATLF reference deal into the production database. "
            "Leave it unset (default off) for a non-demo deployment."
        )
    require_postgres_in_production(settings)
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
    # the request thread. Sweeps stranded 'running' rows to 'failed' on boot.
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

    asyncio.create_task(run_warmup())

    yield
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

# ─── Security headers ───────────────────────────────────────────────────────
# Applied to every response (API + static). The Next static export ships inline
# bootstrap/RSC scripts and uses inline style attributes throughout, so the CSP
# must allow 'unsafe-inline' for script/style — a static export can't carry a
# per-request nonce. The remaining directives still constrain origins, framing,
# base-uri and form targets. frame-ancestors is 'self'; relax it only if the app
# is ever embedded cross-origin (e.g. inside another product's iframe).
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


# ─── Edge-origin guard (single chokepoint) ──────────────────────────────────
# The edge proof (X-Edge-Authorization) must gate EVERY deployed /api request, not
# only those that depend on get_identity. Enforcing it per-route let create_profile
# and logout (which read cookies/headers directly, no get_identity dep) skip the
# check; a future route could too. This middleware closes that — get_identity keeps
# its own (now redundant) check. /api/health is exempt so monitors can probe
# liveness. Registered AFTER security_headers so access_log (registered next) still
# wraps and logs the 401. (#31)
@app.middleware("http")
async def edge_origin_guard(request: Request, call_next):  # type: ignore[no-untyped-def]
    settings = get_settings()
    # Same fail-closed predicate as identity.get_identity (config.is_deployed).
    deployed = is_deployed(settings)
    path = request.url.path
    if deployed and settings.edge_proxy_secret and path.startswith("/api/") and path != "/api/health":
        presented = request.headers.get("x-edge-authorization", "")
        if not hmac.compare_digest(
            presented.encode("utf-8", "ignore"), settings.edge_proxy_secret.encode("utf-8")
        ):
            # This response short-circuits BEFORE the security_headers middleware
            # (registered earlier = wrapped inner), so stamp the headers here too —
            # otherwise the 401 ships without CSP/nosniff/HSTS.
            return JSONResponse(
                {"detail": "Request did not carry a valid edge credential."},
                status_code=401,
                headers=dict(_SECURITY_HEADERS),
            )
    return await call_next(request)


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
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(autonomy.router, prefix="/api/autonomy", tags=["autonomy"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
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
_static = Path(settings.caos_static_dir)
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
