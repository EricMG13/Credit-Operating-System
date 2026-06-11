"""
PDF ingestion pipeline.
Parses, stores in MinIO, and triggers Parent-Child RAG chunking.
"""

from __future__ import annotations

import hashlib
import io
from uuid import UUID

import anyio
import pdfplumber
import structlog
from minio import Minio
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from db.models import Document
from ingestion.rag.chunker import create_parent_child_chunks

logger = structlog.get_logger()
settings = get_settings()


def _get_minio() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


async def ingest_pdf(
    content: bytes,
    filename: str,
    issuer_id: UUID,
    doc_type: str,
    fiscal_period: str | None,
    mnpi_flag: bool,
    db: AsyncSession,
) -> dict:
    """
    Full PDF ingestion pipeline:
    1. Compute content hash for dedup
    2. Upload to MinIO
    3. Persist Document record
    4. Parse text
    5. Create Parent-Child RAG chunks
    """
    content_hash = hashlib.sha256(content).hexdigest()
    minio_key = f"{issuer_id}/{doc_type}/{content_hash[:16]}_{filename}"

    # Upload to MinIO (sync client → run in a worker thread)
    minio_client = _get_minio()
    await anyio.to_thread.run_sync(
        lambda: minio_client.put_object(
            bucket_name=settings.minio_bucket_docs,
            object_name=minio_key,
            data=io.BytesIO(content),
            length=len(content),
            content_type="application/pdf",
        )
    )
    logger.info("PDF uploaded to MinIO", key=minio_key)

    # Persist document record
    doc = Document(
        issuer_id=issuer_id,
        doc_type=doc_type,
        file_name=filename,
        minio_key=minio_key,
        content_hash=content_hash,
        mnpi_flag=mnpi_flag,
        fiscal_period=fiscal_period,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    # Extract text using pdfplumber (CPU-bound → run in a worker thread)
    def _extract_text() -> list[str]:
        out: list[str] = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    out.append(text)
        return out

    pages_text = await anyio.to_thread.run_sync(_extract_text)
    full_text = "\n\n".join(pages_text)
    logger.info("PDF text extracted", doc_id=str(doc.id), pages=len(pages_text))

    # Create Parent-Child RAG chunks
    chunks_created = await create_parent_child_chunks(
        document_id=doc.id,
        full_text=full_text,
        metadata={"doc_type": doc_type, "issuer_id": str(issuer_id), "filename": filename},
        db=db,
    )

    return {
        "document_id": doc.id,
        "issuer_id": issuer_id,
        "minio_key": minio_key,
        "chunks_created": chunks_created,
        "message": f"Ingested {len(pages_text)} pages, created {chunks_created} chunks.",
    }
