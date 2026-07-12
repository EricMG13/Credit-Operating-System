"""Daily digest — deterministic coverage / ratings / activity roll-up. No LLM.

The system-wide "daily run" lane: everything here is a read over persisted state
(issuers, runs, analyst-entered ratings), safe to hit on a schedule — wire
``GET /api/digest/daily`` to cron / a scheduler, or let the Command Center pull
it on load. Nothing is written; a scheduled caller can never mutate state.

WARF is computed over the analyst-entered agency ratings on ``issuers``
(rating_moody preferred, S&P/Fitch translated onto the same scale) using
Moody's idealized rating factors, equal-weighted — position-weighted WARF needs
holdings data CAOS does not carry in Phase-1. The CCC-cliff watch lists names
rated B3/B- or below (the drift-to-CCC bucket that drives CLO haircuts).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import Issuer, Run, aware_utc, get_db
from identity import CallerIdentity, get_identity
from tenancy import scope_issuers, tenancy_enabled
# Rating scale lives in ratings.py (one source of truth, shared with the
# rating-distribution query walk + the ingest extractor).
from ratings import B3_IDX, FACTORS, MOODY, rating_index

# Issuer-scan cap shared by the query LIMIT and the BE6-3 truncated flag —
# a single constant so the flag can't silently drift from the cap.
_ISSUER_SCAN_CAP = 2000

router = APIRouter()

_READ_MAX_PER_MINUTE = 60
_MAX_LIST = 100  # bounded watch-lists; totals are always full counts


def _rating_index(issuer: Issuer) -> Optional[int]:
    """Scale index for an issuer's best available rating (Moody's preferred).
    Thin wrapper over ratings.rating_index — kept so callers/tests that pass an
    issuer object keep working while the scale itself has a single home."""
    return rating_index(issuer.rating_moody, issuer.rating_sp, issuer.rating_fitch)


def _warf_band(warf: float) -> str:
    """Nearest rating label for a WARF value (Moody's labels, title-cased)."""
    nearest = min(range(len(FACTORS)), key=lambda i: abs(FACTORS[i] - warf))
    return MOODY[nearest].capitalize()


class WatchRow(BaseModel):
    issuer_id: str
    name: str
    detail: Optional[str] = None


class DigestResponse(BaseModel):
    as_of: datetime
    coverage: Dict[str, int]           # issuers / rated / unrated / with_complete_run
    stale_threshold_days: int
    # Names with no complete run, or whose latest complete run is older than the
    # threshold (detail carries days-since or "never run").
    stale: List[WatchRow] = []
    warf: Optional[float] = None       # equal-weighted over rated names; None if none rated
    warf_band: Optional[str] = None
    ccc_watch: List[WatchRow] = []     # B3/B- and below
    qa: Dict[str, int] = {}            # latest-complete-run qa_status -> count
    activity_24h: Dict[str, int] = {}  # runs completed / failed in the last 24h


def _read_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"digest-read:{caller.id}", max_attempts=_READ_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Digest read rate limit reached — try again in a minute.",
        )


@router.get("/daily", response_model=DigestResponse)
async def daily_digest(
    days: int = Query(30, ge=1, le=365, description="Staleness threshold in days."),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_rate_guard(caller)
    now = datetime.now(timezone.utc)

    issuers = list((await db.execute(
        # scope_issuers no-ops when tenancy is off; keeps this consistent with
        # the runs query below, which is already conditionally scoped — without
        # this, a tenancy-enabled caller would see other teams' issuers here
        # (as "never run") even though their runs are correctly excluded there.
        scope_issuers(select(Issuer), caller).order_by(Issuer.name).limit(_ISSUER_SCAN_CAP)
    )).scalars().all())

    # Latest complete run per issuer, one query (newest-first, first wins).
    # Bounded (query-path P4 discipline): an issuer whose latest complete run
    # sits beyond the newest 5000 completes drops off the digest rather than
    # letting the scan grow without bound.
    latest: Dict[str, Run] = {}
    _complete = select(Run).where(Run.status == "complete")
    if tenancy_enabled():
        _complete = _complete.where(Run.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
    for r in (await db.execute(
        _complete
        .order_by(Run.created_at.desc()).limit(5000)
    )).scalars().all():
        latest.setdefault(r.issuer_id, r)

    stale: List[WatchRow] = []
    for issuer in issuers:
        run = latest.get(issuer.id)
        if run is None:
            stale.append(WatchRow(issuer_id=issuer.id, name=issuer.name, detail="never run"))
            continue
        ts = aware_utc(run.completed_at) or aware_utc(run.created_at)
        age = (now - ts).days if ts else None
        if age is not None and age > days:
            stale.append(WatchRow(issuer_id=issuer.id, name=issuer.name,
                                  detail=f"{age}d since last complete run"))
    stale = stale[:_MAX_LIST]

    indices = {i.id: _rating_index(i) for i in issuers}
    factors = [FACTORS[ix] for ix in indices.values() if ix is not None]
    warf = round(sum(factors) / len(factors), 0) if factors else None
    ccc_watch = [
        WatchRow(issuer_id=i.id, name=i.name,
                 detail=i.rating_moody or i.rating_sp or i.rating_fitch)
        for i in issuers
        if (ix := indices[i.id]) is not None and ix >= B3_IDX
    ][:_MAX_LIST]

    qa: Dict[str, int] = {}
    for run in latest.values():
        qa[run.qa_status] = qa.get(run.qa_status, 0) + 1

    # 24h activity: bounded recent window, timestamps compared in Python so the
    # count is identical across SQLite (string dates) and Postgres.
    cutoff = now - timedelta(hours=24)
    _recent = select(Run)
    if tenancy_enabled():
        _recent = _recent.where(Run.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
    recent = (await db.execute(
        _recent.order_by(Run.created_at.desc()).limit(1000)
    )).scalars().all()
    def within_24h(ts: Optional[datetime]) -> bool:
        aware = aware_utc(ts)
        return aware is not None and aware >= cutoff

    completed_24h = sum(
        1 for r in recent
        if r.status == "complete" and within_24h(r.completed_at or r.created_at)
    )
    failed_24h = sum(1 for r in recent if r.status == "failed" and within_24h(r.created_at))

    rated = sum(1 for ix in indices.values() if ix is not None)
    return DigestResponse(
        as_of=now,
        coverage={
            "issuers": len(issuers),
            # BE6-3: the issuer scan is capped (query-path P4 discipline); flag it so a
            # consumer never reads "issuers" as the true book size past the cap.
            "truncated": 1 if len(issuers) >= _ISSUER_SCAN_CAP else 0,
            "rated": rated,
            "unrated": len(issuers) - rated,
            "with_complete_run": sum(1 for i in issuers if i.id in latest),
        },
        stale_threshold_days=days,
        stale=stale,
        warf=warf,
        warf_band=_warf_band(warf) if warf is not None else None,
        ccc_watch=ccc_watch,
        qa=qa,
        activity_24h={"runs_completed": completed_24h, "runs_failed": failed_24h},
    )
