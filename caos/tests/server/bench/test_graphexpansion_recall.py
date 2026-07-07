"""2-hop graph expansion measurement harness — recall vs precision vs dilution
as a function of hop count, on a synthetic contagion-chain seed.

This is the measured follow-on the handoff names before 2-hop can be wired into
``retrieve_corpus``'s default scope. The harness scopes each labeled query to
Acme and varies the hop count (0 = no expansion, 1 = today's production default,
2 = the proposed follow-on, 3 = bound check), then measures:
  - recall@K:    |surfaced ∩ relevant| / |relevant|  — the recall lift
  - precision@K: |relevant in top-K| / K              — the dilution signal
  - dilution:    |irrelevant surfaced| / |surfaced|   — the direct widening cost

The assertions pin the DIRECTIONAL pattern (monotonic non-decreasing recall with
hops; the hop bound holds; unlinked peers never leak; 2-hop lifts recall for the
2-hop-relevant query that 1-hop misses) — not absolute numbers, which would be
cargo-cult on a synthetic seed (RT-2026-07-07-17). The decision artifact
(``caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md``) records the measured numbers
and the enable/don't-enable recommendation; the real-data measurement on
production cross-issuer queries is the actual production gate.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from database import AsyncSessionLocal
from engine.graphexpansion import expand_issuer_set
from retrieval import retrieve_corpus
from graphexpansion_seed import (
    LABELS, build_contagion_corpus, dilution, precision_at_k, recall_at_k,
)


@pytest.fixture(autouse=True)
def _keyless_retrieval(monkeypatch):
    """BM25-only, no rerank — the measurement isolates the GRAPH-EXPANSION
    effect (widening the issuer set), not the rerank or vector lanes. The
    conftest already blanks GEMINI_API_KEY; this also pins rerank off so a
    future RERANK_ENABLED=true CI run can't perturb the numbers."""
    monkeypatch.setattr("retrieval.get_settings", lambda: SimpleNamespace(
        rerank_enabled=False, rerank_model="x", rerank_window=20,
        gemini_api_key="", embedding_model="text-embedding-004", embedding_dim=768,
    ))


async def _scoped_hits(db, query: str, acme_id: str, k: int, hops: int):
    """Retrieve scoped to Acme's n-hop graph. hops=0 = no expansion (just Acme).
    The 2-hop+ measurement pre-expands the issuer set explicitly (the production
    ``retrieve_corpus`` only does 1-hop today) and passes expand_graph=False so
    retrieve_corpus doesn't re-expand."""
    if hops <= 0:
        issuer_ids = [acme_id]
    else:
        issuer_ids = await expand_issuer_set(db, [acme_id], hops=hops)
    hits = await retrieve_corpus(
        db, query, k=k, issuer_ids=issuer_ids, expand_graph=False, rerank=False,
    )
    return [h.chunk_id for h in hits]


@pytest.mark.asyncio
async def test_graphexpansion_recall_monotonic_in_hops(seeded_db):
    """recall@K must be monotonically non-decreasing in hops: widening the scope
    can only ADD candidate chunks, never remove them. This is the baseline
    guarantee — if recall ever DECREASES with hops, the traversal is dropping
    issuers (a bug)."""
    K = 8
    async with AsyncSessionLocal() as db:
        seed = await build_contagion_corpus(db)
        for label in LABELS:
            relevant = [seed.chunks[name] for name in label.relevant_chunks]
            recalls = [
                recall_at_k(await _scoped_hits(db, label.query, seed.acme, K, h),
                            relevant, K)
                for h in (0, 1, 2, 3)
            ]
            # Monotonic non-decreasing across hop counts.
            for i in range(1, len(recalls)):
                assert recalls[i] >= recalls[i - 1], (
                    f"{label.query!r}: recall decreased at hops={i} "
                    f"({recalls}) — widening the scope dropped a relevant chunk"
                )


@pytest.mark.asyncio
async def test_two_hop_lifts_recall_for_two_hop_relevant_query(seeded_db):
    """The 2-hop WIN: a query whose relevant chunk lives in a 2-hop peer (Delta)
    is unanswerable at 1-hop (recall@K=0) and answered at 2-hop (recall@K=1.0).
    This is the recall lift 2-hop is supposed to provide over today's production
    1-hop default — the whole reason the follow-on exists."""
    K = 8
    async with AsyncSessionLocal() as db:
        seed = await build_contagion_corpus(db)
        # The label with min_hops=2 — Delta is 2-hop from Acme.
        two_hop_label = next(l for l in LABELS if l.min_hops == 2)
        relevant = [seed.chunks[name] for name in two_hop_label.relevant_chunks]

        recall_1 = recall_at_k(await _scoped_hits(db, two_hop_label.query, seed.acme, K, 1), relevant, K)
        recall_2 = recall_at_k(await _scoped_hits(db, two_hop_label.query, seed.acme, K, 2), relevant, K)

    assert recall_1 == 0.0, "1-hop should not reach a 2-hop peer (Delta)"
    assert recall_2 == 1.0, "2-hop should reach Delta — the recall lift over 1-hop"


@pytest.mark.asyncio
async def test_two_hop_bound_does_not_reach_three_hop(seeded_db):
    """The hop BOUND: a query whose relevant chunk lives in a 3-hop peer (Gamma)
    must NOT be answered at hops=2 — the BFS depth limit holds. Gamma only
    surfaces at hops=3. This pins that 2-hop doesn't silently become unbounded."""
    K = 8
    async with AsyncSessionLocal() as db:
        seed = await build_contagion_corpus(db)
        three_hop_label = next(l for l in LABELS if l.min_hops == 3)
        relevant = [seed.chunks[name] for name in three_hop_label.relevant_chunks]

        recall_2 = recall_at_k(await _scoped_hits(db, three_hop_label.query, seed.acme, K, 2), relevant, K)
        recall_3 = recall_at_k(await _scoped_hits(db, three_hop_label.query, seed.acme, K, 3), relevant, K)

    assert recall_2 == 0.0, "2-hop must not reach Gamma (3-hop) — the bound holds"
    assert recall_3 == 1.0, "3-hop reaches Gamma — the bound is exact"


@pytest.mark.asyncio
async def test_unlinked_issuer_never_surfaces(seeded_db):
    """Epsilon is unlinked (no ratified edges) but its chunk mentions EVERY
    query term — a greedy distractor. It must NEVER surface when scoped to
    Acme's graph at any hop count, because graph expansion only travels ratified
    edges. If Epsilon leaks in, the scope is broken (unrelated peers polluting
    the pack)."""
    K = 8
    async with AsyncSessionLocal() as db:
        seed = await build_contagion_corpus(db)
        for label in LABELS:
            for hops in (0, 1, 2, 3, 5):
                surfaced = await _scoped_hits(db, label.query, seed.acme, K, hops)
                assert seed.chunks["epsilon"] not in surfaced, (
                    f"{label.query!r} at hops={hops}: unlinked Epsilon leaked "
                    f"into the scoped result — expansion traveled an unratified edge"
                )


@pytest.mark.asyncio
async def test_two_hop_dilution_exceeds_one_hop(seeded_db):
    """The 2-hop COST: widening to 2-hop pulls in Delta+Gamma, whose chunks
    match the query terms but are irrelevant to a 1-hop question (Q1 "sponsor
    shared agreement" — relevant is Beta only). dilution at hops=2 must exceed
    dilution at hops=1 for that query. This is the tradeoff the handoff names —
    the measurement must show the dilution cost, not just the recall win."""
    K = 8
    async with AsyncSessionLocal() as db:
        seed = await build_contagion_corpus(db)
        one_hop_label = next(l for l in LABELS if l.min_hops == 1)
        relevant = [seed.chunks[name] for name in one_hop_label.relevant_chunks]

        surfaced_1 = await _scoped_hits(db, one_hop_label.query, seed.acme, K, 1)
        surfaced_2 = await _scoped_hits(db, one_hop_label.query, seed.acme, K, 2)
        dilution_1 = dilution(surfaced_1, relevant)
        dilution_2 = dilution(surfaced_2, relevant)

    # 1-hop surfaces only Beta (relevant) — dilution 0.0.
    assert dilution_1 == 0.0, f"1-hop for a 1-hop-relevant query should have no dilution, got {dilution_1}"
    # 2-hop surfaces Beta + Delta + Gamma (Delta/Gamma match "sponsor" but are
    # irrelevant to Q1) — dilution > 0. This is the cost the decision weighs.
    assert dilution_2 > dilution_1, (
        f"2-hop dilution ({dilution_2}) should exceed 1-hop ({dilution_1}) — "
        f"widening to 2-hop must pull in irrelevant peer chunks"
    )


@pytest.mark.asyncio
async def test_measurement_seed_is_well_formed():
    """Structural guard: the seed labels must exercise the harness across all
    three hop distances (1, 2, 3) or the recall-lift and bound assertions are
    vacuous. A future seed regression that drops the 2-hop or 3-hop label would
    make the measurement meaningless."""
    min_hops = {l.min_hops for l in LABELS}
    assert {1, 2, 3} <= min_hops, (
        f"seed must label at least one query each at hops 1, 2, 3; got {min_hops}"
    )
    for label in LABELS:
        assert label.query, "label query must not be empty"
        assert label.relevant_chunks, "label must mark at least one relevant chunk"
        assert label.min_hops >= 1, "min_hops is distance from the scoped seed (Acme)"
