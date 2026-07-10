"""Sponsor track-record — cross-issuer aggregation of CP-2D governance reviews.

The question a screen-stage analyst asks about a private-equity owner: *what has
this sponsor done to creditors across the names we cover?* A read-model over
data the engine already persists — issuers grouped by the analyst-entered
``Issuer.sponsor`` string, each name's latest complete run's CP-2D
(sponsor_governance_review) score + red-flag ledger, and the headline leverage
fact. No LLM, no new computation, nothing external (own-vault data only).

Portfolio-style query discipline: one pass, four bounded queries, no N+1.
"""

from __future__ import annotations

from collections import Counter
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import Issuer, MetricFact, ModuleOutput, Run, get_db
from engine.periods import is_finite_number
from identity import CallerIdentity, get_identity
from tenancy import scope_issuers

router = APIRouter()

_READ_MAX_PER_MINUTE = 60
_MAX_ISSUERS = 500


def _read_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"sponsor-read:{caller.id}", max_attempts=_READ_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Sponsor read rate limit reached — try again in a minute.",
        )


class SponsorSummary(BaseModel):
    sponsor: str
    issuer_count: int


class SponsorIssuerRow(BaseModel):
    issuer_id: str
    name: str
    ticker: Optional[str] = None
    run_id: Optional[str] = None
    qa_status: Optional[str] = None
    governance_risk_score: Optional[float] = None
    flags: List[str] = []
    net_leverage: Optional[float] = None


class SponsorTrackRecordResponse(BaseModel):
    sponsor: str
    issuer_count: int
    # Mean of per-issuer CP-2D scores where a run produced one; None when no
    # covered name has a scored review yet (never fabricated).
    avg_governance_risk_score: Optional[float] = None
    # Red-flag label -> number of covered names it fired on (the track record:
    # "dividend recap flagged at 3 of this sponsor's 5 names").
    flag_counts: Dict[str, int] = {}
    issuers: List[SponsorIssuerRow] = []


@router.get("", response_model=List[SponsorSummary], include_in_schema=False)
@router.get("/", response_model=List[SponsorSummary])
async def list_sponsors(
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_rate_guard(caller)
    rows = (await db.execute(
        scope_issuers(
            select(Issuer.sponsor, func.count()).where(Issuer.sponsor.is_not(None)), caller
        )
        .group_by(Issuer.sponsor)
        .order_by(func.count().desc(), Issuer.sponsor)
        .limit(_MAX_ISSUERS)
    )).all()
    return [SponsorSummary(sponsor=s, issuer_count=n) for s, n in rows if s]


@router.get("/{sponsor}", response_model=SponsorTrackRecordResponse)
async def sponsor_track_record(
    sponsor: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_rate_guard(caller)
    issuers = list((await db.execute(
        scope_issuers(select(Issuer).where(Issuer.sponsor == sponsor), caller)
        .order_by(Issuer.name).limit(_MAX_ISSUERS)
    )).scalars().all())
    if not issuers:
        raise HTTPException(404, "Sponsor not found")
    ids = [i.id for i in issuers]

    # Latest complete run per issuer (newest-first, first wins per issuer).
    # Bounded (query-path P4 discipline): plenty for ≤500 names per sponsor.
    latest: Dict[str, Run] = {}
    for r in (await db.execute(
        select(Run).where(Run.issuer_id.in_(ids), Run.status == "complete")
        .order_by(Run.created_at.desc()).limit(2000)
    )).scalars().all():
        latest.setdefault(r.issuer_id, r)

    run_ids = [r.id for r in latest.values()]
    reviews: Dict[str, dict] = {}
    if run_ids:
        for m in (await db.execute(
            select(ModuleOutput).where(
                ModuleOutput.run_id.in_(run_ids), ModuleOutput.module_id == "CP-2D")
        )).scalars().all():
            reviews[m.run_id] = m.runtime_output or {}

    # Headline net leverage per issuer; run-provenance preferred over seed.
    leverage: Dict[str, float] = {}
    for f in (await db.execute(
        select(MetricFact).where(
            MetricFact.issuer_id.in_(ids),
            MetricFact.metric_key == "net_leverage",
            MetricFact.headline.is_(True))
    )).scalars().all():
        if f.issuer_id not in leverage or f.provenance == "run":
            leverage[f.issuer_id] = f.value

    rows: List[SponsorIssuerRow] = []
    scores: List[float] = []
    flag_counter: Counter = Counter()
    for issuer in issuers:
        run = latest.get(issuer.id)
        ro = reviews.get(run.id, {}) if run else {}
        score = ro.get("governance_risk_score")
        flags = sorted({str(e["flag"]) for e in (ro.get("ledger") or [])
                        if isinstance(e, dict) and e.get("flag")})
        if is_finite_number(score):
            scores.append(float(score))
        flag_counter.update(flags)  # one count per issuer per flag
        rows.append(SponsorIssuerRow(
            issuer_id=issuer.id,
            name=issuer.name,
            ticker=issuer.ticker,
            run_id=run.id if run else None,
            qa_status=run.qa_status if run else None,
            governance_risk_score=float(score) if is_finite_number(score) else None,
            flags=flags,
            net_leverage=leverage.get(issuer.id),
        ))

    return SponsorTrackRecordResponse(
        sponsor=sponsor,
        issuer_count=len(issuers),
        avg_governance_risk_score=round(sum(scores) / len(scores), 1) if scores else None,
        flag_counts=dict(flag_counter),
        issuers=rows,
    )
