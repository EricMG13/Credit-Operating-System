"""Tests for CP-1B EarningsDelta: period-over-period deltas, monitoring signals,
the materiality-gated finding, and the runner wiring on the seeded ATLF deal.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from engine.earnings import compute_deltas, monitoring_finding, synthesize_earnings_delta
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.schemas import ModulePayload, validate_payload


def _nf(revenue, adj_ebitda):
    return {"revenue": revenue, "adj_ebitda": adj_ebitda}


def _cp1(nf):
    return ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                         runtime_output={"normalized_financials": nf})


# ── Delta computation ────────────────────────────────────────────────────────
def test_compute_deltas_growth_no_signals():
    d = compute_deltas(_nf(
        {"FY23": 2410, "FY24": 2588, "FY25": 2742, "LTM_Q1_26": 2801},
        {"FY23": 358, "FY24": 392, "FY25": 415, "LTM_Q1_26": 421}))
    assert d["summary"]["revenue_growth_pct"] == pytest.approx(2.2, abs=0.1)
    assert d["summary"]["ebitda_growth_pct"] == pytest.approx(1.4, abs=0.1)
    assert d["monitoring_signals"] == []          # growing → no signals
    assert len(d["periods"]) == 4


def test_compute_deltas_decline_signals():
    d = compute_deltas(_nf({"FY23": 1000, "FY24": 950}, {"FY23": 200, "FY24": 170}))
    assert d["summary"]["revenue_growth_pct"] == pytest.approx(-5.0, abs=0.1)
    assert d["summary"]["ebitda_growth_pct"] == pytest.approx(-15.0, abs=0.1)
    assert d["summary"]["margin_change_pp"] == pytest.approx(-2.1, abs=0.1)
    sig = " ".join(d["monitoring_signals"])
    assert "Revenue declined" in sig and "EBITDA declined" in sig and "compressed" in sig


def test_compute_deltas_single_period():
    d = compute_deltas(_nf({"FY25": 2742}, {"FY25": 415}))
    assert d["summary"]["revenue_growth_pct"] is None


# ── Payload + finding ────────────────────────────────────────────────────────
def test_synthesize_earnings_delta_payload():
    p = synthesize_earnings_delta(_cp1(_nf(
        {"FY24": 950, "FY25": 1000}, {"FY24": 180, "FY25": 200})))
    assert p.module_id == "CP-1B" and validate_payload(p) == []
    assert p.confidence == "High"
    assert "grew" in p.claims[0].claim_text


def test_synthesize_insufficient_single_period():
    p = synthesize_earnings_delta(_cp1(_nf({"FY25": 1000}, {"FY25": 200})))
    assert p.confidence == "Insufficient Information"
    assert not p.claims


def test_monitoring_finding_fires_on_decline():
    p = synthesize_earnings_delta(_cp1(_nf({"FY23": 1000, "FY24": 900}, {"FY23": 200, "FY24": 150})))
    f = monitoring_finding(p)
    assert f is not None and f.severity == "MINOR" and f.finding_id == "CP-1B-MONITOR"


def test_monitoring_finding_silent_on_growth():
    p = synthesize_earnings_delta(_cp1(_nf({"FY24": 950, "FY25": 1000}, {"FY24": 180, "FY25": 200})))
    assert monitoring_finding(p) is None
    assert monitoring_finding(None) is None


# ── Runner wiring on the ATLF deal (growing → no monitoring finding) ─────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_run_produces_cp1b_delta(client):
    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()
    detail = client.get(f"/api/runs/{run['id']}/modules/CP-1B").json()
    assert detail["runtime_output"]["summary"]["revenue_growth_pct"] is not None
    assert len(detail["runtime_output"]["periods"]) >= 2

    qa = client.get(f"/api/runs/{run['id']}/qa").json()
    # ATLF is growing → no monitoring signal, and CRITICAL stays clear.
    assert not [f for f in qa["findings"] if f["finding_id"] == "CP-1B-MONITOR"]
    assert qa["findings_by_severity"]["CRITICAL"] == 0
