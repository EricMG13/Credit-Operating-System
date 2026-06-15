"""Run lifecycle endpoints — create a run, inspect its modules and QA gate.

These back the (future) live Pipeline / Deep-Dive / QA views, replacing the
seeded module outputs the frontend renders today. The slice runs synchronously
on create; a queue/worker is a later concern.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import (
    AsyncSessionLocal, Claim, EvidenceItem, Issuer, ModuleOutput, QAFinding, Run, get_db,
)
from engine.report import assemble_report, committee_export_allowed
from engine.runner import execute_run
from identity import CallerIdentity, get_identity

logger = logging.getLogger("caos")
router = APIRouter()

_RUNS_MAX_PER_MINUTE = 12


async def _execute_run_bg(run_id: str) -> None:
    """Execute a queued run in the background, on its own session. A failure is
    persisted (status=failed + reason) so it stays inspectable — the runner never
    leaves a run stuck in 'running'."""
    async with AsyncSessionLocal() as session:
        run = await session.get(Run, run_id)
        if run is None:
            return
        try:
            await execute_run(session, run)
            await session.commit()
        except Exception as e:  # noqa: BLE001
            logger.exception("background run %s failed", run_id)
            await session.rollback()
            run = await session.get(Run, run_id)
            if run is not None:
                run.status = "failed"
                run.failure_reason = (f"{type(e).__name__}: {e}")[:1000]
                await session.commit()


# ── Request / response models ───────────────────────────────────────────────
class RunCreate(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    as_of_date: Optional[str] = Field(default=None, max_length=32)
    # Opt-in async execution: return immediately with status='queued' and run in
    # the background (poll GET /runs/{id}). Default stays synchronous.
    background: bool = False


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
    model_id: Optional[str]
    prompt_version: Optional[str]
    failure_reason: Optional[str] = None
    modules: List[ModuleStatus]


class RunListItem(BaseModel):
    id: str
    issuer_id: str
    status: str
    qa_status: str
    committee_status: str
    as_of_date: Optional[str]
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
        as_of_date=run.as_of_date, model_id=run.model_id, prompt_version=run.prompt_version,
        failure_reason=run.failure_reason,
        modules=[ModuleStatus.model_validate(m) for m in modules],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────
@router.post("", response_model=RunSummary, status_code=201)
async def create_run(
    body: RunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(f"runs:{caller.id}", max_attempts=_RUNS_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Run rate limit reached — try again in a minute.")

    if await db.get(Issuer, body.issuer_id) is None:
        raise HTTPException(404, "Issuer not found")

    run = Run(issuer_id=body.issuer_id, as_of_date=body.as_of_date, analyst_id=caller.id)
    db.add(run)
    await db.flush()
    run_id = run.id

    # Async path: persist the queued run, hand execution to a background task, and
    # return immediately so a multi-module / LLM run doesn't block the request.
    if body.background:
        run.status = "queued"
        await db.commit()
        background_tasks.add_task(_execute_run_bg, run_id)
        return await _summary(db, run)

    try:
        await execute_run(db, run)
    except Exception as e:  # noqa: BLE001
        # The in-flight error may have poisoned the session, so roll back and
        # persist a minimal failed-run record in a fresh transaction — the fault
        # is then inspectable via GET /runs/{id} (Phase-1 fault-finding) instead
        # of vanishing on rollback. The reason is also surfaced in the 502.
        reason = (f"{type(e).__name__}: {e}")[:1000]
        logger.exception("run %s execution failed", run_id)
        await db.rollback()
        db.add(Run(
            id=run_id, issuer_id=body.issuer_id, as_of_date=body.as_of_date,
            analyst_id=caller.id, status="failed", failure_reason=reason,
        ))
        await db.commit()
        raise HTTPException(
            502, detail={"message": "Run execution failed.", "run_id": run_id,
                         "failure_reason": reason},
        ) from e

    await db.flush()
    return await _summary(db, run)


@router.get("", response_model=List[RunListItem])
async def list_runs(
    issuer_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Runs newest-first, optionally filtered to one issuer (read-only)."""
    stmt = select(Run).order_by(Run.created_at.desc())
    if issuer_id:
        stmt = stmt.where(Run.issuer_id == issuer_id)
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
