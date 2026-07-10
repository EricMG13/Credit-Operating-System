"""Issuer registry endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import (
    Document, Issuer, MetricFact, ModuleOutput, QAFinding, Run, get_db,
)
from engine.periods import is_finite_number
from identity import CallerIdentity, get_identity
from tenancy import new_issuer_team, require_issuer, scope_issuers, tenancy_enabled

router = APIRouter()

# Authenticated write cap — issuer creation parses no documents but still spawns a
# row, so bound it (duplicate-issuer spam / accidental double-submit). Reads stay
# on their own generous page caps.
_WRITE_MAX_PER_MINUTE = 30


class IssuerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    ticker: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    sub_sector: Optional[str] = None
    country: Optional[str] = None
    figi: Optional[str] = Field(default=None, max_length=32)
    rating_sp: Optional[str] = Field(default=None, max_length=16)
    rating_moody: Optional[str] = Field(default=None, max_length=16)
    rating_fitch: Optional[str] = Field(default=None, max_length=16)
    sponsor: Optional[str] = Field(default=None, max_length=255)


class IssuerResponse(BaseModel):
    id: str
    name: str
    ticker: Optional[str]
    industry: Optional[str]
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    country: Optional[str]
    figi: Optional[str]
    rating_sp: Optional[str] = None
    rating_moody: Optional[str] = None
    rating_fitch: Optional[str] = None
    sponsor: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj: Any, *args: Any, **kwargs: Any) -> "IssuerResponse":
        data = obj
        if isinstance(obj, Issuer):
            data = {
                "id": obj.id,
                "name": obj.name,
                "ticker": obj.ticker,
                "industry": obj.industry,
                "sector": obj.industry,
                "sub_sector": obj.sub_sector,
                "country": obj.country,
                "figi": obj.figi,
                "rating_sp": obj.rating_sp,
                "rating_moody": obj.rating_moody,
                "rating_fitch": obj.rating_fitch,
                "sponsor": obj.sponsor,
            }
        return super().model_validate(data, *args, **kwargs)


class IssuerDocumentResponse(BaseModel):
    id: str
    doc_type: str
    run_mode: Optional[str]
    file_name: str
    uploaded_at: datetime
    fiscal_period: Optional[str]

    model_config = {"from_attributes": True}


# Issuers and their documents are a *shared coverage universe* — every
# authenticated analyst sees every issuer (per the buy-side-desk model). The
# `caller` dependency below is therefore load-bearing for authentication (it
# enforces the 401 edge-auth gate in identity.py) but intentionally NOT used to
# scope queries: there is no per-user ownership boundary here by design. If
# need-to-know access control is ever required (e.g. an MNPI information
# barrier — see review W2), scope these queries by `caller` then.
# Slash-tolerant: prod serves FastAPI directly (frontend calls `/api/issuers/`),
# but `next dev` proxies and strips the trailing slash → `/api/issuers`, which the
# `/api/{path:path}` catch-all in main.py would 404 (it shadows redirect_slashes).
# Register both so the collection resolves with or without the slash. (See QA BUG-001.)
@router.get("", response_model=List[IssuerResponse], include_in_schema=False)
@router.get("/", response_model=List[IssuerResponse])
async def list_issuers(
    q: Optional[str] = Query(
        default=None,
        max_length=255,
        description="Case-insensitive substring match across name, ticker, sector, sub-sector, country, and FIGI.",
    ),
    # Bounded page: the coverage universe grows; an unbounded SELECT is a
    # memory/latency DoS as it does (same class as runs P4). Generous default
    # since the UI lists the whole desk's coverage.
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    stmt = select(Issuer).order_by(Issuer.name)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Issuer.name.ilike(like),
                Issuer.ticker.ilike(like),
                Issuer.industry.ilike(like),
                Issuer.sub_sector.ilike(like),
                Issuer.country.ilike(like),
                Issuer.figi.ilike(like),
            )
        )
    stmt = scope_issuers(stmt, caller).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=IssuerResponse, status_code=201, include_in_schema=False)
@router.post("/", response_model=IssuerResponse, status_code=201)
async def create_issuer(
    body: IssuerCreate,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(
        f"issuer-create:{caller.id}", max_attempts=_WRITE_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(429, "Issuer-create rate limit reached — try again in a minute.")
    data = body.model_dump()
    data["industry"] = data.pop("sector") or data.get("industry")
    name = (data.get("name") or "").strip()
    # Dedup on a case-insensitive name so a double-click or two analysts adding the
    # same issuer don't fork coverage into duplicate rows that then split
    # runs/metric_facts. There is no DB uniqueness on Issuer.name yet, so this
    # app-level check covers the realistic double-submit; a unique index on
    # lower(name) is the durable follow-up for true concurrency.
    existing = (await db.execute(
        scope_issuers(select(Issuer).where(func.lower(Issuer.name) == name.lower()), caller)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, "An issuer with that name already exists.")
    # Stamp the creator's team so tenancy scoping applies to this issuer and
    # everything derived from it (None when tenancy is off → shared/global).
    data["team_id"] = new_issuer_team(caller)
    issuer = Issuer(**data)
    db.add(issuer)
    await db.flush()
    await db.refresh(issuer)
    return issuer


@router.get("/{issuer_id}", response_model=IssuerResponse)
async def get_issuer(
    issuer_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    issuer = require_issuer(caller, await db.get(Issuer, issuer_id))
    return issuer


@router.get("/{issuer_id}/documents", response_model=List[IssuerDocumentResponse])
async def list_issuer_documents(
    issuer_id: str,
    # Bounded page: a heavily-documented issuer's doc list grows unbounded. P4.
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    # Gate on the issuer's team (documents inherit it); no-op behavior change when
    # tenancy is off (the guard only runs when enabled).
    if tenancy_enabled():
        require_issuer(caller, await db.get(Issuer, issuer_id))
    result = await db.execute(
        select(Document)
        .where(Document.issuer_id == issuer_id)
        .order_by(Document.uploaded_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


# ── Issuer profile (per-name roll-up) ────────────────────────────────────────
# The landing view when you click an issuer name/ticker: identity + current
# house view + headline metrics + what-changed + run history, one read. It is a
# *read-model* over data the engine already persists (runs, metric_facts, the
# latest complete run's module outputs) — no new computation, no synthesis. Every
# value carries its provenance/basis so the UI never passes seed/fixture numbers
# off as a real run (trust-through-transparency).


class RunBrief(BaseModel):
    id: str
    status: str
    qa_status: str
    committee_status: str
    as_of_date: Optional[str]
    analyst_id: Optional[str] = None
    model_mode: Optional[str] = None
    created_at: Optional[datetime]
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MetricFactOut(BaseModel):
    metric_key: str
    period: str
    value: float
    unit: str
    basis: Optional[str]
    provenance: str
    headline: bool
    qa_status: str
    source_claim_id: Optional[str]
    source_evidence_id: Optional[str]
    document_chunk_id: Optional[str]

    model_config = {"from_attributes": True}


class IssuerProfileResponse(BaseModel):
    issuer: IssuerResponse
    latest_run: Optional[RunBrief]
    runs: List[RunBrief]
    # Headline + historical periods for every metric_key, oldest→newest per key,
    # so the UI renders both the snapshot (headline rows) and the trend sparklines
    # (the full series) from one list.
    metrics: List[MetricFactOut]
    # Cherry-picked headline signals from the latest complete run's modules. A
    # free-form dict (like ModuleOutput.runtime_output) rather than a rigid schema:
    # these are a roll-up for glance-reading, not a stable contract — Deep-Dive
    # remains the source of truth for module detail. Missing → null.
    signals: Dict[str, Any]
    coverage: Dict[str, Any]
    findings: Dict[str, int]
    # CP-1A business/transaction facts (sourced snippets): description, operating
    # model, ownership, geography, history. Empty when no offering text ingested.
    business: List[Dict[str, Any]]
    # CP-2D sponsor / governance review (score + red-flag ledger). {} when absent.
    sponsor: Dict[str, Any]
    # Rule-based credit read derived from this run's signals (deterministic, no LLM).
    strengths: List[str]
    weaknesses: List[str]
    # CP-1B latest earnings summary: period labels, YoY deltas, deterioration
    # watch-list. {} when fewer than two comparable periods.
    earnings: Dict[str, Any]


def _profile_signals(mods: Dict[str, ModuleOutput]) -> Dict[str, Any]:
    """Headline signals from the latest complete run's module outputs.

    Every lookup is defensive (``.get``): a module that didn't run, or a key a
    given run didn't emit, yields ``None`` — a partial run degrades to blanks
    rather than erroring, and nothing is synthesized. Keys verified against the
    engine modules (relval/downside/refinancing/liquidity/covenants/earnings).
    """

    def ro(module_id: str) -> dict:
        m = mods.get(module_id)
        return (m.runtime_output or {}) if m is not None else {}

    relval, downside, refi = ro("CP-3"), ro("CP-2B"), ro("CP-3D")
    liquidity, cov = ro("CP-2E"), ro("CP-4C")
    earnings = ro("CP-1B").get("summary") or {}

    # CP-4C headroom lives inside calculations[] under a named calc, not top-level.
    headroom = next(
        (c for c in (cov.get("calculations") or [])
         if isinstance(c, dict) and "headroom" in str(c.get("name", "")).lower()),
        {},
    )

    return {
        "recommendation": relval.get("recommendation"),
        "composite_percentile": relval.get("composite_percentile"),
        "peer_scope": relval.get("peer_scope"),
        "fragility": downside.get("fragility"),
        "shock_to_breach_pct": downside.get("shock_to_breach_pct"),
        "breach_threshold_x": downside.get("breach_threshold_x"),
        "lme_band": refi.get("lme_vulnerability_band"),
        "lme_score": refi.get("lme_vulnerability_score"),
        "liquidity_musd": liquidity.get("disclosed_liquidity_musd"),
        "runway_months": liquidity.get("months_liquidity_covers_interest"),
        "covenant_structure": cov.get("covenant_structure"),
        "covenant_headroom_turns": headroom.get("value"),
        "covenant_cushion_pct": headroom.get("ebitda_cushion_pct"),
        "revenue_growth_pct": earnings.get("revenue_growth_pct"),
        "ebitda_growth_pct": earnings.get("ebitda_growth_pct"),
        "margin_change_pp": earnings.get("margin_change_pp"),
    }


def _strengths_weaknesses(  # noqa: C901
    signals: Dict[str, Any], headline: Dict[str, float]
) -> "tuple[List[str], List[str]]":
    """A rule-based credit read from this run's signals + headline ratios —
    deterministic, no LLM. Each item is a short statement backed by a real signal;
    empty lists when the run surfaced nothing decisive either way."""
    strengths: List[str] = []
    weaknesses: List[str] = []

    def num(x: Any) -> Optional[float]:
        return x if isinstance(x, (int, float)) and not isinstance(x, bool) else None

    pct = num(signals.get("composite_percentile"))
    if pct is not None:
        if pct >= 60:
            strengths.append(f"Screens cheap vs peers — {pct:g}th-percentile relative value")
        elif pct < 40:
            weaknesses.append(f"Screens rich / weak vs peers — {pct:g}th percentile")

    frag, stb = signals.get("fragility"), num(signals.get("shock_to_breach_pct"))
    tail = f" — breach at −{stb:g}% EBITDA" if stb is not None else ""
    if frag == "LOW":
        strengths.append(f"Resilient to downside{tail}")
    elif frag in ("HIGH", "MODERATE"):
        weaknesses.append(f"{str(frag).title()} downside fragility{tail}")

    lme = signals.get("lme_band")
    if lme == "LOW":
        strengths.append("Low refinancing / LME risk")
    elif lme in ("HIGH", "MEDIUM", "MODERATE"):
        weaknesses.append(f"{str(lme).title()} refinancing / LME risk")

    nl = num(headline.get("net_leverage"))
    if nl is not None:
        if nl < 4:
            strengths.append(f"Conservative leverage at {nl:g}×")
        elif nl >= 6:
            weaknesses.append(f"Elevated leverage at {nl:g}×")

    ic = num(headline.get("interest_coverage"))
    if ic is not None:
        if ic >= 3:
            strengths.append(f"Comfortable interest coverage at {ic:g}×")
        elif ic < 2:
            weaknesses.append(f"Thin interest coverage at {ic:g}×")

    hr = num(signals.get("covenant_headroom_turns"))
    if hr is not None:
        if hr >= 1.0:
            strengths.append(f"Ample covenant headroom — {hr:g}× to breach")
        elif hr < 0.5:
            weaknesses.append(f"Tight covenant headroom — {hr:g}× to breach")

    mc = num(signals.get("margin_change_pp"))
    if mc is not None:
        if mc >= 0.5:
            strengths.append(f"Margin expanding (+{mc:g}pp)")
        elif mc <= -0.5:
            weaknesses.append(f"Margin compressing ({mc:g}pp)")

    rw = num(signals.get("runway_months"))
    if rw is not None and rw < 12:
        weaknesses.append(f"Limited liquidity runway — {rw:g} months of interest")

    return strengths, weaknesses


@router.get("/{issuer_id}/profile", response_model=IssuerProfileResponse)
async def get_issuer_profile(
    issuer_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    issuer = require_issuer(caller, await db.get(Issuer, issuer_id))

    # Recent runs newest-first (bounded — runs accumulate forever, P4). The first
    # is the latest run of any status; the first complete one backs signals/QA.
    runs = list((await db.execute(
        select(Run).where(Run.issuer_id == issuer_id)
        .order_by(Run.created_at.desc()).limit(20)
    )).scalars().all())
    latest_run = runs[0] if runs else None
    latest_complete = next((r for r in runs if r.status == "complete"), None)

    # Headline facts are last-writer-wins per metric_key (runner supersedes prior
    # runs'), so the metric store already reflects the latest run — no run filter.
    facts = list((await db.execute(
        select(MetricFact).where(MetricFact.issuer_id == issuer_id)
        .order_by(MetricFact.metric_key, MetricFact.period).limit(500)
    )).scalars().all())

    doc_count = (await db.execute(
        select(func.count()).select_from(Document).where(Document.issuer_id == issuer_id)
    )).scalar() or 0

    signals: Dict[str, Any] = {}
    coverage: Dict[str, Any] = {"documents": doc_count}
    findings = {"CRITICAL": 0, "MATERIAL": 0, "MINOR": 0}
    business: List[Dict[str, Any]] = []
    sponsor: Dict[str, Any] = {}
    earnings: Dict[str, Any] = {}
    if latest_complete is not None:
        mod_rows = (await db.execute(
            select(ModuleOutput).where(ModuleOutput.run_id == latest_complete.id)
        )).scalars().all()
        mods = {m.module_id: m for m in mod_rows}
        signals = _profile_signals(mods)
        # CP-1A business/transaction fact register; CP-2D sponsor/governance review.
        business = ((mods["CP-1A"].runtime_output or {}).get("facts") or []) if "CP-1A" in mods else []
        sponsor = (mods["CP-2D"].runtime_output or {}) if "CP-2D" in mods else {}
        cp1b = (mods["CP-1B"].runtime_output or {}) if "CP-1B" in mods else {}
        summ = cp1b.get("summary") or {}
        earnings = {
            "latest_period": summ.get("latest_period"),
            "prior_period": summ.get("prior_period"),
            "revenue_growth_pct": summ.get("revenue_growth_pct"),
            "ebitda_growth_pct": summ.get("ebitda_growth_pct"),
            "margin_change_pp": summ.get("margin_change_pp"),
            "monitoring_signals": cp1b.get("monitoring_signals") or [],
        }
        cp0 = (mods["CP-0"].runtime_output or {}) if "CP-0" in mods else {}
        coverage.update({
            "readiness_score": cp0.get("readiness_score"),
            "categories_present": cp0.get("categories_present"),
            "categories_missing": cp0.get("categories_missing"),
            "edgar_available": cp0.get("edgar_available"),
        })
        for f in (await db.execute(
            select(QAFinding).where(QAFinding.run_id == latest_complete.id)
        )).scalars().all():
            findings[f.severity] = findings.get(f.severity, 0) + 1

    # Headline ratios (run-preferred) feed the rule-based strengths/weaknesses read.
    headline_vals: Dict[str, float] = {}
    for f in facts:
        if f.headline and (f.metric_key not in headline_vals or f.provenance == "run"):
            headline_vals[f.metric_key] = f.value
    strengths, weaknesses = _strengths_weaknesses(signals, headline_vals)

    return IssuerProfileResponse(
        issuer=IssuerResponse.model_validate(issuer),
        latest_run=RunBrief.model_validate(latest_run) if latest_run else None,
        runs=[RunBrief.model_validate(r) for r in runs],
        metrics=[MetricFactOut.model_validate(f) for f in facts],
        signals=signals,
        coverage=coverage,
        findings=findings,
        business=business,
        sponsor=sponsor,
        strengths=strengths,
        weaknesses=weaknesses,
        earnings=earnings,
    )


# ── Cross-default domino map ─────────────────────────────────────────────────
# Which tranches get pulled in when one facility defaults: a *read-model* over
# the latest complete run — CP-3B's tranche register + CP-4C's extracted
# cross-default (material-indebtedness) threshold. Deterministic set comparison,
# no LLM, nothing persisted. One doc-level threshold is applied to every tranche
# (the "Material Indebtedness" definition normally governs the whole agreement);
# per-facility thresholds would need per-tranche extraction first.


class CrossDefaultDomino(BaseModel):
    code: str
    tranche: str
    amount_musd: Optional[float] = None
    # True/False when computable; None when the tranche is unsized or no
    # threshold was extracted (honest "cannot say", never a guess).
    trips_cross_default: Optional[bool] = None
    pulls_in: List[str] = []


class CrossDefaultMapResponse(BaseModel):
    issuer_id: str
    run_id: Optional[str] = None
    threshold_musd: Optional[float] = None
    threshold_chunk_id: Optional[str] = None
    dominoes: List[CrossDefaultDomino] = []
    note: Optional[str] = None


def _domino_map(tranches: List[Dict[str, Any]], threshold: Any) -> List[CrossDefaultDomino]:
    """Domino rows from a CP-3B tranche register + a doc-level threshold ($M).

    A tranche whose principal meets the threshold trips the cross-default in
    every other tranche's document when it defaults. Inputs are unvalidated
    runtime_output, so every field is gated; a non-finite threshold or unsized
    tranche degrades that row to ``trips_cross_default=None``.
    """
    thr = float(threshold) if is_finite_number(threshold) else None
    rows: List[CrossDefaultDomino] = []
    clean = [t for t in tranches if isinstance(t, dict) and t.get("code")]
    for t in clean:
        amt = t.get("amount_musd")
        sized = is_finite_number(amt)
        trips: Optional[bool] = None
        if thr is not None and sized:
            trips = float(amt) >= thr
        rows.append(CrossDefaultDomino(
            code=str(t["code"]),
            tranche=str(t.get("tranche") or t["code"]),
            amount_musd=float(amt) if sized else None,
            trips_cross_default=trips,
            pulls_in=[str(o["code"]) for o in clean if o is not t] if trips else [],
        ))
    return rows


@router.get("/{issuer_id}/cross-default", response_model=CrossDefaultMapResponse)
async def get_cross_default_map(
    issuer_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    require_issuer(caller, await db.get(Issuer, issuer_id))

    run = (await db.execute(
        select(Run).where(Run.issuer_id == issuer_id, Run.status == "complete")
        .order_by(Run.created_at.desc()).limit(1)
    )).scalars().first()
    if run is None:
        return CrossDefaultMapResponse(
            issuer_id=issuer_id, note="No completed run — run the pipeline first.")

    mods = (await db.execute(
        select(ModuleOutput).where(
            ModuleOutput.run_id == run.id, ModuleOutput.module_id.in_(("CP-3B", "CP-4C")))
    )).scalars().all()
    by_id = {m.module_id: (m.runtime_output or {}) for m in mods}
    tranches = by_id.get("CP-3B", {}).get("tranches") or []
    threshold = by_id.get("CP-4C", {}).get("cross_default_musd")

    thr = float(threshold) if is_finite_number(threshold) else None
    notes = []
    if not tranches:
        notes.append("No debt tranches identified in the latest run (CP-3B).")
    if thr is None:
        notes.append("No cross-default / material-indebtedness threshold extracted (CP-4C).")

    return CrossDefaultMapResponse(
        issuer_id=issuer_id,
        run_id=run.id,
        threshold_musd=thr,
        dominoes=_domino_map(tranches, thr),
        note=" ".join(notes) or None,
    )
