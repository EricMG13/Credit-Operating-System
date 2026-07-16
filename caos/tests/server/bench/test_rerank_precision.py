"""Re-rank precision benchmark — non-regression guard for the LLM-as-reranker lane.

Asserts the re-rank does not regress precision@K vs RRF-only on the seed labels
(``bench/seed_labels.py``), and lifts it on the cases engineered for a lift. This
is the measured half of the deferral reason named in the handoff ("without this,
the re-rank is an unmeasured latency cost").

Uses a fake ``_score_pairs_llm`` (substring-overlap scorer) so the benchmark is
deterministic and network-free. The fake is a stand-in for the LLM's *relevance
signal* — the benchmark proves the WIRING (re-rank lifts precision when the
reranker is better than RRF), not the live model's absolute quality. RT-2026-07-07-12
records that the seed is small by design (regression detection, not a powered
precision-lift study); the harness is structured so adding labeled pairs is a
one-line extension of ``SEED_LABELS``. A live-LLM precision measurement (against
the configured tier model) is a separate, key-gated run.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

import engine.rerank as rerank_mod
from engine.rerank import rerank
from seed_labels import SEED_LABELS, precision_at_k


def _substring_scorer(query, chunks) -> list[float]:
    """0-1 relevance: fraction of query terms present in the chunk text — a
    deterministic stand-in for the LLM's relevance judgment."""
    q_terms = set(query.lower().split())
    return [len(q_terms & set(c.text.lower().split())) / max(1, len(q_terms))
            for c in chunks]


@pytest.fixture(autouse=True)
def _enable_rerank_lane(monkeypatch):
    """Every bench test runs with rerank enabled + a fake ``_score_pairs_llm``
    (no network) + a pretended provider key, so the lane actually re-ranks."""
    monkeypatch.setattr(rerank_mod, "get_settings", lambda: SimpleNamespace(
        rerank_enabled=True, rerank_model_tier="cheap", rerank_window=20,
        caos_document_egress_enabled=True,
    ))
    monkeypatch.setattr("engine.presets.can_run_model", lambda _m: True)
    monkeypatch.setattr("engine.presets.rerank_model", lambda: "fake/cheap")

    async def _fake(query, chunks):
        return _substring_scorer(query, chunks)
    monkeypatch.setattr(rerank_mod, "_score_pairs_llm", _fake)
    yield


@pytest.mark.asyncio
async def test_rerank_precision_at_k_not_worse_than_rrf():
    """For every seed label: re-rank precision@K >= RRF precision@K. The re-rank
    must never regress precision on the known-good set — the non-regression
    guard for the latency cost it adds."""
    k = 2  # the top-K the packer would consume

    for query, relevant_ids, rrf_ordered_corpus in SEED_LABELS:
        # RRF-only baseline: the corpus as-is (already RRF-ordered by score).
        rrf_ids = [h.chunk_id for h in rrf_ordered_corpus]
        rrf_p = precision_at_k(rrf_ids, relevant_ids, k)

        # Re-ranked: run the cross-encoder over the same corpus.
        re_ranked = await rerank(db=None, query=query, hits=list(rrf_ordered_corpus), k=k)
        rerank_ids = [h.chunk_id for h in re_ranked]
        rerank_p = precision_at_k(rerank_ids, relevant_ids, k)

        assert rerank_p >= rrf_p, (
            f"re-rank regressed precision on {query!r}: "
            f"RRF={rrf_p} → rerank={rerank_p} (relevant={relevant_ids})"
        )


@pytest.mark.asyncio
async def test_rerank_lifts_precision_on_engineered_cases():
    """On at least one seed, the re-rank must STRICTLY lift precision@K — proving
    the wiring actually re-orders (not just no-op passes). The seeds are
    engineered so RRF mis-ranks an irrelevant chunk (c4) above a relevant one,
    and the re-rank corrects it."""
    k = 1  # strict: top-1 must become the relevant chunk

    lifts = 0
    for query, relevant_ids, rrf_ordered_corpus in SEED_LABELS:
        rrf_ids = [h.chunk_id for h in rrf_ordered_corpus]
        rrf_p = precision_at_k(rrf_ids, relevant_ids, k)
        re_ranked = await rerank(db=None, query=query, hits=list(rrf_ordered_corpus), k=k)
        rerank_p = precision_at_k([h.chunk_id for h in re_ranked], relevant_ids, k)
        if rerank_p > rrf_p:
            lifts += 1

    assert lifts >= 1, "re-rank never lifted precision — wiring is a no-op passthrough"


@pytest.mark.asyncio
async def test_rerank_seed_corpus_is_non_empty():
    """Structural guard: the seed labels must actually exercise the harness
    (a future empty-seed regression would make the precision assertions vacuous)."""
    assert len(SEED_LABELS) >= 3
    for query, relevant_ids, corpus in SEED_LABELS:
        assert query, "seed query must not be empty"
        assert relevant_ids, "seed must label at least one relevant chunk"
        assert len(corpus) >= 2, "seed corpus must have >=2 chunks to re-rank"
