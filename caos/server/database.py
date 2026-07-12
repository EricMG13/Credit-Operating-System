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
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, delete, event, inspect, text, update, Computed,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
import json
from sqlalchemy.types import TypeDecorator, UnicodeText
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.ext.compiler import compiles

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
# NullPool in test mode avoids cross-loop connection reuse. Production keeps the
# default pool (5 + 10 overflow).
# ponytail: pool size and caos_run_concurrency are COUPLED (BE8-1) — each active
# run holds one connection for its whole transaction, so raising the run
# concurrency toward ~13+ without an explicit pool_size here exhausts the pool
# and stalls requests for pool_timeout. Inert at the shipped default (2 runs vs
# 15 slots); size pool_size ≈ caos_run_concurrency + request headroom if you
# ever raise it.
_engine_kwargs: dict = {"pool_pre_ping": True}
if os.environ.get("CAOS_TEST") == "1":
    _engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.database_url, **_engine_kwargs)

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
    ticker: Mapped[Optional[str]] = mapped_column(String(32))
    industry: Mapped[Optional[str]] = mapped_column(String(128))
    sub_sector: Mapped[Optional[str]] = mapped_column(String(128))
    country: Mapped[Optional[str]] = mapped_column(String(128))
    figi: Mapped[Optional[str]] = mapped_column(String(32))
    # Analyst-entered agency ratings (no free ratings feed). NULL = not rated.
    rating_sp: Mapped[Optional[str]] = mapped_column(String(16))
    rating_moody: Mapped[Optional[str]] = mapped_column(String(16))
    rating_fitch: Mapped[Optional[str]] = mapped_column(String(16))
    # Analyst-entered private-equity sponsor (exact-string grouped by the sponsor
    # track-record view — no free ownership feed). NULL = not sponsor-owned/unknown.
    sponsor: Mapped[Optional[str]] = mapped_column(String(255))
    # Optional multi-team tenancy anchor (migration 0023). NULL = shared/global
    # (visible to every team, e.g. the reference demo issuer); a non-null value scopes
    # this issuer — and everything keyed off it (runs, documents, metric_facts,
    # portfolio) — to one team when CAOS_TENANCY_ENABLED is set. Inert by default.
    team_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    # Who created this row (Analyst.id, or the proxy email identity — mirrors
    # Run.analyst_id). NULL for seed + pre-0023 rows. Governance attribution for
    # the analyst-entered ratings/sponsor above. SEAM4-4.
    created_by: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


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
    __table_args__ = (Index("uq_analyst_email", "email", unique=True),)

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
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
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
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    run_mode: Mapped[Optional[str]] = mapped_column(String(16))
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    fiscal_period: Mapped[Optional[str]] = mapped_column(String(64))
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
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    parent_run_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("runs.id"))
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued|running|complete|failed
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255))
    as_of_date: Mapped[Optional[str]] = mapped_column(String(32))
    # Reproducibility: pin the model and methodology version each run saw.
    model_id: Mapped[Optional[str]] = mapped_column(String(64))
    prompt_version: Mapped[Optional[str]] = mapped_column(String(32))
    # Analyst-selected model mode (engine/presets.py) — persisted so the
    # background runner applies the same TEST/LITE/BALANCED/MAX tier the creating
    # request chose, including across a re-claim. NULL = the default mode.
    model_mode: Mapped[Optional[str]] = mapped_column(String(16))
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
    brief: Mapped[dict] = mapped_column(JSON, default=dict)
    report: Mapped[Optional[str]] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON, default=list)
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
        Index("ix_sector_review_runs_sector_as_of", "sector", "as_of"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    sector: Mapped[str] = mapped_column(String(128), nullable=False)
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    artifact_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    parent_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    transform: Mapped[str] = mapped_column(String(64), nullable=False)
    transform_version: Mapped[str] = mapped_column(String(32), nullable=False)
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


class PipelineRun(Base):
    """A durable autonomous-cycle run (Phase 3 remainder) — the committee-
    defensibility audit trail + the multi-worker shared prior.

    ``routes/autonomy`` enqueues one ``running`` row per cycle (via
    ``pipeline.enqueue_cycle``); the ``PipelineExecutor`` claims it
    (``SELECT FOR UPDATE SKIP LOCKED`` on Postgres) and runs
    ``autonomy.run_cycle`` to ``complete`` (or ``failed``). The next cycle
    reads the latest ``complete`` row's ``current_fingerprints`` as its prior
    (cold-start / second-worker resume). Mirrors ``research_jobs`` (migration
    0010): additive, no edits to existing tables."""

    __tablename__ = "pipeline_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String(32), default="autonomy-cycle", index=True)
    # running|complete|failed — running is the durable claim (SKIP LOCKED target),
    # complete is the audit row + prior source, failed is the swept strand.
    status: Mapped[str] = mapped_column(String(16), default="complete")
    prior_fingerprints: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    current_fingerprints: Mapped[dict] = mapped_column(JSON, default=dict)
    draft: Mapped[dict] = mapped_column(JSON, default=dict)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    worker_id: Mapped[Optional[str]] = mapped_column(String(64))
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    """Append-only mutation trail (E3, PRE_DEPLOYMENT_PLAN §7) — who/what/when
    on every route that changes persisted state. Written via ``audit.write``
    in the SAME transaction as the mutation it records (never a separate
    commit), so a rolled-back mutation never leaves an orphan audit row.

    ``analyst_id`` is a loose string stamp (like ``Run.analyst_id``), not a
    FK — GDPR erasure (``erase_analyst_data``) anonymizes it to NULL on the
    subject's own rows, exactly like it anonymizes ``Run.analyst_id``; the
    row itself (action/target/before/after) is retained as firm compliance
    history, only the personal link is scrubbed. No IP/user-agent columns by
    design — that would be a second PII surface needing the same erasure
    discipline for no compliance benefit this table exists to provide."""

    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    before: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    after: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


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
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def erase_analyst_data(
    session: AsyncSession, *, analyst_id: str, email: Optional[str] = None
) -> dict[str, int]:
    """GDPR right-to-erasure for one analyst (the data subject).

    Deletes the analyst's *owned, private* data (Deep Research jobs) and the
    Analyst row itself (the name + email PII), and *anonymizes* their attribution
    on shared institutional work product (runs, uploaded documents) — the desk's
    analysis is firm work product and is retained, only the personal link is
    scrubbed. ``analyst_id``/``uploaded_by`` are loose string stamps, not FKs, so
    nothing cascades; this is pure DML. Runs stamp ``analyst_id`` and research jobs
    key on the analyst id, while documents stamp the email — so scrub both keys.
    Returns the row counts touched. Commits itself (see below) so both callers —
    the self-service route and the operator CLI — get an atomic erase. Writes
    its own ``AuditLog`` row for the erasure event (E3) — inlined here (not via
    ``audit.write``) so this module, which ``audit.py`` imports ``AuditLog``
    from, has no import edge back onto ``audit.py``. The row's ``analyst_id``
    (actor) is None from the start rather than written-then-anonymized below:
    this session has ``autoflush=False``, so a just-``add``ed row would not be
    visible to the anonymize UPDATE's WHERE clause without an extra flush —
    starting anonymized sidesteps that ordering hazard entirely. ``target_id``
    (the erased subject) is retained; it is an opaque internal id, not PII on
    its own, and is the whole point of the row (proof erasure happened for a
    specific subject on request).
    """
    keys = [k for k in (analyst_id, email) if k]

    session.add(AuditLog(
        analyst_id=None, action="analyst.gdpr_erase",
        target_type="analyst", target_id=analyst_id,
        before={"email_present": bool(email)},
    ))
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
    runs = await session.execute(
        update(Run).where(Run.analyst_id.in_(keys)).values(analyst_id=None)
    )
    docs_anonymized = 0
    if email:
        docs = await session.execute(
            update(Document).where(Document.uploaded_by == email).values(uploaded_by=None)
        )
        docs_anonymized = docs.rowcount or 0  # type: ignore[attr-defined]  # CursorResult.rowcount, not on base Result
    # Same anonymize-not-delete treatment as runs: every audit_log row this
    # analyst ever actioned (INCLUDING the "analyst.gdpr_erase" row just added
    # above, in this same flush/commit) is retained as compliance history,
    # only the personal link is scrubbed.
    audit_anon = await session.execute(
        update(AuditLog).where(AuditLog.analyst_id.in_(keys)).values(analyst_id=None)
    )
    profile = await session.execute(delete(Analyst).where(Analyst.id == analyst_id))
    await session.commit()
    return {
        "research_jobs_deleted": research.rowcount or 0,  # type: ignore[attr-defined]
        "saved_models_deleted": models.rowcount or 0,  # type: ignore[attr-defined]
        "runs_anonymized": runs.rowcount or 0,  # type: ignore[attr-defined]
        "documents_anonymized": docs_anonymized,
        "audit_log_anonymized": audit_anon.rowcount or 0,  # type: ignore[attr-defined]
        "profile_deleted": profile.rowcount or 0,  # type: ignore[attr-defined]
    }


@event.listens_for(DocumentChunk, "before_insert")
def _set_chunk_hash_insert(_mapper, connection, target):
    if target.text:
        import hashlib
        target.chunk_hash = hashlib.sha256(target.text.encode("utf-8")).hexdigest()


@event.listens_for(DocumentChunk, "before_update")
def _set_chunk_hash_update(_mapper, connection, target):
    if target.text:
        import hashlib
        target.chunk_hash = hashlib.sha256(target.text.encode("utf-8")).hexdigest()
