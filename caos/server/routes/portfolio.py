"""Portfolio board — cross-issuer posture rolled up from each issuer's latest
complete run.

Read-only aggregation over runs + metric_facts + the CP-3 RV / CP-2B downside
module outputs. Everything here is engine-derived; market data (live spreads /
DM / Δ) is deliberately absent — that's an external feed, Phase-2 (see
docs/PHASE2_SCOPE.md). Returns an empty `rows` when no completed runs exist, so
the frontend Command Center keeps its seeded sample board ("prefer live, static
fallback", the same contract as useLiveRun / useModelEngine).

One pass, four queries (no N+1): issuers · latest-complete-run-per-issuer ·
headline facts for those runs · the CP-3/CP-2B outputs for those runs.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import timezone

import rate_limit
from database import Issuer, MetricFact, ModuleOutput, Run, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()

# Headline metric_facts surfaced per row (the LTM credit read; spreads are Phase-2).
_HEADLINE_METRICS = ("net_leverage", "interest_coverage", "revenue", "adj_ebitda", "altman_z")

_READ_MAX_PER_MINUTE = 60


def _read_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"portfolio-read:{caller.id}", max_attempts=_READ_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Portfolio read rate limit reached — try again in a minute.",
        )


class PortfolioRow(BaseModel):
    issuer_id: str
    name: str
    ticker: Optional[str] = None
    sector: Optional[str] = None          # from Issuer.industry
    run_id: str
    qa_status: str
    committee_status: str
    as_of: Optional[str] = None           # latest run's created_at (ISO)
    metrics: Dict[str, float]             # headline metric_key -> LTM value
    rv_recommendation: Optional[str] = None   # CP-3: OVERWEIGHT / NEUTRAL / UNDERWEIGHT
    rv_percentile: Optional[float] = None     # CP-3 composite percentile
    downside_fragility: Optional[str] = None  # CP-2B: HIGH / MODERATE / LOW


class PortfolioResponse(BaseModel):
    rows: List[PortfolioRow]
    issuer_count: int    # issuers in the coverage universe
    covered_count: int   # issuers with >=1 complete run (i.e. len(rows))


@router.get("", response_model=PortfolioResponse)
@router.get("/", response_model=PortfolioResponse)
async def get_portfolio(
    db: AsyncSession = Depends(get_db, scope="function"),
    identity: CallerIdentity = Depends(get_identity),
) -> PortfolioResponse:
    """Latest-complete-run posture across the coverage universe."""
    _read_rate_guard(identity)

    issuers = (await db.execute(select(Issuer).limit(2000))).scalars().all()

    # Latest complete run per issuer, DB-side. Run is append-only (never pruned),
    # so the old "scan every complete run newest-first, keep first-seen" fold
    # materialized the entire run history per board load (BE6-2); the issuer
    # universe is small but the run count isn't. Same rn==1 window idiom as the
    # querygraph fact reads.
    win = (
        select(
            Run.id.label("rid"),
            func.row_number()
            .over(
                partition_by=Run.issuer_id,
                order_by=(Run.created_at.desc().nullslast(), Run.id.desc()),
            )
            .label("rn"),
        )
        .where(Run.status == "complete")
        .subquery()
    )
    runs = (
        await db.execute(
            select(Run).where(Run.id.in_(select(win.c.rid).where(win.c.rn == 1)))
        )
    ).scalars().all()
    latest: Dict[str, Run] = {r.issuer_id: r for r in runs}
    run_ids = [r.id for r in runs]
    if not run_ids:
        return PortfolioResponse(rows=[], issuer_count=len(issuers), covered_count=0)

    # Headline facts for those runs. Scoped by run_id (so pre-run "seed" baselines
    # are already excluded); no provenance filter — a fixture-backed run (the ATLF
    # reference demo) carries provenance="fixture", and its own row should still
    # show its headline metrics. The fixture/run split matters for the *cross-issuer*
    # store (peer ranking), not for an issuer's own latest-run posture row.
    facts = (
        await db.execute(
            select(MetricFact.run_id, MetricFact.metric_key, MetricFact.value).where(
                MetricFact.run_id.in_(run_ids),
                MetricFact.headline.is_(True),
                MetricFact.metric_key.in_(_HEADLINE_METRICS),
            )
        )
    ).all()
    by_run_metric: Dict[str, Dict[str, float]] = {}
    for rid, mkey, val in facts:
        by_run_metric.setdefault(rid, {})[mkey] = val

    # CP-3 RV recommendation + CP-2B fragility for those runs.
    mods = (
        await db.execute(
            select(ModuleOutput.run_id, ModuleOutput.module_id, ModuleOutput.runtime_output).where(
                ModuleOutput.run_id.in_(run_ids),
                ModuleOutput.module_id.in_(("CP-3", "CP-2B")),
            )
        )
    ).all()
    cp3: Dict[str, dict] = {}
    cp2b: Dict[str, dict] = {}
    for rid, mid, output in mods:
        if mid == "CP-3":
            cp3[rid] = output or {}
        else:
            cp2b[rid] = output or {}

    rows: List[PortfolioRow] = []
    for iss in issuers:
        run = latest.get(iss.id)
        if run is None:
            continue  # no completed run yet — omit from the live board
        ro3 = cp3.get(run.id, {})
        ro2b = cp2b.get(run.id, {})
        rows.append(
            PortfolioRow(
                issuer_id=iss.id, name=iss.name, ticker=iss.ticker, sector=iss.industry,
                run_id=run.id, qa_status=run.qa_status, committee_status=run.committee_status,
                # Stamp UTC on the (SQLite-naive) timestamp so the client's
                # Date parse doesn't shift the as-of date by the local offset.
                as_of=(run.created_at.replace(tzinfo=run.created_at.tzinfo or timezone.utc)
                       .isoformat() if run.created_at else None),
                metrics=by_run_metric.get(run.id, {}),
                rv_recommendation=ro3.get("recommendation"),
                rv_percentile=ro3.get("composite_percentile"),
                downside_fragility=ro2b.get("fragility"),
            )
        )
    rows.sort(key=lambda r: r.name.lower())  # stable, name-ordered
    return PortfolioResponse(
        rows=rows, issuer_count=len(issuers), covered_count=len(rows)
    )
