"""IC Decision Room — immutable snapshots, votes, expiry, and reopen."""

from __future__ import annotations

import hashlib
import json
import base64
import hmac
from datetime import date, datetime, timezone
from typing import Annotated, Dict, List, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from config import get_settings
from database import Decision, DecisionVote, Issuer, ModuleOutput, Run, ThesisVersion, get_db
from engine.report import assemble_report, committee_export_allowed
from identity import CallerIdentity, get_identity, require_write_role
from json_safety import require_bounded_json
from routes.thesis import ThesisVersionIn, create_thesis_version
from tenancy import require_issuer, require_run_access, scope_issuers

router = APIRouter()

_DECISION_MAX_PER_MINUTE = 20
_MAX_CLIENT_SNAPSHOT_BYTES = 250 * 1024


class DecisionCreate(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    run_id: str = Field(min_length=1, max_length=36)
    report_id: Optional[str] = Field(default=None, max_length=64)
    action: Literal["approve", "decline", "revisit"]
    conditions: List[Annotated[str, Field(max_length=2_000)]] = Field(
        default_factory=list, max_length=50
    )
    expiry: Optional[date] = None
    snapshot: Dict = Field(default_factory=dict)


class VoteIn(BaseModel):
    vote: Literal["approve", "dissent", "abstain"]
    dissent_note: Optional[str] = Field(default=None, max_length=10_000)


class VoteOut(BaseModel):
    id: str
    member: str
    vote: str
    dissent_note: Optional[str]
    created_at: datetime


class DecisionOut(BaseModel):
    id: str
    issuer_id: str
    run_id: str
    report_id: Optional[str]
    report_version_id: Optional[str]
    portfolio_id: Optional[str]
    agenda_item_id: Optional[str]
    action: str
    status: str
    conditions: List[str]
    expiry: Optional[date]
    snapshot: Dict
    snapshot_sha256: str
    created_by: Optional[str]
    reopened_at: Optional[datetime]
    reopen_alert_key: Optional[str]
    created_at: datetime
    votes: List[VoteOut] = []


class DecisionBookPage(BaseModel):
    items: List[DecisionOut]
    next_cursor: Optional[str]
    total: int


def _decision_out(row: Decision, votes: List[DecisionVote]) -> DecisionOut:
    return DecisionOut(
        id=row.id, issuer_id=row.issuer_id, run_id=row.run_id,
        report_id=row.report_id, report_version_id=row.report_version_id,
        portfolio_id=row.portfolio_id, agenda_item_id=row.agenda_item_id,
        action=row.action, status=row.status,
        conditions=row.conditions or [], expiry=row.expiry,
        snapshot=row.snapshot or {}, snapshot_sha256=row.snapshot_sha256,
        created_by=row.created_by, reopened_at=row.reopened_at,
        reopen_alert_key=row.reopen_alert_key, created_at=row.created_at,
        votes=[VoteOut(
            id=v.id, member=v.member, vote=v.vote,
            dissent_note=v.dissent_note, created_at=v.created_at,
        ) for v in votes],
    )


async def _out(db: AsyncSession, row: Decision) -> DecisionOut:
    votes = (await db.execute(
        select(DecisionVote).where(DecisionVote.decision_id == row.id)
        .order_by(DecisionVote.created_at)
    )).scalars().all()
    return _decision_out(row, list(votes))


async def _batch_out(db: AsyncSession, rows: list[Decision]) -> list[DecisionOut]:
    if not rows:
        return []
    votes = (await db.execute(
        select(DecisionVote).where(DecisionVote.decision_id.in_([row.id for row in rows]))
        .order_by(DecisionVote.created_at)
    )).scalars().all()
    by_decision: dict[str, list[DecisionVote]] = {row.id: [] for row in rows}
    for vote_row in votes:
        by_decision[vote_row.decision_id].append(vote_row)
    return [_decision_out(row, by_decision[row.id]) for row in rows]


_BOOK_SORTS = {
    "created_at": Decision.created_at,
    "expiry": Decision.expiry,
    "status": Decision.status,
    "issuer_id": Decision.issuer_id,
    "owner": Decision.created_by,
}


def _book_fingerprint(filters: dict, sort: str, direction: str) -> str:
    raw = json.dumps(
        {"filters": filters, "sort": sort, "direction": direction},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def _book_cursor(offset: int, fingerprint: str) -> str:
    encoded = base64.urlsafe_b64encode(
        json.dumps({"v": 1, "offset": offset, "fingerprint": fingerprint}, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    signature = hmac.new(
        get_settings().session_secret.encode(), encoded.encode(), hashlib.sha256
    ).hexdigest()
    return f"{encoded}.{signature}"


def _book_offset(cursor: str, fingerprint: str) -> int:
    try:
        encoded, signature = cursor.rsplit(".", 1)
        expected = hmac.new(
            get_settings().session_secret.encode(), encoded.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        offset = payload["offset"]
        if payload.get("v") != 1 or payload.get("fingerprint") != fingerprint:
            raise ValueError
        if not isinstance(offset, int) or offset < 0 or offset > 1_000_000:
            raise ValueError
        return offset
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or stale decision cursor.") from None


@router.post("", response_model=DecisionOut, status_code=status.HTTP_201_CREATED)
async def create_decision(
    body: DecisionCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    require_write_role(caller)
    if not rate_limit.hit(
        f"decisions:{caller.id}",
        max_attempts=_DECISION_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Decision rate limit reached — try again in a minute.",
        )
    require_bounded_json(
        body.snapshot,
        max_bytes=_MAX_CLIENT_SNAPSHOT_BYTES,
        label="Decision snapshot",
    )
    run = await require_run_access(caller, await db.get(Run, body.run_id), db)
    if run.issuer_id != body.issuer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if not committee_export_allowed(run.committee_status):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Decision capture refused — run is not Committee Ready.",
            "committee_status": run.committee_status,
            "qa_status": run.qa_status,
        })
    client_context = dict(body.snapshot)
    thesis_md = str(client_context.get("thesis_md") or f"IC decision: {body.action}.")
    snapshot = {
        "schema_version": "legacy-decision-v1",
        "origin": "legacy-direct",
        "untrusted_client_context": client_context,
        "thesis_md": thesis_md,
        "issuer_id": body.issuer_id,
        "run_id": body.run_id,
        "committee_status": run.committee_status,
        "qa_status": run.qa_status,
    }
    modules = (await db.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == body.run_id)
    )).scalars().all()
    document = assemble_report(run, modules)
    document_canonical = json.dumps(document, sort_keys=True, separators=(",", ":"), default=str)
    snapshot["document_sha256"] = hashlib.sha256(document_canonical.encode("utf-8")).hexdigest()
    snapshot["authority"] = {
        "origin": "live",
        "method": "legacy-direct-decision",
        "freshness": "current",
        "as_of": datetime.now(timezone.utc).isoformat(),
        "source_ids": [run.id, *sorted(module.id for module in modules)],
        "run_id": run.id,
        "version_id": None,
        "confidence": None,
        "approval_state": "ratified",
        "analyst_override": None,
    }
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
    snapshot = json.loads(canonical)
    row = Decision(
        issuer_id=body.issuer_id, run_id=body.run_id, report_id=body.report_id,
        action=body.action, conditions=[c.strip() for c in body.conditions if c.strip()],
        expiry=body.expiry, snapshot=snapshot,
        snapshot_sha256=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        status="active", created_by=caller.id,
    )
    db.add(row)
    await db.flush()
    await create_thesis_version(db, ThesisVersionIn(
        issuer_id=body.issuer_id,
        thesis_md=thesis_md,
        trigger="decision", linked_decision_id=row.id,
    ), caller)
    return await _out(db, row)


@router.get("", response_model=Union[List[DecisionOut], DecisionBookPage])
async def list_decisions(
    issuer_id: Optional[str] = Query(default=None, max_length=36),
    book: bool = False,
    portfolio_id: Optional[str] = Query(default=None, max_length=36),
    decision_status: Optional[Literal["active", "reopened"]] = Query(default=None, alias="status"),
    owner_id: Optional[str] = Query(default=None, max_length=255),
    expiry_from: Optional[date] = None,
    expiry_to: Optional[date] = None,
    sort: str = Query("created_at", pattern="^(created_at|expiry|status|issuer_id|owner)$"),
    direction: Literal["asc", "desc"] = "desc",
    cursor: Optional[str] = Query(default=None, max_length=2048),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    # Preserve the exact pre-IC-Book contract for existing issuer clients.
    if not book:
        if not issuer_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "issuer_id is required unless book=true.")
        require_issuer(caller, await db.get(Issuer, issuer_id))
        rows = (await db.execute(
            select(Decision).where(Decision.issuer_id == issuer_id)
            .order_by(Decision.created_at.desc()).limit(100)
        )).scalars().all()
        return await _batch_out(db, list(rows))

    filters = {
        "issuer_id": issuer_id,
        "portfolio_id": portfolio_id,
        "status": decision_status,
        "owner_id": owner_id,
        "expiry_from": expiry_from,
        "expiry_to": expiry_to,
    }
    fingerprint = _book_fingerprint(filters, sort, direction)
    offset = _book_offset(cursor, fingerprint) if cursor else 0
    stmt = scope_issuers(select(Decision).join(Issuer, Issuer.id == Decision.issuer_id), caller)
    if issuer_id:
        stmt = stmt.where(Decision.issuer_id == issuer_id)
    if portfolio_id:
        stmt = stmt.where(Decision.portfolio_id == portfolio_id)
    if decision_status:
        stmt = stmt.where(Decision.status == decision_status)
    if owner_id:
        stmt = stmt.where(Decision.created_by == owner_id)
    if expiry_from:
        stmt = stmt.where(Decision.expiry >= expiry_from)
    if expiry_to:
        stmt = stmt.where(Decision.expiry <= expiry_to)
    total = (await db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )).scalar_one()
    sort_col = _BOOK_SORTS[sort]
    order = sort_col.desc() if direction == "desc" else sort_col.asc()
    rows = list((await db.execute(
        stmt.order_by(order, Decision.id).offset(offset).limit(limit + 1)
    )).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    return DecisionBookPage(
        items=await _batch_out(db, rows),
        next_cursor=_book_cursor(offset + limit, fingerprint) if has_more else None,
        total=total,
    )


@router.get("/{decision_id}", response_model=DecisionOut)
async def get_decision(
    decision_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    row = await db.get(Decision, decision_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Decision not found")
    require_issuer(caller, await db.get(Issuer, row.issuer_id))
    return await _out(db, row)


@router.post("/{decision_id}/votes", response_model=DecisionOut)
async def vote(
    decision_id: str,
    body: VoteIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    row = await db.get(Decision, decision_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Decision not found")
    require_issuer(caller, await db.get(Issuer, row.issuer_id))
    require_write_role(caller)
    if body.vote == "dissent" and not (body.dissent_note or "").strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Dissent requires a note")
    existing = (await db.execute(select(DecisionVote).where(
        DecisionVote.decision_id == row.id,
        DecisionVote.member == caller.id,
    ))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Member already voted on this decision")
    try:
        async with db.begin_nested():
            db.add(DecisionVote(
                decision_id=row.id, member=caller.id, vote=body.vote,
                dissent_note=(body.dissent_note or "").strip() or None,
            ))
            await db.flush()
    except IntegrityError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Member already voted on this decision",
        ) from None
    return await _out(db, row)


class ReopenIn(BaseModel):
    trigger_alert_key: str = Field(min_length=1, max_length=160)


@router.post("/{decision_id}/reopen", response_model=DecisionOut)
async def reopen(
    decision_id: str,
    body: ReopenIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    row = await db.get(Decision, decision_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Decision not found")
    require_issuer(caller, await db.get(Issuer, row.issuer_id))
    require_write_role(caller)
    if f":{row.issuer_id}:" not in body.trigger_alert_key:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Alert key does not belong to decision issuer")
    if row.status == "reopened":
        return await _out(db, row)
    latest = (await db.execute(
        select(ThesisVersion).where(ThesisVersion.issuer_id == row.issuer_id)
        .order_by(ThesisVersion.version.desc()).limit(1)
    )).scalar_one_or_none()
    row.status = "reopened"
    row.reopened_at = datetime.now(timezone.utc)
    row.reopen_alert_key = body.trigger_alert_key
    await create_thesis_version(db, ThesisVersionIn(
        issuer_id=row.issuer_id,
        thesis_md=latest.thesis_md if latest else "Decision reopened for material change.",
        trigger="alert", linked_decision_id=row.id,
        linked_alert_key=body.trigger_alert_key,
    ), caller)
    await db.flush()
    return await _out(db, row)
