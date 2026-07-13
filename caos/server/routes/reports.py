"""Analyst-owned Report Studio drafts and immutable committee versions."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import (
    AnalysisContextRecord,
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
from identity import CallerIdentity, get_identity
from report_exports import render_report_pdf, render_report_xlsx
from tenancy import require_run_access

router = APIRouter()
_MAX_PAYLOAD_BYTES = 1_000_000


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
        authority=row.authority or {},
        created_at=row.created_at,
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
    if not rate_limit.hit(f"report-drafts:{caller.id}", max_attempts=30, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Report draft rate limit reached.")
    if len(json.dumps(body.payload, default=str)) > _MAX_PAYLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Report draft is too large.")
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


@router.get("/versions", response_model=list[ReportVersionOut])
async def list_report_versions(
    context_id: str = Query(..., max_length=36),
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _owned_context(db, context_id, caller.id)
    rows = (await db.execute(select(ReportVersion).where(
        ReportVersion.context_id == context_id,
        ReportVersion.analyst_id == caller.id,
    ).order_by(ReportVersion.created_at.desc()).limit(100))).scalars().all()
    return [_version_out(row) for row in rows]


@router.post("/versions", response_model=ReportVersionOut, status_code=status.HTTP_201_CREATED)
async def create_report_version(
    body: ReportVersionCreate,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    if not rate_limit.hit(f"report-versions:{caller.id}", max_attempts=10, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Report publication rate limit reached.")
    context = await _owned_context(db, body.context_id, caller.id)
    run = await require_run_access(caller, await db.get(Run, body.run_id), db)
    if not committee_export_allowed(run.committee_status):
        raise HTTPException(status.HTTP_409_CONFLICT, "Run is not Committee Ready.")
    checkpoint = await db.get(ModelCheckpoint, body.model_checkpoint_id)
    if checkpoint is None or checkpoint.analyst_id != caller.id or checkpoint.context_id != context.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model checkpoint not found.")
    if checkpoint.issuer_id != run.issuer_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Model checkpoint and run describe different issuers.")
    artifacts = context.artifacts or {}
    if artifacts.get("model_checkpoint_id") != checkpoint.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "The selected checkpoint is not active in this context.")
    manifest_id = artifacts.get("source_manifest_id")
    manifest = await db.get(SourceManifest, manifest_id) if manifest_id else None
    if manifest is None or manifest.analyst_id != caller.id or manifest.status != "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, "A current ready source manifest is required for publication.")
    if manifest.origin != "live":
        raise HTTPException(status.HTTP_409_CONFLICT, "Reference or demo sources cannot be published.")
    if body.thesis_version_id:
        thesis = await db.get(ThesisVersion, body.thesis_version_id)
        if thesis is None or thesis.issuer_id != run.issuer_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Thesis version not found.")
    modules = (await db.execute(select(ModuleOutput).where(
        ModuleOutput.run_id == run.id
    ))).scalars().all()
    canonical_document = assemble_report(run, modules)
    payload = {
        "composition": body.payload,
        "document": canonical_document,
        "source_manifest_id": manifest.id,
        "model_payload_hash": checkpoint.payload_hash,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    now = datetime.now(timezone.utc)
    row = ReportVersion(
        context_id=context.id,
        analyst_id=caller.id,
        run_id=run.id,
        model_checkpoint_id=checkpoint.id,
        thesis_version_id=body.thesis_version_id,
        status="published",
        payload=payload,
        document_sha256=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        authority={
            "origin": "live",
            "method": "derived",
            "freshness": "current",
            "as_of": now.isoformat(),
            "source_ids": [manifest.id, run.id, checkpoint.id],
            "run_id": run.id,
            "version_id": None,
            "confidence": None,
            "approval_state": "published",
            "analyst_override": None,
        },
        created_at=now,
    )
    db.add(row)
    await db.flush()
    row.authority = {**row.authority, "version_id": row.id}
    context.artifacts = {**artifacts, "report_version_id": row.id}
    context.updated_at = now
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
    authority = row.authority or {}
    if row.status != "published" or authority.get("origin") != "live":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only live published report versions can be exported.")
    if format == "xlsx":
        content = render_report_xlsx(
            version_id=row.id,
            document_sha256=row.document_sha256,
            payload=row.payload or {},
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
            payload=row.payload or {},
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
        "payload": row.payload,
    }
