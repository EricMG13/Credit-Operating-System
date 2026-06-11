"""
Parent-Child RAG chunking strategy.

PARENT chunks: Large context windows (1500-2000 tokens) — returned for full-context synthesis.
CHILD chunks:  Small, semantically dense chunks (150-200 tokens) — used for retrieval.

Retrieval: search over CHILD embeddings, return PARENT content.
This balances precision (small chunks find the right passage) with
context richness (large parent provides full surrounding text to the LLM).
"""

from __future__ import annotations

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import DocumentChunk
from ingestion.rag.embedder import embed_texts

logger = structlog.get_logger()

PARENT_CHUNK_SIZE = 1800   # ~tokens
CHILD_CHUNK_SIZE = 180     # ~tokens
CHILD_OVERLAP = 20


def _split_text(text: str, chunk_size: int, overlap: int = 0) -> list[str]:
    """Simple token-approximate splitter (splits on whitespace)."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        start += chunk_size - overlap
    return chunks


async def create_parent_child_chunks(
    document_id: UUID,
    full_text: str,
    metadata: dict,
    db: AsyncSession,
) -> int:
    """
    Create parent and child chunks for a document.
    Returns total number of chunks created.
    """
    parent_texts = _split_text(full_text, PARENT_CHUNK_SIZE)
    all_chunks: list[DocumentChunk] = []
    child_texts_for_embedding: list[str] = []
    child_chunk_refs: list[DocumentChunk] = []

    for p_idx, p_text in enumerate(parent_texts):
        # Create parent chunk (no embedding — not searched directly)
        parent = DocumentChunk(
            document_id=document_id,
            chunk_type="PARENT",
            parent_id=None,
            chunk_index=p_idx,
            content=p_text,
            metadata_={"parent_index": p_idx, **metadata},
        )
        db.add(parent)
        await db.flush()  # Get parent.id

        all_chunks.append(parent)

        # Create child chunks from within this parent
        child_texts = _split_text(p_text, CHILD_CHUNK_SIZE, CHILD_OVERLAP)
        for c_idx, c_text in enumerate(child_texts):
            child = DocumentChunk(
                document_id=document_id,
                chunk_type="CHILD",
                parent_id=parent.id,
                chunk_index=c_idx,
                content=c_text,
                metadata_={"parent_index": p_idx, "child_index": c_idx, **metadata},
            )
            db.add(child)
            all_chunks.append(child)
            child_texts_for_embedding.append(c_text)
            child_chunk_refs.append(child)

    await db.flush()

    # Embed child chunks in batch
    if child_texts_for_embedding:
        embeddings = await embed_texts(child_texts_for_embedding)
        # Persist embeddings via raw SQL (pgvector)
        from sqlalchemy import text
        for chunk, embedding in zip(child_chunk_refs, embeddings):
            await db.execute(
                text("UPDATE document_chunks SET embedding = :emb::vector WHERE id = :id"),
                {"emb": str(embedding), "id": str(chunk.id)},
            )

    logger.info(
        "Parent-child chunks created",
        doc_id=str(document_id),
        parents=len(parent_texts),
        children=len(child_texts_for_embedding),
    )
    return len(all_chunks)


async def semantic_search(
    query: str,
    document_ids: list[UUID] | None = None,
    top_k: int = 5,
    db: AsyncSession | None = None,
) -> list[dict]:
    """
    Search child chunks by semantic similarity, return parent content.
    Used by agents during evidence retrieval.
    """
    from sqlalchemy import text
    from db.session import AsyncSessionLocal
    from ingestion.rag.embedder import embed_texts

    query_embedding = (await embed_texts([query]))[0]

    # Build parameterized query
    params: dict = {
        "query_emb": str(query_embedding),
        "top_k": top_k,
    }

    filter_clause = ""
    if document_ids:
        # Use numbered placeholders for document IDs
        id_placeholders = []
        for i, doc_id in enumerate(document_ids):
            key = f"doc_id_{i}"
            id_placeholders.append(f":{key}")
            params[key] = str(doc_id)
        filter_clause = f"AND c.document_id IN ({', '.join(id_placeholders)})"

    sql = text(f"""
        SELECT p.content AS parent_content, p.id::text AS parent_id,
               c.id::text AS child_id, c.metadata AS metadata,
               1 - (c.embedding <=> :query_emb::vector) AS similarity
        FROM document_chunks c
        JOIN document_chunks p ON c.parent_id = p.id
        WHERE c.chunk_type = 'CHILD'
          AND c.embedding IS NOT NULL
        {filter_clause}
        ORDER BY c.embedding <=> :query_emb::vector
        LIMIT :top_k
    """)

    session = db or AsyncSessionLocal()
    try:
        result = await session.execute(sql, params)
        rows = result.mappings().all()
        return [dict(row) for row in rows]
    finally:
        if db is None:
            await session.close()
