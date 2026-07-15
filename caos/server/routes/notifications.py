"""Analyst-scoped cursor feed for routine workflow completion events."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import NotificationEvent, get_db
from identity import CallerIdentity, get_identity, get_write_identity

router = APIRouter()
_CURSOR_VERSION = 1


class NotificationOut(BaseModel):
    id: str
    kind: str
    subject_kind: str
    subject_id: str
    issuer_id: Optional[str]
    title: str
    body: Optional[str]
    href: Optional[str]
    seen_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationFeedOut(BaseModel):
    items: list[NotificationOut]
    next_cursor: Optional[str]


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _notification_out(row: NotificationEvent) -> NotificationOut:
    return NotificationOut(
        id=row.id,
        kind=row.kind,
        subject_kind=row.subject_kind,
        subject_id=row.subject_id,
        issuer_id=row.issuer_id,
        title=row.title,
        body=row.body,
        href=row.href,
        seen_at=_as_utc(row.seen_at) if row.seen_at else None,
        created_at=_as_utc(row.created_at),
    )


def _encode_cursor(*, analyst_id: str, created_at: datetime, event_id: str) -> str:
    payload = {
        "v": _CURSOR_VERSION,
        "analyst_id": analyst_id,
        "created_at": _as_utc(created_at).isoformat(),
        "event_id": event_id,
    }
    raw = base64.urlsafe_b64encode(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    signature = hmac.new(
        get_settings().session_secret.encode("utf-8"), raw.encode("ascii"), hashlib.sha256
    ).hexdigest()
    return f"{raw}.{signature}"


def _decode_cursor(cursor: str, *, analyst_id: str) -> tuple[datetime, str]:
    try:
        raw, signature = cursor.rsplit(".", 1)
        expected = hmac.new(
            get_settings().session_secret.encode("utf-8"), raw.encode("ascii"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        payload = json.loads(decoded)
        if (
            payload.get("v") != _CURSOR_VERSION
            or payload.get("analyst_id") != analyst_id
            or not isinstance(payload.get("event_id"), str)
        ):
            raise ValueError
        created_at = datetime.fromisoformat(payload["created_at"])
        return _as_utc(created_at), payload["event_id"]
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        raise HTTPException(400, "Invalid notifications cursor.") from None


@router.get("", response_model=NotificationFeedOut)
async def list_notifications(
    cursor: Optional[str] = Query(default=None, max_length=4096),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
) -> NotificationFeedOut:
    stmt = select(NotificationEvent).where(NotificationEvent.analyst_id == caller.id)
    if cursor:
        created_at, event_id = _decode_cursor(cursor, analyst_id=caller.id)
        stmt = stmt.where(or_(
            NotificationEvent.created_at > created_at,
            and_(NotificationEvent.created_at == created_at, NotificationEvent.id > event_id),
        )).order_by(NotificationEvent.created_at, NotificationEvent.id)
    else:
        stmt = stmt.order_by(NotificationEvent.created_at.desc(), NotificationEvent.id.desc())
    rows = list((await db.execute(stmt.limit(limit))).scalars().all())
    if not cursor:
        rows.reverse()
    next_cursor = (
        _encode_cursor(analyst_id=caller.id, created_at=rows[-1].created_at, event_id=rows[-1].id)
        if rows
        else cursor
    )
    return NotificationFeedOut(items=[_notification_out(row) for row in rows], next_cursor=next_cursor)


@router.patch("/{notification_id}/seen", response_model=NotificationOut)
async def mark_notification_seen(
    notification_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
) -> NotificationOut:
    row = (
        await db.execute(select(NotificationEvent).where(
            NotificationEvent.id == notification_id,
            NotificationEvent.analyst_id == caller.id,
        ))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Notification not found.")
    if row.seen_at is None:
        row.seen_at = datetime.now(timezone.utc)
    return _notification_out(row)
