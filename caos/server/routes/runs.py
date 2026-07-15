"""Run lifecycle endpoints — create a run, inspect its modules and QA gate.

A run is queued on create and executed by the async run executor (run_executor.py);
clients poll GET /runs/{id} to completion. These endpoints create and inspect runs.

Authorization — single-team model, by design (SECURITY.md §2, S-4). Every
authenticated analyst can read and write every run; the read/inspect/export
handlers below take ``caller`` (for rate-limiting and run attribution) but
deliberately DO NOT filter by ``caller.id``. This is a deliberate fit for one
coverage team sharing one workspace, not an oversight. If the trust model ever
widens to multiple teams/tenants (e.g. ``CAOS_EMAIL_DOMAIN`` admitting more than
one team), per-caller authorization MUST be added here — gate each ``run_id`` on
whether ``caller`` may access that run's issuer (and add tenant scoping to
``list_runs``). Until that requirement is real it is left unbuilt rather than
guessed; ``test_runs_idor`` pins the current cross-analyst-read behaviour so a
change to it is a conscious decision.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
import vault_export
from analysis_contracts import ArtifactRef
from config import get_settings
from context_lineage import bind_context_artifacts, typed_refs_from_artifacts
from freshness import FreshnessEvaluation, evaluate_freshness, worst_freshness
from engine import presets
from database import (
    AnalysisContextRecord, Claim, EvidenceItem, Issuer, ModuleOutput, Portfolio,
    PortfolioPosition, QAFinding, Run, get_db,
)
from engine.report import assemble_report, committee_export_allowed
from identity import CallerIdentity, get_identity
from lineage_service import write_lineage_edge
from tenancy import (
    require_issuer,
    require_portfolio_access,
    require_run_access,
    scope_issuers,
    scope_portfolios,
    tenancy_enabled,
)

logger = logging.getLogger("caos")
router = APIRouter()

# Serializes the dedup check→insert in create_run so two simultaneous POSTs for
# the same issuer can't both pass the "is one already active?" SELECT before
# either commits. One process, one event loop → one lock suffices.
# ponytail: global lock, fine for one process. If ever scaled to multiple app
# replicas, move the guard to a partial unique index on (issuer_id) WHERE
# status='queued' (a per-replica lock won't coordinate across processes).
# Lazy-init: on py3.9 asyncio.Lock() binds the loop at construction, which fails
# at import time (no running loop). First create_run call builds it in the app loop.
_CREATE_RUN_LOCK: "asyncio.Lock | None" = None


def _create_run_lock() -> asyncio.Lock:
    global _CREATE_RUN_LOCK
    if _CREATE_RUN_LOCK is None:
        _CREATE_RUN_LOCK = asyncio.Lock()
    return _CREATE_RUN_LOCK


# Idempotency (#17): the active-run 409 above only dedupes WHILE a run is
# active — a client retrying create_run after the network dropped the response
# but the request already committed (or after a genuinely fast run already
# reached a terminal state) sees no active run and creates a real duplicate.
# An optional client-supplied Idempotency-Key dedupes those retries for a short
# window. In-process dict, mutations only ever happen inside _create_run_lock()
# (single event loop → no extra lock needed); bounded like rate_limit.py's
# _windows so a client spraying random keys can't grow this unboundedly.
# ponytail: per-process, matches _CREATE_RUN_LOCK's own multi-replica caveat.
_IDEMPOTENCY_TTL_SECONDS = 600
_IDEMPOTENCY_MAX_ENTRIES = 4096
_idempotency_cache: "dict[tuple[str, str], tuple[str, float]]" = {}


def _idempotency_lookup(caller_id: str, key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    entry = _idempotency_cache.get((caller_id, key))
    if entry is None:
        return None
    run_id, inserted_at = entry
    if time.monotonic() - inserted_at >= _IDEMPOTENCY_TTL_SECONDS:
        del _idempotency_cache[(caller_id, key)]
        return None
    return run_id


def _idempotency_store(caller_id: str, key: Optional[str], run_id: str) -> None:
    if not key:
        return
    now = time.monotonic()
    if len(_idempotency_cache) >= _IDEMPOTENCY_MAX_ENTRIES:
        expired = [k for k, (_, t) in _idempotency_cache.items() if now - t >= _IDEMPOTENCY_TTL_SECONDS]
        for k in expired:
            del _idempotency_cache[k]
        if len(_idempotency_cache) >= _IDEMPOTENCY_MAX_ENTRIES:  # still full: evict oldest
            oldest = min(_idempotency_cache, key=lambda k: _idempotency_cache[k][1])
            del _idempotency_cache[oldest]
    _idempotency_cache[(caller_id, key)] = (run_id, now)


_RUNS_MAX_PER_MINUTE = 12


async def _auto_portfolio(
    db: AsyncSession, issuer_id: str, caller: Optional[CallerIdentity] = None
) -> Optional[str]:
    """The single portfolio holding this issuer, if exactly one does — so a run
    auto-binds its book for CP-3C. None when unheld or held in several (ambiguous
    → don't guess; the caller can pass an explicit portfolio_id)."""
    if caller is None and tenancy_enabled():
        return None
    stmt = (
        select(PortfolioPosition.portfolio_id)
        .join(Portfolio, Portfolio.id == PortfolioPosition.portfolio_id)
        .where(PortfolioPosition.issuer_id == issuer_id)
        .distinct()
    )
    pids = (await db.execute(
        scope_portfolios(stmt, caller) if caller is not None else stmt
    )).scalars().all()
    return pids[0] if len(pids) == 1 else None


# ── Request / response models ───────────────────────────────────────────────
class RunCreate(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    as_of_date: Optional[str] = Field(default=None, max_length=32)
    # Portfolio to evaluate the issuer against (CP-3C concentration goes live).
    # Omit to auto-bind the portfolio that holds this issuer, if exactly one does.
    portfolio_id: Optional[str] = Field(default=None, max_length=36)
    context_id: Optional[str] = Field(default=None, max_length=36)


class ModuleStatus(BaseModel):
    module_id: str
    module_name: str
    qa_status: str
    committee_status: str
    confidence: str
    validation_status: str

    model_config = {"from_attributes": True}


class RunSummary(BaseModel):
    id: str
    issuer_id: str
    status: str
    qa_status: str
    committee_status: str
    as_of_date: Optional[str]
    analyst_id: Optional[str] = None
    model_id: Optional[str]
    prompt_version: Optional[str]
    error: Optional[str] = None
    tokens_used: Optional[int] = None
    modules: List[ModuleStatus]


class RunListItem(BaseModel):
    id: str
    issuer_id: str
    status: str
    qa_status: str
    committee_status: str
    as_of_date: Optional[str]
    analyst_id: Optional[str] = None
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}

    @field_validator("created_at", mode="after")
    @classmethod
    def _utc_aware(cls, v: Optional[datetime]) -> Optional[datetime]:
        # SQLite hands back naive datetimes (stored UTC); serialize with an
        # explicit offset so clients don't parse UTC wall-clock as local time.
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class RunFreshnessResponse(BaseModel):
    run_id: str
    evaluated_at: datetime
    evaluation: FreshnessEvaluation


async def _proved_run_freshness(
    db: AsyncSession,
    caller: CallerIdentity,
    run_id: str,
) -> Optional[FreshnessEvaluation]:
    """Return the exact run's lineage-proved state from an active owned context."""
    from routes.analysis import get_context_freshness

    contexts = (await db.execute(
        select(AnalysisContextRecord)
        .where(AnalysisContextRecord.analyst_id == caller.id)
        .order_by(AnalysisContextRecord.updated_at.desc())
        .limit(100)
    )).scalars().all()
    evaluations: list[FreshnessEvaluation] = []
    for context in contexts:
        artifacts = context.artifacts or {}
        retained_run_ids = {
            str(ref.get("id"))
            for ref in artifacts.get("artifact_refs", [])
            if isinstance(ref, dict)
            and ref.get("kind") == "issuer_run"
            and ref.get("id")
        }
        if artifacts.get("issuer_run_id") == run_id:
            retained_run_ids.add(run_id)
        if run_id not in retained_run_ids:
            continue
        try:
            result = await get_context_freshness(context.id, db, caller)
        except HTTPException:
            continue
        evaluations.extend(
            item.evaluation for item in result.artifacts
            if item.artifact.kind == "issuer_run" and item.artifact.id == run_id
        )
    return worst_freshness(evaluations, source_kind="run") if evaluations else None


class EvidenceOut(BaseModel):
    evidence_id: str
    extraction_type: str
    lineage_class: str
    source_locator: Optional[str]
    confidence: str
    document_chunk_id: Optional[str]

    model_config = {"from_attributes": True}


class ClaimOut(BaseModel):
    claim_id: str
    claim_text: str
    evidence: List[EvidenceOut]


class ModuleDetail(BaseModel):
    module_id: str
    module_name: str
    owned_object: Optional[str]
    schema_family: str
    runtime_output: dict
    confidence: str
    qa_status: str
    committee_status: str
    validation_status: str
    limitation_flags: list
    downstream_consumers: list
    claims: List[ClaimOut]


class FindingOut(BaseModel):
    finding_id: str
    severity: str
    lane: Optional[int]
    module_id: Optional[str]
    description: str
    affected_claim_id: Optional[str]
    required_remediation: Optional[str]

    model_config = {"from_attributes": True}


class QAReport(BaseModel):
    run_id: str
    qa_status: str
    committee_status: str
    findings_by_severity: dict
    findings: List[FindingOut]


# ── Helpers ─────────────────────────────────────────────────────────────────
async def _summary_modules(db: AsyncSession, run_id: str) -> List[Any]:
    rows = await db.execute(
        select(
            ModuleOutput.module_id, ModuleOutput.module_name, ModuleOutput.qa_status,
            ModuleOutput.committee_status, ModuleOutput.confidence, ModuleOutput.validation_status
        ).where(ModuleOutput.run_id == run_id).order_by(ModuleOutput.created_at)
    )
    return list(rows.all())


async def _modules_for(db: AsyncSession, run_id: str) -> List[ModuleOutput]:
    rows = await db.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == run_id).order_by(ModuleOutput.created_at)
    )
    return list(rows.scalars().all())


async def _summary(db: AsyncSession, run: Run) -> RunSummary:
    modules = await _summary_modules(db, run.id)
    return RunSummary(
        id=run.id, issuer_id=run.issuer_id, status=run.status,
        qa_status=run.qa_status, committee_status=run.committee_status,
        as_of_date=run.as_of_date, analyst_id=run.analyst_id,
        model_id=run.model_id, prompt_version=run.prompt_version,
        error=run.error, tokens_used=run.tokens_used,
        modules=[ModuleStatus.model_validate(m) for m in modules],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────
@router.post("", response_model=RunSummary, status_code=201)
async def create_run(
    body: RunCreate,
    request: Request,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    if not rate_limit.hit(f"runs:{caller.id}", max_attempts=_RUNS_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Run rate limit reached — try again in a minute.")

    require_issuer(caller, await db.get(Issuer, body.issuer_id))
    explicit_portfolio = (
        require_portfolio_access(caller, await db.get(Portfolio, body.portfolio_id))
        if body.portfolio_id
        else None
    )

    # Dedup: refuse a second run while one is already active for this issuer, so
    # two analysts (or a double-click) don't kick off duplicate work that then
    # races on the issuer's headline metric_facts (runner.py supersedes other
    # runs' facts → last-writer-wins). Re-runs once the prior one is terminal are
    # allowed. The lock makes the check→insert atomic against a concurrent POST.
    async with _create_run_lock():
        # A client retrying the SAME logical request (network drop after commit,
        # or the prior run already reached a terminal state) — the active-run
        # check below can't catch this since nothing may be active anymore.
        cached_run_id = _idempotency_lookup(caller.id, idempotency_key)
        if cached_run_id is not None:
            cached_run = await db.get(Run, cached_run_id)
            if cached_run is not None:
                return await _summary(db, cached_run)

        settings = get_settings()

        # 1. Per-analyst active limit check
        analyst_active_count = (await db.execute(
            select(func.count(Run.id))
            .where(Run.analyst_id == caller.id, Run.status.in_(("queued", "running")))
        )).scalar() or 0
        if analyst_active_count >= settings.caos_run_per_analyst_limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You have reached the limit of concurrent/queued runs ({settings.caos_run_per_analyst_limit}). Please wait for them to finish."
            )

        # 2. Global queue limit check
        global_active_count = (await db.execute(
            select(func.count(Run.id))
            .where(Run.status.in_(("queued", "running")))
        )).scalar() or 0
        if global_active_count >= settings.caos_run_queue_limit:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "The analysis run queue is currently full. Please try again later."
            )

        active = (await db.execute(
            select(Run.id)
            .where(Run.issuer_id == body.issuer_id, Run.status.in_(("queued", "running")))
            .limit(1)
        )).scalar_one_or_none()
        if active:
            raise HTTPException(status.HTTP_409_CONFLICT, "A run for this issuer is already in progress")

        # Bind a portfolio: the explicit choice, else auto-bind the one book that
        # holds this issuer (so CP-3C's concentration goes live with no extra step;
        # ambiguous when held in several → left unbound rather than guessing).
        if explicit_portfolio is not None:
            portfolio_id = explicit_portfolio.id
        else:
            portfolio_id = await _auto_portfolio(db, body.issuer_id, caller)
        run = Run(
            issuer_id=body.issuer_id, as_of_date=body.as_of_date, analyst_id=caller.id,
            portfolio_id=portfolio_id,
            # Pin the mode the X-Model-Mode dependency resolved for this request, so
            # the background runner (and any re-claim) uses the same tier.
            model_mode=presets.current_mode(),
        )
        db.add(run)
        try:
            await db.flush()
            if body.context_id and settings.caos_lineage_v2_enabled:
                context = (await db.execute(select(AnalysisContextRecord).where(
                    AnalysisContextRecord.id == body.context_id,
                    AnalysisContextRecord.analyst_id == caller.id,
                ).with_for_update())).scalar_one_or_none()
                if context is None or body.issuer_id not in (context.issuer_ids or []):
                    raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
                input_refs = [
                    ref for ref in typed_refs_from_artifacts(context.artifacts)
                    if ref.kind in {"source_manifest", "document", "market_snapshot"}
                ]
                run_ref = ArtifactRef(kind="issuer_run", id=run.id)
                await bind_context_artifacts(
                    db,
                    context_id=context.id,
                    analyst_id=caller.id,
                    refs=[run_ref],
                    legacy_updates={"issuer_run_id": run.id},
                )
                for input_ref in input_refs:
                    await write_lineage_edge(
                        db,
                        context_id=context.id,
                        analyst_id=caller.id,
                        artifact=run_ref,
                        parent=input_ref,
                        transform="run-creation",
                        transform_version="2",
                        enabled=True,
                    )
            await db.commit()  # persist the queued run so the executor can see it
        except IntegrityError:
            # Belt-and-suspenders: the SELECT-then-INSERT above is already
            # serialized by _create_run_lock() within THIS process, but the DB-
            # level uq_runs_issuer_active partial unique index (migration 0035)
            # also backstops a race across multiple app replicas, where a
            # per-process lock can't coordinate. Same 409 the in-process check
            # above already gives — not a 500.
            await db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "A run for this issuer is already in progress")
        _idempotency_store(caller.id, idempotency_key, run.id)

    await request.app.state.executor.enqueue(run.id)
    return await _summary(db, run)


@router.get("", response_model=List[RunListItem])
async def list_runs(
    issuer_id: Optional[str] = None,
    # Bounded page: runs accumulate one-per-analysis forever, so an unbounded
    # SELECT is a memory/latency/exfil-volume DoS as the table grows. P4.
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Runs newest-first, optionally filtered to one issuer (read-only)."""
    stmt = select(
        Run.id, Run.issuer_id, Run.status, Run.qa_status, Run.committee_status,
        Run.as_of_date, Run.analyst_id, Run.created_at
    ).order_by(Run.created_at.desc())
    if issuer_id:
        stmt = stmt.where(Run.issuer_id == issuer_id)
    if tenancy_enabled():
        # Only runs whose issuer is visible to the caller's team.
        stmt = stmt.where(Run.issuer_id.in_(scope_issuers(select(Issuer.id), caller)))
    stmt = stmt.limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()
    return [RunListItem.model_validate(r) for r in rows]


@router.get("/{run_id}", response_model=RunSummary)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    run = await require_run_access(caller, await db.get(Run, run_id), db)
    return await _summary(db, run)


@router.get("/{run_id}/freshness", response_model=RunFreshnessResponse)
async def get_run_freshness(
    run_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Evaluate this exact run rather than substituting the latest issuer run."""
    # Keep foreign identifiers non-enumerable whether the feature is on or off.
    run = await require_run_access(caller, await db.get(Run, run_id), db)
    if not get_settings().caos_lineage_v2_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found.")
    now = datetime.now(timezone.utc)
    proved = await _proved_run_freshness(db, caller, run.id)
    return RunFreshnessResponse(
        run_id=run.id,
        evaluated_at=now,
        evaluation=proved or evaluate_freshness(
            source_kind="run", now=now,
            observed_at=run.completed_at or run.created_at,
            source_version_state="unknown",
        ),
    )


@router.get("/{run_id}/modules", response_model=List[ModuleDetail])
async def get_modules(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """All module outputs for a run, with claims + evidence, in three queries.

    Bulk read for the Deep-Dive open: the per-module endpoint below costs the
    client one HTTP round trip (and the server ~3 queries) per module — 21
    requests per page open. This returns the same ModuleDetail shape for every
    produced module at once."""
    if await db.get(Run, run_id) is None:
        raise HTTPException(404, "Run not found")
    rows = await _modules_for(db, run_id)
    row_pks = [r.id for r in rows]
    claims_by_module: dict[str, List[Claim]] = {pk: [] for pk in row_pks}
    claim_pks: List[str] = []
    if row_pks:
        for c in (await db.execute(
            select(Claim).where(Claim.module_output_id.in_(row_pks))
        )).scalars():
            claims_by_module[c.module_output_id].append(c)
            claim_pks.append(c.id)
    evidence_by_claim: dict[str, List[EvidenceItem]] = {pk: [] for pk in claim_pks}
    if claim_pks:
        for e in (await db.execute(
            select(EvidenceItem).where(EvidenceItem.claim_pk.in_(claim_pks))
        )).scalars():
            evidence_by_claim[e.claim_pk].append(e)
    return [
        ModuleDetail(
            module_id=row.module_id, module_name=row.module_name, owned_object=row.owned_object,
            schema_family=row.schema_family, runtime_output=row.runtime_output, confidence=row.confidence,
            qa_status=row.qa_status, committee_status=row.committee_status,
            validation_status=row.validation_status, limitation_flags=row.limitation_flags,
            downstream_consumers=row.downstream_consumers,
            claims=[
                ClaimOut(
                    claim_id=c.claim_id, claim_text=c.claim_text,
                    evidence=[EvidenceOut.model_validate(e) for e in evidence_by_claim[c.id]],
                )
                for c in claims_by_module[row.id]
            ],
        )
        for row in rows
    ]


@router.get("/{run_id}/modules/{module_id}", response_model=ModuleDetail)
async def get_module(
    run_id: str,
    module_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    if tenancy_enabled():
        await require_run_access(caller, await db.get(Run, run_id), db)
    row = (
        await db.execute(
            select(ModuleOutput).where(
                ModuleOutput.run_id == run_id, ModuleOutput.module_id == module_id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Module output not found for this run")

    claims = list(
        (await db.execute(select(Claim).where(Claim.module_output_id == row.id))).scalars().all()
    )
    claim_pks = [c.id for c in claims]
    evidence_by_claim: dict[str, List[EvidenceItem]] = {pk: [] for pk in claim_pks}
    if claim_pks:
        ev_rows = (
            await db.execute(select(EvidenceItem).where(EvidenceItem.claim_pk.in_(claim_pks)))
        ).scalars().all()
        for e in ev_rows:
            evidence_by_claim[e.claim_pk].append(e)

    return ModuleDetail(
        module_id=row.module_id, module_name=row.module_name, owned_object=row.owned_object,
        schema_family=row.schema_family, runtime_output=row.runtime_output, confidence=row.confidence,
        qa_status=row.qa_status, committee_status=row.committee_status,
        validation_status=row.validation_status, limitation_flags=row.limitation_flags,
        downstream_consumers=row.downstream_consumers,
        claims=[
            ClaimOut(
                claim_id=c.claim_id, claim_text=c.claim_text,
                evidence=[EvidenceOut.model_validate(e) for e in evidence_by_claim[c.id]],
            )
            for c in claims
        ],
    )


@router.get("/{run_id}/qa", response_model=QAReport)
async def get_qa(
    run_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    run = await require_run_access(caller, await db.get(Run, run_id), db)
    findings = list(
        (await db.execute(select(QAFinding).where(QAFinding.run_id == run_id))).scalars().all()
    )
    counts = {"CRITICAL": 0, "MATERIAL": 0, "MINOR": 0}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    return QAReport(
        run_id=run_id, qa_status=run.qa_status, committee_status=run.committee_status,
        findings_by_severity=counts,
        findings=[FindingOut.model_validate(f) for f in findings],
    )


@router.post("/{run_id}/report")
async def export_committee_report(
    run_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Render the committee report — refused unless the run is Committee Ready.

    This is the gate with teeth: a Restricted or Blocked run cannot be exported.
    The refusal (409) carries the blocking findings so the caller knows what to
    remediate.
    """
    run = await require_run_access(caller, await db.get(Run, run_id), db)

    if not committee_export_allowed(run.committee_status):
        blocking = (
            await db.execute(
                select(QAFinding).where(
                    QAFinding.run_id == run_id,
                    QAFinding.severity.in_(["CRITICAL", "MATERIAL"]),
                )
            )
        ).scalars().all()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    f"Committee export refused — run is {run.committee_status!r} "
                    f"(qa_status {run.qa_status!r}). Remediate the findings and re-run."
                ),
                "committee_status": run.committee_status,
                "qa_status": run.qa_status,
                "blocking_findings": [
                    {"finding_id": f.finding_id, "severity": f.severity,
                     "module_id": f.module_id, "description": f.description}
                    for f in blocking
                ],
            },
        )

    modules = await _modules_for(db, run_id)
    return assemble_report(run, modules)


@router.post("/{run_id}/vault")
async def export_to_vault(
    run_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Write this run to the Obsidian-style vault as Markdown (hub + spoke).

    One-way, analyst-initiated. Unlike the committee report this is *not* gated on
    Committee Ready — it's a derived artifact and the run's qa/committee status is
    stamped into the note's frontmatter, so a draft exports labelled as a draft.
    Returns 503 when no vault dir is configured (VAULT_EXPORT_DIR unset), 500 when
    the configured dir can't be written.

    Authorization: single-team, by design — see this module's docstring. Any
    authenticated analyst may export any run to disk (not scoped to
    ``caller.id``); ``test_runs_idor_single_team_read_is_intentional`` pins it,
    including this write path specifically.
    """
    if not rate_limit.hit(f"vault:{caller.id}", max_attempts=_RUNS_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Vault export rate limit reached — try again in a minute.")

    settings = get_settings()
    if not settings.vault_export_dir:
        raise HTTPException(503, "Vault export not configured (set VAULT_EXPORT_DIR).")
    await require_run_access(caller, await db.get(Run, run_id), db)

    try:
        paths = await vault_export.export_run(db, run_id, settings.vault_export_dir)
    except OSError as e:  # unwritable / bad VAULT_EXPORT_DIR — a config issue, not a server fault
        logger.warning("vault export write failed for run %s: %s", run_id, e)
        raise HTTPException(500, "Vault export failed — check VAULT_EXPORT_DIR exists and is writable.") from e
    return {"written": [p.name for p in paths], "vault_dir": settings.vault_export_dir}
