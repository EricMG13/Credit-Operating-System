"""#21: a deterministic cross-check catches a CP-1 whose asserted net leverage is
internally inconsistent with its own net debt / adjusted EBITDA — the open
runtime_output schema lets a live LLM emit a wrong-but-in-range leverage."""
from engine.metrics import leverage_plausibility_finding
from engine.schemas import ModulePayload


def _cp1(lev, nd, eb_ltm):
    return ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": lev, "net_debt_ltm": nd,
            "adj_ebitda": {"FY24": round(eb_ltm * 0.9, 1), "LTM_Q1_26": eb_ltm},
        }},
    )


def test_consistent_leverage_no_finding():
    assert leverage_plausibility_finding(_cp1(5.68, 2391, 421)) is None  # 2391/421 = 5.68


def test_inconsistent_leverage_raises_material():
    f = leverage_plausibility_finding(_cp1(5.0, 2460, 410))  # net debt / EBITDA = 6.0x ≠ 5.0x
    assert f is not None
    assert f.severity == "MATERIAL" and f.finding_id == "CP-1-LEV-PLAUS"


def test_missing_input_no_finding():
    p = ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o",
        runtime_output={"normalized_financials": {"net_leverage_adj_ltm": 5.0}},  # no net debt / EBITDA
    )
    assert leverage_plausibility_finding(p) is None
    assert leverage_plausibility_finding(None) is None
