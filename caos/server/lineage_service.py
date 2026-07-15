"""Transactional lineage v2 writes over the existing authoritative ledger."""

from __future__ import annotations

import hashlib
import json
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from analysis_contracts import ArtifactRef
from config import get_settings
from database import LineageEdge


class _LineageWrite(BaseModel):
    context_id: str = Field(min_length=1, max_length=36)
    analyst_id: str = Field(min_length=1, max_length=255)
    artifact: ArtifactRef
    parent: ArtifactRef
    transform: str = Field(min_length=1, max_length=64)
    transform_version: str = Field(min_length=1, max_length=32)


class _OwnedArtifactLineageWrite(BaseModel):
    """Analyst-owned lineage for source artifacts not yet bound to a context."""

    analyst_id: str = Field(min_length=1, max_length=255)
    artifact: ArtifactRef
    parent: ArtifactRef
    transform: str = Field(min_length=1, max_length=64)
    transform_version: str = Field(min_length=1, max_length=32)


def canonical_artifact_id(ref: ArtifactRef) -> str:
    """Return the canonical, unambiguous ``kind:id`` identifier."""
    validated = ArtifactRef.model_validate(ref)
    return f"{validated.kind}:{validated.id}"


def _idempotency_key(write: _LineageWrite) -> str:
    canonical = {
        "analyst_id": write.analyst_id,
        "artifact": canonical_artifact_id(write.artifact),
        "artifact_version": write.artifact.version,
        "context_id": write.context_id,
        "parent": canonical_artifact_id(write.parent),
        "parent_version": write.parent.version,
        "transform": write.transform,
        "transform_version": write.transform_version,
    }
    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def lineage_idempotency_key(
    *,
    context_id: str,
    analyst_id: str,
    artifact: ArtifactRef,
    parent: ArtifactRef,
    transform: str,
    transform_version: str,
) -> str:
    """Recompute the public deterministic identity of one v2 edge."""
    return _idempotency_key(_LineageWrite.model_validate({
        "context_id": context_id,
        "analyst_id": analyst_id,
        "artifact": artifact,
        "parent": parent,
        "transform": transform,
        "transform_version": transform_version,
    }))


def lineage_insert_statement(dialect: str, values: dict):
    """Build the deterministic conflict-safe insert for a supported dialect."""
    if dialect == "postgresql":
        return pg_insert(LineageEdge).values(**values).on_conflict_do_nothing(
            index_elements=[LineageEdge.v2_idempotency_key]
        )
    if dialect == "sqlite":
        return sqlite_insert(LineageEdge).values(**values).on_conflict_do_nothing(
            index_elements=[LineageEdge.v2_idempotency_key]
        )
    raise RuntimeError(f"lineage v2 does not support the {dialect!r} dialect")


async def write_lineage_edge(
    db: AsyncSession,
    *,
    context_id: str,
    analyst_id: str,
    artifact: ArtifactRef,
    parent: ArtifactRef,
    transform: str,
    transform_version: str,
    enabled: Optional[bool] = None,
) -> Optional[LineageEdge]:
    """Insert one v2 edge without committing; retries converge on one DB row.

    The caller owns the surrounding transaction. ``enabled`` is injectable for
    focused tests; normal callers inherit the default-off deployment flag.
    """
    if enabled is None:
        enabled = get_settings().caos_lineage_v2_enabled
    if not enabled:
        return None

    write = _LineageWrite.model_validate({
        "context_id": context_id,
        "analyst_id": analyst_id,
        "artifact": artifact,
        "parent": parent,
        "transform": transform,
        "transform_version": transform_version,
    })
    key = lineage_idempotency_key(
        context_id=write.context_id,
        analyst_id=write.analyst_id,
        artifact=write.artifact,
        parent=write.parent,
        transform=write.transform,
        transform_version=write.transform_version,
    )
    values = {
        "artifact_id": canonical_artifact_id(write.artifact),
        "parent_id": canonical_artifact_id(write.parent),
        "transform": write.transform,
        "transform_version": write.transform_version,
        "context_id": write.context_id,
        "analyst_id": write.analyst_id,
        "artifact_kind": write.artifact.kind,
        "artifact_version": write.artifact.version,
        "parent_kind": write.parent.kind,
        "parent_version": write.parent.version,
        "v2_idempotency_key": key,
    }
    statement = lineage_insert_statement(db.get_bind().dialect.name, values)
    await db.execute(statement)
    return (await db.execute(
        select(LineageEdge).where(LineageEdge.v2_idempotency_key == key)
    )).scalar_one()


async def write_owned_artifact_lineage_edge(
    db: AsyncSession,
    *,
    analyst_id: str,
    artifact: ArtifactRef,
    parent: ArtifactRef,
    transform: str,
    transform_version: str,
    enabled: Optional[bool] = None,
) -> Optional[LineageEdge]:
    """Write private source lineage before an analysis context consumes it.

    Market workbooks are broad analyst-owned evidence, not issuer documents and
    not born inside one context. The same ledger already permits nullable
    context_id; analyst_id remains mandatory so this never becomes global.
    """
    if enabled is None:
        enabled = get_settings().caos_lineage_v2_enabled
    if not enabled:
        return None
    write = _OwnedArtifactLineageWrite.model_validate({
        "analyst_id": analyst_id,
        "artifact": artifact,
        "parent": parent,
        "transform": transform,
        "transform_version": transform_version,
    })
    canonical = {
        "analyst_id": write.analyst_id,
        "artifact": canonical_artifact_id(write.artifact),
        "artifact_version": write.artifact.version,
        "context_id": None,
        "parent": canonical_artifact_id(write.parent),
        "parent_version": write.parent.version,
        "transform": write.transform,
        "transform_version": write.transform_version,
    }
    key = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    values = {
        "artifact_id": canonical_artifact_id(write.artifact),
        "parent_id": canonical_artifact_id(write.parent),
        "transform": write.transform,
        "transform_version": write.transform_version,
        "context_id": None,
        "analyst_id": write.analyst_id,
        "artifact_kind": write.artifact.kind,
        "artifact_version": write.artifact.version,
        "parent_kind": write.parent.kind,
        "parent_version": write.parent.version,
        "v2_idempotency_key": key,
    }
    await db.execute(lineage_insert_statement(db.get_bind().dialect.name, values))
    return (await db.execute(
        select(LineageEdge).where(LineageEdge.v2_idempotency_key == key)
    )).scalar_one()
