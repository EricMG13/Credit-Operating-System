"""Graph-expansion retrieval lane — 1-hop ``QueryAcceptedLink`` traversal to
widen a scoped retrieval's issuer set (Phase 1 remainder).

The recall fix the dropped-claim-rate health alarm points at: a scoped query
("what's Acme's leverage?") today retrieves only Acme's chunks, so a question
that's really about Acme's *exposure to* a peer/sponsor ("who else shares Acme's
sponsor?") misses the peer's chunks entirely. Expanding the issuer set by the
analyst-ratified graph edges before retrieval lets the peer's evidence enter the
candidate pool, fuse via RRF, and surface — without changing the FTS/ANN ranking
itself. ``query_accepted_links`` are analyst-ratified (the flywheel), so the
expansion travels only trusted edges — no model-proposed-but-unratified links.

v1: 1-hop is the production default (``retrieve_corpus`` → ``expand_issuer_set``
with ``hops=1``). n-hop traversal is implemented (BFS, visited-set bounded) and
opt-in via ``hops>1`` for the measurement harness; wiring 2-hop into the
default scope is gated on the measurement artifact
(``caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md``) — 2-hop risks pulling in
loosely-related issuers and diluting the pack. The expansion is opt-in
(``retrieve_corpus(expand_graph=True)``) so unscoped queries (already
whole-corpus) and lanes that want strict issuer scoping are unchanged. No new
dependency, no schema — the links table already exists.
"""

from __future__ import annotations

import logging
from typing import List, Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import QueryAcceptedLink

logger = logging.getLogger("caos.graphexpansion")


async def graph_neighbors(db: AsyncSession, issuer_ids: Sequence[str],
                          *, hops: int = 1) -> List[str]:
    """N-hop ``QueryAcceptedLink`` neighbors of the given issuers (both
    directions — ``issuer_a``/``issuer_b`` are lexically normalized, so a pair
    exists once regardless of proposal direction). Excludes the seed issuers
    themselves; deduped; sorted for deterministic downstream ordering.

    ``hops`` controls the BFS depth (1 = direct neighbors, 2 = neighbors of
    neighbors, etc.). The traversal is bounded by ``hops`` with a visited set
    seeded by the input issuers, so cycles in the ratified graph can't make it
    run past the requested depth. The production retrieval path
    (``retrieve_corpus`` → ``expand_issuer_set``) calls this with the default
    ``hops=1``; 2-hop is opt-in and gated on the measurement artifact
    (``caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md``) before it is wired into
    the default scope."""
    if not issuer_ids:
        return []
    seed = set(issuer_ids)
    visited: set = set(seed)
    frontier: set = set(seed)
    for _ in range(hops):
        if not frontier:
            break
        rows = (await db.execute(
            select(QueryAcceptedLink.issuer_a, QueryAcceptedLink.issuer_b)
            .where(or_(QueryAcceptedLink.issuer_a.in_(list(frontier)),
                       QueryAcceptedLink.issuer_b.in_(list(frontier))))
        )).all()
        next_frontier: set = set()
        for a, b in rows:
            if a in frontier and b not in visited:
                next_frontier.add(b)
            if b in frontier and a not in visited:
                next_frontier.add(a)
        visited |= next_frontier
        frontier = next_frontier
    # Exclude the original seeds from the returned neighbor set.
    return sorted(visited - seed)


async def expand_issuer_set(db: AsyncSession, issuer_ids: Sequence[str] | None,
                            *, hops: int = 1) -> List[str] | None:
    """Return the expanded issuer set (seed ∪ n-hop neighbors), or ``None`` when
    ``issuer_ids`` is None (unscoped — already whole-corpus; expansion is a
    no-op). This is the helper ``retrieve_corpus(expand_graph=True)`` calls so
    the FTS/ANN ``WHERE issuer_id IN (...)`` runs over the graph-widened set.

    ``hops`` defaults to 1 (the production v1 scope). ``hops=2`` is supported
    for the measurement harness but is NOT wired into ``retrieve_corpus`` until
    the measurement artifact justifies it — see
    ``caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md``."""
    if issuer_ids is None:
        return None
    neighbors = await graph_neighbors(db, issuer_ids, hops=hops)
    if not neighbors:
        return list(issuer_ids)
    expanded = set(issuer_ids) | set(neighbors)
    return sorted(expanded)
