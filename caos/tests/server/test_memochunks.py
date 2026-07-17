"""Tests for engine/memochunks.py — chunking analyst memos into the retrieval
corpus, and the three guards that keep memos in the Q2 query path but out of the
engine run path and the source-coverage readiness count.

Pinned contracts (RT-2026-07-07-13/14/15/16):
- One ``analyst-memo`` Document per linked issuer, each carrying the memo chunks.
- Memos linking zero issuers (or empty text) stay vault-only — no documents.
- Idempotent on title — re-upload replaces the prior memo's docs/chunks/lineage.
- Same text → same ``chunk_hash`` across the per-issuer copies (embedding dedup).
- ``build_issuer_index`` (the run-path chokepoint) excludes ``analyst-memo`` docs
  so CP-1–CP-6 never cite commentary as source truth.
- ``retrieve_corpus`` (the Q2 path) INCLUDES ``analyst-memo`` docs.
- ``readiness._categorize`` short-circuits to no category for ``analyst-memo``.
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
    Issuer,
    LineageEdge,
)
from engine.memochunks import chunk_memo_into_corpus, MEMO_DOC_TYPE


@pytest.mark.asyncio
async def test_chunk_memo_noops_when_chunker_extracts_nothing(monkeypatch):
    """Non-empty input can still be non-extractable; do not create an empty doc."""
    monkeypatch.setattr("engine.memochunks.chunk_text", lambda _text: [])

    assert await chunk_memo_into_corpus(
        None, "Binary-only memo", "non-empty", ["issuer-1"], "analyst@example.test",
    ) == []


@pytest.mark.asyncio
async def test_reupload_replaces_prior_memo_that_had_no_chunks(seeded_db):
    """A legacy/partial memo document can exist before its chunks were written."""
    from engine.memochunks import _delete_prior_memo_docs

    async with AsyncSessionLocal() as db:
        i1, _ = await _seed_two_issuers(db)
        empty_prior = Document(
            issuer_id=i1,
            doc_type=MEMO_DOC_TYPE,
            file_name="Legacy Empty Memo",
            storage_key="memo:Legacy Empty Memo",
            chunk_count=0,
            uploaded_by="a@b.c",
        )
        db.add(empty_prior)
        await db.flush()
        prior_id = empty_prior.id

        await _delete_prior_memo_docs(db, "Legacy Empty Memo", None)
        await db.flush()

        assert await db.get(Document, prior_id) is None


async def _seed_two_issuers(db) -> tuple[str, str]:
    """Ensure two distinct issuers exist (the seeded reference deal ships one)."""
    existing = (await db.execute(select(Issuer))).scalars().all()
    by_name = {i.name: i.id for i in existing}
    if "Atlas Forge Industrials" in by_name:
        i1 = by_name["Atlas Forge Industrials"]
    else:
        iss1 = Issuer(id=str(uuid.uuid4()), name="Atlas Forge Industrials", ticker="ATLF")
        db.add(iss1)
        await db.flush()
        i1 = iss1.id
    if "Beta Industries" in by_name:
        i2 = by_name["Beta Industries"]
    else:
        iss2 = Issuer(id=str(uuid.uuid4()), name="Beta Industries", ticker="BETA")
        db.add(iss2)
        await db.flush()
        i2 = iss2.id
    await db.commit()
    return i1, i2


@pytest.mark.asyncio
async def test_chunk_memo_creates_one_doc_per_linked_issuer(seeded_db):
    async with AsyncSessionLocal() as db:
        i1, i2 = await _seed_two_issuers(db)
        body = "Atlas Forge and Beta Industries both face rising input costs this quarter. " * 3

        doc_ids = await chunk_memo_into_corpus(db, "Weekly Wrap", body, [i1, i2], "a@b.c")
        await db.commit()

        assert len(doc_ids) == 2
        docs = (await db.execute(
            select(Document).where(Document.id.in_(doc_ids))
        )).scalars().all()
        assert {d.issuer_id for d in docs} == {i1, i2}
        assert all(d.doc_type == MEMO_DOC_TYPE for d in docs)
        assert all(d.file_name == "Weekly Wrap" for d in docs)
        assert all(d.chunk_count > 0 for d in docs)

        # Each document carries its own chunk rows (same text → same hash).
        chunks = (await db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id.in_(doc_ids))
        )).scalars().all()
        per_doc = {doc_ids[0]: 0, doc_ids[1]: 0}
        for c in chunks:
            per_doc[c.document_id] += 1
        assert per_doc[doc_ids[0]] == per_doc[doc_ids[1]]
        assert per_doc[doc_ids[0]] > 0


@pytest.mark.asyncio
async def test_chunk_memo_no_link_issuers_is_noop(seeded_db):
    async with AsyncSessionLocal() as db:
        await _seed_two_issuers(db)
        body = "Free-form commentary that links no known issuer."

        doc_ids = await chunk_memo_into_corpus(db, "Orphan Note", body, [], "a@b.c")
        await db.commit()

        assert doc_ids == []
        orphan = (await db.execute(
            select(Document).where(Document.doc_type == MEMO_DOC_TYPE, Document.file_name == "Orphan Note")
        )).scalars().all()
        assert orphan == []


@pytest.mark.asyncio
async def test_chunk_memo_empty_text_is_noop(seeded_db):
    async with AsyncSessionLocal() as db:
        i1, _ = await _seed_two_issuers(db)

        doc_ids = await chunk_memo_into_corpus(db, "Empty", "   \n  ", [i1], "a@b.c")
        await db.commit()

        assert doc_ids == []
        empty = (await db.execute(
            select(Document).where(Document.doc_type == MEMO_DOC_TYPE, Document.file_name == "Empty")
        )).scalars().all()
        assert empty == []


@pytest.mark.asyncio
async def test_chunk_memo_idempotent_on_re_upload(seeded_db):
    async with AsyncSessionLocal() as db:
        i1, i2 = await _seed_two_issuers(db)
        body = "Re-upload idempotency check. Atlas Forge and Beta Industries commentary. " * 5

        first = await chunk_memo_into_corpus(db, "Idempotent Memo", body, [i1, i2], "a@b.c")
        await db.commit()
        assert len(first) == 2

        # Re-upload with the SAME title → replaces, not duplicates.
        second = await chunk_memo_into_corpus(db, "Idempotent Memo", body + " extra line.", [i1, i2], "a@b.c")
        await db.commit()

        assert len(second) == 2
        # The first call's documents (and their chunks) are gone — replaced, not accumulated.
        old_docs = (await db.execute(
            select(Document).where(Document.id.in_(first))
        )).scalars().all()
        assert old_docs == []
        old_chunks = (await db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id.in_(first))
        )).scalars().all()
        assert old_chunks == []
        # Exactly two memo docs remain for the title (not 4).
        docs_after = (await db.execute(
            select(Document).where(Document.doc_type == MEMO_DOC_TYPE, Document.file_name == "Idempotent Memo")
        )).scalars().all()
        assert len(docs_after) == 2
        assert {d.id for d in docs_after} == set(second)
        # No dangling lineage chunk-artifacts referencing deleted chunks. Scope to
        # THIS memo's docs (parent_id == f"doc:{id}") — the shared process-global
        # test DB carries unrelated lineage from other tests, so a global scan is
        # not hermetic (see [[caos-test-shared-db-gotcha]]).
        our_parents = {f"doc:{d}" for d in second}
        our_lineage = (await db.execute(
            select(LineageEdge).where(LineageEdge.parent_id.in_(our_parents))
        )).scalars().all()
        chunk_artifacts = {le.artifact_id for le in our_lineage if le.artifact_id.startswith("chunk:")}
        live_chunk_ids = {f"chunk:{cid}" for cid in (await db.execute(select(DocumentChunk.id))).scalars().all()}
        assert chunk_artifacts <= live_chunk_ids


@pytest.mark.asyncio
async def test_chunk_memo_chunks_share_hash_across_issuers(seeded_db):
    async with AsyncSessionLocal() as db:
        i1, i2 = await _seed_two_issuers(db)
        body = "Shared hash check. " * 20  # force ≥1 chunk

        doc_ids = await chunk_memo_into_corpus(db, "Hash Memo", body, [i1, i2], "a@b.c")
        await db.commit()

        chunks = (await db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id.in_(doc_ids)).order_by(DocumentChunk.document_id, DocumentChunk.seq)
        )).scalars().all()
        by_doc: dict[str, list[DocumentChunk]] = {}
        for c in chunks:
            by_doc.setdefault(c.document_id, []).append(c)
        a, b = list(by_doc.values())
        assert len(a) == len(b)
        # Same text per seq → same chunk_hash (the embedding-dedup invariant).
        for ca, cb in zip(a, b):
            assert ca.text == cb.text
            assert ca.chunk_hash == cb.chunk_hash
            expected = hashlib.sha256(ca.text.encode("utf-8")).hexdigest()
            assert ca.chunk_hash == expected


@pytest.mark.asyncio
async def test_build_issuer_index_excludes_analyst_memos(seeded_db):
    """The run-path chokepoint: build_issuer_index must NOT include memo chunks,
    so CP-1–CP-6 never cite analyst commentary as source truth (RT-2026-07-07-14)."""
    from retrieval import build_issuer_index

    async with AsyncSessionLocal() as db:
        i1, _ = await _seed_two_issuers(db)
        # A regular source doc + chunk (should appear in the index).
        reg = Document(
            issuer_id=i1, doc_type="10-K", file_name="reg.pdf",
            storage_key="reg", chunk_count=1, uploaded_by="t",
        )
        db.add(reg)
        await db.flush()
        reg_chunk = DocumentChunk(
            id=str(uuid.uuid4()), document_id=reg.id, seq=0,
            text="Atlas Forge audited financials revenue 2742.",
            chunk_hash=hashlib.sha256(b"Atlas Forge audited financials revenue 2742.").hexdigest(),
        )
        db.add(reg_chunk)
        # A memo doc + chunk under the SAME issuer (must be excluded).
        memo_ids = await chunk_memo_into_corpus(
            db, "Memo With Financials",
            "Atlas Forge leverage looks around 5x based on my read of the 10-K. " * 5,
            [i1], "a@b.c",
        )
        await db.commit()
        assert memo_ids  # sanity

        index = await build_issuer_index(db, i1)
        chunk_ids_in_index = {doc[0] for doc in index.docs}
        assert reg_chunk.id in chunk_ids_in_index
        memo_chunks = (await db.execute(
            select(DocumentChunk.id).where(DocumentChunk.document_id.in_(memo_ids))
        )).scalars().all()
        assert all(cid not in chunk_ids_in_index for cid in memo_chunks)


@pytest.mark.asyncio
async def test_retrieve_corpus_includes_analyst_memos(seeded_db):
    """The Q2 query path: retrieve_corpus must INCLUDE memo chunks so query
    answers can cite the analyst's own prior commentary (the point of the phase)."""
    from retrieval import retrieve_corpus

    async with AsyncSessionLocal() as db:
        i1, _ = await _seed_two_issuers(db)
        # A memo with a very distinctive phrase that does not appear elsewhere.
        needle = "Zyngorian cobalt supply is the key risk for Atlas Forge this quarter"
        memo_ids = await chunk_memo_into_corpus(
            db, "Needle Memo", needle + ". " + needle + ".",
            [i1], "a@b.c",
        )
        await db.commit()
        assert memo_ids

        # BM25 lane runs without an API key; the needle is unique to the memo.
        hits = await retrieve_corpus(db, needle, k=10, issuer_ids=[i1], rerank=False)
        assert hits, "expected at least one hit for the memo needle"
        memo_chunk_ids = set((await db.execute(
            select(DocumentChunk.id).where(DocumentChunk.document_id.in_(memo_ids))
        )).scalars().all())
        assert any(h.chunk_id in memo_chunk_ids for h in hits)


@pytest.mark.asyncio
async def test_warmup_embeddings_never_egresses_analyst_memos(seeded_db, monkeypatch):
    """Analyst commentary remains BM25-only even when external embedding egress
    is explicitly enabled for issuer source documents."""
    from config import get_settings
    from engine.embeddings import warmup_embeddings_task
    from database import DocumentChunkEmbedding

    async with AsyncSessionLocal() as db:
        i1, i2 = await _seed_two_issuers(db)
        # Distinct sentences so chunk_text produces multiple UNIQUE hashes.
        body = (
            "Atlas Forge faces rising cobalt input costs this quarter. "
            "Beta Industries is exposed to the same cobalt supply chain. "
            "Both issuers share a key supplier concentrated in one region. "
            "I expect leverage to compress modestly through year-end for both. "
            "Covenant headroom remains adequate at current EBITDA levels."
        )
        memo_doc_ids = await chunk_memo_into_corpus(db, "Warmup Memo", body, [i1, i2], "a@b.c")
        await db.commit()
        assert len(memo_doc_ids) == 2

        # Mock embeddings so it's deterministic and doesn't call the API.
        settings = get_settings()
        monkeypatch.setattr(settings, "embedding_model", "test-mock")
        monkeypatch.setattr(settings, "caos_document_egress_enabled", True)
        monkeypatch.setattr(settings, "gemini_api_key", "test-key")

        import engine.embeddings as emb_mod
        async def _fake_get_embeddings(texts):
            return [[0.1] * settings.embedding_dim for _ in texts]
        monkeypatch.setattr(emb_mod, "get_embeddings", _fake_get_embeddings)

        await warmup_embeddings_task(db)

        # No memo hash may be sent/persisted under the provider model.
        memo_chunks = (await db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id.in_(memo_doc_ids))
        )).scalars().all()
        unique_hashes = {c.chunk_hash for c in memo_chunks}
        assert len(unique_hashes) >= 1
        assert len(memo_chunks) > len(unique_hashes), "expected duplicate-hash rows (the dedup scenario)"
        for h in unique_hashes:
            rows = (await db.execute(
                select(DocumentChunkEmbedding).where(
                    DocumentChunkEmbedding.model == "test-mock",
                    DocumentChunkEmbedding.chunk_hash == h,
                )
            )).scalars().all()
            assert rows == [], f"memo hash {h[:8]} was externally embedded"


def test_readiness_excludes_analyst_memos():
    """_categorize short-circuits to no category for analyst-memo docs, even when
    the commentary mentions source-filing terms (RT-2026-07-07-15)."""
    from engine.readiness import _categorize

    memo = Document(
        issuer_id="i1", doc_type=MEMO_DOC_TYPE, file_name="memo.md",
        storage_key="memo", chunk_count=1,
    )
    # Commentary head mentions credit-agreement + 10-K markers — must NOT classify.
    cats = _categorize(memo, head="This memo discusses the credit agreement and form 10-K for Atlas Forge.")
    assert cats == set()

    # A real 10-K doc still classifies (regression guard for the narrow filter).
    tenk = Document(
        issuer_id="i1", doc_type="10-K", file_name="atlas-10k.pdf",
        storage_key="k", chunk_count=1,
    )
    assert "financials" in _categorize(tenk, head="Form 10-K annual report consolidated balance sheet.")
