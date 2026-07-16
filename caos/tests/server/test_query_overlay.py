"""Query model lanes (engine/queryoverlay.py): the grounding gate and the
degrade paths. A proposed edge survives ONLY between real node ids with real
citations; suggested walks only from the enabled registry; unchanged graph →
cached artifact, no second LLM call; keyless environment reports unavailable."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from engine import queryoverlay


GRAPH = {
    "capability_id": "peer-set",
    "mode": "peers",
    "title": "Peers of Acme",
    "meta": ["focus: Acme"],
    "caveats": [],
    "nodes": [
        {"id": "acme", "label": "Acme", "kind": "center", "x": 0.5, "y": 0.5},
        {"id": "beta", "label": "Beta Corp", "kind": "issuer", "x": 0.2, "y": 0.2},
        {"id": "gamma", "label": "Gamma Ltd", "kind": "issuer", "x": 0.8, "y": 0.2},
    ],
    "edges": [{"source": "acme", "target": "beta", "label": "#1"}],
}

CAPS = {"groups": [{"id": "g", "label": "G", "icon": "", "ready": 2, "total": 3, "capabilities": [
    {"id": "peer-set", "label": "Peer set", "mode": "peers", "enabled": True, "reason": None},
    {"id": "contagion", "label": "Contagion query", "mode": "contagion", "enabled": True, "reason": None},
    {"id": "run-diff", "label": "Run diff", "mode": "provenance", "enabled": False, "reason": "needs ≥2 runs"},
]}], "availability": {}}


def _fake_anthropic(monkeypatch, text: str, calls: list):
    import anthropic

    class _M:
        async def create(self, **kw):
            calls.append(kw)
            return SimpleNamespace(
                content=[SimpleNamespace(type="text", text=text)], usage=None, model="fake-model"
            )

    class _C:
        messages = _M()

    monkeypatch.setattr(anthropic, "AsyncAnthropic", lambda **kw: _C())


def _wire_graph(monkeypatch):
    from config import get_settings

    async def _build(db, cap_id, issuer_id=None):
        if cap_id != "peer-set":
            raise KeyError(cap_id)
        return GRAPH

    async def _caps(db):
        return CAPS

    async def _retrieve(db, query, k=8, issuer_ids=None, analyst_id=None):
        return [SimpleNamespace(chunk_id="c1", text="Beta supplies Gamma."),
                SimpleNamespace(chunk_id="c2", text="Acme 10-K.")]

    monkeypatch.setattr(queryoverlay.querygraph, "build_graph", _build)
    monkeypatch.setattr(queryoverlay.querygraph, "capabilities", _caps)
    monkeypatch.setattr(queryoverlay, "retrieve_corpus", _retrieve)
    monkeypatch.setattr(get_settings(), "caos_document_egress_enabled", True)


OVERLAY_REPLY = """
{"edges": [
  {"source": "beta", "target": "gamma", "rationale": "shared supplier", "chunk_ids": ["c1"], "confidence": "Medium"},
  {"source": "acme", "target": "zeta", "rationale": "hallucinated endpoint", "chunk_ids": ["c1"], "confidence": "High"},
  {"source": "acme", "target": "beta", "rationale": "already drawn", "chunk_ids": ["c1"], "confidence": "High"},
  {"source": "gamma", "target": "acme", "rationale": "no real citation", "chunk_ids": ["c-invented"], "confidence": "Weird"}
],
"commentary": "Beta and Gamma share a supplier per the filings.",
"suggested_walks": ["contagion", "bogus-walk", "peer-set", "run-diff"]}
"""


@pytest.mark.usefixtures("seeded_db")
def test_overlay_grounding_gate_and_cache(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    _wire_graph(monkeypatch)
    _fake_anthropic(monkeypatch, OVERLAY_REPLY, calls)

    async def _run():
        async with AsyncSessionLocal() as db:
            first = await queryoverlay.overlay(db, "peer-set", analyst_id="a1")
        async with AsyncSessionLocal() as db:
            second = await queryoverlay.overlay(db, "peer-set", analyst_id="a1")
        return first, second

    first, second = asyncio.run(_run())

    # Grounding gate: only beta→gamma survives — hallucinated endpoint, duplicate of a
    # deterministic edge, and the uncited edge are all dropped, never drawn.
    assert [(e["source"], e["target"]) for e in first["edges"]] == [("beta", "gamma")]
    assert first["edges"][0]["chunk_ids"] == ["c1"]
    assert first["edges"][0]["confidence"] == "Medium"
    # Suggested walks: registry-and-enabled only, never the active walk itself.
    assert first["suggested_walks"] == ["contagion"]
    assert first["commentary"].startswith("Beta and Gamma")
    assert first["cached"] is False and first["model"] == "fake-model"

    # Unchanged graph → cached artifact, exactly one LLM call ever made.
    assert second["cached"] is True
    assert [(e["source"], e["target"]) for e in second["edges"]] == [("beta", "gamma")]
    assert len(calls) == 1


@pytest.mark.usefixtures("seeded_db")
def test_overlay_unparseable_reply_raises(monkeypatch):
    from database import AsyncSessionLocal

    _wire_graph(monkeypatch)
    _fake_anthropic(monkeypatch, "I could not produce JSON, sorry.", [])

    async def _run():
        async with AsyncSessionLocal() as db:
            await queryoverlay.overlay(db, "peer-set", force=True)

    with pytest.raises(ValueError):
        asyncio.run(_run())


@pytest.mark.usefixtures("seeded_db")
def test_overlay_empty_graph_skips_llm(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    empty = {**GRAPH, "nodes": [], "edges": [], "meta": ["No headline metrics"]}

    async def _build(db, cap_id, issuer_id=None):
        return empty

    monkeypatch.setattr(queryoverlay.querygraph, "build_graph", _build)
    _fake_anthropic(monkeypatch, OVERLAY_REPLY, calls)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryoverlay.overlay(db, "peer-set")

    out = asyncio.run(_run())
    assert out["edges"] == [] and out["model"] is None
    assert out["commentary"] == "No headline metrics"
    assert calls == []  # no spend on an empty graph


def test_route_filters_to_registry(monkeypatch):
    calls: list = []
    _fake_anthropic(
        monkeypatch,
        '{"candidates": [{"id": "peer-set", "reason": "you asked for peers"},'
        ' {"id": "invented-walk", "reason": "x"},'
        ' {"id": "peer-set", "reason": "dup"},'
        ' {"id": "run-diff", "reason": "changes since last run"}]}',
        calls,
    )
    flat = [c for g in CAPS["groups"] for c in g["capabilities"]]
    out = asyncio.run(queryoverlay.route("who are the peers", flat))

    assert out["source"] == "llm"
    ids = [c["id"] for c in out["candidates"]]
    assert ids == ["peer-set", "run-diff"]  # hallucinated + duplicate filtered
    assert out["candidates"][0]["enabled"] is True
    assert out["candidates"][1]["enabled"] is False  # disabled still suggested, marked
    # The analyst's text rides in the user message as data, with the registry.
    assert "who are the peers" in calls[0]["messages"][0]["content"]


def test_available_false_when_keyless():
    # conftest pins all provider keys to "" — the lanes must report unavailable, so
    # the route endpoint answers with the keyword-fallback contract and /overlay 503s.
    assert queryoverlay.available() is False


def test_available_false_when_only_gemini_key_has_no_gemini_tier(monkeypatch):
    from config import get_settings
    from engine import queryanswer, queryinsights

    s = get_settings()
    monkeypatch.setattr(s, "anthropic_api_key", "")
    monkeypatch.setattr(s, "openrouter_api_key", "")
    monkeypatch.setattr(s, "gemini_api_key", "x")

    assert queryoverlay.available() is False
    assert queryanswer.available() is False
    assert queryinsights.available() is False


def test_route_model_prefers_haiku_with_anthropic_key(monkeypatch):
    """The route lane is a bounded classify — pin fast cheap Haiku when an Anthropic
    key exists, so routing doesn't inherit the DeepSeek reasoning-model latency.
    Without an Anthropic key it falls back to the LIGHT-lane model."""
    from types import SimpleNamespace
    from engine import presets

    def _settings(anthropic, openrouter):
        return SimpleNamespace(
            anthropic_api_key=anthropic, openrouter_api_key=openrouter, gemini_api_key="",
            model_tier_cheap="deepseek/deepseek-v4-flash", model_tier_fast="deepseek/deepseek-v4-flash",
            model_tier_strong="deepseek/deepseek-v4-pro", model_tier_top="claude-opus-4-8",
        )

    presets.set_mode("BALANCED")
    monkeypatch.setattr(presets, "get_settings", lambda: _settings("sk-ant", ""))
    assert presets.route_model().startswith("claude-haiku")  # fast lane, no reasoning burn

    # No Anthropic key → LIGHT-lane model (here OpenRouter's DeepSeek flash).
    monkeypatch.setattr(presets, "get_settings", lambda: _settings("", "sk-or"))
    assert presets.route_model() == presets.model_for(presets.LIGHT)
