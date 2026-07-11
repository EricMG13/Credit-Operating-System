"""Saved Model Builder state."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import Issuer, SavedModel, get_db
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


@router.get("/{issuer_id}", response_model=Optional[SavedModelOut])
async def get_saved_model(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
