"""OKF ingestion endpoints — security ladder and dispatch only.

The handler owns no pipeline logic: it authenticates, rate-limits, validates and
scans the bytes, then hands off to ``okf_ingest.ingest_pdf``. The ladder order is
the same one ``routes/ingestion.upload_document`` uses and is deliberate —
**scan before parse**, so attacker-controlled bytes never reach a parser until
ClamAV has cleared them.

The edge-origin middleware already enforces ``X-Edge-Authorization`` on every
``/api/*`` path except health, so ``Depends(get_write_identity)`` is the whole
authentication story (401 in any deployed context, ``local-dev`` stub otherwise).
``avscan.scan`` is a genuine no-op unless ``CLAMAV_HOST`` is configured — a
deployment fact, not a code gap.
"""

from __future__ import annotations

from typing import Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form,
                     HTTPException, UploadFile, status)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import avscan
import ingest
import okf_ingest
import rate_limit
from database import Issuer, OkfNote, get_db
from identity import CallerIdentity, get_identity, get_write_identity
from okf_schema import DocType, OkfIngestResponse, StructuringOverrides
from tenancy import require_issuer

router = APIRouter()

_OKF_MAX_PER_MINUTE = 20


def _okf_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"okf:{caller.id}", max_attempts=_OKF_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Upload rate limit reached — try again in a minute.",
        )


def _parse_doc_type(raw: Optional[str]) -> Optional[DocType]:
    """An analyst override wins over the classifier, but only from the closed set —
    an unknown string is a 400, never a silently ignored intent."""
    if raw is None or not raw.strip():
        return None
    try:
        return DocType(raw.strip())
    except ValueError:
        raise HTTPException(
            400,
            f"doc_type must be one of {sorted(d.value for d in DocType)}.",
        ) from None


class OkfDocumentRow(BaseModel):
    document_id: str
    note_path: str
    note_title: Optional[str] = None
    doc_type: Optional[str] = None
    source: Optional[str] = None
    report_date: Optional[str] = None
    fiscal_period: Optional[str] = None
    extraction_status: str


@router.post("/ingest", response_model=OkfIngestResponse)
async def okf_ingest_route(
    background_tasks: BackgroundTasks,
    issuer_id: str = Form(...),
    doc_type: Optional[str] = Form(None),  # analyst override; else the classifier decides
    source: Optional[str] = Form(None),
    report_date: Optional[str] = Form(None),
    fiscal_period: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_write_identity),
):
    _okf_rate_guard(caller)
    overrides = StructuringOverrides(
        doc_type=_parse_doc_type(doc_type),
        source=source,
        report_date=report_date,
        fiscal_period=fiscal_period,
    )
    content = await ingest.read_capped(file)  # 413 over cap / 400 empty
    ingest.sniff_pdf(content)                 # 400 if not %PDF-
    await avscan.scan(content)                # 422 on a hit / 503 fail-closed
    # ingest_pdf extracts OFF-THREAD first, then opens the DB session (issuer
    # tenancy check + writes) — so no transaction is held idle during a long parse.
    result = await okf_ingest.ingest_pdf(
        db, content, file.filename or "upload.pdf", issuer_id,
        overrides, caller, background_tasks,
    )
    return OkfIngestResponse(**result.model_dump())


@router.get("/documents", response_model=list[OkfDocumentRow])
async def list_okf_documents(
    issuer_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Registry rows for one issuer.

    ``issuer_id`` is required rather than optional: the registry carries no team
    column, so an unscoped listing would leak another team's documents. Scoping
    through ``require_issuer`` reuses the one gate that already 404s instead of
    revealing that a foreign issuer exists.
    """
    require_issuer(caller, await db.get(Issuer, issuer_id))
    rows = (await db.execute(
        select(OkfNote)
        .where(OkfNote.issuer_id == issuer_id)
        .order_by(OkfNote.created_at.desc())
    )).scalars().all()
    return [
        OkfDocumentRow(
            document_id=row.document_id,
            note_path=row.note_path,
            note_title=row.note_title,
            doc_type=row.doc_type,
            source=row.source,
            report_date=row.report_date,
            fiscal_period=row.fiscal_period,
            extraction_status=row.extraction_status,
        )
        for row in rows
    ]
