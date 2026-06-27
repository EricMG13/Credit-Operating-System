"""engine/presets.py — the analyst's model mode selects a per-lane model tier,
and the mode threads from the X-Model-Mode header through the request into a run.
"""

from __future__ import annotations

import asyncio

from config import get_settings
from engine import presets
from engine.fixtures import REFERENCE_ISSUER_ID
from conftest import wait_for_run


def test_normalize_coerces_unknown_to_default():
    assert presets.normalize("MAX") == "MAX"
    assert presets.normalize("max") == "MAX"        # case-insensitive
    assert presets.normalize("  lite ") == "LITE"   # trimmed
    assert presets.normalize(None) == presets.DEFAULT_MODE
    assert presets.normalize("") == presets.DEFAULT_MODE
    assert presets.normalize("bogus") == presets.DEFAULT_MODE
    assert presets.DEFAULT_MODE == "BALANCED"


def test_model_for_hybrid_when_openrouter_key_set(monkeypatch):
    """With OPENROUTER_API_KEY set the table resolves to the hybrid: cheap/fast/strong
    on DeepSeek (OpenRouter), top on Claude — so BALANCED heavy = DeepSeek strong,
    MAX heavy = Claude."""
    s = get_settings()
    monkeypatch.setattr(s, "openrouter_api_key", "x")
    expected = {
        "TEST":     {presets.HEAVY: s.model_tier_cheap,  presets.LIGHT: s.model_tier_cheap, presets.EXTRACT: s.model_tier_cheap},
        "LITE":     {presets.HEAVY: s.model_tier_fast,   presets.LIGHT: s.model_tier_cheap, presets.EXTRACT: s.model_tier_cheap},
        "BALANCED": {presets.HEAVY: s.model_tier_strong, presets.LIGHT: s.model_tier_fast,  presets.EXTRACT: s.model_tier_cheap},
        "MAX":      {presets.HEAVY: s.model_tier_top,    presets.LIGHT: s.model_tier_fast,  presets.EXTRACT: s.model_tier_fast},
    }
    try:
        for mode, lanes in expected.items():
            presets.set_mode(mode)
            for lane_class, model in lanes.items():
                assert presets.model_for(lane_class) == model, (mode, lane_class)
        presets.set_mode("BALANCED")
        assert presets.model_for(presets.HEAVY).startswith("deepseek")  # DeepSeek strong tier
        presets.set_mode("MAX")
        assert presets.model_for(presets.HEAVY).startswith("claude")    # Claude top tier
    finally:
        presets.set_mode(presets.DEFAULT_MODE)  # don't leak the contextvar into other tests


def test_model_for_falls_back_to_anthropic_without_provider_key(monkeypatch):
    """No provider key for a tier → it degrades to its Anthropic equivalent, so the
    engine (and offline tests) stay all-Anthropic. The default cheap/strong tiers are
    OpenRouter/DeepSeek, so this exercises the OpenRouter degradation branch."""
    s = get_settings()
    monkeypatch.setattr(s, "openrouter_api_key", "")
    monkeypatch.setattr(s, "gemini_api_key", "")
    try:
        presets.set_mode("BALANCED")
        assert presets.model_for(presets.HEAVY) == presets._ANTHROPIC_FALLBACK["strong"]
        assert presets.model_for(presets.HEAVY).startswith("claude")
        presets.set_mode("TEST")
        assert presets.model_for(presets.HEAVY) == presets._ANTHROPIC_FALLBACK["cheap"]
    finally:
        presets.set_mode(presets.DEFAULT_MODE)


def test_effort_for_per_mode():
    cases = [
        ("TEST", presets.HEAVY, "minimal"),
        ("LITE", presets.HEAVY, "low"),
        ("BALANCED", presets.HEAVY, "medium"),
        ("MAX", presets.HEAVY, "high"),
        ("MAX", presets.LIGHT, "low"),
        ("BALANCED", presets.EXTRACT, "minimal"),
    ]
    try:
        for mode, lane, expected in cases:
            presets.set_mode(mode)
            assert presets.effort_for(lane) == expected, (mode, lane)
    finally:
        presets.set_mode(presets.DEFAULT_MODE)


def test_reviewer_model_same_as_heavy_when_cross_off(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "council_cross_model", False)
    try:
        presets.set_mode("BALANCED")
        assert presets.reviewer_model() == presets.model_for(presets.HEAVY)
    finally:
        presets.set_mode(presets.DEFAULT_MODE)


def test_reviewer_model_opposite_provider_when_cross_on(monkeypatch):
    """Critic on a different provider from the synth (heavy) model: a DeepSeek
    (OpenRouter) heavy is reviewed by Anthropic; a Claude heavy by Gemini."""
    s = get_settings()
    monkeypatch.setattr(s, "council_cross_model", True)
    monkeypatch.setattr(s, "openrouter_api_key", "x")  # heavy = real DeepSeek (not degraded)
    monkeypatch.setattr(s, "gemini_api_key", "x")      # opposite provider available for MAX
    try:
        presets.set_mode("BALANCED")  # heavy = DeepSeek strong -> review on Anthropic
        assert presets.reviewer_model() == s.council_reviewer_model_anthropic
        assert presets.reviewer_model().startswith("claude")
        presets.set_mode("MAX")       # heavy = Claude top -> review on Gemini
        assert presets.reviewer_model() == s.council_reviewer_model_gemini
        assert presets.reviewer_model().startswith("gemini")
    finally:
        presets.set_mode(presets.DEFAULT_MODE)


def test_reviewer_model_degrades_when_opposite_key_missing(monkeypatch):
    """Anthropic-heavy synth + cross-model on but NO gemini key → same-model review."""
    s = get_settings()
    monkeypatch.setattr(s, "council_cross_model", True)
    monkeypatch.setattr(s, "gemini_api_key", "")
    try:
        presets.set_mode("MAX")  # heavy = Claude; wants Gemini reviewer but no key
        assert presets.reviewer_model() == presets.model_for(presets.HEAVY)
        assert presets.reviewer_model().startswith("claude")
    finally:
        presets.set_mode(presets.DEFAULT_MODE)


def _persisted_mode(run_id: str):
    """Read Run.model_mode straight from the DB (it isn't on the API surface)."""
    from database import AsyncSessionLocal, Run

    async def go():
        async with AsyncSessionLocal() as s:
            return (await s.get(Run, run_id)).model_mode

    return asyncio.run(go())


def test_run_persists_model_mode_from_header():
    """X-Model-Mode header → global dependency → request context → create_run
    persists it. Proves the in-request propagation chain end-to-end (the reason
    the mode rides a dependency, not a BaseHTTPMiddleware contextvar)."""
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        made = c.post(
            "/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID},
            headers={"X-Model-Mode": "max"},  # lowercase — must normalize to MAX
        ).json()
        wait_for_run(c, made["id"])
        run_id = made["id"]

    assert _persisted_mode(run_id) == "MAX"


def test_run_without_header_defaults_to_balanced():
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        made = c.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()
        wait_for_run(c, made["id"])
        run_id = made["id"]

    assert _persisted_mode(run_id) == presets.DEFAULT_MODE
