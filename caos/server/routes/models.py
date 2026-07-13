"""Saved Model Builder state."""

from __future__ import annotations

import json
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import AnalysisContextRecord, Issuer, ModelCheckpoint, Run, SavedModel, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()

# Saved models are grid overrides + assumptions — a few KB in practice. Cap the
# persisted JSON so the one previously-unguarded mutating endpoint can't grow a
# row (or the request's in-memory parse) without bound.
_MAX_PAYLOAD_BYTES = 1_000_000
_SAVES_PER_MINUTE = 30


def _aware(dt: datetime) -> datetime:
    # SQLite hands back naive datetimes; everything is stored as UTC. Serialize
    # with an explicit offset so `new Date()` client-side doesn't parse the UTC
    # wall clock as local time (a save stamp hours off).
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _as_utc(dt: datetime) -> datetime:
    """SQLite doesn't preserve tzinfo through DateTime(timezone=True) — a row
    reloaded via SELECT comes back naive even though it was written from an
    aware UTC value, while a freshly-built ``datetime.now(timezone.utc)`` stays
    aware. Naive-vs-aware always compares unequal, so normalize both sides
    (treating a naive value as already-UTC, which is the only value this app
    ever writes) before an equality check. No-op on Postgres, where tzinfo
    round-trips correctly."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class SavedModelBody(BaseModel):
    payload: dict = Field(default_factory=dict)
    # Optimistic-concurrency guard (pre-prod audit #6b): the client's last-seen
    # updated_at. When set and it no longer matches the row, someone/something
    # else saved in between (e.g. the same analyst's OTHER tab) — reject with
    # 409 instead of silently overwriting their edit. None (the default) skips
    # the check, so first-save and any caller that doesn't track it are unaffected.
    expected_updated_at: Optional[datetime] = None


class SavedModelOut(BaseModel):
    issuer_id: str
    analyst_id: str
    payload: dict
    updated_at: datetime


class ModelCheckpointCreate(BaseModel):
    context_id: str = Field(min_length=1, max_length=36)
    label: str = Field(default="Analyst checkpoint", min_length=1, max_length=160)
    issuer_run_id: Optional[str] = Field(default=None, max_length=64)
    parent_checkpoint_id: Optional[str] = Field(default=None, max_length=36)
    expected_updated_at: Optional[datetime] = None


class ModelCheckpointOut(BaseModel):
    id: str
    issuer_id: str
    context_id: str
    issuer_run_id: Optional[str]
    parent_checkpoint_id: Optional[str]
    label: str
    payload_hash: str
    payload: dict
    authority: dict
    created_at: datetime


class ModelCheckpointRestore(BaseModel):
    expected_updated_at: Optional[datetime] = None


def _checkpoint_out(row: ModelCheckpoint) -> ModelCheckpointOut:
    return ModelCheckpointOut(
        id=row.id,
        issuer_id=row.issuer_id,
        context_id=row.context_id,
        issuer_run_id=row.issuer_run_id,
        parent_checkpoint_id=row.parent_checkpoint_id,
        label=row.label,
        payload_hash=row.payload_hash,
        payload=row.payload or {},
        authority=row.authority or {},
        created_at=_aware(row.created_at),
    )


async def _owned_context(db: AsyncSession, context_id: str, analyst_id: str) -> AnalysisContextRecord:
    row = (await db.execute(select(AnalysisContextRecord).where(
        AnalysisContextRecord.id == context_id,
        AnalysisContextRecord.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    return row


@router.get("/{issuer_id}/checkpoints", response_model=list[ModelCheckpointOut])
async def list_model_checkpoints(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    rows = (await db.execute(
        select(ModelCheckpoint).where(
            ModelCheckpoint.issuer_id == issuer_id,
            ModelCheckpoint.analyst_id == caller.id,
        ).order_by(ModelCheckpoint.created_at.desc()).limit(100)
    )).scalars().all()
    return [_checkpoint_out(row) for row in rows]


@router.post("/{issuer_id}/checkpoints", response_model=ModelCheckpointOut, status_code=status.HTTP_201_CREATED)
async def create_model_checkpoint(
    issuer_id: str,
    body: ModelCheckpointCreate,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    if not rate_limit.hit(f"model-checkpoints:{caller.id}", max_attempts=15, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Checkpoint rate limit reached.")
    context = await _owned_context(db, body.context_id, caller.id)
    if context.issuer_ids and issuer_id not in context.issuer_ids:
        raise HTTPException(status.HTTP_409_CONFLICT, "Issuer is outside the active analysis context.")
    saved = (await db.execute(select(SavedModel).where(
        SavedModel.issuer_id == issuer_id,
        SavedModel.analyst_id == caller.id,
    ))).scalar_one_or_none()
    if saved is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Save the working model before creating a checkpoint.")
    if body.expected_updated_at is not None and _as_utc(body.expected_updated_at) != _as_utc(saved.updated_at):
        raise HTTPException(status.HTTP_409_CONFLICT, "The working model changed before checkpoint creation.")
    if body.issuer_run_id:
        run = await db.get(Run, body.issuer_run_id)
        if run is None or run.issuer_id != issuer_id or run.analyst_id != caller.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Issuer run not found.")
    if body.parent_checkpoint_id:
        parent = await db.get(ModelCheckpoint, body.parent_checkpoint_id)
        if parent is None or parent.analyst_id != caller.id or parent.issuer_id != issuer_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent checkpoint not found.")
    canonical = json.dumps(saved.payload or {}, sort_keys=True, separators=(",", ":"), default=str)
    now = datetime.now(timezone.utc)
    row = ModelCheckpoint(
        issuer_id=issuer_id,
        analyst_id=caller.id,
        context_id=context.id,
        issuer_run_id=body.issuer_run_id,
        parent_checkpoint_id=body.parent_checkpoint_id,
        label=body.label.strip(),
        payload_hash=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        payload=saved.payload or {},
        authority={
            "origin": "live",
            "method": "modelled",
            "freshness": "current",
            "as_of": now.isoformat(),
            "source_ids": [body.issuer_run_id] if body.issuer_run_id else [],
            "run_id": body.issuer_run_id,
            "version_id": None,
            "confidence": None,
            "approval_state": "draft",
            "analyst_override": None,
        },
        created_at=now,
    )
    db.add(row)
    await db.flush()
    row.authority = {**row.authority, "version_id": row.id}
    context.artifacts = {
        **(context.artifacts or {}),
        "model_checkpoint_id": row.id,
        "issuer_run_id": body.issuer_run_id or (context.artifacts or {}).get("issuer_run_id"),
    }
    context.updated_at = now
    await db.flush()
    return _checkpoint_out(row)


@router.post("/checkpoints/{checkpoint_id}/restore", response_model=SavedModelOut)
async def restore_model_checkpoint(
    checkpoint_id: str,
    body: ModelCheckpointRestore,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    checkpoint = await db.get(ModelCheckpoint, checkpoint_id)
    if checkpoint is None or checkpoint.analyst_id != caller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model checkpoint not found.")
    saved = (await db.execute(select(SavedModel).where(
        SavedModel.issuer_id == checkpoint.issuer_id,
        SavedModel.analyst_id == caller.id,
    ))).scalar_one_or_none()
    if saved and body.expected_updated_at is not None and _as_utc(body.expected_updated_at) != _as_utc(saved.updated_at):
        raise HTTPException(status.HTTP_409_CONFLICT, "The working model changed before restore.")
    now = datetime.now(timezone.utc)
    if saved is None:
        saved = SavedModel(
            issuer_id=checkpoint.issuer_id,
            analyst_id=caller.id,
            payload=checkpoint.payload or {},
            updated_at=now,
        )
        db.add(saved)
    else:
        saved.payload = checkpoint.payload or {}
        saved.updated_at = now
    await db.flush()
    return SavedModelOut(
        issuer_id=checkpoint.issuer_id,
        analyst_id=caller.id,
        payload=checkpoint.payload or {},
        updated_at=now,
    )


@router.get("/{issuer_id}", response_model=Optional[SavedModelOut])
async def get_saved_model(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    row = (await db.execute(
        select(SavedModel).where(SavedModel.issuer_id == issuer_id, SavedModel.analyst_id == caller.id)
    )).scalar_one_or_none()
    if row is None:
        return None
    return SavedModelOut(
        issuer_id=row.issuer_id, analyst_id=row.analyst_id,
        payload=row.payload, updated_at=_aware(row.updated_at),
    )


@router.put("/{issuer_id}", response_model=SavedModelOut)
async def save_model(
    issuer_id: str,
    body: SavedModelBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    if not rate_limit.hit(f"models:{caller.id}", max_attempts=_SAVES_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Save rate limit reached — try again in a minute.")
    if len(json.dumps(body.payload)) > _MAX_PAYLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "Model payload too large to save.",
        )
    if await db.get(Issuer, issuer_id) is None:
        raise HTTPException(404, "Issuer not found")
    now = datetime.now(timezone.utc)
    row = (await db.execute(
        select(SavedModel).where(SavedModel.issuer_id == issuer_id, SavedModel.analyst_id == caller.id)
    )).scalar_one_or_none()
    if row is None:
        db.add(SavedModel(issuer_id=issuer_id, analyst_id=caller.id, payload=body.payload, updated_at=now))
        try:
            await db.commit()
        except IntegrityError:
            # A concurrent first-save won the insert between our SELECT and commit;
            # roll back and update the now-existing row (last-write-wins) instead of
            # 500-ing on uq_saved_model_issuer_analyst.
            await db.rollback()
            row = (await db.execute(
                select(SavedModel).where(SavedModel.issuer_id == issuer_id, SavedModel.analyst_id == caller.id)
            )).scalar_one()
            row.payload = body.payload
            row.updated_at = now
            await db.commit()
    else:
        # ponytail: check-then-act, not a DB-atomic compare-and-swap — a
        # sub-millisecond SELECT-to-commit window between two saves that both
        # pass this check is still a lost update. Matches the audit's own
        # proposed fix (compare the client's last-seen updated_at); a CAS via
        # `UPDATE ... WHERE updated_at = :expected` would close it fully if
        # this ever needs to be airtight rather than "good enough for one
        # analyst's own tabs." Also: `expected_updated_at is None` skips the
        # check unconditionally, which also skips it for a first-save race
        # (this tab never saw a prior save, but another tab's first save has
        # already landed by the time this row is re-queried) — the narrower,
        # already-accepted last-write-wins behavior part (a) above documents.
        if body.expected_updated_at is not None and _as_utc(body.expected_updated_at) != _as_utc(row.updated_at):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                {
                    "message": "This model was saved elsewhere since you loaded it.",
                    "current": SavedModelOut(
                        issuer_id=issuer_id, analyst_id=caller.id,
                        payload=row.payload, updated_at=row.updated_at,
                    ).model_dump(mode="json"),
                },
            )
        row.payload = body.payload
        row.updated_at = now
        await db.commit()
    return SavedModelOut(issuer_id=issuer_id, analyst_id=caller.id, payload=body.payload, updated_at=now)
