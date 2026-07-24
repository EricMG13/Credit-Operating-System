"""Secure preview/commit/export boundary for Model Engine v2 workbooks."""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import avscan
import ingest
import model_storage
import rate_limit
from analysis_contracts import ArtifactRef
from config import get_settings
from database import (
    Document,
    ModelDraftV2,
    ModelOverrideEvent,
    ModelWorkbookImport,
    SourceManifest,
    get_db,
)
from identity import CallerIdentity, get_identity, require_write_role
from lineage_service import write_owned_artifact_lineage_edge
from model_engine_v2 import (
    ModelAuthority,
    ModelCalculation,
    ModelDraftPayload,
    calculate_model,
)
from model_service import calculation_node
from model_workbook import (
    MAX_MODEL_FILE_BYTES,
    ModelWorkbookError,
    ModelWorkbookPreview,
    WorkbookIssue,
    parse_mapping,
    preview_workbook,
    render_model_workbook,
)
from routes.model_v2 import (
    ModelDraftV2Out,
    _authorized_issuer,
    _bounded_payload,
    _cas_update,
    _draft_out,
    _owned_draft,
    require_model_engine_v2,
)


router = APIRouter(dependencies=[Depends(require_model_engine_v2)])

_MAPPING_MAX_CHARS = 250_000
_MAX_FILENAME_CHARS = 240
_TOKEN_TTL_SECONDS = 15 * 60
_PREVIEWS_PER_MINUTE = 12
_preview_sem: asyncio.Semaphore | None = None
_IDENTITY_NAMESPACE = uuid.UUID("f9a76cf5-5054-4df9-8ce6-3575e75c2af2")


class ModelWorkbookPreviewOut(ModelWorkbookPreview):
    preview_token: Optional[str] = None
    expected_revision: int


class ModelWorkbookCommitOut(BaseModel):
    existing: bool
    import_id: str
    document_id: str
    source_manifest_id: str
    workbook_sha256: str
    import_fingerprint: str
    committed_revision: int
    calculation_hash: str
    record: ModelDraftV2Out


def _semaphore() -> asyncio.Semaphore:
    global _preview_sem
    if _preview_sem is None:
        _preview_sem = asyncio.Semaphore(
            max(1, int(getattr(get_settings(), "caos_upload_concurrency", 2)))
        )
    return _preview_sem


def _guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"model-workbook:{caller.id}",
        max_attempts=_PREVIEWS_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Model workbook request rate limit reached.",
        )


def _mapping_json(raw: str) -> tuple[Any, dict[str, Any]]:
    if len(raw) > _MAPPING_MAX_CHARS:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "Model workbook mapping is too large.",
        )
    try:
        parsed = parse_mapping(raw or None)
    except ModelWorkbookError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {"code": exc.code, "message": exc.message},
        ) from exc
    return parsed, parsed.model_dump(mode="json") if parsed else {}


def _mapping_digest(mapping: dict[str, Any]) -> str:
    canonical = json.dumps(mapping, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _import_fingerprint(
    *,
    analyst_id: str,
    issuer_id: str,
    workbook_sha256: str,
    mapping: dict[str, Any],
    expected_revision: int,
) -> str:
    canonical = json.dumps(
        {
            "analyst_id": analyst_id,
            "issuer_id": issuer_id,
            "workbook_sha256": workbook_sha256,
            "mapping": mapping,
            # One preview may be retried safely, while a deliberate re-import after
            # later model edits remains a new CAS mutation rather than silently
            # returning the ledger entry for an older revision.
            "expected_revision": expected_revision,
        },
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _artifact_id(fingerprint: str, kind: str) -> str:
    """Derive stable preview artifact IDs so equivalent previews converge exactly."""

    return str(uuid.uuid5(_IDENTITY_NAMESPACE, f"{kind}:{fingerprint}"))


def _sign_token(payload: dict[str, Any]) -> str:
    raw = (
        base64.urlsafe_b64encode(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        )
        .decode("ascii")
        .rstrip("=")
    )
    signature = hmac.new(
        get_settings().session_secret.encode("utf-8"),
        raw.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{raw}.{signature}"


def _read_token(
    token: str,
    *,
    caller_id: str,
    issuer_id: str,
    workbook_sha256: str,
    mapping: dict[str, Any],
    expected_revision: int,
) -> dict[str, Any]:
    if not token or len(token) > 4_096:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Preview token is invalid; preview again."
        )
    try:
        raw, presented = token.rsplit(".", 1)
        expected = hmac.new(
            get_settings().session_secret.encode("utf-8"),
            raw.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(presented, expected):
            raise ValueError("signature")
        decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        payload = json.loads(decoded)
        if not isinstance(payload, dict):
            raise ValueError("payload")
    except (
        AttributeError,
        ValueError,
        TypeError,
        UnicodeError,
        binascii.Error,
        json.JSONDecodeError,
    ) as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Preview token is invalid; preview again.",
        ) from exc
    checks = (
        hmac.compare_digest(str(payload.get("analyst_id") or ""), caller_id),
        hmac.compare_digest(str(payload.get("issuer_id") or ""), issuer_id),
        hmac.compare_digest(str(payload.get("workbook_sha256") or ""), workbook_sha256),
        hmac.compare_digest(
            str(payload.get("mapping_digest") or ""), _mapping_digest(mapping)
        ),
        payload.get("expected_revision") == expected_revision,
        hmac.compare_digest(
            str(payload.get("import_fingerprint") or ""),
            _import_fingerprint(
                analyst_id=caller_id,
                issuer_id=issuer_id,
                workbook_sha256=workbook_sha256,
                mapping=mapping,
                expected_revision=expected_revision,
            ),
        ),
        isinstance(payload.get("exp"), int) and time.time() <= payload["exp"],
    )
    if not all(checks):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Preview token is stale or does not match this commit; preview again.",
        )
    return payload


def _require_token_live(token: dict[str, Any]) -> None:
    exp = token.get("exp")
    if not isinstance(exp, int) or time.time() > exp:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Preview token expired while the workbook was revalidated; preview again.",
        )


def _token_expiration(preview: ModelWorkbookPreview, *, evaluated_at: datetime) -> int:
    """Never let a preview token outlive an override used by its calculation."""

    deadline = evaluated_at.timestamp() + _TOKEN_TTL_SECONDS
    if preview.draft_payload is not None:
        for override in preview.draft_payload.overrides:
            if override.expires_at is None:
                continue
            expires_at = override.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            expires_at = expires_at.astimezone(timezone.utc)
            if expires_at > evaluated_at:
                deadline = min(deadline, expires_at.timestamp())
    return int(deadline)


def _import_authority(
    payload: ModelDraftPayload,
    *,
    document_id: str,
    manifest_id: str,
) -> ModelDraftPayload:
    source_ids = list(dict.fromkeys([*payload.source_ids, document_id, manifest_id]))

    def rebound(authority: ModelAuthority) -> ModelAuthority:
        return ModelAuthority(
            origin="imported",
            method="model-workbook-import",
            source_ids=list(
                dict.fromkeys(
                    [
                        *authority.source_ids,
                        document_id,
                        manifest_id,
                    ]
                )
            ),
            as_of=authority.as_of,
        )

    value = payload.model_dump(mode="json")
    value["source_ids"] = source_ids
    for index, period in enumerate(payload.periods):
        value["periods"][index]["authority"] = rebound(
            period.authority
        ).model_dump(mode="json")
    for index, instrument in enumerate(payload.debt_instruments):
        value["debt_instruments"][index]["authority"] = rebound(
            instrument.authority
        ).model_dump(mode="json")
    # Revalidate the whole bounded payload. model_copy(update=...) would allow
    # provenance injection to exceed source-list or aggregate audit limits and
    # persist an object that fails its next strict read.
    return ModelDraftPayload.model_validate(value)


def _workbook_error(exc: ModelWorkbookError) -> HTTPException:
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        {"code": exc.code, "message": exc.message},
    )


def _validated_filename(raw: Optional[str]) -> str:
    """Return one bounded display/storage leaf name for an untrusted upload."""

    value = raw or ""
    if len(value) > 512 or len(value.encode("utf-8")) > 2_048:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "Model workbook filename is too long.",
        )
    filename = value.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if len(filename) > _MAX_FILENAME_CHARS:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "Model workbook filename is too long.",
        )
    if any(ord(character) < 32 or ord(character) == 127 for character in filename):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Model workbook filename contains unsupported control characters.",
        )
    return filename


def _with_import_authority(
    preview: ModelWorkbookPreview,
    *,
    document_id: str,
    manifest_id: str,
    evaluated_at: datetime,
) -> ModelWorkbookPreview:
    if preview.blocking_count or preview.draft_payload is None:
        return preview
    try:
        payload = _import_authority(
            preview.draft_payload,
            document_id=document_id,
            manifest_id=manifest_id,
        )
    except ValidationError:
        issue = WorkbookIssue(
            severity="blocking",
            code="import_authority_capacity",
            message=(
                "Workbook source lists leave no capacity for the required "
                "document and source-manifest provenance IDs."
            ),
        )
        return ModelWorkbookPreview.model_validate({
            **preview.model_dump(mode="json"),
            "draft_payload": None,
            "calculation": None,
            "issues": [
                *[item.model_dump(mode="json") for item in preview.issues],
                issue.model_dump(mode="json"),
            ],
            "blocking_count": preview.blocking_count + 1,
        })
    calculation = calculate_model(payload, evaluated_at=evaluated_at)
    issue = WorkbookIssue(
        severity="warning",
        code="import_authority_rebound",
        message=(
            "Workbook sources remain in the audit trail, but imported cells are "
            "authoritative as workbook inputs rather than live domain observations."
        ),
    )
    return ModelWorkbookPreview.model_validate({
        **preview.model_dump(mode="json"),
        "draft_payload": payload.model_dump(mode="json"),
        "calculation": calculation.model_dump(mode="json"),
        "issues": [
            *[item.model_dump(mode="json") for item in preview.issues],
            issue.model_dump(mode="json"),
        ],
        "warning_count": preview.warning_count + 1,
    })


def _workbook_identity_claim(preview: ModelWorkbookPreview) -> Optional[dict[str, Any]]:
    """Return the canonical, signed claim for strict-workbook identity metadata."""

    if preview.identity is None:
        return None
    return preview.identity.model_dump(mode="json")


def _bind_workbook_identity(
    preview: ModelWorkbookPreview,
    *,
    issuer_id: str,
    current_revision: Optional[int],
) -> ModelWorkbookPreview:
    """Bind editable strict exports to the target issuer and owned draft revision.

    A fresh target has no current revision, so it may intentionally import a
    strict workbook exported at any positive source revision and starts at local
    revision one. Mapped legacy workbooks have no embedded CAOS identity.
    """

    if preview.mode != "strict_v1" or preview.identity is None:
        return preview
    issues: list[WorkbookIssue] = []
    if preview.identity.issuer_id != issuer_id:
        issues.append(
            WorkbookIssue(
                severity="blocking",
                code="workbook_issuer_mismatch",
                message="Workbook issuer does not match the requested issuer.",
                sheet="Cover",
                field="issuer_id",
            )
        )
    if (
        current_revision is not None
        and preview.identity.draft_revision != current_revision
    ):
        issues.append(
            WorkbookIssue(
                severity="blocking",
                code="workbook_revision_mismatch",
                message="Workbook revision does not match the current owned model draft.",
                sheet="Cover",
                field="draft_revision",
            )
        )
    if not issues:
        return preview
    return preview.model_copy(
        update={
            "draft_payload": None,
            "calculation": None,
            "issues": [*preview.issues, *issues],
            "blocking_count": preview.blocking_count + len(issues),
        }
    )


def _require_token_identity(
    token: dict[str, Any], preview: ModelWorkbookPreview
) -> None:
    """Require commit revalidation to reproduce the signed preview identity."""

    if token.get("workbook_identity") != _workbook_identity_claim(preview):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Workbook identity differs from the preview; preview again.",
        )


async def _preview_bytes(
    file: UploadFile,
    *,
    mapping: Any,
    evaluated_at: datetime,
) -> tuple[bytes, ModelWorkbookPreview, str, avscan.ScanVerdict]:
    filename = _validated_filename(file.filename)
    async with _semaphore():
        content = await ingest.read_capped(file, max_bytes=MAX_MODEL_FILE_BYTES)
        malware_scan = await avscan.scan(content)
        try:
            preview = await asyncio.to_thread(
                preview_workbook,
                content,
                filename=filename,
                mapping=mapping,
                evaluated_at=evaluated_at,
            )
        except ModelWorkbookError as exc:
            raise _workbook_error(exc) from exc
    return content, preview, filename, malware_scan


async def _existing_import(
    db: AsyncSession, *, fingerprint: str, analyst_id: str, issuer_id: str
) -> Optional[ModelWorkbookImport]:
    return (
        await db.execute(
            select(ModelWorkbookImport).where(
                ModelWorkbookImport.import_fingerprint == fingerprint,
                ModelWorkbookImport.analyst_id == analyst_id,
                ModelWorkbookImport.issuer_id == issuer_id,
            )
        )
    ).scalar_one_or_none()


def _commit_out(
    imported: ModelWorkbookImport,
    draft: ModelDraftV2,
    *,
    existing: bool,
) -> ModelWorkbookCommitOut:
    return ModelWorkbookCommitOut(
        existing=existing,
        import_id=imported.id,
        document_id=imported.document_id,
        source_manifest_id=imported.source_manifest_id,
        workbook_sha256=imported.workbook_sha256,
        import_fingerprint=imported.import_fingerprint,
        committed_revision=imported.committed_revision,
        calculation_hash=imported.calculation_hash,
        record=_draft_out(draft),
    )


def _override_events(
    *,
    before_payload: Optional[ModelDraftPayload],
    before_calculation: Optional[ModelCalculation],
    after_payload: ModelDraftPayload,
    after_calculation: ModelCalculation,
    draft: ModelDraftV2,
    issuer_id: str,
    caller_id: str,
    manifest_id: str,
    now: datetime,
) -> list[ModelOverrideEvent]:
    before = {
        item.node_id: item
        for item in (before_payload.overrides if before_payload else [])
    }
    after = {item.node_id: item for item in after_payload.overrides}
    events: list[ModelOverrideEvent] = []
    for node_id in sorted(set(before) | set(after)):
        prior = before.get(node_id)
        applied = after.get(node_id)
        if prior == applied:
            continue
        source_calculation = (
            after_calculation if applied is not None else before_calculation
        )
        try:
            original = (
                calculation_node(source_calculation, node_id)
                if source_calculation
                else {}
            )
        except ValueError:
            original = {}
        value = applied or prior
        if value is None:
            continue
        events.append(
            ModelOverrideEvent(
                draft_id=draft.id,
                issuer_id=issuer_id,
                analyst_id=caller_id,
                action="import_set" if applied is not None else "import_reset",
                node_id=node_id,
                value_type=value.value_type,
                before_value=prior.model_dump(mode="json") if prior else None,
                after_value=applied.model_dump(mode="json") if applied else None,
                original_formula=original.get("formula"),
                original_value={"value": original.get("original_value")},
                reason=value.reason or "Model workbook import",
                scope=value.scope,
                source=manifest_id,
                actor_id=caller_id,
                expires_at=value.expires_at,
                revision=draft.revision,
                created_at=now,
            )
        )
    return events


@router.get("/v2/{issuer_id}/workbook/export")
async def export_model_workbook(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _authorized_issuer(db, caller, issuer_id)
    draft = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    if draft is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model draft not found.")
    payload = ModelDraftPayload.model_validate(draft.payload)
    exported_at = datetime.now(timezone.utc)
    current_calculation = calculate_model(payload, evaluated_at=exported_at)
    if not hmac.compare_digest(
        current_calculation.calculation_hash, draft.calculation_hash
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "message": "Model calculation is stale; recalculate and save before exporting.",
                "current_revision": draft.revision,
                "current_calculation_hash": current_calculation.calculation_hash,
            },
        )
    content = await asyncio.to_thread(
        render_model_workbook,
        payload,
        issuer_id=issuer_id,
        draft_revision=draft.revision,
        exported_by=caller.id,
        exported_at=exported_at,
    )
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="caos-model-{issuer_id}.xlsx"',
            "Cache-Control": "private, no-store",
            "X-CAOS-Model-Revision": str(draft.revision),
        },
    )


@router.post(
    "/v2/{issuer_id}/workbook/import/preview", response_model=ModelWorkbookPreviewOut
)
async def preview_model_workbook_import(
    issuer_id: str,
    file: UploadFile = File(...),
    mapping: str = Form(""),
    expected_revision: int = Form(0, ge=0),
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard(caller)
    require_write_role(caller)
    await _authorized_issuer(db, caller, issuer_id)
    current = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    current_revision = current.revision if current else 0
    if current_revision != expected_revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "message": "Model draft changed before workbook preview.",
                "current_revision": current_revision,
            },
        )
    parsed_mapping, mapping_payload = _mapping_json(mapping)
    evaluated_at = datetime.now(timezone.utc)
    _, preview, _, _ = await _preview_bytes(
        file, mapping=parsed_mapping, evaluated_at=evaluated_at
    )
    preview = _bind_workbook_identity(
        preview,
        issuer_id=issuer_id,
        current_revision=current_revision if current is not None else None,
    )
    fingerprint = _import_fingerprint(
        analyst_id=caller.id,
        issuer_id=issuer_id,
        workbook_sha256=preview.workbook_sha256,
        mapping=mapping_payload,
        expected_revision=expected_revision,
    )
    identities = {
        "import_id": _artifact_id(fingerprint, "model-workbook-import"),
        "document_id": _artifact_id(fingerprint, "document"),
        "manifest_id": _artifact_id(fingerprint, "source-manifest"),
        "draft_id": current.id
        if current
        else _artifact_id(fingerprint, "model-draft-v2"),
    }
    preview = _with_import_authority(
        preview,
        document_id=identities["document_id"],
        manifest_id=identities["manifest_id"],
        evaluated_at=evaluated_at,
    )
    token = None
    if preview.blocking_count == 0 and not preview.ambiguities and preview.calculation:
        token = _sign_token(
            {
                "analyst_id": caller.id,
                "issuer_id": issuer_id,
                "workbook_sha256": preview.workbook_sha256,
                "mapping_digest": _mapping_digest(mapping_payload),
                "expected_revision": expected_revision,
                "evaluated_at": evaluated_at.isoformat(),
                "calculation_hash": preview.calculation.calculation_hash,
                "workbook_identity": _workbook_identity_claim(preview),
                "import_fingerprint": fingerprint,
                **identities,
                "exp": _token_expiration(preview, evaluated_at=evaluated_at),
            }
        )
    return ModelWorkbookPreviewOut(
        **preview.model_dump(mode="json"),
        preview_token=token,
        expected_revision=expected_revision,
    )


@router.post(
    "/v2/{issuer_id}/workbook/import/commit", response_model=ModelWorkbookCommitOut
)
async def commit_model_workbook_import(
    issuer_id: str,
    file: UploadFile = File(...),
    mapping: str = Form(""),
    expected_revision: int = Form(0, ge=0),
    preview_sha256: str = Form(..., min_length=64, max_length=64),
    preview_token: str = Form(..., min_length=1, max_length=4_096),
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _guard(caller)
    require_write_role(caller)
    await _authorized_issuer(db, caller, issuer_id)
    if any(character not in "0123456789abcdefABCDEF" for character in preview_sha256):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "preview_sha256 must be a SHA-256 hex digest.",
        )
    parsed_mapping, mapping_payload = _mapping_json(mapping)
    token = _read_token(
        preview_token,
        caller_id=caller.id,
        issuer_id=issuer_id,
        workbook_sha256=preview_sha256.lower(),
        mapping=mapping_payload,
        expected_revision=expected_revision,
    )
    try:
        evaluated_at = datetime.fromisoformat(
            str(token["evaluated_at"]).replace("Z", "+00:00")
        ).astimezone(timezone.utc)
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Preview token is invalid; preview again."
        ) from exc
    content, preview, filename, malware_scan = await _preview_bytes(
        file, mapping=parsed_mapping, evaluated_at=evaluated_at
    )
    if not hmac.compare_digest(preview.workbook_sha256, preview_sha256.lower()):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Workbook bytes differ from the preview; preview again.",
        )
    preview = _bind_workbook_identity(
        preview,
        issuer_id=issuer_id,
        current_revision=expected_revision if expected_revision > 0 else None,
    )
    _require_token_identity(token, preview)
    preview = _with_import_authority(
        preview,
        document_id=str(token["document_id"]),
        manifest_id=str(token["manifest_id"]),
        evaluated_at=evaluated_at,
    )
    if (
        preview.blocking_count
        or preview.ambiguities
        or not preview.draft_payload
        or not preview.calculation
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {
                "code": "blocking_preview_issues",
                "blocking_count": preview.blocking_count,
                "ambiguities": [
                    item.model_dump(mode="json") for item in preview.ambiguities
                ],
                "issues": [item.model_dump(mode="json") for item in preview.issues],
            },
        )
    if not hmac.compare_digest(
        preview.calculation.calculation_hash,
        str(token.get("calculation_hash") or ""),
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Revalidated model calculation differs from the preview; preview again.",
        )
    _require_token_live(token)

    fingerprint = _import_fingerprint(
        analyst_id=caller.id,
        issuer_id=issuer_id,
        workbook_sha256=preview.workbook_sha256,
        mapping=mapping_payload,
        expected_revision=expected_revision,
    )
    existing = await _existing_import(
        db, fingerprint=fingerprint, analyst_id=caller.id, issuer_id=issuer_id
    )
    if existing is not None:
        draft = await db.get(ModelDraftV2, existing.draft_id)
        if (
            draft is None
            or draft.analyst_id != caller.id
            or draft.issuer_id != issuer_id
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Committed import draft is unavailable."
            )
        if (
            draft.revision != existing.committed_revision
            or draft.calculation_hash != existing.calculation_hash
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Committed import result was superseded by a newer draft revision.",
            )
        return _commit_out(existing, draft, existing=True)

    current = await _owned_draft(db, issuer_id=issuer_id, analyst_id=caller.id)
    current_revision = current.revision if current else 0
    if current_revision != expected_revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "message": "Model draft changed before workbook commit.",
                "current_revision": current_revision,
            },
        )
    before_payload = (
        ModelDraftPayload.model_validate(current.payload) if current else None
    )
    before_calculation = (
        ModelCalculation.model_validate(current.calculation) if current else None
    )
    now = datetime.now(timezone.utc)
    _require_token_live(token)
    storage_key = await asyncio.to_thread(model_storage.store_atomic, content, filename)
    commit_started = False
    try:
        document = Document(
            id=str(token["document_id"]),
            issuer_id=issuer_id,
            analyst_id=caller.id,
            doc_type="ModelWorkbook",
            run_mode="model",
            file_name=filename,
            storage_key=storage_key,
            source_kind="model",
            chunk_count=0,
            uploaded_by=caller.email,
            uploaded_at=now,
            # content_sha256 deliberately left unset (NULL) here, unlike the
            # other construction sites: this path's design intentionally
            # creates a fresh, distinct Document per commit — the SAME
            # workbook bytes are legitimately re-imported at a later draft
            # revision (see _existing_import's fingerprint, which is
            # revision-aware, and test_model_workbook_api.py::
            # test_same_legacy_workbook_replays_once_but_can_be_reimported_
            # at_later_revision, which asserts exactly that succeeds with a
            # second, distinct import_id). Populating content_sha256 would
            # make those legitimate repeat-content commits collide on the
            # new partial unique index (issuer_id, content_sha256) WHERE
            # status='active' and turn a 200 into a 409, breaking existing
            # caller behavior. Safe to skip: this document always carries
            # chunk_count=0 (no DocumentChunk rows are ever created for a
            # model workbook), so it can never be double-cited via
            # retrieval.rrf_fusion — the root cause this column exists to
            # fix does not apply to this construction site.
        )
        manifest = SourceManifest(
            id=str(token["manifest_id"]),
            analyst_id=caller.id,
            issuer_id=issuer_id,
            origin="imported",
            method="workbook-import",
            status="ready",
            files=[
                {
                    "document_id": document.id,
                    "file_name": document.file_name,
                    "sha256": preview.workbook_sha256,
                    "media_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "size_bytes": len(content),
                    "source_kind": "model",
                    "malware_scan": malware_scan,
                }
            ],
            authority={},
            created_at=now,
        )
        db.add_all([document, manifest])
        await db.flush()

        if current is None:
            changed = ModelDraftV2(
                id=str(token["draft_id"]),
                issuer_id=issuer_id,
                analyst_id=caller.id,
                context_id=None,
                source_run_id=None,
                payload=_bounded_payload(preview.draft_payload),
                calculation=preview.calculation.model_dump(mode="json"),
                source_fingerprint=preview.calculation.source_fingerprint,
                input_fingerprint=preview.calculation.input_fingerprint,
                engine_version=preview.calculation.engine_version,
                calculation_hash=preview.calculation.calculation_hash,
                revision=1,
                created_at=now,
                updated_at=now,
            )
            db.add(changed)
            await db.flush()
        else:
            changed = await _cas_update(
                db,
                row=current,
                expected_revision=expected_revision,
                payload=preview.draft_payload,
                calculation=preview.calculation,
            )
            # An imported workbook is the current input authority. The original
            # run IDs remain in Sources/Audit, but this mutable draft no longer
            # claims a direct live-run binding.
            changed.source_run_id = None

        events = _override_events(
            before_payload=before_payload,
            before_calculation=before_calculation,
            after_payload=preview.draft_payload,
            after_calculation=preview.calculation,
            draft=changed,
            issuer_id=issuer_id,
            caller_id=caller.id,
            manifest_id=manifest.id,
            now=now,
        )
        db.add_all(events)
        imported = ModelWorkbookImport(
            id=str(token["import_id"]),
            analyst_id=caller.id,
            issuer_id=issuer_id,
            draft_id=changed.id,
            document_id=document.id,
            source_manifest_id=manifest.id,
            workbook_sha256=preview.workbook_sha256,
            import_fingerprint=fingerprint,
            mapping=mapping_payload,
            issues=[item.model_dump(mode="json") for item in preview.issues],
            committed_revision=changed.revision,
            calculation_hash=changed.calculation_hash,
            committed_at=now,
        )
        db.add(imported)
        manifest.authority = {
            "origin": "imported",
            "method": "workbook-import",
            "freshness": "unknown",
            "as_of": None,
            "source_ids": [document.id, imported.id],
            "run_id": None,
            "version_id": imported.id,
            "confidence": None,
            "approval_state": "draft",
            "analyst_override": None,
            "engine_version": changed.engine_version,
            "source_fingerprint": changed.source_fingerprint,
            "input_fingerprint": changed.input_fingerprint,
            "calculation_hash": changed.calculation_hash,
            "draft_revision": changed.revision,
        }
        await write_owned_artifact_lineage_edge(
            db,
            analyst_id=caller.id,
            artifact=ArtifactRef(kind="source_manifest", id=manifest.id),
            parent=ArtifactRef(kind="document", id=document.id),
            transform="model-workbook-import",
            transform_version="2",
            enabled=True,
        )
        await db.flush()
        # From this boundary an exception can be an ambiguous commit result: a
        # connection loss may be reported after the database durably commits.
        # Retaining a possible orphan is recoverable; deleting bytes referenced
        # by committed Document/Manifest rows is not.
        commit_started = True
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if not commit_started:
            await asyncio.to_thread(model_storage.remove_uncommitted, storage_key)
        winner = await _existing_import(
            db, fingerprint=fingerprint, analyst_id=caller.id, issuer_id=issuer_id
        )
        if winner is not None:
            draft = await db.get(ModelDraftV2, winner.draft_id)
            if (
                draft is None
                or draft.analyst_id != caller.id
                or draft.issuer_id != issuer_id
            ):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "Committed import draft is unavailable.",
                ) from exc
            if (
                draft.revision != winner.committed_revision
                or draft.calculation_hash != winner.calculation_hash
            ):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "Committed import result was superseded by a newer draft revision.",
                ) from exc
            return _commit_out(winner, draft, existing=True)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Model workbook commit conflicted; preview again.",
        ) from exc
    except Exception:
        await db.rollback()
        if not commit_started:
            await asyncio.to_thread(model_storage.remove_uncommitted, storage_key)
        raise
    await db.refresh(imported)
    await db.refresh(changed)
    return _commit_out(imported, changed, existing=False)
