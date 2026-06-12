"""Document intake: content sniffing, vault storage, text chunking.

Files land in the vault directory (a UC Volume on Databricks, local disk in
dev) and their extracted text is chunked into document_chunks rows for
downstream retrieval.
"""

from __future__ import annotations

import io
import re
import uuid
import zipfile
from pathlib import Path
from typing import List

from fastapi import HTTPException

from config import get_settings

settings = get_settings()

_PDF_MAGIC = b"%PDF-"
_OOXML_MAGIC = b"PK\x03\x04"
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

CHUNK_CHARS = 2400
CHUNK_OVERLAP = 240


def enforce_size(content: bytes) -> None:
    if not content:
        raise HTTPException(400, "Empty upload")
    limit = settings.max_upload_mb * 1024 * 1024
    if len(content) > limit:
        raise HTTPException(
            413,
            f"File exceeds the {settings.max_upload_mb} MB limit "
            f"(got {len(content) / 1024 / 1024:.1f} MB)",
        )


def sniff_pdf(content: bytes) -> None:
    if not content.startswith(_PDF_MAGIC):
        raise HTTPException(400, "Uploaded file is not a valid PDF.")


def sniff_xlsx(content: bytes) -> None:
    if content.startswith(_OLE_MAGIC):
        return  # legacy .xls
    if not content.startswith(_OOXML_MAGIC):
        raise HTTPException(400, "Uploaded file is not a valid Excel workbook.")
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = zf.namelist()
    except zipfile.BadZipFile as e:
        raise HTTPException(400, "Uploaded file is not a valid Excel workbook.") from e
    if not any(n.startswith("xl/") for n in names):
        raise HTTPException(400, "ZIP container is not an Excel workbook (no xl/ entries).")


def store(content: bytes, file_name: str) -> str:
    """Write the raw file into the vault; returns the storage key."""
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(file_name).name) or "upload.bin"
    key = f"{uuid.uuid4().hex}/{safe}"
    path = Path(settings.caos_storage_dir) / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return key


def extract_pdf_text(content: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(content))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        return ""  # scanned / encrypted PDFs vault fine, just produce no chunks


def extract_xlsx_text(content: bytes) -> str:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception:
        return ""
    lines: List[str] = []
    for ws in wb.worksheets:
        lines.append(f"# Sheet: {ws.title}")
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None]
            if cells:
                lines.append("\t".join(cells))
    return "\n".join(lines)


def chunk_text(text: str) -> List[str]:
    text = text.strip()
    if not text:
        return []
    chunks: List[str] = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + CHUNK_CHARS])
        start += CHUNK_CHARS - CHUNK_OVERLAP
    return chunks
