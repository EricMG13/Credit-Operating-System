"""Tests for Deep Research — brief assembly and the demo-fallback /api/research
endpoint (no model key in the test env, so it exercises the canned path)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from types import SimpleNamespace

import pytest

import deepresearch
from deepresearch import (
    _AI_MODES,
    ResearchBrief,
    Source,
    _collect_sources,
    _emit_progress,
    build_brief,
    _demo_report,
    run_deep_research,
)


# ── Brief assembly ───────────────────────────────────────────────────────────
def test_build_brief_includes_subject_audience_and_criteria():
    brief = build_brief(
        ResearchBrief(
            subject="Atlas Forge",
            mode="issuer",
            audience="the CIO",
            criteria=["Liquidity runway", "Covenant headroom"],
        )
    )
    assert 'issuer "Atlas Forge"' in brief
    assert "the CIO" in brief
    # custom criteria are numbered, defaults are not substituted in
    assert "1. Liquidity runway" in brief and "2. Covenant headroom" in brief


def test_build_brief_falls_back_to_default_credit_criteria():
    brief = build_brief(ResearchBrief(subject="Enterprise Software"))
    assert "Macro impact" in brief  # first default criterion
    assert "Executive Summary" in brief  # output contract is always present


def test_demo_report_is_nonempty_markdown():
    md = _demo_report()
    assert "## Executive Summary" in md and "| " in md  # has prose + a table


# ── AI power presets ──────────────────────────────────────────────────────────
def test_ai_modes_resolve_distinct_effort_and_searches():
    # standard keeps the engine defaults; max trades cost for depth; lite is leaner.
    std, mx, lite = _AI_MODES["standard"], _AI_MODES["max"], _AI_MODES["lite"]
    assert std["effort"] == "medium" and std["model"] is None
    assert mx["searches"] > std["searches"] and mx["effort"] == "high"
    assert lite["searches"] < std["searches"] and lite["model"]  # cheaper executor


def test_brief_rejects_unknown_ai_mode():
    import pytest

    with pytest.raises(ValueError):
        ResearchBrief(subject="Atlas Forge", ai_mode="turbo")


# ── Source-URL scheme guard (web-sourced URL → analyst-clickable href) ────────
def test_collect_sources_drops_non_http_schemes():
    """A web_search result carries model/web-sourced URLs straight to a clickable
    href. Anything not http(s) (javascript:,
    data:, leading whitespace) must be dropped so it can't become a click-to-exec."""
    block = SimpleNamespace(
        type="web_search_tool_result",
        content=[
            SimpleNamespace(url="https://sec.gov/ok", title="Good"),
            SimpleNamespace(url="http://example.com/also-ok", title="Good2"),
            SimpleNamespace(url="javascript:alert(1)", title="Evil"),
            SimpleNamespace(url="JavaScript:alert(1)", title="EvilCase"),
            SimpleNamespace(url=" javascript:alert(1)", title="EvilSpace"),
            SimpleNamespace(url="data:text/html,<script>1</script>", title="EvilData"),
        ],
    )
    out: list = []
    _collect_sources(block, out)
    assert [s.url for s in out] == ["https://sec.gov/ok", "http://example.com/also-ok"]


# ── Live progress (real running counts for the polled UI, never fabricated) ───
def test_emit_progress_reports_unique_source_count_and_is_best_effort():
    """The running counter must reflect REAL work: unique sources so far (deduped
    by URL) and the search count. A None sink is a no-op, and a raising sink is
    swallowed — the counter is a nicety, never a reason to abort the run."""
    import asyncio

    seen: list = []
    sources = [
        Source(title="A", url="https://sec.gov/a"),
        Source(title="A-dup", url="https://sec.gov/a"),  # same URL → counts once
        Source(title="B", url="https://sec.gov/b"),
    ]

    async def cb(p):
        seen.append(p)

    async def boom(p):
        raise RuntimeError("sink down")

    asyncio.run(_emit_progress(cb, sources, searches=4))
    asyncio.run(_emit_progress(None, sources, searches=4))  # no-op, must not raise
    asyncio.run(_emit_progress(boom, sources, searches=4))  # swallowed, must not raise

    assert seen == [{"sources": 2, "searches": 4}]


# ── Overload fallback / double-overload degrade (BE4-2) ───────────────────────
# The Anthropic SDK's own overload errors need a real httpx response to construct
# (see test_llm_client.py's header note) — monkeypatch is_overloaded to classify a
# local sentinel instead, matching that file's established pattern.
class _Overload(Exception):
    pass


class _FakeStream:
    def __init__(self, raise_exc=None, msg=None):
        self._raise, self._msg = raise_exc, msg

    async def __aenter__(self):
        if self._raise:
            raise self._raise
        return self

    async def __aexit__(self, *a):
        return False

    async def get_final_message(self):
        return self._msg


def _msg(text="ok", stop_reason="end_turn"):
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)], stop_reason=stop_reason)


class _FakeMessages:
    def __init__(self, by_model):
        self._by_model = by_model  # model -> list of _FakeStream, consumed in order

    def stream(self, *, model, **kw):
        return self._by_model[model].pop(0)


class _FakeClient:
    def __init__(self, by_model):
        self.messages = _FakeMessages(by_model)


@pytest.mark.asyncio
async def test_double_overload_with_no_progress_degrades_to_demo_report(monkeypatch):
    """Primary model overloads -> falls back (existing M-2 behavior) -> fallback
    ALSO overloads with nothing gathered yet -> must degrade to a demo report
    (job completes), not propagate and strand the job as failed (BE4-2)."""
    monkeypatch.setattr(deepresearch, "llm_configured", lambda: True)
    monkeypatch.setattr(
        deepresearch,
        "_get_client",
        lambda: _FakeClient({
            "claude-opus-4-8": [_FakeStream(raise_exc=_Overload("primary overloaded"))],
            "claude-sonnet-4-6": [_FakeStream(raise_exc=_Overload("fallback also overloaded"))],
        }),
    )
    monkeypatch.setattr(deepresearch.llm_client, "is_overloaded", lambda e: isinstance(e, _Overload))

    result = await run_deep_research(ResearchBrief(subject="Atlas Forge"))

    assert result.demo is True
    assert "Executive Summary" in result.report  # the canned _demo_report(), not a crash/empty report


@pytest.mark.asyncio
@pytest.mark.usefixtures("seeded_db")  # turn 1 succeeds -> budget.trace_llm writes an llm_call_records row
async def test_double_overload_with_partial_progress_composes_truncated_report(monkeypatch):
    """Same double-overload, but the first continuation turn already gathered real
    text before the SECOND turn's fallback overloads too — must compose what was
    already gathered (truncated=True), not discard real progress for a canned demo."""
    monkeypatch.setattr(deepresearch, "llm_configured", lambda: True)
    monkeypatch.setattr(
        deepresearch,
        "_get_client",
        lambda: _FakeClient({
            # Turn 1 on the primary model succeeds and pauses (continuation needed).
            "claude-opus-4-8": [_FakeStream(msg=_msg("Real gathered text.", stop_reason="pause_turn"))],
            # Turn 2: primary overloads, fallback ALSO overloads.
            "claude-sonnet-4-6": [_FakeStream(raise_exc=_Overload("fallback overloaded"))],
        }),
    )
    # Turn 2's primary attempt (still "claude-opus-4-8", model hasn't been
    # reassigned to fb_model between turns) must also overload to reach the
    # fallback branch; append a second stream for that same model key.
    calls = {"claude-opus-4-8": [
        _FakeStream(msg=_msg("Real gathered text.", stop_reason="pause_turn")),
        _FakeStream(raise_exc=_Overload("primary overloaded turn 2")),
    ], "claude-sonnet-4-6": [_FakeStream(raise_exc=_Overload("fallback overloaded"))]}
    monkeypatch.setattr(deepresearch, "_get_client", lambda: _FakeClient(calls))
    monkeypatch.setattr(deepresearch.llm_client, "is_overloaded", lambda e: isinstance(e, _Overload))

    result = await run_deep_research(ResearchBrief(subject="Atlas Forge"))

    assert result.demo is False
    assert result.truncated is True
    assert "Real gathered text." in result.report


@pytest.mark.asyncio
@pytest.mark.usefixtures("seeded_db")  # turn 1's fallback success traces an llm call
async def test_cross_turn_overload_on_fallback_composes_not_raises(monkeypatch):
    """BE4-2 cross-turn variant: `model` persists across loop turns, so after an
    earlier turn degraded to the fallback, a LATER turn's overload arrives at the
    OUTER except with model == fb_model already. That must hit the same compose-
    what-was-gathered contract — previously it re-raised and discarded every turn
    already gathered, failing the job during exactly the sustained-overload
    incident window BE4-2 targets."""
    monkeypatch.setattr(deepresearch, "llm_configured", lambda: True)
    calls = {
        # Turn 1: primary overloads -> falls back; fallback succeeds and pauses.
        "claude-opus-4-8": [_FakeStream(raise_exc=_Overload("primary overloaded turn 1"))],
        "claude-sonnet-4-6": [
            _FakeStream(msg=_msg("Gathered on fallback.", stop_reason="pause_turn")),
            # Turn 2: the fallback itself overloads.
            _FakeStream(raise_exc=_Overload("fallback overloaded turn 2")),
        ],
    }
    monkeypatch.setattr(deepresearch, "_get_client", lambda: _FakeClient(calls))
    monkeypatch.setattr(deepresearch.llm_client, "is_overloaded", lambda e: isinstance(e, _Overload))

    result = await run_deep_research(ResearchBrief(subject="Atlas Forge"))

    assert result.demo is False
    assert result.truncated is True
    assert "Gathered on fallback." in result.report


# ── Endpoint (demo path — no ANTHROPIC_API_KEY in tests) ──────────────────────
def _wait_research(c, job_id, timeout_s=10.0):
    """Poll GET /api/research/{id} until terminal (M-3 durable job)."""
    import time

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = c.get(f"/api/research/{job_id}")
        assert r.status_code == 200, r.text
        body = r.json()
        if body["status"] in ("complete", "failed"):
            return body
        time.sleep(0.05)
    raise AssertionError("research job did not finish in time")


def test_research_endpoint_creates_job_and_polls_to_demo_report():
    from main import app

    with TestClient(app) as c:
        r = c.post("/api/research", json={"subject": "Enterprise Software", "mode": "sector"})
        assert r.status_code == 201, r.text  # durable: returns a job id, not the report
        # Created 'queued' now (the durable executor claims it) — the client polls
        # through queued/running to a terminal status either way.
        assert r.json()["status"] == "queued"
        body = _wait_research(c, r.json()["id"])
    assert body["status"] == "complete"
    assert body["demo"] is True
    assert "Executive Summary" in body["report"]


def test_research_endpoint_rejects_blank_subject():
    from main import app

    with TestClient(app) as c:
        r = c.post("/api/research", json={"subject": ""})
    assert r.status_code == 422
