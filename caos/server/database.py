"""Async SQLAlchemy engine, session factory, and ORM models.

SQLite (aiosqlite) by default; any async SQLAlchemy URL via DATABASE_URL —
on Databricks that's Lakebase (postgresql+asyncpg). Schema is managed by Alembic
(see migrations/); ``init_db`` runs ``upgrade head`` on boot, stamping a
pre-Alembic database at the baseline first so existing deployments migrate in
place rather than colliding.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint, inspect,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import SERVER_DIR, get_settings

settings = get_settings()

# SQLite needs its parent directory to exist before first connect.
if settings.database_url.startswith("sqlite"):
    db_path = settings.database_url.split("///")[-1]
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.database_url, pool_pre_ping=True)

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
    # Run-level gate roll-up (worst module status wins).
    qa_status: Mapped[str] = mapped_column(String(16), default="Not Reviewed")
    committee_status: Mapped[str] = mapped_column(String(32), default="Draft Only")
    # Why a failed run failed — captured so a fault is inspectable, not lost.
    failure_reason: Mapped[Optional[str]] = mapped_column(Text)
    # Total LLM tokens this run spent (per-run budget accounting).
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
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
    run_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("runs.id"))
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
