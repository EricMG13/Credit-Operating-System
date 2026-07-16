"""Chunk analyst memos into the retrieval corpus — the memo citation fix.

Memos are vault-only today (written to ``Analyst-Memos/`` and linked into the
Query graph via ``sync_analyst_memos``), so Q2 query answers can't cite them.
This module chunks a memo's text into ``document_chunks`` at upload time so
``retrieve_corpus`` (the Q2 path) can surface and cite the analyst's own prior
commentary — closing the recall gap where an analyst asks a question whose
answer lives in a memo they wrote last week.

The multi-issuer memo fits the single-issuer ``Document`` model by creating one
``Document(doc_type="analyst-memo")`` PER linked issuer, each carrying the
memo's chunks. A scoped query over issuer X finds X's memo copy; an unscoped
query sees N copies but MMR's vector-redundancy dedup collapses them in the
packed context. ``DocumentChunkEmbedding`` dedups by ``chunk_hash`` so the
expensive embedding is stored once. Memos linking zero issuers stay vault-only
(today's behavior). See RT-2026-07-07-13.

The run pipeline (CP-1–CP-6) is guarded separately —
``retrieval.build_issuer_index`` filters ``doc_type != "analyst-memo"`` so
engine extraction never cites analyst commentary as source truth (RT-2026-07-07-14).
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from typing import List, Optional, Sequence

from sqlalchemy import select, delete, insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import Document, DocumentChunk, LineageEdge
from ingest import chunk_text

logger = logging.getLogger("caos.memochunks")

MEMO_DOC_TYPE = "analyst-memo"


async def _delete_prior_memo_docs(
    db: AsyncSession, title: str, analyst_id: Optional[str]
) -> None:
    """Idempotently remove any prior ``analyst-memo`` Documents (and their chunks
    + lineage edges) for the same title before re-creating. The FK structure has
    no cascade, and lineage references chunks/parents by string id, so delete in
    dependency order: lineage → chunks → documents. Embeddings are left alone
    (keyed by ``chunk_hash``, shared across docs, reused on re-chunk)."""
    prior_docs = (await db.execute(
        select(Document.id).where(
            Document.doc_type == MEMO_DOC_TYPE,
            Document.file_name == title,
            Document.analyst_id == analyst_id,
        )
    )).scalars().all()
    if not prior_docs:
        return
    prior_doc_ids = list(prior_docs)

    prior_chunk_ids = (await db.execute(
        select(DocumentChunk.id).where(DocumentChunk.document_id.in_(prior_doc_ids))
    )).scalars().all()
    if prior_chunk_ids:
        chunk_artifacts = [f"chunk:{cid}" for cid in prior_chunk_ids]
        await db.execute(delete(LineageEdge).where(LineageEdge.artifact_id.in_(chunk_artifacts)))
    doc_parents = [f"doc:{did}" for did in prior_doc_ids]
    await db.execute(delete(LineageEdge).where(LineageEdge.parent_id.in_(doc_parents)))
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id.in_(prior_doc_ids)))
    await db.execute(delete(Document).where(Document.id.in_(prior_doc_ids)))
    logger.info("Replaced %d prior memo document(s) for title %r", len(prior_doc_ids), title)


async def chunk_memo_into_corpus(
    db: AsyncSession,
    title: str,
    body_text: str,
    linked_issuer_ids: Sequence[str],
    uploaded_by: str,
    *,
    analyst_id: Optional[str] = None,
) -> List[str]:
    """Chunk an analyst memo into ``document_chunks`` so Q2 retrieval can cite it.

    Creates one ``Document(doc_type="analyst-memo")`` per linked issuer, each
    carrying the memo's chunks (same text → same ``chunk_hash``, different
    ``document_id``). Idempotent on title — re-uploads replace the prior memo's
    documents/chunks/lineage before re-creating. Returns the created document
    ids (caller schedules per-document embedding via
    ``engine.embeddings.embed_chunks_for_document``).

    No-op (returns ``[]``) when the memo links zero issuers or has no extractable
    text — the memo stays vault-only and reachable via the Query graph, matching
    today's behavior.
    """
    linked = [iid for iid in linked_issuer_ids if iid]
    if not linked or not (body_text or "").strip():
        return []

    chunks = chunk_text(body_text)
    if not chunks:
        return []

    await _delete_prior_memo_docs(db, title, analyst_id)

    storage_key = f"memo:{title}"
    created_doc_ids: List[str] = []
    for issuer_id in linked:
        doc = Document(
            issuer_id=issuer_id,
            analyst_id=analyst_id,
            doc_type=MEMO_DOC_TYPE,
            run_mode=None,
            file_name=title,
            storage_key=storage_key,
            chunk_count=len(chunks),
            uploaded_by=uploaded_by,
        )
        db.add(doc)
        await db.flush()
        created_doc_ids.append(doc.id)

        chunk_dicts = []
        lineage_dicts = []
        for i, chunk in enumerate(chunks):
            cid = str(uuid.uuid4())
            chash = hashlib.sha256(chunk.encode("utf-8")).hexdigest()
            chunk_dicts.append({
                "id": cid,
                "document_id": doc.id,
                "seq": i,
                "text": chunk,
                "chunk_hash": chash,
            })
            lineage_dicts.append({
                "id": str(uuid.uuid4()),
                "artifact_id": f"chunk:{cid}",
                "parent_id": f"doc:{doc.id}",
                "transform": "chunking",
                "transform_version": "1.0",
            })
        await db.execute(insert(DocumentChunk), chunk_dicts)
        await db.execute(insert(LineageEdge), lineage_dicts)

    logger.info(
        "Chunked memo %r into %d issuer(s) × %d chunks (%d document(s))",
        title, len(linked), len(chunks), len(created_doc_ids),
    )
    return created_doc_ids
