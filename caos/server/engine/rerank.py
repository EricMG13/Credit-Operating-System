"""Cross-encoder re-rank — the precision half of the dropped-claim-rate fix.

The two shipped Phase-1 retrieval lanes (graph-expansion, metric-fact SQL) close
the **recall** gaps. This module closes the **precision** gap: irrelevant chunks
outranking relevant ones in the RRF-fused pack. A cross-encoder re-ranks the
top-`W` retrieved chunks AFTER RRF fusion, BEFORE context packing, so the packer
(MMR) consumes a relevance-ordered list instead of a rank-fusion-ordered one.

Self-hosted by design — `mxbai-rerank-large-v1` via `sentence-transformers`,
consistent with the codebase's "no external API in the core loop" posture (matches
the pgvector/embeddings decision). The model is lazy-loaded on the first call and
cached at module scope (single load per process, mirrors embeddings warmup).

Fault-isolated end to end: any failure (setting off, model missing, load fails,
inference fails) → return the input hits unchanged. A missing/corrupt weight
degrades to today's RRF-only ranking rather than crashing the query lane — the
dropped-claim-rate alarm names *better retrieval* as the fix, not a hard dep on
a model weight being present.
"""
from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import replace
from typing import Any, List, Optional, Sequence

from config import get_settings
from retrieval import CorpusHit

logger = logging.getLogger("caos.rerank")

# Module-level model cache. Loaded once on the first `rerank()` call that passes
# the gate; stays resident for the process lifetime (latency floor accepted —
# reload-per-call would pay the 670MB load on every query, far worse). A long-
# running multi-worker deploy holds N×670MB; documented in RT-2026-07-07-08.
_model_cache: Optional[Any] = None
_model_load_attempted: bool = False
_model_load_error: Optional[str] = None


def _sigmoid(x: float) -> float:
    """Logit → [0,1] probability. Places the cross-encoder score on a comparable
    scale to MMR's redundancy term (cosine/Jaccard, also [0,1]) so the packer's
    `lambda_mmr * relevance - (1-lambda_mmr) * redundancy` is not dominated by
    whichever scale is larger. See RT-2026-07-07-10."""
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def _load_model():
    """Lazy-load the cross-encoder. Imported inside the function so keyless
    deploys (no `sentence-transformers`) never pay the import cost. Returns the
    model or None on any failure (fault-isolated — caller degrades to passthrough)."""
    global _model_cache, _model_load_attempted, _model_load_error
    if _model_load_attempted:
        return _model_cache
    _model_load_attempted = True
    try:
        from sentence_transformers import CrossEncoder  # type: ignore[import-not-found]

        settings = get_settings()
        _model_cache = CrossEncoder(settings.rerank_model)
        logger.info("Loaded rerank model %s", settings.rerank_model)
    except Exception as exc:  # noqa: BLE001 — fault-isolated by design
        _model_load_error = repr(exc)
        _model_cache = None
        logger.warning(
            "Rerank model load failed (%s); degrading to passthrough. "
            "Set RERANK_ENABLED=false or install the weight to silence.",
            _model_load_error,
        )
    return _model_cache


def _score_pairs(model, query: str, pairs: Sequence[tuple[str, str]]) -> List[float]:
    """Run the cross-encoder on (query, text) pairs. Returns raw logits."""
    # CrossEncoder.predict accepts a list of (text_a, text_b) tuples.
    return list(model.predict(list(pairs)))


def _rerank_sync(
    hits: Sequence[CorpusHit],
    query: str,
    keep: int,
    window: int,
) -> List[CorpusHit]:
    """Synchronous re-rank core — runs in a worker thread via `asyncio.to_thread`."""
    model = _load_model()
    if model is None:
        return list(hits)

    # Re-rank only the top-`window` (latency bound); keep the rest in original order.
    head = list(hits[:window])
    tail = list(hits[window:])
    if not head:
        return list(hits)

    pairs = [(query, h.text) for h in head]
    try:
        raw_scores = _score_pairs(model, query, pairs)
    except Exception as exc:  # noqa: BLE001 — fault-isolated by design
        logger.warning("Rerank inference failed (%s); degrading to passthrough.", repr(exc))
        return list(hits)

    if len(raw_scores) != len(head):
        logger.warning(
            "Rerank returned %d scores for %d hits; degrading to passthrough.",
            len(raw_scores), len(head),
        )
        return list(hits)

    # Overwrite the score with the sigmoid-normalized cross-encoder score and re-sort.
    reranked = [
        replace(h, score=_sigmoid(float(s))) for h, s in zip(head, raw_scores)
    ]
    reranked.sort(key=lambda h: h.score, reverse=True)

    # Keep top-`keep` of the re-ranked head; append the untouched tail after.
    # The caller's `k` is the pack budget — we keep `keep` from the head so the
    # packer sees a precision-ordered top-K, and the tail stays available as
    # diversity fallback if MMR rejects head items on redundancy.
    return reranked[:keep] + tail


async def rerank(
    db: Any,
    query: str,
    hits: List[CorpusHit],
    k: int = 20,
    window: Optional[int] = None,
) -> List[CorpusHit]:
    """Re-rank retrieved hits with a cross-encoder. Fault-isolated passthrough.

    - Gate: `RERANK_ENABLED` setting unset → return hits unchanged (keyless/CI).
    - Lazy-load: the model loads on the first enabled call and stays cached.
    - Latency bound: re-ranks only the top-`window` (default `rerank_window`
      setting, 20), keeps the top-`k`.
    - Score: overwrites `CorpusHit.score` with the sigmoid-normalized
      cross-encoder logit (→ [0,1]) and re-sorts.

    ``db`` is accepted for interface symmetry with the other engine lanes but is
    not read today (the re-rank operates purely on the hit texts). Reserved for a
    future metadata-augmented rerank (e.g. boosting recent filings).
    """
    if not hits:
        return hits

    settings = get_settings()
    if not settings.rerank_enabled:
        return hits

    _w = window if window is not None else settings.rerank_window
    # If the caller wants more than the window, there's nothing to re-rank —
    # the tail would dominate. Just passthrough (avoids a pointless model call).
    if k > _w and len(hits) <= _w:
        return hits

    try:
        return await asyncio.to_thread(_rerank_sync, hits, query, k, _w)
    except Exception as exc:  # noqa: BLE001 — fault-isolated by design
        logger.warning("Rerank dispatch failed (%s); degrading to passthrough.", repr(exc))
        return hits


def reset_model_cache() -> None:
    """Test hook — clears the module-level model cache so a test can simulate a
    fresh process (e.g. to assert the lazy-load gate or to swap a fake model)."""
    global _model_cache, _model_load_attempted, _model_load_error
    _model_cache = None
    _model_load_attempted = False
    _model_load_error = None
