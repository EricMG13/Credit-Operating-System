"""Alert states — ack/assign/resolve for the Watchtower alert inbox (Command +
Monitor).

An alert state is an upsert keyed on `alert_key` (deterministic from the
autonomy draft — see lib/alerts/inbox.ts on the frontend). It never gates a
run or blocks anything engine-side; same audit-record shape as AnalystQaFlag.

State is a fail-closed lattice — open(0) < ack(1) < resolved(2). A PATCH that
would move a KNOWN alert_key's state backward (e.g. resolved -> ack) is
rejected with 409; a same-state re-PATCH (an assignee/note update alongside
no real transition) is idempotent, and a first-ever write for a fresh
alert_key is always allowed regardless of the state it opens at.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import AlertState, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()

_WRITES_MAX_PER_MINUTE = 30
_LIST_CAP = 200
_STATE_RANK = {"open": 0, "ack": 1, "resolved": 2}
_VALID_STATES = tuple(_STATE_RANK.keys())


def _check_transition(current: Optional[str], target: str) -> None:
    """Raise 409 on a genuine regression; a fresh alert_key (`current is
    None`) or a same-state re-PATCH is always allowed. Fail-closed: an
    unrecognized current state (should never happen — writes are validated
    against _VALID_STATES — but degraded data is still degraded data) ranks
    WORST, same convention as engine/gate.py's roll_up_qa_status, so it can
    only be treated as a regression, never silently overwritten as if benign."""
    if current is None:
        return
    if _STATE_RANK[target] >= _STATE_RANK.get(current, 99):
        return
    raise HTTPException(
        status.HTTP_409_CONFLICT,
        f"Cannot move alert state backward: {current} -> {target}.",
    )


class AlertStateUpsert(BaseModel):
    alert_key: str = Field(min_length=1, max_length=160)
    state: str = Field(min_length=1, max_length=16)
    assignee: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=2000)
    resolution_note: Optional[str] = Field(default=None, max_length=2000)


class AlertStateOut(BaseModel):
    id: str
    alert_key: str
    state: str
    assignee: Optional[str]
    note: Optional[str]
    analyst_id: Optional[str]
    created_at: Optional[datetime]
    resolved_at: Optional[datetime]
    resolution_note: Optional[str]

    model_config = {"from_attributes": True}


@router.post("/state", response_model=AlertStateOut)
async def upsert_alert_state(
    body: AlertStateUpsert,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(f"alert-state:{caller.id}", max_attempts=_WRITES_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Alert-state rate limit reached — try again in a minute.")
    if body.state not in _VALID_STATES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "state must be one of: open, ack, resolved.")

    existing = (
        await db.execute(select(AlertState).where(AlertState.alert_key == body.alert_key))
    ).scalar_one_or_none()
    _check_transition(existing.state if existing else None, body.state)

    newly_resolved = body.state == "resolved" and (existing is None or existing.state != "resolved")
    resolved_at = datetime.now(timezone.utc) if newly_resolved else (existing.resolved_at if existing else None)
    resolution_note = (body.resolution_note or "").strip() or None

    if existing is not None:
        existing.state = body.state
        existing.assignee = (body.assignee or "").strip() or None
        existing.note = (body.note or "").strip() or None
        existing.analyst_id = caller.id
        existing.resolved_at = resolved_at
        # A resolution note only ever REPLACES a prior one when the caller
        # actually sent one — an assignee-only PATCH on an already-resolved
        # alert must not silently blank out the reason it was resolved.
        if resolution_note is not None or newly_resolved:
            existing.resolution_note = resolution_note
        row = existing
    else:
        row = AlertState(
            alert_key=body.alert_key,
            state=body.state,
            assignee=(body.assignee or "").strip() or None,
            note=(body.note or "").strip() or None,
            analyst_id=caller.id,
            resolved_at=resolved_at,
            resolution_note=resolution_note,
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return AlertStateOut.model_validate(row)


@router.get("/state", response_model=List[AlertStateOut])
async def list_alert_states(
    alert_key: Optional[str] = Query(default=None, max_length=160),
    db: AsyncSession = Depends(get_db, scope="function"),
    _caller: CallerIdentity = Depends(get_identity),
):
    q = select(AlertState).order_by(AlertState.created_at.desc()).limit(_LIST_CAP)
    if alert_key:
        q = q.where(AlertState.alert_key == alert_key)
    rows = await db.execute(q)
    return [AlertStateOut.model_validate(r) for r in rows.scalars().all()]
