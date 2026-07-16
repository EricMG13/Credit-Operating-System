"""Tests for the Altman Z'' distress score: the pure scorer + zones, the EDGAR
CP-1 enrichment, and the metric-fact projection (so it's cross-issuer queryable).
"""

from __future__ import annotations

import pytest

from engine.distress import altman_z_double_prime, zone_for
from engine.edgar_cp1 import build_cp1_payload
from engine.metrics import extract_facts
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload


# ── Pure scorer ──────────────────────────────────────────────────────────────
def test_zones():
    assert zone_for(3.0) == "safe"
    assert zone_for(1.5) == "grey"
    assert zone_for(0.5) == "distress"
    assert zone_for(2.6) == "grey" and zone_for(1.1) == "grey"  # inclusive grey band


def test_altman_z_double_prime_value():
    z = altman_z_double_prime(
        current_assets=1500, current_liabilities=800, total_assets=5000,
        retained_earnings=1000, ebit=300, total_liabilities=3500, book_equity=1500)
    assert z is not None
    # 6.56(.14) + 3.26(.20) + 6.72(.06) + 1.05(.4286) ≈ 2.42 (no +3.25 — ENG-1)
    assert z[0] == pytest.approx(2.42, abs=0.02)
    assert z[1] == "grey"


def test_altman_z_none_when_no_assets():
    assert altman_z_double_prime(
        current_assets=0, current_liabilities=0, total_assets=0,
        retained_earnings=0, ebit=0, total_liabilities=0, book_equity=0) is None


# ── EDGAR CP-1 enrichment ────────────────────────────────────────────────────
def _flow(name, rows):
    return {name: {"units": {"USD": [
        {"start": s, "end": e, "val": v, "fy": fy, "fp": "FY", "form": "10-K", "accn": a, "filed": f}
        for (s, e, v, fy, a, f) in rows]}}}


def _inst(name, end, val):
    return {name: {"units": {"USD": [
        {"end": end, "val": val, "fy": 2025, "fp": "FY", "form": "10-K", "accn": "acc25", "filed": "2026-02-01"}]}}}


def _facts_with_balance_sheet():
    us = {}
    us.update(_flow("Revenues", [("2025-01-01", "2025-12-31", 2_742_000_000, 2025, "acc25", "2026-02-01")]))
    us.update(_flow("OperatingIncomeLoss", [("2025-01-01", "2025-12-31", 300_000_000, 2025, "acc25", "2026-02-01")]))
    us.update(_inst("Assets", "2025-12-31", 5_000_000_000))
    us.update(_inst("AssetsCurrent", "2025-12-31", 1_500_000_000))
    us.update(_inst("LiabilitiesCurrent", "2025-12-31", 800_000_000))
    us.update(_inst("RetainedEarningsAccumulatedDeficit", "2025-12-31", 1_000_000_000))
    us.update(_inst("Liabilities", "2025-12-31", 3_500_000_000))
    us.update(_inst("StockholdersEquity", "2025-12-31", 1_500_000_000))
    return {"entityName": "BS Co", "facts": {"us-gaap": us}}


def test_build_cp1_enriches_with_altman_z():
    p = build_cp1_payload("BS Co", _facts_with_balance_sheet())
    dz = p.runtime_output["distress"]
    assert dz["altman_z"] == pytest.approx(2.42, abs=0.02)
    assert dz["zone"] == "grey"
    assert any(c.claim_id == "C-EDG-Z" for c in p.claims)


def test_build_cp1_derives_total_liabilities_when_untagged():
    # Many filers (e.g. Carnival) tag no standalone us-gaap:Liabilities — total
    # liabilities is derived from Assets − equity so the score still computes.
    us = {}
    us.update(_flow("Revenues", [("2025-01-01", "2025-12-31", 2_742_000_000, 2025, "a", "2026-02-01")]))
    us.update(_flow("OperatingIncomeLoss", [("2025-01-01", "2025-12-31", 300_000_000, 2025, "a", "2026-02-01")]))
    us.update(_inst("Assets", "2025-12-31", 5_000_000_000))
    us.update(_inst("AssetsCurrent", "2025-12-31", 1_500_000_000))
    us.update(_inst("LiabilitiesCurrent", "2025-12-31", 800_000_000))
    us.update(_inst("RetainedEarningsAccumulatedDeficit", "2025-12-31", 1_000_000_000))
    us.update(_inst("StockholdersEquity", "2025-12-31", 1_500_000_000))
    # deliberately no "Liabilities" key → derived = 5000 − 1500 = 3500
    p = build_cp1_payload("NoTotalLiab Co", {"facts": {"us-gaap": us}})
    assert "distress" in p.runtime_output
    assert p.runtime_output["distress"]["altman_z"] == pytest.approx(2.42, abs=0.02)


def test_build_cp1_no_distress_without_balance_sheet():
    # Revenue-only facts → no balance sheet → no distress block (graceful).
    facts = {"facts": {"us-gaap": _flow("Revenues", [
        ("2025-01-01", "2025-12-31", 500_000_000, 2025, "a", "2026-02-01")])}}
    assert "distress" not in build_cp1_payload("X", facts).runtime_output


# ── Metric-fact projection (cross-issuer queryable) ──────────────────────────
def test_extract_facts_projects_altman_z_cited():
    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {"revenue": {"FY2025": 2742.0}},
                        "distress": {"altman_z": 2.42, "zone": "grey"}},
        claims=[ClaimSpec("C-EDG-Z", "Altman Z''-Score is 2.42 (grey zone).",
                          evidence=[EvidenceSpec("E-EDG-3", "calculated_metric", "Calculated", "bs", "Medium")])],
    )
    facts = extract_facts("run-1", payload, "Passed")
    az = [f for f in facts if f["metric_key"] == "altman_z"]
    assert len(az) == 1
    assert az[0]["value"] == 2.42 and az[0]["headline"] is True
    assert az[0]["source_claim_id"] == "C-EDG-Z"  # cited via the 'altman' keyword
