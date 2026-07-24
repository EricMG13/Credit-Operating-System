"""Tests for engine/embeddings.py — embed_chunks_for_document must dedupe
DocumentChunk rows sharing a chunk_hash WITHIN one batch before bulk-inserting,
mirroring the dedup warmup_embeddings_task already applies. Embedding is keyed
by (model, chunk_hash) via the unique index ix_chunk_embeddings_lookup; a
document with a boilerplate paragraph repeated verbatim (e.g. a governing-law
clause restated in a credit agreement) produces multiple DocumentChunk rows
sharing one chunk_hash. Without a batch-local dedup, the bulk insert trips the
unique constraint, the caller's commit never runs, and the WHOLE document's
embeddings are lost — not just the duplicate rows.
"""
from __future__ import annotations

import hashlib
import uuid

import pytest
from sqlalchemy import select

from database import (
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    DocumentChunkEmbedding,
    Issuer,
)


async def _seed_issuer(db) -> str:
    """Ensure a single issuer exists (mirrors test_memochunks.py's helper)."""
    existing = (await db.execute(select(Issuer))).scalars().all()
    for i in existing:
        if i.name == "Atlas Forge Industrials":
            return i.id
    issuer = Issuer(id=str(uuid.uuid4()), name="Atlas Forge Industrials", ticker="ATLF")
    db.add(issuer)
    await db.flush()
    await db.commit()
    return issuer.id


@pytest.mark.asyncio
async def test_embed_chunks_dedupes_repeated_boilerplate_within_batch(seeded_db, monkeypatch):
    """A document with a boilerplate paragraph repeated verbatim (e.g. a
    governing-law clause restated later in the document) produces multiple
    DocumentChunk rows sharing one chunk_hash. embed_chunks_for_document must
    not attempt to insert more than one DocumentChunkEmbedding for that hash —
    the bulk insert would otherwise trip ix_chunk_embeddings_lookup (unique on
    model, chunk_hash) and roll back the whole document's embeddings."""
    from config import get_settings
    import engine.embeddings as emb_mod
    from engine.embeddings import embed_chunks_for_document

    async with AsyncSessionLocal() as db:
        issuer_id = await _seed_issuer(db)

        doc = Document(
            issuer_id=issuer_id,
            doc_type="credit-agreement",
            file_name="Boilerplate Agreement.pdf",
            storage_key="doc:boilerplate",
            chunk_count=3,
            uploaded_by="a@b.c",
        )
        db.add(doc)
        await db.flush()

        boilerplate = "This Agreement shall be governed by the laws of the State of New York."
        boilerplate_hash = hashlib.sha256(boilerplate.encode("utf-8")).hexdigest()
        unique_text = "Atlas Forge total leverage covenant steps down to 4.50x in Q3."
        unique_hash = hashlib.sha256(unique_text.encode("utf-8")).hexdigest()

        chunks = [
            DocumentChunk(id=str(uuid.uuid4()), document_id=doc.id, seq=0, text=boilerplate, chunk_hash=boilerplate_hash),
            DocumentChunk(id=str(uuid.uuid4()), document_id=doc.id, seq=1, text=unique_text, chunk_hash=unique_hash),
            # Repeated verbatim later in the document — same text, same
            # chunk_hash, a second row in this same batch (the failure scenario).
            DocumentChunk(id=str(uuid.uuid4()), document_id=doc.id, seq=2, text=boilerplate, chunk_hash=boilerplate_hash),
        ]
        db.add_all(chunks)
        await db.commit()

        # Mock embeddings so it's deterministic and doesn't call the API
        # (same pattern as test_memochunks.py's warmup test).
        settings = get_settings()
        monkeypatch.setattr(settings, "caos_document_egress_enabled", True)
        monkeypatch.setattr(settings, "gemini_api_key", "test-key")
        monkeypatch.setattr(settings, "embedding_model", "test-mock")

        async def _fake_get_embeddings(texts):
            return [[0.1] * settings.embedding_dim for _ in texts]
        monkeypatch.setattr(emb_mod, "get_embeddings", _fake_get_embeddings)

        # Must not raise IntegrityError from the duplicate-hash bulk insert.
        inserted = await embed_chunks_for_document(db, doc.id)
        await db.commit()

        # Two distinct hashes embedded (the duplicate boilerplate row collapsed
        # into one within the batch), not three.
        assert inserted == 2

        boilerplate_rows = (await db.execute(
            select(DocumentChunkEmbedding).where(
                DocumentChunkEmbedding.model == "test-mock",
                DocumentChunkEmbedding.chunk_hash == boilerplate_hash,
            )
        )).scalars().all()
        assert len(boilerplate_rows) == 1

        unique_rows = (await db.execute(
            select(DocumentChunkEmbedding).where(
                DocumentChunkEmbedding.model == "test-mock",
                DocumentChunkEmbedding.chunk_hash == unique_hash,
            )
        )).scalars().all()
        assert len(unique_rows) == 1
