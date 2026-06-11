"""SQLAlchemy ORM models mirroring the PostgreSQL schema."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey,
    Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def _uuid():
    return str(uuid.uuid4())


class Issuer(Base):
    __tablename__ = "issuers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    ticker = Column(Text)
    industry = Column(Text)
    country = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    documents = relationship("Document", back_populates="issuer")
    financial_snapshots = relationship("FinancialSnapshot", back_populates="issuer")
    capital_snapshots = relationship("CapitalStructureSnapshot", back_populates="issuer")
    market_data_runs = relationship("MarketDataRun", back_populates="issuer")
    covenant_snapshots = relationship("CovenantSnapshot", back_populates="issuer")
    dag_runs = relationship("DagRun", back_populates="issuer")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_id = Column(UUID(as_uuid=True), ForeignKey("issuers.id", ondelete="CASCADE"))
    doc_type = Column(Text, nullable=False)
    file_name = Column(Text, nullable=False)
    minio_key = Column(Text, nullable=False, unique=True)
    content_hash = Column(Text)
    mnpi_flag = Column(Boolean, default=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    fiscal_period = Column(Text)

    issuer = relationship("Issuer", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    chunk_type = Column(Text, nullable=False)  # PARENT | CHILD
    parent_id = Column(UUID(as_uuid=True), ForeignKey("document_chunks.id"), nullable=True)
    chunk_index = Column(Integer)
    content = Column(Text, nullable=False)
    # `embedding` is a pgvector column managed by infra/postgres/init.sql; not
    # declared on the ORM because SQLAlchemy lacks a portable pgvector type.
    # Authoritative schema lives in init.sql / Alembic — `create_all` does NOT
    # own this table (see main.py).
    metadata_ = Column("metadata", JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")


class FinancialSnapshot(Base):
    __tablename__ = "financial_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_id = Column(UUID(as_uuid=True), ForeignKey("issuers.id", ondelete="CASCADE"))
    fiscal_period = Column(Text, nullable=False)
    period_end_date = Column(Date, nullable=False)
    revenue = Column(Numeric(20, 2))
    ebitda = Column(Numeric(20, 2))
    ebitda_margin = Column(Numeric(6, 4))
    net_leverage = Column(Numeric(6, 2))
    interest_coverage = Column(Numeric(6, 2))
    fcf = Column(Numeric(20, 2))
    data = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    issuer = relationship("Issuer", back_populates="financial_snapshots")


class CapitalStructureSnapshot(Base):
    __tablename__ = "capital_structure_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_id = Column(UUID(as_uuid=True), ForeignKey("issuers.id", ondelete="CASCADE"))
    fiscal_period = Column(Text, nullable=False)
    snapshot_date = Column(Date, nullable=False)
    data = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    issuer = relationship("Issuer", back_populates="capital_snapshots")


class MarketDataRun(Base):
    __tablename__ = "market_data_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_id = Column(UUID(as_uuid=True), ForeignKey("issuers.id", ondelete="CASCADE"))
    run_date = Column(Date, nullable=False)
    instrument = Column(Text)
    spread_bps = Column(Numeric(8, 2))
    ytw_pct = Column(Numeric(8, 4))
    dm_bps = Column(Numeric(8, 2))
    source_file = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    issuer = relationship("Issuer", back_populates="market_data_runs")


class DagRun(Base):
    __tablename__ = "dag_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_id = Column(UUID(as_uuid=True), ForeignKey("issuers.id"))
    run_type = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="PENDING")
    trigger_doc_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    agent_outputs = Column(JSONB)

    issuer = relationship("Issuer", back_populates="dag_runs")
    module_outputs = relationship("AgentOutput", back_populates="dag_run")


class AgentOutput(Base):
    __tablename__ = "agent_outputs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dag_run_id = Column(UUID(as_uuid=True), ForeignKey("dag_runs.id", ondelete="CASCADE"))
    module_id = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="PENDING")
    severity = Column(Text)
    output = Column(JSONB)
    evidence_chain = Column(JSONB)
    blocked_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dag_run = relationship("DagRun", back_populates="module_outputs")


class CovenantSnapshot(Base):
    __tablename__ = "covenant_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_id = Column(UUID(as_uuid=True), ForeignKey("issuers.id", ondelete="CASCADE"))
    fiscal_period = Column(Text, nullable=False)
    covenant_name = Column(Text, nullable=False)
    limit_value = Column(Numeric(10, 4))
    actual_value = Column(Numeric(10, 4))
    headroom_pct = Column(Numeric(6, 4))
    severity = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    issuer = relationship("Issuer", back_populates="covenant_snapshots")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, nullable=False, unique=True)
    hashed_password = Column(Text, nullable=False)
    full_name = Column(Text, nullable=False)
    role = Column(Text, nullable=False, default="analyst")  # 'analyst' | 'admin'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
