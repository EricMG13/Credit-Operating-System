"""metrics._headline_period (review run-2026-06-26 #3): an explicit LTM/trailing
period is the headline; among candidates pick the MOST RECENT (total order), not
whichever happened to come first in iteration."""
from engine.metrics import _headline_period, leverage_plausibility_finding
from engine.schemas import ModulePayload


def test_headline_prefers_ltm_over_annual():
    assert _headline_period(["FY2024", "FY2025", "LTM_Q1_2026"]) == "LTM_Q1_2026"


def test_headline_most_recent_ltm_not_first():
    # Two LTM snapshots → the most recent, not ltm[0] (the old bug).
    assert _headline_period(["LTM_Q1_2025", "LTM_Q3_2025"]) == "LTM_Q3_2025"


def test_headline_most_recent_annual_when_no_ltm():
    assert _headline_period(["FY2023", "FY2025", "FY2024"]) == "FY2025"


def test_headline_same_year_quarters():
    assert _headline_period(["Q1 2026", "Q3 2026", "Q2 2026"]) == "Q3 2026"


def test_headline_empty():
    assert _headline_period([]) is None


# ── leverage_plausibility_finding (CP-5B cross-check; previously untested) ────
def _cp1(**nf):
    return ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                         runtime_output={"normalized_financials": nf})


def test_leverage_plausibility_none_when_consistent():
    # 2400 / 400 = 6.0x, asserted 6.0x → within the 5% band → no finding.
    cp1 = _cp1(net_leverage_adj_ltm=6.0, net_debt_ltm=2400.0, adj_ebitda={"LTM_Q1_26": 400.0})
    assert leverage_plausibility_finding(cp1) is None


def test_leverage_plausibility_fires_when_inconsistent():
    # 2400 / 400 = 6.0x but CP-1 asserts 5.0x → 20% off → MATERIAL finding.
    cp1 = _cp1(net_leverage_adj_ltm=5.0, net_debt_ltm=2400.0, adj_ebitda={"LTM_Q1_26": 400.0})
    f = leverage_plausibility_finding(cp1)
    assert f is not None and f.severity == "MATERIAL" and f.finding_id == "CP-1-LEV-PLAUS"


def test_leverage_plausibility_skips_when_input_missing():
    assert leverage_plausibility_finding(_cp1(net_leverage_adj_ltm=5.0)) is None  # no net debt / ebitda
    assert leverage_plausibility_finding(None) is None
