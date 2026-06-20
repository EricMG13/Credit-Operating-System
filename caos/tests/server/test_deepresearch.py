"""Tests for Deep Research — brief assembly and the demo-fallback /api/research
endpoint (no model key in the test env, so it exercises the canned path)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from deepresearch import _AI_MODES, ResearchBrief, build_brief, _demo_report


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


# ── Endpoint (demo path — no ANTHROPIC_API_KEY in tests) ──────────────────────
def test_research_endpoint_returns_demo_report():
    from main import app

    with TestClient(app) as c:
        r = c.post("/api/research", json={"subject": "Enterprise Software", "mode": "sector"})
    assert r.status_code == 200
    body = r.json()
    assert body["demo"] is True
    assert "Executive Summary" in body["report"]


def test_research_endpoint_rejects_blank_subject():
    from main import app

    with TestClient(app) as c:
        r = c.post("/api/research", json={"subject": ""})
    assert r.status_code == 422
