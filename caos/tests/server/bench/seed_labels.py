"""Seed labels for the re-rank precision benchmark — query → relevant chunk_ids.

Reused from the golden query-gate hit sets (`test_golden_query_gates.py:HITS`)
so the benchmark and the gate-semantics harness share a corpus. The golden
cases ship two hits (c1 = Acme leverage figure, c2 = Acme/Beta sector color);
this file extends them into query→relevant-label pairs the precision@K assertion
consumes.

Structure for one-line extension: append a `(query, relevant_ids, corpus)` tuple
to `SEED_LABELS` and the benchmark picks it up. `corpus` is a list of
`(chunk_id, text, score)` triples where `score` is a stand-in RRF score (the
benchmark re-ranks this list and compares precision@K against the same list
RRF-ordered).
"""
from __future__ import annotations

from typing import List, Tuple

from retrieval import CorpusHit

# A chunk_id → CorpusHit corpus the labels reference. Scores are stand-in RRF
# scores (higher = "ranked higher by RRF"); the benchmark re-ranks with the fake
# cross-encoder and checks whether the re-rank lifts the relevant chunk into the
# top-K vs the RRF order.
_CORPUS = {
    "c1": CorpusHit(chunk_id="c1", text="Acme reported net leverage of 4.4x for the LTM period.",
                    score=1.0, issuer_id="i1", doc="acme-10k.pdf"),
    "c2": CorpusHit(chunk_id="c2", text="Beta operates in the same sector as Acme.",
                    score=0.5, issuer_id="i2", doc="beta-10k.pdf"),
    "c3": CorpusHit(chunk_id="c3", text="Acme leverage covenant headroom is thin at 0.5x.",
                    score=0.8, issuer_id="i1", doc="acme-10k.pdf"),
    "c4": CorpusHit(chunk_id="c4", text="The filing was signed on Tuesday.",  # irrelevant
                    score=0.95, issuer_id="i1", doc="acme-10k.pdf"),
}

# (query, relevant_chunk_ids) — the labels. A re-rank that lifts a relevant id
# into the top-K vs the RRF order is a precision improvement; the benchmark
# asserts re-rank precision@K >= RRF precision@K (non-regression, with lift on
# the cases engineered for it).
SEED_LABELS: List[Tuple[str, List[str], List[CorpusHit]]] = [
    (
        "Acme net leverage",
        ["c1"],
        [_CORPUS["c4"], _CORPUS["c1"], _CORPUS["c2"]],  # RRF mis-ranks c4 above c1
    ),
    (
        "leverage covenant headroom",
        ["c3"],
        [_CORPUS["c4"], _CORPUS["c3"], _CORPUS["c2"]],  # RRF mis-ranks c4 above c3
    ),
    (
        "sector exposure Beta",
        ["c2"],
        [_CORPUS["c1"], _CORPUS["c2"], _CORPUS["c3"]],  # RRF mis-ranks c1 above c2
    ),
]


def precision_at_k(ranked_ids: List[str], relevant_ids: List[str], k: int) -> float:
    """Standard precision@K: |top-K ∩ relevant| / K. 0.0 when K=0."""
    if k <= 0:
        return 0.0
    top_k = ranked_ids[:k]
    hits = sum(1 for cid in top_k if cid in relevant_ids)
    return hits / k
