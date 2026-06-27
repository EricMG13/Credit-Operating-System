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


# ── FCF / cash conversion + per-period leverage projection ───────────────────
def test_fcf_conversion_and_leverage_series_projected():
    from engine.metrics import extract_facts

    cp1 = _cp1(
        revenue={"FY24": 1000.0, "LTM": 1100.0},
        free_cash_flow={"FY24": 80.0, "LTM": 99.0},
        net_leverage={"FY24": 5.0, "LTM": 4.5},
    )
    by = {}
    for f in extract_facts("run1", cp1, "Passed"):
        by.setdefault(f["metric_key"], {})[f["period"]] = f

    assert by["fcf"]["LTM"]["value"] == 99.0
    # cash conversion = FCF / revenue, computed (not trusted as input)
    assert by["fcf_conversion"]["LTM"]["value"] == 9.0   # 99 / 1100
    assert by["fcf_conversion"]["FY24"]["value"] == 8.0  # 80 / 1000
    # per-period leverage series, headline on the latest period only
    assert set(by["net_leverage"]) == {"FY24", "LTM"}
    assert by["net_leverage"]["LTM"]["headline"] and not by["net_leverage"]["FY24"]["headline"]


def test_leverage_falls_back_to_ltm_scalar_without_series():
    from engine.metrics import extract_facts

    cp1 = _cp1(revenue={"LTM": 1000.0}, net_leverage_adj_ltm=5.5)
    lev = [f for f in extract_facts("r", cp1, "Passed") if f["metric_key"] == "net_leverage"]
    assert len(lev) == 1 and lev[0]["period"] == "LTM" and lev[0]["value"] == 5.5


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
