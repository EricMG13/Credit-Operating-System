"""Follow-up to leverage_plausibility_finding (audit finding #1, 2026-07-11): that
check only catches an INTERNALLY inconsistent asserted leverage. A fabrication
that keeps net_debt_ltm self-consistent with the asserted leverage (e.g. true
3.0x fabricated to 10.0x by also fabricating net_debt_ltm so 2500/250 recomputes
to exactly 10.0x) sails through it untouched — see
test_cp1_grounding.py::test_KNOWN_GAP_net_debt_leverage_fabrication_not_caught.
leverage_magnitude_finding is a magnitude-only, defense-in-depth backstop: it
ignores whether the figures agree with each other and only asks whether the
asserted number itself is plausible."""
from engine.metrics import leverage_magnitude_finding
from engine.schemas import ModulePayload


def _cp1(lev, llm=True):
    # llm=True models the live-synth lane (the threat this finding gates on);
    # llm=False models the deterministic EDGAR/reported/fixture lanes.
    return ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o",
        runtime_output={"normalized_financials": {"net_leverage_adj_ltm": lev}},
        llm_synthesized=llm,
    )


def test_plausible_leverage_no_finding():
    assert leverage_magnitude_finding(_cp1(5.68)) is None


def test_at_ceiling_no_finding():
    assert leverage_magnitude_finding(_cp1(8.0)) is None  # boundary is inclusive of "plausible"


def test_over_ceiling_flags_material():
    f = leverage_magnitude_finding(_cp1(10.0))
    assert f is not None
    assert f.severity == "MATERIAL" and f.finding_id == "CP-1-LEV-MAGNITUDE" and f.module_id == "CP-1"
    assert "10" in f.description


def test_large_net_cash_position_flags_symmetrically():
    # abs(lev): an implausible net-CASH claim (large negative leverage) is just
    # as suspect as an implausible net-DEBT claim.
    f = leverage_magnitude_finding(_cp1(-12.0))
    assert f is not None and f.severity == "MATERIAL"


def test_deterministic_lane_stays_advisory_minor():
    # A filing-derived figure is not an LLM assertion — a genuinely distressed
    # issuer past the band (golden FUN: real 8.09x from EDGAR XBRL) must stay
    # visible but must NOT restrict a correct deterministic run.
    f = leverage_magnitude_finding(_cp1(10.0, llm=False))
    assert f is not None and f.severity == "MINOR"


def test_none_payload_no_finding():
    assert leverage_magnitude_finding(None) is None


def test_missing_or_nonfinite_leverage_no_finding():
    p = ModulePayload(module_id="CP-1", module_name="x", owned_object="o",
                      runtime_output={"normalized_financials": {}})
    assert leverage_magnitude_finding(p) is None
    assert leverage_magnitude_finding(_cp1(float("nan"))) is None


def test_the_documented_known_gap_scenario_now_caught():
    # The exact adversarial-audit scenario: net_debt/adj_ebitda internally
    # consistent with the asserted leverage (2500/250 = 10.0 = asserted), so
    # leverage_plausibility_finding stays silent — this backstop still fires.
    from engine.metrics import leverage_plausibility_finding
    p = ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o", confidence="High",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": 10.0, "net_debt_ltm": 2500.0,
            "revenue": {"LTM": 1000.0}, "adj_ebitda": {"LTM": 250.0},
        }},
    )
    assert leverage_plausibility_finding(p) is None
    assert leverage_magnitude_finding(p) is not None
