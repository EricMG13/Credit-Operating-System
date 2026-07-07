"""Tests for engine/rerank.py — the cross-encoder re-rank lane.

The re-rank is the precision half of the dropped-claim-rate alarm fix: it
re-orders the top-`W` RRF-fused chunks so irrelevant chunks stop outranking
relevant ones before MMR packing. These tests pin the contract the handoff
names — fault isolation (model load failure → passthrough, inference failure →
passthrough), top-K truncation, the `rerank=False` opt-out, the keyless
short-circuit (RERANK_ENABLED unset), score normalization to [0,1], and the
`retrieve_corpus` wiring (re-rank runs only when enabled + model loads).

A fake cross-encoder stands in for `mxbai-rerank-large-v1` so the tests are
deterministic and never load the ~670MB weight. The fake scores (query, text)
pairs by a tunable relevance signal, which lets the benchmark harness prove the
*re-rank lifts precision vs RRF when the reranker is better than RRF* — the
wiring claim, not the real model's quality (RT-2026-07-07-12).
"""
from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace

import pytest

from retrieval import CorpusHit, retrieve_corpus
import engine.rerank as rerank_mod
import engine.rerank
from engine.rerank import rerank, reset_model_cache, _sigmoid


def _hit(chunk_id: str, text: str, score: float = 1.0, issuer_id: str = "i1") -> CorpusHit:
    return CorpusHit(chunk_id=chunk_id, text=text, score=score, issuer_id=issuer_id, doc="d.pdf")


class _FakeCrossEncoder:
    """Stands in for `sentence_transformers.CrossEncoder`. `predict` scores
    (query, text) pairs by a deterministic signal so tests are reproducible."""

    def __init__(self, scorer):
        self._scorer = scorer
        self.calls = 0

    def predict(self, pairs):
        self.calls += 1
        return [self._scorer(q, t) for q, t in pairs]


def _substring_scorer(query: str, text: str) -> float:
    """A logit-style score: high when the query terms appear in the text, low
    otherwise. Mimics a cross-encoder's relevance logit well enough to test the
    re-sort + sigmoid normalization."""
    q_terms = set(query.lower().split())
    t_terms = set(text.lower().split())
    overlap = len(q_terms & t_terms)
    # logit: +4 per overlapping term, -2 per missing term → sigmoid ∈ (0,1)
    return 4.0 * overlap - 2.0 * (len(q_terms) - overlap)


@pytest.fixture(autouse=True)
def _reset_cache():
    """Each test starts with a clean module-level model cache so lazy-load
    state from one test never bleeds into another."""
    reset_model_cache()
    yield
    reset_model_cache()


def _enable_rerank(monkeypatch, model=None, window=20):
    """Flip RERANK_ENABLED on and (optionally) inject a fake model so the
    lazy-load gate passes without `sentence-transformers` installed."""
    base = SimpleNamespace(
        rerank_enabled=True,
        rerank_model="fake/rerank",
        rerank_window=window,
    )
    monkeypatch.setattr(rerank_mod, "get_settings", lambda: base)
    if model is not None:
        # Bypass _load_model by pre-seeding the cache.
        rerank_mod._model_cache = model
        rerank_mod._model_load_attempted = True


# ── gate: keyless / disabled short-circuit ────────────────────────────────────


@pytest.mark.asyncio
async def test_rerank_passthrough_when_disabled(monkeypatch):
    """RERANK_ENABLED unset (default) → return hits unchanged, no model touch."""
    base = SimpleNamespace(rerank_enabled=False, rerank_model="x", rerank_window=20)
    monkeypatch.setattr(rerank_mod, "get_settings", lambda: base)
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert out is hits  # identity — not even copied
    assert rerank_mod._model_load_attempted is False  # gate fires before load


@pytest.mark.asyncio
async def test_rerank_passthrough_on_empty_hits(monkeypatch):
    """Empty hits short-circuit before the gate — no settings read needed."""
    _enable_rerank(monkeypatch, model=_FakeCrossEncoder(_substring_scorer))
    assert await rerank(db=None, query="x", hits=[], k=5) == []


@pytest.mark.asyncio
async def test_rerank_passthrough_on_load_failure(monkeypatch):
    """Model load failure (missing weight / no sentence-transformers) → return
    hits unchanged. The query lane never crashes on a missing reranker."""
    base = SimpleNamespace(rerank_enabled=True, rerank_model="missing/model", rerank_window=20)
    monkeypatch.setattr(rerank_mod, "get_settings", lambda: base)
    # Force the lazy-load to attempt a real import that fails.
    monkeypatch.setattr(
        "sys.modules", {**__import__("sys").modules, "sentence_transformers": None},
        raising=False,
    )
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert [h.chunk_id for h in out] == ["c1", "c2"]  # original order preserved
    assert rerank_mod._model_load_error is not None  # failure recorded for ops


# ── re-rank behavior: re-sort, truncate, normalize ────────────────────────────


@pytest.mark.asyncio
async def test_rerank_resorts_by_cross_encoder_score(monkeypatch):
    """An irrelevant high-RRF chunk must drop below a relevant low-RRF chunk
    after the cross-encoder re-scores. This is the precision fix in action."""
    model = _FakeCrossEncoder(_substring_scorer)
    _enable_rerank(monkeypatch, model=model)
    # c1 has a high RRF score but does NOT match the query; c2 matches.
    hits = [
        _hit("c1", "completely unrelated content", score=0.99),
        _hit("c2", "leverage deteriorated sharply", score=0.10),
    ]
    out = await rerank(db=None, query="leverage deteriorated", hits=hits, k=2)
    assert [h.chunk_id for h in out] == ["c2", "c1"]  # re-sorted by relevance


@pytest.mark.asyncio
async def test_rerank_truncates_to_k(monkeypatch):
    """Re-rank keeps the top-`k` from the re-ranked head; the tail (hits beyond
    the window) stays after as diversity fallback (MMR may still pick from it)."""
    model = _FakeCrossEncoder(_substring_scorer)
    _enable_rerank(monkeypatch, model=model, window=4)
    # 6 hits, window=4 → head=4 re-ranked, tail=2 untouched. keep=k=2.
    hits = [
        _hit("c1", "leverage", 0.9),
        _hit("c2", "leverage", 0.8),
        _hit("c3", "leverage", 0.7),
        _hit("c4", "unrelated", 0.6),
        _hit("c5", "leverage extra", 0.55),
        _hit("c6", "more noise", 0.5),
    ]
    out = await rerank(db=None, query="leverage", hits=hits, k=2)
    assert len(out) == 4  # 2 re-ranked head + 2 tail
    head = {out[0].chunk_id, out[1].chunk_id}
    tail = {out[2].chunk_id, out[3].chunk_id}
    # Head is the top-2 by cross-encoder score (matching chunks).
    assert head <= {"c1", "c2", "c3", "c5"}
    # The irrelevant c4 must NOT be in the re-ranked top-2 head.
    assert "c4" not in head
    # Tail is the untouched hits beyond the window (c5, c6).
    assert tail == {"c5", "c6"}


@pytest.mark.asyncio
async def test_rerank_normalizes_score_to_unit_interval(monkeypatch):
    """The cross-encoder logit is sigmoid-normalized to [0,1] so MMR's
    `lambda * relevance - (1-lambda) * redundancy` is not scale-dominated by the
    logit. RT-2026-07-07-10."""
    def big_logit_scorer(q, t):
        return 100.0 if "leverage" in t.lower() else -100.0

    model = _FakeCrossEncoder(big_logit_scorer)
    _enable_rerank(monkeypatch, model=model)
    hits = [_hit("c1", "leverage data", 0.5), _hit("c2", "noisy", 0.9)]
    out = await rerank(db=None, query="leverage", hits=hits, k=2)
    for h in out:
        assert 0.0 <= h.score <= 1.0
    # The matching chunk's normalized score is ~1.0 (sigmoid(100) ≈ 1).
    assert out[0].chunk_id == "c1"
    assert out[0].score > 0.999


@pytest.mark.asyncio
async def test_rerank_inference_failure_passthrough(monkeypatch):
    """If the model's `predict` raises, the lane degrades to the input order —
    never propagates the exception to the query lane."""

    class _BoomModel:
        def predict(self, pairs):
            raise RuntimeError("inference exploded")

    _enable_rerank(monkeypatch, model=_BoomModel())
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert [h.chunk_id for h in out] == ["c1", "c2"]  # original order


@pytest.mark.asyncio
async def test_rerank_score_count_mismatch_passthrough(monkeypatch):
    """If the model returns a score count != hit count, degrade to passthrough
    rather than zip-truncating silently (a partial re-rank is worse than none)."""

    class _ShortModel:
        def predict(self, pairs):
            return [1.0]  # one score for N pairs

    _enable_rerank(monkeypatch, model=_ShortModel())
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert [h.chunk_id for h in out] == ["c1", "c2"]


def test_sigmoid_bounds():
    """Sanity: sigmoid maps the real line to [0,1], monotonic. At extreme logits
    it saturates to exactly 0.0 / 1.0 (float precision), so use inclusive bounds."""
    assert _sigmoid(0.0) == 0.5
    assert 0.0 <= _sigmoid(-100.0) <= 0.001
    assert 0.999 <= _sigmoid(100.0) <= 1.0
    assert _sigmoid(2.0) > _sigmoid(1.0)


# ── retrieve_corpus wiring ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_retrieve_corpus_rerank_false_opt_out(monkeypatch, seeded_db):
    """`rerank=False` must never invoke the reranker even when RERANK_ENABLED is
    on — the opt-out is for BM25-only paths (graph-expansion integration test)."""
    import hashlib
    import uuid
    from database import AsyncSessionLocal, Document, DocumentChunk, Issuer

    # Enable rerank at the setting level AND inject a fake model — but pass
    # rerank=False to retrieve_corpus so neither is consulted.
    _enable_rerank(monkeypatch, model=_FakeCrossEncoder(_substring_scorer))
    monkeypatch.setattr("retrieval.get_settings", lambda: SimpleNamespace(
        rerank_enabled=True, rerank_model="fake/rerank", rerank_window=20,
        gemini_api_key="", embedding_model="text-embedding-004", embedding_dim=768,
    ))

    async with AsyncSessionLocal() as db:
        iid = str(uuid.uuid4())
        db.add(Issuer(id=iid, name="Acme", industry="Chemicals"))
        await db.flush()
        doc = Document(id=str(uuid.uuid4()), issuer_id=iid, doc_type="10-K",
                       run_mode="full", file_name="acme.pdf", storage_key="acme",
                       chunk_count=1, uploaded_by="t@caos.ai")
        db.add(doc)
        await db.flush()
        text = "Acme leverage deteriorated to 6.5x."
        db.add(DocumentChunk(id=str(uuid.uuid4()), document_id=doc.id, seq=0,
                             text=text,
                             chunk_hash=hashlib.sha256(text.encode()).hexdigest()))
        await db.commit()

        from unittest.mock import patch
        with patch("engine.rerank.rerank", side_effect=AssertionError("rerank must not be called")) as _spy:
            out = await retrieve_corpus(db, "leverage", k=8, issuer_ids=[iid], rerank=False)
        assert len(out) >= 1
        assert out[0].chunk_id is not None


@pytest.mark.asyncio
async def test_retrieve_corpus_rerank_disabled_by_default(monkeypatch, seeded_db):
    """Default RERANK_ENABLED=False → retrieve_corpus returns RRF-only ranking
    and never touches the reranker. This is the keyless/CI baseline."""
    import hashlib
    import uuid
    from database import AsyncSessionLocal, Document, DocumentChunk, Issuer

    # Settings with rerank DISABLED — the test env default.
    monkeypatch.setattr("retrieval.get_settings", lambda: SimpleNamespace(
        rerank_enabled=False, rerank_model="fake/rerank", rerank_window=20,
        gemini_api_key="", embedding_model="text-embedding-004", embedding_dim=768,
    ))

    async with AsyncSessionLocal() as db:
        iid = str(uuid.uuid4())
        db.add(Issuer(id=iid, name="Acme", industry="Chemicals"))
        await db.flush()
        doc = Document(id=str(uuid.uuid4()), issuer_id=iid, doc_type="10-K",
                       run_mode="full", file_name="acme.pdf", storage_key="acme",
                       chunk_count=1, uploaded_by="t@caos.ai")
        db.add(doc)
        await db.flush()
        text = "Acme leverage deteriorated to 6.5x."
        db.add(DocumentChunk(id=str(uuid.uuid4()), document_id=doc.id, seq=0,
                             text=text,
                             chunk_hash=hashlib.sha256(text.encode()).hexdigest()))
        await db.commit()

        # Must not raise (rerank gate short-circuits) and must return the chunk.
        out = await retrieve_corpus(db, "leverage", k=8, issuer_ids=[iid])
        assert any("leverage" in h.text for h in out)
