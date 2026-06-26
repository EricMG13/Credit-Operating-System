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


def test_model_for_hybrid_when_gemini_key_set(monkeypatch):
    """With GEMINI_API_KEY set the table resolves to the hybrid: cheap/fast/strong
    on Gemini, top on Claude — so BALANCED heavy = Gemini strong, MAX heavy = Claude."""
    s = get_settings()
    monkeypatch.setattr(s, "gemini_api_key", "x")
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
        assert presets.model_for(presets.HEAVY).startswith("gemini")   # Gemini strong tier
        presets.set_mode("MAX")
        assert presets.model_for(presets.HEAVY).startswith("claude")   # Claude top tier
    finally:
        presets.set_mode(presets.DEFAULT_MODE)  # don't leak the contextvar into other tests


def test_model_for_falls_back_to_anthropic_without_gemini_key(monkeypatch):
    """No GEMINI_API_KEY → a Gemini tier degrades to its Anthropic equivalent, so
    the engine (and offline tests) stay all-Anthropic."""
    s = get_settings()
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
    try:
        presets.set_mode("TEST");     assert presets.effort_for(presets.HEAVY) == "minimal"
        presets.set_mode("LITE");     assert presets.effort_for(presets.HEAVY) == "low"
        presets.set_mode("BALANCED"); assert presets.effort_for(presets.HEAVY) == "medium"
        presets.set_mode("MAX");      assert presets.effort_for(presets.HEAVY) == "high"
        presets.set_mode("MAX");      assert presets.effort_for(presets.LIGHT) == "low"
        presets.set_mode("BALANCED"); assert presets.effort_for(presets.EXTRACT) == "minimal"
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
