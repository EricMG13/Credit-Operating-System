"""#21: a deterministic cross-check catches a CP-1 whose asserted net leverage is
internally inconsistent with its own net debt / adjusted EBITDA — the open
runtime_output schema lets a live LLM emit a wrong-but-in-range leverage."""
import math

from engine.metrics import cp1_completeness_finding, leverage_plausibility_finding
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


def test_overflowing_recomputed_leverage_still_fires():
    # |nd / eb| past float range is maximal internal inconsistency — the MATERIAL
    # finding must FIRE, not be silently suppressed by the overflow (None) path.
    f = leverage_plausibility_finding(_cp1(5.0, 1e305, 1e-5))
    assert f is not None
    assert f.severity == "MATERIAL"


# ── CP-5 numeric-completeness lane (cp1_completeness_finding) ────────────────

def _cp1_nf(nf, confidence="Medium"):
    return ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o",
        runtime_output={"normalized_financials": nf}, confidence=confidence,
    )


def test_completeness_confident_but_empty_raises_material():
    f = cp1_completeness_finding(_cp1_nf({}))  # confident, zero metrics
    assert f is not None and f.severity == "MATERIAL" and f.finding_id == "CP-1-INCOMPLETE"


def test_completeness_revenue_only_is_enough():
    assert cp1_completeness_finding(_cp1_nf({"revenue": {"FY24": 1000.0}})) is None


def test_completeness_leverage_scalar_is_enough():
    assert cp1_completeness_finding(_cp1_nf({"net_leverage_adj_ltm": 5.0})) is None


def test_completeness_insufficient_confidence_never_flags():
    # An honestly-insufficient CP-1 is already surfaced; don't double-flag it.
    assert cp1_completeness_finding(_cp1_nf({}, confidence="Insufficient Information")) is None


def test_completeness_nan_metric_counts_as_absent():
    # A NaN headline metric is not a real number, so a confident CP-1 carrying only
    # NaNs still trips the completeness lane.
    f = cp1_completeness_finding(_cp1_nf({"net_leverage_adj_ltm": float("nan"),
                                          "revenue": {"FY24": math.inf}}))
    assert f is not None and f.finding_id == "CP-1-INCOMPLETE"


def test_completeness_none_no_finding():
    assert cp1_completeness_finding(None) is None
