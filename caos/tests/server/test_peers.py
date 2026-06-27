"""CP-1C PeerBenchmark: the polarity-aware percentile math, own-value extraction,
and the runner wiring (structural — the shared test DB's peer set varies, so the
exact ranking isn't asserted).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from conftest import wait_for_run
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.peers import _own_values, _percentile
from engine.schemas import ModulePayload


def test_percentile_respects_polarity():
    # higher-is-better (margin/coverage): beating all peers → 100, worst → 0
    assert _percentile(40, [10, 20, 30], higher_is_better=True) == 100
    assert _percentile(5, [10, 20, 30], higher_is_better=True) == 0
    # higher-is-worse (leverage): lowest leverage beats all → 100, highest → 0
    assert _percentile(1.0, [2.0, 3.0, 4.0], higher_is_better=False) == 100
    assert _percentile(6.0, [2.0, 3.0, 4.0], higher_is_better=False) == 0


def test_own_values_picks_latest_same_year_for_margin():
    # review run-2 #B5: same-year FY/LTM tie — ebitda_margin must use the live LTM
    # period, not a stale closed-FY picked by year()-only ordering.
    cp1 = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "revenue": {"FY2025": 1000.0, "LTM_2025": 1000.0},
            "adj_ebitda": {"FY2025": 150.0, "LTM_2025": 200.0}}})
    # LTM_2025 is latest → margin = 200/1000 = 20.0, not the stale FY 150/1000 = 15.0.
    assert _own_values(cp1)["ebitda_margin"] == 20.0


def test_own_values_from_cp1():
    cp1 = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"distress": {"altman_z": 3.3}, "normalized_financials": {
            "net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": 2.1,
            "revenue": {"FY24": 2588, "FY25": 2742}, "adj_ebitda": {"FY24": 392, "FY25": 415}}})
    v = _own_values(cp1)
    assert v["net_leverage"] == 5.68 and v["interest_coverage"] == 2.1 and v["altman_z"] == 3.3
    assert v["ebitda_margin"] == pytest.approx(15.1, abs=0.1)  # 415/2742 (latest period)


# ── Runner wiring (structural; ATLF benchmarked vs the seeded universe) ──────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_atlf_cp1c_benchmarks_against_peers(client):
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"])
    cp1c = client.get(f"/api/runs/{run['id']}/modules/CP-1C").json()
    ro = cp1c["runtime_output"]
    assert ro["peer_count"] >= 3          # at least Acme / Meridian / Aurora
    lev = next(c for c in ro["comparisons"] if c["metric"] == "net_leverage")
    assert lev["issuer_value"] == 5.68    # ATLF's own value is stable
    assert lev["peer_median"] is not None and isinstance(lev["percentile"], int)
