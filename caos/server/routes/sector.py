"""Sector Review API.

First version: durable substrate tables plus explicit seed fallbacks. CP-SR and
CP-MON stay registry-pending until live and deterministic offline synthesis emit
schema-valid payloads.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import AnalystSectorFeed, SectorReviewRun, SectorSignal, aware_utc, get_db
from identity import CallerIdentity, get_identity
from sector_logic import sector_materiality_score, sector_signal_dedup_hash

router = APIRouter()

_READ_MAX_PER_MINUTE = 90
_WRITE_MAX_PER_MINUTE = 30
_ASK_MAX_PER_MINUTE = 20
_MAX_SIGNALS = 100


def _utc(y: int, m: int, d: int, hh: int, mm: int) -> datetime:
    return datetime(y, m, d, hh, mm, tzinfo=timezone.utc)


class SectorFeed(BaseModel):
    sector: str
    enabled: bool = True
    notify_pref: str = "in_app"
    provenance: str = "seed"


class SectorFeedUpdate(BaseModel):
    feeds: list[SectorFeed] = Field(default_factory=list, max_length=100)


class SectorSource(BaseModel):
    source_type: str
    ref: str
    title: str
    url: Optional[str] = None
    tier: str = "seed"
    provenance: str = "seed"


class SectorIssuer(BaseModel):
    issuer_id: Optional[str] = None
    name: str
    ticker: Optional[str] = None
    exposure: str = "watchlist"


class SectorSignalOut(BaseModel):
    id: str
    sector: str
    signal_date: datetime
    category: str
    severity: str
    headline: str
    summary: str
    materiality_score: float
    issuers: list[SectorIssuer] = Field(default_factory=list)
    sources: list[SectorSource] = Field(default_factory=list)
    provenance: str = "seed"
    staleness_flag: str = "seed"
    confidence: str = "fixture"


class SectorReviewSection(BaseModel):
    id: str
    title: str
    posture: str
    summary: str
    signal_ids: list[str] = Field(default_factory=list)


class SectorReviewOut(BaseModel):
    sector: str
    timeframe: str
    as_of: datetime
    posture: str
    confidence: str
    staleness_flag: str
    provenance: str
    module_status: str
    refresh_trigger: str = "seed"
    sections: list[SectorReviewSection]
    signals: list[SectorSignalOut]


class SectorRefreshRequest(BaseModel):
    sector: str
    timeframe: str = "today"
    as_of: Optional[str] = None


class SectorAskRequest(BaseModel):
    signal_id: str
    question: str = Field("", max_length=600)


class SectorAskResponse(BaseModel):
    signal_id: str
    answer: str
    financial_impact_summary: str
    affected_issuers: list[SectorIssuer]
    recommended_actions: list[str]
    sources: list[SectorSource]
    provenance: str
    retrieval_scope: str


_SEED_ROWS = [
    {
        "id": "seed-industrials-2026-07-06-01",
        "sector": "Industrials",
        "signal_date": _utc(2026, 7, 6, 10, 15),
        "category": "earnings",
        "severity": "high",
        "headline": "Q2 order books soften in short-cycle industrials",
        "summary": "Distributor commentary points to slower short-cycle demand; held names with high fixed-cost absorption need margin bridge checks.",
        "issuer_count": 2,
        "source_tier": "external_seed",
        "issuers": [
            {"name": "Atlas Forge Industrials", "ticker": "ATLF", "exposure": "held"},
            {"name": "Northwind Components", "ticker": "NWCF", "exposure": "peer"},
        ],
        "source": {
            "source_type": "external_seed",
            "ref": "seed://sector/industrials/order-book-2026-07-06",
            "title": "Seed fixture: industrial distributor desk note",
        },
    },
    {
        "id": "seed-telecom-2026-07-06-01",
        "sector": "Telecom",
        "signal_date": _utc(2026, 7, 6, 9, 40),
        "category": "liquidity",
        "severity": "critical",
        "headline": "Fiber overbuild funding gap widens for levered rural operators",
        "summary": "Capex timing and grant reimbursement lag create a nearer liquidity read-across for telecom credits with 2027 maturities.",
        "issuer_count": 1,
        "source_tier": "seed",
        "issuers": [
            {"name": "Meridian Telecom Holdings", "ticker": "MERF", "exposure": "held"},
        ],
        "source": {
            "source_type": "seed",
            "ref": "seed://sector/telecom/fiber-capex-2026-07-06",
            "title": "Seed fixture: telecom capex monitor",
        },
    },
    {
        "id": "seed-healthcare-2026-07-06-01",
        "sector": "Healthcare",
        "signal_date": _utc(2026, 7, 6, 8, 55),
        "category": "rating",
        "severity": "medium",
        "headline": "Agency language shifts toward labor-cost persistence",
        "summary": "Recent rating commentary emphasizes wage inflation persistence; service-heavy healthcare names need updated downside labor sensitivities.",
        "issuer_count": 2,
        "source_tier": "external_seed",
        "issuers": [
            {"name": "Helios Health Services", "ticker": "HHS", "exposure": "watchlist"},
            {"name": "Crescent Care Group", "ticker": "CCG", "exposure": "peer"},
        ],
        "source": {
            "source_type": "external_seed",
            "ref": "seed://sector/healthcare/labor-ratings-2026-07-06",
            "title": "Seed fixture: healthcare rating-language sweep",
        },
    },
    {
        "id": "seed-chemicals-2026-07-06-01",
        "sector": "Chemicals",
        "signal_date": _utc(2026, 7, 5, 16, 30),
        "category": "macro",
        "severity": "medium",
        "headline": "European energy volatility reopens EBITDA bridge risk",
        "summary": "Input-cost volatility is not yet visible in reported leverage, but CP-2 downside cases should refresh energy pass-through assumptions.",
        "issuer_count": 1,
        "source_tier": "seed",
        "issuers": [
            {"name": "Aurora Chemicals SA", "ticker": "AURC", "exposure": "held"},
        ],
        "source": {
            "source_type": "seed",
            "ref": "seed://sector/chemicals/energy-volatility-2026-07-05",
            "title": "Seed fixture: chemicals input-cost monitor",
        },
    },
    {
        "id": "seed-software-2026-07-06-01",
        "sector": "Software",
        "signal_date": _utc(2026, 7, 5, 13, 5),
        "category": "technical",
        "severity": "low",
        "headline": "Private software loan prints tighten despite flat ARR growth",
        "summary": "Secondary technicals improved without a same-period fundamental upgrade; relative-value screens should not convert price action into posture alone.",
        "issuer_count": 2,
        "source_tier": "seed",
        "issuers": [
            {"name": "Nimbus Software Group", "ticker": "NIMB", "exposure": "peer"},
            {"name": "Orion Workflow Systems", "ticker": "ORWF", "exposure": "watchlist"},
        ],
        "source": {
            "source_type": "seed",
            "ref": "seed://sector/software/loan-prints-2026-07-05",
            "title": "Seed fixture: software loan technicals",
        },
    },
    {
        "id": "seed-packaging-2026-07-06-01",
        "sector": "Packaging",
        "signal_date": _utc(2026, 7, 5, 11, 20),
        "category": "covenant",
        "severity": "medium",
        "headline": "Restructuring add-backs rise in packaging comps",
        "summary": "Reported EBITDA quality is diverging from covenant EBITDA; CP-4C add-back capacity checks are due before posture upgrades.",
        "issuer_count": 1,
        "source_tier": "internal_doc",
        "issuers": [
            {"name": "Pioneer Packaging LLC", "ticker": "PION", "exposure": "watchlist"},
        ],
        "source": {
            "source_type": "internal_doc",
            "ref": "vault://sector/packaging/addback-note",
            "title": "Seed fixture: internal packaging covenant note",
        },
    },
]

_SECTION_DEFS = [
    ("market", "Market Context"),
    ("fundamental", "Fundamental Direction"),
    ("valuation", "Relative Value"),
    ("liquidity", "Liquidity / Refi"),
    ("legal", "Legal / Covenant"),
    ("issuer", "Issuer Read-Across"),
    ("actions", "Analyst Actions"),
]

_CATEGORY_SECTION = {
    "macro": "market",
    "technical": "valuation",
    "earnings": "fundamental",
    "rating": "fundamental",
    "liquidity": "liquidity",
    "covenant": "legal",
}


def _read_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"sector-read:{caller.id}",
        max_attempts=_READ_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Sector read rate limit reached.")


def _write_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"sector-write:{caller.id}",
        max_attempts=_WRITE_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Sector write rate limit reached.")


def _ask_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"sector-ask:{caller.id}",
        max_attempts=_ASK_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Sector ASK rate limit reached.")


def _seed_signal(row: dict) -> SectorSignalOut:
    source = SectorSource(**row["source"], tier=row["source_tier"], provenance="seed")
    score = sector_materiality_score(
        row["severity"], row["category"], row["issuer_count"], row["source_tier"]
    )
    return SectorSignalOut(
        id=row["id"],
        sector=row["sector"],
        signal_date=row["signal_date"],
        category=row["category"],
        severity=row["severity"],
        headline=row["headline"],
        summary=row["summary"],
        materiality_score=score,
        issuers=[SectorIssuer(**issuer) for issuer in row["issuers"]],
        sources=[source],
        provenance="seed",
        staleness_flag="seed",
        confidence="fixture",
    )


def _all_seed_signals() -> list[SectorSignalOut]:
    return [_seed_signal(row) for row in _SEED_ROWS]


def _seed_sectors() -> list[str]:
    return sorted({row["sector"] for row in _SEED_ROWS})


def _matches(
    signal: SectorSignalOut,
    *,
    sector: str | None,
    q: str | None,
    category: str | None,
    severity: str | None,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> bool:
    if sector and signal.sector.lower() != sector.lower():
        return False
    if category and signal.category.lower() != category.lower():
        return False
    if severity and signal.severity.lower() != severity.lower():
        return False
    if from_dt and signal.signal_date < from_dt:
        return False
    if to_dt and signal.signal_date > to_dt:
        return False
    if q:
        needle = q.lower()
        haystack = " ".join([
            signal.headline,
            signal.summary,
            signal.category,
            signal.sector,
            " ".join(i.name for i in signal.issuers),
        ]).lower()
        if needle not in haystack:
            return False
    return True


def _parse_dt(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    try:
        if len(value) == 10:
            parsed_date = datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
            if end_of_day:
                return parsed_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            return parsed_date
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return aware_utc(parsed)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid date: {value}") from exc


def _db_signal(row: SectorSignal) -> SectorSignalOut:
    issuer = [SectorIssuer(issuer_id=row.issuer_id, name=row.issuer_name)] if row.issuer_name else []
    return SectorSignalOut(
        id=row.id,
        sector=row.sector,
        signal_date=aware_utc(row.signal_date) or row.signal_date,
        category=row.category,
        severity=row.severity,
        headline=row.headline,
        summary=row.body_excerpt,
        materiality_score=row.materiality_score,
        issuers=issuer,
        sources=[SectorSource(
            source_type=row.source_type,
            ref=row.source_ref,
            title=row.source_title,
            url=row.source_url,
            tier=row.source_tier,
            provenance=row.provenance,
        )],
        provenance=row.provenance,
        staleness_flag="live" if row.provenance != "seed" else "seed",
        confidence=str((row.payload or {}).get("confidence", "source-backed")),
    )


async def _db_has_signals(db: AsyncSession) -> bool:
    return (await db.execute(select(SectorSignal.id).limit(1))).scalar_one_or_none() is not None


async def _query_signals(
    db: AsyncSession,
    *,
    sector: str | None = None,
    q: str | None = None,
    category: str | None = None,
    severity: str | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    limit: int = 50,
) -> list[SectorSignalOut]:
    if await _db_has_signals(db):
        stmt = select(SectorSignal)
        if sector:
            stmt = stmt.where(SectorSignal.sector == sector)
        if category:
            stmt = stmt.where(SectorSignal.category == category)
        if severity:
            stmt = stmt.where(SectorSignal.severity == severity)
        if from_dt:
            stmt = stmt.where(SectorSignal.signal_date >= from_dt)
        if to_dt:
            stmt = stmt.where(SectorSignal.signal_date <= to_dt)
        if q:
            needle = f"%{q.strip()}%"
            stmt = stmt.where(SectorSignal.headline.ilike(needle) | SectorSignal.body_excerpt.ilike(needle))
        rows = (await db.execute(
            stmt.order_by(SectorSignal.materiality_score.desc(), SectorSignal.signal_date.desc()).limit(limit)
        )).scalars().all()
        return [_db_signal(row) for row in rows]

    seed = [
        signal for signal in _all_seed_signals()
        if _matches(
            signal,
            sector=sector,
            q=q.strip() if q else None,
            category=category,
            severity=severity,
            from_dt=from_dt,
            to_dt=to_dt,
        )
    ]
    return sorted(seed, key=lambda s: (s.materiality_score, s.signal_date), reverse=True)[:limit]


def _sections_for(sector: str, signals: list[SectorSignalOut]) -> list[SectorReviewSection]:
    by_category: dict[str, list[str]] = {}
    for signal in signals:
        by_category.setdefault(_CATEGORY_SECTION.get(signal.category, "issuer"), []).append(signal.id)
    count = len(signals)
    return [
        SectorReviewSection(
            id=section_id,
            title=title,
            posture="watch" if count else "quiet",
            summary=(
                f"{count} seed-backed signal{'s' if count != 1 else ''} currently frame the {sector} daily brief."
                if section_id in {"market", "issuer", "actions"}
                else "No live CP-SR synthesis yet; section awaits source-backed payload generation."
            ),
            signal_ids=by_category.get(section_id, []),
        )
        for section_id, title in _SECTION_DEFS
    ]


def _posture(signals: list[SectorSignalOut]) -> str:
    if any(s.severity == "critical" for s in signals):
        return "Deteriorating"
    if any(s.severity == "high" for s in signals):
        return "Watch"
    if signals:
        return "Neutral"
    return "Quiet"


async def _review_response(
    db: AsyncSession,
    *,
    sector: str,
    timeframe: str,
    as_of: datetime | None,
    refresh_trigger: str,
) -> SectorReviewOut:
    row = (await db.execute(
        select(SectorReviewRun)
        .where(SectorReviewRun.sector == sector, SectorReviewRun.timeframe == timeframe)
        .order_by(SectorReviewRun.as_of.desc())
        .limit(1)
    )).scalars().first()
    if row and isinstance(row.payload, dict):
        try:
            return SectorReviewOut(**row.payload)
        except Exception:
            pass

    signals = await _query_signals(db, sector=sector, limit=50)
    now = as_of or datetime.now(timezone.utc)
    return SectorReviewOut(
        sector=sector,
        timeframe=timeframe,
        as_of=now,
        posture=_posture(signals),
        confidence="fixture",
        staleness_flag="seed",
        provenance="seed",
        module_status="CP-SR pending",
        refresh_trigger=refresh_trigger,
        sections=_sections_for(sector, signals),
        signals=signals,
    )


@router.get("/feeds", response_model=list[SectorFeed])
async def read_feeds(
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_guard(caller)
    rows = (await db.execute(
        select(AnalystSectorFeed).where(AnalystSectorFeed.analyst_id == caller.id)
    )).scalars().all()
    overrides = {row.sector: row for row in rows}
    sectors = sorted(set(_seed_sectors()) | set(overrides))
    return [
        SectorFeed(
            sector=sector,
            enabled=overrides.get(sector).enabled if sector in overrides else True,
            notify_pref=overrides.get(sector).notify_pref if sector in overrides else "in_app",
            provenance="profile" if sector in overrides else "seed",
        )
        for sector in sectors
    ]


@router.put("/feeds", response_model=list[SectorFeed])
async def update_feeds(
    body: SectorFeedUpdate,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _write_guard(caller)
    existing = {
        row.sector: row
        for row in (await db.execute(
            select(AnalystSectorFeed).where(AnalystSectorFeed.analyst_id == caller.id)
        )).scalars().all()
    }
    now = datetime.now(timezone.utc)
    for feed in body.feeds:
        row = existing.get(feed.sector)
        if row is None:
            db.add(AnalystSectorFeed(
                analyst_id=caller.id,
                sector=feed.sector,
                enabled=feed.enabled,
                notify_pref=feed.notify_pref,
                created_at=now,
                updated_at=now,
            ))
        else:
            row.enabled = feed.enabled
            row.notify_pref = feed.notify_pref
            row.updated_at = now
    await db.commit()
    return await read_feeds(db=db, caller=caller)


@router.get("/signals", response_model=list[SectorSignalOut])
async def read_signals(
    sector: Optional[str] = None,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    q: Optional[str] = None,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, ge=1, le=_MAX_SIGNALS),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_guard(caller)
    return await _query_signals(
        db,
        sector=sector,
        q=q,
        category=category,
        severity=severity,
        from_dt=_parse_dt(from_),
        to_dt=_parse_dt(to, end_of_day=True),
        limit=limit,
    )


@router.get("/review", response_model=SectorReviewOut)
async def read_review(
    sector: str = Query(..., min_length=1, max_length=128),
    timeframe: str = Query("today", max_length=32),
    as_of: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_guard(caller)
    return await _review_response(
        db,
        sector=sector,
        timeframe=timeframe,
        as_of=_parse_dt(as_of),
        refresh_trigger="read",
    )


@router.post("/review/refresh", response_model=SectorReviewOut)
async def refresh_review(
    body: SectorRefreshRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _write_guard(caller)
    return await _review_response(
        db,
        sector=body.sector,
        timeframe=body.timeframe,
        as_of=_parse_dt(body.as_of),
        refresh_trigger="ad_hoc_seed",
    )


@router.post("/ask", response_model=SectorAskResponse)
async def ask_sector_topic(
    body: SectorAskRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _ask_guard(caller)
    signals = await _query_signals(db, limit=_MAX_SIGNALS)
    signal = next((s for s in signals if s.id == body.signal_id), None)
    if signal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sector signal not found.")

    issuer_names = ", ".join(i.name for i in signal.issuers) or "no linked issuers"
    question = body.question.strip() or "What is the credit impact?"
    return SectorAskResponse(
        signal_id=signal.id,
        answer=(
            f"Seed-context answer for: {question} "
            f"The signal is treated as {signal.severity} materiality for {signal.sector}; "
            "live CP-SR synthesis is not yet enabled."
        ),
        financial_impact_summary=(
            f"Focus on EBITDA bridge, liquidity runway, covenant headroom, and RV read-across for {issuer_names}."
        ),
        affected_issuers=signal.issuers,
        recommended_actions=[
            "Open cited source and confirm the factual claim before changing posture.",
            "Refresh issuer run objects only for directly affected names.",
            "Route material items to Monitor once CP-MON alert routing is live.",
        ],
        sources=signal.sources,
        provenance=signal.provenance,
        retrieval_scope=(
            "Restricted to this sector signal's cited sources plus existing issuer run objects; "
            "no open-web retrieval in the seed MVP."
        ),
    )


__all__ = ["sector_signal_dedup_hash", "sector_materiality_score"]
