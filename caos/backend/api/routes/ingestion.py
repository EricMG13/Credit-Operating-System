"""Document ingestion endpoints — PDF upload and pricing sheet upload."""

import io
import zipfile
from datetime import date
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from db.session import get_db
from api.middleware.jwt import get_current_user
from db.models import User
from ingestion.pdf_parser import ingest_pdf
from ingestion.xlsx_parser import ingest_pricing_sheet

logger = structlog.get_logger()
router = APIRouter()
settings = get_settings()

ALLOWED_PDF_TYPES = {"application/pdf"}
ALLOWED_XLSX_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}

# Magic bytes for content sniffing (more reliable than client-supplied MIME).
# - PDF:  "%PDF-" at byte 0
# - XLSX: "PK\x03\x04" at byte 0 (any OOXML zip — refine below)
# - XLS:  D0 CF 11 E0 A1 B1 1A E1  (legacy OLE compound document)
_PDF_MAGIC = b"%PDF-"
_OOXML_MAGIC = b"PK\x03\x04"
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _enforce_size(content: bytes) -> None:
    """Reject zero-byte uploads and anything larger than max_upload_mb."""
    if not content:
        raise HTTPException(400, "Empty upload")
    limit = settings.max_upload_mb * 1024 * 1024
    if len(content) > limit:
        raise HTTPException(
            413,
            f"File exceeds the {settings.max_upload_mb} MB limit "
            f"(got {len(content) / 1024 / 1024:.1f} MB)",
        )


def _sniff_pdf(content: bytes) -> None:
    if not content.startswith(_PDF_MAGIC):
        raise HTTPException(400, "Uploaded file is not a valid PDF.")


def _sniff_xlsx(content: bytes) -> None:
    if content.startswith(_OLE_MAGIC):
        return  # legacy .xls (OLE compound document)
    if not content.startswith(_OOXML_MAGIC):
        raise HTTPException(400, "Uploaded file is not a valid Excel workbook.")
    # Any OOXML/zip starts with PK\x03\x04 (docx, pptx, jar…). Require an
    # actual workbook entry before the file is vaulted to MinIO.
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = zf.namelist()
    except zipfile.BadZipFile as e:
        raise HTTPException(400, "Uploaded file is not a valid Excel workbook.") from e
    if not any(n == "xl/workbook.xml" or n.startswith("xl/") for n in names):
        raise HTTPException(400, "ZIP container is not an Excel workbook (no xl/ entries).")


class IngestionResponse(BaseModel):
    document_id: UUID
    issuer_id: UUID
    minio_key: str
    chunks_created: int
    message: str


@router.post("/upload/document", response_model=IngestionResponse)
async def upload_document(
    issuer_id: UUID = Form(...),
    doc_type: str = Form(...),
    fiscal_period: str | None = Form(None),
    mnpi_flag: bool = Form(False),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ad-hoc PDF document upload (OM, Credit Agreement, Interim Report, etc.)."""
    if file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(400, f"Expected PDF, got {file.content_type}")

    content = await file.read()
    _enforce_size(content)
    _sniff_pdf(content)

    result = await ingest_pdf(
        content=content,
        filename=file.filename or "document.pdf",
        issuer_id=issuer_id,
        doc_type=doc_type,
        fiscal_period=fiscal_period,
        mnpi_flag=mnpi_flag,
        db=db,
    )
    return result


@router.post("/upload/pricing-sheet", response_model=IngestionResponse)
async def upload_pricing_sheet(
    issuer_id: UUID = Form(...),
    run_date: str = Form(...),  # YYYY-MM-DD
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ad-hoc pricing sheet upload (Master_Pricing_Run.xlsx or broker sheets)."""
    if file.content_type not in ALLOWED_XLSX_TYPES:
        raise HTTPException(400, f"Expected XLSX, got {file.content_type}")

    try:
        parsed_run_date = date.fromisoformat(run_date)
    except ValueError as e:
        raise HTTPException(400, f"run_date must be YYYY-MM-DD: {e}") from e

    content = await file.read()
    _enforce_size(content)
    _sniff_xlsx(content)

    result = await ingest_pricing_sheet(
        content=content,
        filename=file.filename or "pricing.xlsx",
        issuer_id=issuer_id,
        run_date=parsed_run_date.isoformat(),
        db=db,
    )
    return result
