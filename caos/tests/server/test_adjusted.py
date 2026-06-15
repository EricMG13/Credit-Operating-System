"""Tests for CP-1A AdjustedEBITDABridge: deterministic add-back extraction, the
reported-vs-adjusted reconciliation, the materiality-gated CP-5 finding, and the
runner wiring on the seeded ATLF deal.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from engine.adjusted import (
    derive_addbacks,
    reconciliation_finding,
    synthesize_adjusted,
)
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.schemas import ModulePayload, validate_payload


# ── Deterministic add-back extraction ────────────────────────────────────────
def test_derive_addbacks_finds_load_not_cap():
    chunks = [
        ("c-sfa", "The senior facilities agreement caps cost-saving add-backs at 25 percent "
                  "over a trailing 24 month period."),  # a CAP — must NOT match
        ("c-om", "Adjusted EBITDA add-backs represent 18.2 percent of adjusted EBITDA, "
                 "driven by run-rate cost savings and synergies."),
    ]
    res = derive_addbacks(chunks)
    assert res is not None
    pct, categories, chunk_id = res
    assert pct == pytest.approx(0.182)
    assert chunk_id == "c-om"
    assert "run-rate" in categories and "cost savings" in categories


def test_derive_addbacks_none_without_disclosure():
    assert derive_addbacks([("c1", "Revenue grew 8 percent year over year.")]) is None
    # an add-back mention without an "of EBITDA" load is not a quantified disclosure
    assert derive_addbacks([("c2", "Various add-backs are permitted under the agreement.")]) is None


# ── Reconciliation math ──────────────────────────────────────────────────────
def _cp1(lev=5.68, nd=2391.0):
    return ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": lev, "net_debt_ltm": nd}},
    )


def test_synthesize_adjusted_reconciles():
    async def retrieve(query, k=6):
        return [SimpleNamespace(
            chunk_id="c-om",
            text="Adjusted EBITDA add-backs represent 18.2 percent of adjusted EBITDA.")]

    p = asyncio.run(synthesize_adjusted(_cp1(), retrieve))
    assert p.module_id == "CP-1A" and validate_payload(p) == []
    ro = p.runtime_output
    assert ro["addback_pct"] == pytest.approx(0.182)
    assert ro["leverage_current"] == 5.68
    # excluding 18.2% add-backs, leverage rises from 5.68x toward ~6.9x
    assert ro["leverage_excl_addbacks"] == pytest.approx(6.94, abs=0.05)
    assert ro["leverage_gap_turns"] == pytest.approx(1.26, abs=0.05)
    assert p.claims[0].evidence[0].resolved_chunk_id == "c-om"


def test_synthesize_adjusted_no_disclosure_is_insufficient():
    async def retrieve(query, k=6):
        return [SimpleNamespace(chunk_id="c1", text="No add-back disclosure here.")]

    p = asyncio.run(synthesize_adjusted(_cp1(), retrieve))
    assert p.runtime_output["addback_pct"] is None
    assert p.confidence == "Insufficient Information"
    assert not p.claims  # no claim → no orphan finding


# ── The materiality-gated CP-5 finding ───────────────────────────────────────
def _cp1a(pct, gap, lev=5.68, lev_excl=6.94):
    return ModulePayload(
        module_id="CP-1A", module_name="X", owned_object="o",
        runtime_output={"addback_pct": pct, "leverage_gap_turns": gap,
                        "leverage_current": lev, "leverage_excl_addbacks": lev_excl},
    )


def test_reconciliation_finding_fires_when_material():
    f = reconciliation_finding(_cp1a(0.182, 1.26))
    assert f is not None
    assert f.severity == "MINOR" and f.lane == 2 and f.module_id == "CP-1A"
    assert f.finding_id == "CP-1A-RECON"


def test_reconciliation_finding_silent_when_immaterial():
    assert reconciliation_finding(_cp1a(0.05, 0.2)) is None
    assert reconciliation_finding(None) is None
    assert reconciliation_finding(_cp1a(None, None)) is None


# ── Runner wiring on the ATLF deal ───────────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_run_produces_cp1a_and_reconciliation_finding(client):
    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()
    detail = client.get(f"/api/runs/{run['id']}/modules/CP-1A").json()
    assert detail["runtime_output"]["addback_pct"] == pytest.approx(0.182, abs=0.001)
    assert detail["runtime_output"]["leverage_gap_turns"] > 0

    qa = client.get(f"/api/runs/{run['id']}/qa").json()
    recon = [f for f in qa["findings"] if f["finding_id"] == "CP-1A-RECON"]
    assert recon and recon[0]["severity"] == "MINOR"
    # An informational add-back finding must not by itself escalate the gate.
    assert qa["findings_by_severity"]["CRITICAL"] == 0
