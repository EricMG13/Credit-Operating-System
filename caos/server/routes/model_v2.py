"""Owned, revision-CAS routes for the canonical Model Engine v2."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from analysis_contracts import ArtifactRef
from config import get_settings
from context_lineage import bind_context_artifacts
from database import (
    AnalysisContextRecord,
    Issuer,
    IssuerReportingProfile,
    ModelCheckpoint,
    ModelDraftV2,
    ModelOverrideEvent,
    ModelWorkbookImport,
    ModuleOutput,
    Run,
    get_db,
)
from identity import CallerIdentity, get_identity, require_write_role
from lineage_service import write_lineage_edge
from model_engine_v2 import (
    ENGINE_VERSION,
    CellOverride,
    ModelCalculation,
    ModelDraftPayload,
    calculate_model,
    is_derived_override_node,
)
from model_service import (
    ModelCheckpointError,
    ModelSourceError,
    calculation_node,
    model_v2_checkpoint_snapshot,
    payload_from_cp1,
    remove_active_override,
    replace_active_override,
)
from tenancy import require_issuer, require_run_access


def require_model_engine_v2() -> None:
    settings = get_settings()
    if not settings.caos_model_engine_v2_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    if not settings.caos_lineage_v2_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Model Engine v2 requires CAOS_LINEAGE_V2_ENABLED.",
        )


router = APIRouter(dependencies=[Depends(require_model_engine_v2)])
_MAX_DRAFT_BYTES = 5_000_000
_MUTATIONS_PER_MINUTE = 60
_CALCULATIONS_PER_MINUTE = 20
_KEEP_SOURCE_RUN = object()


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ModelDraftV2Out(BaseModel):
    id: str
    issuer_id: str
    analyst_id: str
    context_id: Optional[str]
    source_run_id: Optional[str]
    payload: ModelDraftPayload
    calculation: ModelCalculation
    source_fingerprint: str
    input_fingerprint: str
    engine_version: str
    calculation_hash: str
    revision: int
    created_at: datetime
    updated_at: datetime


class ModelDraftReadOut(BaseModel):
    authority: Literal["model-engine-v2"] = "model-engine-v2"
    record: Optional[ModelDraftV2Out] = None
    suggested_payload: Optional[ModelDraftPayload] = None
    suggested_calculation: Optional[ModelCalculation] = None
    suggested_source_run_id: Optional[str] = None
    current_calculation: Optional[ModelCalculation] = None
    requires_recalculation: bool = False
    availability: Literal["saved", "suggested", "unavailable", "insufficient_source"]
    detail: Optional[str] = None


class ModelCalculateBody(StrictRequest):
    payload: ModelDraftPayload
    context_id: Optional[str] = Field(default=None, max_length=36)
    source_run_id: Optional[str] = Field(default=None, max_length=64)


class ModelSaveBody(ModelCalculateBody):
    expected_revision: int = Field(ge=0)


class OverrideMutationBody(StrictRequest):
    expected_revision: int = Field(ge=1)
    action: Literal["set", "reset"]
    override: Optional[CellOverride] = None
    node_id: Optional[str] = Field(default=None, min_length=3, max_length=300)


class OverrideReplayBody(StrictRequest):
    expected_revision: int = Field(ge=1)
    mode: Literal["undo", "redo"]


class OverrideBatchMutation(StrictRequest):
    action: Literal["set", "reset"]
    override: Optional[CellOverride] = None
    node_id: Optional[str] = Field(default=None, min_length=3, max_length=300)


class OverrideBatchBody(StrictRequest):
    expected_revision: int = Field(ge=1)
    mutations: list[OverrideBatchMutation] = Field(min_length=1, max_length=500)


class OverrideEventOut(BaseModel):
    id: str
    draft_id: str
    action: str
    node_id: str
    value_type: str
    before_value: Optional[dict]
    after_value: Optional[dict]
    original_formula: Optional[str]
    original_value: Optional[dict]
    reason: Optional[str]
    scope: str
    source: Optional[str]
    actor_id: str
    expires_at: Optional[datetime]
    revision: int
    inverse_event_id: Optional[str]
    created_at: datetime


class V2CheckpointCreate(StrictRequest):
    context_id: str = Field(min_length=1, max_length=36)
    label: str = Field(default="Analyst checkpoint", min_length=1, max_length=160)
    issuer_run_id: Optional[str] = Field(default=None, max_length=64)
    parent_checkpoint_id: Optional[str] = Field(default=None, max_length=36)
    expected_revision: int = Field(ge=1)
    calculation_hash: str = Field(min_length=64, max_length=64)


class V2CheckpointRestore(StrictRequest):
    expected_revision: int = Field(ge=0)


class V2CheckpointOut(BaseModel):
    id: str
    issuer_id: str
    context_id: str
    issuer_run_id: Optional[str]
    parent_checkpoint_id: Optional[str]
    label: str
    payload_hash: str
    engine_version: str
    source_fingerprint: str
    input_fingerprint: str
    calculation_hash: str
    draft_revision: int
    created_at: datetime


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _draft_out(row: ModelDraftV2) -> ModelDraftV2Out:
    try:
        payload = ModelDraftPayload.model_validate(row.payload or {})
        calculation = ModelCalculation.model_validate(row.calculation or {})
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Stored Model Engine v2 draft failed contract validation.",
        ) from exc
    return ModelDraftV2Out(
        id=row.id,
        issuer_id=row.issuer_id,
        analyst_id=row.analyst_id,
        context_id=row.context_id,
        source_run_id=row.source_run_id,
        payload=payload,
        calculation=calculation,
        source_fingerprint=row.source_fingerprint,
        input_fingerprint=row.input_fingerprint,
        engine_version=row.engine_version,
        calculation_hash=row.calculation_hash,
        revision=row.revision,
        created_at=_aware(row.created_at),
        updated_at=_aware(row.updated_at),
    )


def _event_out(row: ModelOverrideEvent) -> OverrideEventOut:
    return OverrideEventOut(
        id=row.id,
        draft_id=row.draft_id,
        action=row.action,
        node_id=row.node_id,
        value_type=row.value_type,
        before_value=row.before_value,
        after_value=row.after_value,
        original_formula=row.original_formula,
        original_value=row.original_value,
        reason=row.reason,
        scope=row.scope,
        source=row.source,
        actor_id=row.actor_id,
        expires_at=_aware(row.expires_at) if row.expires_at else None,
        revision=row.revision,
        inverse_event_id=row.inverse_event_id,
        created_at=_aware(row.created_at),
    )


def _checkpoint_out(row: ModelCheckpoint) -> V2CheckpointOut:
    if not all((
        row.engine_version,
        row.source_fingerprint,
        row.input_fingerprint,
        row.calculation_hash,
        row.draft_revision is not None,
    )):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model checkpoint not found.")
    return V2CheckpointOut(
        id=row.id,
        issuer_id=row.issuer_id,
        context_id=row.context_id,
        issuer_run_id=row.issuer_run_id,
        parent_checkpoint_id=row.parent_checkpoint_id,
        label=row.label,
        payload_hash=row.payload_hash,
        engine_version=str(row.engine_version),
        source_fingerprint=str(row.source_fingerprint),
        input_fingerprint=str(row.input_fingerprint),
        calculation_hash=str(row.calculation_hash),
        draft_revision=int(row.draft_revision),
        created_at=_aware(row.created_at),
    )


async def _authorized_issuer(
    db: AsyncSession, caller: CallerIdentity, issuer_id: str
) -> Issuer:
    return require_issuer(caller, await db.get(Issuer, issuer_id))


async def _owned_draft(
    db: AsyncSession, *, issuer_id: str, analyst_id: str
) -> Optional[ModelDraftV2]:
    return (await db.execute(select(ModelDraftV2).where(
        ModelDraftV2.issuer_id == issuer_id,
        ModelDraftV2.analyst_id == analyst_id,
    ))).scalar_one_or_none()


async def _owned_context(
    db: AsyncSession, *, context_id: str, issuer_id: str, analyst_id: str
) -> AnalysisContextRecord:
    row = (await db.execute(select(AnalysisContextRecord).where(
        AnalysisContextRecord.id == context_id,
        AnalysisContextRecord.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if row is None or issuer_id not in (row.issuer_ids or []):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    return row


async def _owned_run(
    db: AsyncSession, *, run_id: str, issuer_id: str, caller: CallerIdentity
) -> tuple[Run, ModuleOutput, Optional[IssuerReportingProfile]]:
    run = await require_run_access(caller, await db.get(Run, run_id), db)
    if run.issuer_id != issuer_id or run.analyst_id != caller.id or run.status != "complete":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Issuer run not found.")
    cp1 = (await db.execute(select(ModuleOutput).where(
        ModuleOutput.run_id == run.id,
        ModuleOutput.module_id == "CP-1",
    ))).scalar_one_or_none()
    if cp1 is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "The selected run has no CP-1 output.")
    reporting_profile = await db.get(IssuerReportingProfile, issuer_id)
    try:
        payload_from_cp1(run, cp1, reporting_profile=reporting_profile)
    except ModelSourceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return run, cp1, reporting_profile


async def _validate_binding(
    db: AsyncSession,
    *,
    payload: ModelDraftPayload,
    issuer_id: str,
    analyst_id: str,
    caller: CallerIdentity,
    context_id: Optional[str],
    source_run_id: Optional[str],
) -> None:
    if context_id:
        await _owned_context(
            db, context_id=context_id, issuer_id=issuer_id, analyst_id=analyst_id
        )
    origins = {
        authority.origin
        for authority in (
            *[period.authority for period in payload.periods],
            *[instrument.authority for instrument in payload.debt_instruments],
        )
    }
    if "reference" in origins:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Reference-fixture authority is not accepted by Model Engine v2.",
        )
    existing = await _owned_draft(
        db, issuer_id=issuer_id, analyst_id=analyst_id
    )
    existing_payload = (
        ModelDraftPayload.model_validate(existing.payload) if existing is not None else None
    )
    if existing_payload is not None:
        if _payload_base(existing_payload) != _payload_base(payload):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Saved model inputs and authority can change only through audited overrides or workbook import.",
            )
    elif "imported" in origins:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Imported authority can be created only by a committed model workbook.",
        )

    live_inputs = "live" in origins
    if live_inputs and not source_run_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Live model inputs require an exact owned source run.",
        )
    if not live_inputs and source_run_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Analyst or imported model inputs cannot be relabelled with a live source run.",
        )
    if source_run_id:
        run, cp1, reporting_profile = await _owned_run(
            db, run_id=source_run_id, issuer_id=issuer_id, caller=caller
        )
        if live_inputs and run.id not in payload.source_ids:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Live model source IDs do not include the selected run.",
            )
        if live_inputs:
            try:
                expected = payload_from_cp1(
                    run, cp1, reporting_profile=reporting_profile
                )
            except ModelSourceError as exc:
                raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
            expected_live_periods = [
                period.model_dump(mode="json") for period in expected.periods
            ]
            submitted_live_periods = [
                period.model_dump(mode="json")
                for period in payload.periods
                if period.authority.origin == "live"
            ]
            submitted_live_debt = [
                instrument.instrument_id
                for instrument in payload.debt_instruments
                if instrument.authority.origin == "live"
            ]
            if submitted_live_periods != expected_live_periods or submitted_live_debt:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "Live model inputs must match the exact CP-1 binder; debt and forecast inputs must be analyst or imported authority.",
                )


def _payload_base(payload: ModelDraftPayload) -> dict:
    value = payload.model_dump(mode="json")
    value.pop("overrides", None)
    value.pop("ui_preferences", None)
    return value


def _payload_without_ui_preferences(payload: ModelDraftPayload) -> dict:
    value = payload.model_dump(mode="json")
    value.pop("ui_preferences", None)
    return value


def _checkpoint_origin(payload: ModelDraftPayload) -> str:
    origins = {
        authority.origin
        for authority in (
            *[period.authority for period in payload.periods],
            *[instrument.authority for instrument in payload.debt_instruments],
        )
    }
    if "analyst" in origins:
        return "analyst"
    if "imported" in origins:
        return "imported"
    # An empty/insufficient analyst draft has no live authority to inherit.
    # It may still be checkpointed so its named gaps are reviewable, but must
    # never masquerade as a live-derived model.
    return "live" if "live" in origins else "analyst"


def _guard_mutation(caller: CallerIdentity) -> None:
    require_write_role(caller)
    if not rate_limit.hit(
        f"model-v2:{caller.id}",
        max_attempts=_MUTATIONS_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Model mutation rate limit reached.",
        )


def _guard_calculation(caller: CallerIdentity) -> None:
    require_write_role(caller)
    if not rate_limit.hit(
        f"model-v2-calculate:{caller.id}",
        max_attempts=_CALCULATIONS_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Model calculation rate limit reached.",
        )


def _require_future_derived_expiry(override: CellOverride) -> None:
    """Reject a newly-applied derived replacement that is already inactive.

    Stored expired overrides remain valid audit evidence and are ignored by the
    calculator. This gate applies only when a mutation attempts to apply one.
    """

    if not is_derived_override_node(override.node_id):
        return
    expires_at = override.expires_at
    if expires_at is None or expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Derived-cell override expiry must be in the future.",
        )


def _bounded_payload(payload: ModelDraftPayload) -> dict:
    value = payload.model_dump(mode="json")
    try:
        size = len(json.dumps(value, allow_nan=False, separators=(",", ":")))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Model payload is not canonically serializable.",
        ) from exc
    if size > _MAX_DRAFT_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "Model draft is too large.",
        )
    return value


async def _cas_update(
    db: AsyncSession,
    *,
    row: ModelDraftV2,
    expected_revision: int,
    payload: ModelDraftPayload,
    calculation: ModelCalculation,
    context_id: Optional[str] = None,
    source_run_id: Optional[str] | object = _KEEP_SOURCE_RUN,
) -> ModelDraftV2:
    now = datetime.now(timezone.utc)
    statement = (
        update(ModelDraftV2)
        .where(
            ModelDraftV2.id == row.id,
            ModelDraftV2.issuer_id == row.issuer_id,
            ModelDraftV2.analyst_id == row.analyst_id,
            ModelDraftV2.revision == expected_revision,
        )
        .values(
            payload=_bounded_payload(payload),
            calculation=calculation.model_dump(mode="json"),
            source_fingerprint=calculation.source_fingerprint,
            input_fingerprint=calculation.input_fingerprint,
            engine_version=calculation.engine_version,
            calculation_hash=calculation.calculation_hash,
            revision=expected_revision + 1,
            context_id=context_id if context_id is not None else row.context_id,
            source_run_id=(
                row.source_run_id
                if source_run_id is _KEEP_SOURCE_RUN
                else source_run_id
            ),
            updated_at=now,
        )
        .returning(ModelDraftV2)
    )
    changed = (await db.execute(statement)).scalar_one_or_none()
    if changed is None:
        current = await _owned_draft(
            db, issuer_id=row.issuer_id, analyst_id=row.analyst_id
        )
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model draft changed elsewhere.",
            "current_revision": current.revision if current else None,
        })
    return changed


async def _reserve_draft_for_checkpoint(
    db: AsyncSession,
    *,
    row: ModelDraftV2,
    expected_revision: int,
    calculation_hash: str,
) -> int:
    """Conditionally lock the exact draft envelope until checkpoint commit.

    The conditional UPDATE advances the integer revision while taking the row
    lock on Postgres (and write-serializing on SQLite). It closes the gap
    between the initial revision check and binding the resulting checkpoint as
    active in the analysis context; a concurrent edit based on the pre-checkpoint
    revision must retry rather than silently superseding the new active snapshot.
    """

    checkpoint_revision = expected_revision + 1
    reserved = (await db.execute(
        update(ModelDraftV2)
        .where(
            ModelDraftV2.id == row.id,
            ModelDraftV2.issuer_id == row.issuer_id,
            ModelDraftV2.analyst_id == row.analyst_id,
            ModelDraftV2.revision == expected_revision,
            ModelDraftV2.calculation_hash == calculation_hash,
            ModelDraftV2.engine_version == row.engine_version,
            ModelDraftV2.source_fingerprint == row.source_fingerprint,
            ModelDraftV2.input_fingerprint == row.input_fingerprint,
        )
        .values(
            revision=checkpoint_revision,
            updated_at=datetime.now(timezone.utc),
        )
        .returning(ModelDraftV2.revision)
    )).scalar_one_or_none()
    if reserved is None:
        current = await _owned_draft(
            db, issuer_id=row.issuer_id, analyst_id=row.analyst_id
        )
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model draft changed before checkpoint creation.",
            "current_revision": current.revision if current else None,
            "current_calculation_hash": (
                current.calculation_hash if current else None
            ),
        })
    return int(reserved)


async def _create_or_update(
    db: AsyncSession,
    *,
    issuer_id: str,
    caller: CallerIdentity,
    body: ModelSaveBody,
    allow_initial_overrides: bool = False,
) -> ModelDraftV2:
    bounded_payload = _bounded_payload(body.payload)
    calculation = calculate_model(body.payload)
    existing = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if existing is None:
        if body.expected_revision != 0:
            raise HTTPException(status.HTTP_409_CONFLICT, {
                "message": "Model draft does not exist at that revision.",
                "current_revision": None,
            })
        if body.payload.overrides and not allow_initial_overrides:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Initial drafts cannot inject overrides; save the base draft, then use the audited override API.",
            )
        now = datetime.now(timezone.utc)
        row = ModelDraftV2(
            issuer_id=issuer_id,
            analyst_id=caller.id,
            context_id=body.context_id,
            source_run_id=body.source_run_id,
            payload=bounded_payload,
            calculation=calculation.model_dump(mode="json"),
            source_fingerprint=calculation.source_fingerprint,
            input_fingerprint=calculation.input_fingerprint,
            engine_version=calculation.engine_version,
            calculation_hash=calculation.calculation_hash,
            revision=1,
            created_at=now,
            updated_at=now,
        )
        try:
            async with db.begin_nested():
                db.add(row)
                await db.flush()
        except IntegrityError as exc:
            current = await _owned_draft(
                db, issuer_id=issuer_id, analyst_id=caller.id
            )
            raise HTTPException(status.HTTP_409_CONFLICT, {
                "message": "Model draft was created elsewhere.",
                "current_revision": current.revision if current else None,
            }) from exc
        return row
    if body.expected_revision == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model draft already exists.",
            "current_revision": existing.revision,
        })
    stored_payload = ModelDraftPayload.model_validate(existing.payload)
    if _payload_without_ui_preferences(body.payload) != _payload_without_ui_preferences(
        stored_payload
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Saved model cells and overrides can change only through audited override or workbook-import APIs.",
        )
    return await _cas_update(
        db,
        row=existing,
        expected_revision=body.expected_revision,
        payload=body.payload,
        calculation=calculation,
        context_id=body.context_id,
        source_run_id=body.source_run_id,
    )


@router.get("/v2/{issuer_id}", response_model=ModelDraftReadOut)
async def get_model_v2(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _authorized_issuer(db, caller, issuer_id)
    row = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if row is not None:
        record = _draft_out(row)
        current = calculate_model(
            record.payload, evaluated_at=datetime.now(timezone.utc)
        )
        requires_recalculation = (
            current.calculation_hash != record.calculation_hash
            or current.source_fingerprint != record.source_fingerprint
            or current.input_fingerprint != record.input_fingerprint
            or current.engine_version != record.engine_version
        )
        return ModelDraftReadOut(
            record=record,
            current_calculation=current if requires_recalculation else None,
            requires_recalculation=requires_recalculation,
            availability="saved",
            detail=(
                "An override expired or the saved calculation is stale; recalculate and save before checkpoint or export."
                if requires_recalculation
                else None
            ),
        )
    run = (await db.execute(select(Run).where(
        Run.issuer_id == issuer_id,
        Run.analyst_id == caller.id,
        Run.status == "complete",
    ).order_by(Run.completed_at.desc(), Run.created_at.desc()).limit(1))).scalar_one_or_none()
    if run is None:
        return ModelDraftReadOut(
            availability="unavailable", detail="No completed owned issuer run is available."
        )
    cp1 = (await db.execute(select(ModuleOutput).where(
        ModuleOutput.run_id == run.id,
        ModuleOutput.module_id == "CP-1",
    ))).scalar_one_or_none()
    if cp1 is None:
        return ModelDraftReadOut(
            availability="insufficient_source", detail="The latest run has no CP-1 output."
        )
    reporting_profile = await db.get(IssuerReportingProfile, issuer_id)
    try:
        payload = payload_from_cp1(
            run, cp1, reporting_profile=reporting_profile
        )
    except ModelSourceError as exc:
        return ModelDraftReadOut(availability="insufficient_source", detail=str(exc))
    return ModelDraftReadOut(
        suggested_payload=payload,
        suggested_calculation=calculate_model(payload),
        suggested_source_run_id=run.id,
        availability="suggested",
    )


@router.post("/v2/{issuer_id}/calculate", response_model=ModelCalculation)
async def calculate_model_v2(
    issuer_id: str,
    body: ModelCalculateBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard_calculation(caller)
    _bounded_payload(body.payload)
    await _authorized_issuer(db, caller, issuer_id)
    await _validate_binding(
        db,
        payload=body.payload,
        issuer_id=issuer_id,
        analyst_id=caller.id,
        caller=caller,
        context_id=body.context_id,
        source_run_id=body.source_run_id,
    )
    return calculate_model(body.payload)


@router.put("/v2/{issuer_id}", response_model=ModelDraftV2Out)
async def put_model_v2(
    issuer_id: str,
    body: ModelSaveBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard_mutation(caller)
    _bounded_payload(body.payload)
    await _authorized_issuer(db, caller, issuer_id)
    await _validate_binding(
        db,
        payload=body.payload,
        issuer_id=issuer_id,
        analyst_id=caller.id,
        caller=caller,
        context_id=body.context_id,
        source_run_id=body.source_run_id,
    )
    return _draft_out(await _create_or_update(
        db, issuer_id=issuer_id, caller=caller, body=body
    ))


@router.get("/v2/{issuer_id}/history", response_model=list[OverrideEventOut])
async def list_model_v2_history(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _authorized_issuer(db, caller, issuer_id)
    draft = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if draft is None:
        return []
    rows = (await db.execute(select(ModelOverrideEvent).where(
        ModelOverrideEvent.draft_id == draft.id,
        ModelOverrideEvent.analyst_id == caller.id,
    ).order_by(
        ModelOverrideEvent.revision.desc(),
        ModelOverrideEvent.created_at.desc(),
        ModelOverrideEvent.id.desc(),
    ).limit(500))).scalars().all()
    return [_event_out(row) for row in rows]


@router.post("/v2/{issuer_id}/overrides", response_model=ModelDraftV2Out)
async def mutate_model_v2_override(
    issuer_id: str,
    body: OverrideMutationBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard_mutation(caller)
    await _authorized_issuer(db, caller, issuer_id)
    draft = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if draft is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model draft not found.")
    if draft.revision != body.expected_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model draft changed elsewhere.",
            "current_revision": draft.revision,
        })
    payload = ModelDraftPayload.model_validate(draft.payload)
    before_calculation = calculate_model(payload)
    if body.action == "set":
        if body.override is None or body.node_id is not None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Set requires override only.")
        _require_future_derived_expiry(body.override)
        target = body.override.node_id
        try:
            original_node = calculation_node(before_calculation, target)
            next_payload, prior = replace_active_override(payload, body.override)
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
        applied = body.override
    else:
        if body.override is not None or body.node_id is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Reset requires node_id only.")
        target = body.node_id
        try:
            original_node = calculation_node(before_calculation, target)
            next_payload, prior = remove_active_override(payload, target)
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
        if prior is None:
            raise HTTPException(status.HTTP_409_CONFLICT, "That cell has no active override.")
        applied = None
    after_calculation = calculate_model(next_payload)
    changed = await _cas_update(
        db,
        row=draft,
        expected_revision=body.expected_revision,
        payload=next_payload,
        calculation=after_calculation,
    )
    event = ModelOverrideEvent(
        draft_id=draft.id,
        issuer_id=issuer_id,
        analyst_id=caller.id,
        action=body.action,
        node_id=target,
        value_type=applied.value_type if applied else prior.value_type,
        before_value=prior.model_dump(mode="json") if prior else None,
        after_value=applied.model_dump(mode="json") if applied else None,
        original_formula=original_node.get("formula"),
        original_value={"value": original_node.get("original_value")},
        reason=applied.reason if applied else prior.reason,
        scope=applied.scope if applied else prior.scope,
        source=applied.source if applied else prior.source,
        actor_id=caller.id,
        expires_at=applied.expires_at if applied else prior.expires_at,
        revision=changed.revision,
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()
    return _draft_out(changed)


@router.post("/v2/{issuer_id}/overrides/batch", response_model=ModelDraftV2Out)
async def mutate_model_v2_overrides_batch(
    issuer_id: str,
    body: OverrideBatchBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Commit a local edit set as one revision and one audit transaction."""
    _guard_mutation(caller)
    await _authorized_issuer(db, caller, issuer_id)
    draft = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if draft is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model draft not found.")
    if draft.revision != body.expected_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model draft changed elsewhere.",
            "current_revision": draft.revision,
        })
    targets = [
        mutation.override.node_id if mutation.override is not None else mutation.node_id
        for mutation in body.mutations
    ]
    if any(target is None for target in targets) or len(set(targets)) != len(targets):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A batch must contain one valid mutation per unique model node.",
        )

    payload = ModelDraftPayload.model_validate(draft.payload)
    event_specs: list[dict] = []
    for mutation in body.mutations:
        before_calculation = calculate_model(payload)
        if mutation.action == "set":
            if mutation.override is None or mutation.node_id is not None:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "Set requires override only.",
                )
            _require_future_derived_expiry(mutation.override)
            target = mutation.override.node_id
            try:
                original_node = calculation_node(before_calculation, target)
                next_payload, prior = replace_active_override(
                    payload, mutation.override
                )
            except ValueError as exc:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)
                ) from exc
            applied = mutation.override
        else:
            if mutation.override is not None or mutation.node_id is None:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "Reset requires node_id only.",
                )
            target = mutation.node_id
            try:
                original_node = calculation_node(before_calculation, target)
                next_payload, prior = remove_active_override(payload, target)
            except ValueError as exc:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)
                ) from exc
            if prior is None:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"The cell {target} has no active override.",
                )
            applied = None
        event_specs.append({
            "action": mutation.action,
            "node_id": target,
            "prior": prior,
            "applied": applied,
            "original_node": original_node,
        })
        payload = next_payload

    calculation = calculate_model(payload)
    changed = await _cas_update(
        db,
        row=draft,
        expected_revision=body.expected_revision,
        payload=payload,
        calculation=calculation,
    )
    now = datetime.now(timezone.utc)
    for spec in event_specs:
        prior = spec["prior"]
        applied = spec["applied"]
        value = applied or prior
        db.add(ModelOverrideEvent(
            draft_id=draft.id,
            issuer_id=issuer_id,
            analyst_id=caller.id,
            action=spec["action"],
            node_id=spec["node_id"],
            value_type=value.value_type,
            before_value=prior.model_dump(mode="json") if prior else None,
            after_value=applied.model_dump(mode="json") if applied else None,
            original_formula=spec["original_node"].get("formula"),
            original_value={"value": spec["original_node"].get("original_value")},
            reason=value.reason,
            scope=value.scope,
            source=value.source,
            actor_id=caller.id,
            expires_at=value.expires_at,
            revision=changed.revision,
            created_at=now,
        ))
    await db.flush()
    return _draft_out(changed)


@router.post("/v2/{issuer_id}/history/{event_id}/replay", response_model=ModelDraftV2Out)
async def replay_model_v2_event(
    issuer_id: str,
    event_id: str,
    body: OverrideReplayBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard_mutation(caller)
    await _authorized_issuer(db, caller, issuer_id)
    draft = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    event = await db.get(ModelOverrideEvent, event_id)
    if (
        draft is None
        or event is None
        or event.draft_id != draft.id
        or event.analyst_id != caller.id
        or event.issuer_id != issuer_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model history event not found.")
    if draft.revision != body.expected_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model draft changed elsewhere.",
            "current_revision": draft.revision,
        })
    payload = ModelDraftPayload.model_validate(draft.payload)
    if event.action in {"undo", "redo"} and event.inverse_event_id:
        original = await db.get(ModelOverrideEvent, event.inverse_event_id)
        if (
            original is None
            or original.draft_id != draft.id
            or original.analyst_id != caller.id
            or original.issuer_id != issuer_id
        ):
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Model history event not found.",
            )
        event = original
    original_actions = {"set", "reset", "import_set", "import_reset"}
    if event.action not in original_actions:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "This history event is not a replayable cell override.",
        )
    source_events = (await db.execute(select(ModelOverrideEvent).where(
        ModelOverrideEvent.draft_id == draft.id,
        ModelOverrideEvent.analyst_id == caller.id,
        ModelOverrideEvent.issuer_id == issuer_id,
        ModelOverrideEvent.revision == event.revision,
        ModelOverrideEvent.action.in_(original_actions),
    ).order_by(ModelOverrideEvent.id.asc()))).scalars().all()
    if not source_events or len({item.node_id for item in source_events}) != len(source_events):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The committed override revision has an invalid audit group.",
        )
    current_calculation = calculate_model(payload)
    event_specs: list[tuple[ModelOverrideEvent, Optional[CellOverride], Optional[CellOverride]]] = []
    next_payload = payload
    for source_event in source_events:
        try:
            calculation_node(current_calculation, source_event.node_id)
        except ValueError as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)
            ) from exc
        desired = (
            source_event.before_value
            if body.mode == "undo"
            else source_event.after_value
        )
        prior = next(
            (
                item for item in next_payload.overrides
                if item.node_id == source_event.node_id
            ),
            None,
        )
        current_value = prior.model_dump(mode="json") if prior else None
        expected_current = (
            source_event.after_value
            if body.mode == "undo"
            else source_event.before_value
        )
        if current_value != expected_current:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The committed override revision is no longer the current cell state.",
            )
        if desired is None:
            try:
                next_payload, _ = remove_active_override(
                    next_payload, source_event.node_id
                )
            except ValueError as exc:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)
                ) from exc
            applied = None
        else:
            try:
                applied = CellOverride.model_validate(desired)
            except ValidationError as exc:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "The history event does not contain a valid typed cell override.",
                ) from exc
            try:
                next_payload, _ = replace_active_override(next_payload, applied)
            except ValueError as exc:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)
                ) from exc
        event_specs.append((source_event, prior, applied))
    calculation = calculate_model(next_payload)
    changed = await _cas_update(
        db,
        row=draft,
        expected_revision=body.expected_revision,
        payload=next_payload,
        calculation=calculation,
    )
    now = datetime.now(timezone.utc)
    for source_event, prior, applied in event_specs:
        db.add(ModelOverrideEvent(
            draft_id=draft.id,
            issuer_id=issuer_id,
            analyst_id=caller.id,
            action=body.mode,
            node_id=source_event.node_id,
            value_type=applied.value_type if applied else source_event.value_type,
            before_value=prior.model_dump(mode="json") if prior else None,
            after_value=applied.model_dump(mode="json") if applied else None,
            original_formula=source_event.original_formula,
            original_value=source_event.original_value,
            reason=f"{body.mode} of revision {source_event.revision} event {source_event.id}",
            scope=applied.scope if applied else source_event.scope,
            source=applied.source if applied else source_event.source,
            actor_id=caller.id,
            expires_at=applied.expires_at if applied else None,
            revision=changed.revision,
            inverse_event_id=source_event.id,
            created_at=now,
        ))
    await db.flush()
    return _draft_out(changed)


@router.get("/v2/{issuer_id}/checkpoints", response_model=list[V2CheckpointOut])
async def list_model_v2_checkpoints(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _authorized_issuer(db, caller, issuer_id)
    rows = (await db.execute(select(ModelCheckpoint).where(
        ModelCheckpoint.issuer_id == issuer_id,
        ModelCheckpoint.analyst_id == caller.id,
        ModelCheckpoint.engine_version == ENGINE_VERSION,
    ).order_by(ModelCheckpoint.created_at.desc()).limit(100))).scalars().all()
    return [_checkpoint_out(row) for row in rows]


@router.post(
    "/v2/{issuer_id}/checkpoints",
    response_model=V2CheckpointOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_model_v2_checkpoint(
    issuer_id: str,
    body: V2CheckpointCreate,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard_mutation(caller)
    await _authorized_issuer(db, caller, issuer_id)
    context = await _owned_context(
        db, context_id=body.context_id, issuer_id=issuer_id, analyst_id=caller.id
    )
    draft = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if draft is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Save the v2 draft before checkpointing.")
    if draft.revision != body.expected_revision or draft.calculation_hash != body.calculation_hash:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model draft changed before checkpoint creation.",
            "current_revision": draft.revision,
            "current_calculation_hash": draft.calculation_hash,
        })
    # One clock instant owns expiry evaluation, the frozen calculation, and the
    # checkpoint timestamp so a boundary override cannot create an unpublishable
    # envelope.
    evaluation_time = datetime.now(timezone.utc)
    draft_payload = ModelDraftPayload.model_validate(draft.payload)
    current_calculation = calculate_model(
        draft_payload,
        evaluated_at=evaluation_time,
    )
    if (
        current_calculation.calculation_hash != draft.calculation_hash
        or current_calculation.source_fingerprint != draft.source_fingerprint
        or current_calculation.input_fingerprint != draft.input_fingerprint
        or current_calculation.engine_version != draft.engine_version
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Model calculation is stale; recalculate and save before checkpointing.",
            "current_revision": draft.revision,
            "current_calculation_hash": current_calculation.calculation_hash,
        })
    if body.issuer_run_id is not None and body.issuer_run_id != draft.source_run_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Checkpoint run must match the draft's exact source run.",
        )
    checkpoint_run_id = draft.source_run_id
    if checkpoint_run_id:
        await _owned_run(
            db, run_id=checkpoint_run_id, issuer_id=issuer_id, caller=caller
        )
    if body.parent_checkpoint_id:
        parent = await db.get(ModelCheckpoint, body.parent_checkpoint_id)
        if (
            parent is None
            or parent.analyst_id != caller.id
            or parent.issuer_id != issuer_id
            or parent.context_id != context.id
            or parent.engine_version != ENGINE_VERSION
        ):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent checkpoint not found.")
    else:
        parent = None
    # From this point until the request transaction commits, an override CAS
    # cannot advance the draft underneath the checkpoint/context publication.
    checkpoint_revision = await _reserve_draft_for_checkpoint(
        db,
        row=draft,
        expected_revision=body.expected_revision,
        calculation_hash=body.calculation_hash,
    )
    frozen = {
        "version": 2,
        "draft_id": draft.id,
        "draft_revision": checkpoint_revision,
        "payload": draft_payload.model_dump(mode="json"),
        "calculation": current_calculation.model_dump(mode="json"),
    }
    canonical = json.dumps(
        frozen, sort_keys=True, separators=(",", ":"), allow_nan=False, default=str
    )
    payload_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    now = evaluation_time
    active_sources = set(draft_payload.source_ids)
    for period in draft_payload.periods:
        active_sources.update(period.authority.source_ids)
    for instrument in draft_payload.debt_instruments:
        active_sources.update(instrument.sources)
        active_sources.update(instrument.authority.source_ids)
    model_origin = _checkpoint_origin(draft_payload)
    row = ModelCheckpoint(
        issuer_id=issuer_id,
        analyst_id=caller.id,
        context_id=context.id,
        issuer_run_id=checkpoint_run_id,
        parent_checkpoint_id=body.parent_checkpoint_id,
        label=body.label.strip(),
        payload_hash=payload_hash,
        payload=frozen,
        engine_version=draft.engine_version,
        source_fingerprint=draft.source_fingerprint,
        input_fingerprint=draft.input_fingerprint,
        calculation_hash=draft.calculation_hash,
        draft_revision=checkpoint_revision,
        authority={
            "origin": model_origin,
            "method": "modelled",
            "freshness": "unknown",
            "as_of": now.isoformat(),
            "source_ids": sorted(active_sources),
            "run_id": checkpoint_run_id,
            "version_id": None,
            "confidence": None,
            "approval_state": "draft",
            "analyst_override": bool(draft_payload.overrides),
            "model_input_origins": sorted({
                authority.origin
                for authority in (
                    *[period.authority for period in draft_payload.periods],
                    *[instrument.authority for instrument in draft_payload.debt_instruments],
                )
            }),
            "engine_version": draft.engine_version,
            "source_fingerprint": draft.source_fingerprint,
            "input_fingerprint": draft.input_fingerprint,
            "calculation_hash": draft.calculation_hash,
            "draft_revision": checkpoint_revision,
        },
        created_at=now,
    )
    try:
        model_v2_checkpoint_snapshot(row)
    except ModelCheckpointError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    db.add(row)
    await db.flush()
    row.authority = {**row.authority, "version_id": row.id}
    checkpoint_ref = ArtifactRef(
        kind="model_checkpoint", id=row.id, version=row.payload_hash
    )
    refs = [checkpoint_ref]
    run_id = checkpoint_run_id
    if run_id:
        refs.append(ArtifactRef(kind="issuer_run", id=run_id))
    if parent is not None:
        refs.append(ArtifactRef(
            kind="model_checkpoint", id=parent.id, version=parent.payload_hash
        ))
    latest_import = None
    if active_sources:
        latest_import = (await db.execute(select(ModelWorkbookImport).where(
            ModelWorkbookImport.draft_id == draft.id,
            ModelWorkbookImport.analyst_id == caller.id,
            ModelWorkbookImport.committed_revision <= checkpoint_revision,
            ModelWorkbookImport.source_manifest_id.in_(active_sources),
            ModelWorkbookImport.document_id.in_(active_sources),
        ).order_by(ModelWorkbookImport.committed_at.desc()).limit(1))).scalar_one_or_none()
    if latest_import is not None:
        refs.append(ArtifactRef(kind="source_manifest", id=latest_import.source_manifest_id))
    legacy_updates = {"model_checkpoint_id": row.id}
    if run_id:
        legacy_updates["issuer_run_id"] = run_id
    await bind_context_artifacts(
        db,
        context_id=context.id,
        analyst_id=caller.id,
        refs=refs,
        legacy_updates=legacy_updates,
    )
    for parent_ref in refs[1:]:
        await write_lineage_edge(
            db,
            context_id=context.id,
            analyst_id=caller.id,
            artifact=checkpoint_ref,
            parent=parent_ref,
            transform="model-checkpoint-v2",
            transform_version=ENGINE_VERSION,
            enabled=True,
        )
    await db.flush()
    return _checkpoint_out(row)


@router.post(
    "/v2/{issuer_id}/checkpoints/{checkpoint_id}/restore",
    response_model=ModelDraftV2Out,
)
async def restore_model_v2_checkpoint(
    issuer_id: str,
    checkpoint_id: str,
    body: V2CheckpointRestore,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard_mutation(caller)
    await _authorized_issuer(db, caller, issuer_id)
    checkpoint = await db.get(ModelCheckpoint, checkpoint_id)
    if (
        checkpoint is None
        or checkpoint.analyst_id != caller.id
        or checkpoint.issuer_id != issuer_id
        or checkpoint.engine_version != ENGINE_VERSION
        or not isinstance(checkpoint.payload, dict)
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model checkpoint not found.")
    try:
        snapshot = model_v2_checkpoint_snapshot(checkpoint)
    except ModelCheckpointError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    payload = ModelDraftPayload.model_validate(snapshot["payload"])
    calculation = calculate_model(payload, evaluated_at=datetime.now(timezone.utc))
    draft = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if draft is None:
        body_for_create = ModelSaveBody(
            expected_revision=body.expected_revision,
            payload=payload,
            context_id=checkpoint.context_id,
            source_run_id=checkpoint.issuer_run_id,
        )
        changed = await _create_or_update(
            db,
            issuer_id=issuer_id,
            caller=caller,
            body=body_for_create,
            allow_initial_overrides=True,
        )
    else:
        changed = await _cas_update(
            db,
            row=draft,
            expected_revision=body.expected_revision,
            payload=payload,
            calculation=calculation,
            context_id=checkpoint.context_id,
            source_run_id=checkpoint.issuer_run_id,
        )
    event = ModelOverrideEvent(
        draft_id=changed.id,
        issuer_id=issuer_id,
        analyst_id=caller.id,
        action="restore",
        node_id=f"checkpoint:{checkpoint.id}",
        value_type="null",
        before_value={"calculation_hash": draft.calculation_hash} if draft else None,
        after_value={"calculation_hash": changed.calculation_hash},
        original_formula=None,
        original_value=None,
        reason=f"Restore checkpoint {checkpoint.label}",
        scope="draft",
        source=checkpoint.id,
        actor_id=caller.id,
        expires_at=None,
        revision=changed.revision,
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()
    return _draft_out(changed)
