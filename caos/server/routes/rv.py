"""Versioned RV screening over immutable normalized market snapshots."""

from __future__ import annotations

import hashlib
import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from analysis_contracts import ArtifactRef, AuthorityEnvelope, RVCandidateOut, RVScreenRun as RVScreenRunOut
from config import get_settings
from context_lineage import bind_context_artifacts
from database import (
    AnalysisContextRecord,
    MarketInstrument,
    MarketSnapshot,
    Portfolio,
    PortfolioPosition,
    RVCandidate,
    RVScreenRun,
    get_db,
)
from identity import CallerIdentity, get_identity, get_write_identity, require_write_role
from freshness import evaluate_freshness
from sector_taxonomy import canonical_sector_id
from tenancy import require_portfolio_access, tenancy_enabled

router = APIRouter()

_REFERENCE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "src"
    / "lib"
    / "command"
    / "market-data.json"
)
_REFERENCE_AS_OF = datetime(2026, 7, 6, tzinfo=timezone.utc)
_READ_MAX_PER_MINUTE = 90
_WRITE_MAX_PER_MINUTE = 30


def _guard(caller: CallerIdentity, *, write: bool) -> None:
    if write:
        require_write_role(caller)
    maximum = _WRITE_MAX_PER_MINUTE if write else _READ_MAX_PER_MINUTE
    lane = "rv-write" if write else "rv-read"
    if not rate_limit.hit(f"{lane}:{caller.id}", max_attempts=maximum, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "RV rate limit reached.")


def _rating_bucket(value: str | None) -> str:
    if not value:
        return "NR"
    normalized = value.upper()
    for bucket in ("BA1", "BA2", "BA3", "B1", "B2", "B3", "CAA1", "CAA2", "CAA3"):
        if bucket in normalized:
            return bucket.title().replace("Caa", "Caa")
    # Modifier tokens BEFORE their base: "BB-" contains "BB", so a base-first
    # scan bucketed BB-→Ba2 and CCC-→Caa2 — one notch senior, pooling the
    # weakest modifier ratings with a tighter-spread cohort and overstating
    # their DM pickup (triage 2026-07-16 P2).
    sp = {
        "BB+": "Ba1", "BB-": "Ba3", "BB": "Ba2", "B+": "B1",
        "B-": "B3", "CCC+": "Caa1", "CCC-": "Caa3", "CCC": "Caa2",
    }
    for token, bucket in sp.items():
        if token in normalized:
            return bucket
    return "B2" if "B" in normalized else "NR"


def _number(value: object) -> Optional[float]:
    # Finite, not merely numeric: a NaN passes isinstance and would scramble the
    # pickup sort and leak NaN JSON. Both current snapshot producers already
    # filter non-finite values, so this is the house-convention backstop
    # (engine.periods.is_finite_number semantics; triage 2026-07-16 P3).
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def classify_candidate(*, market_current: bool, has_exact_identity: bool, missing_gates: list[str]) -> str:
    """Decision-safety gate: freshness/identity failures are unavailable;
    every other unresolved dependency is screen-only, never actionable."""
    if not market_current or not has_exact_identity:
        return "unavailable"
    return "screen-only" if missing_gates else "actionable"


async def _ensure_reference_snapshot(db: AsyncSession) -> MarketSnapshot:
    try:
        raw = _REFERENCE_PATH.read_bytes()
        rows = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Reference market snapshot is unavailable.") from exc
    payload_hash = hashlib.sha256(raw).hexdigest()
    existing = (await db.execute(
        select(MarketSnapshot).where(
            MarketSnapshot.payload_hash == payload_hash,
            MarketSnapshot.analyst_id.is_(None),
            MarketSnapshot.origin == "reference",
        )
    )).scalar_one_or_none()
    if existing is not None:
        return existing
    now = datetime.now(timezone.utc)
    snapshot = MarketSnapshot(
        analyst_id=None,
        as_of=_REFERENCE_AS_OF,
        source_label="CAOS pricing-sheet reference snapshot",
        origin="reference",
        method="reported",
        status="ready",
        payload_hash=payload_hash,
        document_id=None,
        source_manifest_id=None,
        import_mapping={},
        metadata_json={
            "file": "market-data.json",
            "row_count": len(rows),
            "immutable": True,
        },
        created_at=now,
    )
    db.add(snapshot)
    await db.flush()
    for index, raw_row in enumerate(rows):
        borrower = str(raw_row.get("company") or "").strip()
        if not borrower:
            continue
        figi = str(raw_row.get("bloombergId") or "").strip() or None
        instrument_key = f"{figi or borrower}:{index}"
        db.add(MarketInstrument(
            snapshot_id=snapshot.id,
            instrument_key=instrument_key,
            figi=figi,
            borrower=borrower,
            sector_id=canonical_sector_id(str(raw_row.get("sector") or "")),
            payload=raw_row,
            created_at=now,
        ))
    await db.flush()
    return snapshot


def _require_snapshot_access(
    snapshot: MarketSnapshot | None, caller: CallerIdentity
) -> MarketSnapshot:
    if snapshot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Market snapshot not found.")
    if snapshot.analyst_id == caller.id:
        return snapshot
    # NULL ownership is the additive-migration compatibility state for market
    # snapshots created before XLSX v2.  New imports always have an owner.
    if snapshot.analyst_id is None:
        return snapshot
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Market snapshot not found.")


async def _owned_context(
    db: AsyncSession, context_id: str, analyst_id: str
) -> AnalysisContextRecord:
    row = (await db.execute(select(AnalysisContextRecord).where(
        AnalysisContextRecord.id == context_id,
        AnalysisContextRecord.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    return row


async def _owned_run(db: AsyncSession, run_id: str, analyst_id: str) -> RVScreenRun:
    row = (await db.execute(select(RVScreenRun).where(
        RVScreenRun.id == run_id,
        RVScreenRun.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RV screen not found.")
    return row


async def _portfolio_positions(
    db: AsyncSession, portfolio_scope: Optional[str], caller: CallerIdentity
) -> dict[str, list[PortfolioPosition]]:
    if not portfolio_scope:
        return {}
    portfolio = await db.get(Portfolio, portfolio_scope)
    try:
        portfolio = require_portfolio_access(caller, portfolio)
    except HTTPException:
        return {}
    if (
        not tenancy_enabled()
        and portfolio.created_by not in {None, caller.id}
    ):
        return {}
    positions = (await db.execute(select(PortfolioPosition).where(
        PortfolioPosition.portfolio_id == portfolio.id,
    ))).scalars().all()
    by_figi: dict[str, list[PortfolioPosition]] = {}
    for position in positions:
        if position.figi:
            by_figi.setdefault(position.figi.strip().upper(), []).append(position)
    return by_figi


def _cohort_key(instrument: MarketInstrument) -> tuple[str, str]:
    payload = instrument.payload or {}
    return (
        str(payload.get("sector") or "Unknown"),
        _rating_bucket(str(payload.get("ratings") or "")),
    )


def _candidate_out(
    candidate: RVCandidate, instrument: MarketInstrument
) -> RVCandidateOut:
    payload = instrument.payload or {}
    market = {
        "sector": payload.get("sector"),
        "sub_sector": payload.get("subSector"),
        "ranking": payload.get("ranking"),
        "rating": payload.get("ratings"),
        "maturity": payload.get("maturity"),
        "bid": payload.get("bid"),
        "ask": payload.get("ask"),
        "price": payload.get("price"),
        "currency": payload.get("currency"),
        "ytw": payload.get("midYtm"),
        "dm": payload.get("mid3yDm"),
    }
    return RVCandidateOut(
        id=candidate.id,
        instrument_id=instrument.id,
        instrument_key=instrument.instrument_key,
        figi=instrument.figi,
        borrower=instrument.borrower,
        rank=candidate.rank,
        classification=candidate.classification,
        recommendation=(candidate.pitch or {}).get("recommendation", "Screen only"),
        missing_gates=candidate.missing_gates or [],
        market=market,
        pitch=candidate.pitch or {},
        evidence=candidate.evidence or {},
        portfolio_impact=candidate.portfolio_impact or {},
        ratified_at=candidate.ratified_at,
    )


async def _run_out(db: AsyncSession, row: RVScreenRun) -> RVScreenRunOut:
    joined = (await db.execute(
        select(RVCandidate, MarketInstrument)
        .join(MarketInstrument, MarketInstrument.id == RVCandidate.instrument_id)
        .where(RVCandidate.run_id == row.id)
        .order_by(RVCandidate.rank)
    )).all()
    candidates = [_candidate_out(candidate, instrument) for candidate, instrument in joined]
    counts = {
        classification: sum(item.classification == classification for item in candidates)
        for classification in ("actionable", "screen-only", "unavailable")
    }
    result = row.result or {}
    snapshot = await db.get(MarketSnapshot, row.snapshot_id)
    return RVScreenRunOut(
        id=row.id,
        context_id=row.context_id,
        snapshot_id=row.snapshot_id,
        status=row.status,
        snapshot_source_label=snapshot.source_label if snapshot else None,
        snapshot_freshness=(snapshot.metadata_json or {}).get("freshness_evaluation") if snapshot else None,
        filters=row.filters or {},
        authority=AuthorityEnvelope.model_validate(row.authority),
        candidates=candidates,
        counts=counts,
        missing_dependencies=result.get("missing_dependencies", []),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class RVScreenCreate(BaseModel):
    context_id: str = Field(min_length=1, max_length=36)
    snapshot_id: Optional[str] = Field(default=None, max_length=36)
    filters: dict = Field(default_factory=dict)


class RVRatificationRequest(BaseModel):
    candidate_id: str = Field(min_length=1, max_length=36)
    analyst_override: Optional[str] = Field(default=None, max_length=4000)


@router.get("/snapshots")
async def list_market_snapshots(
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    await _ensure_reference_snapshot(db)
    rows = (await db.execute(
        select(MarketSnapshot).where(or_(
            MarketSnapshot.analyst_id == caller.id,
            MarketSnapshot.analyst_id.is_(None),
        )).order_by(MarketSnapshot.as_of.desc()).limit(100)
    )).scalars().all()
    return {"snapshots": [{
        "id": row.id,
        "as_of": row.as_of,
        "source_label": row.source_label,
        "origin": row.origin,
        "method": row.method,
        "status": row.status,
        "document_id": row.document_id,
        "source_manifest_id": row.source_manifest_id,
        "freshness": (row.metadata_json or {}).get("freshness_evaluation"),
        "metadata": row.metadata_json or {},
    } for row in rows]}


@router.post("/screens", response_model=RVScreenRunOut, status_code=status.HTTP_201_CREATED)
async def create_rv_screen(
    body: RVScreenCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _guard(caller, write=True)
    context = await _owned_context(db, body.context_id, caller.id)
    if body.snapshot_id:
        snapshot = _require_snapshot_access(
            await db.get(MarketSnapshot, body.snapshot_id), caller
        )
    else:
        snapshot = None
        if get_settings().caos_market_xlsx_v2_enabled:
            snapshot = (await db.execute(select(MarketSnapshot).where(
                MarketSnapshot.analyst_id == caller.id,
                MarketSnapshot.status == "ready",
            ).order_by(MarketSnapshot.as_of.desc(), MarketSnapshot.created_at.desc()).limit(1))).scalar_one_or_none()
        snapshot = snapshot or await _ensure_reference_snapshot(db)
    now = datetime.now(timezone.utc)
    if get_settings().caos_market_xlsx_v2_enabled:
        freshness = evaluate_freshness(
            source_kind="price", now=now, observed_at=snapshot.as_of
        )
        market_current = snapshot.status == "ready" and freshness.state == "current"
    else:
        age_days = max(0, (now - (snapshot.as_of if snapshot.as_of.tzinfo else snapshot.as_of.replace(tzinfo=timezone.utc))).days)
        market_current = snapshot.status == "ready" and age_days <= 90
        freshness = None
    authority = AuthorityEnvelope(
        origin=snapshot.origin,
        method="CP-6E gated-screen-v2",
        freshness="current" if market_current else "stale",
        as_of=snapshot.as_of,
        source_ids=[value for value in (
            snapshot.id, snapshot.document_id, snapshot.source_manifest_id
        ) if value],
        approval_state="draft",
    )
    row = RVScreenRun(
        analyst_id=caller.id,
        context_id=context.id,
        snapshot_id=snapshot.id,
        status="running",
        filters=body.filters,
        result={},
        authority={
            **authority.model_dump(mode="json"),
            **({"freshness_evaluation": freshness.model_dump(mode="json")} if freshness else {}),
        },
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    authority.run_id = row.id

    instruments_stmt = select(MarketInstrument).where(MarketInstrument.snapshot_id == snapshot.id)
    sector_filter = body.filters.get("sector_id") or context.sector_id
    if sector_filter:
        canonical = canonical_sector_id(str(sector_filter)) or str(sector_filter)
        instruments_stmt = instruments_stmt.where(MarketInstrument.sector_id == canonical)
    instruments = (await db.execute(instruments_stmt.limit(5000))).scalars().all()
    cohorts: dict[tuple[str, str], list[float]] = {}
    for instrument in instruments:
        dm = _number((instrument.payload or {}).get("mid3yDm"))
        if dm is not None and 0 < dm < 5000:
            cohorts.setdefault(_cohort_key(instrument), []).append(dm)
    holdings = await _portfolio_positions(db, context.portfolio_scope, caller)

    ranked: list[tuple[float, MarketInstrument, dict, list[str], dict]] = []
    for instrument in instruments:
        payload = instrument.payload or {}
        dm = _number(payload.get("mid3yDm"))
        cohort = cohorts.get(_cohort_key(instrument), [])
        cohort_valid = dm is not None and len(cohort) >= 4
        median_dm = statistics.median(cohort) if cohort_valid else None
        pickup = dm - median_dm if dm is not None and median_dm is not None else None
        exact_positions = holdings.get((instrument.figi or "").upper(), [])
        par = sum(position.par_usd for position in exact_positions)
        ytw = _number(payload.get("midYtm"))
        portfolio_impact = {
            "held": bool(exact_positions),
            "exact_match": bool(exact_positions),
            "par_usd": par if exact_positions else None,
            "yield_contribution_usd": (par * ytw / 100) if exact_positions and ytw is not None else None,
            "risk_budget_consumption": None,
        }
        missing: list[str] = []
        if not market_current:
            missing.append("current market snapshot")
        if snapshot.origin != "live":
            missing.append("live market origin")
        if not instrument.figi:
            missing.append("exact instrument identity")
        if not cohort_valid:
            missing.append("valid comparable cohort")
        if not payload.get("downsideEvidence"):
            missing.append("downside evidence")
        if not payload.get("recoveryEvidence"):
            missing.append("recovery evidence")
        if not exact_positions:
            missing.append("exact portfolio mapping")
        missing.append("risk-budget consumption")
        classification = classify_candidate(
            market_current=market_current,
            has_exact_identity=bool(instrument.figi),
            missing_gates=missing,
        )
        pitch = {
            "recommendation": "Review candidate" if classification == "actionable" else "Screen only",
            "market_relative_value": {
                "dm_pickup_bps": round(pickup, 1) if pickup is not None else None,
                "cohort_median_dm_bps": round(median_dm, 1) if median_dm is not None else None,
                "cohort_size": len(cohort),
                "status": "available" if cohort_valid else "unavailable",
            },
            "instrument_mispricing": {
                "status": "unavailable",
                "seniority": payload.get("ranking"),
                "maturity": payload.get("maturity"),
                "liquidity_proxy": {
                    "bid": payload.get("bid"), "ask": payload.get("ask")
                },
                "recovery": None,
            },
            "portfolio_implementation": portfolio_impact,
        }
        evidence = {
            "snapshot_id": snapshot.id,
            "source_document_id": snapshot.document_id,
            "source_manifest_id": snapshot.source_manifest_id,
            "instrument_key": instrument.instrument_key,
            "figi": instrument.figi,
            "cohort_definition": {"sector": _cohort_key(instrument)[0], "rating": _cohort_key(instrument)[1]},
        }
        score = pickup if pickup is not None else float("-inf")
        ranked.append((score, instrument, pitch, list(dict.fromkeys(missing)), {"portfolio": portfolio_impact, "evidence": evidence, "classification": classification}))

    ranked.sort(key=lambda item: item[0], reverse=True)
    for rank, (_, instrument, pitch, missing, extra) in enumerate(ranked, start=1):
        db.add(RVCandidate(
            run_id=row.id,
            instrument_id=instrument.id,
            rank=rank,
            classification=extra["classification"],
            missing_gates=missing,
            pitch=pitch,
            evidence=extra["evidence"],
            portfolio_impact=extra["portfolio"],
            created_at=now,
        ))
    row.status = "ready" if instruments else "observed-empty"
    row.result = {
        "missing_dependencies": [] if instruments else ["normalized market instruments"],
        "candidate_count": len(instruments),
    }
    row.authority = {
        **authority.model_dump(mode="json"),
        **({"freshness_evaluation": freshness.model_dump(mode="json")} if freshness else {}),
    }
    row.updated_at = datetime.now(timezone.utc)
    context.rv_snapshot_id = snapshot.id
    context.rv_run_id = row.id
    context.updated_at = row.updated_at
    await db.flush()
    # Runs inherit their immutable market input through typed context refs.
    # Keep the legacy scalar above for compatibility, but make the canonical
    # parent explicit so create_run can produce run -> market_snapshot lineage.
    await bind_context_artifacts(
        db,
        context_id=context.id,
        analyst_id=caller.id,
        refs=[ArtifactRef(kind="market_snapshot", id=snapshot.id)],
    )
    return await _run_out(db, row)


@router.get("/screens/{run_id}", response_model=RVScreenRunOut)
async def get_rv_screen(
    run_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    return await _run_out(db, await _owned_run(db, run_id, caller.id))


@router.post("/screens/{run_id}/ratifications", response_model=RVScreenRunOut)
async def ratify_rv_candidate(
    run_id: str,
    body: RVRatificationRequest,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _guard(caller, write=True)
    row = await _owned_run(db, run_id, caller.id)
    candidate = (await db.execute(select(RVCandidate).where(
        RVCandidate.id == body.candidate_id,
        RVCandidate.run_id == row.id,
    ))).scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RV candidate not found.")
    if candidate.classification != "actionable":
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Only fully gated actionable candidates can be ratified.",
            "missing_gates": candidate.missing_gates or [],
        })
    candidate.analyst_override = {"text": body.analyst_override} if body.analyst_override else None
    candidate.ratified_at = datetime.now(timezone.utc)
    await db.flush()
    return await _run_out(db, row)
