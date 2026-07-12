"""IC Decision Room — immutable snapshots, votes, expiry, and reopen."""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Decision, DecisionVote, Issuer, ModuleOutput, Run, ThesisVersion, get_db
from engine.report import assemble_report, committee_export_allowed
from identity import CallerIdentity, get_identity
from routes.thesis import ThesisVersionIn, create_thesis_version
from tenancy import require_issuer, require_run_access

router = APIRouter()


class DecisionCreate(BaseModel):
    issuer_id: str
    run_id: str
    report_id: Optional[str] = Field(default=None, max_length=64)
    action: Literal["approve", "decline", "revisit"]
    conditions: List[str] = Field(default_factory=list, max_length=50)
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


async def _out(db: AsyncSession, row: Decision) -> DecisionOut:
    votes = (await db.execute(
        select(DecisionVote).where(DecisionVote.decision_id == row.id)
        .order_by(DecisionVote.created_at)
    )).scalars().all()
    return DecisionOut(
        id=row.id, issuer_id=row.issuer_id, run_id=row.run_id,
        report_id=row.report_id, action=row.action, status=row.status,
        conditions=row.conditions or [], expiry=row.expiry,
        snapshot=row.snapshot or {}, snapshot_sha256=row.snapshot_sha256,
        created_by=row.created_by, reopened_at=row.reopened_at,
        reopen_alert_key=row.reopen_alert_key, created_at=row.created_at,
        votes=[VoteOut(
            id=v.id, member=v.member, vote=v.vote,
            dissent_note=v.dissent_note, created_at=v.created_at,
        ) for v in votes],
    )


@router.post("", response_model=DecisionOut, status_code=status.HTTP_201_CREATED)
async def create_decision(
    body: DecisionCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    run = await require_run_access(caller, await db.get(Run, body.run_id), db)
    if run.issuer_id != body.issuer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if not committee_export_allowed(run.committee_status):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Decision capture refused — run is not Committee Ready.",
            "committee_status": run.committee_status,
            "qa_status": run.qa_status,
        })
    snapshot = dict(body.snapshot)
    snapshot.update({
        "issuer_id": body.issuer_id,
        "run_id": body.run_id,
        "committee_status": run.committee_status,
        "qa_status": run.qa_status,
    })
    modules = (await db.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == body.run_id)
    )).scalars().all()
    document = assemble_report(run, modules)
    document_canonical = json.dumps(document, sort_keys=True, separators=(",", ":"), default=str)
    snapshot["document_sha256"] = hashlib.sha256(document_canonical.encode("utf-8")).hexdigest()
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
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
        thesis_md=str(snapshot.get("thesis_md") or f"IC decision: {body.action}."),
        trigger="decision", linked_decision_id=row.id,
    ), caller)
    return await _out(db, row)


@router.get("", response_model=List[DecisionOut])
async def list_decisions(
    issuer_id: str = Query(...),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    require_issuer(caller, await db.get(Issuer, issuer_id))
    rows = (await db.execute(
        select(Decision).where(Decision.issuer_id == issuer_id)
        .order_by(Decision.created_at.desc()).limit(100)
    )).scalars().all()
    return [await _out(db, row) for row in rows]


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
    if body.vote == "dissent" and not (body.dissent_note or "").strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Dissent requires a note")
    existing = (await db.execute(select(DecisionVote).where(
        DecisionVote.decision_id == row.id,
        DecisionVote.member == caller.id,
    ))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Member already voted on this decision")
    db.add(DecisionVote(
        decision_id=row.id, member=caller.id, vote=body.vote,
        dissent_note=(body.dissent_note or "").strip() or None,
    ))
    await db.flush()
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
    if f":{row.issuer_id}:" not in body.trigger_alert_key:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Alert key does not belong to decision issuer")
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
