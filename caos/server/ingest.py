"""Document intake: content sniffing, vault storage, text chunking.

Files land in the vault directory (a mounted volume in production, local disk in
dev) and their extracted text is chunked into document_chunks rows for
downstream retrieval.
"""

from __future__ import annotations

import io
import logging
import re
import shlex
import subprocess
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, UploadFile

from config import get_settings

settings = get_settings()
logger = logging.getLogger("caos.ingest")

_PDF_MAGIC = b"%PDF-"
_OOXML_MAGIC = b"PK\x03\x04"
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

CHUNK_CHARS = 2400
CHUNK_OVERLAP = 240

# Surfaced (not raised) when a document parses to zero chunks. Upload stays
# intentionally lenient — a scanned/encrypted/empty file still vaults — but a
# silent ``chunks_created: 0`` reads as success and an analyst could build a view
# on a document the engine never actually read. This warning makes that explicit.
NO_CHUNKS_WARNING = (
    "0 chunks extracted — document may be scanned/encrypted/empty; "
    "it is vaulted but not searchable. Re-upload a text-based copy if it must be analyzed."
)

_READ_CHUNK = 1024 * 1024  # 1 MB


async def read_capped(file: UploadFile) -> bytes:
    """Read the upload incrementally, aborting as soon as it exceeds the cap.

    Reading the whole body before checking would let an oversized request
    occupy its full size in memory before the 413.
    """
    limit = settings.max_upload_mb * 1024 * 1024
    buf = bytearray()
    while chunk := await file.read(_READ_CHUNK):
        buf.extend(chunk)
        if len(buf) > limit:
            raise HTTPException(413, f"File exceeds the {settings.max_upload_mb} MB limit")
    if not buf:
        raise HTTPException(400, "Empty upload")
    return bytes(buf)


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


def _markitdown_text(content: bytes, filename: str) -> Optional[str]:
    """Structure-preserving extraction via an external markitdown CLI, when one
    is configured (CAOS_MARKITDOWN_CMD). markitdown needs Python 3.10+, so it
    runs out-of-process — the server keeps its own interpreter. Returns the
    Markdown, or None to fall back to the built-in extractors (also on any
    failure/timeout, so a misconfigured command never blocks an upload)."""
    cmd = settings.markitdown_cmd
    if not cmd:
        return None
    try:
        with tempfile.NamedTemporaryFile(suffix=Path(filename).suffix or ".bin") as tmp:
            tmp.write(content)
            tmp.flush()
            proc = subprocess.run(
                [*shlex.split(cmd), tmp.name],
                capture_output=True,
                timeout=settings.markitdown_timeout_s,
            )
        if proc.returncode == 0:
            return proc.stdout.decode("utf-8", "replace").strip() or None
        logger.warning(
            "markitdown rc=%s — falling back. stderr=%s",
            proc.returncode,
            proc.stderr.decode("utf-8", "replace")[:200],
        )
    except (subprocess.SubprocessError, OSError) as exc:
        logger.warning("markitdown unavailable (%s) — falling back.", exc)
    return None


def extract_pdf_text(content: bytes, filename: str = "upload.pdf") -> str:
    md = _markitdown_text(content, filename)
    if md is not None:
        return md

    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(content))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        return ""  # scanned / encrypted PDFs vault fine, just produce no chunks


def extract_xlsx_text(content: bytes, filename: str = "upload.xlsx") -> str:
    md = _markitdown_text(content, filename)
    if md is not None:
        return md

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


def extract_text(content: bytes, filename: str = "download.bin") -> str:
    """Generic extraction for content of any supported type, used by the EDGAR
    retrieval lane (exhibits are usually .htm). Tries the configured markitdown
    CLI first (handles HTML/PDF/Office), then falls back: PDF → pypdf; HTML →
    crude tag strip; otherwise decoded text."""
    md = _markitdown_text(content, filename)
    if md is not None:
        return md

    if content[:5] == _PDF_MAGIC:
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:
            return ""

    text = content.decode("utf-8", "replace")
    if filename.lower().endswith((".htm", ".html")) or "<html" in text[:2000].lower():
        text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = re.sub(r"&nbsp;", " ", text).replace("&amp;", "&")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


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
