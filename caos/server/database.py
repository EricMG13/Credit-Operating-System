"""Async SQLAlchemy engine, session factory, and ORM models.

SQLite (aiosqlite) by default; any async SQLAlchemy URL via DATABASE_URL —
production points it at Postgres (postgresql+asyncpg). Schema is managed by Alembic
(see migrations/); ``init_db`` runs ``upgrade head`` on boot, stamping a
pre-Alembic database at the baseline first so existing deployments migrate in
place rather than colliding. On Postgres the upgrade is wrapped in a session-level
advisory lock so concurrent boots across replicas serialize on the DDL rather than
racing (no-op on SQLite).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, delete, event, inspect, or_, select, text, update, Computed,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
import json
from sqlalchemy.types import TypeDecorator, UnicodeText
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.ext.compiler import compiles

logger = logging.getLogger("caos.database")

_ROLLBACK_CLEANUPS_KEY = "caos_rollback_cleanups"
_AFTER_COMMIT_CALLBACKS_KEY = "caos_after_commit_callbacks"


def register_rollback_cleanup(session: AsyncSession, cleanup: Callable[[], None]) -> None:
    """Register a synchronous cleanup for a dependency-owned transaction.

    Use only on routes whose commit is owned by ``get_db``. The callback runs
    when route work fails before commit starts, and is discarded after a
    successful commit. A commit-time connection error is ambiguous, so cleanup
    is deliberately skipped rather than deleting bytes a durable row may refer
    to.
    """
    session.info.setdefault(_ROLLBACK_CLEANUPS_KEY, []).append(cleanup)


def register_after_commit(session: AsyncSession, callback: Callable[[], None]) -> None:
    """Run a synchronous cache/state update only after the transaction commits.

    This is for non-authoritative process hints whose value must never advance
    ahead of durable database state.  Callback failures are logged after commit
    and cannot turn a successful write into a misleading transaction failure.
    """
    session.info.setdefault(_AFTER_COMMIT_CALLBACKS_KEY, []).append(callback)


async def _run_rollback_cleanups(session: AsyncSession) -> None:
    callbacks = session.info.pop(_ROLLBACK_CLEANUPS_KEY, [])
    for cleanup in reversed(callbacks):
        try:
            await asyncio.to_thread(cleanup)
        except Exception:
            logger.exception("Failed to run transaction rollback cleanup")


async def _run_after_commit_callbacks(session: AsyncSession) -> None:
    callbacks = session.info.pop(_AFTER_COMMIT_CALLBACKS_KEY, [])
    for callback in callbacks:
        try:
            callback()
        except Exception:
            logger.exception("Failed to run post-commit state callback")


class SafeVector(TypeDecorator):
    impl = Vector
    cache_ok = True

    def __init__(self, dim=None):
        super().__init__()
        self.dim = dim
        self.impl = Vector(dim)

    def load_dialect_impl(self, dialect):
        if dialect.name == "sqlite":
            return dialect.type_descriptor(UnicodeText())
        return dialect.type_descriptor(Vector(self.dim))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "sqlite":
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "sqlite":
            return json.loads(value)
        return value

@compiles(Vector, "sqlite")
def compile_sqlite_vector(_element, _compiler, **kw):
    return "TEXT"

@compiles(TSVECTOR, "sqlite")
def compile_sqlite_tsvector(_element, _compiler, **kw):
    return "TEXT"

@compiles(Computed, "sqlite")
def compile_sqlite_computed(_element, _compiler, **kw):
    return "GENERATED ALWAYS AS (NULL) STORED"

from sqlalchemy.pool import NullPool  # noqa: E402  # after @compiles decorators that must register first
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column  # noqa: E402

from config import SERVER_DIR, get_settings  # noqa: E402

settings = get_settings()

# SQLite needs its parent directory to exist before first connect.
if settings.database_url.startswith("sqlite"):
    db_path = settings.database_url.split("///")[-1]
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

# Tests run async (pytest-asyncio) and a sync TestClient against this same global
# engine on different event loops; a pooled connection cleaned up after its
# creating loop closed raises "Event loop is closed" (notably with asyncpg).
# NullPool in test mode avoids cross-loop connection reuse. SQLite keeps its
# existing dialect pool. Postgres uses an explicit per-worker envelope: the
# supported two-worker maximum therefore consumes at most 50 app connections by
# default, leaving half of bundled Postgres's default 100 for migrations,
# backup, probes, and operator access.
_POSTGRES_AUTO_CONNECTIONS_PER_WORKER = 25
_POSTGRES_MIN_INTERACTIVE_HEADROOM = 4


def _postgres_pool_kwargs(
    *,
    database_url: str,
    test_mode: bool,
    configured_pool_size: int,
    max_overflow: int,
    pool_timeout_s: float,
    run_concurrency: int,
    synth_concurrency: int,
) -> dict:
    """Resolve bounded QueuePool settings for one Postgres worker process."""
    if test_mode or not database_url.startswith("postgresql"):
        return {}
    if configured_pool_size < 0:
        raise ValueError("CAOS_DB_POOL_SIZE must be 0 (auto) or a positive integer")
    if max_overflow < 0:
        raise ValueError("CAOS_DB_MAX_OVERFLOW must be non-negative")
    if pool_timeout_s <= 0:
        raise ValueError("CAOS_DB_POOL_TIMEOUT_S must be greater than zero")

    if configured_pool_size:
        pool_size = configured_pool_size
    else:
        pool_size = _POSTGRES_AUTO_CONNECTIONS_PER_WORKER - max_overflow
        reserved = run_concurrency + synth_concurrency
        if pool_size < reserved + _POSTGRES_MIN_INTERACTIVE_HEADROOM:
            raise ValueError(
                "Automatic Postgres pool cannot reserve executor demand plus "
                "interactive headroom inside the 25-connection worker envelope; "
                "set CAOS_DB_POOL_SIZE explicitly after sizing Postgres max_connections"
            )

    return {
        "pool_size": pool_size,
        "max_overflow": max_overflow,
        "pool_timeout": pool_timeout_s,
    }


_test_mode = os.environ.get("CAOS_TEST") == "1"
_engine_kwargs: dict = {"pool_pre_ping": True}
_engine_kwargs.update(
    _postgres_pool_kwargs(
        database_url=settings.database_url,
        test_mode=_test_mode,
        configured_pool_size=settings.caos_db_pool_size,
        max_overflow=settings.caos_db_max_overflow,
        pool_timeout_s=settings.caos_db_pool_timeout_s,
        run_concurrency=settings.caos_run_concurrency,
        synth_concurrency=settings.synth_concurrency,
    )
)
if _test_mode:
    _engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.database_url, **_engine_kwargs)

if "pool_size" in _engine_kwargs:
    logger.info(
        "Postgres pool configured (pool_size=%s, max_overflow=%s, pool_timeout_s=%s)",
        _engine_kwargs["pool_size"],
        _engine_kwargs["max_overflow"],
        _engine_kwargs["pool_timeout"],
    )

# SQLite needs WAL + a busy timeout so the async executor and request handlers
# can write concurrently without "database is locked". No-op on Postgres.
if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Issuer(Base):
    __tablename__ = "issuers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Derived identity keys maintained by the ORM event below. Keeping ordinary
    # columns (instead of an expression index) makes the invariant reflectable
    # by Alembic on both SQLite and Postgres.
    # Unicode case-folding can expand a 255-character display name (for example,
    # German sharp-s), so the key needs more room than the source column.
    normalized_name: Mapped[str] = mapped_column(String(768), nullable=False)
    ticker: Mapped[Optional[str]] = mapped_column(String(32))
    industry: Mapped[Optional[str]] = mapped_column(String(128))
    sub_sector: Mapped[Optional[str]] = mapped_column(String(128))
    country: Mapped[Optional[str]] = mapped_column(String(128))
    figi: Mapped[Optional[str]] = mapped_column(String(32))
    # Analyst-entered agency ratings (no free ratings feed). NULL = not rated.
    rating_sp: Mapped[Optional[str]] = mapped_column(String(16))
    rating_moody: Mapped[Optional[str]] = mapped_column(String(16))
    rating_fitch: Mapped[Optional[str]] = mapped_column(String(16))
    ratings_observed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Analyst-entered private-equity sponsor (exact-string grouped by the sponsor
    # track-record view — no free ownership feed). NULL = not sponsor-owned/unknown.
    sponsor: Mapped[Optional[str]] = mapped_column(String(255))
    # Optional multi-team tenancy anchor (migration 0023). NULL = shared/global
    # (visible to every team, e.g. the reference demo issuer); a non-null value scopes
    # this issuer — and everything keyed off it (runs, documents, metric_facts,
    # portfolio) — to one team when CAOS_TENANCY_ENABLED is set. Inert by default.
    team_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    uniqueness_scope: Mapped[str] = mapped_column(String(64), nullable=False)
    # Who created this row (Analyst.id, or the proxy email identity — mirrors
    # Run.analyst_id). NULL for seed + pre-0023 rows. Governance attribution for
    # the analyst-entered ratings/sponsor above. SEAM4-4.
    created_by: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        UniqueConstraint(
            "uniqueness_scope", "normalized_name", name="uq_issuers_scope_normalized_name"
        ),
    )


class IssuerReportingProfile(Base):
    """Issuer-specific cadence inputs for the canonical freshness policy."""

    __tablename__ = "issuer_reporting_profiles"

    issuer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("issuers.id", ondelete="CASCADE"), primary_key=True
    )
    cadence: Mapped[str] = mapped_column(String(16), nullable=False, default="unknown")
    fiscal_year_end_month: Mapped[Optional[int]] = mapped_column(Integer)
    fiscal_year_end_day: Mapped[Optional[int]] = mapped_column(Integer)
    reporting_lag_days: Mapped[Optional[int]] = mapped_column(Integer)
    grace_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7, server_default="7")
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_by: Mapped[Optional[str]] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Analyst(Base):
    """A named analyst profile, self-registered via the shared access code. The
    identity shown across the app (initials) and stamped on every Run.analyst_id.

    `email` is the verified edge-proxy identity (X-Forwarded-Email) when present:
    behind SSO the profile is keyed on it so a user can only ever be their own
    profile (rename allowed, impersonation not). Null on a proxy-less / local run,
    where the profile is keyed on name alone."""

    __tablename__ = "analysts"
    # Named to match migration 0008's unique index so `alembic check` reconciles;
    # a bare `unique=True` reflects as an unnamed constraint and drifts. Same
    # uniqueness either way.
    __table_args__ = (
        Index("uq_analyst_email", "email", unique=True),
        CheckConstraint(
            "role IN ('analyst', 'viewer', 'qa', 'admin')",
            name="ck_analysts_role",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    # PBKDF2 hash for the email+password lane (passwords.py); null for SSO /
    # shared-code profiles, which authenticate without one. Account key is `email`.
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    coverage_area: Mapped[Optional[str]] = mapped_column(String(64))
    location: Mapped[Optional[str]] = mapped_column(String(16))
    recovery_word_hashes: Mapped[list] = mapped_column(JSON, default=list)
    recovery_hints: Mapped[list] = mapped_column(JSON, default=list)
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, default="analyst", server_default="analyst"
    )
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    settings_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Session-revocation epoch: signed into the cookie at mint; bumped on logout so
    # every existing token for this analyst stops validating (identity.get_identity
    # compares the two on each request). See routes/auth.py.
    token_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # The analyst's team for multi-team tenancy (migration 0023). NULL = unassigned
    # (sees only shared, team-less issuers when tenancy is enabled). Inert by default.
    team_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    # Broad market-price workbooks are analyst-owned source evidence rather than
    # issuer documents. Existing issuer documents continue to authorize through
    # issuer_id; an issuer-less document must carry this explicit private owner.
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    run_mode: Mapped[Optional[str]] = mapped_column(String(16))
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    fiscal_period: Mapped[Optional[str]] = mapped_column(String(64))
    source_kind: Mapped[Optional[str]] = mapped_column(String(32))
    effective_period_end: Mapped[Optional[date]] = mapped_column(Date)
    source_published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    withdrawn_by: Mapped[Optional[str]] = mapped_column(String(255))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(255))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        Index("ix_document_chunks_tsv", "tsv", postgresql_using="gin"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_hash: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    # D1: extraction provenance. NULL = native text layer (markitdown/pypdf);
    # "ocr" = ocrmypdf/Tesseract recognition off a scanned/image page — lower
    # fidelity (misreads, layout loss), so CP-5/analysts can discount it.
    prov: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    tsv: Mapped[Optional[TSVECTOR]] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english', text)", persisted=True),
        nullable=True,
    )


# ─── Analytical engine: runs, outputs, evidence, QA ─────────────────────────
# These tables map 1:1 onto the canonical methodology schemas in
# Modular OS/KNOWLEDGE SOURCES/02_SCHEMA/. A Run carries the shared envelope
# (CP_SHARED_ARTIFACT_ENVELOPE); each ModuleOutput is a CP_MODULE_PAYLOAD_BASE;
# Claim/EvidenceItem are the CP_EVIDENCE_TRACE; QAFinding is a CP_QA_RESULT
# finding. The vocabularies (qa_status, severity, lineage_class, …) are stored
# as strings validated by the engine layer rather than DB enums, so the schema
# stays portable across SQLite (dev) and Lakebase (prod).


class Run(Base):
    """One execution of the module pipeline for an issuer (the shared envelope)."""

    __tablename__ = "runs"
    __table_args__ = (
        # DB-level backstop for the active-run dedup routes/runs.py enforces at
        # the application layer (_CREATE_RUN_LOCK) — see migrations/0035. A
        # per-process asyncio.Lock can't coordinate a race across multiple app
        # replicas; this partial unique index can, at the database. Partial so a
        # fresh run is allowed once the prior one is terminal.
        Index(
            "uq_runs_issuer_active", "issuer_id", unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
            sqlite_where=text("status IN ('queued', 'running')"),
        ),
        # Serves the worker claim poll (status filter + created_at order, every
        # poll tick) and the status='complete' board scans (migrations/0034).
        Index("ix_runs_status_created_at", "status", "created_at"),
        Index(
            "uq_runs_analyst_idempotency",
            "analyst_id",
            "idempotency_key",
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    parent_run_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("runs.id"))
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued|running|complete|failed
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255))
    # Durable POST /runs retry identity. The request hash prevents a caller from
    # accidentally reusing a key for a different logical request.
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128))
    idempotency_request_hash: Mapped[Optional[str]] = mapped_column(String(64))
    as_of_date: Mapped[Optional[str]] = mapped_column(String(32))
    # Reproducibility: pin the model and methodology version each run saw.
    model_id: Mapped[Optional[str]] = mapped_column(String(64))
    prompt_version: Mapped[Optional[str]] = mapped_column(String(32))
    # Analyst-selected model mode (engine/presets.py) — persisted so the
    # background runner applies the same TEST/LITE/BALANCED/MAX tier the creating
    # request chose, including across a re-claim. NULL = the default mode.
    model_mode: Mapped[Optional[str]] = mapped_column(String(16))
    # Immutable execution corpus captured when the run is created. NULL denotes
    # a legacy pre-snapshot row; an empty list is an intentional empty corpus.
    # The worker must never rebuild a new run's inputs from the issuer's current
    # documents because uploads can arrive while the run is queued/running.
    input_document_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    input_manifest_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    input_corpus_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # approved|unapproved|empty. Legacy NULL is handled explicitly by the runner.
    input_snapshot_state: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    # Portfolio this run is evaluated against (CP-3C reads it for the live
    # concentration register); NULL = a standalone run with no portfolio context.
    # Soft ref (plain string, no FK) — avoids a SQLite ALTER-ADD-FK on the existing,
    # self-referential runs table; the app resolves it explicitly.
    portfolio_id: Mapped[Optional[str]] = mapped_column(String(36))
    # Run-level gate roll-up (worst module status wins).
    qa_status: Mapped[str] = mapped_column(String(16), default="Not Reviewed")
    committee_status: Mapped[str] = mapped_column(String(32), default="Draft Only")
    # Total LLM tokens this run spent (per-run budget accounting).
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Async executor lease/recovery (see migrations/0004_run_lease).
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    worker_id: Mapped[Optional[str]] = mapped_column(String(64))
    error: Mapped[Optional[str]] = mapped_column(Text)


class ResearchJob(Base):
    """A durable Deep Research run (M-3).

    Deep research is a multi-minute web-grounded LLM call. It used to run inside
    the POST request, so a dropped client/proxy connection lost the work and its
    token spend. Now the POST persists this row and a background task fills it in
    (research_executor.py); the client polls GET /api/research/{id}. ``analyst_id``
    scopes reads to the owner so one analyst can't read another's job.
    """

    __tablename__ = "research_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # queued|running|complete|failed. Created 'queued' (was 'running'): the durable
    # executor claims it, so a redeploy re-claims + re-executes from `brief` rather
    # than losing an in-flight job (migration 0022). Both queued and running mean
    # "keep polling" to the client.
    status: Mapped[str] = mapped_column(String(16), default="queued")
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    context_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), index=True)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    brief: Mapped[dict] = mapped_column(JSON, default=dict)
    report: Mapped[Optional[str]] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    # Structured, CAOS-verified research exhibits. The web-research model never
    # supplies these rows: research_figures.py derives them from the context's
    # explicitly-bound issuer data and stamps source ids on every figure.
    figures: Mapped[list] = mapped_column(JSON, default=list)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    truncated: Mapped[bool] = mapped_column(Boolean, default=False)
    # Live running counts ({"sources": n, "searches": m}), rewritten per
    # continuation turn so the polled UI shows sources actually accumulating.
    # Null until the first turn reports (and on demo/instant completions).
    progress: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Async executor lease/recovery — mirrors Run (migration 0022). A job is a pure
    # function of its brief, so a Postgres worker re-claims and re-executes an orphan.
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    worker_id: Mapped[Optional[str]] = mapped_column(String(64))


class IssuerResearchReport(Base):
    """A synthesized bank-research-style credit summary for one issuer+run.

    House artifact (not analyst-scoped): any analyst viewing the same issuer+run
    sees the same report. Cached per ``(issuer_id, run_id)``; a new complete run
    does NOT auto-regenerate (cost control) — the UI surfaces a stale banner and
    the analyst clicks Regenerate.

    Synthesis is a durable background job (mirrors ``ResearchJob`` +
    ``research_executor.py``): POST persists this row and enqueues a background
    task; the client polls GET. A dropped connection does not abort execution.
    """

    __tablename__ = "issuer_research_reports"
    __table_args__ = (
        UniqueConstraint("issuer_id", "run_id", name="uq_issuer_run_report"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("issuers.id"), index=True
    )
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("runs.id"), index=True
    )
    # queued|running|complete|failed. Created 'queued' (was 'running'): the durable
    # executor claims it, so a redeploy re-claims + re-executes rather than losing
    # an in-flight synthesis (migration 0038, mirrors ResearchJob/migration 0036).
    status: Mapped[str] = mapped_column(
        String(16), default="queued"
    )
    # The structured payload (forced tool-call output), JSON-validated.
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # The rendered Markdown sections (denormalized for cheap GET + future export).
    markdown: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Figure-validation result: {"checked": n, "verified": n, "dropped": [...], "unverified": [...]}.
    validation: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # The module digest snapshot the report was synthesized from (reproducibility).
    digest: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Reproducibility stamps (mirrors Run).
    prompt_version: Mapped[Optional[str]] = mapped_column(String(32))
    model_id: Mapped[Optional[str]] = mapped_column(String(64))
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    truncated: Mapped[bool] = mapped_column(Boolean, default=False)
    # Analyst who triggered the synthesis (for audit; the report itself is shared).
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255))
    # Live running counts ({"sections": n, "tokens": m}) while synthesizing.
    progress: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Async executor lease/recovery — mirrors ResearchJob (migration 0038). A report
    # is a pure function of its (run_id, issuer_id, digest), so a Postgres worker
    # re-claims and re-executes an orphan instead of losing the synthesis.
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    worker_id: Mapped[Optional[str]] = mapped_column(String(64))


class ModuleOutput(Base):
    """A single module's payload within a run (CP_MODULE_PAYLOAD_BASE)."""

    __tablename__ = "module_outputs"
    __table_args__ = (UniqueConstraint("run_id", "module_id", name="uq_run_module"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id"), index=True)
    module_id: Mapped[str] = mapped_column(String(16), nullable=False)
    module_name: Mapped[str] = mapped_column(String(128), nullable=False)
    owned_object: Mapped[Optional[str]] = mapped_column(String(128))
    schema_family: Mapped[str] = mapped_column(String(32), default="Nested")
    runtime_output: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[str] = mapped_column(String(32), default="Insufficient Information")
    qa_status: Mapped[str] = mapped_column(String(16), default="Not Reviewed")
    committee_status: Mapped[str] = mapped_column(String(32), default="Draft Only")
    validation_status: Mapped[str] = mapped_column(String(16), default="Not Executed")
    limitation_flags: Mapped[list] = mapped_column(JSON, default=list)
    downstream_consumers: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Claim(Base):
    """A narrative claim a module makes (CP_EVIDENCE_TRACE.claims[])."""

    __tablename__ = "claims"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    module_output_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("module_outputs.id"), index=True
    )
    claim_id: Mapped[str] = mapped_column(String(32), nullable=False)  # stable within the output, e.g. C-07
    claim_text: Mapped[str] = mapped_column(Text, nullable=False)


class EvidenceItem(Base):
    """A claim's link to its source (CP_EVIDENCE_TRACE.evidence_items[]).

    document_chunk_id is the join that makes a citation real — it points an
    E-xx at the actual ingested chunk it was drawn from, enabling
    click-to-source and the CP-5B lineage check.
    """

    __tablename__ = "evidence_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    claim_pk: Mapped[str] = mapped_column(String(36), ForeignKey("claims.id"), index=True)
    evidence_id: Mapped[str] = mapped_column(String(32), nullable=False)  # E-xx
    extraction_type: Mapped[str] = mapped_column(String(32), nullable=False)
    lineage_class: Mapped[str] = mapped_column(String(32), nullable=False)
    source_locator: Mapped[Optional[str]] = mapped_column(Text)
    document_chunk_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("document_chunks.id")
    )
    confidence: Mapped[str] = mapped_column(String(32), default="Insufficient Information")


class QAFinding(Base):
    """A CP-5/CP-5B audit finding (CP_QA_RESULT.findings[])."""

    __tablename__ = "qa_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id"), index=True)
    module_id: Mapped[Optional[str]] = mapped_column(String(16))  # module the finding is about
    finding_id: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)  # CRITICAL|MATERIAL|MINOR
    lane: Mapped[Optional[int]] = mapped_column(Integer)  # one of the 8 CP-5 audit lanes
    description: Mapped[str] = mapped_column(Text, nullable=False)
    affected_claim_id: Mapped[Optional[str]] = mapped_column(String(32))
    required_remediation: Mapped[Optional[str]] = mapped_column(Text)


class MetricFact(Base):
    """A structured, queryable per-issuer metric value — the curated store that
    backs cross-issuer natural-language query.

    Two provenances: ``run`` facts are projected from a completed run's module
    outputs (e.g. CP-1 normalized_financials) and carry a citation back to the
    claim/evidence/chunk that supports them, plus the module's QA status; ``seed``
    facts are illustrative demo values (no run). ``headline`` marks the current
    LTM value used for cross-issuer ranking, distinct from historical periods.
    """

    __tablename__ = "metric_facts"
    __table_args__ = (
        UniqueConstraint("issuer_id", "run_id", "metric_key", "period", name="uq_fact"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    # Standalone index: uq_fact leads with issuer_id, so run-scoped fact reads
    # would otherwise scan the table as volume grows. D8 (migration 0009).
    run_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("runs.id"), index=True)
    module_id: Mapped[Optional[str]] = mapped_column(String(16))
    metric_key: Mapped[str] = mapped_column(String(64), nullable=False)
    period: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(16), default="")
    headline: Mapped[bool] = mapped_column(Boolean, default=False)
    qa_status: Mapped[str] = mapped_column(String(16), default="Not Reviewed")
    # Citation back to the asserting claim/evidence (run-derived facts only).
    source_claim_id: Mapped[Optional[str]] = mapped_column(String(32))
    source_evidence_id: Mapped[Optional[str]] = mapped_column(String(32))
    document_chunk_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("document_chunks.id")
    )
    # run | fixture (genuine ATLF demo) | demo_fixture (fabricated — flagged,
    # excluded from peer/graph reads) | derived (chunk-extracted) | seed.
    provenance: Mapped[str] = mapped_column(String(16), default="seed")
    # EBITDA/leverage basis: reported (EDGAR GAAP XBRL) | reported_disclosure
    # (issuer-disclosed headline) | adjusted (covenant/modeled) | None where the
    # metric is basis-agnostic (e.g. energy exposure, Altman Z). (#27)
    basis: Mapped[Optional[str]] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SectorSignal(Base):
    """CP-MON-shaped sector signal substrate consumed by Sector Review."""

    __tablename__ = "sector_signals"
    __table_args__ = (
        UniqueConstraint("dedup_hash", name="uq_sector_signals_dedup_hash"),
        Index("ix_sector_signals_sector_date", "sector", "signal_date"),
        Index("ix_sector_signals_category_severity", "category", "severity"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    sector: Mapped[str] = mapped_column(String(128), nullable=False)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    issuer_name: Mapped[Optional[str]] = mapped_column(String(255))
    headline: Mapped[str] = mapped_column(String(255), nullable=False)
    body_excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    materiality_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    source_title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(1024))
    source_tier: Mapped[str] = mapped_column(String(32), nullable=False, default="seed")
    dedup_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    signal_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_date: Mapped[Optional[str]] = mapped_column(String(32))
    provenance: Mapped[str] = mapped_column(String(16), nullable=False, default="seed")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SectorReviewRun(Base):
    """Persisted CP-SR review payload envelope once live synthesis is enabled."""

    __tablename__ = "sector_review_runs"
    __table_args__ = (
        UniqueConstraint(
            "analyst_id", "sector", "version",
            name="uq_sector_review_analyst_sector_version",
        ),
        Index("ix_sector_review_runs_sector_as_of", "sector", "as_of"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    sector: Mapped[str] = mapped_column(String(128), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    timeframe: Mapped[str] = mapped_column(String(32), nullable=False)
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    posture: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[dict] = mapped_column(JSON, default=dict)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    input_signal_ids: Mapped[list] = mapped_column(JSON, default=list)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    refresh_trigger: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="seed")
    provenance: Mapped[str] = mapped_column(String(16), nullable=False, default="seed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalystSectorFeed(Base):
    """Per-analyst Sector Review feed toggles."""

    __tablename__ = "analyst_sector_feeds"
    __table_args__ = (
        UniqueConstraint("analyst_id", "sector", name="uq_analyst_sector_feed"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sector: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_pref: Mapped[str] = mapped_column(String(32), nullable=False, default="in_app")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SectorTaxonomy(Base):
    """Canonical sector label and alias registry shared by analytical routes."""

    __tablename__ = "sector_taxonomy"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalysisContextRecord(Base):
    """Analyst-owned cross-route universe, version and selection contract."""

    __tablename__ = "analysis_contexts"
    __table_args__ = (
        Index("ix_analysis_contexts_analyst_updated", "analyst_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, default="Untitled analysis")
    sector_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("sector_taxonomy.id"))
    sub_segments: Mapped[list] = mapped_column(JSON, default=list)
    issuer_ids: Mapped[list] = mapped_column(JSON, default=list)
    instrument_ids: Mapped[list] = mapped_column(JSON, default=list)
    portfolio_scope: Mapped[Optional[str]] = mapped_column(String(128))
    as_of: Mapped[Optional[date]] = mapped_column(Date)
    sector_review_run_id: Mapped[Optional[str]] = mapped_column(String(64))
    rv_snapshot_id: Mapped[Optional[str]] = mapped_column(String(36))
    rv_run_id: Mapped[Optional[str]] = mapped_column(String(36))
    query_session_id: Mapped[Optional[str]] = mapped_column(String(36))
    artifacts: Mapped[dict] = mapped_column(JSON, default=dict)
    surface_state: Mapped[dict] = mapped_column(JSON, default=dict)
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    selected: Mapped[dict] = mapped_column(JSON, default=dict)
    # Optimistic-concurrency token for analyst UI patches. Producer-side
    # artifact binders already take row locks; this closes stale browser writes.
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalysisFinding(Base):
    """One analyst-ratified or draft finding shared across downstream surfaces."""

    __tablename__ = "analysis_findings"
    __table_args__ = (
        Index("ix_analysis_findings_context_created", "context_id", "created_at"),
        Index("ix_analysis_findings_analyst_status", "analyst_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    context_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_surface: Mapped[str] = mapped_column(String(32), nullable=False)
    source_run_id: Mapped[Optional[str]] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft")
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalysisInsight(Base):
    """Immutable cited insight version scoped to one analyst-owned context."""

    __tablename__ = "analysis_insights"
    __table_args__ = (
        UniqueConstraint(
            "analyst_id", "context_id", "surface", "kind", "source_fingerprint", "version",
            name="uq_analysis_insight_generation",
        ),
        Index("ix_analysis_insights_context_generated", "context_id", "generated_at"),
        Index("ix_analysis_insights_analyst_status", "analyst_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    context_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analysis_contexts.id"), nullable=False
    )
    surface: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ready")
    subject_refs: Mapped[dict] = mapped_column(JSON, default=dict)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    claims: Mapped[list] = mapped_column(JSON, default=list)
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    missing_dependencies: Mapped[list] = mapped_column(JSON, default=list)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    source_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model: Mapped[Optional[str]] = mapped_column(String(128))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    ratified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lease_owner: Mapped[Optional[str]] = mapped_column(String(64))
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AnalysisQueryRun(Base):
    """Persisted Query investigation; question text never lives in URL state."""

    __tablename__ = "analysis_query_runs"
    __table_args__ = (
        Index("ix_analysis_query_runs_context_created", "context_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    context_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    selected_lane: Mapped[str] = mapped_column(String(24), nullable=False)
    method_override: Mapped[Optional[str]] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class MarketSnapshot(Base):
    """Immutable normalized market-data observation used by RV screening."""

    __tablename__ = "market_snapshots"

    __table_args__ = (
        Index("ix_market_snapshots_analyst_created", "analyst_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_label: Mapped[str] = mapped_column(String(160), nullable=False)
    origin: Mapped[str] = mapped_column(String(24), nullable=False)
    method: Mapped[str] = mapped_column(String(32), nullable=False, default="reported")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ready")
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    document_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="RESTRICT")
    )
    source_manifest_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("source_manifests.id", ondelete="SET NULL")
    )
    import_mapping: Mapped[dict] = mapped_column(JSON, default=dict)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class MarketInstrument(Base):
    """One exact instrument observation within an immutable snapshot."""

    __tablename__ = "market_instruments"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "instrument_key", name="uq_market_snapshot_instrument"),
        Index("ix_market_instruments_snapshot_figi", "snapshot_id", "figi"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("market_snapshots.id"), nullable=False)
    instrument_key: Mapped[str] = mapped_column(String(160), nullable=False)
    figi: Mapped[Optional[str]] = mapped_column(String(32))
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("issuers.id"))
    borrower: Mapped[str] = mapped_column(String(255), nullable=False)
    sector_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("sector_taxonomy.id"))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class MarketImportIssue(Base):
    """Immutable warning/rejection ledger captured with a market snapshot."""

    __tablename__ = "market_import_issues"
    __table_args__ = (
        Index("ix_market_import_issues_snapshot_severity", "snapshot_id", "severity"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    snapshot_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("market_snapshots.id", ondelete="CASCADE"), nullable=False
    )
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(String(1024), nullable=False)
    row_number: Mapped[Optional[int]] = mapped_column(Integer)
    column: Mapped[Optional[str]] = mapped_column(String(32))
    field: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class RVScreenRun(Base):
    """Analyst-owned RV screen over one immutable market snapshot."""

    __tablename__ = "rv_screen_runs"
    __table_args__ = (
        Index("ix_rv_screen_runs_context_created", "context_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    context_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), nullable=False)
    snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("market_snapshots.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class RVCandidate(Base):
    """One gated instrument decision record from an RV screen."""

    __tablename__ = "rv_candidates"
    __table_args__ = (
        UniqueConstraint("run_id", "instrument_id", name="uq_rv_run_instrument"),
        Index("ix_rv_candidates_run_classification", "run_id", "classification"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("rv_screen_runs.id"), nullable=False)
    instrument_id: Mapped[str] = mapped_column(String(36), ForeignKey("market_instruments.id"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    classification: Mapped[str] = mapped_column(String(24), nullable=False)
    missing_gates: Mapped[list] = mapped_column(JSON, default=list)
    pitch: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    portfolio_impact: Mapped[dict] = mapped_column(JSON, default=dict)
    analyst_override: Mapped[Optional[dict]] = mapped_column(JSON)
    ratified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SectorReviewRatification(Base):
    """Section-level analyst ratification or override for a review draft."""

    __tablename__ = "sector_review_ratifications"
    __table_args__ = (
        UniqueConstraint(
            "review_run_id", "analyst_id", "section_id",
            name="uq_sector_review_ratification",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    review_run_id: Mapped[str] = mapped_column(String(64), ForeignKey("sector_review_runs.id"), nullable=False)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    section_id: Mapped[str] = mapped_column(String(64), nullable=False)
    decision: Mapped[str] = mapped_column(String(24), nullable=False)
    override_text: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalystWatchlist(Base):
    """An analyst's coverage watchlist — the issuers their Desk Brief is scoped to.

    Phase-2 personalization key: when non-empty, the Desk Brief lane builds a
    per-analyst evidence pack (deltas/findings scoped to these issuers) and keys
    the cached brief by ``analyst_id``. Empty (or no rows) → the analyst falls
    back to the book-level brief (``QueryInsight.analyst_id IS NULL``). Mirrors
    ``AnalystSectorFeed`` (analyst_id + value, unique pair)."""

    __tablename__ = "analyst_watchlists"
    __table_args__ = (
        UniqueConstraint("analyst_id", "issuer_id", name="uq_analyst_watchlist"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), nullable=False, index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SavedModel(Base):
    """Latest analyst-saved Model Builder state for an issuer."""

    __tablename__ = "saved_models"
    __table_args__ = (
        UniqueConstraint("issuer_id", "analyst_id", name="uq_saved_model_issuer_analyst"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    analyst_id: Mapped[str] = mapped_column(String(255), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ModelDraftV2(Base):
    """Analyst-owned Model Engine v2 draft guarded by integer revision CAS."""

    __tablename__ = "model_drafts_v2"
    __table_args__ = (
        UniqueConstraint(
            "issuer_id", "analyst_id", name="uq_model_draft_v2_issuer_analyst"
        ),
        Index("ix_model_drafts_v2_analyst_updated", "analyst_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("issuers.id"), nullable=False, index=True
    )
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    context_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("analysis_contexts.id"), index=True
    )
    source_run_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("runs.id"), index=True
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    calculation: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    source_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    input_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    engine_version: Mapped[str] = mapped_column(String(32), nullable=False)
    calculation_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ModelOverrideEvent(Base):
    """Append-only audit event for a typed Model Engine v2 node replacement."""

    __tablename__ = "model_override_events"
    __table_args__ = (
        Index("ix_model_override_events_draft_revision", "draft_id", "revision"),
        Index("ix_model_override_events_analyst_created", "analyst_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    draft_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("model_drafts_v2.id"), nullable=False, index=True
    )
    issuer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("issuers.id"), nullable=False, index=True
    )
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(24), nullable=False)
    node_id: Mapped[str] = mapped_column(String(300), nullable=False)
    value_type: Mapped[str] = mapped_column(String(16), nullable=False)
    before_value: Mapped[Optional[dict]] = mapped_column(JSON)
    after_value: Mapped[Optional[dict]] = mapped_column(JSON)
    original_formula: Mapped[Optional[str]] = mapped_column(Text)
    original_value: Mapped[Optional[dict]] = mapped_column(JSON)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    scope: Mapped[str] = mapped_column(String(64), nullable=False, default="draft")
    source: Mapped[Optional[str]] = mapped_column(String(240))
    actor_id: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    inverse_event_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("model_override_events.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SourceManifest(Base):
    """Immutable authority record produced by one intake operation."""

    __tablename__ = "source_manifests"
    __table_args__ = (Index("ix_source_manifests_analyst_created", "analyst_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    origin: Mapped[str] = mapped_column(String(24), nullable=False)
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    files: Mapped[list] = mapped_column(JSON, default=list)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ModelCheckpoint(Base):
    """Immutable analyst-owned model snapshot; SavedModel remains the draft."""

    __tablename__ = "model_checkpoints"
    __table_args__ = (
        Index("ix_model_checkpoints_analyst_issuer_created", "analyst_id", "issuer_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), nullable=False, index=True)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    context_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), nullable=False)
    issuer_run_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("runs.id"))
    parent_checkpoint_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("model_checkpoints.id"))
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    engine_version: Mapped[Optional[str]] = mapped_column(String(32))
    source_fingerprint: Mapped[Optional[str]] = mapped_column(String(64))
    input_fingerprint: Mapped[Optional[str]] = mapped_column(String(64))
    calculation_hash: Mapped[Optional[str]] = mapped_column(String(64))
    draft_revision: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ModelWorkbookImport(Base):
    """Immutable committed workbook-import ledger bound to one model revision."""

    __tablename__ = "model_workbook_imports"
    __table_args__ = (
        Index("ix_model_workbook_imports_analyst_committed", "analyst_id", "committed_at"),
        Index("ix_model_workbook_imports_draft_revision", "draft_id", "committed_revision"),
        Index("uq_model_workbook_imports_fingerprint", "import_fingerprint", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    issuer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("issuers.id"), nullable=False, index=True
    )
    draft_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("model_drafts_v2.id"), nullable=False, index=True
    )
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id"), nullable=False, index=True
    )
    source_manifest_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("source_manifests.id"), nullable=False, index=True
    )
    workbook_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    import_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    mapping: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    issues: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    committed_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    calculation_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    committed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ReportDraft(Base):
    """Mutable analyst-owned Report Studio composition for one context."""

    __tablename__ = "report_drafts"
    __table_args__ = (
        UniqueConstraint("context_id", "analyst_id", name="uq_report_draft_context_analyst"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    context_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), nullable=False, index=True)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ReportVersion(Base):
    """Immutable committee composition bound to exact upstream versions."""

    __tablename__ = "report_versions"
    __table_args__ = (Index("ix_report_versions_context_created", "context_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    context_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), nullable=False)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    run_id: Mapped[str] = mapped_column(String(64), ForeignKey("runs.id"), nullable=False)
    model_checkpoint_id: Mapped[str] = mapped_column(String(36), ForeignKey("model_checkpoints.id"), nullable=False)
    thesis_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("thesis_versions.id"))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="published")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    document_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    model_engine_version: Mapped[Optional[str]] = mapped_column(String(32))
    model_source_fingerprint: Mapped[Optional[str]] = mapped_column(String(64))
    model_input_fingerprint: Mapped[Optional[str]] = mapped_column(String(64))
    model_calculation_hash: Mapped[Optional[str]] = mapped_column(String(64))
    model_draft_revision: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class NotificationEvent(Base):
    """Analyst-owned completion event for background work.

    These events are deliberately separate from Watchtower alerts: they report
    workflow completion/failure, not a change in the credit.  ``idempotency_key``
    is the terminal transition identity, so executor retries cannot replay a
    second event.  Subject identifiers are loose strings so a notification can
    survive operational cleanup of the referenced job while remaining scoped to
    its analyst owner.
    """

    __tablename__ = "notification_events"
    __table_args__ = (
        Index("uq_notification_events_idempotency_key", "idempotency_key", unique=True),
        Index("ix_notification_events_analyst_created", "analyst_id", "created_at", "id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    subject_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)
    href: Mapped[Optional[str]] = mapped_column(String(600))
    action_label: Mapped[Optional[str]] = mapped_column(String(120))
    idempotency_key: Mapped[str] = mapped_column(String(180), nullable=False)
    seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AlertEvent(Base):
    """Durable Watchtower event; AlertState owns lifecycle transitions."""

    __tablename__ = "alert_events"
    __table_args__ = (Index("uq_alert_events_alert_key", "alert_key", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    alert_key: Mapped[str] = mapped_column(String(160), nullable=False)
    context_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("analysis_contexts.id"), index=True)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    run_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("runs.id"), index=True)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    impact: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    authority: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalystLink(Base):
    """An analyst-entered custom link/commentary parsed from the Obsidian vault."""

    __tablename__ = "analyst_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    source_note: Mapped[str] = mapped_column(String(255), nullable=False)
    target_issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class QueryAcceptedLink(Base):
    """An analyst-ratified model-proposed link between two issuers (Query phase 3).

    The model proposes (QueryOverlay, read-only); an ANALYST accepts — this row is
    that ratification: analyst-attributed, model-credited, citation-carrying. Once
    stored it is deterministic data: builders draw it (edge kind ``accepted``)
    whenever both endpoints are on the canvas. Endpoints are normalized
    (``issuer_a`` < ``issuer_b`` lexically) so a pair exists once regardless of
    proposal direction. Only issuer↔issuer links are acceptable — run-scoped nodes
    (claims, modules) have no stable identity across runs."""

    __tablename__ = "query_accepted_links"
    __table_args__ = (
        UniqueConstraint("issuer_a", "issuer_b", name="uq_accepted_link_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_a: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    issuer_b: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    capability_id: Mapped[str] = mapped_column(String(64), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, default="")
    chunk_ids: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[str] = mapped_column(String(16), default="Low")
    model: Mapped[str] = mapped_column(String(128), default="")
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class QueryOverlay(Base):
    """A persisted model-overlay artifact for one Query graph (frozen, reproducible).

    The overlay lane proposes links/commentary over a deterministic graph; the
    validated output is persisted so an exhibit references a fixed record
    (model id + payload + timestamp), never a fresh non-reproducible call.
    ``graph_hash`` keys the cache: same capability + same underlying graph →
    same artifact, no repeat spend."""

    __tablename__ = "query_overlays"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    capability_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    graph_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class QueryInsight(Base):
    """A persisted Desk Brief — the proactive AI-research artifact for Query (Q1).

    The insights lane builds a deterministic evidence pack from what changed in
    the book, has the model write cited cards over it, drops any card that cites
    nothing real or states an ungrounded number, and persists the survivors here.
    ``data_fingerprint`` keys freshness: an unchanged scope (same fingerprint) is
    never regenerated, so the desk pays at most one LLM call per 24h per scope.
    ``analyst_id`` records the SCOPE: ``NULL`` = the shared book-level brief
    (served to every analyst with no watchlist); a set value = a per-analyst
    brief scoped to that analyst's watchlist (Phase-2 personalization)."""

    __tablename__ = "query_insights"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    data_fingerprint: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # None = deterministic
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class QueryAnswer(Base):
    """A persisted grounded AI answer for one typed Query question (Q2 / D2).

    Retrieval-grounded prose written beside the deterministic walk: every kept
    sentence cites a real chunk/node/fact and states only grounded figures.
    Cached by ``(question_hash, data_fingerprint)`` so a repeat question over an
    unchanged corpus is free."""

    __tablename__ = "query_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    question_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    data_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class LLMCallRecord(Base):
    """Run ledger for LLM call accounting."""

    __tablename__ = "llm_call_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    lane: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    prompt_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    cost: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16), default="success")  # success|failed
    kept_count: Mapped[Optional[int]] = mapped_column(Integer)
    dropped_count: Mapped[Optional[int]] = mapped_column(Integer)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class LineageEdge(Base):
    """Lineage DAG showing derivation edges between artifacts."""

    __tablename__ = "lineage_edges"
    __table_args__ = (
        UniqueConstraint("v2_idempotency_key", name="uq_lineage_edges_v2_idempotency_key"),
        Index("ix_lineage_edges_context_created", "context_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    artifact_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    parent_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    transform: Mapped[str] = mapped_column(String(64), nullable=False)
    transform_version: Mapped[str] = mapped_column(String(32), nullable=False)
    # Phase 1 lineage v2 is additive. All fields remain nullable so existing
    # lineage rows are neither rewritten nor forced into a synthetic scope.
    context_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("analysis_contexts.id", ondelete="CASCADE"), nullable=True
    )
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    artifact_kind: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    artifact_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    parent_kind: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    parent_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    v2_idempotency_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DocumentChunkEmbedding(Base):
    """Semantic vector embedding for a document chunk."""

    __tablename__ = "document_chunk_embeddings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    chunk_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    vector: Mapped[list[float]] = mapped_column(SafeVector(768), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        Index("ix_chunk_embeddings_lookup", "model", "chunk_hash", unique=True),
        Index(
            "ix_chunk_embeddings_vector",
            "vector",
            postgresql_using="hnsw",
            postgresql_ops={"vector": "vector_cosine_ops"},
        ),
    )


class AnalystQaFlag(Base):
    """An analyst-raised QA flag on a module/step output (Deep-Dive register).

    Deliberately NOT a QAFinding: engine findings gate runs (CP-5 abort, 409 on
    committee export), while an analyst flag is an audit-trail escalation that
    must never trip those gates. issuer_id/run_id are plain strings (no FK) so
    the flag survives its subject — it is an audit record, not run state.
    """
    __tablename__ = "qa_flags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    run_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    module_id: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    step_ref: Mapped[Optional[str]] = mapped_column(String(120))
    note: Mapped[Optional[str]] = mapped_column(Text)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AlertState(Base):
    """Ack/assign/resolve for one Watchtower alert (Command's ranked changes +
    Monitor's alert inbox share this — same row, same truth, both surfaces
    read it via lib/alerts/inbox.ts on the frontend).

    `alert_key` is deterministic from the autonomy draft — f"{run_id}:{issuer_id}:
    {kind}:{metric}" — and unique: a second POST for the same key upserts rather
    than duplicating. Cycle-scoped on purpose: a later cycle re-firing the same
    anomaly kind/metric for an issuer is a genuinely NEW event (the Sentinel is
    change-driven), so it correctly starts open again rather than inheriting a
    stale ack. Plain strings (no FK) — audit record, not run state, same shape
    as AnalystQaFlag above.

    `state` is a fail-closed lattice — open(0) < ack(1) < resolved(2); the route
    layer (routes/alerts.py) rejects a regression with 409 rather than silently
    accepting it. `resolved_at` is stamped server-side the moment `state` first
    reaches "resolved" (never client-supplied, so it can't be backdated).
    """
    __tablename__ = "alert_states"
    # Named to match migration 0038's unique index so `alembic check`
    # reconciles; a bare `unique=True` reflects as an unnamed constraint and
    # drifts (same pattern as Analyst.email above).
    __table_args__ = (Index("uq_alert_states_alert_key", "alert_key", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    alert_key: Mapped[str] = mapped_column(String(160), nullable=False)
    state: Mapped[str] = mapped_column(String(16), nullable=False)
    assignee: Mapped[Optional[str]] = mapped_column(String(120))
    note: Mapped[Optional[str]] = mapped_column(Text)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Server-stamped the instant `state` first becomes "resolved" — never
    # accepted from the client, so a resolution can't be backdated or forged.
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[Optional[str]] = mapped_column(Text)


class Decision(Base):
    """Immutable IC decision snapshot. Status may reopen; snapshot never mutates."""
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id"), index=True)
    report_id: Mapped[Optional[str]] = mapped_column(String(64))
    portfolio_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("portfolios.id"), index=True
    )
    agenda_item_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("committee_agenda_items.id"), unique=True
    )
    report_version_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("report_versions.id"), index=True
    )
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    conditions: Mapped[list] = mapped_column(JSON, default=list)
    expiry: Mapped[Optional[date]] = mapped_column(Date)
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    snapshot_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    reopened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    reopen_alert_key: Mapped[Optional[str]] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DecisionVote(Base):
    __tablename__ = "decision_votes"
    __table_args__ = (UniqueConstraint("decision_id", "member", name="uq_decision_vote_member"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    decision_id: Mapped[str] = mapped_column(String(36), ForeignKey("decisions.id"), index=True)
    member: Mapped[str] = mapped_column(String(255), nullable=False)
    vote: Mapped[str] = mapped_column(String(16), nullable=False)
    dissent_note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CommitteeAgendaItem(Base):
    """Mutable committee preparation that freezes into one immutable decision."""

    __tablename__ = "committee_agenda_items"
    __table_args__ = (
        UniqueConstraint("finalized_decision_id", name="uq_agenda_finalized_decision"),
        Index("ix_agenda_issuer_scheduled", "issuer_id", "scheduled_for"),
        Index("ix_agenda_portfolio_scheduled", "portfolio_id", "scheduled_for"),
        Index("ix_agenda_owner_status", "owner_id", "status"),
        Index("ix_agenda_status_scheduled", "status", "scheduled_for"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), nullable=False)
    portfolio_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("portfolios.id"))
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recommendation: Mapped[str] = mapped_column(String(16), nullable=False)
    conviction: Mapped[Optional[float]] = mapped_column(Float)
    thesis: Mapped[str] = mapped_column(Text, nullable=False)
    conditions: Mapped[list] = mapped_column(JSON, default=list)
    expiry: Mapped[Optional[date]] = mapped_column(Date)
    run_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("runs.id"), index=True)
    report_version_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("report_versions.id"), index=True
    )
    context_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("analysis_contexts.id"), index=True
    )
    # The mutable agenda points at one immutable analyst view. IC action and
    # analyst stance deliberately remain separate records and vocabularies.
    analyst_opinion_version_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("analyst_opinion_versions.id"), index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    finalized_decision_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("decisions.id")
    )
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    snapshot_sha256: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class CommitteeEvidenceException(Base):
    """A time-bounded, independently reviewed exception to IC readiness.

    This never alters the CP-5 run state. Its basis captures the exact run and
    non-critical gap a reviewer inspected, so a changed run or expired approval
    cannot be reused during finalization.
    """

    __tablename__ = "committee_evidence_exceptions"
    __table_args__ = (
        Index("ix_committee_exception_agenda_requested", "agenda_item_id", "requested_at"),
        Index("ix_committee_exception_status_expiry", "status", "expires_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    agenda_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("committee_agenda_items.id"), nullable=False, index=True
    )
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id"), nullable=False, index=True)
    basis_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    failure_codes: Mapped[list] = mapped_column(JSON, default=list)
    finding_ids: Mapped[list] = mapped_column(JSON, default=list)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    mitigants: Mapped[list] = mapped_column(JSON, default=list)
    expires_at: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    requested_by: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    review_note: Mapped[Optional[str]] = mapped_column(Text)
    revoked_by: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class ThesisVersion(Base):
    __tablename__ = "thesis_versions"
    __table_args__ = (UniqueConstraint("issuer_id", "version", name="uq_thesis_issuer_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    thesis_md: Mapped[str] = mapped_column(Text, nullable=False)
    trigger: Mapped[str] = mapped_column(String(24), nullable=False)
    linked_decision_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("decisions.id"), index=True)
    linked_alert_key: Mapped[Optional[str]] = mapped_column(String(160))
    created_by: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalystOpinionVersion(Base):
    """An analyst-owned, append-only investment view for one issuer.

    The deterministic CP recommendation remains independent. A version captures
    the analyst's own stance, evidence posture, and references without turning
    long-form vault notes into a second authoring system.
    """

    __tablename__ = "analyst_opinion_versions"
    __table_args__ = (
        UniqueConstraint(
            "analyst_id", "issuer_id", "version", name="uq_analyst_opinion_issuer_version"
        ),
        Index("ix_analyst_opinion_issuer_created", "issuer_id", "created_at"),
        Index("ix_analyst_opinion_analyst_issuer", "analyst_id", "issuer_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analyst_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    stance: Mapped[str] = mapped_column(String(16), nullable=False)
    conviction: Mapped[Optional[float]] = mapped_column(Float)
    rationale_md: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_state: Mapped[str] = mapped_column(String(16), nullable=False)
    unresolved_items: Mapped[list] = mapped_column(JSON, default=list)
    thesis_version_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("thesis_versions.id"), index=True
    )
    source_run_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("runs.id"), index=True)
    context_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("analysis_contexts.id"), index=True
    )
    analyst_link_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ThesisPrediction(Base):
    __tablename__ = "thesis_predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    thesis_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("thesis_versions.id"), index=True)
    metric: Mapped[str] = mapped_column(String(120), nullable=False)
    horizon: Mapped[date] = mapped_column(Date, nullable=False)
    predicted: Mapped[float] = mapped_column(Float, nullable=False)
    realized: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ─── Portfolio posture (managed CLO: holdings + constraints) ─────────────────
# A portfolio is a managed book (e.g. a CLO) built from an uploaded holdings file.
# Exposure and constraint compliance are COMPUTED deterministically from positions
# (engine/portfolio.py) — nothing here caches a derived %; the holdings are the
# source of truth. Feeds CP-3C's live concentration register (via Run.portfolio_id).


class Portfolio(Base):
    """A managed book (CLO) — the envelope its positions + constraints hang off."""

    __tablename__ = "portfolios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default="CLO")
    as_of_date: Mapped[Optional[str]] = mapped_column(String(32))
    # Free-form mandate facts (cap structure / parties / fees / non-call), parsed
    # from the mandate file — a roll-up for display, like ModuleOutput.runtime_output.
    mandate: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[Optional[str]] = mapped_column(String(255))
    team_id: Mapped[Optional[str]] = mapped_column(String(128), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PortfolioPosition(Base):
    """One CLO position (a held loan). ``par_usd`` is the CLO's par holding ($);
    ``facility_musd`` is the loan's total facility size ($M, reference only).
    ``issuer_id`` soft-links to a registered issuer when one matches (else NULL —
    positions don't require an issuer to exist)."""

    __tablename__ = "portfolio_positions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    portfolio_id: Mapped[str] = mapped_column(String(36), ForeignKey("portfolios.id"), index=True)
    issuer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    borrower_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ticker: Mapped[Optional[str]] = mapped_column(String(32))
    figi: Mapped[Optional[str]] = mapped_column(String(32))
    loan_name: Mapped[Optional[str]] = mapped_column(String(255))
    sector: Mapped[Optional[str]] = mapped_column(String(128))
    sub_sector: Mapped[Optional[str]] = mapped_column(String(128))
    ranking: Mapped[Optional[str]] = mapped_column(String(64))
    rating_moody: Mapped[Optional[str]] = mapped_column(String(16))
    rating_sp: Mapped[Optional[str]] = mapped_column(String(16))
    par_usd: Mapped[float] = mapped_column(Float, nullable=False)
    facility_musd: Mapped[Optional[float]] = mapped_column(Float)
    margin_bps: Mapped[Optional[float]] = mapped_column(Float)
    maturity: Mapped[Optional[str]] = mapped_column(String(32))
    price: Mapped[Optional[float]] = mapped_column(Float)
    ytm: Mapped[Optional[float]] = mapped_column(Float)
    dm: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PortfolioConstraint(Base):
    """A constraint *definition* (limit) for a portfolio. Current / headroom /
    status are COMPUTED against live exposure (engine.portfolio.check_constraints),
    never stored — the definition is the durable part."""

    __tablename__ = "portfolio_constraints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    portfolio_id: Mapped[str] = mapped_column(String(36), ForeignKey("portfolios.id"), index=True)
    code: Mapped[Optional[str]] = mapped_column(String(16))
    category: Mapped[Optional[str]] = mapped_column(String(64))
    parameter: Mapped[Optional[str]] = mapped_column(String(255))
    limit_text: Mapped[Optional[str]] = mapped_column(String(128))
    limit_value: Mapped[Optional[float]] = mapped_column(Float)
    limit_unit: Mapped[Optional[str]] = mapped_column(String(32))
    limit_op: Mapped[Optional[str]] = mapped_column(String(8))
    breach_type: Mapped[Optional[str]] = mapped_column(String(16))
    source_document: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PortfolioStressRun(Base):
    """Immutable deterministic stress snapshot for one managed portfolio."""

    __tablename__ = "portfolio_stress_runs"
    __table_args__ = (
        Index("ix_portfolio_stress_runs_portfolio_created", "portfolio_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    portfolio_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("portfolios.id"), nullable=False
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    inputs: Mapped[dict] = mapped_column(JSON, nullable=False)
    output: Mapped[dict] = mapped_column(JSON, nullable=False)
    source_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    authority: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="complete")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PipelineRun(Base):
    """A durable autonomous-cycle run (Phase 3 remainder) — the committee-
    defensibility audit trail + the multi-worker shared prior.

    ``routes/autonomy`` enqueues one ``queued`` row per cycle (via
    ``pipeline.enqueue_cycle``); the ``PipelineExecutor`` claims it
    (``SELECT FOR UPDATE SKIP LOCKED`` on Postgres) and runs
    ``autonomy.run_cycle`` to ``complete`` (or ``failed``). The next cycle
    reads the latest ``complete`` row's ``current_fingerprints`` as its prior
    (cold-start / second-worker resume). Mirrors ``research_jobs`` (migration
    0010): additive, no edits to existing tables."""

    __tablename__ = "pipeline_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String(32), default="autonomy-cycle", index=True)
    # queued|running|complete|failed — running is the durable claimed attempt,
    # complete is the audit row + prior source, failed is exhausted/terminal.
    status: Mapped[str] = mapped_column(String(16), default="complete")
    prior_fingerprints: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    current_fingerprints: Mapped[dict] = mapped_column(JSON, default=dict)
    draft: Mapped[dict] = mapped_column(JSON, default=dict)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    worker_id: Mapped[Optional[str]] = mapped_column(String(64))
    # Boot-sweep lease (see migrations/0038_background_job_leases) — gates the
    # reap so one replica's boot can't kill another replica's live cycle.
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


def _alembic_config():
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(SERVER_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    return cfg


def _schema_state(sync_conn) -> dict:
    names = set(inspect(sync_conn).get_table_names())
    # A pre-Alembic database has the baseline tables but no version table.
    return {"versioned": "alembic_version" in names, "legacy": "issuers" in names}


def _run_migrations(state: dict) -> None:
    """Bring the schema to head, stamping a pre-Alembic database first.

    Runs in a worker thread (env.py drives its own event loop), so this must not
    be called from within the running loop directly.
    """
    from alembic import command

    cfg = _alembic_config()
    if not state["versioned"] and state["legacy"]:
        command.stamp(cfg, "0001")  # adopt Alembic on an existing baseline DB
    command.upgrade(cfg, "head")


# Arbitrary fixed key for the boot-migration Postgres advisory lock. Any constant
# works as long as it's stable across replicas; chosen once and never reused for
# another lock. (pg_advisory_lock takes a single bigint.)
_MIGRATION_LOCK_KEY = 728_041_153_002


async def init_db() -> None:
    async with engine.connect() as conn:
        state = await conn.run_sync(_schema_state)

    # On Postgres, serialize the migration across replicas: ``init_db`` runs
    # ``alembic upgrade head`` on every boot, so >1 replica booting together could
    # otherwise race on DDL. A session-level advisory lock makes concurrent boots
    # queue — the first holder migrates, the rest block then no-op (already at
    # head). SQLite (the test DB / single-node dev) has no advisory locks and no
    # concurrent-boot story, so skip the lock there entirely.
    if engine.dialect.name == "postgresql":
        from sqlalchemy import text

        # A dedicated AUTOCOMMIT connection holds the session-level lock for the
        # whole upgrade. AUTOCOMMIT so there's no open transaction to interfere
        # with alembic's own connection; a session-level advisory lock persists on
        # this connection regardless until we unlock. Release in finally so a failed
        # migration can't leave the key held and wedge every other replica's boot
        # (and closing the connection would release it anyway as a backstop).
        async with engine.connect() as lock_conn:
            lock_conn = await lock_conn.execution_options(isolation_level="AUTOCOMMIT")
            await lock_conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": _MIGRATION_LOCK_KEY})
            try:
                # Re-read the schema snapshot INSIDE the lock: the read at the top of
                # init_db happens before we serialize, so a racing replica that migrated
                # in the gap would otherwise leave us acting on a stale {legacy,versioned}
                # view — re-stamping 0001 and re-running DDL on an already-migrated schema.
                # (confidence-review 2026-07-01)
                state = await lock_conn.run_sync(_schema_state)
                await asyncio.to_thread(_run_migrations, state)
            finally:
                await lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _MIGRATION_LOCK_KEY})
    else:
        await asyncio.to_thread(_run_migrations, state)


async def get_db():
    """FastAPI dependency: yields an async session, commits on success.

    Always inject as ``Depends(get_db, scope="function")``. FastAPI >=0.115's
    default yield-dependency scope ("request") runs this commit AFTER the
    response is already sent to the client — a client that immediately acts on
    a just-created row (e.g. POST /api/issuers/ then POST /api/runs with the
    returned id) can then read a pre-commit snapshot and get a false 404. Bit
    us in caos/tests/frontend/e2e/bootstrap_flow.spec.ts under CI-level
    scheduling delay (unreproducible on a fast idle machine). scope="function"
    restores commit-before-response.
    """
    async with AsyncSessionLocal() as session:
        route_completed = False
        try:
            yield session
            route_completed = True
            await session.commit()
            await _run_after_commit_callbacks(session)
            session.info.pop(_ROLLBACK_CLEANUPS_KEY, None)
        # Cancellation inherits from BaseException, not Exception. A client
        # disconnect before the route returns must still roll back and release
        # any dependency-owned external objects before the cancellation escapes.
        except BaseException:
            await session.rollback()
            if not route_completed:
                await _run_rollback_cleanups(session)
            else:
                # A commit-time connection failure can be reported after the
                # transaction became durable. Retain external objects rather
                # than risk committed rows pointing at deleted bytes.
                session.info.pop(_ROLLBACK_CLEANUPS_KEY, None)
                session.info.pop(_AFTER_COMMIT_CALLBACKS_KEY, None)
            raise


def _erasure_principal(analyst_id: str) -> str:
    digest = hashlib.sha256(analyst_id.encode("utf-8")).hexdigest()[:20]
    return f"erased:{digest}"


def _redact_embedded_identity(value, keys: list[str], pseudonym: str):
    if isinstance(value, dict):
        return {
            key: _redact_embedded_identity(item, keys, pseudonym)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_embedded_identity(item, keys, pseudonym) for item in value]
    if isinstance(value, str):
        redacted = value
        for key in keys:
            redacted = redacted.replace(key, pseudonym)
        return redacted
    return value


def _privacy_redacted_snapshot(
    snapshot: dict, *, keys: list[str], pseudonym: str, prior_hash: str
) -> tuple[dict, str] | None:
    redacted = _redact_embedded_identity(snapshot, keys, pseudonym)
    if redacted == snapshot:
        return None
    redacted["privacy_redaction"] = {
        "principal": pseudonym,
        "prior_snapshot_sha256": prior_hash,
    }
    canonical = json.dumps(redacted, sort_keys=True, separators=(",", ":"), default=str)
    return json.loads(canonical), hashlib.sha256(canonical.encode()).hexdigest()


async def erase_analyst_data(
    session: AsyncSession, *, analyst_id: str, email: Optional[str] = None
) -> dict[str, int]:
    """GDPR right-to-erasure for one analyst (the data subject).

    Deletes the analyst's *owned, private* data (Deep Research jobs) and the
    Analyst row itself (the name + email PII), and *anonymizes* their attribution
    on shared institutional work product (runs, uploaded documents) — the desk's
    analysis is firm work product and is retained, only the personal link is
    scrubbed. ``analyst_id``/``uploaded_by`` are loose string stamps, not FKs, so
    runs/documents do not cascade because their identity stamps are loose strings.
    V2 lineage is explicitly deleted before its context, with the context FK's
    cascade retained only as a database backstop. Runs stamp ``analyst_id`` and
    research jobs key on the analyst id, while documents stamp the email — so scrub both keys.
    Returns the row counts touched. Commits itself (see below) so both callers —
    the self-service route and the operator CLI — get an atomic erase.
    """
    keys = [k for k in (analyst_id, email) if k]
    pseudonym = _erasure_principal(analyst_id)
    owned_report_ids = list((await session.execute(
        select(ReportVersion.id).where(ReportVersion.analyst_id.in_(keys))
    )).scalars().all())
    owned_context_ids = list((await session.execute(
        select(AnalysisContextRecord.id).where(AnalysisContextRecord.analyst_id.in_(keys))
    )).scalars().all())
    owned_manifest_ids = list((await session.execute(
        select(SourceManifest.id).where(SourceManifest.analyst_id.in_(keys))
    )).scalars().all())

    # Delete private versioned artifacts before their owning analysis contexts.
    # Reports reference checkpoints, while checkpoints and research jobs
    # reference contexts, so the order here is intentionally dependency-first.
    # Draft committee preparation is private workspace state; finalized agenda
    # and decisions are immutable firm work product. Retain the latter while
    # removing the personal attribution and nullable private-artifact links.
    agenda_drafts = await session.execute(
        delete(CommitteeAgendaItem).where(
            CommitteeAgendaItem.owner_id.in_(keys),
            CommitteeAgendaItem.status != "decided",
        )
    )
    finalized_agenda = await session.execute(
        update(CommitteeAgendaItem).where(
            CommitteeAgendaItem.owner_id.in_(keys),
            CommitteeAgendaItem.status == "decided",
        ).values(owner_id=pseudonym, report_version_id=None, context_id=None)
    )
    if owned_report_ids:
        await session.execute(
            update(CommitteeAgendaItem).where(
                CommitteeAgendaItem.report_version_id.in_(owned_report_ids)
            ).values(report_version_id=None)
        )
        await session.execute(
            update(Decision).where(
                Decision.report_version_id.in_(owned_report_ids)
            ).values(report_version_id=None)
        )
    if owned_context_ids:
        await session.execute(
            update(CommitteeAgendaItem).where(
                CommitteeAgendaItem.context_id.in_(owned_context_ids)
            ).values(context_id=None)
        )
    decisions_anonymized = await session.execute(
        update(Decision).where(Decision.created_by.in_(keys)).values(created_by=pseudonym)
    )
    decision_votes_anonymized = await session.execute(
        update(DecisionVote).where(DecisionVote.member.in_(keys)).values(member=pseudonym)
    )
    thesis_versions_anonymized = await session.execute(
        update(ThesisVersion).where(ThesisVersion.created_by.in_(keys)).values(
            created_by=pseudonym
        )
    )
    snapshots_redacted = 0
    finalized_rows = list((await session.execute(
        select(CommitteeAgendaItem).where(CommitteeAgendaItem.status == "decided")
    )).scalars().all())
    for agenda in finalized_rows:
        result = _privacy_redacted_snapshot(
            agenda.snapshot or {},
            keys=keys,
            pseudonym=pseudonym,
            prior_hash=agenda.snapshot_sha256 or "",
        )
        if result is None:
            continue
        agenda.snapshot, agenda.snapshot_sha256 = result
        snapshots_redacted += 1
        if agenda.finalized_decision_id:
            linked = await session.get(Decision, agenda.finalized_decision_id)
            if linked is not None:
                linked.snapshot = agenda.snapshot
                linked.snapshot_sha256 = agenda.snapshot_sha256
    linked_decision_ids = {
        row.finalized_decision_id for row in finalized_rows if row.finalized_decision_id
    }
    other_decisions = list((await session.execute(
        select(Decision).where(Decision.id.not_in(linked_decision_ids))
    )).scalars().all()) if linked_decision_ids else list((await session.execute(
        select(Decision)
    )).scalars().all())
    for decision in other_decisions:
        result = _privacy_redacted_snapshot(
            decision.snapshot or {},
            keys=keys,
            pseudonym=pseudonym,
            prior_hash=decision.snapshot_sha256,
        )
        if result is not None:
            decision.snapshot, decision.snapshot_sha256 = result
            snapshots_redacted += 1
    analysis_insights = await session.execute(
        delete(AnalysisInsight).where(AnalysisInsight.analyst_id.in_(keys))
    )
    notifications = await session.execute(
        delete(NotificationEvent).where(NotificationEvent.analyst_id.in_(keys))
    )
    portfolio_stress_runs = await session.execute(
        delete(PortfolioStressRun).where(PortfolioStressRun.created_by.in_(keys))
    )
    # Model Engine v2 drafts, override history, and import ledgers are private
    # analyst workspace state.  Imports reference both drafts and manifests;
    # override events reference drafts, so delete dependency-first.
    model_workbook_imports = await session.execute(
        delete(ModelWorkbookImport).where(ModelWorkbookImport.analyst_id.in_(keys))
    )
    model_override_events = await session.execute(
        delete(ModelOverrideEvent).where(ModelOverrideEvent.analyst_id.in_(keys))
    )
    model_drafts_v2 = await session.execute(
        delete(ModelDraftV2).where(ModelDraftV2.analyst_id.in_(keys))
    )
    report_versions = await session.execute(
        delete(ReportVersion).where(ReportVersion.analyst_id.in_(keys))
    )
    report_drafts = await session.execute(
        delete(ReportDraft).where(ReportDraft.analyst_id.in_(keys))
    )
    checkpoints = await session.execute(
        delete(ModelCheckpoint).where(ModelCheckpoint.analyst_id.in_(keys))
    )
    if owned_manifest_ids:
        await session.execute(
            update(MarketSnapshot)
            .where(MarketSnapshot.source_manifest_id.in_(owned_manifest_ids))
            .values(source_manifest_id=None)
        )
    await session.execute(
        update(MarketSnapshot)
        .where(MarketSnapshot.analyst_id.in_(keys))
        .values(analyst_id=pseudonym)
    )
    manifests = await session.execute(
        delete(SourceManifest).where(SourceManifest.analyst_id.in_(keys))
    )
    research = await session.execute(
        delete(ResearchJob).where(ResearchJob.analyst_id.in_(keys))
    )
    # SavedModel rows are the analyst's PRIVATE Model Builder state (per-analyst
    # overrides/assumptions, not shared work product) keyed on their uuid — a
    # re-registration mints a fresh uuid, so undeleted rows would orphan forever
    # while still holding the subject's personal work. Delete, don't anonymize.
    models = await session.execute(
        delete(SavedModel).where(SavedModel.analyst_id.in_(keys))
    )
    # Analysis contexts, investigations and findings are private analyst
    # workspace state. Delete dependents before their owning contexts.
    await session.execute(
        delete(AnalysisFinding).where(AnalysisFinding.analyst_id.in_(keys))
    )
    await session.execute(
        delete(AnalysisQueryRun).where(AnalysisQueryRun.analyst_id.in_(keys))
    )
    await session.execute(
        delete(RVCandidate).where(
            RVCandidate.run_id.in_(
                select(RVScreenRun.id).where(RVScreenRun.analyst_id.in_(keys))
            )
        )
    )
    await session.execute(
        delete(RVScreenRun).where(RVScreenRun.analyst_id.in_(keys))
    )
    await session.execute(
        delete(SectorReviewRatification).where(SectorReviewRatification.analyst_id.in_(keys))
    )
    # V2 lineage is private analyst workspace state and carries the raw analyst
    # identifier. Delete it explicitly before its context; the FK CASCADE is a
    # database backstop for non-erasure context deletion, not the privacy policy.
    lineage_edges = await session.execute(
        delete(LineageEdge).where(or_(
            LineageEdge.analyst_id.in_(keys),
            LineageEdge.context_id.in_(owned_context_ids),
        ))
    )
    await session.execute(
        delete(AnalysisContextRecord).where(AnalysisContextRecord.analyst_id.in_(keys))
    )
    runs = await session.execute(
        update(Run).where(Run.analyst_id.in_(keys)).values(analyst_id=None)
    )
    reporting_profiles = await session.execute(
        update(IssuerReportingProfile)
        .where(IssuerReportingProfile.updated_by.in_(keys))
        .values(updated_by=None)
    )
    docs_anonymized = 0
    if email:
        docs = await session.execute(
            update(Document).where(Document.uploaded_by == email).values(uploaded_by=None)
        )
        docs_anonymized = docs.rowcount or 0  # type: ignore[attr-defined]  # CursorResult.rowcount, not on base Result
    await session.execute(
        update(Document).where(Document.analyst_id.in_(keys)).values(analyst_id=pseudonym)
    )
    profile = await session.execute(delete(Analyst).where(Analyst.id == analyst_id))
    await session.commit()
    return {
        "research_jobs_deleted": research.rowcount or 0,  # type: ignore[attr-defined]
        "source_manifests_deleted": manifests.rowcount or 0,  # type: ignore[attr-defined]
        "model_checkpoints_deleted": checkpoints.rowcount or 0,  # type: ignore[attr-defined]
        "report_drafts_deleted": report_drafts.rowcount or 0,  # type: ignore[attr-defined]
        "report_versions_deleted": report_versions.rowcount or 0,  # type: ignore[attr-defined]
        "analysis_insights_deleted": analysis_insights.rowcount or 0,  # type: ignore[attr-defined]
        "notification_events_deleted": notifications.rowcount or 0,  # type: ignore[attr-defined]
        "lineage_edges_deleted": lineage_edges.rowcount or 0,  # type: ignore[attr-defined]
        "portfolio_stress_runs_deleted": portfolio_stress_runs.rowcount or 0,  # type: ignore[attr-defined]
        "model_workbook_imports_deleted": model_workbook_imports.rowcount or 0,  # type: ignore[attr-defined]
        "model_override_events_deleted": model_override_events.rowcount or 0,  # type: ignore[attr-defined]
        "model_drafts_v2_deleted": model_drafts_v2.rowcount or 0,  # type: ignore[attr-defined]
        "committee_agenda_deleted": agenda_drafts.rowcount or 0,  # type: ignore[attr-defined]
        "committee_agenda_anonymized": finalized_agenda.rowcount or 0,  # type: ignore[attr-defined]
        "decisions_anonymized": decisions_anonymized.rowcount or 0,  # type: ignore[attr-defined]
        "decision_votes_anonymized": decision_votes_anonymized.rowcount or 0,  # type: ignore[attr-defined]
        "thesis_versions_anonymized": thesis_versions_anonymized.rowcount or 0,  # type: ignore[attr-defined]
        "committee_snapshots_redacted": snapshots_redacted,
        "saved_models_deleted": models.rowcount or 0,  # type: ignore[attr-defined]
        "runs_anonymized": runs.rowcount or 0,  # type: ignore[attr-defined]
        "reporting_profiles_anonymized": reporting_profiles.rowcount or 0,  # type: ignore[attr-defined]
        "documents_anonymized": docs_anonymized,
        "profile_deleted": profile.rowcount or 0,  # type: ignore[attr-defined]
    }


@event.listens_for(Issuer, "before_insert")
@event.listens_for(Issuer, "before_update")
def _set_issuer_identity_keys(_mapper, _connection, target):
    normalized = target.name.strip()
    target.name = normalized
    target.normalized_name = normalized.casefold()
    target.uniqueness_scope = target.team_id or ""


@event.listens_for(DocumentChunk, "before_insert")
def _set_chunk_hash_insert(_mapper, _connection, target):
    if target.text:
        import hashlib
        target.chunk_hash = hashlib.sha256(target.text.encode("utf-8")).hexdigest()


@event.listens_for(DocumentChunk, "before_update")
def _set_chunk_hash_update(_mapper, _connection, target):
    if target.text:
        import hashlib
        target.chunk_hash = hashlib.sha256(target.text.encode("utf-8")).hexdigest()
