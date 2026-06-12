"""Async SQLAlchemy engine, session factory, and ORM models.

SQLite (aiosqlite) by default; any async SQLAlchemy URL via DATABASE_URL —
on Databricks that's Lakebase (postgresql+asyncpg). Schema is created with
create_all on startup: the model set is small and additive, so no migration
tooling is carried.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import get_settings

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


def _apply_additive_migrations(sync_conn) -> None:
    """Add columns introduced after a database was first created.

    create_all only creates missing tables; existing deployments (Lakebase or
    a local SQLite file) need new columns added in place. Additive-only.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    issuer_cols = {c["name"] for c in inspector.get_columns("issuers")}
    if "figi" not in issuer_cols:
        sync_conn.execute(text("ALTER TABLE issuers ADD COLUMN figi VARCHAR(32)"))
    document_cols = {c["name"] for c in inspector.get_columns("documents")}
    if "run_mode" not in document_cols:
        sync_conn.execute(text("ALTER TABLE documents ADD COLUMN run_mode VARCHAR(16)"))


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_additive_migrations)


async def get_db():
    """FastAPI dependency: yields an async session, commits on success."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
