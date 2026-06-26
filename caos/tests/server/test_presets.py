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


def test_model_for_maps_every_mode_and_lane_to_the_right_tier():
    s = get_settings()
    cheap, mid, top = s.model_tier_cheap, s.model_tier_mid, s.model_tier_top
    expected = {
        "TEST":     {presets.HEAVY: cheap, presets.LIGHT: cheap, presets.EXTRACT: cheap},
        "LITE":     {presets.HEAVY: mid,   presets.LIGHT: cheap, presets.EXTRACT: cheap},
        "BALANCED": {presets.HEAVY: mid,   presets.LIGHT: mid,   presets.EXTRACT: cheap},
        "MAX":      {presets.HEAVY: top,   presets.LIGHT: mid,   presets.EXTRACT: mid},
    }
    try:
        for mode, lanes in expected.items():
            presets.set_mode(mode)
            for lane_class, model in lanes.items():
                assert presets.model_for(lane_class) == model, (mode, lane_class)
    finally:
        presets.set_mode(presets.DEFAULT_MODE)  # don't leak the contextvar into other tests


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
