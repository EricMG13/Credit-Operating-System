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
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from config import get_settings
from database import AnalysisContextRecord, Document, DocumentChunk, Issuer, Run, aware_utc, get_db
from freshness import POLICY_VERSION, FreshnessEvaluation, evaluate_freshness, worst_freshness
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
    # Optional so feature-off responses retain the legacy shape.
    freshness: Optional["DigestFreshnessSummary"] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class DigestFreshnessRow(BaseModel):
    issuer_id: str
    name: str
    run_id: Optional[str] = None
    evaluation: FreshnessEvaluation


class DigestFreshnessSummary(BaseModel):
    policy_version: str = POLICY_VERSION
    source_kind: Literal["run"] = "run"
    counts: Dict[Literal["current", "due", "stale", "unknown"], int]
    rows: List[DigestFreshnessRow] = []


# Coverage Control Plane (WP-4 G14) — the ingestion-side counterpart to the
# stale/CCC watch lists above: a vaulted document that quietly produced no
# usable chunks (a scanned/encrypted PDF the OCR lane also couldn't read), or
# one that only ever produced lower-fidelity OCR-derived chunks. Both degrade
# silently today (ingest.py logs a warning and moves on) — this surfaces them
# as a real, honest, live signal instead of a document that just vanishes
# into "vaulted, contributes nothing" with no visibility anywhere.
_DOC_SCAN_CAP = 2000


class IngestionGapRow(BaseModel):
    document_id: str
    issuer_id: str
    issuer_name: str
    file_name: str
    doc_type: str
    uploaded_at: datetime
    detail: str


class CoverageOriginRow(BaseModel):
    issuer_id: str
    issuer_name: str
    analyst_owner: Optional[str] = None
    origins: List[str] = []
    document_count: int


class IngestionGapsResponse(BaseModel):
    as_of: datetime
    truncated: bool = False
    # Vaulted but zero chunks extracted — every downstream module treats this
    # document as if it doesn't exist; nothing else surfaces that fact today.
    zero_chunk: List[IngestionGapRow] = []
    # At least one chunk came off the OCR lane (lower-fidelity than a native
    # text layer) — discountable, not a hard failure, but worth disclosing.
    ocr_lane: List[IngestionGapRow] = []
    # Per-issuer source-origin mix plus the analyst on the latest complete run.
    # Raw source labels stay deliberately small: NATIVE / OCR / NO_TEXT.
    coverage: List[CoverageOriginRow] = []


def _read_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"digest-read:{caller.id}", max_attempts=_READ_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Digest read rate limit reached — try again in a minute.",
        )


async def _proved_context_run_freshness(
    db: AsyncSession,
    caller: CallerIdentity,
    run_ids: set[str],
) -> dict[str, FreshnessEvaluation]:
    """Resolve only lineage-proved run states from the analyst's recent contexts.

    The bounded scan avoids turning the digest into an unbounded context replay.
    A run with no matching authorized context remains UNKNOWN.
    """
    if not run_ids:
        return {}
    from routes.analysis import get_context_freshness

    contexts = (await db.execute(
        select(AnalysisContextRecord)
        .where(AnalysisContextRecord.analyst_id == caller.id)
        .order_by(AnalysisContextRecord.updated_at.desc())
        .limit(50)
    )).scalars().all()
    collected: dict[str, list[FreshnessEvaluation]] = {}
    for context in contexts:
        artifacts = context.artifacts or {}
        active_run_id = artifacts.get("issuer_run_id")
        if active_run_id not in run_ids:
            continue
        try:
            context_result = await get_context_freshness(context.id, db, caller)
        except HTTPException:
            continue
        for item in context_result.artifacts:
            if item.artifact.kind == "issuer_run" and item.artifact.id == active_run_id:
                collected.setdefault(item.artifact.id, []).append(item.evaluation)
    return {
        run_id: worst_freshness(evaluations, source_kind="run")
        for run_id, evaluations in collected.items()
    }


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
    freshness_summary: Optional[DigestFreshnessSummary] = None
    if get_settings().caos_lineage_v2_enabled:
        proved = await _proved_context_run_freshness(
            db, caller, {run.id for run in latest.values()}
        )
        freshness_rows: List[DigestFreshnessRow] = []
        freshness_counts = {"current": 0, "due": 0, "stale": 0, "unknown": 0}
        for issuer in issuers:
            run = latest.get(issuer.id)
            evaluation = proved.get(run.id) if run else None
            if evaluation is None:
                evaluation = evaluate_freshness(
                    source_kind="run",
                    now=now,
                    observed_at=(run.completed_at or run.created_at) if run else None,
                    source_version_state="unknown",
                )
            freshness_counts[evaluation.state] += 1
            freshness_rows.append(DigestFreshnessRow(
                issuer_id=issuer.id,
                name=issuer.name,
                run_id=run.id if run else None,
                evaluation=evaluation,
            ))
        freshness_summary = DigestFreshnessSummary(
            counts=freshness_counts,
            rows=freshness_rows[:_MAX_LIST],
        )
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
        freshness=freshness_summary,
    )


@router.get("/ingestion-gaps", response_model=IngestionGapsResponse)
async def ingestion_gaps(
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _read_rate_guard(caller)
    now = datetime.now(timezone.utc)

    has_ocr = exists(
        select(DocumentChunk.id).where(
            DocumentChunk.document_id == Document.id,
            DocumentChunk.prov == "ocr",
        )
    ).correlate(Document)
    docs_q = select(Document, Issuer.name, has_ocr).join(Issuer, Document.issuer_id == Issuer.id)
    if tenancy_enabled():
        docs_q = docs_q.where(Document.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
    docs_q = docs_q.order_by(Document.uploaded_at.desc()).limit(_DOC_SCAN_CAP)
    rows = (await db.execute(docs_q)).all()

    zero_chunk: List[IngestionGapRow] = []
    ocr_lane: List[IngestionGapRow] = []
    origin_rollup: Dict[str, Dict[str, object]] = {}
    for doc, issuer_name, document_has_ocr in rows:
        rollup = origin_rollup.setdefault(doc.issuer_id, {
            "issuer_name": issuer_name,
            "origins": set(),
            "document_count": 0,
        })
        rollup["document_count"] = int(rollup["document_count"]) + 1
        if doc.chunk_count == 0:
            rollup["origins"].add("NO_TEXT")
            zero_chunk.append(IngestionGapRow(
                document_id=doc.id, issuer_id=doc.issuer_id, issuer_name=issuer_name,
                file_name=doc.file_name, doc_type=doc.doc_type,
                uploaded_at=aware_utc(doc.uploaded_at) or now,
                detail="No text extracted — vaulted but unusable by any module (scanned/encrypted source; OCR unavailable or also failed).",
            ))
        elif document_has_ocr:
            rollup["origins"].add("OCR")
            ocr_lane.append(IngestionGapRow(
                document_id=doc.id, issuer_id=doc.issuer_id, issuer_name=issuer_name,
                file_name=doc.file_name, doc_type=doc.doc_type,
                uploaded_at=aware_utc(doc.uploaded_at) or now,
                detail="Extracted via OCR (scanned/image source) — lower-fidelity than a native text layer; discount accordingly.",
            ))
        else:
            rollup["origins"].add("NATIVE")
    zero_chunk = zero_chunk[:_MAX_LIST]
    ocr_lane = ocr_lane[:_MAX_LIST]

    latest_owner: Dict[str, Optional[str]] = {}
    owner_q = select(Run).where(Run.status == "complete")
    if tenancy_enabled():
        owner_q = owner_q.where(Run.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
    for run in (await db.execute(
        owner_q.order_by(Run.created_at.desc()).limit(5000)
    )).scalars().all():
        latest_owner.setdefault(run.issuer_id, run.analyst_id)

    coverage = [
        CoverageOriginRow(
            issuer_id=issuer_id,
            issuer_name=str(values["issuer_name"]),
            analyst_owner=latest_owner.get(issuer_id),
            origins=sorted(values["origins"]),
            document_count=int(values["document_count"]),
        )
        for issuer_id, values in origin_rollup.items()
    ][:_MAX_LIST]

    return IngestionGapsResponse(
        as_of=now, truncated=len(rows) >= _DOC_SCAN_CAP,
        zero_chunk=zero_chunk, ocr_lane=ocr_lane, coverage=coverage,
    )
