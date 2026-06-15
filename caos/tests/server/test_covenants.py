"""Tests for CP-4C CovenantCapacityCalculator: deterministic covenant-term
extraction, the capacity/headroom calculations, cov-lite detection + finding,
and the runner wiring on the seeded ATLF deal.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from engine.covenants import (
    covlite_finding,
    derive_covenant_terms,
    synthesize_covenants,
)
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.schemas import ModulePayload, validate_payload

_INDENTURE = "Senior secured notes indenture. Day-one incremental incurrence capacity of 612 million dollars."
_MAINT = "The borrower shall not permit the consolidated net leverage ratio to exceed 7.00x as of any test date."


# ── Deterministic covenant-term extraction ───────────────────────────────────
def test_derive_terms_incremental_and_covlite():
    terms = derive_covenant_terms([("c-ind", _INDENTURE)])
    assert terms is not None
    assert terms["incremental_musd"] == (612.0, "c-ind")
    assert terms["leverage_covenant_x"] is None  # none present → cov-lite


def test_derive_terms_maintenance_covenant():
    terms = derive_covenant_terms([("c-sfa", _MAINT)])
    assert terms["leverage_covenant_x"] == (7.0, "c-sfa")
    assert terms["incremental_musd"] is None


def test_derive_terms_none_when_nothing():
    assert derive_covenant_terms([("c1", "The aftermarket installed base renews at 92 percent.")]) is None


# ── Capacity / headroom calculations ─────────────────────────────────────────
def _cp1(lev=5.68, nd=2391.0):
    return ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": lev, "net_debt_ltm": nd}},
    )


def _retrieve(text, cid="c-doc"):
    async def retrieve(query, k=6):
        return [SimpleNamespace(chunk_id=cid, text=text)]
    return retrieve


def test_synthesize_incremental_capacity_and_covlite():
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve(_INDENTURE, "c-ind")))
    assert p.module_id == "CP-4C" and validate_payload(p) == []
    assert p.runtime_output["covenant_structure"] == "cov-lite"
    calc = next(c for c in p.runtime_output["calculations"] if c["name"].startswith("Pro-forma"))
    # (2391 + 612) / (2391 / 5.68) ≈ 7.13x
    assert calc["value"] == pytest.approx(7.13, abs=0.03)
    assert p.claims[0].evidence[0].resolved_chunk_id == "c-ind"


def test_synthesize_maintenance_headroom():
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve(_MAINT, "c-sfa")))
    assert p.runtime_output["covenant_structure"] == "maintenance"
    calc = next(c for c in p.runtime_output["calculations"] if c["name"].startswith("Net leverage covenant"))
    assert calc["value"] == pytest.approx(1.32, abs=0.02)        # 7.00 − 5.68 turns
    assert calc["ebitda_cushion_pct"] == pytest.approx(18.9, abs=0.2)  # decline to breach


def test_synthesize_insufficient_without_terms():
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve("no covenant content here", "c1")))
    assert p.confidence == "Insufficient Information"
    assert p.runtime_output["calculations"] == []
    assert not p.claims


# ── Cov-lite finding ─────────────────────────────────────────────────────────
def test_covlite_finding_fires_for_covlite():
    p = ModulePayload(module_id="CP-4C", module_name="X", owned_object="o",
                      runtime_output={"covenant_structure": "cov-lite"})
    f = covlite_finding(p)
    assert f is not None and f.severity == "MINOR" and f.lane == 3
    assert f.finding_id == "CP-4C-COVLITE"


def test_covlite_finding_silent_for_maintenance():
    p = ModulePayload(module_id="CP-4C", module_name="X", owned_object="o",
                      runtime_output={"covenant_structure": "maintenance"})
    assert covlite_finding(p) is None
    assert covlite_finding(None) is None


# ── Runner wiring on the ATLF deal ───────────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_run_produces_cp4c_capacity_and_covlite(client):
    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()
    detail = client.get(f"/api/runs/{run['id']}/modules/CP-4C").json()
    calcs = detail["runtime_output"]["calculations"]
    assert any(c["name"].startswith("Pro-forma") for c in calcs)  # $612M incremental → PF leverage

    qa = client.get(f"/api/runs/{run['id']}/qa").json()
    cov = [f for f in qa["findings"] if f["finding_id"] == "CP-4C-COVLITE"]
    assert cov and cov[0]["severity"] == "MINOR"
    assert qa["findings_by_severity"]["CRITICAL"] == 0
