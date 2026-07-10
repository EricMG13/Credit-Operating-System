"""Seed + metrics for the 2-hop graph expansion measurement harness.

Models the contagion-chain use case the graph-expansion lane serves: a cross-
issuer question whose relevant evidence lives in a PEER's chunks, reachable only
by traversing ratified ``QueryAcceptedLink`` edges. The seed is a synthetic
chain (Acme—Beta—Delta—Gamma) plus an unlinked control (Epsilon), with labeled
queries whose relevant chunks sit at increasing hop distances from the scoped
issuer. This lets the harness measure recall@K / precision@K / dilution as a
function of hop count and decide whether 2-hop's recall lift justifies its
dilution cost.

SYNTHETIC, NOT REAL: the handoff gates production 2-hop enablement on "a recall-
vs-precision measurement on REAL cross-issuer questions." This seed proves the
WIRING (n-hop traversal surfaces hop-appropriate chunks; the hop bound holds;
unlinked peers never leak in) and gives DIRECTIONAL numbers on the recall-vs-
dilution tradeoff. The real-data measurement on production cross-issuer queries
is the actual production gate — recorded in ``GRAPH_EXPANSION_2HOP_MEASUREMENT.md``.
Adding production-labeled pairs extends this seed in one place (``LABELS``).
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from typing import List, Sequence

from database import (
    Document, DocumentChunk, Issuer, QueryAcceptedLink,
)


@dataclass(frozen=True)
class GraphSeed:
    """Handle to the built corpus — the harness uses these ids to scope queries
    and to label which chunks are relevant for each query."""
    acme: str
    beta: str
    delta: str
    gamma: str
    epsilon: str          # unlinked control — must NEVER surface when scoped to the chain
    # chunk_id per issuer (one chunk each, keyed by issuer name for label clarity)
    chunks: dict[str, str]


# Each labeled query: the query text, the chunk-key(s) that are relevant, and
# the minimum hops from Acme required to reach the relevant issuer. The harness
# scopes every query to Acme and varies the hop count.
@dataclass(frozen=True)
class GraphLabel:
    query: str
    relevant_chunks: tuple[str, ...]   # issuer-name keys into GraphSeed.chunks
    min_hops: int                      # hops from Acme to the relevant issuer


LABELS: List[GraphLabel] = [
    GraphLabel("sponsor shared agreement",
               ("beta",), min_hops=1),       # Beta is 1-hop — 1-hop recall win
    GraphLabel("contagion sponsor chain exposure",
               ("delta",), min_hops=2),      # Delta is 2-hop — 2-hop recall win over 1-hop
    GraphLabel("sector overlap sponsor chain",
               ("gamma",), min_hops=3),      # Gamma is 3-hop — 2-hop bound check (still 0)
]


# Chunk text per issuer. Each mentions the query terms it should match so BM25
# surfaces it; the distractor issuer (Epsilon) mentions ALL query terms so it
# would surface if the scope ever leaked past the ratified graph.
_CHUNK_TEXT = {
    "acme": "Acme leverage deteriorated to 6.5x this LTM period.",  # no query terms — distractor
    "beta": "Beta shares a sponsor with Acme under the shared credit agreement.",
    "delta": "Delta contagion exposure via the sponsor chain to Acme is material.",
    "gamma": "Gamma sector overlap with Delta on the sponsor chain is notable.",
    "epsilon": "Epsilon sponsor contagion sector overlap shared agreement distractor.",
}


def _link(a: str, b: str) -> QueryAcceptedLink:
    lo, hi = (a, b) if a < b else (b, a)
    return QueryAcceptedLink(
        id=str(uuid.uuid4()), issuer_a=lo, issuer_b=hi,
        capability_id="cap-rel", rationale="seed", chunk_ids=[],
        confidence="Low", model="test",
    )


async def build_contagion_corpus(db) -> GraphSeed:
    """Build the chain Acme↔Beta↔Delta↔Gamma + unlinked Epsilon, each with one
    chunk. Returns ids for scoping + labeling. The harness uses a fresh
    ``seeded_db`` so re-builds don't collide."""
    ids = {name: str(uuid.uuid4()) for name in _CHUNK_TEXT}

    db.add_all([Issuer(id=iid, name=name, industry="Chemicals")
                for name, iid in ids.items()])
    await db.flush()
    # Ratified chain: Acme—Beta—Delta—Gamma. Epsilon has NO links.
    db.add_all([
        _link(ids["acme"], ids["beta"]),
        _link(ids["beta"], ids["delta"]),
        _link(ids["delta"], ids["gamma"]),
    ])
    await db.flush()

    chunks: dict[str, str] = {}
    for name, iid in ids.items():
        text = _CHUNK_TEXT[name]
        doc = Document(
            id=str(uuid.uuid4()), issuer_id=iid, doc_type="10-K",
            run_mode="full", file_name=f"{name.lower()}.pdf",
            storage_key=name.lower(), chunk_count=1, uploaded_by="bench@caos.ai",
        )
        db.add(doc)
        await db.flush()
        cid = str(uuid.uuid4())
        db.add(DocumentChunk(
            id=cid, document_id=doc.id, seq=0, text=text,
            chunk_hash=hashlib.sha256(text.encode()).hexdigest(),
        ))
        chunks[name] = cid
    await db.commit()
    return GraphSeed(
        acme=ids["acme"], beta=ids["beta"], delta=ids["delta"],
        gamma=ids["gamma"], epsilon=ids["epsilon"], chunks=chunks,
    )


# ── metrics ──────────────────────────────────────────────────────────────────

def recall_at_k(surfaced_chunk_ids: Sequence[str], relevant_chunk_ids: Sequence[str], k: int) -> float:
    """recall@K = |surfaced ∩ relevant| / |relevant|. 1.0 when every relevant
    chunk is in the surfaced top-K; 0.0 when none. The recall LIFT graph
    expansion is supposed to provide — a peer's evidence entering the pool."""
    if not relevant_chunk_ids:
        return 0.0
    top_k = list(surfaced_chunk_ids[:k])
    hits = sum(1 for cid in top_k if cid in relevant_chunk_ids)
    return hits / len(relevant_chunk_ids)


def precision_at_k(surfaced_chunk_ids: Sequence[str], relevant_chunk_ids: Sequence[str], k: int) -> float:
    """precision@K = |relevant in top-K| / K. The DILUTION signal — drops when
    irrelevant peer chunks enter the top-K and crowd out relevant ones."""
    if k <= 0:
        return 0.0
    top_k = list(surfaced_chunk_ids[:k])
    hits = sum(1 for cid in top_k if cid in relevant_chunk_ids)
    return hits / k


def dilution(surfaced_chunk_ids: Sequence[str], relevant_chunk_ids: Sequence[str]) -> float:
    """dilution = |irrelevant surfaced| / |surfaced|. The direct cost of
    widening the scope: what fraction of the expanded hits are NOT relevant.
    0.0 when every surfaced chunk is relevant; →1.0 as the pack fills with
    loosely-related peer chunks (the 2-hop risk the handoff names)."""
    if not surfaced_chunk_ids:
        return 0.0
    irrelevant = sum(1 for cid in surfaced_chunk_ids if cid not in relevant_chunk_ids)
    return irrelevant / len(surfaced_chunk_ids)
