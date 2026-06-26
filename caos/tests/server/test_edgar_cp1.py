"""Tests for the EDGAR XBRL→CP-1 reported foundation (engine/edgar_cp1.py), the
headline-period projection, the runner's CP-1 precedence (EDGAR reported,
vaulted + cited, with fixture fallback), and run-fault observability.

All offline — the pure builder takes fixture company-facts dicts and the runner
test monkeypatches ``edgar_cp1.fetch_cp1`` so nothing touches the network.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from conftest import wait_for_run
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


def test_fetch_cp1_failsafe_on_malformed_facts(monkeypatch):
    # A structural surprise on real XBRL must degrade to None (fallback), not raise
    # and fail the run (adversarial-review finding).
    monkeypatch.setattr(edgar_cp1, "resolve_cik", lambda t: "0000000001")
    monkeypatch.setattr(edgar_cp1.edgar, "_get_json", lambda url: {"facts": {"us-gaap": "not-a-dict"}})
    assert edgar_cp1.fetch_cp1("X", "X Co") is None


def test_build_cp1_omits_leverage_when_net_cash():
    # Cash > total debt → net debt negative → leverage is non-meaningful, so it's
    # omitted and flagged (the Ford-captive-finance / net-cash case).
    facts = {"facts": {"us-gaap": {
        **_flow("Revenues", [("2025-01-01", "2025-12-31", 1_000_000_000, 2025, "a", "2026-02-01")]),
        **_flow("OperatingIncomeLoss", [("2025-01-01", "2025-12-31", 200_000_000, 2025, "a", "2026-02-01")]),
        **_flow("DepreciationDepletionAndAmortization", [("2025-01-01", "2025-12-31", 50_000_000, 2025, "a", "2026-02-01")]),
        **_inst("LongTermDebt", [("2025-12-31", 100_000_000, 2025, "a", "2026-02-01")]),
        **_inst("CashAndCashEquivalentsAtCarryingValue", [("2025-12-31", 500_000_000, 2025, "a", "2026-02-01")]),
    }}}
    p = build_cp1_payload("NetCash Co", facts)
    assert "net_leverage_adj_ltm" not in p.runtime_output["normalized_financials"]
    assert any("Net leverage not derived" in f for f in p.limitation_flags)
    assert not any(c.claim_id == "C-EDG-LEV" for c in p.claims)  # no misleading leverage claim


def test_build_cp1_revenue_only_still_builds():
    facts = {"facts": {"us-gaap": _flow("Revenues", [
        ("2025-01-01", "2025-12-31", 500_000_000, 2025, "acc", "2026-02-01")])}}
    p = build_cp1_payload("X", facts)
    assert p is not None
    assert "net_leverage_adj_ltm" not in p.runtime_output["normalized_financials"]
    assert any("not derived" in f for f in p.limitation_flags)


# ── Real-issuer XBRL shapes (#27, found on Viasat) ───────────────────────────
def test_build_cp1_sums_da_components_when_no_combined_tag():
    # Viasat-style: no combined D&A tag — sum Depreciation + intangible amortization.
    facts = {"facts": {"us-gaap": {
        **_flow("Revenues", [("2025-01-01", "2025-12-31", 4_000_000_000, 2025, "a", "2026-02-01")]),
        **_flow("OperatingIncomeLoss", [("2025-01-01", "2025-12-31", -100_000_000, 2025, "a", "2026-02-01")]),
        **_flow("Depreciation", [("2025-01-01", "2025-12-31", 1_000_000_000, 2025, "a", "2026-02-01")]),
        **_flow("AmortizationOfIntangibleAssets", [("2025-01-01", "2025-12-31", 300_000_000, 2025, "a", "2026-02-01")]),
        **_inst("LongTermDebtAndCapitalLeaseObligations", [("2025-12-31", 6_000_000_000, 2025, "a", "2026-02-01")]),
        **_inst("CashAndCashEquivalentsAtCarryingValue", [("2025-12-31", 1_500_000_000, 2025, "a", "2026-02-01")]),
    }}}
    p = build_cp1_payload("Sat Co", facts)
    nf = p.runtime_output["normalized_financials"]
    assert nf["adj_ebitda"]["FY2025"] == 1200.0          # -100 + (1000 + 300) D&A
    assert nf["net_leverage_adj_ltm"] == pytest.approx(3.75, abs=0.01)  # (6000-1500)/1200
    assert p.runtime_output["xbrl_concepts"]["d_and_a"] == "Depreciation+AmortizationOfIntangibleAssets"


def test_build_cp1_skips_stale_debt_tag():
    # Debt tagged only years before the EBITDA period (filer switched concepts) →
    # leverage must NOT be computed off the stale figure (the Viasat 2019 trap).
    facts = {"facts": {"us-gaap": {
        **_flow("Revenues", [("2025-01-01", "2025-12-31", 4_000_000_000, 2025, "a", "2026-02-01")]),
        **_flow("OperatingIncomeLoss", [("2025-01-01", "2025-12-31", 300_000_000, 2025, "a", "2026-02-01")]),
        **_flow("DepreciationDepletionAndAmortization", [("2025-01-01", "2025-12-31", 200_000_000, 2025, "a", "2026-02-01")]),
        **_inst("LongTermDebtNoncurrent", [("2019-12-31", 1_000_000_000, 2019, "old", "2020-02-01")]),
        **_inst("CashAndCashEquivalentsAtCarryingValue", [("2025-12-31", 100_000_000, 2025, "a", "2026-02-01")]),
    }}}
    p = build_cp1_payload("Stale Co", facts)
    assert "net_leverage_adj_ltm" not in p.runtime_output["normalized_financials"]
    assert any("predates the EBITDA period" in f for f in p.limitation_flags)
    assert not any(c.claim_id == "C-EDG-LEV" for c in p.claims)


def test_build_cp1_prefers_recent_debt_concept():
    # A stale Noncurrent tag (2019) AND a current AndCapitalLease tag (2025) → use the
    # recent one (the Viasat pattern), never the stale figure.
    facts = {"facts": {"us-gaap": {
        **_flow("Revenues", [("2025-01-01", "2025-12-31", 4_000_000_000, 2025, "a", "2026-02-01")]),
        **_flow("OperatingIncomeLoss", [("2025-01-01", "2025-12-31", 300_000_000, 2025, "a", "2026-02-01")]),
        **_flow("DepreciationDepletionAndAmortization", [("2025-01-01", "2025-12-31", 200_000_000, 2025, "a", "2026-02-01")]),
        **_inst("LongTermDebtNoncurrent", [("2019-12-31", 800_000_000, 2019, "old", "2020-02-01")]),
        **_inst("LongTermDebtAndCapitalLeaseObligations", [("2025-12-31", 3_000_000_000, 2025, "a", "2026-02-01")]),
        **_inst("CashAndCashEquivalentsAtCarryingValue", [("2025-12-31", 500_000_000, 2025, "a", "2026-02-01")]),
    }}}
    p = build_cp1_payload("Recent Co", facts)
    nf = p.runtime_output["normalized_financials"]
    assert nf["net_debt_ltm"] == 2500.0                 # 3000 (recent) - 500, not 800 (stale)
    assert nf["net_leverage_adj_ltm"] == pytest.approx(5.0, abs=0.01)  # 2500 / (300+200)
    assert p.runtime_output["xbrl_concepts"]["long_term_debt"] == "LongTermDebtAndCapitalLeaseObligations"


def test_build_cp1_adds_back_impairment_to_ebitda():
    # Six Flags-style: a goodwill impairment drives reported operating income deeply
    # negative; adding it back yields a representative EBITDA so leverage still computes.
    facts = {"facts": {"us-gaap": {
        **_flow("Revenues", [("2025-01-01", "2025-12-31", 3_000_000_000, 2025, "a", "2026-02-01")]),
        **_flow("OperatingIncomeLoss", [("2025-01-01", "2025-12-31", -1_375_000_000, 2025, "a", "2026-02-01")]),
        **_flow("DepreciationAndAmortization", [("2025-01-01", "2025-12-31", 486_000_000, 2025, "a", "2026-02-01")]),
        **_flow("GoodwillAndIntangibleAssetImpairment", [("2025-01-01", "2025-12-31", 1_518_000_000, 2025, "a", "2026-02-01")]),
        **_inst("LongTermDebtAndCapitalLeaseObligations", [("2025-12-31", 5_500_000_000, 2025, "a", "2026-02-01")]),
        **_inst("CashAndCashEquivalentsAtCarryingValue", [("2025-12-31", 410_000_000, 2025, "a", "2026-02-01")]),
    }}}
    p = build_cp1_payload("Themepark Co", facts)
    nf = p.runtime_output["normalized_financials"]
    assert nf["adj_ebitda"]["FY2025"] == pytest.approx(629.0, abs=0.5)  # -1375 + 486 + 1518
    assert nf["net_leverage_adj_ltm"] == pytest.approx(8.09, abs=0.05)  # (5500-410)/629
    assert p.runtime_output["xbrl_concepts"]["impairment"] == "GoodwillAndIntangibleAssetImpairment"
    assert any("non-cash impairment" in f for f in p.limitation_flags)


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


def test_extract_facts_tags_reported_vs_adjusted_basis():
    edgar = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"basis": "reported_gaap_xbrl", "normalized_financials": {
            "revenue": {"FY2025": 2742.0}, "net_leverage_adj_ltm": 5.5, "net_debt_ltm": 100.0}})
    assert all(f["basis"] == "reported" for f in extract_facts("r", edgar, "Passed"))
    # A fixture/LLM CP-1 (no reported basis) is tagged adjusted.
    fixture = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {"revenue": {"FY2025": 2742.0}}})
    assert all(f["basis"] == "adjusted" for f in extract_facts("r", fixture, "Passed"))


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
        run = wait_for_run(c, c.post("/api/runs", json={"issuer_id": issuer["id"]}).json()["id"])
        assert run["status"] == "complete"

        detail = c.get(f"/api/runs/{run['id']}/modules/CP-1").json()
        assert detail["runtime_output"]["basis"] == "reported_gaap_xbrl"
        # CP-1 evidence resolved to the vaulted EDGAR facts chunk (click-to-source).
        for claim in detail["claims"]:
            for ev in claim["evidence"]:
                assert ev["document_chunk_id"], f"{ev['evidence_id']} not anchored to a chunk"


# ── #17: Altman Z'' freshness gate (parity with the leverage path) ───────────
def _bs(year, accn="a", filed="2026-02-01"):
    """The six Altman-Z balance-sheet instant tags at `year`-12-31."""
    e = f"{year}-12-31"
    return {
        **_inst("Assets", [(e, 5_000_000_000, year, accn, filed)]),
        **_inst("AssetsCurrent", [(e, 1_200_000_000, year, accn, filed)]),
        **_inst("LiabilitiesCurrent", [(e, 800_000_000, year, accn, filed)]),
        **_inst("RetainedEarningsAccumulatedDeficit", [(e, 1_500_000_000, year, accn, filed)]),
        **_inst("Liabilities", [(e, 3_000_000_000, year, accn, filed)]),
        **_inst("StockholdersEquity", [(e, 2_000_000_000, year, accn, filed)]),
    }


def test_altman_z_emitted_when_balance_sheet_is_fresh():
    f = _facts()  # income/D&A at FY2025 → ly=2025
    f["facts"]["us-gaap"].update(_bs(2025))
    p = build_cp1_payload("Test Co", f)
    assert "distress" in p.runtime_output
    assert p.runtime_output["distress"]["model"] == "Altman Z''"
    assert any(c.claim_id == "C-EDG-Z" for c in p.claims)


def test_altman_z_suppressed_and_flagged_when_balance_sheet_is_stale():
    f = _facts()
    f["facts"]["us-gaap"].update(_bs(2019))  # BS tags 6y older than the FY2025 EBITDA
    p = build_cp1_payload("Test Co", f)
    # #17: a distress score from stale inputs would be mislabelled FY2025 — suppress it.
    assert "distress" not in p.runtime_output
    assert not any(c.claim_id == "C-EDG-Z" for c in p.claims)
    assert any("Altman Z'' not derived" in fl for fl in p.limitation_flags)
    # The leverage path (fresh 2025 debt) is unaffected — only the Z'' is gated.
    assert p.runtime_output["normalized_financials"].get("net_leverage_adj_ltm") is not None


# ── #26: impairment add-back gated on negative operating income ───────────────
def test_impairment_not_added_back_on_profitable_year():
    f = _facts()  # FY2025 operating income +300M (profitable)
    f["facts"]["us-gaap"].update(_flow("GoodwillImpairmentLoss",
        [("2025-01-01", "2025-12-31", 200_000_000, 2025, "acc25", "2026-02-01")]))
    p = build_cp1_payload("Test Co", f)
    eb = p.runtime_output["normalized_financials"]["adj_ebitda"]
    assert eb["FY2025"] == 415.0  # 300 + 115 D&A; impairment NOT added on a profitable year (#26)
    assert not any("adds back" in fl for fl in p.limitation_flags)


def test_impairment_added_back_when_operating_income_negative():
    f = _facts()
    f["facts"]["us-gaap"].update(_flow("OperatingIncomeLoss",
        [("2025-01-01", "2025-12-31", -900_000_000, 2025, "acc25", "2026-02-01")]))
    f["facts"]["us-gaap"].update(_flow("GoodwillImpairmentLoss",
        [("2025-01-01", "2025-12-31", 1_200_000_000, 2025, "acc25", "2026-02-01")]))
    p = build_cp1_payload("Test Co", f)
    eb = p.runtime_output["normalized_financials"]["adj_ebitda"]
    assert eb["FY2025"] == 415.0  # -900 + 115 + 1200 — write-down added back on a loss year
    assert any("adds back" in fl and "negative" in fl for fl in p.limitation_flags)


# ── #25: interest coverage gated on interest-period freshness ─────────────────
def test_interest_coverage_emitted_when_fresh():
    p = build_cp1_payload("Test Co", _facts())  # interest FY2025, EBITDA FY2025
    assert "interest_coverage_ltm" in p.runtime_output["normalized_financials"]


def test_interest_coverage_suppressed_when_interest_stale():
    f = _facts()
    f["facts"]["us-gaap"].update(_flow("InterestExpense",
        [("2022-01-01", "2022-12-31", 200_000_000, 2022, "old", "2023-02-01")]))  # 3y before EBITDA
    p = build_cp1_payload("Test Co", f)
    assert "interest_coverage_ltm" not in p.runtime_output["normalized_financials"]  # (#25)
    assert any("Interest coverage not derived" in fl for fl in p.limitation_flags)
