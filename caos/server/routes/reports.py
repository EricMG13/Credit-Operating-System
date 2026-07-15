"""Analyst-owned Report Studio drafts and immutable committee versions."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from analysis_contracts import ArtifactRef
from config import get_settings
from context_lineage import bind_context_artifacts
from database import (
    AnalysisContextRecord,
    LineageEdge,
    ModelCheckpoint,
    ModuleOutput,
    ReportDraft,
    ReportVersion,
    Run,
    SourceManifest,
    ThesisVersion,
    get_db,
)
from engine.report import assemble_report, committee_export_allowed
from engine.registry import DECLARATION_INDEX
from identity import CallerIdentity, get_identity, require_write_role
from freshness import FreshnessEvaluation, evaluate_freshness, worst_freshness
from lineage_service import write_lineage_edge
from model_engine_v2 import ENGINE_VERSION, ModelDraftPayload
from model_service import (
    ModelCheckpointError,
    model_v2_checkpoint_snapshot,
)
from report_composition import ReportCompositionIntent, materialize_reviewed_report
from report_exports import render_report_pdf, render_report_xlsx
from run_inputs import manifest_is_approved
from tenancy import require_run_access

router = APIRouter()
_MAX_PAYLOAD_BYTES = 1_000_000
# A published version freezes the canonical document plus Model Engine v2's
# calculation graph. That graph is intentionally larger than the 5 MB input
# draft (stable node audit fields expand each cell), so the analyst-authored
# composition limit cannot also be the immutable-envelope limit. Keep the
# envelope bounded while allowing roughly 3x the maximum draft plus report
# structure.
_MAX_REPORT_VERSION_BYTES = 32_000_000


def _bounded_composition(
    payload: dict,
    *,
    label: str = "Report composition",
    max_bytes: int = _MAX_PAYLOAD_BYTES,
) -> str:
    try:
        canonical = json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
            default=str,
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{label} is not canonically serializable.",
        ) from exc
    if len(canonical.encode("utf-8")) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"{label} is too large.",
        )
    return canonical


class ReportDraftBody(BaseModel):
    payload: dict = Field(default_factory=dict)
    expected_revision: Optional[int] = Field(default=None, ge=1)


class ReportDraftOut(BaseModel):
    id: str
    context_id: str
    payload: dict
    revision: int
    updated_at: datetime


class ReportVersionCreate(BaseModel):
    context_id: str = Field(min_length=1, max_length=36)
    run_id: str = Field(min_length=1, max_length=64)
    model_checkpoint_id: str = Field(min_length=1, max_length=36)
    thesis_version_id: Optional[str] = Field(default=None, max_length=36)
    payload: dict = Field(default_factory=dict)
    preview_sha256: Optional[str] = Field(default=None, min_length=64, max_length=64)


class ReportVersionPreview(BaseModel):
    context_id: str = Field(min_length=1, max_length=36)
    run_id: str = Field(min_length=1, max_length=64)
    model_checkpoint_id: str = Field(min_length=1, max_length=36)
    thesis_version_id: Optional[str] = Field(default=None, max_length=36)
    payload: dict = Field(default_factory=dict)


class ReportVersionPreviewOut(BaseModel):
    id: str
    status: Literal["preview"] = "preview"
    context_id: str
    run_id: str
    model_checkpoint_id: str
    thesis_version_id: Optional[str]
    payload: dict
    document_sha256: str
    preview_sha256: str
    authority: dict
    model_engine_version: Optional[str] = None
    model_source_fingerprint: Optional[str] = None
    model_input_fingerprint: Optional[str] = None
    model_calculation_hash: Optional[str] = None
    model_draft_revision: Optional[int] = None
    created_at: datetime


class ReportVersionOut(BaseModel):
    id: str
    context_id: str
    run_id: str
    model_checkpoint_id: str
    thesis_version_id: Optional[str]
    status: str
    payload: dict
    document_sha256: str
    authority: dict
    model_engine_version: Optional[str] = None
    model_source_fingerprint: Optional[str] = None
    model_input_fingerprint: Optional[str] = None
    model_calculation_hash: Optional[str] = None
    model_draft_revision: Optional[int] = None
    created_at: datetime


class ReportVersionSummaryOut(BaseModel):
    id: str
    context_id: str
    run_id: str
    model_checkpoint_id: str
    thesis_version_id: Optional[str]
    status: str
    document_sha256: str
    authority: dict
    model_engine_version: Optional[str] = None
    model_source_fingerprint: Optional[str] = None
    model_input_fingerprint: Optional[str] = None
    model_calculation_hash: Optional[str] = None
    model_draft_revision: Optional[int] = None
    created_at: datetime


async def _owned_context(db: AsyncSession, context_id: str, analyst_id: str) -> AnalysisContextRecord:
    row = (await db.execute(select(AnalysisContextRecord).where(
        AnalysisContextRecord.id == context_id,
        AnalysisContextRecord.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    return row


def _draft_out(row: ReportDraft) -> ReportDraftOut:
    return ReportDraftOut(
        id=row.id,
        context_id=row.context_id,
        payload=row.payload or {},
        revision=row.revision,
        updated_at=row.updated_at,
    )


def _version_out(row: ReportVersion) -> ReportVersionOut:
    return ReportVersionOut(
        id=row.id,
        context_id=row.context_id,
        run_id=row.run_id,
        model_checkpoint_id=row.model_checkpoint_id,
        thesis_version_id=row.thesis_version_id,
        status=row.status,
        payload=row.payload or {},
        document_sha256=row.document_sha256,
        authority=_stored_authority(row.authority or {}),
        model_engine_version=row.model_engine_version,
        model_source_fingerprint=row.model_source_fingerprint,
        model_input_fingerprint=row.model_input_fingerprint,
        model_calculation_hash=row.model_calculation_hash,
        model_draft_revision=row.model_draft_revision,
        created_at=row.created_at,
    )


def _verified_version_payload(row: ReportVersion) -> dict:
    payload = row.payload if isinstance(row.payload, dict) else {}
    try:
        canonical = _bounded_composition(
            payload,
            label="Stored report version",
            max_bytes=_MAX_REPORT_VERSION_BYTES,
        )
    except HTTPException as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The immutable report payload failed its stored document hash.",
        ) from exc
    if not row.document_sha256 or not hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest() == row.document_sha256:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The immutable report payload failed its stored document hash.",
        )
    return payload


def _version_summary_out(row: ReportVersion) -> ReportVersionSummaryOut:
    return ReportVersionSummaryOut(
        id=row.id,
        context_id=row.context_id,
        run_id=row.run_id,
        model_checkpoint_id=row.model_checkpoint_id,
        thesis_version_id=row.thesis_version_id,
        status=row.status,
        document_sha256=row.document_sha256,
        authority=_stored_authority(row.authority or {}),
        model_engine_version=row.model_engine_version,
        model_source_fingerprint=row.model_source_fingerprint,
        model_input_fingerprint=row.model_input_fingerprint,
        model_calculation_hash=row.model_calculation_hash,
        model_draft_revision=row.model_draft_revision,
        created_at=row.created_at,
    )


def _model_v2_checkpoint_snapshot(checkpoint: ModelCheckpoint) -> dict:
    try:
        return model_v2_checkpoint_snapshot(checkpoint)
    except ModelCheckpointError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            str(exc),
        ) from exc


def _report_event_time() -> datetime:
    """Return the single policy clock used to timestamp preview/publication."""

    return datetime.now(timezone.utc)


def _require_unexpired_effective_overrides(
    model_snapshot: dict,
    *,
    evaluated_at: datetime,
) -> None:
    """Block new reports after any frozen effective override has expired.

    Checkpoint validation deliberately recalculates at the checkpoint timestamp
    to prove its immutable calculation identity. Publication has a different
    policy boundary: a replacement that affected that frozen result
    must still be active at the preview/publication event. Overrides that were
    already inactive when the checkpoint was calculated remain audit evidence
    and do not block publication because they did not affect the frozen result.
    """

    if evaluated_at.tzinfo is None or evaluated_at.utcoffset() is None:
        raise ValueError("report event time must include a timezone")
    evaluated_at = evaluated_at.astimezone(timezone.utc)
    payload = ModelDraftPayload.model_validate(model_snapshot.get("payload"))
    effective_override_nodes = {
        node.get("node_id")
        for period in model_snapshot.get("calculation", {}).get("periods", [])
        for node in period.get("nodes", [])
        if node.get("overridden") is True
    }
    expired_nodes = sorted(
        override.node_id
        for override in payload.overrides
        if (
            override.node_id in effective_override_nodes
            and override.expires_at is not None
            and override.expires_at <= evaluated_at
        )
    )
    if expired_nodes:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            (
                "An effective override in the selected Model Engine v2 "
                "checkpoint has expired. Restore or recalculate the model and "
                "create a new checkpoint before previewing or publishing."
            ),
        )


def _unknown_report_freshness(*, now: Optional[datetime] = None, reason: str) -> FreshnessEvaluation:
    return evaluate_freshness(
        source_kind="derived_artifact",
        now=now or datetime.now(timezone.utc),
        observed_at=now,
        source_version_state="unknown",
    ).model_copy(update={"reason": reason})


def _stored_authority(authority: dict) -> dict:
    """Never return a legacy naked CURRENT as policy-backed freshness."""
    result = dict(authority or {})
    raw = result.get("freshness_evaluation")
    try:
        evaluation = FreshnessEvaluation.model_validate(raw) if isinstance(raw, dict) else None
    except ValueError:
        evaluation = None
    if evaluation is None:
        evaluation = _unknown_report_freshness(reason="legacy_report_freshness_unverified")
    result["freshness"] = evaluation.state
    result["freshness_evaluation"] = evaluation.model_dump(mode="json")
    return result


async def _exact_report_freshness(
    db: AsyncSession,
    caller: CallerIdentity,
    row: ReportVersion,
) -> Optional[FreshnessEvaluation]:
    """Resolve the exact frozen report id through its owned context lineage."""
    if not get_settings().caos_lineage_v2_enabled:
        return None
    from routes.analysis import get_context_freshness

    try:
        result = await get_context_freshness(row.context_id, db, caller)
    except HTTPException:
        return None
    evaluations = [
        item.evaluation for item in result.artifacts
        if item.artifact.kind == "report_version" and item.artifact.id == row.id
    ]
    return worst_freshness(evaluations) if evaluations else None


@dataclass(frozen=True)
class _PreparedReport:
    context: AnalysisContextRecord
    run: Run
    checkpoint: ModelCheckpoint
    manifest: SourceManifest
    manifests: tuple[SourceManifest, ...]
    payload: dict
    canonical: str
    document_sha256: str
    model_snapshot: Optional[dict]
    analyst_override: bool


async def _prepare_report(
    db: AsyncSession,
    caller: CallerIdentity,
    body: ReportVersionCreate | ReportVersionPreview,
) -> _PreparedReport:
    """Validate exact inputs and materialize one deterministic reviewed report."""
    context = await _owned_context(db, body.context_id, caller.id)
    run = await require_run_access(caller, await db.get(Run, body.run_id), db)
    settings = get_settings()
    lineage_enabled = settings.caos_lineage_v2_enabled
    model_enabled = settings.caos_model_engine_v2_enabled
    if model_enabled and not lineage_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Model Engine v2 report publication requires CAOS_LINEAGE_V2_ENABLED.",
        )
    if run.analyst_id != caller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found.")
    if not committee_export_allowed(run.committee_status):
        raise HTTPException(status.HTTP_409_CONFLICT, "Run is not Committee Ready.")
    checkpoint = await db.get(ModelCheckpoint, body.model_checkpoint_id)
    if checkpoint is None or checkpoint.analyst_id != caller.id or checkpoint.context_id != context.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model checkpoint not found.")
    if checkpoint.issuer_id != run.issuer_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Model checkpoint and run describe different issuers.")
    artifacts = context.artifacts or {}
    if artifacts.get("issuer_run_id") != run.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The report run is not the active run in this analysis context.",
        )
    if (
        checkpoint.engine_version == ENGINE_VERSION
        and checkpoint.issuer_run_id is not None
        and checkpoint.issuer_run_id != run.id
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Model checkpoint and report must share the exact source run.",
        )
    if artifacts.get("model_checkpoint_id") != checkpoint.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "The selected checkpoint is not active in this context.")
    manifest_id = artifacts.get("source_manifest_id")
    manifest = await db.get(SourceManifest, manifest_id) if manifest_id else None
    if manifest is None or manifest.analyst_id != caller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source manifest not found.")
    if manifest.status != "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, "A current ready source manifest is required for publication.")
    if manifest.origin != "live":
        raise HTTPException(status.HTTP_409_CONFLICT, "Reference or demo sources cannot be published.")
    if manifest.issuer_id != run.issuer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source manifest not found.")
    input_manifest_ids = {
        str(manifest_id) for manifest_id in (run.input_manifest_ids or [])
        if isinstance(manifest_id, str) and manifest_id
    }
    if (
        run.input_snapshot_state != "approved"
        or not run.input_corpus_sha256
        or not input_manifest_ids
        or manifest.id not in input_manifest_ids
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The report run does not carry a fully approved immutable input snapshot.",
        )
    input_manifests = tuple((await db.execute(select(SourceManifest).where(
        SourceManifest.id.in_(input_manifest_ids),
        SourceManifest.issuer_id == run.issuer_id,
        SourceManifest.analyst_id == caller.id,
    ))).scalars().all())
    if (
        {item.id for item in input_manifests} != input_manifest_ids
        or not all(manifest_is_approved(item) for item in input_manifests)
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Every source manifest in the run snapshot must remain ready and ratified.",
        )
    if lineage_enabled:
        exact_input_edges = set((await db.execute(select(LineageEdge.parent_id).where(
            LineageEdge.context_id == context.id,
            LineageEdge.analyst_id == caller.id,
            LineageEdge.artifact_kind == "issuer_run",
            LineageEdge.artifact_id == f"issuer_run:{run.id}",
            LineageEdge.parent_kind == "source_manifest",
        ))).scalars().all())
        expected_parents = {
            f"source_manifest:{manifest_id}" for manifest_id in input_manifest_ids
        }
        if not expected_parents.issubset(exact_input_edges):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The run lineage does not contain every manifest in its frozen input snapshot.",
            )
    if body.thesis_version_id:
        thesis = await db.get(ThesisVersion, body.thesis_version_id)
        if thesis is None or thesis.issuer_id != run.issuer_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Thesis version not found.")
    modules = (await db.execute(select(ModuleOutput).where(
        ModuleOutput.run_id == run.id
    ))).scalars().all()
    modules.sort(key=lambda module: (
        -1 if module.module_id == "CP-X" else DECLARATION_INDEX.get(module.module_id, 999),
        module.module_id,
    ))
    canonical_document = assemble_report(run, modules)
    if model_enabled:
        model_snapshot = _model_v2_checkpoint_snapshot(checkpoint)
    else:
        frozen = checkpoint.payload if isinstance(checkpoint.payload, dict) else {}
        if checkpoint.engine_version is not None or frozen.get("version") == 2:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "A Model Engine v2 checkpoint cannot be republished while the v2 flag is disabled; select a legacy checkpoint or re-enable v2.",
            )
        model_snapshot = None
    try:
        intent = ReportCompositionIntent.model_validate(body.payload)
    except ValueError as exc:
        if model_enabled:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Report composition must contain only server-reviewable editorial intent.",
            ) from exc
        # Compatibility while Model Engine v2 is rolled back: never trust or
        # persist the old opaque rendered_report, but continue to publish a
        # server-owned unedited projection of the exact legacy run.
        intent = ReportCompositionIntent(source_run_id=run.id)
    if intent.source_run_id != run.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Report composition was prepared from a different run; request a new frozen preview.",
        )
    try:
        reviewed_report = materialize_reviewed_report(canonical_document, intent)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    payload = {
        "composition": {
            "reviewed_report": reviewed_report,
            "editorial": intent.model_dump(mode="json"),
        },
        "document": canonical_document,
        "source_manifest_id": manifest.id,
        "source_manifest_ids": sorted(input_manifest_ids),
        "input_corpus_sha256": run.input_corpus_sha256,
        "model_payload_hash": checkpoint.payload_hash,
    }
    if model_snapshot is not None:
        payload["model"] = model_snapshot
    canonical = _bounded_composition(
        payload,
        label="Report version",
        max_bytes=_MAX_REPORT_VERSION_BYTES,
    )
    return _PreparedReport(
        context=context,
        run=run,
        checkpoint=checkpoint,
        manifest=manifest,
        manifests=input_manifests,
        payload=payload,
        canonical=canonical,
        document_sha256=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        model_snapshot=model_snapshot,
        analyst_override=bool(
            intent.edits
            or any(intent.omit.values())
            or intent.hide_addbacks
            or not intent.show_sources
        ),
    )


@router.get("/drafts/{context_id}", response_model=Optional[ReportDraftOut])
async def get_report_draft(
    context_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _owned_context(db, context_id, caller.id)
    row = (await db.execute(select(ReportDraft).where(
        ReportDraft.context_id == context_id,
        ReportDraft.analyst_id == caller.id,
    ))).scalar_one_or_none()
    return _draft_out(row) if row else None


@router.put("/drafts/{context_id}", response_model=ReportDraftOut)
async def put_report_draft(
    context_id: str,
    body: ReportDraftBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    require_write_role(caller)
    if not rate_limit.hit(f"report-drafts:{caller.id}", max_attempts=30, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Report draft rate limit reached.")
    _bounded_composition(body.payload)
    await _owned_context(db, context_id, caller.id)
    row = (await db.execute(select(ReportDraft).where(
        ReportDraft.context_id == context_id,
        ReportDraft.analyst_id == caller.id,
    ))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        if body.expected_revision is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Report draft does not exist at that revision.")
        row = ReportDraft(
            context_id=context_id,
            analyst_id=caller.id,
            payload=body.payload,
            revision=1,
            updated_at=now,
        )
        db.add(row)
    else:
        if body.expected_revision is not None and body.expected_revision != row.revision:
            raise HTTPException(status.HTTP_409_CONFLICT, {
                "message": "Report draft changed elsewhere.",
                "current_revision": row.revision,
            })
        row.payload = body.payload
        row.revision += 1
        row.updated_at = now
    await db.flush()
    return _draft_out(row)


@router.get("/versions", response_model=list[ReportVersionSummaryOut])
async def list_report_versions(
    context_id: str = Query(..., max_length=36),
    limit: int = Query(25, ge=1, le=50),
    before: Optional[datetime] = Query(None),
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _owned_context(db, context_id, caller.id)
    query = select(ReportVersion).where(
        ReportVersion.context_id == context_id,
        ReportVersion.analyst_id == caller.id,
    )
    if before is not None:
        query = query.where(ReportVersion.created_at < before)
    rows = (await db.execute(
        query.order_by(ReportVersion.created_at.desc(), ReportVersion.id.desc()).limit(limit)
    )).scalars().all()
    return [_version_summary_out(row) for row in rows]


@router.get("/versions/{version_id}", response_model=ReportVersionOut)
async def get_report_version(
    version_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    row = await db.get(ReportVersion, version_id)
    if row is None or row.analyst_id != caller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report version not found.")
    _verified_version_payload(row)
    return _version_out(row)


@router.post("/versions/preview", response_model=ReportVersionPreviewOut)
async def preview_report_version(
    body: ReportVersionPreview,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    require_write_role(caller)
    _bounded_composition(body.payload)
    if not rate_limit.hit(f"report-previews:{caller.id}", max_attempts=20, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Report preview rate limit reached.")
    prepared = await _prepare_report(db, caller, body)
    now = _report_event_time()
    if prepared.model_snapshot is not None:
        _require_unexpired_effective_overrides(
            prepared.model_snapshot,
            evaluated_at=now,
        )
    return ReportVersionPreviewOut(
        id=f"preview-{prepared.document_sha256}",
        context_id=prepared.context.id,
        run_id=prepared.run.id,
        model_checkpoint_id=prepared.checkpoint.id,
        thesis_version_id=body.thesis_version_id,
        payload=prepared.payload,
        document_sha256=prepared.document_sha256,
        preview_sha256=prepared.document_sha256,
        authority={
            "origin": "live",
            "method": "derived",
            "as_of": now.isoformat(),
            "source_ids": [
                prepared.manifest.id,
                prepared.run.id,
                prepared.checkpoint.id,
            ],
            "run_id": prepared.run.id,
            "approval_state": "preview",
            "analyst_override": prepared.analyst_override,
            **({
                "model_origin": prepared.model_snapshot["authority"]["origin"],
                "model_input_origins": prepared.model_snapshot["authority"]["model_input_origins"],
                "model_analyst_override": prepared.model_snapshot["authority"]["analyst_override"],
            } if prepared.model_snapshot is not None else {}),
        },
        model_engine_version=(
            prepared.model_snapshot["engine_version"]
            if prepared.model_snapshot is not None else None
        ),
        model_source_fingerprint=(
            prepared.model_snapshot["source_fingerprint"]
            if prepared.model_snapshot is not None else None
        ),
        model_input_fingerprint=(
            prepared.model_snapshot["input_fingerprint"]
            if prepared.model_snapshot is not None else None
        ),
        model_calculation_hash=(
            prepared.model_snapshot["calculation_hash"]
            if prepared.model_snapshot is not None else None
        ),
        model_draft_revision=(
            prepared.model_snapshot["draft_revision"]
            if prepared.model_snapshot is not None else None
        ),
        created_at=now,
    )


@router.post("/versions", response_model=ReportVersionOut, status_code=status.HTTP_201_CREATED)
async def create_report_version(
    body: ReportVersionCreate,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    require_write_role(caller)
    _bounded_composition(body.payload)
    if not rate_limit.hit(f"report-versions:{caller.id}", max_attempts=10, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Report publication rate limit reached.")
    prepared = await _prepare_report(db, caller, body)
    now = _report_event_time()
    if prepared.model_snapshot is not None:
        _require_unexpired_effective_overrides(
            prepared.model_snapshot,
            evaluated_at=now,
        )
    if prepared.model_snapshot is not None and body.preview_sha256 != prepared.document_sha256:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "message": "Publish the exact server-frozen preview before creating an immutable version.",
                "preview_sha256": prepared.document_sha256,
            },
        )
    context = prepared.context
    run = prepared.run
    checkpoint = prepared.checkpoint
    manifest = prepared.manifest
    manifests = prepared.manifests
    payload = prepared.payload
    model_snapshot = prepared.model_snapshot
    lineage_enabled = get_settings().caos_lineage_v2_enabled
    artifacts = context.artifacts or {}
    row = ReportVersion(
        context_id=context.id,
        analyst_id=caller.id,
        run_id=run.id,
        model_checkpoint_id=checkpoint.id,
        thesis_version_id=body.thesis_version_id,
        status="published",
        payload=payload,
        document_sha256=prepared.document_sha256,
        authority={
            "origin": "live",
            "method": "derived",
            "freshness": "unknown",
            "freshness_evaluation": _unknown_report_freshness(
                now=now, reason="report_lineage_pending"
            ).model_dump(mode="json"),
            "as_of": now.isoformat(),
            "source_ids": [*[item.id for item in manifests], run.id, checkpoint.id],
            "run_id": run.id,
            "version_id": None,
            "confidence": None,
            "approval_state": "published",
            "analyst_override": prepared.analyst_override,
            **({
                "model_engine_version": model_snapshot["engine_version"],
                "model_source_fingerprint": model_snapshot["source_fingerprint"],
                "model_input_fingerprint": model_snapshot["input_fingerprint"],
                "model_calculation_hash": model_snapshot["calculation_hash"],
                "model_draft_revision": model_snapshot["draft_revision"],
                "model_origin": model_snapshot["authority"]["origin"],
                "model_input_origins": model_snapshot["authority"]["model_input_origins"],
                "model_analyst_override": model_snapshot["authority"]["analyst_override"],
            } if model_snapshot is not None else {}),
        },
        model_engine_version=model_snapshot["engine_version"] if model_snapshot else None,
        model_source_fingerprint=model_snapshot["source_fingerprint"] if model_snapshot else None,
        model_input_fingerprint=model_snapshot["input_fingerprint"] if model_snapshot else None,
        model_calculation_hash=model_snapshot["calculation_hash"] if model_snapshot else None,
        model_draft_revision=model_snapshot["draft_revision"] if model_snapshot else None,
        created_at=now,
    )
    db.add(row)
    await db.flush()
    row.authority = {**row.authority, "version_id": row.id}
    if lineage_enabled:
        report_ref = ArtifactRef(kind="report_version", id=row.id, version=row.document_sha256)
        parent_refs = [
            ArtifactRef(kind="issuer_run", id=run.id),
            ArtifactRef(kind="model_checkpoint", id=checkpoint.id, version=checkpoint.payload_hash),
            *[ArtifactRef(kind="source_manifest", id=item.id) for item in manifests],
        ]
        await bind_context_artifacts(
            db,
            context_id=context.id,
            analyst_id=caller.id,
            refs=[report_ref, *parent_refs],
            legacy_updates={"report_version_id": row.id},
        )
        for parent_ref in parent_refs:
            await write_lineage_edge(
                db,
                context_id=context.id,
                analyst_id=caller.id,
                artifact=report_ref,
                parent=parent_ref,
                transform="report-publication",
                transform_version="2",
                enabled=True,
            )
    else:
        context.artifacts = {**artifacts, "report_version_id": row.id}
        context.updated_at = now
    await db.flush()
    # Freeze the policy-backed evaluation only after the exact report and all
    # parent edges exist. If the read cannot prove it, UNKNOWN remains stored.
    evaluated = await _exact_report_freshness(db, caller, row)
    if evaluated is not None:
        row.authority = {
            **row.authority,
            "freshness": evaluated.state,
            "freshness_evaluation": evaluated.model_dump(mode="json"),
        }
        await db.flush()
    return _version_out(row)


@router.post("/versions/{version_id}/export")
async def export_report_version(
    version_id: str,
    format: Literal["json", "xlsx", "pdf"] = Query("json"),
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    row = await db.get(ReportVersion, version_id)
    if row is None or row.analyst_id != caller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report version not found.")
    authority = _stored_authority(row.authority or {})
    if row.status != "published" or authority.get("origin") != "live":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only live published report versions can be exported.")
    payload = _verified_version_payload(row)
    # Export-time authority reflects the exact frozen report's current lineage.
    # Failure/flag-off is UNKNOWN, never a replay of a legacy naked CURRENT.
    dynamic = await _exact_report_freshness(db, caller, row)
    if dynamic is None:
        dynamic = _unknown_report_freshness(reason="report_export_freshness_unavailable")
    authority = {
        **authority,
        "freshness": dynamic.state,
        "freshness_evaluation": dynamic.model_dump(mode="json"),
    }
    if format == "xlsx":
        content = render_report_xlsx(
            version_id=row.id,
            document_sha256=row.document_sha256,
            payload=payload,
            authority=authority,
        )
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="caos-report-{row.id}.xlsx"',
                "Cache-Control": "private, no-store",
                "X-CAOS-Document-SHA256": row.document_sha256,
            },
        )
    if format == "pdf":
        content = render_report_pdf(
            version_id=row.id,
            document_sha256=row.document_sha256,
            payload=payload,
            authority=authority,
        )
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="caos-report-{row.id}.pdf"',
                "Cache-Control": "private, no-store",
                "X-CAOS-Document-SHA256": row.document_sha256,
            },
        )
    return {
        "id": row.id,
        "document_sha256": row.document_sha256,
        "authority": authority,
        "payload": payload,
    }
