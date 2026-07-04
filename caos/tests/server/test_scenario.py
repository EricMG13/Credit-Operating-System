"""Tests for the Scenario Builder — NL → driver-delta translation (deterministic
demo path), clamping, and the /api/scenario/nl endpoint.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from scenario import ScenarioError, ScenarioSpec, _demo_translate, validate_scenario


# ── Deterministic translation ────────────────────────────────────────────────
def test_energy_spike_lowers_margin_raises_rate():
    s = _demo_translate("energy price spike — power costs surge")
    assert s.margin_delta < 0 and s.rate_delta > 0
    assert s.rev_growth_delta == 0 and s.capex_delta == 0


def test_input_cost_deflation_lifts_margin():
    s = _demo_translate("raw material deflation lifts gross margin")
    assert s.margin_delta > 0
    assert s.rate_delta == 0


def test_explicit_bps_rate_move_signed():
    assert _demo_translate("a rate hike of 200bps").rate_delta == pytest.approx(0.02)
    assert _demo_translate("150 bps rate cut").rate_delta == pytest.approx(-0.015)
    assert _demo_translate("spreads tighten 75bps after refinancing clears").rate_delta == pytest.approx(-0.0075)
    assert _demo_translate("base rate relief 100bps offsets flat demand").rate_delta == pytest.approx(-0.01)


def test_recession_hits_growth_and_margin():
    s = _demo_translate("demand recession with destocking")
    assert s.rev_growth_delta < 0 and s.margin_delta < 0


def test_recovery_demand_is_not_treated_as_recession():
    s = _demo_translate("pricing improves and demand recovery accelerates")
    assert s.rev_growth_delta > 0
    assert s.margin_delta >= 0
    assert "weaker demand" not in s.rationale


def test_volume_recovery_with_pricing_power_is_upside():
    s = _demo_translate("volume recovery with pricing power")
    assert s.rev_growth_delta > 0
    assert s.margin_delta > 0
    assert s.rate_delta == 0
    assert "input-cost inflation" not in s.rationale


def test_margin_compression_and_capex():
    assert _demo_translate("margin compression from pricing pressure").margin_delta < 0
    assert _demo_translate("margins compress 150bps").margin_delta == pytest.approx(-0.015)
    assert _demo_translate("a capex surge for growth investment").capex_delta > 0
    assert _demo_translate("management cuts capex by 150bps to preserve liquidity").capex_delta == pytest.approx(-0.015)


# ── Validation / clamping ────────────────────────────────────────────────────
def test_validate_clamps_to_bounds():
    s = validate_scenario(ScenarioSpec(rev_growth_delta=-0.9, rate_delta=0.9, margin_delta=-0.5))
    assert s.rev_growth_delta == -0.15 and s.rate_delta == 0.05 and s.margin_delta == -0.10


def test_validate_rejects_noop():
    with pytest.raises(ScenarioError):
        validate_scenario(ScenarioSpec())


def test_validate_drops_nonfinite_deltas():
    # json.loads/pydantic admit NaN/±Inf; NaN defeats max/min so it would slip the clamp
    # and poison the projection (renders NaN). Non-finite deltas must coerce to 0.0.
    import math

    s = validate_scenario(ScenarioSpec(
        rev_growth_delta=float("nan"), rate_delta=float("inf"), margin_delta=-0.04))
    assert s.rev_growth_delta == 0.0 and s.rate_delta == 0.0  # non-finite → 0
    assert math.isfinite(s.rev_growth_delta) and math.isfinite(s.rate_delta)
    assert s.margin_delta == -0.04  # a real, in-band delta still survives
    # a scenario of only non-finite deltas collapses to a no-op → rejected, not NaN
    with pytest.raises(ScenarioError):
        validate_scenario(ScenarioSpec(capex_delta=float("nan")))


# ── Endpoint ─────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_scenario_endpoint_translates(client):
    r = client.post("/api/scenario/nl", json={"text": "oil shock — margins compress, rates rise 100bps"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["margin_delta"] < 0 and body["rate_delta"] > 0
    assert body["label"]


def test_scenario_endpoint_422_on_noop(client):
    r = client.post("/api/scenario/nl", json={"text": "the weather is pleasant today"})
    assert r.status_code == 422


def test_translate_scenario_async_path_runs_offline():
    # No model key in tests → deterministic translator behind the async interface.
    from scenario import translate_scenario

    s = asyncio.run(translate_scenario("rate hike of 200bps"))
    assert s.rate_delta == pytest.approx(0.02)
