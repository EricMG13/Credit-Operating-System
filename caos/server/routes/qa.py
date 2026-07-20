"""Analyst QA flags — the Deep-Dive register's "FLAG TO QA · CP-5" lane.

An analyst flag is an audit-trail escalation on a module/step output. It is
recorded and listable, and deliberately separate from engine qa_findings so a
flag can never gate a run or block a committee export.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from config import get_settings
from database import AnalystQaFlag, Issuer, QAFinding, Run, get_db
from identity import CallerIdentity, get_identity, get_write_identity
from tenancy import require_issuer, require_run_access, scope_issuers, tenancy_enabled

router = APIRouter()

_FLAGS_MAX_PER_MINUTE = 30
_LIST_CAP = 200
_FINDINGS_MAX_PER_MINUTE = 120
_FINDINGS_LIST_CAP = 1000


class LatestQaFindingOut(BaseModel):
    id: str
    finding_id: str
    run_id: str
    issuer_id: str
    issuer: str
    ticker: Optional[str]
    module_id: Optional[str]
    severity: str
    lane: Optional[int]
    description: str
    affected_claim_id: Optional[str]
    required_remediation: Optional[str]
    as_of: Optional[str]


@router.get("/findings", response_model=List[LatestQaFindingOut])
async def list_latest_findings(
    limit: int = Query(500, ge=1, le=_FINDINGS_LIST_CAP),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Open CP-5 findings from each issuer's latest accessible complete run.

    Rank only after applying analyst ownership and issuer tenancy. This keeps a
    newer foreign run from hiding the caller's own latest run and prevents the
    cross-coverage queue from becoming a finding-text exfiltration surface.
    One windowed query replaces a per-run frontend fan-out.
    """
    if not rate_limit.hit(
        f"qa-findings:{caller.id}",
        max_attempts=_FINDINGS_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "QA findings rate limit reached — try again in a minute.",
        )

    accessible_runs = select(
        Run.id.label("run_id"),
        Run.issuer_id.label("issuer_id"),
        Run.as_of_date.label("as_of"),
        func.row_number().over(
            partition_by=Run.issuer_id,
            order_by=(Run.completed_at.desc(), Run.created_at.desc()),
        ).label("run_rank"),
    ).where(Run.status == "complete")
    if tenancy_enabled():
        accessible_runs = accessible_runs.where(
            Run.issuer_id.in_(scope_issuers(select(Issuer.id), caller))
        )
    if not get_settings().caos_cross_analyst_run_sharing_enabled:
        accessible_runs = accessible_runs.where(Run.analyst_id == caller.id)

    latest = accessible_runs.subquery()
    statement = (
        select(
            QAFinding,
            latest.c.issuer_id,
            latest.c.as_of,
            Issuer.name,
            Issuer.ticker,
        )
        .join(latest, latest.c.run_id == QAFinding.run_id)
        .join(Issuer, Issuer.id == latest.c.issuer_id)
        .where(latest.c.run_rank == 1)
        .order_by(QAFinding.severity, QAFinding.finding_id)
        .limit(limit)
    )
    rows = (await db.execute(statement)).all()
    return [
        LatestQaFindingOut(
            id=finding.id,
            finding_id=finding.finding_id,
            run_id=finding.run_id,
            issuer_id=issuer_id,
            issuer=name,
            ticker=ticker,
            module_id=finding.module_id,
            severity=finding.severity,
            lane=finding.lane,
            description=finding.description,
            affected_claim_id=finding.affected_claim_id,
            required_remediation=finding.required_remediation,
            as_of=as_of,
        )
        for finding, issuer_id, as_of, name, ticker in rows
    ]


class QaFlagCreate(BaseModel):
    module_id: str = Field(min_length=2, max_length=16)
    step_ref: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=2000)
    issuer_id: Optional[str] = Field(default=None, max_length=36)
    run_id: Optional[str] = Field(default=None, max_length=36)


class QaFlagOut(BaseModel):
    id: str
    issuer_id: Optional[str]
    run_id: Optional[str]
    module_id: str
    step_ref: Optional[str]
    note: Optional[str]
    analyst_id: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


@router.post("/flags", response_model=QaFlagOut, status_code=201)
async def create_flag(
    body: QaFlagCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    if not rate_limit.hit(f"qa-flags:{caller.id}", max_attempts=_FLAGS_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Flag rate limit reached — try again in a minute.")
    issuer_id = body.issuer_id
    if issuer_id is not None:
        require_issuer(caller, await db.get(Issuer, issuer_id))
    if body.run_id is not None:
        run = await db.get(Run, body.run_id)
        # Historical audit rows deliberately survive a deleted subject, so an
        # unknown run id remains recordable. A run that still exists must be
        # accessible, however, and cannot be paired with a different issuer.
        if run is not None:
            await require_run_access(caller, run, db)
            if issuer_id is not None and issuer_id != run.issuer_id:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "issuer_id does not match run_id",
                )
            issuer_id = run.issuer_id
    flag = AnalystQaFlag(
        issuer_id=issuer_id,
        run_id=body.run_id,
        module_id=body.module_id,
        step_ref=body.step_ref,
        note=(body.note or "").strip() or None,
        analyst_id=caller.id,
    )
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return QaFlagOut.model_validate(flag)


@router.get("/flags", response_model=List[QaFlagOut])
async def list_flags(
    module_id: Optional[str] = Query(default=None, max_length=16),
    step_ref: Optional[str] = Query(default=None, max_length=120),
    issuer_id: Optional[str] = Query(default=None, max_length=36),
    run_id: Optional[str] = Query(default=None, max_length=36),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    if issuer_id is not None:
        require_issuer(caller, await db.get(Issuer, issuer_id))
    q = select(AnalystQaFlag).order_by(AnalystQaFlag.created_at.desc()).limit(_LIST_CAP)
    if tenancy_enabled():
        q = q.where(
            AnalystQaFlag.issuer_id.in_(scope_issuers(select(Issuer.id), caller))
        )
    if module_id:
        q = q.where(AnalystQaFlag.module_id == module_id)
    if step_ref:
        q = q.where(AnalystQaFlag.step_ref == step_ref)
    if issuer_id is not None:
        q = q.where(AnalystQaFlag.issuer_id == issuer_id)
    if run_id:
        q = q.where(AnalystQaFlag.run_id == run_id)
    rows = await db.execute(q)
    return [QaFlagOut.model_validate(f) for f in rows.scalars().all()]
