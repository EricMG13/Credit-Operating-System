"""Run lifecycle endpoints — create a run, inspect its modules and QA gate.

A run is queued on create and executed by the async run executor (run_executor.py);
clients poll GET /runs/{id} to completion. These endpoints create and inspect runs.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
import vault_export
from config import get_settings
from database import Claim, EvidenceItem, Issuer, ModuleOutput, QAFinding, Run, get_db
from engine.report import assemble_report, committee_export_allowed
from identity import CallerIdentity, get_identity

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


_RUNS_MAX_PER_MINUTE = 12


# ── Request / response models ───────────────────────────────────────────────
class RunCreate(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    as_of_date: Optional[str] = Field(default=None, max_length=32)


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
async def _modules_for(db: AsyncSession, run_id: str) -> List[ModuleOutput]:
    rows = await db.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == run_id).order_by(ModuleOutput.created_at)
    )
    return list(rows.scalars().all())


async def _summary(db: AsyncSession, run: Run) -> RunSummary:
    modules = await _modules_for(db, run.id)
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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(f"runs:{caller.id}", max_attempts=_RUNS_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Run rate limit reached — try again in a minute.")

    if await db.get(Issuer, body.issuer_id) is None:
        raise HTTPException(404, "Issuer not found")

    # Dedup: refuse a second run while one is already active for this issuer, so
    # two analysts (or a double-click) don't kick off duplicate work that then
    # races on the issuer's headline metric_facts (runner.py supersedes other
    # runs' facts → last-writer-wins). Re-runs once the prior one is terminal are
    # allowed. The lock makes the check→insert atomic against a concurrent POST.
    async with _create_run_lock():
        active = (await db.execute(
            select(Run.id)
            .where(Run.issuer_id == body.issuer_id, Run.status.in_(("queued", "running")))
            .limit(1)
        )).scalar_one_or_none()
        if active:
            raise HTTPException(status.HTTP_409_CONFLICT, "A run for this issuer is already in progress")

        run = Run(issuer_id=body.issuer_id, as_of_date=body.as_of_date, analyst_id=caller.id)
        db.add(run)
        await db.commit()  # persist the queued run so the executor can see it

    await request.app.state.executor.enqueue(run.id)
    return await _summary(db, run)


@router.get("", response_model=List[RunListItem])
async def list_runs(
    issuer_id: Optional[str] = None,
    # Bounded page: runs accumulate one-per-analysis forever, so an unbounded
    # SELECT is a memory/latency/exfil-volume DoS as the table grows. P4.
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Runs newest-first, optionally filtered to one issuer (read-only)."""
    stmt = select(Run).order_by(Run.created_at.desc())
    if issuer_id:
        stmt = stmt.where(Run.issuer_id == issuer_id)
    stmt = stmt.limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()
    return [RunListItem.model_validate(r) for r in rows]


@router.get("/{run_id}", response_model=RunSummary)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return await _summary(db, run)


@router.get("/{run_id}/modules/{module_id}", response_model=ModuleDetail)
async def get_module(
    run_id: str,
    module_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Render the committee report — refused unless the run is Committee Ready.

    This is the gate with teeth: a Restricted or Blocked run cannot be exported.
    The refusal (409) carries the blocking findings so the caller knows what to
    remediate.
    """
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")

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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Write this run to the Obsidian-style vault as Markdown (hub + spoke).

    One-way, analyst-initiated. Unlike the committee report this is *not* gated on
    Committee Ready — it's a derived artifact and the run's qa/committee status is
    stamped into the note's frontmatter, so a draft exports labelled as a draft.
    Returns 503 when no vault dir is configured (VAULT_EXPORT_DIR unset), 500 when
    the configured dir can't be written.
    """
    if not rate_limit.hit(f"vault:{caller.id}", max_attempts=_RUNS_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Vault export rate limit reached — try again in a minute.")

    settings = get_settings()
    if not settings.vault_export_dir:
        raise HTTPException(503, "Vault export not configured (set VAULT_EXPORT_DIR).")
    if await db.get(Run, run_id) is None:
        raise HTTPException(404, "Run not found")

    try:
        paths = await vault_export.export_run(db, run_id, settings.vault_export_dir)
    except OSError as e:  # unwritable / bad VAULT_EXPORT_DIR — a config issue, not a server fault
        logger.warning("vault export write failed for run %s: %s", run_id, e)
        raise HTTPException(500, "Vault export failed — check VAULT_EXPORT_DIR exists and is writable.") from e
    return {"written": [p.name for p in paths], "vault_dir": settings.vault_export_dir}
