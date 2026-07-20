"""Analyst-owned cross-route contexts, findings and taxonomy APIs."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Literal, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, model_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from analysis_contracts import (
    AnalysisArtifactRefs,
    AnalysisContext,
    AnalysisSurfaceState,
    ARTIFACT_KINDS,
    ArtifactKind,
    ArtifactRef,
    AuthorityEnvelope,
    ArtifactFreshness,
    ContextFreshness,
    ContextLineage,
    Finding,
    LineageEdgeV2,
)
from config import get_settings
from database import (
    AlertEvent,
    AnalysisContextRecord,
    AnalysisFinding,
    AnalysisInsight,
    AnalysisQueryRun,
    Decision,
    Document,
    DocumentChunk,
    Issuer,
    IssuerReportingProfile,
    LineageEdge,
    MarketInstrument,
    MarketSnapshot,
    ModelCheckpoint,
    Portfolio,
    ReportVersion,
    ResearchJob,
    RVScreenRun,
    SectorReviewRun,
    SectorTaxonomy,
    SourceManifest,
    Run,
    get_db,
)
from identity import CallerIdentity, get_identity, get_write_identity
from json_safety import require_bounded_json
from freshness import (
    FreshnessEvaluation,
    FreshnessSourceKind,
    ReportingCadence,
    SourceVersionState,
    evaluate_freshness,
)
from context_lineage import LEGACY_REF_FIELDS, merge_artifact_refs
from sector_taxonomy import canonical_sector_id
from tenancy import (
    require_issuer,
    require_portfolio_access,
    scope_issuers,
    tenancy_enabled,
)

router = APIRouter()

_READ_MAX_PER_MINUTE = 120
_WRITE_MAX_PER_MINUTE = 45
_MAX_CONTEXT_STATE_BYTES = 100 * 1024
_MAX_FINDING_EVIDENCE_BYTES = 250 * 1024

_CONTEXT_SUB_SEGMENT = Annotated[str, Field(max_length=128)]
_CONTEXT_RESOURCE_ID = Annotated[str, Field(max_length=36)]


def _guard(caller: CallerIdentity, *, write: bool) -> None:
    maximum = _WRITE_MAX_PER_MINUTE if write else _READ_MAX_PER_MINUTE
    bucket = "analysis-write" if write else "analysis-read"
    if not rate_limit.hit(f"{bucket}:{caller.id}", max_attempts=maximum, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Analysis workspace rate limit reached.")


async def _owned_context(
    db: AsyncSession,
    context_id: str,
    analyst_id: str,
    *,
    for_update: bool = False,
) -> AnalysisContextRecord:
    stmt = select(AnalysisContextRecord).where(
        AnalysisContextRecord.id == context_id,
        AnalysisContextRecord.analyst_id == analyst_id,
    )
    if for_update:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
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
        revision=row.revision,
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
        status=cast(Literal["draft", "ratified", "archived"], row.status),
        evidence=row.evidence or {},
        authority=AuthorityEnvelope.model_validate(row.authority),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _reject_unsupported_artifact_kind(value):
    """Tag only unsupported typed-ref kinds for the API's uniform 404 boundary."""
    if not isinstance(value, dict):
        return value
    artifacts = value.get("artifacts")
    if not isinstance(artifacts, dict):
        return value
    refs = artifacts.get("artifact_refs")
    if not isinstance(refs, list):
        return value
    for ref in refs:
        kind = ref.get("kind") if isinstance(ref, dict) else None
        if isinstance(kind, str) and kind not in ARTIFACT_KINDS:
            raise PydanticCustomError("artifact_not_found", "Artifact not found.")
    return value


class ContextCreate(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def _closed_artifact_boundary(cls, value):
        return _reject_unsupported_artifact_kind(value)

    name: str = Field("Untitled analysis", min_length=1, max_length=160)
    sector_id: Optional[str] = Field(default=None, max_length=128)
    sub_segments: list[_CONTEXT_SUB_SEGMENT] = Field(default_factory=list, max_length=50)
    issuer_ids: list[_CONTEXT_RESOURCE_ID] = Field(default_factory=list, max_length=500)
    instrument_ids: list[_CONTEXT_RESOURCE_ID] = Field(default_factory=list, max_length=1000)
    portfolio_scope: Optional[str] = Field(default=None, max_length=128)
    as_of: Optional[date] = None
    artifacts: AnalysisArtifactRefs = Field(default_factory=AnalysisArtifactRefs)
    surface_state: AnalysisSurfaceState = Field(default_factory=AnalysisSurfaceState)
    filters: dict = Field(default_factory=dict)
    selected: dict = Field(default_factory=dict)


class ContextPatch(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def _closed_artifact_boundary(cls, value):
        return _reject_unsupported_artifact_kind(value)

    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    sector_id: Optional[str] = Field(default=None, max_length=128)
    sub_segments: Optional[list[_CONTEXT_SUB_SEGMENT]] = Field(default=None, max_length=50)
    issuer_ids: Optional[list[_CONTEXT_RESOURCE_ID]] = Field(default=None, max_length=500)
    instrument_ids: Optional[list[_CONTEXT_RESOURCE_ID]] = Field(default=None, max_length=1000)
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
    expected_revision: Optional[int] = Field(default=None, ge=1)


async def _validate_artifact_refs(
    db: AsyncSession,
    refs: AnalysisArtifactRefs,
    *,
    context_id: Optional[str],
    caller: CallerIdentity,
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
        if row is None or getattr(row, "analyst_id", None) != caller.id:
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
        if run is None or run.analyst_id != caller.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Issuer run not found.")
    if refs.alert_event_id and await db.get(AlertEvent, refs.alert_event_id) is None:
        # Alert events are team-visible by design; existence is all the context
        # linker may infer. The alert payload itself remains behind its route.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert event not found.")
    if refs.portfolio_id:
        require_portfolio_access(caller, await db.get(Portfolio, refs.portfolio_id))
    if refs.decision_id:
        decision = await db.get(Decision, refs.decision_id)
        if decision is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Decision not found.")
        require_issuer(caller, await db.get(Issuer, decision.issuer_id))
    if refs.insight_id:
        insight = await db.get(AnalysisInsight, refs.insight_id)
        if insight is None or insight.analyst_id != caller.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Insight not found.")
        if context_id is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Insight is already bound to an analysis context.",
            )
        if context_id and insight.context_id != context_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Insight belongs to a different analysis context.")

    for ref in refs.artifact_refs:
        await _validate_typed_artifact_ref(
            db, ref, context_id=context_id, caller=caller
        )


def _typed_artifact_not_found() -> HTTPException:
    # One response for missing, unsupported, foreign, or mismatched typed refs:
    # callers cannot use the context API as an artifact-existence oracle.
    return HTTPException(status.HTTP_404_NOT_FOUND, "Artifact not found.")


async def _validate_typed_artifact_ref(
    db: AsyncSession,
    ref: ArtifactRef,
    *,
    context_id: Optional[str],
    caller: CallerIdentity,
) -> None:
    try:
        if ref.kind == "issuer_run":
            run_row = await db.get(Run, ref.id)
            if run_row is None or run_row.analyst_id != caller.id:
                raise _typed_artifact_not_found()
            require_issuer(caller, await db.get(Issuer, run_row.issuer_id))
        elif ref.kind == "source_manifest":
            manifest_row = await db.get(SourceManifest, ref.id)
            if manifest_row is None or manifest_row.analyst_id != caller.id:
                raise _typed_artifact_not_found()
            if manifest_row.issuer_id:
                require_issuer(caller, await db.get(Issuer, manifest_row.issuer_id))
        elif ref.kind == "research_job":
            research_row = await db.get(ResearchJob, ref.id)
            if research_row is None or research_row.analyst_id != caller.id:
                raise _typed_artifact_not_found()
            if research_row.context_id and research_row.context_id != context_id:
                raise _typed_artifact_not_found()
        elif ref.kind == "model_checkpoint":
            checkpoint_row = await db.get(ModelCheckpoint, ref.id)
            if (
                checkpoint_row is None
                or checkpoint_row.analyst_id != caller.id
                or checkpoint_row.context_id != context_id
            ):
                raise _typed_artifact_not_found()
            require_issuer(caller, await db.get(Issuer, checkpoint_row.issuer_id))
        elif ref.kind == "report_version":
            report_row = await db.get(ReportVersion, ref.id)
            if (
                report_row is None
                or report_row.analyst_id != caller.id
                or report_row.context_id != context_id
            ):
                raise _typed_artifact_not_found()
        elif ref.kind == "alert_event":
            alert_row = await db.get(AlertEvent, ref.id)
            if alert_row is None or (
                alert_row.context_id and alert_row.context_id != context_id
            ):
                raise _typed_artifact_not_found()
            if alert_row.issuer_id:
                require_issuer(caller, await db.get(Issuer, alert_row.issuer_id))
            elif alert_row.created_by != caller.id:
                raise _typed_artifact_not_found()
        elif ref.kind == "sponsor":
            statement = scope_issuers(
                select(Issuer.id).where(Issuer.sponsor == ref.id), caller
            ).limit(1)
            if (await db.execute(statement)).scalar_one_or_none() is None:
                raise _typed_artifact_not_found()
        elif ref.kind == "portfolio":
            require_portfolio_access(caller, await db.get(Portfolio, ref.id))
        elif ref.kind == "decision":
            decision_row = await db.get(Decision, ref.id)
            if decision_row is None:
                raise _typed_artifact_not_found()
            require_issuer(caller, await db.get(Issuer, decision_row.issuer_id))
        elif ref.kind == "insight":
            insight_row = await db.get(AnalysisInsight, ref.id)
            if (
                insight_row is None
                or insight_row.analyst_id != caller.id
                or insight_row.context_id != context_id
            ):
                raise _typed_artifact_not_found()
        elif ref.kind == "document":
            document_row = await db.get(Document, ref.id)
            if document_row is None:
                raise _typed_artifact_not_found()
            if document_row.issuer_id:
                require_issuer(caller, await db.get(Issuer, document_row.issuer_id))
            elif document_row.analyst_id != caller.id:
                raise _typed_artifact_not_found()
        elif ref.kind == "document_chunk":
            chunk_row = await db.get(DocumentChunk, ref.id)
            document = (
                await db.get(Document, chunk_row.document_id)
                if chunk_row is not None
                else None
            )
            if document is None:
                raise _typed_artifact_not_found()
            if document.issuer_id:
                require_issuer(caller, await db.get(Issuer, document.issuer_id))
            elif document.analyst_id != caller.id:
                raise _typed_artifact_not_found()
        elif ref.kind == "market_snapshot":
            snapshot_row = await db.get(MarketSnapshot, ref.id)
            if snapshot_row is None:
                raise _typed_artifact_not_found()
            if snapshot_row.analyst_id is not None:
                if snapshot_row.analyst_id != caller.id:
                    raise _typed_artifact_not_found()
            elif tenancy_enabled():
                # analyst_id was added by market XLSX v2.  NULL rows pre-date
                # that ownership contract and remain shared, but the existing
                # issuer/team boundary still applies to every instrument.
                issuer_ids = list((await db.execute(
                    select(MarketInstrument.issuer_id).where(
                        MarketInstrument.snapshot_id == ref.id
                    )
                )).scalars().all())
                if not issuer_ids or any(issuer_id is None for issuer_id in issuer_ids):
                    raise _typed_artifact_not_found()
                for issuer_id in set(issuer_ids):
                    require_issuer(caller, await db.get(Issuer, issuer_id))
        else:  # Literal validation normally catches this; keep route fail-closed.
            raise _typed_artifact_not_found()
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            raise _typed_artifact_not_found() from exc
        raise


async def _validate_context_subjects(
    db: AsyncSession,
    *,
    issuer_ids: list[str],
    instrument_ids: list[str],
    caller: CallerIdentity,
) -> None:
    """Resolve all context subjects and fail closed before analytical use."""
    for issuer_id in dict.fromkeys(issuer_ids):
        require_issuer(caller, await db.get(Issuer, issuer_id))
    for instrument_id in dict.fromkeys(instrument_ids):
        instrument = await db.get(MarketInstrument, instrument_id)
        if instrument is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Market instrument not found.")
        snapshot = await db.get(MarketSnapshot, instrument.snapshot_id)
        if snapshot is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Market instrument not found.")
        if snapshot.analyst_id is not None:
            if snapshot.analyst_id != caller.id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Market instrument not found.")
        elif tenancy_enabled():
            # Preserve the pre-v2 contract for legacy shared snapshots while
            # requiring exact issuer authorization under team tenancy.
            if not instrument.issuer_id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Market instrument not found.")
            try:
                require_issuer(caller, await db.get(Issuer, instrument.issuer_id))
            except HTTPException as exc:
                raise HTTPException(
                    status.HTTP_404_NOT_FOUND, "Market instrument not found."
                ) from exc


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
    response: Response,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _guard(caller, write=True)
    surface_state = body.surface_state.model_dump(
        mode="json", by_alias=True, exclude_none=True
    )
    require_bounded_json(
        {
            "surface_state": surface_state,
            "filters": body.filters,
            "selected": body.selected,
        },
        max_bytes=_MAX_CONTEXT_STATE_BYTES,
        label="Analysis context state",
    )
    await _ensure_taxonomy(db)
    sector_id = canonical_sector_id(body.sector_id)
    if body.sector_id and sector_id is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown sector taxonomy value.")
    # A bare create (name + optional sector, nothing else) is every surface's
    # mount-time default. Find-or-create: reuse the analyst's newest matching
    # context instead of inserting a duplicate row per visit — a 17-route
    # session otherwise litters dozens of identical contexts AND burns the
    # 45-writes/min budget on pure navigation. Any explicit scoping (issuers,
    # instruments, portfolio, artifacts, filters…) still creates fresh.
    bare = (
        not body.sub_segments
        and not body.issuer_ids
        and not body.instrument_ids
        and body.portfolio_scope is None
        and body.as_of is None
        and not body.artifacts.model_dump(exclude_none=True)
        and not body.filters
        and not body.selected
    )
    if bare:
        existing = (await db.execute(
            select(AnalysisContextRecord)
            .where(
                AnalysisContextRecord.analyst_id == caller.id,
                AnalysisContextRecord.name == body.name,
                AnalysisContextRecord.sector_id == sector_id,
            )
            .order_by(AnalysisContextRecord.updated_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return _context(existing)
    await _validate_context_subjects(
        db, issuer_ids=body.issuer_ids, instrument_ids=body.instrument_ids, caller=caller
    )
    if body.portfolio_scope:
        require_portfolio_access(
            caller, await db.get(Portfolio, body.portfolio_scope)
        )
    await _validate_artifact_refs(db, body.artifacts, context_id=None, caller=caller)
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
        surface_state=surface_state,
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


@router.get("/contexts/{context_id}/lineage", response_model=ContextLineage)
async def get_context_lineage(
    context_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    # Ownership is resolved before the feature gate so a foreign identifier is
    # indistinguishable from a missing context in every flag state.
    context = await _owned_context(db, context_id, caller.id)
    if not get_settings().caos_lineage_v2_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")

    refs = AnalysisArtifactRefs.model_validate(context.artifacts or {})
    await _validate_artifact_refs(db, refs, context_id=context_id, caller=caller)
    typed_refs: list[tuple[ArtifactKind, str, Optional[str]]] = list(dict.fromkeys(
        (ref.kind, ref.id, ref.version) for ref in refs.artifact_refs
    ))
    response_refs = [
        ArtifactRef(kind=kind, id=artifact_id, version=version)
        for kind, artifact_id, version in typed_refs
    ]
    allowed = {
        (f"{ref.kind}:{ref.id}", ref.version) for ref in response_refs
    }

    if not allowed:
        return ContextLineage(
            context_id=context_id, artifact_refs=response_refs, edges=[]
        )
    allowed_conditions = [
        and_(
            LineageEdge.artifact_id == artifact_id,
            LineageEdge.artifact_version == version
            if version is not None else LineageEdge.artifact_version.is_(None),
        )
        for artifact_id, version in allowed
    ]
    parent_conditions = [
        and_(
            LineageEdge.parent_id == artifact_id,
            LineageEdge.parent_version == version
            if version is not None else LineageEdge.parent_version.is_(None),
        )
        for artifact_id, version in allowed
    ]
    rows = (await db.execute(
        select(LineageEdge)
        .where(
            LineageEdge.context_id == context_id,
            LineageEdge.analyst_id == caller.id,
            LineageEdge.v2_idempotency_key.is_not(None),
            or_(*allowed_conditions),
            or_(*parent_conditions),
        )
        .order_by(LineageEdge.created_at.desc())
        .limit(201)
    )).scalars().all()
    edges: list[LineageEdgeV2] = []
    truncated = len(rows) > 200
    for row in rows[:200]:
        if (
            (row.artifact_id, row.artifact_version) not in allowed
            or (row.parent_id, row.parent_version) not in allowed
            or not row.artifact_kind
            or not row.parent_kind
            or row.artifact_kind not in ARTIFACT_KINDS
            or row.parent_kind not in ARTIFACT_KINDS
            or not row.artifact_id.startswith(f"{row.artifact_kind}:")
            or not row.parent_id.startswith(f"{row.parent_kind}:")
        ):
            continue
        edges.append(LineageEdgeV2(
            id=row.id,
            artifact=ArtifactRef(
                kind=cast(ArtifactKind, row.artifact_kind),
                id=row.artifact_id.split(":", 1)[1],
                version=row.artifact_version,
            ),
            parent=ArtifactRef(
                kind=cast(ArtifactKind, row.parent_kind),
                id=row.parent_id.split(":", 1)[1],
                version=row.parent_version,
            ),
            transform=row.transform,
            transform_version=row.transform_version,
            created_at=row.created_at,
        ))
    return ContextLineage(
        context_id=context_id,
        artifact_refs=response_refs,
        edges=edges,
        truncated=truncated,
    )


@router.get("/contexts/{context_id}/freshness", response_model=ContextFreshness)
async def get_context_freshness(
    context_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    context = await _owned_context(db, context_id, caller.id)
    if not get_settings().caos_lineage_v2_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    refs = AnalysisArtifactRefs.model_validate(context.artifacts or {})
    await _validate_artifact_refs(db, refs, context_id=context_id, caller=caller)
    typed_refs = list(refs.artifact_refs)
    current_by_kind: dict[ArtifactKind, set[tuple[str, Optional[str]]]] = {}
    for ref in typed_refs:
        current_by_kind.setdefault(ref.kind, set()).add((ref.id, ref.version))
    # Phase 1B retains historical typed refs for audit, while the legacy scalar
    # fields remain the producer-maintained active pointer for singleton kinds.
    # Narrow those kinds to the active id so a newly derived artifact can become
    # current after a rebind instead of comparing forever against old history.
    # If the scalar id has multiple typed versions, it cannot identify which is
    # active; fail to unknown rather than guessing a sortable version scheme.
    raw_artifacts = context.artifacts or {}
    for field, kind in LEGACY_REF_FIELDS.items():
        if kind not in ARTIFACT_KINDS:
            continue
        typed_kind = cast(ArtifactKind, kind)
        active_id = raw_artifacts.get(field)
        if not isinstance(active_id, str) or not active_id:
            continue
        matching = {
            (artifact_id, version)
            for artifact_id, version in current_by_kind.get(typed_kind, set())
            if artifact_id == active_id
        }
        current_by_kind[typed_kind] = matching or {(active_id, None)}
        if len(matching) > 1:
            current_by_kind[typed_kind] = set()
    if context.rv_snapshot_id:
        matching_snapshots = {
            (artifact_id, version)
            for artifact_id, version in current_by_kind.get("market_snapshot", set())
            if artifact_id == context.rv_snapshot_id
        }
        current_by_kind["market_snapshot"] = matching_snapshots or {
            (context.rv_snapshot_id, None)
        }
    now = datetime.now(timezone.utc)
    results: list[ArtifactFreshness] = []
    parents_by_artifact: dict[
        tuple[ArtifactKind, str, Optional[str]],
        set[tuple[ArtifactKind, str, Optional[str]]],
    ] = {}

    for ref in typed_refs:
        source_kind: FreshnessSourceKind = "derived_artifact"
        observed_at = None
        effective_period_end = None
        cadence: ReportingCadence = "unknown"
        reporting_lag_days = None
        grace_days = 7
        version_state: SourceVersionState = "match"
        if ref.kind == "issuer_run":
            run_row = await db.get(Run, ref.id)
            source_kind = "run"
            observed_at = (
                (run_row.completed_at or run_row.created_at) if run_row else None
            )
        elif ref.kind == "market_snapshot":
            snapshot_row = await db.get(MarketSnapshot, ref.id)
            source_kind = "price"
            observed_at = snapshot_row.as_of if snapshot_row else None
        elif ref.kind == "document":
            document_row = await db.get(Document, ref.id)
            if document_row and document_row.source_kind in {
                "reported_financials",
                "legal_document",
                "price",
            }:
                source_kind = cast(FreshnessSourceKind, document_row.source_kind)
                observed_at = (
                    document_row.source_published_at or document_row.uploaded_at
                )
                effective_period_end = document_row.effective_period_end
                if source_kind == "reported_financials":
                    profile = await db.get(
                        IssuerReportingProfile, document_row.issuer_id
                    )
                    if profile:
                        cadence = cast(ReportingCadence, profile.cadence)
                        reporting_lag_days = profile.reporting_lag_days
                        grace_days = profile.grace_days
            else:
                results.append(ArtifactFreshness(
                    artifact=ref,
                    evaluation=FreshnessEvaluation(
                        state="unknown", source_kind="derived_artifact",
                        reason="document_source_kind_unknown",
                    ),
                ))
                continue
        else:
            if ref.kind == "model_checkpoint":
                checkpoint_row = await db.get(ModelCheckpoint, ref.id)
                observed_at = checkpoint_row.created_at if checkpoint_row else None
            elif ref.kind == "report_version":
                report_row = await db.get(ReportVersion, ref.id)
                observed_at = report_row.created_at if report_row else None
            elif ref.kind == "insight":
                insight_row = await db.get(AnalysisInsight, ref.id)
                observed_at = insight_row.generated_at if insight_row else None
            elif ref.kind == "research_job":
                research_row = await db.get(ResearchJob, ref.id)
                observed_at = (
                    (research_row.completed_at or research_row.created_at)
                    if research_row
                    else None
                )
            elif ref.kind == "source_manifest":
                manifest_row = await db.get(SourceManifest, ref.id)
                observed_at = manifest_row.created_at if manifest_row else None

        if source_kind in {"run", "derived_artifact"}:
            edges = (await db.execute(
                select(LineageEdge).where(
                    LineageEdge.context_id == context_id,
                    LineageEdge.analyst_id == caller.id,
                    LineageEdge.artifact_id == f"{ref.kind}:{ref.id}",
                    LineageEdge.artifact_version == ref.version
                    if ref.version is not None else LineageEdge.artifact_version.is_(None),
                    LineageEdge.v2_idempotency_key.is_not(None),
                )
            )).scalars().all()
            artifact_key = (ref.kind, ref.id, ref.version)
            if not edges:
                version_state = "unknown"
                parents_by_artifact[artifact_key] = set()
            else:
                version_state = "match"
                incomplete_lineage = False
                parents_by_kind: dict[
                    ArtifactKind, set[tuple[str, Optional[str]]]
                ] = {}
                transforms_by_kind: dict[ArtifactKind, set[str]] = {}
                parent_keys: set[
                    tuple[ArtifactKind, str, Optional[str]]
                ] = set()
                for edge in edges:
                    raw_parent_kind = edge.parent_kind or ""
                    parent_id = edge.parent_id.split(":", 1)[1] if ":" in edge.parent_id else ""
                    if raw_parent_kind not in ARTIFACT_KINDS or not parent_id:
                        incomplete_lineage = True
                        continue
                    parent_kind = cast(ArtifactKind, raw_parent_kind)
                    parents_by_kind.setdefault(parent_kind, set()).add(
                        (parent_id, edge.parent_version)
                    )
                    transforms_by_kind.setdefault(parent_kind, set()).add(edge.transform)
                    parent_keys.add((parent_kind, parent_id, edge.parent_version))
                parents_by_artifact[artifact_key] = parent_keys
                for parent_kind, expected_parents in parents_by_kind.items():
                    candidates = current_by_kind.get(parent_kind)
                    if not candidates:
                        incomplete_lineage = True
                        continue
                    # An ingestion manifest is intentionally scoped to its own
                    # document; other documents may coexist in the context and
                    # are not replacements. Snapshot-style transforms (runs,
                    # checkpoints, reports, insights) compare the full active set.
                    # Singleton kinds were already narrowed to their active scalar.
                    subset_scoped = transforms_by_kind.get(parent_kind) == {"ingestion"}
                    changed = (
                        not expected_parents.issubset(candidates)
                        if subset_scoped else candidates != expected_parents
                    )
                    if changed:
                        version_state = "changed"
                        break
                if version_state != "changed" and incomplete_lineage:
                    version_state = "unknown"

        results.append(ArtifactFreshness(
            artifact=ref,
            evaluation=evaluate_freshness(
                source_kind=source_kind,
                now=now,
                observed_at=observed_at,
                effective_period_end=effective_period_end,
                cadence=cadence,
                reporting_lag_days=reporting_lag_days,
                grace_days=grace_days,
                source_version_state=version_state,
            ),
        ))

    # Propagate parent freshness through the lineage DAG. Identity equality is
    # necessary but not sufficient: a checkpoint still bound to the same run is
    # stale if that run became stale after a document/market source change.
    by_key = {
        (item.artifact.kind, item.artifact.id, item.artifact.version): item
        for item in results
    }
    resolved: dict[
        tuple[ArtifactKind, str, Optional[str]], ArtifactFreshness
    ] = {}

    def resolve(
        key: tuple[ArtifactKind, str, Optional[str]],
        visiting: set[tuple[ArtifactKind, str, Optional[str]]],
    ) -> ArtifactFreshness:
        if key in resolved:
            return resolved[key]
        item = by_key[key]
        if key in visiting:
            # Lineage must be a DAG. Fail closed if corrupt rows form a cycle.
            cycled = item.model_copy(update={
                "evaluation": item.evaluation.model_copy(update={
                    "state": "unknown", "reason": "lineage_cycle",
                })
            })
            resolved[key] = cycled
            return cycled
        next_visiting = {*visiting, key}
        parent_states: list[str] = []
        missing_parent = False
        for parent_key in parents_by_artifact.get(key, set()):
            if parent_key not in by_key:
                missing_parent = True
                continue
            parent_states.append(resolve(parent_key, next_visiting).evaluation.state)
        evaluation = item.evaluation
        if evaluation.state != "stale" and "stale" in parent_states:
            evaluation = evaluation.model_copy(update={
                "state": "stale", "reason": "bound_source_stale",
            })
        elif evaluation.state != "stale" and (missing_parent or "unknown" in parent_states):
            evaluation = evaluation.model_copy(update={
                "state": "unknown", "reason": "bound_source_unknown",
            })
        elif evaluation.state == "current" and "due" in parent_states:
            evaluation = evaluation.model_copy(update={
                "state": "due", "reason": "bound_source_due",
            })
        resolved_item = item.model_copy(update={"evaluation": evaluation})
        resolved[key] = resolved_item
        return resolved_item

    propagated = [
        resolve((item.artifact.kind, item.artifact.id, item.artifact.version), set())
        for item in results
    ]
    return ContextFreshness(context_id=context_id, evaluated_at=now, artifacts=propagated)


@router.patch("/contexts/{context_id}", response_model=AnalysisContext)
async def patch_context(
    context_id: str,
    body: ContextPatch,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _guard(caller, write=True)
    row = await _owned_context(db, context_id, caller.id, for_update=True)
    # by_alias is load-bearing: surface_state keys are hyphen-aliased
    # ("issuer-profile", "deep-dive", …). A field-name dump fed the merge
    # underscore keys, which AnalysisSurfaceState.model_validate silently
    # ignored — every write to an aliased surface no-oped with a 200, and the
    # client sync loops that waited to observe their write spun until the
    # write budget died.
    changes = body.model_dump(exclude_unset=True, by_alias=True)
    expected_revision = changes.pop("expected_revision", None)
    state_changed = any(
        field in changes for field in ("surface_state", "filters", "selected")
    )
    if expected_revision is not None and row.revision != expected_revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "message": "Analysis context changed. Refresh and retry.",
                "current_revision": row.revision,
            },
        )
    if "sector_id" in changes:
        await _ensure_taxonomy(db)
        raw = changes["sector_id"]
        changes["sector_id"] = canonical_sector_id(raw)
        if raw and changes["sector_id"] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown sector taxonomy value.")
    if "artifacts" in changes:
        # Artifact updates are patch semantics, not whole-object replacement.
        # Several long-running surfaces may finish out of order (research,
        # model, ingestion); merging prevents a later callback from erasing a
        # sibling artifact reference it never intended to touch.
        artifact_patch = changes["artifacts"] or {}
        incoming_refs = [
            ArtifactRef.model_validate(raw)
            for raw in (artifact_patch.get("artifact_refs") or [])
        ]
        legacy_updates = {
            field: artifact_patch[field]
            for field in LEGACY_REF_FIELDS
            if field in artifact_patch
        }
        # Typed refs are append-only audit identities. Unioning here makes a
        # delayed client patch idempotent and preserves refs transactionally
        # bound by checkpoint/report producers after that client last read.
        # An explicitly supplied empty collection is the established unbind
        # operation. Scalar-only patches omit artifact_refs entirely, while a
        # stale full client sends its older non-empty collection; those paths
        # continue to union and cannot erase producer-bound refs.
        merge_base = dict(row.artifacts or {})
        if "artifact_refs" in artifact_patch and not artifact_patch["artifact_refs"]:
            merge_base["artifact_refs"] = []
        merged_artifacts = merge_artifact_refs(
            merge_base,
            incoming_refs,
            legacy_updates=legacy_updates,
        )
        refs = AnalysisArtifactRefs.model_validate(merged_artifacts)
        await _validate_artifact_refs(db, refs, context_id=context_id, caller=caller)
        changes["artifacts"] = refs.model_dump(mode="json")
    if "surface_state" in changes:
        merged_surface_state = dict(row.surface_state or {})
        for surface, surface_patch in (changes["surface_state"] or {}).items():
            if surface_patch is None:
                merged_surface_state.pop(surface, None)
                continue
            prior_surface = merged_surface_state.get(surface)
            merged_surface = {
                **(prior_surface if isinstance(prior_surface, dict) else {}),
                **surface_patch,
            }
            if "filters" in surface_patch:
                prior_filters = (
                    prior_surface.get("filters", {})
                    if isinstance(prior_surface, dict) else {}
                )
                merged_surface["filters"] = {
                    **(prior_filters if isinstance(prior_filters, dict) else {}),
                    **(surface_patch.get("filters") or {}),
                }
            merged_surface_state[surface] = merged_surface
        changes["surface_state"] = AnalysisSurfaceState.model_validate(
            merged_surface_state
        ).model_dump(mode="json", by_alias=True, exclude_none=True)
    for legacy_field in ("filters", "selected"):
        if legacy_field in changes:
            prior = getattr(row, legacy_field) or {}
            changes[legacy_field] = {
                **(prior if isinstance(prior, dict) else {}),
                **(changes[legacy_field] or {}),
            }
    if state_changed:
        require_bounded_json(
            {
                "surface_state": changes.get("surface_state", row.surface_state or {}),
                "filters": changes.get("filters", row.filters or {}),
                "selected": changes.get("selected", row.selected or {}),
            },
            max_bytes=_MAX_CONTEXT_STATE_BYTES,
            label="Analysis context state",
        )
    if "issuer_ids" in changes or "instrument_ids" in changes:
        await _validate_context_subjects(
            db,
            issuer_ids=changes.get("issuer_ids", row.issuer_ids or []),
            instrument_ids=changes.get("instrument_ids", row.instrument_ids or []),
            caller=caller,
        )
    if changes.get("portfolio_scope"):
        require_portfolio_access(
            caller, await db.get(Portfolio, changes["portfolio_scope"])
        )
    for key, value in changes.items():
        setattr(row, key, value)
    row.revision += 1
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
        query_row = (await db.execute(select(AnalysisQueryRun).where(
            AnalysisQueryRun.id == run_id,
            AnalysisQueryRun.context_id == context_id,
            AnalysisQueryRun.analyst_id == analyst_id,
        ))).scalar_one_or_none()
        raw = query_row.authority if query_row else None
    elif surface == "rv-screener":
        rv_row = (await db.execute(select(RVScreenRun).where(
            RVScreenRun.id == run_id,
            RVScreenRun.context_id == context_id,
            RVScreenRun.analyst_id == analyst_id,
        ))).scalar_one_or_none()
        raw = rv_row.authority if rv_row else None
    elif surface == "sector-review":
        sector_row = (await db.execute(select(SectorReviewRun).where(
            SectorReviewRun.id == run_id,
            SectorReviewRun.analyst_id == analyst_id,
        ))).scalar_one_or_none()
        payload = sector_row.payload or {} if sector_row else {}
        if payload.get("context_id") == context_id:
            raw = payload.get("authority")
    elif surface == "model":
        checkpoint_row = await db.get(ModelCheckpoint, run_id)
        if (
            checkpoint_row
            and checkpoint_row.context_id == context_id
            and checkpoint_row.analyst_id == analyst_id
        ):
            raw = checkpoint_row.authority
    elif surface == "reports":
        report_row = await db.get(ReportVersion, run_id)
        if (
            report_row
            and report_row.context_id == context_id
            and report_row.analyst_id == analyst_id
        ):
            raw = report_row.authority
    elif surface == "research":
        research_row = await db.get(ResearchJob, run_id)
        if (
            research_row
            and research_row.context_id == context_id
            and research_row.analyst_id == analyst_id
        ):
            raw = research_row.authority
    elif surface == "monitor":
        alert_row = await db.get(AlertEvent, run_id)
        if alert_row:
            raw = alert_row.authority
    elif surface in {"deep-dive", "command", "pipeline", "issuer-profile", "sponsors"}:
        issuer_run = await db.get(Run, run_id)
        if issuer_run and issuer_run.analyst_id == analyst_id:
            source_ids = list((await db.execute(select(Document.id).where(
                Document.issuer_id == issuer_run.issuer_id
            ).limit(500))).scalars().all())
            observed_at = issuer_run.completed_at or issuer_run.created_at
            raw = {
                "origin": "live",
                "method": "derived",
                "freshness": (
                    "current" if issuer_run.status == "complete" else "unknown"
                ),
                "as_of": observed_at,
                "source_ids": source_ids,
                "run_id": issuer_run.id,
                "version_id": issuer_run.id,
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
    caller: CallerIdentity = Depends(get_write_identity),
):
    _guard(caller, write=True)
    require_bounded_json(
        body.evidence,
        max_bytes=_MAX_FINDING_EVIDENCE_BYTES,
        label="Finding evidence",
    )
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
    caller: CallerIdentity = Depends(get_write_identity),
):
    _guard(caller, write=True)
    row = (await db.execute(select(AnalysisFinding).where(
        AnalysisFinding.id == finding_id,
        AnalysisFinding.analyst_id == caller.id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Finding not found.")
    changes = body.model_dump(exclude_unset=True)
    if "evidence" in changes:
        require_bounded_json(
            changes["evidence"],
            max_bytes=_MAX_FINDING_EVIDENCE_BYTES,
            label="Finding evidence",
        )
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
