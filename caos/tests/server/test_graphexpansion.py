"""Tests for engine/graphexpansion.py — the 1-hop ``QueryAcceptedLink``
graph-expansion retrieval lane (Phase 1 remainder).

The recall fix the dropped-claim-rate health alarm names: a scoped query today
retrieves only the scoped issuer's chunks, so a cross-issuer exposure question
("who else shares Acme's sponsor?") misses the peer's evidence. Expansion
widens the issuer set by analyst-ratified graph edges BEFORE the FTS/ANN
``WHERE issuer_id IN (...)`` so the peer's chunks enter the candidate pool and
fuse via RRF. These tests pin: empty-input degradation, both-direction
traversal, seed exclusion, dedup/sort, the unscoped (``None``) passthrough, and
the hops>1 v1 cap (still 1-hop — 2-hop is a measured follow-on).
"""

from __future__ import annotations

import uuid

import pytest

from database import AsyncSessionLocal, Issuer, QueryAcceptedLink
from engine.graphexpansion import expand_issuer_set, graph_neighbors


def _iid() -> str:
    return str(uuid.uuid4())


def _link(a: str, b: str, capability_id: str = "cap-rel") -> QueryAcceptedLink:
    """A ratified link with the lexical (a < b) normalization the model enforces."""
    lo, hi = (a, b) if a < b else (b, a)
    return QueryAcceptedLink(
        id=str(uuid.uuid4()), issuer_a=lo, issuer_b=hi,
        capability_id=capability_id, rationale="test", chunk_ids=[],
        confidence="Low", model="test",
    )


# ── graph_neighbors ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_graph_neighbors_empty_seeds_returns_empty(seeded_db):
    async with AsyncSessionLocal() as db:
        assert await graph_neighbors(db, []) == []


@pytest.mark.asyncio
async def test_graph_neighbors_no_links_returns_empty(seeded_db):
    async with AsyncSessionLocal() as db:
        acme_id = _iid()
        db.add(Issuer(id=acme_id, name="Acme", industry="Chemicals"))
        await db.commit()
        assert await graph_neighbors(db, [acme_id]) == []


@pytest.mark.asyncio
async def test_graph_neighbors_traverses_both_directions(seeded_db):
    """``issuer_a``/``issuer_b`` are lexically normalized so a pair exists once
    regardless of proposal direction — both "acme knows beta" and "beta knows
    acme" must surface beta as acme's neighbor."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id, gamma_id = _iid(), _iid(), _iid()
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
            Issuer(id=gamma_id, name="Gamma", industry="Chemicals"),
        ])
        await db.flush()
        db.add_all([_link(acme_id, beta_id), _link(acme_id, gamma_id)])
        await db.commit()
        out = await graph_neighbors(db, [acme_id])
    assert out == sorted([beta_id, gamma_id])  # sorted, deduped


@pytest.mark.asyncio
async def test_graph_neighbors_excludes_seeds_and_dedupes(seeded_db):
    """A link whose both endpoints are in the seed set contributes nothing —
    the seed issuers themselves are never in the neighbor list, and a pair
    seeded on both sides doesn't double-emit."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id = _iid(), _iid()
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
        ])
        await db.flush()
        db.add(_link(acme_id, beta_id))
        await db.commit()
        # Both seeded → neither is a "neighbor"; expansion is the union, but
        # graph_neighbors itself excludes seeds.
        out = await graph_neighbors(db, [acme_id, beta_id])
    assert out == []


@pytest.mark.asyncio
async def test_graph_neighbors_two_hop_traverses_chain(seeded_db):
    """n-hop BFS: ``hops=2`` reaches delta (acme→beta→delta) while ``hops=1``
    stops at beta. This is the traversal the measurement harness exercises to
    compare 1-hop vs 2-hop recall. The production retrieval path does NOT pass
    ``hops=2`` (see ``test_expand_issuer_set_default_stays_one_hop``)."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id, delta_id = _iid(), _iid(), _iid()
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
            Issuer(id=delta_id, name="Delta", industry="Chemicals"),
        ])
        await db.flush()
        db.add_all([_link(acme_id, beta_id), _link(beta_id, delta_id)])
        await db.commit()
        one_hop = await graph_neighbors(db, [acme_id], hops=1)
        two_hop = await graph_neighbors(db, [acme_id], hops=2)
    assert one_hop == [beta_id]              # 1-hop: direct neighbor only
    assert two_hop == sorted([beta_id, delta_id])  # 2-hop: chain reaches delta


@pytest.mark.asyncio
async def test_graph_neighbors_two_hop_handles_cycle_without_loop(seeded_db):
    """A cyclic ratified graph (triangle acme↔beta↔gamma↔acme) must not loop or
    revisit the seed at hops=2. The BFS visited-set bounds the traversal: hop 1
    surfaces the two direct neighbors; hop 2 finds no NEW nodes (the triangle's
    third edge leads back to visited nodes) and terminates."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id, gamma_id = _iid(), _iid(), _iid()
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
            Issuer(id=gamma_id, name="Gamma", industry="Chemicals"),
        ])
        await db.flush()
        db.add_all([_link(acme_id, beta_id), _link(beta_id, gamma_id),
                    _link(acme_id, gamma_id)])  # closes the triangle
        await db.commit()
        out = await graph_neighbors(db, [acme_id], hops=2)
    assert out == sorted([beta_id, gamma_id])  # both neighbors, no revisit of acme


# ── expand_issuer_set ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_expand_issuer_set_default_stays_one_hop(seeded_db):
    """Production gate: ``expand_issuer_set``'s default ``hops=1`` must NOT
    traverse 2-hop edges even when they exist. ``retrieve_corpus`` calls this
    helper with no ``hops`` arg, so the production retrieval scope stays 1-hop
    until the measurement artifact justifies wiring 2-hop in. A future agent
    flipping the default must read ``GRAPH_EXPANSION_2HOP_MEASUREMENT.md`` first."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id, delta_id = _iid(), _iid(), _iid()
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
            Issuer(id=delta_id, name="Delta", industry="Chemicals"),
        ])
        await db.flush()
        db.add_all([_link(acme_id, beta_id), _link(beta_id, delta_id)])
        await db.commit()
        default = await expand_issuer_set(db, [acme_id])  # no hops kwarg
        explicit_2 = await expand_issuer_set(db, [acme_id], hops=2)
    assert default == sorted([acme_id, beta_id])                  # 1-hop default
    assert explicit_2 == sorted([acme_id, beta_id, delta_id])     # opt-in 2-hop


@pytest.mark.asyncio
async def test_expand_issuer_set_none_passthrough(seeded_db):
    """Unscoped (``issuer_ids is None``) = whole corpus; expansion is a no-op
    and must return ``None`` so retrieve_corpus skips the ``WHERE IN`` entirely."""
    async with AsyncSessionLocal() as db:
        assert await expand_issuer_set(db, None) is None


@pytest.mark.asyncio
async def test_expand_issuer_set_no_neighbors_returns_seed(seeded_db):
    """A seed with no ratified links returns just the seed (sorted) — no
    expansion, but the issuer is still retrievable."""
    async with AsyncSessionLocal() as db:
        acme_id = _iid()
        db.add(Issuer(id=acme_id, name="Acme", industry="Chemicals"))
        await db.commit()
        out = await expand_issuer_set(db, [acme_id])
    assert out == [acme_id]


@pytest.mark.asyncio
async def test_expand_issuer_set_unions_seed_and_neighbors(seeded_db):
    """The expansion is seed ∪ 1-hop neighbors, sorted for deterministic
    downstream ``WHERE issuer_id IN (...)`` ordering."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id, gamma_id = _iid(), _iid(), _iid()
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
            Issuer(id=gamma_id, name="Gamma", industry="Chemicals"),
        ])
        await db.flush()
        db.add_all([_link(acme_id, beta_id), _link(acme_id, gamma_id)])
        await db.commit()
        out = await expand_issuer_set(db, [acme_id])
    assert out == sorted([acme_id, beta_id, gamma_id])


@pytest.mark.asyncio
async def test_expand_issuer_set_empty_seeds_returns_empty(seeded_db):
    """An empty seed list (not None) → empty list, not None. Distinct from the
    unscoped passthrough: a scoped-but-empty query retrieves nothing."""
    async with AsyncSessionLocal() as db:
        assert await expand_issuer_set(db, []) == []


# ── retrieve_corpus integration (end-to-end widening) ────────────────────────

@pytest.mark.asyncio
async def test_retrieve_corpus_expand_graph_widens_to_neighbor_chunks(seeded_db):
    """The recall fix in action: a scoped query over Acme also retrieves Beta's
    chunks when ``expand_graph=True`` and Acme↔Beta is a ratified link. With
    ``expand_graph=False`` (the default), Beta's chunks are invisible — the
    dropped-claim-rate scenario the health alarm names.

    BM25-only (no embeddings) — the conftest blanks ``GEMINI_API_KEY`` so the
    vector lane short-circuits and ``retrieve_corpus`` returns BM25 hits."""
    import hashlib

    from database import Document, DocumentChunk
    from retrieval import retrieve_corpus

    async with AsyncSessionLocal() as db:
        acme_id, beta_id = _iid(), _iid()
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
        ])
        await db.flush()
        db.add(_link(acme_id, beta_id))

        # Acme's doc mentions "leverage"; Beta's doc mentions "sponsor shared".
        # A scoped query "sponsor" over Acme should miss Beta's chunk without
        # expansion, and surface it with expansion.
        acme_doc = Document(
            id=str(uuid.uuid4()), issuer_id=acme_id, doc_type="10-K",
            run_mode="full", file_name="acme.pdf", storage_key="acme",
            chunk_count=1, uploaded_by="test@caos.ai")
        beta_doc = Document(
            id=str(uuid.uuid4()), issuer_id=beta_id, doc_type="10-K",
            run_mode="full", file_name="beta.pdf", storage_key="beta",
            chunk_count=1, uploaded_by="test@caos.ai")
        db.add_all([acme_doc, beta_doc])
        await db.flush()
        beta_text = "Beta shares a sponsor with Acme under the new credit agreement."
        db.add_all([
            DocumentChunk(
                id=str(uuid.uuid4()), document_id=acme_doc.id, seq=0,
                text="Acme leverage deteriorated to 6.5x.",
                chunk_hash=hashlib.sha256(b"Acme leverage deteriorated to 6.5x.").hexdigest()),
            DocumentChunk(
                id=str(uuid.uuid4()), document_id=beta_doc.id, seq=0,
                text=beta_text,
                chunk_hash=hashlib.sha256(beta_text.encode()).hexdigest()),
        ])
        await db.commit()

        # Default: scoped to Acme, no expansion → the answer lives in Beta's
        # chunk ("Beta shares a sponsor..."), which is invisible. This is the
        # dropped-claim-rate scenario: the question is unanswerable from the
        # scoped pool even though the corpus holds the evidence.
        narrow = await retrieve_corpus(db, "sponsor", k=8, issuer_ids=[acme_id])
        narrow_issuers = {h.issuer_id for h in narrow}
        assert beta_id not in narrow_issuers  # recall miss — the bug

        # Opt-in: graph-expand the scope → Beta's chunk enters the pool and
        # surfaces via BM25. The question is now answerable.
        wide = await retrieve_corpus(db, "sponsor", k=8, issuer_ids=[acme_id],
                                     expand_graph=True)
        wide_issuers = {h.issuer_id for h in wide}
        assert beta_id in wide_issuers  # recall fixed
        assert any("sponsor" in h.text for h in wide)  # the evidence surfaced
