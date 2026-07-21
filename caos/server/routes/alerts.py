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

import base64
from datetime import datetime, timezone
import hashlib
import hmac
import json
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, exists, func, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from config import get_settings
from database import (
    AlertEvent,
    AlertEventContext,
    AlertState,
    Issuer,
    Portfolio,
    get_db,
)
from engine import pipeline
from identity import CallerIdentity, get_identity, get_write_identity
from tenancy import tenancy_enabled
from watch_rules import _scope_for_caller

router = APIRouter()

_WRITES_MAX_PER_MINUTE = 30
_LIST_CAP = 200
_CURSOR_MAX = 2048
_CURSOR_VERSION = 1
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


class AlertEventOut(BaseModel):
    id: str
    alert_key: str
    issuer_id: Optional[str]
    run_id: Optional[str]
    kind: str
    title: str
    impact: str
    evidence: dict
    authority: dict
    state: str
    assignee: Optional[str]
    note: Optional[str]
    resolved_at: Optional[datetime]
    resolution_note: Optional[str]
    created_at: datetime
    updated_at: datetime


class AlertEventPatch(BaseModel):
    state: str = Field(min_length=1, max_length=16)
    assignee: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=2000)
    resolution_note: Optional[str] = Field(default=None, max_length=2000)


def _cursor_time(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _alert_cursor_fingerprint(
    caller: CallerIdentity, resource: str, filters: dict[str, object]
) -> str:
    canonical = json.dumps(
        {
            "caller": caller.id,
            "team": caller.team_id,
            "role": caller.role.strip().lower(),
            "tenancy": tenancy_enabled(),
            "resource": resource,
            "filters": filters,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _encode_alert_cursor(
    *, resource: str, fingerprint: str, created_at: datetime, row_id: str
) -> str:
    payload = {
        "v": _CURSOR_VERSION,
        "resource": resource,
        "fingerprint": fingerprint,
        "created_at": _cursor_time(created_at).isoformat(),
        "id": row_id,
    }
    raw = (
        base64.urlsafe_b64encode(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        )
        .decode("ascii")
        .rstrip("=")
    )
    signature = hmac.new(
        get_settings().session_secret.encode("utf-8"),
        raw.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{raw}.{signature}"


def _decode_alert_cursor(
    cursor: str, *, resource: str, fingerprint: str
) -> tuple[datetime, str]:
    if len(cursor) > _CURSOR_MAX:
        raise HTTPException(400, "invalid_alert_cursor")
    try:
        raw, signature = cursor.rsplit(".", 1)
        expected = hmac.new(
            get_settings().session_secret.encode("utf-8"),
            raw.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature.encode("ascii"), expected.encode("ascii")):
            raise ValueError
        decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        payload = json.loads(decoded)
        if (
            not isinstance(payload, dict)
            or payload.get("v") != _CURSOR_VERSION
            or payload.get("resource") != resource
            or payload.get("fingerprint") != fingerprint
            or not isinstance(payload.get("created_at"), str)
            or not isinstance(payload.get("id"), str)
            or not payload["id"]
        ):
            raise ValueError
        created_at = datetime.fromisoformat(payload["created_at"])
        if created_at.tzinfo is None:
            raise ValueError
        return created_at.astimezone(timezone.utc), payload["id"]
    except (UnicodeError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(400, "invalid_alert_cursor") from None


def _alert_visibility_predicate(caller: CallerIdentity):
    """Scope contextual C3 rows; retain only issuer-anchored legacy reads."""
    if not tenancy_enabled():
        return true()

    tenant_id, team_id = _scope_for_caller(caller)
    role = caller.role.strip().lower()
    contextual = and_(
        AlertEventContext.id.is_not(None),
        AlertEventContext.tenant_id == tenant_id,
        or_(
            AlertEventContext.owner_user_id == caller.id,
            AlertEventContext.team_id_snapshot == team_id,
            role == "admin",
        ),
        or_(
            AlertEventContext.issuer_id.is_(None),
            exists(
                select(Issuer.id).where(
                    Issuer.id == AlertEventContext.issuer_id,
                    or_(
                        Issuer.team_id.is_(None),
                        Issuer.team_id == caller.team_id,
                    ),
                )
            ),
        ),
        or_(
            AlertEventContext.portfolio_id.is_(None),
            exists(
                select(Portfolio.id).where(
                    Portfolio.id == AlertEventContext.portfolio_id,
                    Portfolio.team_id == caller.team_id,
                )
            ),
        ),
    )
    legacy = and_(
        AlertEventContext.id.is_(None),
        ~AlertEvent.alert_key.startswith("c3:"),
        AlertEvent.issuer_id.is_not(None),
        exists(
            select(Issuer.id).where(
                Issuer.id == AlertEvent.issuer_id,
                or_(Issuer.team_id.is_(None), Issuer.team_id == caller.team_id),
            )
        ),
    )
    return or_(contextual, legacy)


def _alert_event_out(row: AlertEvent, state_row: Optional[AlertState]) -> AlertEventOut:
    return AlertEventOut(
        id=row.id,
        alert_key=row.alert_key,
        issuer_id=row.issuer_id,
        run_id=row.run_id,
        kind=row.kind,
        title=row.title,
        impact=row.impact,
        evidence=row.evidence or {},
        authority=row.authority or {},
        state=state_row.state if state_row else "open",
        assignee=state_row.assignee if state_row else None,
        note=state_row.note if state_row else None,
        resolved_at=state_row.resolved_at if state_row else None,
        resolution_note=state_row.resolution_note if state_row else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _draft_alerts(draft: dict) -> list[dict]:
    def impact_label(value: object) -> str:
        if not isinstance(value, (str, int, float)):
            return "unknown"
        try:
            severity = float(value or 0)
        except (TypeError, ValueError):
            return "unknown"
        return f"{severity:.1f}σ" if math.isfinite(severity) else "unknown"

    generated_at = draft.get("generated_at")
    rows: list[dict] = []
    for section in draft.get("sections") or []:
        issuer_id = section.get("issuer_id")
        issuer_name = section.get("issuer_name") or "Unknown issuer"
        for claim in section.get("claims") or []:
            kind = str(claim.get("anomaly_kind") or "model-claim")
            rows.append({
                "key": f"{generated_at or 'unknown'}:{issuer_id or '_unknown'}:{kind}:claim",
                "issuer_id": issuer_id,
                "kind": kind,
                "title": str(claim.get("text") or f"{issuer_name} model claim"),
                "impact": impact_label(claim.get("anomaly_severity")),
                "method": "modelled",
                "source_ids": list(dict.fromkeys([
                    *(claim.get("chunk_ids") or []),
                    *(claim.get("fact_ids") or []),
                ])),
                "evidence": {
                    "issuer_name": issuer_name,
                    "severity": claim.get("anomaly_severity"),
                    "chunk_ids": claim.get("chunk_ids") or [],
                    "fact_ids": claim.get("fact_ids") or [],
                },
            })
        for bullet in section.get("deterministic_bullets") or []:
            kind = str(bullet.get("kind") or "derived-anomaly")
            metric = bullet.get("metric") or "bullet"
            direction = f" {bullet.get('direction')}" if bullet.get("direction") else ""
            rows.append({
                "key": f"{generated_at or 'unknown'}:{issuer_id or '_unknown'}:{kind}:{metric}",
                "issuer_id": issuer_id,
                "kind": kind,
                "title": f"{issuer_name} · {kind} {metric}{direction}".strip(),
                "impact": impact_label(bullet.get("severity")),
                "method": "derived",
                "source_ids": [bullet["chunk_id"]] if bullet.get("chunk_id") else [],
                "evidence": {
                    "issuer_name": issuer_name,
                    "severity": bullet.get("severity"),
                    "metric": bullet.get("metric"),
                    "direction": bullet.get("direction"),
                    "context": bullet.get("context") or {},
                },
            })
    return rows


@router.post("/state", response_model=AlertStateOut)
async def upsert_alert_state(
    body: AlertStateUpsert,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    if not rate_limit.hit(f"alert-state:{caller.id}", max_attempts=_WRITES_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Alert-state rate limit reached — try again in a minute.")
    if body.state not in _VALID_STATES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "state must be one of: open, ack, resolved.")

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
    response: Response,
    alert_key: Optional[str] = Query(default=None, max_length=160),
    limit: int = Query(default=_LIST_CAP, ge=1, le=_LIST_CAP),
    cursor: Optional[str] = Query(default=None, max_length=_CURSOR_MAX),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    fingerprint = _alert_cursor_fingerprint(
        caller, "alert_states", {"alert_key": alert_key}
    )
    q = select(AlertState)
    if tenancy_enabled():
        q = (
            q.outerjoin(AlertEvent, AlertEvent.alert_key == AlertState.alert_key)
            .outerjoin(
                AlertEventContext,
                AlertEventContext.alert_event_id == AlertEvent.id,
            )
            .where(
                or_(
                    _alert_visibility_predicate(caller),
                    and_(
                        AlertEvent.id.is_(None),
                        AlertState.analyst_id == caller.id,
                    ),
                )
            )
        )
    if alert_key:
        q = q.where(AlertState.alert_key == alert_key)
    if cursor:
        created_at, row_id = _decode_alert_cursor(
            cursor, resource="alert_states", fingerprint=fingerprint
        )
        q = q.where(
            or_(
                AlertState.created_at < created_at,
                and_(AlertState.created_at == created_at, AlertState.id < row_id),
            )
        )
    q = q.order_by(AlertState.created_at.desc(), AlertState.id.desc()).limit(limit + 1)
    rows = await db.execute(q)
    all_rows = rows.scalars().all()
    page = all_rows[:limit]
    if len(all_rows) > limit and page:
        response.headers["X-Next-Cursor"] = _encode_alert_cursor(
            resource="alert_states",
            fingerprint=fingerprint,
            created_at=page[-1].created_at,
            row_id=page[-1].id,
        )
    return [AlertStateOut.model_validate(r) for r in page]


@router.post("/refresh", response_model=List[AlertEventOut])
async def refresh_alert_events(
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    """Materialize the latest completed Watchtower draft into durable events."""
    if not rate_limit.hit(f"alert-refresh:{caller.id}", max_attempts=12, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Alert refresh rate limit reached.")
    draft = await pipeline.latest_draft(db)
    if not draft:
        return []
    generated_at = draft.get("generated_at")
    try:
        as_of = datetime.fromisoformat(generated_at.replace("Z", "+00:00")) if generated_at else datetime.now(timezone.utc)
    except (TypeError, ValueError):
        as_of = datetime.now(timezone.utc)
    existing = {
        row.alert_key: row for row in (await db.execute(select(AlertEvent).where(
            AlertEvent.alert_key.in_([item["key"] for item in _draft_alerts(draft)] or ["__none__"])
        ))).scalars().all()
    }
    events: list[AlertEvent] = []
    for item in _draft_alerts(draft):
        row = existing.get(item["key"])
        if row is None:
            row = AlertEvent(
                alert_key=item["key"],
                issuer_id=item["issuer_id"],
                kind=item["kind"],
                title=item["title"],
                impact=item["impact"],
                evidence=item["evidence"],
                authority={
                    "origin": "live",
                    "method": item["method"],
                    "freshness": "current",
                    "as_of": as_of.isoformat(),
                    "source_ids": item["source_ids"],
                    "run_id": None,
                    "version_id": None,
                    "confidence": None,
                    "approval_state": "draft",
                    "analyst_override": None,
                },
                created_by=caller.id,
                created_at=as_of,
                updated_at=as_of,
            )
            db.add(row)
            await db.flush()
            row.authority = {**row.authority, "version_id": row.id}
        events.append(row)
    states = {
        row.alert_key: row for row in (await db.execute(select(AlertState).where(
            AlertState.alert_key.in_([row.alert_key for row in events] or ["__none__"])
        ))).scalars().all()
    }
    return [_alert_event_out(row, states.get(row.alert_key)) for row in events]


@router.get("/events", response_model=List[AlertEventOut])
async def list_alert_events(
    response: Response,
    event_state: Optional[str] = Query(default=None, alias="state", max_length=16),
    issuer_id: Optional[str] = Query(default=None, min_length=1, max_length=36),
    kind: Optional[str] = Query(default=None, min_length=1, max_length=64),
    limit: int = Query(default=_LIST_CAP, ge=1, le=_LIST_CAP),
    cursor: Optional[str] = Query(default=None, max_length=_CURSOR_MAX),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    fingerprint = _alert_cursor_fingerprint(
        caller,
        "alert_events",
        {"state": event_state, "issuer_id": issuer_id, "kind": kind},
    )
    query = (
        select(AlertEvent)
        .outerjoin(AlertState, AlertState.alert_key == AlertEvent.alert_key)
        .outerjoin(
            AlertEventContext,
            AlertEventContext.alert_event_id == AlertEvent.id,
        )
        .where(_alert_visibility_predicate(caller))
    )
    if event_state is not None:
        query = query.where(func.coalesce(AlertState.state, "open") == event_state)
    if issuer_id is not None:
        query = query.where(AlertEvent.issuer_id == issuer_id)
    if kind is not None:
        query = query.where(AlertEvent.kind == kind)
    if cursor is not None:
        created_at, row_id = _decode_alert_cursor(
            cursor, resource="alert_events", fingerprint=fingerprint
        )
        query = query.where(
            or_(
                AlertEvent.created_at < created_at,
                and_(AlertEvent.created_at == created_at, AlertEvent.id < row_id),
            )
        )
    events = (
        (
            await db.execute(
                query.order_by(
                    AlertEvent.created_at.desc(), AlertEvent.id.desc()
                ).limit(limit + 1)
            )
        )
        .scalars()
        .all()
    )
    page = events[:limit]
    states = {
        row.alert_key: row
        for row in (
            await db.execute(
                select(AlertState).where(
                    AlertState.alert_key.in_(
                        [row.alert_key for row in page] or ["__none__"]
                    )
                )
            )
        )
        .scalars()
        .all()
    }
    if len(events) > limit and page:
        response.headers["X-Next-Cursor"] = _encode_alert_cursor(
            resource="alert_events",
            fingerprint=fingerprint,
            created_at=page[-1].created_at,
            row_id=page[-1].id,
        )
    return [_alert_event_out(row, states.get(row.alert_key)) for row in page]


@router.patch("/events/{event_id}", response_model=AlertEventOut)
async def patch_alert_event(
    event_id: str,
    body: AlertEventPatch,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    event = (
        await db.execute(
            select(AlertEvent)
            .outerjoin(
                AlertEventContext,
                AlertEventContext.alert_event_id == AlertEvent.id,
            )
            .where(
                AlertEvent.id == event_id,
                _alert_visibility_predicate(caller),
            )
        )
    ).scalar_one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert event not found.")
    state_row = await upsert_alert_state(
        AlertStateUpsert(
            alert_key=event.alert_key,
            state=body.state,
            assignee=body.assignee,
            note=body.note,
            resolution_note=body.resolution_note,
        ),
        db=db,
        caller=caller,
    )
    persisted = await db.get(AlertState, state_row.id)
    return _alert_event_out(event, persisted)
