"""Audit finding #1 (2026-07-11): a live LLM CP-1 can emit a self-consistent but
fabricated income statement — leverage_plausibility_finding only catches an
INTERNALLY inconsistent figure, not a consistently-wrong one. This is the
complementary check: does the model's headline revenue/EBITDA appear anywhere
in what was actually retrieved from the issuer's documents?

Two halves, exercised together end-to-end: engine.synth._ground_cp1_headline_figures
(sets ModulePayload.ungrounded_headline_figures at synthesis time, where the
retrieved chunks are in scope) and engine.metrics.cp1_grounding_finding (the
post-hoc CP-5B finding-function runner.py calls, mirroring leverage_plausibility_finding)."""

from engine.metrics import cp1_grounding_finding
from engine.schemas import ModulePayload
from engine.synth import _ground_cp1_headline_figures, _most_recent_disclosed_value
from engine.gate import qa_status_from, committee_status_from


class _Hit:
    def __init__(self, chunk_id, text):
        self.chunk_id, self.text = chunk_id, text


def _cp1(revenue=None, adj_ebitda=None):
    nf = {}
    if revenue is not None:
        nf["revenue"] = {"LTM": revenue}
    if adj_ebitda is not None:
        nf["adj_ebitda"] = {"LTM": adj_ebitda}
    return ModulePayload(module_id="CP-1", module_name="x", owned_object="o",
                         runtime_output={"normalized_financials": nf})


# ── _ground_cp1_headline_figures (engine/synth.py) ────────────────────────────

def test_both_figures_grounded_flags_nothing():
    p = _cp1(revenue=1000.0, adj_ebitda=250.0)
    hits = [_Hit("c1", "LTM revenue of $1,000 million and Adjusted EBITDA of $250 million.")]
    _ground_cp1_headline_figures(p, hits)
    assert p.ungrounded_headline_figures == []


def test_both_figures_fabricated_flags_both():
    p = _cp1(revenue=1000.0, adj_ebitda=250.0)
    hits = [_Hit("c1", "The company's principal offices are located in Delaware.")]
    _ground_cp1_headline_figures(p, hits)
    assert set(p.ungrounded_headline_figures) == {"revenue", "adj_ebitda"}


def test_one_figure_ungrounded_flags_only_that_one():
    p = _cp1(revenue=1000.0, adj_ebitda=250.0)
    hits = [_Hit("c1", "LTM revenue of $1,000 million.")]  # no EBITDA figure anywhere
    _ground_cp1_headline_figures(p, hits)
    assert p.ungrounded_headline_figures == ["adj_ebitda"]


def test_formatting_tolerance_reused_from_all_grounded():
    # all_grounded's 1dp-round / ±0.05 slack must survive the reuse — a chunk
    # restating 250.0 as "250" or "250.03" still grounds.
    p = _cp1(revenue=1000.0, adj_ebitda=250.03)
    hits = [_Hit("c1", "revenue of 1000 and Adjusted EBITDA of approximately $250 million")]
    _ground_cp1_headline_figures(p, hits)
    assert p.ungrounded_headline_figures == []


def test_no_documents_retrieved_flags_all_present_primitives():
    # Nothing to ground against is an evidence failure, not a bypass.
    p = _cp1(revenue=1000.0, adj_ebitda=250.0)
    _ground_cp1_headline_figures(p, [])
    assert p.ungrounded_headline_figures == ["revenue", "adj_ebitda"]


def test_non_cp1_module_never_checked():
    p = ModulePayload(module_id="CP-2", module_name="x", owned_object="o",
                      runtime_output={"normalized_financials": {"revenue": {"LTM": 1000.0}}})
    _ground_cp1_headline_figures(p, [_Hit("c1", "unrelated text")])
    assert p.ungrounded_headline_figures == []


def test_missing_or_nonfinite_values_skip_without_flagging():
    p = _cp1(revenue=float("nan"), adj_ebitda=None)  # nothing usable to check
    _ground_cp1_headline_figures(p, [_Hit("c1", "some text")])
    assert p.ungrounded_headline_figures == []


# ── _most_recent_disclosed_value: LTM-avoidance (adversarially found, 2026-07-11) ──
# periods.latest() prefers an LTM label over the FY it trails (the correct domain
# choice everywhere else — LTM is the headline current figure) — but LTM is a
# computed roll-forward almost never printed verbatim in a source document.
# Grounding it directly was a structural false positive; this is the fix.

def test_ltm_period_avoided_when_non_ltm_period_also_disclosed():
    series = {"FY24": 1000.0, "LTM_Q1_26": 1042.7}  # LTM is a computed roll-forward
    assert _most_recent_disclosed_value(series) == 1000.0  # prefers the real, quotable FY figure


def test_ltm_only_period_falls_back_to_latest():
    series = {"LTM_Q1_26": 1042.7}  # nothing else disclosed
    assert _most_recent_disclosed_value(series) == 1042.7  # still checked, just no better option


def test_grounding_check_uses_non_ltm_period_not_the_computed_ltm_figure():
    # Before the fix this would have checked 1042.7 (never stated in any document,
    # since it's a computed roll-forward) and wrongly flagged a fully correct CP-1.
    p = ModulePayload(module_id="CP-1", module_name="x", owned_object="o", runtime_output={
        "normalized_financials": {
            "revenue": {"FY24": 1000.0, "LTM_Q1_26": 1042.7},
            "adj_ebitda": {"LTM": 250.0},
        }})
    hits = [_Hit("c1", "FY24 revenue of $1,000 million and Adjusted EBITDA of $250 million.")]
    _ground_cp1_headline_figures(p, hits)
    assert p.ungrounded_headline_figures == []


# ── cp1_grounding_finding (engine/metrics.py) ──────────────────────────────────

def test_finding_none_when_cp1_none():
    assert cp1_grounding_finding(None) is None


def test_finding_none_only_when_zero_ungrounded():
    p = _cp1()
    p.ungrounded_headline_figures = []
    assert cp1_grounding_finding(p) is None
    p.ungrounded_headline_figures = ["revenue"]
    assert cp1_grounding_finding(p) is not None


def test_finding_material_when_both_ungrounded():
    p = _cp1()
    p.ungrounded_headline_figures = ["revenue", "adj_ebitda"]
    f = cp1_grounding_finding(p)
    assert f is not None
    assert f.severity == "MATERIAL" and f.finding_id == "CP-1-UNGROUNDED" and f.module_id == "CP-1"
    assert "revenue" in f.description and "adj_ebitda" in f.description


def test_deterministic_paths_never_populate_the_field_so_never_fire():
    # EDGAR/reported/fixture payloads never call _ground_cp1_headline_figures, so
    # the field stays at its dataclass default — confirms the fix is a no-op on
    # every deterministic CP-1 source, exactly as designed.
    p = _cp1(revenue=1000.0, adj_ebitda=250.0)  # never touched by the grounding helper
    assert p.ungrounded_headline_figures == []
    assert cp1_grounding_finding(p) is None


# ── end-to-end: a fabricated income statement is committee-restricted ─────────

def test_fabricated_income_statement_is_committee_restricted():
    """The scenario the audit named: an injected/hallucinated but internally
    self-consistent CP-1 (leverage_plausibility_finding alone would NOT catch
    this — recompute it: net_debt/adj_ebitda = 2500/500 = 5.0x = asserted
    leverage, so it's internally consistent) is now surfaced in the evidence
    trail and blocks Committee Ready until the evidence gap is remediated."""
    p = ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o", confidence="High",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": 5.0, "net_debt_ltm": 2500.0,
            "revenue": {"LTM": 4000.0}, "adj_ebitda": {"LTM": 500.0},
        }},
    )
    hits = [_Hit("c1", "The credit agreement governs a term loan B facility maturing 2031.")]
    _ground_cp1_headline_figures(p, hits)
    assert set(p.ungrounded_headline_figures) == {"revenue", "adj_ebitda", "net_debt_ltm"}

    from engine.metrics import leverage_plausibility_finding
    assert leverage_plausibility_finding(p) is None  # internally consistent — the OLD gap

    finding = cp1_grounding_finding(p)
    assert finding is not None and finding.severity == "MATERIAL"

    status = qa_status_from([finding])
    assert status == "Restricted"
    assert committee_status_from(status, p.confidence) == "Restricted"


def test_net_debt_leverage_fabrication_now_caught_by_leverage_magnitude_finding():
    """Was test_KNOWN_GAP_net_debt_leverage_fabrication_not_caught — adversarially
    confirmed 2026-07-11. Revenue/EBITDA are correctly quoted while the model
    invents internally-consistent net debt and leverage. Net debt now requires a
    source basis, while the magnitude finding independently catches the extreme
    ratio. True leverage 3.0x, fabricated to 10.0x (2500/250 = 10.0x)."""
    p = ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o", confidence="High",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": 10.0, "net_debt_ltm": 2500.0,  # fabricated: true is 3.0x
            "revenue": {"LTM": 1000.0}, "adj_ebitda": {"LTM": 250.0},  # both genuinely correct
        }},
    )
    hits = [_Hit("c1", "LTM revenue of $1,000 million and Adjusted EBITDA of $250 million.")]
    _ground_cp1_headline_figures(p, hits)
    assert p.ungrounded_headline_figures == ["net_debt_ltm"]

    from engine.metrics import leverage_magnitude_finding, leverage_plausibility_finding
    assert leverage_plausibility_finding(p) is None  # 2500/250 = 10.0 = asserted — "consistent"
    grounding = cp1_grounding_finding(p)
    assert grounding is not None and grounding.severity == "MATERIAL"

    magnitude = leverage_magnitude_finding(p)
    assert magnitude is not None and magnitude.severity == "MATERIAL"

    status = qa_status_from([grounding, magnitude])
    assert status == "Restricted"
    assert committee_status_from(status, p.confidence) == "Restricted"
