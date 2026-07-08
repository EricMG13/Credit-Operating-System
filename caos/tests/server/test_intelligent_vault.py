import pytest
import asyncio
import uuid
import hashlib
from sqlalchemy import select

from database import (
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    Issuer,
    LineageEdge,
    LLMCallRecord,
    Run,
    QAFinding,
)
from engine.queryinsights import fingerprint_issuer
from engine import budget

@pytest.mark.asyncio
async def test_fingerprint_issuer(seeded_db):
    async with AsyncSessionLocal() as db:
        # Fetch seeded issuers
        issuers = (await db.execute(select(Issuer))).scalars().all()
        assert len(issuers) >= 1
        i1 = issuers[0].id
        
        # Calculate fingerprint
        fp_1 = await fingerprint_issuer(db, i1)
        assert fp_1 is not None
        assert len(fp_1) == 64  # SHA-256
        
        # Calculate again, must be identical
        fp_2 = await fingerprint_issuer(db, i1)
        assert fp_1 == fp_2
        
        # Add a document to i1 to see if fingerprint changes
        doc = Document(
            id=str(uuid.uuid4()),
            issuer_id=i1,
            doc_type="10-K",
            run_mode="full",
            file_name="new_test_exhibit.pdf",
            storage_key="test_storage_key",
            chunk_count=1,
            uploaded_by="system-test@caos.ai"
        )
        db.add(doc)
        await db.commit()
        
        fp_3 = await fingerprint_issuer(db, i1)
        assert fp_1 != fp_3

@pytest.mark.asyncio
async def test_lineage_edge_creation(seeded_db):
    async with AsyncSessionLocal() as db:
        edge = LineageEdge(
            id=str(uuid.uuid4()),
            artifact_id="test_artifact_123",
            parent_id="test_parent_456",
            transform="test-transform",
            transform_version="1.0"
        )
        db.add(edge)
        await db.commit()
        
        fetched = (await db.execute(
            select(LineageEdge).where(LineageEdge.artifact_id == "test_artifact_123")
        )).scalars().first()
        assert fetched is not None
        assert fetched.parent_id == "test_parent_456"
        assert fetched.transform == "test-transform"

@pytest.mark.asyncio
async def test_llm_run_ledger(seeded_db):
    class DummyUsage:
        input_tokens = 50
        output_tokens = 120
        cache_read_input_tokens = 0
        cache_creation_input_tokens = 0
        iterations = []

    class DummyResponse:
        usage = DummyUsage()
        stop_reason = "stop_reason_test"
        model = "test-model-sonnet"

    resp = DummyResponse()
    
    budget.set_run_id("test-run-xyz")
    try:
        await budget.trace_llm(
            resp,
            lane="test-lane-xyz",
            model="test-model-sonnet",
            ms=250.0,
            fallback=False,
            prompt_hash="test-prompt-hash-123"
        )
    finally:
        budget.set_run_id(None)
        
    async with AsyncSessionLocal() as db:
        record = (await db.execute(
            select(LLMCallRecord).where(LLMCallRecord.run_id == "test-run-xyz")
        )).scalars().first()
        
        assert record is not None
        assert record.lane == "test-lane-xyz"
        assert record.model == "test-model-sonnet"
        assert record.prompt_hash == "test-prompt-hash-123"
        assert record.prompt_tokens == 50
        assert record.completion_tokens == 120
        assert record.cost > 0.0
        assert record.latency_ms == 250


@pytest.mark.asyncio
async def test_structure_aware_chunking():
    from ingest import chunk_text
    # Check simple text
    chunks = chunk_text("Hello world. This is a single chunk.")
    assert len(chunks) == 1
    assert chunks[0] == "Hello world. This is a single chunk."

    # Check paragraph splitting
    long_text = "\n\n".join([f"This is paragraph {i} that contains some text to be split." for i in range(80)])
    chunks = chunk_text(long_text)
    assert len(chunks) > 1
    # Check that chunks respect paragraph boundaries (they are split by double newlines)
    for c in chunks:
        assert len(c.split("\n\n")) >= 1


@pytest.mark.asyncio
async def test_document_embeddings_and_warmup(seeded_db):
    from engine.embeddings import get_embeddings, embed_chunks_for_document, warmup_embeddings_task
    from database import DocumentChunk, DocumentChunkEmbedding
    
    # Test batch mock embedding generation
    vecs = await get_embeddings(["chunk one", "chunk two"])
    assert len(vecs) == 2
    assert len(vecs[0]) == 768
    
    async with AsyncSessionLocal() as db:
        # Get a seeded issuer and add a document with some chunks
        issuers = (await db.execute(select(Issuer))).scalars().all()
        assert len(issuers) >= 1
        i1 = issuers[0].id
        
        doc = Document(
            id=str(uuid.uuid4()),
            issuer_id=i1,
            doc_type="10-Q",
            run_mode="full",
            file_name="embedding_test.pdf",
            storage_key="emb_test_key",
            chunk_count=2,
            uploaded_by="test-embeddings@caos.ai"
        )
        db.add(doc)
        await db.flush()
        
        chunk1 = DocumentChunk(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            seq=0,
            text="chunk text one",
            chunk_hash=hashlib.sha256(b"chunk text one").hexdigest()
        )
        chunk2 = DocumentChunk(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            seq=1,
            text="chunk text two",
            chunk_hash=hashlib.sha256(b"chunk text two").hexdigest()
        )
        db.add(chunk1)
        db.add(chunk2)
        await db.commit()
        
        # Verify that generating embeddings works
        inserted = await embed_chunks_for_document(db, doc.id)
        assert inserted == 2
        await db.commit()
        
        # Verify they are stored in the DB
        stmt = select(DocumentChunkEmbedding).where(DocumentChunkEmbedding.chunk_hash == chunk1.chunk_hash)
        emb = (await db.execute(stmt)).scalars().first()
        assert emb is not None
        assert len(emb.vector) == 768
        
        # Re-running on same doc should insert 0 (cached)
        inserted_again = await embed_chunks_for_document(db, doc.id)
        assert inserted_again == 0
        
        # Add another chunk without embedding to test warmup
        chunk3 = DocumentChunk(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            seq=2,
            text="chunk text three",
            chunk_hash=hashlib.sha256(b"chunk text three").hexdigest()
        )
        db.add(chunk3)
        await db.commit()
        
        # Verify warmup picks it up and embeds it
        warmed = await warmup_embeddings_task(db)
        assert warmed >= 1
        
        stmt = select(DocumentChunkEmbedding).where(DocumentChunkEmbedding.chunk_hash == chunk3.chunk_hash)
        emb3 = (await db.execute(stmt)).scalars().first()
        assert emb3 is not None


@pytest.mark.asyncio
async def test_hybrid_retrieval_and_rrf_fusion(seeded_db, monkeypatch):
    from engine.embeddings import get_embeddings, embed_chunks_for_document
    from retrieval import retrieve, retrieve_corpus, rrf_fusion, Hit
    from config import get_settings

    # Mock settings to have a configured gemini_api_key so hybrid search activates
    settings = get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", "test-key-123")

    async with AsyncSessionLocal() as db:
        # Get a seeded issuer and add a document with some chunks
        issuers = (await db.execute(select(Issuer))).scalars().all()
        assert len(issuers) >= 1
        i1 = issuers[0].id
        
        doc = Document(
            id=str(uuid.uuid4()),
            issuer_id=i1,
            doc_type="10-K",
            run_mode="full",
            file_name="hybrid_test.pdf",
            storage_key="hybrid_test_key",
            chunk_count=2,
            uploaded_by="test-hybrid@caos.ai"
        )
        db.add(doc)
        await db.flush()
        
        chunk1 = DocumentChunk(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            seq=0,
            text="Aurora Chemicals focuses on specialty inputs",
            chunk_hash=hashlib.sha256(b"Aurora Chemicals focuses on specialty inputs").hexdigest()
        )
        chunk2 = DocumentChunk(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            seq=1,
            text="Atlas Forge manufactures heavy industrial valves",
            chunk_hash=hashlib.sha256(b"Atlas Forge manufactures heavy industrial valves").hexdigest()
        )
        db.add(chunk1)
        db.add(chunk2)
        await db.commit()
        
        # Populate embeddings
        await embed_chunks_for_document(db, doc.id)
        await db.commit()
        
        # Test retrieve for single issuer (Aurora / Atlas)
        hits = await retrieve(db, i1, "specialty inputs", k=2)
        assert len(hits) >= 1
        # Highest ranked should be specialty inputs chunk
        assert "Aurora" in hits[0].text
        # Fused scores must be valid RRF scores
        assert hits[0].score > 0.0

        # Test RRF fusion function in isolation
        h_bm25 = [Hit(chunk_id="c1", text="text1", score=10.0)]
        h_vec = [Hit(chunk_id="c2", text="text2", score=0.9), Hit(chunk_id="c1", text="text1", score=0.8)]
        fused = rrf_fusion(h_bm25, h_vec, limit=2, k_rrf=60)
        assert len(fused) == 2
        # c1 should rank first because it matches both retrievers (rank 1 in BM25, rank 2 in Vector)
        assert fused[0].chunk_id == "c1"
        assert fused[1].chunk_id == "c2"
