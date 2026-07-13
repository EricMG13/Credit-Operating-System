"""Analyst-owned cross-route contexts, findings and taxonomy APIs."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from analysis_contracts import (
    AnalysisArtifactRefs,
    AnalysisContext,
    AnalysisSurfaceState,
    AuthorityEnvelope,
    Finding,
)
from database import (
    AlertEvent,
    AnalysisContextRecord,
    AnalysisFinding,
    AnalysisQueryRun,
    Document,
    ModelCheckpoint,
    ReportVersion,
    ResearchJob,
    RVScreenRun,
    SectorReviewRun,
    SectorTaxonomy,
    SourceManifest,
    Run,
    get_db,
)
from identity import CallerIdentity, get_identity
from sector_taxonomy import canonical_sector_id

router = APIRouter()

_READ_MAX_PER_MINUTE = 120
_WRITE_MAX_PER_MINUTE = 45


def _guard(caller: CallerIdentity, *, write: bool) -> None:
    maximum = _WRITE_MAX_PER_MINUTE if write else _READ_MAX_PER_MINUTE
    bucket = "analysis-write" if write else "analysis-read"
    if not rate_limit.hit(f"{bucket}:{caller.id}", max_attempts=maximum, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Analysis workspace rate limit reached.")


async def _owned_context(db: AsyncSession, context_id: str, analyst_id: str) -> AnalysisContextRecord:
    row = (await db.execute(
        select(AnalysisContextRecord).where(
            AnalysisContextRecord.id == context_id,
            AnalysisContextRecord.analyst_id == analyst_id,
        )
    )).scalar_one_or_none()
    if row is None:
        # Deliberately hide whether another analyst owns this identifier.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    return row


async def _ensure_taxonomy(db: AsyncSession) -> None:
    # Migration 0047 owns taxonomy seeding. Runtime lazy inserts raced when two
    # first-load contexts arrived together, so API workers now treat taxonomy as
    # immutable reference data and fail explicitly if migrations were skipped.
    if (await db.execute(select(SectorTaxonomy.id).limit(1))).scalar_one_or_none() is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Sector taxonomy is not initialized; run database migrations.",
        )


def _context(row: AnalysisContextRecord) -> AnalysisContext:
    return AnalysisContext(
        id=row.id,
        name=row.name,
        sector_id=row.sector_id,
        sub_segments=row.sub_segments or [],
        issuer_ids=row.issuer_ids or [],
        instrument_ids=row.instrument_ids or [],
        portfolio_scope=row.portfolio_scope,
        as_of=row.as_of,
        sector_review_run_id=row.sector_review_run_id,
        rv_snapshot_id=row.rv_snapshot_id,
        rv_run_id=row.rv_run_id,
        query_session_id=row.query_session_id,
        artifacts=AnalysisArtifactRefs.model_validate(row.artifacts or {}),
        surface_state=AnalysisSurfaceState.model_validate(row.surface_state or {}),
        filters=row.filters or {},
        selected=row.selected or {},
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _finding(row: AnalysisFinding) -> Finding:
    return Finding(
        id=row.id,
        context_id=row.context_id,
        kind=row.kind,
        title=row.title,
        body=row.body,
        source_surface=row.source_surface,
        source_run_id=row.source_run_id,
        status=row.status,
        evidence=row.evidence or {},
        authority=AuthorityEnvelope.model_validate(row.authority),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class ContextCreate(BaseModel):
    name: str = Field("Untitled analysis", min_length=1, max_length=160)
    sector_id: Optional[str] = Field(default=None, max_length=128)
    sub_segments: list[str] = Field(default_factory=list, max_length=50)
    issuer_ids: list[str] = Field(default_factory=list, max_length=500)
    instrument_ids: list[str] = Field(default_factory=list, max_length=1000)
    portfolio_scope: Optional[str] = Field(default=None, max_length=128)
    as_of: Optional[date] = None
    artifacts: AnalysisArtifactRefs = Field(default_factory=AnalysisArtifactRefs)
    surface_state: AnalysisSurfaceState = Field(default_factory=AnalysisSurfaceState)
    filters: dict = Field(default_factory=dict)
    selected: dict = Field(default_factory=dict)


class ContextPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    sector_id: Optional[str] = Field(default=None, max_length=128)
    sub_segments: Optional[list[str]] = Field(default=None, max_length=50)
    issuer_ids: Optional[list[str]] = Field(default=None, max_length=500)
    instrument_ids: Optional[list[str]] = Field(default=None, max_length=1000)
    portfolio_scope: Optional[str] = Field(default=None, max_length=128)
    as_of: Optional[date] = None
    sector_review_run_id: Optional[str] = Field(default=None, max_length=64)
    rv_snapshot_id: Optional[str] = Field(default=None, max_length=36)
    rv_run_id: Optional[str] = Field(default=None, max_length=36)
    query_session_id: Optional[str] = Field(default=None, max_length=36)
    artifacts: Optional[AnalysisArtifactRefs] = None
    surface_state: Optional[AnalysisSurfaceState] = None
    filters: Optional[dict] = None
    selected: Optional[dict] = None


async def _validate_artifact_refs(
    db: AsyncSession,
    refs: AnalysisArtifactRefs,
    *,
    context_id: Optional[str],
    analyst_id: str,
) -> None:
    """Reject foreign or mismatched artifact ids before they enter a context."""

    checks = (
        (refs.source_manifest_id, SourceManifest, "Source manifest"),
        (refs.research_job_id, ResearchJob, "Research job"),
        (refs.model_checkpoint_id, ModelCheckpoint, "Model checkpoint"),
        (refs.report_version_id, ReportVersion, "Report version"),
    )
    for artifact_id, model, label in checks:
        if not artifact_id:
            continue
        row = await db.get(model, artifact_id)
        if row is None or getattr(row, "analyst_id", None) != analyst_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found.")
        row_context_id = getattr(row, "context_id", None)
        if context_id is None and row_context_id:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{label} is already bound to an analysis context.",
            )
        if context_id and row_context_id and row_context_id != context_id:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{label} belongs to a different analysis context.")
    if refs.issuer_run_id:
        run = await db.get(Run, refs.issuer_run_id)
        if run is None or run.analyst_id != analyst_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Issuer run not found.")
    if refs.alert_event_id and await db.get(AlertEvent, refs.alert_event_id) is None:
        # Alert events are team-visible by design; existence is all the context
        # linker may infer. The alert payload itself remains behind its route.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert event not found.")


@router.get("/taxonomy")
async def get_taxonomy(
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    await _ensure_taxonomy(db)
    rows = (await db.execute(
        select(SectorTaxonomy).where(SectorTaxonomy.active.is_(True)).order_by(SectorTaxonomy.label)
    )).scalars().all()
    return {"sectors": [
        {"id": row.id, "label": row.label, "aliases": row.aliases or []} for row in rows
    ]}


@router.post("/contexts", response_model=AnalysisContext, status_code=status.HTTP_201_CREATED)
async def create_context(
    body: ContextCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=True)
    await _ensure_taxonomy(db)
    sector_id = canonical_sector_id(body.sector_id)
    if body.sector_id and sector_id is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown sector taxonomy value.")
    await _validate_artifact_refs(db, body.artifacts, context_id=None, analyst_id=caller.id)
    now = datetime.now(timezone.utc)
    row = AnalysisContextRecord(
        analyst_id=caller.id,
        name=body.name,
        sector_id=sector_id,
        sub_segments=body.sub_segments,
        issuer_ids=list(dict.fromkeys(body.issuer_ids)),
        instrument_ids=list(dict.fromkeys(body.instrument_ids)),
        portfolio_scope=body.portfolio_scope,
        as_of=body.as_of,
        artifacts=body.artifacts.model_dump(mode="json"),
        surface_state=body.surface_state.model_dump(mode="json", by_alias=True, exclude_none=True),
        filters=body.filters,
        selected=body.selected,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    return _context(row)


@router.get("/contexts", response_model=list[AnalysisContext])
async def list_contexts(
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    rows = (await db.execute(
        select(AnalysisContextRecord)
        .where(AnalysisContextRecord.analyst_id == caller.id)
        .order_by(AnalysisContextRecord.updated_at.desc())
        .limit(limit)
    )).scalars().all()
    return [_context(row) for row in rows]


@router.get("/contexts/{context_id}", response_model=AnalysisContext)
async def get_context(
    context_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    return _context(await _owned_context(db, context_id, caller.id))


@router.patch("/contexts/{context_id}", response_model=AnalysisContext)
async def patch_context(
    context_id: str,
    body: ContextPatch,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=True)
    row = await _owned_context(db, context_id, caller.id)
    changes = body.model_dump(exclude_unset=True)
    if "sector_id" in changes:
        await _ensure_taxonomy(db)
        raw = changes["sector_id"]
        changes["sector_id"] = canonical_sector_id(raw)
        if raw and changes["sector_id"] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown sector taxonomy value.")
    if "artifacts" in changes:
        # Artifact updates are patch semantics, not whole-object replacement.
        # Several long-running surfaces may finish out of order (research,
        # model, ingestion); merging prevents a later callback from erasing a
        # sibling artifact reference it never intended to touch.
        merged_artifacts = {**(row.artifacts or {}), **(changes["artifacts"] or {})}
        refs = AnalysisArtifactRefs.model_validate(merged_artifacts)
        await _validate_artifact_refs(db, refs, context_id=context_id, analyst_id=caller.id)
        changes["artifacts"] = refs.model_dump(mode="json")
    if "surface_state" in changes:
        merged_surface_state = {**(row.surface_state or {}), **(changes["surface_state"] or {})}
        changes["surface_state"] = AnalysisSurfaceState.model_validate(
            merged_surface_state
        ).model_dump(mode="json", by_alias=True, exclude_none=True)
    for key, value in changes.items():
        setattr(row, key, value)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return _context(row)


class FindingCreate(BaseModel):
    context_id: str = Field(max_length=36)
    kind: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=240)
    body: str = Field(default="", max_length=12000)
    source_surface: Literal[
        "query", "sector-review", "rv-screener", "research", "sponsors",
        "command", "deep-dive", "model", "reports", "pipeline", "monitor",
        "issuer-profile", "global-ask",
    ]
    source_run_id: str = Field(min_length=1, max_length=64)
    evidence: dict = Field(default_factory=dict)


class FindingPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=240)
    body: Optional[str] = Field(default=None, max_length=12000)
    status: Optional[Literal["draft", "ratified", "archived"]] = None
    evidence: Optional[dict] = None


async def _trusted_finding_authority(
    db: AsyncSession,
    *,
    surface: str,
    run_id: str,
    context_id: str,
    analyst_id: str,
) -> AuthorityEnvelope:
    """Resolve authority from the owned source artifact, never request JSON."""
    raw: Optional[dict] = None
    if surface in {"query", "global-ask"}:
        row = (await db.execute(select(AnalysisQueryRun).where(
            AnalysisQueryRun.id == run_id,
            AnalysisQueryRun.context_id == context_id,
            AnalysisQueryRun.analyst_id == analyst_id,
        ))).scalar_one_or_none()
        raw = row.authority if row else None
    elif surface == "rv-screener":
        row = (await db.execute(select(RVScreenRun).where(
            RVScreenRun.id == run_id,
            RVScreenRun.context_id == context_id,
            RVScreenRun.analyst_id == analyst_id,
        ))).scalar_one_or_none()
        raw = row.authority if row else None
    elif surface == "sector-review":
        row = (await db.execute(select(SectorReviewRun).where(
            SectorReviewRun.id == run_id,
            SectorReviewRun.analyst_id == analyst_id,
        ))).scalar_one_or_none()
        payload = row.payload or {} if row else {}
        if payload.get("context_id") == context_id:
            raw = payload.get("authority")
    elif surface == "model":
        row = await db.get(ModelCheckpoint, run_id)
        if row and row.context_id == context_id and row.analyst_id == analyst_id:
            raw = row.authority
    elif surface == "reports":
        row = await db.get(ReportVersion, run_id)
        if row and row.context_id == context_id and row.analyst_id == analyst_id:
            raw = row.authority
    elif surface == "research":
        row = await db.get(ResearchJob, run_id)
        if row and row.context_id == context_id and row.analyst_id == analyst_id:
            raw = row.authority
    elif surface == "monitor":
        row = await db.get(AlertEvent, run_id)
        if row:
            raw = row.authority
    elif surface in {"deep-dive", "command", "pipeline", "issuer-profile", "sponsors"}:
        row = await db.get(Run, run_id)
        if row and row.analyst_id == analyst_id:
            source_ids = list((await db.execute(select(Document.id).where(
                Document.issuer_id == row.issuer_id
            ).limit(500))).scalars().all())
            observed_at = row.completed_at or row.created_at
            raw = {
                "origin": "live",
                "method": "derived",
                "freshness": "current" if row.status == "complete" else "unknown",
                "as_of": observed_at,
                "source_ids": source_ids,
                "run_id": row.id,
                "version_id": row.id,
                "confidence": None,
                "approval_state": "draft",
                "analyst_override": None,
            }
    if not raw:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Owned source run not found.")
    return AuthorityEnvelope.model_validate(raw).model_copy(update={"approval_state": "draft"})


@router.post("/findings", response_model=Finding, status_code=status.HTTP_201_CREATED)
async def create_finding(
    body: FindingCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=True)
    await _owned_context(db, body.context_id, caller.id)
    authority = await _trusted_finding_authority(
        db,
        surface=body.source_surface,
        run_id=body.source_run_id,
        context_id=body.context_id,
        analyst_id=caller.id,
    )
    now = datetime.now(timezone.utc)
    row = AnalysisFinding(
        analyst_id=caller.id,
        context_id=body.context_id,
        kind=body.kind,
        title=body.title,
        body=body.body,
        source_surface=body.source_surface,
        source_run_id=body.source_run_id,
        status="draft",
        evidence=body.evidence,
        authority=authority.model_dump(mode="json"),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    return _finding(row)


@router.get("/findings", response_model=list[Finding])
async def list_findings(
    context_id: Optional[str] = Query(default=None, max_length=36),
    finding_status: Optional[Literal["draft", "ratified", "archived"]] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    stmt = select(AnalysisFinding).where(AnalysisFinding.analyst_id == caller.id)
    if context_id:
        await _owned_context(db, context_id, caller.id)
        stmt = stmt.where(AnalysisFinding.context_id == context_id)
    if finding_status:
        stmt = stmt.where(AnalysisFinding.status == finding_status)
    rows = (await db.execute(stmt.order_by(AnalysisFinding.updated_at.desc()).limit(200))).scalars().all()
    return [_finding(row) for row in rows]


@router.patch("/findings/{finding_id}", response_model=Finding)
async def patch_finding(
    finding_id: str,
    body: FindingPatch,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=True)
    row = (await db.execute(select(AnalysisFinding).where(
        AnalysisFinding.id == finding_id,
        AnalysisFinding.analyst_id == caller.id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Finding not found.")
    changes = body.model_dump(exclude_unset=True)
    if changes.get("status") == "ratified":
        authority = AuthorityEnvelope.model_validate(row.authority)
        if authority.origin != "live" or authority.freshness != "current" or not authority.source_ids:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Only current, live, source-backed findings can be ratified.",
            )
        row.authority = authority.model_copy(update={"approval_state": "ratified"}).model_dump(mode="json")
    elif changes.get("status") == "draft":
        authority = AuthorityEnvelope.model_validate(row.authority)
        row.authority = authority.model_copy(update={"approval_state": "draft"}).model_dump(mode="json")
    for key, value in changes.items():
        setattr(row, key, value)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return _finding(row)
