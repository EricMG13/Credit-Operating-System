"""Sector Review API.

First version: durable substrate tables plus explicit seed fallbacks. CP-SR and
CP-MON stay registry-pending until live and deterministic offline synthesis emit
schema-valid payloads.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal, Optional, cast
from weakref import WeakValueDictionary

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from analysis_contracts import (
    AuthorityEnvelope,
    SectorComparable,
    SectorDimensionScore,
    SectorEarlyWarning,
    SectorReviewSectionV2,
    SectorReviewV2,
    SectorRisk,
    SectorSourceRegisterItem,
    SectorUncertainty,
)
from database import (
    AnalysisContextRecord,
    AnalystSectorFeed,
    SectorReviewRatification,
    SectorReviewRun,
    SectorSignal,
    aware_utc,
    get_db,
)
from identity import CallerIdentity, get_identity, get_write_identity, require_write_role
from engine.locks import key_from_str
from engine.periods import is_finite_number
from sector_taxonomy import CANONICAL_SECTORS, canonical_sector_id
from sector_logic import sector_materiality_score, sector_signal_dedup_hash
from tenancy import block_if_tenancy_unscoped

router = APIRouter()

_READ_MAX_PER_MINUTE = 90
_WRITE_MAX_PER_MINUTE = 30
_ASK_MAX_PER_MINUTE = 20
_MAX_SIGNALS = 100
_LOCAL_SECTOR_LOCKS: WeakValueDictionary[str, asyncio.Lock] = WeakValueDictionary()


@asynccontextmanager
async def _sector_mutation_lock(db: AsyncSession, label: str):
    """Serialize a review mutation across workers and SQLite test requests.

    PostgreSQL uses a transaction-scoped advisory lock so a crash/rollback
    releases ownership automatically. SQLite is intentionally single-process;
    a weakly-held asyncio lock supplies the equivalent local critical section.
    """
    if db.get_bind().dialect.name == "postgresql":
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:key)"),
            {"key": key_from_str(label)},
        )
        yield
        return
    lock = _LOCAL_SECTOR_LOCKS.get(label)
    if lock is None:
        lock = asyncio.Lock()
        _LOCAL_SECTOR_LOCKS[label] = lock
    async with lock:
        yield


def _utc(y: int, m: int, d: int, hh: int, mm: int) -> datetime:
    return datetime(y, m, d, hh, mm, tzinfo=timezone.utc)


class SectorFeed(BaseModel):
    sector: str = Field(max_length=128)
    enabled: bool = True
    notify_pref: str = Field(default="in_app", max_length=32)
    provenance: str = Field(default="seed", max_length=32)


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
    materiality_score: Optional[float] = None
    issuers: list[SectorIssuer] = Field(default_factory=list)
    sources: list[SectorSource] = Field(default_factory=list)
    provenance: str = "seed"
    staleness_flag: str = "seed"
    confidence: str = "fixture"

    @field_validator("materiality_score", mode="before")
    @classmethod
    def finite_materiality_score(cls, value):
        return float(value) if is_finite_number(value) else None


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
    sector: str = Field(min_length=1, max_length=128)
    timeframe: str = Field(default="today", max_length=32)
    as_of: Optional[str] = Field(default=None, max_length=64)


class SectorAskRequest(BaseModel):
    signal_id: str = Field(min_length=1, max_length=128)
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
    require_write_role(caller)
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
    return sorted({str(row["sector"]) for row in _SEED_ROWS})


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
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Invalid date: {value}") from exc


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
                f"{count} seed-backed signal{'s' if count != 1 else ''} currently "
                f"{'frame' if count != 1 else 'frames'} the {sector} daily brief."
                if section_id in {"market", "issuer", "actions"}
                else "No sector synthesis yet — this section fills once source-backed signals are available."
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
    db: AsyncSession = Depends(get_db, scope="function"),
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
            enabled=row.enabled if row is not None else True,
            notify_pref=row.notify_pref if row is not None else "in_app",
            provenance="profile" if row is not None else "seed",
        )
        for sector, row in ((s, overrides.get(s)) for s in sectors)
    ]


@router.put("/feeds", response_model=list[SectorFeed])
async def update_feeds(
    body: SectorFeedUpdate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
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
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_guard(caller)
    block_if_tenancy_unscoped()  # cross-issuer signal roll-up is not team-scoped
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
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_guard(caller)
    block_if_tenancy_unscoped()  # sector dossier aggregates issuers across the book
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
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
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
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _ask_guard(caller)
    block_if_tenancy_unscoped()  # answers expose cross-issuer signal linkage
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


# ── CP-SR V2: versioned dossier, section ratification and publication ────────

_DIMENSIONS = (
    ("fundamentals", "Fundamental direction"),
    ("leverage", "Leverage trajectory"),
    ("liquidity", "Liquidity and refinancing"),
    ("covenants", "Covenant protection"),
    ("recovery", "Downside and recovery"),
    ("relative-value", "Relative value"),
)


class SectorReviewCreate(BaseModel):
    context_id: str = Field(min_length=1, max_length=36)
    sector_id: Optional[str] = Field(default=None, max_length=128)
    timeframe: str = Field(default="weekly", max_length=32)
    as_of: Optional[str] = Field(default=None, max_length=64)
    refresh_trigger: Literal["ad_hoc", "scheduled", "signal"] = "ad_hoc"


class SectionRatification(BaseModel):
    section_id: str = Field(min_length=1, max_length=64)
    decision: Literal["ratified", "rejected"]
    override_text: Optional[str] = Field(default=None, max_length=4000)


class SectorRatificationRequest(BaseModel):
    sections: list[SectionRatification] = Field(min_length=1, max_length=7)


async def _owned_analysis_context(
    db: AsyncSession, context_id: str, analyst_id: str
) -> AnalysisContextRecord:
    context = (await db.execute(select(AnalysisContextRecord).where(
        AnalysisContextRecord.id == context_id,
        AnalysisContextRecord.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if context is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    return context


async def _owned_review(
    db: AsyncSession, review_id: str, analyst_id: str, *, for_update: bool = False
) -> SectorReviewRun:
    stmt = select(SectorReviewRun).where(
        SectorReviewRun.id == review_id,
        SectorReviewRun.analyst_id == analyst_id,
    )
    if for_update:
        stmt = stmt.with_for_update()
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sector review not found.")
    return row


def _review_v2(row: SectorReviewRun) -> SectorReviewV2:
    try:
        review = SectorReviewV2.model_validate(row.payload)
        if review.version != row.version:
            review.version = row.version
            review.authority.version_id = f"v{row.version}"
        return review
    except Exception as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Sector review uses the legacy contract.") from exc


def _severity_likelihood(severity: str) -> Literal["low", "medium", "high"]:
    if severity in {"critical", "high"}:
        return "high"
    if severity == "medium":
        return "medium"
    return "low"


def _build_review_payload(
    *,
    review_id: str,
    context_id: str,
    sector_id: str,
    timeframe: str,
    version: int,
    now: datetime,
    signals: list[SectorSignalOut],
) -> SectorReviewV2:
    label = CANONICAL_SECTORS[sector_id][0]
    live_signals = [signal for signal in signals if signal.provenance not in {"seed", "demo", "reference"}]
    origin = "live" if live_signals else "reference"
    latest_signal = max((signal.signal_date for signal in signals), default=None)
    age_days = (now - latest_signal).days if latest_signal else None
    freshness = "stale" if age_days is None or age_days > 14 else "current"
    source_ids = [signal.id for signal in signals]

    section_seed = _sections_for(label, signals)
    sections = [SectorReviewSectionV2(
        id=section.id,
        title=section.title,
        posture=section.posture,
        summary=section.summary,
        confidence=0.65 if live_signals else 0.35,
        freshness=freshness if live_signals else "reference",
        signal_ids=section.signal_ids,
    ) for section in section_seed]

    dimensions = [SectorDimensionScore(
        id=dimension_id,
        label=dimension_label,
        score=None,
        confidence=0,
        freshness="unavailable",
        source_ids=[],
        missing_dependency="CP-SR dimension synthesis",
    ) for dimension_id, dimension_label in _DIMENSIONS]

    risks = [SectorRisk(
        id=f"risk-{signal.id}",
        title=signal.headline,
        likelihood=_severity_likelihood(signal.severity),
        severity=cast(
            Literal["low", "medium", "high", "critical"],
            signal.severity if signal.severity in {"low", "medium", "high", "critical"} else "medium",
        ),
        mitigants=[],
        residual_risk="Unassessed — analyst review required.",
        source_ids=[signal.id],
    ) for signal in signals[:5]]

    comparable_map: dict[str, SectorComparable] = {}
    for signal in signals:
        for issuer in signal.issuers:
            key = issuer.issuer_id or issuer.name.lower()
            comparable_map.setdefault(key, SectorComparable(
                issuer_id=issuer.issuer_id,
                issuer_name=issuer.name,
                posture="affected",
                metrics={},
                missing_dependencies=["latest issuer facts", "comparable valuation"],
            ))

    early_warning: list[SectorEarlyWarning] = []
    invalid_score_ids: list[str] = []
    for signal in signals:
        score = signal.materiality_score
        if not is_finite_number(score):
            invalid_score_ids.append(signal.id)
            current_state = f"Unavailable / {signal.severity}"
            warning_status: Literal["normal", "watch", "breached", "unavailable"] = "unavailable"
        else:
            # sector_materiality_score is capped at 0.99 — the old ">= 75" clause
            # could never fire and the "{score:.0f}" render showed a meaningless
            # 0/1 beside a threshold text claiming 75 (triage 2026-07-16 P3).
            current_state = f"{score:.2f} / {signal.severity}"
            warning_status = (
                "breached" if signal.severity == "critical" or score >= 0.75
                else "watch" if signal.severity in {"high", "medium"}
                else "normal"
            )
        early_warning.append(SectorEarlyWarning(
            id=f"ew-{signal.id}",
            indicator=signal.headline,
            threshold="Materiality score >= 0.75 or severity critical",
            current_state=current_state,
            status=warning_status,
            source_ids=[signal.id],
        ))

    sources: list[SectorSourceRegisterItem] = []
    seen_sources: set[str] = set()
    for signal in signals:
        for source in signal.sources:
            if source.ref in seen_sources:
                continue
            seen_sources.add(source.ref)
            sources.append(SectorSourceRegisterItem(
                id=source.ref,
                title=source.title,
                origin=source.provenance,
                method=source.source_type,
                freshness="reference" if source.provenance == "seed" else freshness,
                as_of=signal.signal_date,
                url=source.url,
            ))

    missing_dependencies = [
        "six CP-SR dimension scores",
        "issuer comparable metrics",
        "downside and recovery evidence",
    ]
    if not live_signals:
        missing_dependencies.insert(0, "live source-backed sector signals")
    missing_dependencies.extend(
        f"finite materiality score for signal {signal_id}"
        for signal_id in invalid_score_ids
    )
    uncertainties = [SectorUncertainty(
        id=f"gap-{index + 1}",
        statement=dependency,
        impact="Blocks decision-grade publication and downstream use.",
        route_to_qa=True,
        source_ids=source_ids,
    ) for index, dependency in enumerate(missing_dependencies)]

    if live_signals:
        what_changed = live_signals[0].headline
        why_it_matters = live_signals[0].summary
    else:
        what_changed = "Observation incomplete — no qualifying live signal set."
        why_it_matters = "Reference signals can frame investigation but cannot establish sector posture."

    status_value: Literal["partial", "stale"] = "stale" if live_signals and freshness == "stale" else "partial"
    authority = AuthorityEnvelope(
        origin=origin,
        method="CP-SR adapter-v2",
        freshness=freshness if live_signals else "reference",
        as_of=now,
        source_ids=source_ids,
        run_id=review_id,
        version_id=f"v{version}",
        confidence=0.65 if live_signals else 0.35,
        approval_state="draft",
    )
    return SectorReviewV2(
        id=review_id,
        context_id=context_id,
        sector_id=sector_id,
        sector_label=label,
        timeframe=timeframe,
        version=version,
        status=status_value,
        as_of=now,
        posture=_posture(signals) if live_signals else "Unratified",
        what_changed=what_changed,
        why_it_matters=why_it_matters,
        required_action="Resolve source gaps, inspect evidence, then ratify each section.",
        evidence_health=(
            f"{len(live_signals)} live / {len(signals)} total signals"
            if live_signals else f"REFERENCE ONLY · {len(signals)} signals"
        ),
        sections=sections,
        dimension_scores=dimensions,
        risks=risks,
        comparables=list(comparable_map.values()),
        early_warning=early_warning,
        source_register=sources,
        uncertainties=uncertainties,
        downstream_readiness={
            "ready": False,
            "consumers": ["Query", "RV Screener", "Command", "Monitor", "Report Studio"],
            "blocked_by": missing_dependencies + ["analyst ratification"],
        },
        missing_dependencies=missing_dependencies,
        authority=authority,
        ratifications={},
        created_at=now,
    )


@router.post("/reviews", response_model=SectorReviewV2, status_code=status.HTTP_201_CREATED)
async def create_sector_review(
    body: SectorReviewCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _write_guard(caller)
    # Versioning is analyst-wide so two contexts for the same sector cannot race
    # through the first-version/no-row gap. The critical section includes commit:
    # the next creator must observe the just-written version before incrementing.
    async with _sector_mutation_lock(db, f"sector-review-create:{caller.id}"):
        context = await _owned_analysis_context(db, body.context_id, caller.id)
        requested_sector = canonical_sector_id(body.sector_id) if body.sector_id else context.sector_id
        if requested_sector is None or requested_sector not in CANONICAL_SECTORS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A canonical sector is required.")
        if context.sector_id and context.sector_id != requested_sector:
            raise HTTPException(status.HTTP_409_CONFLICT, "Review sector does not match the active context.")
        context.sector_id = requested_sector
        label = CANONICAL_SECTORS[requested_sector][0]
        now = _parse_dt(body.as_of) or datetime.now(timezone.utc)
        previous_version = (await db.execute(
            select(func.max(SectorReviewRun.version))
            .where(
                SectorReviewRun.sector == requested_sector,
                SectorReviewRun.analyst_id == caller.id,
            )
        )).scalar_one_or_none() or 0
        signals = await _query_signals(db, sector=label, limit=50)
        row = SectorReviewRun(
            sector=requested_sector,
            version=previous_version + 1,
            timeframe=body.timeframe,
            as_of=now,
            posture="Unratified",
            confidence={},
            payload={},
            input_signal_ids=[signal.id for signal in signals],
            analyst_id=caller.id,
            refresh_trigger=body.refresh_trigger,
            status="running",
            provenance="reference",
            created_at=now,
        )
        db.add(row)
        await db.flush()
        review = _build_review_payload(
            review_id=row.id,
            context_id=context.id,
            sector_id=requested_sector,
            timeframe=body.timeframe,
            version=previous_version + 1,
            now=now,
            signals=signals,
        )
        row.posture = review.posture
        row.confidence = {"overall": review.authority.confidence}
        row.payload = review.model_dump(mode="json")
        row.status = review.status
        row.provenance = review.authority.origin
        context.sector_review_run_id = row.id
        context.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return review


@router.get("/reviews", response_model=list[SectorReviewV2])
async def list_sector_reviews(
    context_id: Optional[str] = None,
    sector_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_guard(caller)
    stmt = select(SectorReviewRun).where(SectorReviewRun.analyst_id == caller.id)
    if context_id:
        await _owned_analysis_context(db, context_id, caller.id)
        stmt = stmt.where(
            SectorReviewRun.payload["context_id"].as_string() == context_id
        )
    if sector_id:
        canonical = canonical_sector_id(sector_id)
        if canonical is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown sector taxonomy value.")
        stmt = stmt.where(SectorReviewRun.sector == canonical)
    rows = (await db.execute(
        stmt.order_by(SectorReviewRun.created_at.desc()).limit(100)
    )).scalars().all()
    reviews: list[SectorReviewV2] = []
    for row in rows:
        try:
            review = _review_v2(row)
        except HTTPException:
            continue
        if context_id and review.context_id != context_id:
            continue
        reviews.append(review)
    return reviews


@router.get("/reviews/{review_id}", response_model=SectorReviewV2)
async def get_sector_review(
    review_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_guard(caller)
    return _review_v2(await _owned_review(db, review_id, caller.id))


@router.post("/reviews/{review_id}/ratifications", response_model=SectorReviewV2)
async def ratify_sector_review(
    review_id: str,
    body: SectorRatificationRequest,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _write_guard(caller)
    async with _sector_mutation_lock(db, f"sector-review-ratify:{review_id}"):
        row = await _owned_review(db, review_id, caller.id, for_update=True)
        review = _review_v2(row)
        valid_sections = {section.id for section in review.sections}
        if any(item.section_id not in valid_sections for item in body.sections):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown sector-review section.")
        section_ids = [item.section_id for item in body.sections]
        existing_by_section = {
            ratification.section_id: ratification
            for ratification in (await db.execute(select(SectorReviewRatification).where(
                SectorReviewRatification.review_run_id == row.id,
                SectorReviewRatification.analyst_id == caller.id,
                SectorReviewRatification.section_id.in_(section_ids),
            ))).scalars().all()
        } if section_ids else {}
        for item in body.sections:
            existing = existing_by_section.get(item.section_id)
            if existing is None:
                new_ratification = SectorReviewRatification(
                    review_run_id=row.id,
                    analyst_id=caller.id,
                    section_id=item.section_id,
                    decision=item.decision,
                    override_text=item.override_text,
                )
                db.add(new_ratification)
                existing_by_section[item.section_id] = new_ratification
            else:
                existing.decision = item.decision
                existing.override_text = item.override_text
        await db.flush()

        # The normalized rows are authoritative. Rebuilding the envelope after
        # each locked mutation prevents stale JSON snapshots from dropping a
        # disjoint decision.
        decisions = (await db.execute(select(SectorReviewRatification).where(
            SectorReviewRatification.review_run_id == row.id,
            SectorReviewRatification.analyst_id == caller.id,
        ))).scalars().all()
        review.ratifications = {item.section_id: item.decision for item in decisions}
        if any(decision == "rejected" for decision in review.ratifications.values()):
            review.authority.approval_state = "rejected"
        elif valid_sections and valid_sections == {
            section_id for section_id, decision in review.ratifications.items() if decision == "ratified"
        } and review.status == "ready":
            review.authority.approval_state = "ratified"
        else:
            review.authority.approval_state = "draft"
        row.payload = review.model_dump(mode="json")
        await db.commit()
        return review


@router.post("/reviews/{review_id}/publish", response_model=SectorReviewV2)
async def publish_sector_review(
    review_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _write_guard(caller)
    row = await _owned_review(db, review_id, caller.id)
    review = _review_v2(row)
    blockers: list[str] = []
    if review.status != "ready":
        blockers.append(f"analysis state is {review.status}")
    if review.authority.origin in {"reference", "demo", "seed"}:
        blockers.append("reference/demo evidence cannot be published")
    if review.authority.approval_state != "ratified":
        blockers.append("all sections require analyst ratification")
    if review.missing_dependencies:
        blockers.extend(review.missing_dependencies)
    if blockers:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Sector review is not publishable.",
            "blockers": list(dict.fromkeys(blockers)),
        })
    review.authority.approval_state = "published"
    review.downstream_readiness = {
        "ready": True,
        "consumers": ["Query", "RV Screener", "Command", "Monitor", "Report Studio"],
        "blocked_by": [],
    }
    row.payload = review.model_dump(mode="json")
    await db.flush()
    return review


__all__ = ["sector_signal_dedup_hash", "sector_materiality_score"]
