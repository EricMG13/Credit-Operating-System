"""Preview-first, revalidated XLSX market snapshot ingestion boundary."""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import avscan
import ingest
import rate_limit
from analysis_contracts import ArtifactRef
from config import get_settings
from database import (
    Document,
    Issuer,
    MarketImportIssue,
    MarketInstrument,
    MarketSnapshot,
    SourceManifest,
    get_db,
)
from freshness import FreshnessEvaluation, evaluate_freshness
from identity import CallerIdentity, get_identity, require_write_role
from lineage_service import write_owned_artifact_lineage_edge
import market_storage
from market_xlsx import (
    MarketWorkbookError,
    WorkbookPreview,
    parse_mapping,
    preview_workbook,
    require_xlsx_filename,
)
from sector_taxonomy import canonical_sector_id
from tenancy import require_issuer, scope_issuers


def require_market_xlsx_v2() -> None:
    """Hide the additive route completely until its rollout flag is enabled."""
    settings = get_settings()
    if not settings.caos_market_xlsx_v2_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    if not settings.caos_lineage_v2_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Market XLSX v2 requires CAOS_LINEAGE_V2_ENABLED.",
        )


router = APIRouter(dependencies=[Depends(require_market_xlsx_v2)])

_PREVIEW_MAX_PER_MINUTE = 20
_MAPPING_MAX_CHARS = 20_000
_ISSUER_MAPPING_MAX_CHARS = 250_000
_PREVIEW_TOKEN_TTL_SECONDS = 15 * 60
_preview_sem: asyncio.Semaphore | None = None


def _preview_semaphore() -> asyncio.Semaphore:
    global _preview_sem
    if _preview_sem is None:
        concurrency = max(1, int(getattr(get_settings(), "caos_upload_concurrency", 2)))
        _preview_sem = asyncio.Semaphore(concurrency)
    return _preview_sem


def _guard(caller: CallerIdentity) -> None:
    # Preview processes an analyst-supplied workbook and is part of the same
    # mutation workflow as commit; viewers must not be able to exercise either
    # expensive ingestion boundary.
    require_write_role(caller)
    if not rate_limit.hit(
        f"market-xlsx-preview:{caller.id}",
        max_attempts=_PREVIEW_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Market import preview rate limit reached.")


def _workbook_error(exc: MarketWorkbookError) -> HTTPException:
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        {"code": exc.code, "message": exc.message},
    )


class MarketImportCommitOut(BaseModel):
    snapshot_id: str
    existing: bool
    document_id: str | None
    source_manifest_id: str | None
    workbook_sha256: str
    payload_hash: str
    as_of: datetime
    source_label: str
    instrument_count: int
    rejected_count: int
    warning_count: int
    formula_cell_count: int
    freshness: FreshnessEvaluation


class MarketWorkbookPreviewOut(WorkbookPreview):
    preview_token: str
    issuer_mappings: dict[str, str]


def _parse_issuer_mappings(raw: str) -> dict[str, str]:
    if len(raw) > _ISSUER_MAPPING_MAX_CHARS:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Issuer mapping is too large.")
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Issuer mapping must be valid JSON.") from exc
    if not isinstance(payload, dict) or len(payload) > 25_000:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Issuer mapping must be an object with at most 25,000 entries.")
    normalized: dict[str, str] = {}
    for raw_key, raw_issuer_id in payload.items():
        if not isinstance(raw_key, str) or not raw_key.strip() or len(raw_key.strip()) > 160:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Issuer mapping keys must be stable instrument keys or FIGIs.")
        if not isinstance(raw_issuer_id, str) or not raw_issuer_id.strip() or len(raw_issuer_id.strip()) > 36:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Issuer mapping values must be issuer IDs.")
        key = raw_key.strip().upper()
        issuer_id = raw_issuer_id.strip()
        if key in normalized and normalized[key] != issuer_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Issuer mapping contains conflicting normalized keys.")
        normalized[key] = issuer_id
    return normalized


def _import_fingerprint(
    *,
    analyst_id: str,
    workbook_sha256: str,
    mapping: dict[str, Any],
    issuer_mappings: dict[str, str],
) -> str:
    payload = json.dumps({
        "analyst_id": analyst_id,
        "workbook_sha256": workbook_sha256,
        "mapping": mapping,
        "issuer_mappings": issuer_mappings,
    }, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _mapping_digest(mapping: dict[str, Any], issuer_mappings: dict[str, str]) -> str:
    payload = json.dumps(
        {"mapping": mapping, "issuer_mappings": issuer_mappings},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _preview_token(
    *, caller_id: str, workbook_sha256: str, mapping: dict[str, Any],
    issuer_mappings: dict[str, str], now_epoch: int | None = None,
) -> str:
    settings = get_settings()
    payload = {
        "analyst_id": caller_id,
        "workbook_sha256": workbook_sha256,
        "mapping_digest": _mapping_digest(mapping, issuer_mappings),
        "exp": int(now_epoch if now_epoch is not None else time.time()) + _PREVIEW_TOKEN_TTL_SECONDS,
    }
    raw = base64.urlsafe_b64encode(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    signature = hmac.new(
        settings.session_secret.encode("utf-8"), raw.encode("ascii"), hashlib.sha256
    ).hexdigest()
    return f"{raw}.{signature}"


def _verify_preview_token(
    token: str, *, caller_id: str, workbook_sha256: str,
    mapping: dict[str, Any], issuer_mappings: dict[str, str],
) -> None:
    settings = get_settings()
    try:
        raw, signature = token.rsplit(".", 1)
        expected = hmac.new(
            settings.session_secret.encode("utf-8"), raw.encode("ascii"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature")
        decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        payload = json.loads(decoded)
        if not isinstance(payload, dict):
            raise ValueError("payload")
    except (ValueError, TypeError, AttributeError, UnicodeError, binascii.Error, json.JSONDecodeError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Preview token is invalid; preview again.") from exc
    if (
        payload.get("analyst_id") != caller_id
        or not hmac.compare_digest(str(payload.get("workbook_sha256") or ""), workbook_sha256)
        or not hmac.compare_digest(
            str(payload.get("mapping_digest") or ""),
            _mapping_digest(mapping, issuer_mappings),
        )
        or not isinstance(payload.get("exp"), int)
        or time.time() > payload["exp"]
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "Preview token is stale or does not match this commit; preview again.")


async def _owned_snapshot(
    db: AsyncSession, *, analyst_id: str, payload_hash: str
) -> MarketSnapshot | None:
    return (await db.execute(select(MarketSnapshot).where(
        MarketSnapshot.analyst_id == analyst_id,
        MarketSnapshot.payload_hash == payload_hash,
    ))).scalar_one_or_none()


def _commit_out(snapshot: MarketSnapshot, *, existing: bool) -> MarketImportCommitOut:
    metadata = snapshot.metadata_json or {}
    freshness = FreshnessEvaluation.model_validate(metadata.get("freshness_evaluation"))
    return MarketImportCommitOut(
        snapshot_id=snapshot.id,
        existing=existing,
        document_id=snapshot.document_id,
        source_manifest_id=snapshot.source_manifest_id,
        workbook_sha256=str(metadata.get("workbook_sha256") or ""),
        payload_hash=snapshot.payload_hash,
        as_of=snapshot.as_of,
        source_label=snapshot.source_label,
        instrument_count=int(metadata.get("instrument_count") or 0),
        rejected_count=int(metadata.get("rejected_count") or 0),
        warning_count=int(metadata.get("warning_count") or 0),
        formula_cell_count=int(metadata.get("formula_cell_count") or 0),
        freshness=freshness,
    )


async def _resolve_issuer_links(
    db: AsyncSession,
    *,
    rows: list[dict[str, Any]],
    explicit: dict[str, str],
    caller: CallerIdentity,
) -> tuple[dict[int, str], list[dict[str, Any]]]:
    row_keys: set[str] = set()
    figis: set[str] = set()
    for row in rows:
        row_keys.add(str(row["instrument_key"]).upper())
        if row.get("figi"):
            figis.add(str(row["figi"]).upper())
    unknown = sorted(set(explicit) - row_keys - figis)
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {"code": "unknown_issuer_mapping_key", "keys": unknown[:25]},
        )

    explicit_issuers: dict[str, Issuer] = {}
    for issuer_id in sorted(set(explicit.values())):
        try:
            explicit_issuers[issuer_id] = require_issuer(caller, await db.get(Issuer, issuer_id))
        except HTTPException as exc:
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Issuer not found.") from exc
            raise

    exact_by_figi: dict[str, list[Issuer]] = {}
    figi_list = sorted(figis)
    for start in range(0, len(figi_list), 500):
        statement = scope_issuers(
            select(Issuer).where(func.upper(Issuer.figi).in_(figi_list[start:start + 500])),
            caller,
        )
        for issuer in (await db.execute(statement)).scalars().all():
            if issuer.figi:
                exact_by_figi.setdefault(issuer.figi.strip().upper(), []).append(issuer)

    links: dict[int, str] = {}
    override_count = 0
    ambiguous_count = 0
    unmatched_count = 0
    for row in rows:
        row_number = int(row["row"])
        key = str(row["instrument_key"]).upper()
        figi = str(row.get("figi") or "").upper()
        explicit_ids = {
            explicit[candidate]
            for candidate in (key, figi)
            if candidate and candidate in explicit
        }
        if len(explicit_ids) > 1:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                {"code": "conflicting_row_issuer_mapping", "row": row_number},
            )
        exact = exact_by_figi.get(figi, []) if figi else []
        if explicit_ids:
            issuer_id = next(iter(explicit_ids))
            links[row_number] = explicit_issuers[issuer_id].id
            if len(exact) == 1 and exact[0].id != issuer_id:
                override_count += 1
        elif len(exact) == 1:
            links[row_number] = exact[0].id
        elif len(exact) > 1:
            ambiguous_count += 1
        else:
            unmatched_count += 1

    issues: list[dict[str, Any]] = []
    if override_count:
        issues.append({
            "severity": "warning", "code": "explicit_issuer_override",
            "message": f"{override_count} exact FIGI match(es) were replaced by explicit analyst mappings.",
        })
    if ambiguous_count:
        issues.append({
            "severity": "warning", "code": "ambiguous_figi_unlinked",
            "message": f"{ambiguous_count} row(s) had non-unique exact FIGI matches and were left unlinked.",
        })
    if unmatched_count:
        issues.append({
            "severity": "warning", "code": "issuer_unmatched",
            "message": f"{unmatched_count} row(s) had no exact FIGI or explicit issuer mapping and were left unlinked.",
        })
    return links, issues


@router.post("/snapshots/import/preview", response_model=MarketWorkbookPreviewOut)
async def preview_market_snapshot_import(
    file: UploadFile = File(...),
    mapping: str = Form("{}"),
    issuer_mappings: str = Form("{}"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Scan and normalize an XLSX without vault or database writes."""
    _guard(caller)
    filename = file.filename or ""
    if len(mapping) > _MAPPING_MAX_CHARS:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Workbook mapping is too large.")
    try:
        require_xlsx_filename(filename)
        parsed_mapping = parse_mapping(mapping)
    except MarketWorkbookError as exc:
        raise _workbook_error(exc) from exc
    explicit = _parse_issuer_mappings(issuer_mappings)
    async with _preview_semaphore():
        content = await ingest.read_capped(file)
        await avscan.scan(content)
        try:
            preview = await asyncio.to_thread(
                preview_workbook,
                content,
                filename=filename,
                mapping=parsed_mapping,
            )
        except MarketWorkbookError as exc:
            raise _workbook_error(exc) from exc
    return MarketWorkbookPreviewOut(
        **preview.model_dump(),
        issuer_mappings=explicit,
        preview_token=_preview_token(
            caller_id=caller.id,
            workbook_sha256=preview.workbook_sha256,
            mapping=preview.mapping,
            issuer_mappings=explicit,
        ),
    )


@router.post(
    "/snapshots/import/commit",
    response_model=MarketImportCommitOut,
)
async def commit_market_snapshot_import(
    file: UploadFile = File(...),
    mapping: str = Form("{}"),
    preview_sha256: str = Form(...),
    preview_token: str = Form(...),
    source_label: str = Form("Bloomberg workbook"),
    issuer_mappings: str = Form("{}"),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Revalidate and atomically commit one immutable owned market snapshot."""
    _guard(caller)
    filename = file.filename or ""
    if len(mapping) > _MAPPING_MAX_CHARS:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Workbook mapping is too large.")
    label = source_label.strip()
    if not label or len(label) > 160:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Source label must be 1-160 characters.")
    if len(preview_sha256) != 64 or any(char not in "0123456789abcdefABCDEF" for char in preview_sha256):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "preview_sha256 must be a SHA-256 hex digest.")
    if not preview_token or len(preview_token) > 2_048:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "preview_token is invalid.")
    explicit = _parse_issuer_mappings(issuer_mappings)
    try:
        require_xlsx_filename(filename)
        parsed_mapping = parse_mapping(mapping)
    except MarketWorkbookError as exc:
        raise _workbook_error(exc) from exc

    async with _preview_semaphore():
        content = await ingest.read_capped(file)
        await avscan.scan(content)
        try:
            parsed = await asyncio.to_thread(
                preview_workbook,
                content,
                filename=filename,
                mapping=parsed_mapping,
                row_limit=None,
            )
        except MarketWorkbookError as exc:
            raise _workbook_error(exc) from exc
    if not hmac.compare_digest(parsed.workbook_sha256.lower(), preview_sha256.lower()):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"code": "preview_hash_mismatch", "message": "Workbook bytes differ from the preview."},
        )
    _verify_preview_token(
        preview_token,
        caller_id=caller.id,
        workbook_sha256=parsed.workbook_sha256,
        mapping=parsed.mapping,
        issuer_mappings=explicit,
    )
    if parsed.blocking_count:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {
                "code": "blocking_preview_issues",
                "blocking_count": parsed.blocking_count,
                "issues": [
                    issue.model_dump(mode="json")
                    for issue in parsed.issues if issue.severity == "blocking"
                ],
            },
        )
    if parsed.as_of is None or not parsed.rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Workbook has no committable market rows.")

    fingerprint = _import_fingerprint(
        analyst_id=caller.id,
        workbook_sha256=parsed.workbook_sha256,
        mapping=parsed.mapping,
        issuer_mappings=explicit,
    )
    existing = await _owned_snapshot(db, analyst_id=caller.id, payload_hash=fingerprint)
    if existing is not None:
        return _commit_out(existing, existing=True)

    links, mapping_issues = await _resolve_issuer_links(
        db, rows=parsed.rows, explicit=explicit, caller=caller
    )
    now = datetime.now(timezone.utc)
    freshness = evaluate_freshness(
        source_kind="price", now=now, observed_at=parsed.as_of
    )
    storage_key = await asyncio.to_thread(market_storage.store_atomic, content, filename)
    try:
        document = Document(
            issuer_id=None,
            analyst_id=caller.id,
            doc_type="MarketPriceFeed",
            run_mode="rv",
            file_name=filename,
            storage_key=storage_key,
            source_kind="price",
            effective_period_end=parsed.as_of.date(),
            source_published_at=parsed.as_of,
            chunk_count=0,
            uploaded_by=caller.email,
            uploaded_at=now,
        )
        db.add(document)
        await db.flush()
        manifest = SourceManifest(
            analyst_id=caller.id,
            issuer_id=None,
            origin="live",
            method="reported",
            status="ready",
            files=[{
                "document_id": document.id,
                "file_name": filename,
                "sha256": parsed.workbook_sha256,
                "media_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "size_bytes": len(content),
                "source_kind": "price",
                "market_as_of": parsed.as_of.isoformat(),
                "malware_scan": "clean",
            }],
            authority={},
            created_at=now,
        )
        db.add(manifest)
        await db.flush()
        total_warnings = parsed.warning_count + len(mapping_issues)
        snapshot = MarketSnapshot(
            analyst_id=caller.id,
            as_of=parsed.as_of,
            source_label=label,
            origin="live",
            method="reported",
            status="ready",
            payload_hash=fingerprint,
            document_id=document.id,
            source_manifest_id=manifest.id,
            import_mapping={**parsed.mapping, "issuer_mappings": explicit},
            metadata_json={
                "workbook_sha256": parsed.workbook_sha256,
                "instrument_count": parsed.accepted_count,
                "rejected_count": parsed.rejected_count,
                "warning_count": total_warnings,
                "formula_cell_count": parsed.formula_cell_count,
                "immutable": True,
                "freshness_evaluation": freshness.model_dump(mode="json"),
            },
            created_at=now,
        )
        db.add(snapshot)
        await db.flush()
        manifest.authority = {
            "origin": "live",
            "method": "reported",
            "freshness": freshness.state,
            "freshness_evaluation": freshness.model_dump(mode="json"),
            "as_of": parsed.as_of.isoformat(),
            "source_ids": [document.id, snapshot.id],
            "run_id": None,
            "version_id": snapshot.id,
            "confidence": 1.0,
            "approval_state": "draft",
            "analyst_override": None,
        }

        for row in parsed.rows:
            row_number = int(row["row"])
            payload = {
                "company": row["borrower"],
                "instrument": row["instrument"],
                "currency": row["currency"],
                "price": row["price"],
                "mid3yDm": row["discount_margin"],
                "bid": row.get("bid"),
                "ask": row.get("ask"),
                "benchmark": row.get("benchmark"),
                "floor": row.get("floor"),
                "margin": row.get("spread"),
                "maturity": row.get("maturity"),
                "ranking": row.get("seniority"),
                "ratings": row.get("rating"),
                "sector": row.get("sector"),
                "subSector": row.get("sub_sector"),
                "source": {
                    "document_id": document.id,
                    "source_manifest_id": manifest.id,
                    "workbook_sha256": parsed.workbook_sha256,
                    "row": row_number,
                },
            }
            db.add(MarketInstrument(
                snapshot_id=snapshot.id,
                instrument_key=str(row["instrument_key"]),
                figi=row.get("figi"),
                issuer_id=links.get(row_number),
                borrower=str(row["borrower"]),
                sector_id=canonical_sector_id(str(row.get("sector") or "")),
                payload=payload,
                created_at=now,
            ))
        for issue in [*parsed.issues, *mapping_issues]:
            raw_issue = issue.model_dump(mode="json") if hasattr(issue, "model_dump") else issue
            db.add(MarketImportIssue(
                snapshot_id=snapshot.id,
                severity=str(raw_issue["severity"]),
                code=str(raw_issue["code"]),
                message=str(raw_issue["message"])[:1024],
                row_number=raw_issue.get("row"),
                column=raw_issue.get("column"),
                field=raw_issue.get("field"),
                created_at=now,
            ))

        document_ref = ArtifactRef(kind="document", id=document.id)
        manifest_ref = ArtifactRef(kind="source_manifest", id=manifest.id)
        snapshot_ref = ArtifactRef(kind="market_snapshot", id=snapshot.id)
        await write_owned_artifact_lineage_edge(
            db, analyst_id=caller.id, artifact=manifest_ref, parent=document_ref,
            transform="market-workbook-ingestion", transform_version="2", enabled=True,
        )
        await write_owned_artifact_lineage_edge(
            db, analyst_id=caller.id, artifact=snapshot_ref, parent=manifest_ref,
            transform="market-snapshot-normalization", transform_version="2", enabled=True,
        )
        await write_owned_artifact_lineage_edge(
            db, analyst_id=caller.id, artifact=snapshot_ref, parent=document_ref,
            transform="market-snapshot-source", transform_version="2", enabled=True,
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        await asyncio.to_thread(market_storage.remove_uncommitted, storage_key)
        winner = await _owned_snapshot(db, analyst_id=caller.id, payload_hash=fingerprint)
        if winner is not None:
            return _commit_out(winner, existing=True)
        raise HTTPException(status.HTTP_409_CONFLICT, "Market snapshot commit conflicted; retry preview.") from exc
    except Exception:
        await db.rollback()
        await asyncio.to_thread(market_storage.remove_uncommitted, storage_key)
        raise
    await db.refresh(snapshot)
    return _commit_out(snapshot, existing=False)
