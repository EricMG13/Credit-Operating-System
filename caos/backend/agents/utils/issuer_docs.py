"""
Shared utility: fetch document IDs scoped to a single issuer.

All CP-X agents must use this to scope semantic_search() to the correct
issuer — preventing cross-issuer MNPI leakage through the RAG layer.
"""

from __future__ import annotations

from uuid import UUID

import structlog
from sqlalchemy import select

from db.models import Document
from db.session import AsyncSessionLocal

logger = structlog.get_logger()


async def get_issuer_document_ids(issuer_id: str) -> list[UUID]:
    """
    Return all document IDs belonging to `issuer_id`.

    MNPI note: every agent's semantic_search() call must pass the result of
    this function as `document_ids` so that embeddings from other issuers
    are never surfaced in the retrieval context.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Document.id).where(Document.issuer_id == UUID(issuer_id))
        )
        ids: list[UUID] = [row[0] for row in result.fetchall()]

    logger.debug("RAG scope resolved", issuer_id=issuer_id, doc_count=len(ids))
    return ids
