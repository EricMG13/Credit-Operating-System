"""Async SQLAlchemy engine, session factory, and ORM models.

SQLite (aiosqlite) by default; any async SQLAlchemy URL via DATABASE_URL —
on Databricks that's Lakebase (postgresql+asyncpg). Schema is managed by Alembic
(see migrations/); ``init_db`` runs ``upgrade head`` on boot, stamping a
pre-Alembic database at the baseline first so existing deployments migrate in
place rather than colliding.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint, delete, event, inspect, update,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import SERVER_DIR, get_settings

settings = get_settings()

# SQLite needs its parent directory to exist before first connect.
if settings.database_url.startswith("sqlite"):
    db_path = settings.database_url.split("///")[-1]
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

# Tests run async (pytest-asyncio) and a sync TestClient against this same global
# engine on different event loops; a pooled connection cleaned up after its
# creating loop closed raises "Event loop is closed" (notably with asyncpg).
# NullPool in test mode avoids cross-loop connection reuse. Production keeps the
# default pool.
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
    country: Mapped[Optional[str]] = mapped_column(String(128))
    figi: Mapped[Optional[str]] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Analyst(Base):
    """A named analyst profile, self-registered via the shared access code. The
    identity shown across the app (initials) and stamped on every Run.analyst_id.

    `email` is the verified edge-proxy identity (X-Forwarded-Email) when present:
    behind SSO the profile is keyed on it so a user can only ever be their own
    profile (rename allowed, impersonation not). Null on a proxy-less / local run,
    where the profile is keyed on name alone."""

    __tablename__ = "analysts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    # PBKDF2 hash for the email+password lane (passwords.py); null for SSO /
    # shared-code profiles, which authenticate without one. Account key is `email`.
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Session-revocation epoch: signed into the cookie at mint; bumped on logout so
    # every existing token for this analyst stops validating (identity.get_identity
    # compares the two on each request). See routes/auth.py.
    token_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )


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

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)


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
    status: Mapped[str] = mapped_column(String(16), default="running")  # running|complete|failed
    analyst_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    brief: Mapped[dict] = mapped_column(JSON, default=dict)
    report: Mapped[Optional[str]] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    truncated: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


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
    provenance: Mapped[str] = mapped_column(String(16), default="seed")  # run|seed
    # EBITDA/leverage basis: reported (EDGAR GAAP) | adjusted (covenant/modeled) |
    # None where the metric is basis-agnostic (e.g. energy exposure, Altman Z).
    basis: Mapped[Optional[str]] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


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


async def init_db() -> None:
    async with engine.connect() as conn:
        state = await conn.run_sync(_schema_state)
    await asyncio.to_thread(_run_migrations, state)


async def get_db():
    """FastAPI dependency: yields an async session, commits on success."""
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
    Returns the row counts touched. Caller commits via the session/dependency.
    """
    keys = [k for k in (analyst_id, email) if k]

    research = await session.execute(
        delete(ResearchJob).where(ResearchJob.analyst_id.in_(keys))
    )
    runs = await session.execute(
        update(Run).where(Run.analyst_id.in_(keys)).values(analyst_id=None)
    )
    docs_anonymized = 0
    if email:
        docs = await session.execute(
            update(Document).where(Document.uploaded_by == email).values(uploaded_by=None)
        )
        docs_anonymized = docs.rowcount or 0
    profile = await session.execute(delete(Analyst).where(Analyst.id == analyst_id))
    await session.commit()

    return {
        "research_jobs_deleted": research.rowcount or 0,
        "runs_anonymized": runs.rowcount or 0,
        "documents_anonymized": docs_anonymized,
        "profile_deleted": profile.rowcount or 0,
    }
