"""CP-6A/6E adversarial debate (engine/debate.py).

Offline/deterministic: ANTHROPIC_API_KEY is "" in conftest, so get_debater()
returns the FixtureDebater and synthesize_debate never calls an LLM.
"""

from __future__ import annotations

import asyncio

from engine import debate
from engine.lineage import validate_lineage
from engine.schemas import ModulePayload, validate_payload


def _cp1(leverage: float) -> ModulePayload:
    return ModulePayload(
        module_id="CP-1", module_name="CanonicalDataFoundation",
        owned_object="canonical_financials",
        runtime_output={"normalized_financials": {"net_leverage_adj_ltm": leverage}},
    )


def _cp1b(*, ebitda_growth=None, signals=()) -> ModulePayload:
    return ModulePayload(
        module_id="CP-1B", module_name="EarningsDelta", owned_object="earnings_delta",
        runtime_output={"summary": {"ebitda_growth_pct": ebitda_growth},
                        "monitoring_signals": list(signals)},
    )


def _cp1c(*, outliers=()) -> ModulePayload:
    return ModulePayload(
        module_id="CP-1C", module_name="PeerBenchmark", owned_object="peer_benchmark",
        runtime_output={"outlier_metrics": list(outliers), "comparisons": [{"metric": "x"}],
                        "peer_scope": "sector peers"},
    )


def _cp4c(*, structure=None, headroom=None) -> ModulePayload:
    calcs = []
    if headroom is not None:
        calcs.append({"name": "Net leverage covenant headroom", "value": headroom, "unit": "turns"})
    return ModulePayload(
        module_id="CP-4C", module_name="CovenantCapacityCalculator",
        owned_object="covenant_capacity_calculation",
        runtime_output={"covenant_structure": structure, "calculations": calcs},
    )


def _run(module_id, upstream):
    return asyncio.run(debate.synthesize_debate(module_id, upstream))


# ── signal extraction ────────────────────────────────────────────────────────

def test_ic_signals_bear_on_high_leverage_and_monitoring():
    up = {"CP-1": _cp1(6.5), "CP-1B": _cp1b(signals=["Revenue declined 8% YoY."]),
          "CP-1C": _cp1c(outliers=["EBITDA margin"]), "CP-4C": _cp4c(structure="cov-lite")}
    bull, bear = debate._ic_signals(up)
    assert bull == []
    bear_text = " ".join(p.text for p in bear)
    assert "6.5x" in bear_text and "Revenue declined" in bear_text
    assert "Bottom-quartile" in bear_text and "Cov-lite" in bear_text


def test_ic_signals_bull_on_low_leverage_and_growth():
    up = {"CP-1": _cp1(3.2), "CP-1B": _cp1b(ebitda_growth=11.0),
          "CP-1C": _cp1c(outliers=[]), "CP-4C": _cp4c(structure="maintenance", headroom=1.8)}
    bull, bear = debate._ic_signals(up)
    assert bear == []
    bull_text = " ".join(p.text for p in bull)
    assert "3.2x" in bull_text and "grew 11% YoY" in bull_text and "1.8 turns" in bull_text


def test_optional_cp4d_and_cp2g_handoffs_have_bounded_deterministic_weights():
    cp4d = ModulePayload(
        "CP-4D", "RestrictedGroupGuaranteeMap", "structural_priority_map",
        {"handoffs": {"cp_6a": {
            "summary": "Open drop-down route can strand guarantor value.",
            "leakage_severity": 4,
            "priority_label": "Leakage-Exposed (drop-down capable)",
        }}},
    )
    cp2g = ModulePayload(
        "CP-2G", "ESGSustainabilityCreditRisk", "esg_credit_risk",
        {"cp6a_handoff": {
            "summary": "Quantified remediation capex pressures free cash flow.",
            "materiality_class": "Material — Quantified",
            "net_direction": "Negative",
            "weight": 99,
        }},
    )
    bull, bear = debate._ic_signals({"CP-4D": cp4d, "CP-2G": cp2g})
    assert bull == []
    assert [(point.source, point.weight) for point in bear] == [("CP-4D", 2), ("CP-2G", 3)]


def test_absent_or_malformed_optional_handoff_preserves_legacy_signals():
    baseline = debate._ic_signals({"CP-1": _cp1(5.0)})
    malformed = debate._ic_signals({
        "CP-1": _cp1(5.0),
        "CP-4D": ModulePayload("CP-4D", "", "", {"handoffs": {"cp_6a": {"leakage_severity": float("nan")}}}),
        "CP-2G": ModulePayload("CP-2G", "", "", {"cp6a_handoff": {"weight": 99}}),
    })
    assert malformed == baseline


# ── deterministic chair ────────────────────────────────────────────────────────

def test_ic_verdict_leans_track_net_score():
    assert debate._ic_verdict([debate.Point("a", "CP-1", 3)], [])["lean"] == "CONSTRUCTIVE"
    assert debate._ic_verdict([], [debate.Point("b", "CP-1", 3)])["lean"] == "CAUTIOUS"
    assert debate._ic_verdict([debate.Point("a", "CP-1", 1)],
                              [debate.Point("b", "CP-1", 1)])["lean"] == "BALANCED"


def test_ic_verdict_greatest_uncertainty_is_top_bear():
    v = debate._ic_verdict([], [debate.Point("minor risk", "CP-1B", 1),
                                debate.Point("the big one", "CP-1", 3)])
    assert v["greatest_uncertainty"] == "the big one"


# ── payload assembly ───────────────────────────────────────────────────────────

def test_cp6a_payload_is_valid_and_lineage_clean():
    up = {"CP-1": _cp1(6.5), "CP-2": ModulePayload("CP-2", "CostStructure", "cost_structure", {}),
          "CP-1B": _cp1b(signals=["EBITDA margin compressed 2pp YoY."]),
          "CP-4C": _cp4c(structure="cov-lite")}
    p = _run("CP-6A", up)
    assert p.module_id == "CP-6A" and p.owned_object == "ic_debate_challenge"
    assert validate_payload(p) == []
    # Debate points are calculated from gated upstreams → no CP-5B findings.
    assert validate_lineage([p]) == []
    assert p.runtime_output["verdict"]["lean"] == "CAUTIOUS"
    assert "CP-6E" in p.downstream_consumers


def test_cp6e_reads_cp6a_verdict():
    cp6a = _run("CP-6A", {"CP-1": _cp1(3.2), "CP-2": ModulePayload("CP-2", "", "", {}),
                          "CP-1B": _cp1b(ebitda_growth=11.0), "CP-4C": _cp4c(structure="maintenance", headroom=2.0)})
    assert cp6a.runtime_output["verdict"]["lean"] == "CONSTRUCTIVE"
    p = _run("CP-6E", {"CP-6A": cp6a, "CP-4C": _cp4c(structure="maintenance")})
    assert validate_payload(p) == [] and validate_lineage([p]) == []
    assert p.runtime_output["verdict"]["sizing_posture"].startswith("Add —")


def test_no_signals_degrades_confidence_but_stays_valid():
    p = _run("CP-6A", {"CP-1": ModulePayload("CP-1", "", "canonical_financials", {})})
    assert p.confidence == "Low" and p.limitation_flags
    assert validate_payload(p) == [] and validate_lineage([p]) == []
    # Verdict still present (neutral default) and gate-clean.
    assert p.runtime_output["verdict"]["lean"] == "BALANCED"


# ── narration fault isolation (BE4-1) ────────────────────────────────────────

def test_one_side_narration_failure_does_not_sink_the_other(monkeypatch):
    """A raising narrate() on one advocate must degrade to deterministic prose
    for that side only — never propagate and take down the whole synthesis
    (mirrors council.py's asyncio.gather(..., return_exceptions=True) fault
    isolation for its per-seat fan-out)."""

    class _FlakyDebater:
        name = "flaky"

        async def narrate(self, advocate, lens, points, upstream):
            if advocate == debate._SPECS["CP-6A"].bull:
                raise RuntimeError("simulated provider 5xx")
            return f"LIVE: {debate._prose(advocate, points)}"

    monkeypatch.setattr(debate, "get_debater", lambda: _FlakyDebater())

    # lev=5.0 is a bear point; ebitda_growth=11.0 is the only bull point, so the
    # deterministic fallback is a known, exact string.
    up = {"CP-1": _cp1(5.0), "CP-2": ModulePayload("CP-2", "", "", {}),
          "CP-1B": _cp1b(ebitda_growth=11.0), "CP-4C": _cp4c(structure="cov-lite")}
    p = _run("CP-6A", up)  # must not raise

    assert validate_payload(p) == [] and validate_lineage([p]) == []
    # Bull side failed narration -> deterministic fallback, not the live prefix.
    bull_narrative = p.runtime_output["bull_case"]["narrative"]
    assert bull_narrative == "Bull Advocate: Adjusted EBITDA grew 11% YoY."
    assert not bull_narrative.startswith("LIVE:")
    # Bear side succeeded -> its narration survives untouched.
    assert p.runtime_output["bear_case"]["narrative"].startswith("LIVE:")
