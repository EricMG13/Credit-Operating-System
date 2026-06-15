"""Tests for the EDGAR XBRL→CP-1 reported foundation (engine/edgar_cp1.py), the
headline-period projection, the runner's CP-1 precedence (EDGAR reported,
vaulted + cited, with fixture fallback), and run-fault observability.

All offline — the pure builder takes fixture company-facts dicts and the runner
test monkeypatches ``edgar_cp1.fetch_cp1`` so nothing touches the network.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from config import get_settings
from engine import edgar_cp1
from engine.edgar_cp1 import build_cp1_payload
from engine.metrics import extract_facts
from engine.schemas import ModulePayload, validate_payload


# ── XBRL fixture builders ────────────────────────────────────────────────────
def _flow(name, rows):
    """rows: (start, end, val, fy, accn, filed)."""
    return {name: {"units": {"USD": [
        {"start": s, "end": e, "val": v, "fy": fy, "fp": "FY", "form": "10-K", "accn": a, "filed": f}
        for (s, e, v, fy, a, f) in rows]}}}


def _inst(name, rows):
    """rows: (end, val, fy, accn, filed)."""
    return {name: {"units": {"USD": [
        {"end": e, "val": v, "fy": fy, "fp": "FY", "form": "10-K", "accn": a, "filed": f}
        for (e, v, fy, a, f) in rows]}}}


def _facts():
    us = {}
    us.update(_flow("Revenues", [
        ("2023-01-01", "2023-12-31", 2_410_000_000, 2023, "acc23", "2024-02-01"),
        ("2024-01-01", "2024-12-31", 2_588_000_000, 2024, "acc24", "2025-02-01"),
        ("2025-01-01", "2025-12-31", 2_742_000_000, 2025, "acc25", "2026-02-01"),
    ]))
    us.update(_flow("OperatingIncomeLoss", [
        ("2025-01-01", "2025-12-31", 300_000_000, 2025, "acc25", "2026-02-01")]))
    us.update(_flow("DepreciationDepletionAndAmortization", [
        ("2025-01-01", "2025-12-31", 115_000_000, 2025, "acc25", "2026-02-01")]))
    us.update(_flow("InterestExpense", [
        ("2025-01-01", "2025-12-31", 200_000_000, 2025, "acc25", "2026-02-01")]))
    us.update(_inst("LongTermDebt", [("2025-12-31", 2_500_000_000, 2025, "acc25", "2026-02-01")]))
    us.update(_inst("CashAndCashEquivalentsAtCarryingValue", [
        ("2025-12-31", 109_000_000, 2025, "acc25", "2026-02-01")]))
    return {"entityName": "Test Co", "facts": {"us-gaap": us}}


# ── XBRL → CP-1 reported builder ─────────────────────────────────────────────
def test_build_cp1_reported_foundation():
    p = build_cp1_payload("Test Co", _facts())
    assert p is not None and p.module_id == "CP-1"
    assert p.runtime_output["basis"] == "reported_gaap_xbrl"
    nf = p.runtime_output["normalized_financials"]
    assert nf["revenue"] == {"FY2023": 2410.0, "FY2024": 2588.0, "FY2025": 2742.0}
    assert nf["adj_ebitda"]["FY2025"] == 415.0  # 300 + 115 (proxy)
    assert nf["net_debt_ltm"] == 2391.0          # 2500 - 109
    assert nf["net_leverage_adj_ltm"] == pytest.approx(5.76, abs=0.01)
    assert nf["interest_coverage_ltm"] == pytest.approx(2.08, abs=0.02)
    # Reproducible, schema-valid, reported-basis (Medium), and explicitly flagged.
    assert validate_payload(p) == []
    assert p.confidence == "Medium"
    assert any("reported GAAP proxy" in f for f in p.limitation_flags)
    # Every figure is cited to the XBRL fact behind it.
    rev_claim = next(c for c in p.claims if c.claim_id == "C-EDG-REV")
    assert "us-gaap:Revenues" in rev_claim.evidence[0].source_locator
    assert "accession acc25" in rev_claim.evidence[0].source_locator


def test_build_cp1_keys_by_period_end_not_filing_fy():
    # A single 10-K (filing fy=2025) carrying three comparative years must yield
    # three periods, not collapse to one — the value's own end-year is the key.
    facts = {"facts": {"us-gaap": _flow("Revenues", [
        ("2023-01-01", "2023-12-31", 100_000_000, 2025, "acc25", "2026-02-01"),
        ("2024-01-01", "2024-12-31", 110_000_000, 2025, "acc25", "2026-02-01"),
        ("2025-01-01", "2025-12-31", 120_000_000, 2025, "acc25", "2026-02-01"),
    ])}}
    p = build_cp1_payload("X", facts)
    assert set(p.runtime_output["normalized_financials"]["revenue"]) == {"FY2023", "FY2024", "FY2025"}


def test_build_cp1_restatement_latest_filed_wins():
    facts = {"facts": {"us-gaap": _flow("Revenues", [
        ("2025-01-01", "2025-12-31", 2_742_000_000, 2025, "acc25", "2026-02-01"),
        ("2025-01-01", "2025-12-31", 2_700_000_000, 2025, "accR", "2026-05-01"),  # restated, later
    ])}}
    p = build_cp1_payload("X", facts)
    assert p.runtime_output["normalized_financials"]["revenue"]["FY2025"] == 2700.0


def test_build_cp1_none_without_revenue():
    assert build_cp1_payload("X", {"facts": {"us-gaap": {}}}) is None


def test_build_cp1_revenue_only_still_builds():
    facts = {"facts": {"us-gaap": _flow("Revenues", [
        ("2025-01-01", "2025-12-31", 500_000_000, 2025, "acc", "2026-02-01")])}}
    p = build_cp1_payload("X", facts)
    assert p is not None
    assert "net_leverage_adj_ltm" not in p.runtime_output["normalized_financials"]
    assert any("not derived" in f for f in p.limitation_flags)


# ── Headline period projection (EDGAR annual filer) ──────────────────────────
def test_extract_facts_marks_latest_fy_headline():
    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "revenue": {"FY2023": 2410.0, "FY2024": 2588.0, "FY2025": 2742.0},
            "adj_ebitda": {"FY2024": 392.0, "FY2025": 415.0}}},
    )
    facts = extract_facts("run-1", payload, "Passed")
    rev = {f["period"]: f for f in facts if f["metric_key"] == "revenue"}
    assert rev["FY2025"]["headline"] is True
    assert rev["FY2023"]["headline"] is False and rev["FY2024"]["headline"] is False
    eb = {f["period"]: f for f in facts if f["metric_key"] == "adj_ebitda"}
    assert eb["FY2025"]["headline"] is True and eb["FY2024"]["headline"] is False


# ── Runner CP-1 precedence (integration; EDGAR monkeypatched, no network) ─────
@pytest.fixture()
def edgar_on():
    """Enable the EDGAR lane (gated on EDGAR_USER_AGENT) for the duration."""
    s = get_settings()
    prev = s.edgar_user_agent
    s.edgar_user_agent = "Test UA t@e.st"
    try:
        yield
    finally:
        s.edgar_user_agent = prev


def test_run_grounds_cp1_in_edgar(monkeypatch, edgar_on):
    from main import app

    def fake_fetch_cp1(ticker, entity_name):
        payload = build_cp1_payload(entity_name, _facts())
        return edgar_cp1.Cp1Build(payload=payload, facts_text="SEC EDGAR XBRL extract — Test Co",
                                  cik="0000000001")

    monkeypatch.setattr(edgar_cp1, "fetch_cp1", fake_fetch_cp1)

    with TestClient(app) as c:
        issuer = c.post("/api/issuers/", json={"name": "Test Co", "ticker": "TESTX"}).json()
        run = c.post("/api/runs", json={"issuer_id": issuer["id"]})
        assert run.status_code == 201, run.text
        body = run.json()
        assert body["status"] == "complete"

        detail = c.get(f"/api/runs/{body['id']}/modules/CP-1").json()
        assert detail["runtime_output"]["basis"] == "reported_gaap_xbrl"
        # CP-1 evidence resolved to the vaulted EDGAR facts chunk (click-to-source).
        for claim in detail["claims"]:
            for ev in claim["evidence"]:
                assert ev["document_chunk_id"], f"{ev['evidence_id']} not anchored to a chunk"


# ── Run-fault observability (Phase-1 fault-finding) ──────────────────────────
def test_failed_run_is_persisted_with_reason(monkeypatch):
    from main import app
    import routes.runs as runs_route

    async def boom(session, run):
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(runs_route, "execute_run", boom)
    with TestClient(app) as c:
        issuer = c.post("/api/issuers/", json={"name": "Fail Co", "ticker": "FAILX"}).json()
        r = c.post("/api/runs", json={"issuer_id": issuer["id"]})
        assert r.status_code == 502
        detail = r.json()["detail"]
        assert "synthetic failure" in detail["failure_reason"]
        # The failed run is persisted and inspectable, not lost on rollback.
        got = c.get(f"/api/runs/{detail['run_id']}").json()
        assert got["status"] == "failed"
        assert "synthetic failure" in got["failure_reason"]
