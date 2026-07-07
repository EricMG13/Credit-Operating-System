"""Measurement runner for the 2-hop graph expansion decision.

Prints recall@K / precision@K / dilution for each labeled query at hops
0 (no expansion), 1 (today's production default), 2 (the proposed follow-on),
and 3 (bound check), scoped to Acme on the synthetic contagion-chain seed.

Run:
    cd caos/server && .venv311/bin/python \\
        ../tests/server/bench/run_graphexpansion_measurement.py

The numbers this prints feed ``caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md``.
The seed is synthetic (RT-2026-07-07-17) — directional, not a powered
real-world claim. To re-run on production-labeled cross-issuer pairs, extend
``LABELS`` in ``graphexpansion_seed.py`` and re-run this script.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

# Make `engine.*`, `retrieval`, `database` importable (server dir) AND the bench
# package importable (this script's dir) without relying on pytest's conftest.
_BENCH_DIR = Path(__file__).resolve().parent
_SERVER_DIR = _BENCH_DIR.parents[2] / "server"
for _p in (_SERVER_DIR, _BENCH_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from database import AsyncSessionLocal, init_db  # noqa: E402
from engine.graphexpansion import expand_issuer_set  # noqa: E402
import retrieval  # noqa: E402
from retrieval import retrieve_corpus  # noqa: E402
from graphexpansion_seed import (  # noqa: E402
    LABELS, build_contagion_corpus, dilution, precision_at_k, recall_at_k,
)

# BM25-only, no rerank, no embeddings — isolate the graph-expansion effect.
retrieval.get_settings = lambda: SimpleNamespace(
    rerank_enabled=False, rerank_model="x", rerank_window=20,
    gemini_api_key="", embedding_model="text-embedding-004", embedding_dim=768,
)

K = 8
HOPS = (0, 1, 2, 3)


async def _scoped_hits(db, query, acme_id, hops):
    if hops <= 0:
        issuer_ids = [acme_id]
    else:
        issuer_ids = await expand_issuer_set(db, [acme_id], hops=hops)
    hits = await retrieve_corpus(
        db, query, k=K, issuer_ids=issuer_ids, expand_graph=False, rerank=False,
    )
    return [h.chunk_id for h in hits]


async def main() -> None:
    await init_db()
    async with AsyncSessionLocal() as db:
        seed = await build_contagion_corpus(db)
        print(f"\n2-hop graph expansion measurement — synthetic contagion seed, K={K}")
        print(f"scope: Acme; chain Acme—Beta—Delta—Gamma; Epsilon unlinked control\n")
        header = f"{'query':<42} {'min_hop':>7} | {'hops':>4} {'recall@K':>9} {'prec@K':>8} {'dilution':>9} {'#surf':>6}"
        print(header)
        print("-" * len(header))
        for label in LABELS:
            relevant = [seed.chunks[name] for name in label.relevant_chunks]
            for hops in HOPS:
                surfaced = await _scoped_hits(db, label.query, seed.acme, hops)
                r = recall_at_k(surfaced, relevant, K)
                p = precision_at_k(surfaced, relevant, K)
                d = dilution(surfaced, relevant)
                qstr = (label.query[:39] + "...") if len(label.query) > 42 else label.query
                print(f"{qstr:<42} {label.min_hops:>7} | {hops:>4} {r:>9.2f} {p:>8.2f} {d:>9.2f} {len(surfaced):>6}")
            print()
        # Epsilon leak check across all hops.
        leaked = False
        for label in LABELS:
            for hops in (0, 1, 2, 3, 5):
                surfaced = await _scoped_hits(db, label.query, seed.acme, hops)
                if seed.chunks["epsilon"] in surfaced:
                    print(f"  LEAK: Epsilon surfaced for {label.query!r} at hops={hops}")
                    leaked = True
        if not leaked:
            print("Epsilon (unlinked control) never surfaced at hops 0..5 — scope held.")


if __name__ == "__main__":
    asyncio.run(main())
