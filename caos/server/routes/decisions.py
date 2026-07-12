"""IC Decision Record (C8, expansion 4.1) — the append-only "what did we
decide, when, on what evidence, and who dissented" close to the pipeline.

A record, not a workflow: only create + list exist, no update/delete. A
revised view is a new row (history is append-only by design — see
DecisionRecord's docstring in database.py).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import DecisionRecord, Issuer, get_db
from identity import CallerIdentity, get_identity
from tenancy import require_issuer, scope_issuers

router = APIRouter()

_CREATE_MAX_PER_MINUTE = 30
_LIST_CAP = 200

Recommendation = Literal["OVERWEIGHT", "NEUTRAL", "UNDERWEIGHT", "PASS"]
Conviction = Literal["HIGH", "MEDIUM", "LOW"]
Decision = Literal["approved", "declined", "revisit-by"]


class DecisionRecordCreate(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    run_id: Optional[str] = Field(default=None, max_length=36)
    report_id: Optional[str] = Field(default=None, max_length=36)
    recommendation: Recommendation
    conviction: Conviction
    thesis: str = Field(min_length=1, max_length=2000)
    committee_date: date
    decision: Decision
    dissent: Optional[str] = Field(default=None, max_length=2000)


class DecisionRecordOut(BaseModel):
    id: str
    issuer_id: str
    # Populated by list_decision_records's join for the cross-issuer Command
    # board view; create_decision_record's single-issuer response leaves it
    # unset (None) — the caller already knows which issuer it just posted to.
    issuer_name: Optional[str] = None
    run_id: Optional[str]
    report_id: Optional[str]
    recommendation: str
    conviction: str
    thesis: str
    committee_date: date
    decision: str
    dissent: Optional[str]
    analyst_id: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


@router.post("", response_model=DecisionRecordOut, status_code=201)
async def create_decision_record(
    body: DecisionRecordCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(f"decision-records:{caller.id}", max_attempts=_CREATE_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit reached — try again in a minute.")
    require_issuer(caller, await db.get(Issuer, body.issuer_id))
    record = DecisionRecord(
        issuer_id=body.issuer_id,
        run_id=body.run_id,
        report_id=body.report_id,
        recommendation=body.recommendation,
        conviction=body.conviction,
        thesis=body.thesis.strip(),
        committee_date=body.committee_date,
        decision=body.decision,
        dissent=(body.dissent or "").strip() or None,
        analyst_id=caller.id,
    )
    db.add(record)
    # TODO(E3): once claude/predeploy-e3-audit-log (PR #169) merges, add
    # audit.write(db, analyst_id=caller.id, action="decision_record.create",
    #             target_type="decision_record", target_id=record.id,
    #             after={"issuer_id": record.issuer_id, "recommendation": record.recommendation,
    #                    "decision": record.decision}) here, before commit —
    # same pattern as routes/qa.py's create_flag.
    await db.commit()
    await db.refresh(record)
    return DecisionRecordOut.model_validate(record)


@router.get("", response_model=List[DecisionRecordOut])
async def list_decision_records(
    issuer_id: Optional[str] = Query(default=None, max_length=36),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    q = (
        select(DecisionRecord, Issuer.name)
        .join(Issuer, Issuer.id == DecisionRecord.issuer_id)
        .where(DecisionRecord.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
        .order_by(DecisionRecord.created_at.desc())
        .limit(_LIST_CAP)
    )
    if issuer_id:
        q = q.where(DecisionRecord.issuer_id == issuer_id)
    rows = await db.execute(q)
    out = []
    for record, issuer_name in rows.all():
        item = DecisionRecordOut.model_validate(record)
        item.issuer_name = issuer_name
        out.append(item)
    return out
