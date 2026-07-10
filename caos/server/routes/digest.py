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
from database import Issuer, Run, get_db
from identity import CallerIdentity, get_identity
from tenancy import scope_issuers, tenancy_enabled

router = APIRouter()

_READ_MAX_PER_MINUTE = 60
_MAX_LIST = 100  # bounded watch-lists; totals are always full counts

# Moody's scale, senior to junior, with idealized rating factors; the S&P/Fitch
# scale is index-aligned so a missing Moody's rating translates positionally.
_MOODY = ("aaa", "aa1", "aa2", "aa3", "a1", "a2", "a3", "baa1", "baa2", "baa3",
          "ba1", "ba2", "ba3", "b1", "b2", "b3", "caa1", "caa2", "caa3", "ca", "c")
_SP = ("aaa", "aa+", "aa", "aa-", "a+", "a", "a-", "bbb+", "bbb", "bbb-",
       "bb+", "bb", "bb-", "b+", "b", "b-", "ccc+", "ccc", "ccc-", "cc", "c")
_FACTORS = (1, 10, 20, 40, 70, 120, 180, 260, 360, 610,
            940, 1350, 1766, 2220, 2720, 3490, 4770, 6500, 8070, 10000, 10000)
_MOODY_IDX = {r: i for i, r in enumerate(_MOODY)}
_SP_IDX = {r: i for i, r in enumerate(_SP)}
_B3_IDX = _MOODY.index("b3")  # CCC-cliff watch: B3/B- and below


def _rating_index(issuer: Issuer) -> Optional[int]:
    """Scale index for an issuer's best available rating (Moody's preferred).
    First token only, case-insensitive — '(negative)' outlook suffixes and
    watch annotations are dropped rather than failing the parse."""
    for raw, idx in ((issuer.rating_moody, _MOODY_IDX),
                     (issuer.rating_sp, _SP_IDX),
                     (issuer.rating_fitch, _SP_IDX)):
        if raw and raw.strip():
            tok = raw.strip().split()[0].lower()
            if tok in idx:
                return idx[tok]
    return None


def _warf_band(warf: float) -> str:
    """Nearest rating label for a WARF value (Moody's labels, title-cased)."""
    nearest = min(range(len(_FACTORS)), key=lambda i: abs(_FACTORS[i] - warf))
    return _MOODY[nearest].capitalize()


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    # SQLite hands back naive datetimes; everything is stored as UTC.
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_rate_guard(caller)
    now = datetime.now(timezone.utc)

    issuers = list((await db.execute(
        scope_issuers(select(Issuer), caller).order_by(Issuer.name).limit(2000)
    )).scalars().all())

    # Latest complete run per issuer, one query (newest-first, first wins).
    # Bounded (query-path P4 discipline): an issuer whose latest complete run
    # sits beyond the newest 5000 completes drops off the digest rather than
    # letting the scan grow without bound.
    latest: Dict[str, Run] = {}
    complete_stmt = select(Run).where(Run.status == "complete")
    if tenancy_enabled():
        # Scope qa/activity counts to the caller's team too (not just the issuer list).
        complete_stmt = complete_stmt.where(Run.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
    for r in (await db.execute(
        complete_stmt.order_by(Run.created_at.desc()).limit(5000)
    )).scalars().all():
        latest.setdefault(r.issuer_id, r)

    stale: List[WatchRow] = []
    for issuer in issuers:
        run = latest.get(issuer.id)
        if run is None:
            stale.append(WatchRow(issuer_id=issuer.id, name=issuer.name, detail="never run"))
            continue
        ts = _aware(run.completed_at) or _aware(run.created_at)
        age = (now - ts).days if ts else None
        if age is not None and age > days:
            stale.append(WatchRow(issuer_id=issuer.id, name=issuer.name,
                                  detail=f"{age}d since last complete run"))
    stale = stale[:_MAX_LIST]

    indices = {i.id: _rating_index(i) for i in issuers}
    factors = [_FACTORS[ix] for ix in indices.values() if ix is not None]
    warf = round(sum(factors) / len(factors), 0) if factors else None
    ccc_watch = [
        WatchRow(issuer_id=i.id, name=i.name,
                 detail=i.rating_moody or i.rating_sp or i.rating_fitch)
        for i in issuers
        if indices[i.id] is not None and indices[i.id] >= _B3_IDX
    ][:_MAX_LIST]

    qa: Dict[str, int] = {}
    for run in latest.values():
        qa[run.qa_status] = qa.get(run.qa_status, 0) + 1

    # 24h activity: bounded recent window, timestamps compared in Python so the
    # count is identical across SQLite (string dates) and Postgres.
    cutoff = now - timedelta(hours=24)
    recent_stmt = select(Run)
    if tenancy_enabled():
        recent_stmt = recent_stmt.where(Run.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
    recent = (await db.execute(
        recent_stmt.order_by(Run.created_at.desc()).limit(1000)
    )).scalars().all()
    def within_24h(ts: Optional[datetime]) -> bool:
        aware = _aware(ts)
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
