"""Tests for engine/rerank.py — the LLM-as-reranker lane.

The re-rank is the precision half of the dropped-claim-rate alarm fix: it
re-orders the top-`W` RRF-fused chunks so irrelevant chunks stop outranking
relevant ones before MMR packing. Policy: NO local model downloads — the re-rank
is one batched LLM call through the same API seam as every other engine lane
(``engine/llm_client.create``), on a model picked by the tier system.

These tests pin the contract: fault isolation (disabled → passthrough, no
provider key → passthrough, LLM call failure → passthrough, score-count mismatch
→ passthrough), top-K truncation with tail preserved, score clamp to [0,1], the
``rerank=False`` opt-out, the keyless short-circuit, and the ``retrieve_corpus``
wiring. A fake ``_score_pairs_llm`` stands in for the API call so the orchestration
tests are deterministic and network-free; one test exercises the real
``_score_pairs_llm`` against a mocked ``llm_client.create`` to pin the JSON
parsing, tier-model selection, and UNTRUSTED-chunk wrapping.
"""
from __future__ import annotations

import json
import math
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from retrieval import CorpusHit, retrieve_corpus
import engine.rerank as rerank_mod
from engine.rerank import rerank, _score_pairs_llm, _clamp01


def _hit(chunk_id: str, text: str, score: float = 1.0, issuer_id: str = "i1") -> CorpusHit:
    return CorpusHit(chunk_id=chunk_id, text=text, score=score, issuer_id=issuer_id, doc="d.pdf")


def _substring_scorer(query: str, chunks) -> list[float]:
    """0-1 relevance: fraction of query terms present in the chunk text. A
    deterministic stand-in for the LLM's relevance judgment — enough to test the
    re-sort + clamp + truncation wiring without a network call."""
    q_terms = set(query.lower().split())
    out: list[float] = []
    for c in chunks:
        t_terms = set(c.text.lower().split())
        overlap = len(q_terms & t_terms)
        out.append(overlap / max(1, len(q_terms)))
    return out


def _enable_rerank(monkeypatch, scores_fn=None, window=20, has_key: bool = True):
    """Flip RERANK_ENABLED on, pretend a provider key is present, and (optionally)
    inject a fake ``_score_pairs_llm`` so the lane runs without a network call."""
    base = SimpleNamespace(
        rerank_enabled=True,
        rerank_model_tier="cheap",
        rerank_window=window,
        caos_document_egress_enabled=True,
    )
    monkeypatch.setattr(rerank_mod, "get_settings", lambda: base)
    monkeypatch.setattr("engine.presets.can_run_model", lambda _m: has_key)
    monkeypatch.setattr("engine.presets.rerank_model", lambda: "fake/cheap")
    if scores_fn is not None:
        async def _fake(query, chunks):
            return scores_fn(query, chunks)
        monkeypatch.setattr(rerank_mod, "_score_pairs_llm", _fake)


# ── gate: disabled / no-key short-circuit ─────────────────────────────────────


@pytest.mark.asyncio
async def test_rerank_passthrough_when_disabled(monkeypatch):
    """RERANK_ENABLED unset (default) → return hits unchanged, no LLM call."""
    base = SimpleNamespace(rerank_enabled=False, rerank_model_tier="cheap", rerank_window=20)
    monkeypatch.setattr(rerank_mod, "get_settings", lambda: base)
    called = {"v": False}

    async def _boom(query, chunks):
        called["v"] = True
        return [1.0]
    monkeypatch.setattr(rerank_mod, "_score_pairs_llm", _boom)
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert out is hits  # identity — not even copied
    assert called["v"] is False  # gate fires before the LLM call


@pytest.mark.asyncio
async def test_rerank_passthrough_on_empty_hits(monkeypatch):
    """Empty hits short-circuit before the gate — no settings read needed."""
    _enable_rerank(monkeypatch, scores_fn=_substring_scorer)
    assert await rerank(db=None, query="x", hits=[], k=5) == []


@pytest.mark.asyncio
async def test_rerank_passthrough_when_no_provider_key(monkeypatch):
    """RERANK_ENABLED on but the tier model's provider key is missing → return
    hits unchanged. The lane never raises at the API client on a partial-key
    deploy (replaces the local-model load-failure path — no model to load now)."""
    _enable_rerank(monkeypatch, scores_fn=_substring_scorer, has_key=False)
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert [h.chunk_id for h in out] == ["c1", "c2"]  # original order preserved


# ── re-rank behavior: re-sort, truncate, clamp ────────────────────────────────


@pytest.mark.asyncio
async def test_rerank_resorts_by_llm_score(monkeypatch):
    """An irrelevant high-RRF chunk must drop below a relevant low-RRF chunk
    after the LLM re-scores. This is the precision fix in action."""
    _enable_rerank(monkeypatch, scores_fn=_substring_scorer)
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
    _enable_rerank(monkeypatch, scores_fn=_substring_scorer, window=4)
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
    # Head is the top-2 by LLM score (matching chunks — c4 scores 0).
    assert head <= {"c1", "c2", "c3"}
    # The irrelevant c4 must NOT be in the re-ranked top-2 head.
    assert "c4" not in head
    # Tail is the untouched hits beyond the window (c5, c6).
    assert tail == {"c5", "c6"}


@pytest.mark.asyncio
async def test_rerank_clamps_score_to_unit_interval(monkeypatch):
    """The LLM score is clamped to [0,1] so MMR's
    ``lambda * relevance - (1-lambda) * redundancy`` is not scale-dominated and
    never goes negative on an out-of-range model emission (e.g. 1.0001)."""

    def big_scorer(query, chunks):
        return [1.5 if "leverage" in c.text.lower() else -0.3 for c in chunks]

    _enable_rerank(monkeypatch, scores_fn=big_scorer)
    hits = [_hit("c1", "leverage data", 0.5), _hit("c2", "noisy", 0.9)]
    out = await rerank(db=None, query="leverage", hits=hits, k=2)
    for h in out:
        assert 0.0 <= h.score <= 1.0
    # The matching chunk's clamped score is exactly 1.0; the non-match 0.0.
    assert out[0].chunk_id == "c1"
    assert out[0].score == 1.0
    assert out[1].score == 0.0


@pytest.mark.asyncio
async def test_rerank_llm_call_failure_passthrough(monkeypatch):
    """If the LLM call raises (API error / overload / timeout), the lane degrades
    to the input order — never propagates the exception to the query lane."""

    async def _boom(query, chunks):
        raise RuntimeError("API exploded")
    _enable_rerank(monkeypatch)
    monkeypatch.setattr(rerank_mod, "_score_pairs_llm", _boom)
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert [h.chunk_id for h in out] == ["c1", "c2"]  # original order


@pytest.mark.asyncio
async def test_rerank_score_count_mismatch_passthrough(monkeypatch):
    """If the LLM returns a score count != hit count, degrade to passthrough
    rather than zip-truncating silently (a partial re-rank is worse than none)."""

    def _short(query, chunks):
        return [1.0]  # one score for N chunks
    _enable_rerank(monkeypatch, scores_fn=_short)
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert [h.chunk_id for h in out] == ["c1", "c2"]


@pytest.mark.asyncio
@pytest.mark.parametrize("score", [math.nan, math.inf, -math.inf])
async def test_rerank_nonfinite_injected_score_is_atomic_passthrough(monkeypatch, score):
    """A custom/injected scorer cannot bypass the orchestration boundary."""
    _enable_rerank(monkeypatch, scores_fn=lambda _query, chunks: [score] * len(chunks))
    hits = [_hit("c1", "alpha", 0.9), _hit("c2", "beta", 0.5)]
    out = await rerank(db=None, query="alpha", hits=hits, k=2)
    assert out is hits


# ── _score_pairs_llm: parsing + tier model + untrusted wrapping ───────────────


class _FakeResp:
    def __init__(self, text: str):
        self.content = [SimpleNamespace(type="text", text=text)]


@pytest.mark.asyncio
async def test_score_pairs_llm_parses_json_uses_tier_model_and_wraps(monkeypatch):
    """The real ``_score_pairs_llm`` (not the fake) must: call ``llm_client.create``
    with ``lane='rerank'`` and ``model=presets.rerank_model()``, wrap the chunks as
    UNTRUSTED content, and parse the JSON ``{'scores': [...]}`` reply into floats."""
    _enable_rerank(monkeypatch)  # makes presets.rerank_model() -> "fake/cheap"

    captured: dict = {}

    async def _fake_create(client, *, lane, model, effort=None, max_tokens=None,
                           system=None, messages=None, **kw):
        captured["lane"] = lane
        captured["model"] = model
        captured["system"] = system
        captured["messages"] = messages
        return _FakeResp(json.dumps({"scores": [0.82, 0.11, 0.40]}))

    def _fake_client():
        return SimpleNamespace()  # opaque client; never used by the fake create

    monkeypatch.setattr(rerank_mod.llm_client, "create", _fake_create)
    monkeypatch.setattr(rerank_mod.llm_client, "anthropic_client", _fake_client)

    chunks = [_hit("c1", "leverage rose"), _hit("c2", "weather report"), _hit("c3", "ebitda")]
    scores = await _score_pairs_llm("leverage", chunks)

    assert scores == [0.82, 0.11, 0.40]
    assert captured["lane"] == "rerank"
    assert captured["model"] == "fake/cheap"
    # The chunks are wrapped as untrusted content (prompt-injection defense).
    assert "UNTRUSTED DOCUMENT CONTENT" in captured["messages"][0]["content"]
    # Each chunk is numbered in order.
    assert "[0] leverage rose" in captured["messages"][0]["content"]
    assert "[2] ebitda" in captured["messages"][0]["content"]
    # The system prompt carries the untrusted-data rule.
    assert "untrusted" in captured["system"].lower()


@pytest.mark.asyncio
async def test_score_pairs_llm_raises_on_missing_scores_key(monkeypatch):
    """A malformed reply (no 'scores' list) raises so the caller fault-isolates."""
    _enable_rerank(monkeypatch)
    monkeypatch.setattr(rerank_mod.llm_client, "create",
                        lambda *a, **k: _async_return(_FakeResp('{"unrelated": 1}')))
    monkeypatch.setattr(rerank_mod.llm_client, "anthropic_client", lambda: SimpleNamespace())
    with pytest.raises(ValueError):
        await _score_pairs_llm("q", [_hit("c1", "text")])


@pytest.mark.asyncio
@pytest.mark.parametrize("encoded", ["NaN", "Infinity", "-Infinity", "1e999"])
async def test_score_pairs_llm_rejects_string_encoded_nonfinite(monkeypatch, encoded):
    _enable_rerank(monkeypatch)
    monkeypatch.setattr(
        rerank_mod.llm_client,
        "create",
        lambda *a, **k: _async_return(_FakeResp(json.dumps({"scores": [encoded]}))),
    )
    monkeypatch.setattr(
        rerank_mod.llm_client, "anthropic_client", lambda: SimpleNamespace()
    )
    with pytest.raises(ValueError, match="finite"):
        await _score_pairs_llm("q", [_hit("c1", "text")])


async def _async_return(value):
    return value


def test_clamp01_bounds():
    """Sanity: clamp maps anything to [0,1], preserves in-range values."""
    assert _clamp01(-0.3) == 0.0
    assert _clamp01(1.5) == 1.0
    assert _clamp01(0.0) == 0.0
    assert _clamp01(1.0) == 1.0
    assert _clamp01(0.42) == 0.42
    with pytest.raises(ValueError, match="finite"):
        _clamp01(math.nan)


# ── retrieve_corpus wiring ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_retrieve_corpus_rerank_false_opt_out(monkeypatch, seeded_db):
    """`rerank=False` must never invoke the reranker even when RERANK_ENABLED is
    on — the opt-out is for BM25-only paths (graph-expansion integration test)."""
    import hashlib
    import uuid
    from database import AsyncSessionLocal, Document, DocumentChunk, Issuer

    _enable_rerank(monkeypatch, scores_fn=_substring_scorer)
    monkeypatch.setattr("retrieval.get_settings", lambda: SimpleNamespace(
        rerank_enabled=True, rerank_model_tier="cheap", rerank_window=20,
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

    monkeypatch.setattr("retrieval.get_settings", lambda: SimpleNamespace(
        rerank_enabled=False, rerank_model_tier="cheap", rerank_window=20,
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
