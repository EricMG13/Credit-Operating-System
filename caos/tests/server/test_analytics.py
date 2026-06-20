"""CP-2B downside, CP-3 relative value, CP-4 legal-covenant synthesizers, and
that they feed the CP-6A debate. Deterministic / offline."""

from __future__ import annotations

import asyncio

from engine import debate
from engine.downside import compute_pathways, synthesize_downside
from engine.legal import scan_provisions, synthesize_legal_review
from engine.lineage import validate_lineage
from engine.relval import build_scorecard, synthesize_relative_value
from engine.schemas import ModulePayload, validate_payload


def _run(coro):
    return asyncio.run(coro)


def _cp1(leverage, coverage=2.0):
    return ModulePayload(
        "CP-1", "CanonicalDataFoundation", "canonical_financials",
        {"normalized_financials": {"net_leverage_adj_ltm": leverage,
                                   "interest_coverage_ltm": coverage}})


# ── CP-2B downside ─────────────────────────────────────────────────────────────

def test_downside_stresses_leverage_and_flags_fragility():
    p = compute_pathways({"net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": 2.1})
    assert p["scenarios"][1]["ebitda_shock_pct"] == 20
    assert p["scenarios"][1]["stressed_net_leverage"] == round(5.68 / 0.8, 2)  # 7.1x → breach
    assert p["shock_to_breach_pct"] == 20 and p["fragility"] == "MODERATE"


def test_downside_high_fragility_when_already_distressed():
    assert compute_pathways({"net_leverage_adj_ltm": 7.5})["fragility"] == "HIGH"


def test_downside_no_leverage_is_insufficient():
    p = _run(synthesize_downside(ModulePayload("CP-1", "", "canonical_financials", {})))
    assert p.confidence == "Insufficient Information" and not p.claims
    assert validate_payload(p) == []


def test_downside_payload_valid_and_lineage_clean():
    p = _run(synthesize_downside(_cp1(5.68)))
    assert p.module_id == "CP-2B" and validate_payload(p) == [] and validate_lineage([p]) == []


# ── CP-3 relative value ────────────────────────────────────────────────────────

def _cp1c(*percentiles):
    comps = [{"metric": f"m{i}", "label": f"M{i}", "percentile": pct,
              "issuer_value": 1.0, "peer_median": 1.0} for i, pct in enumerate(percentiles)]
    return ModulePayload("CP-1C", "PeerBenchmark", "peer_benchmark",
                         {"comparisons": comps, "peer_scope": "sector peers"})


def test_relval_composite_and_recommendation():
    assert build_scorecard(_cp1c(80, 70).runtime_output)["recommendation"] == "OVERWEIGHT"
    assert build_scorecard(_cp1c(10, 20).runtime_output)["recommendation"] == "UNDERWEIGHT"
    sc = build_scorecard(_cp1c(40, 60).runtime_output)
    assert sc["composite_percentile"] == 50 and sc["recommendation"] == "NEUTRAL"


def test_relval_no_comparisons_is_insufficient():
    p = _run(synthesize_relative_value(ModulePayload("CP-1C", "", "peer_benchmark", {"comparisons": []})))
    assert p.confidence == "Insufficient Information" and validate_payload(p) == []


def test_relval_payload_valid_and_lineage_clean():
    p = _run(synthesize_relative_value(_cp1c(70, 65, 80)))
    assert p.module_id == "CP-3" and validate_payload(p) == [] and validate_lineage([p]) == []


# ── CP-4 legal ─────────────────────────────────────────────────────────────────

class _Hit:
    def __init__(self, chunk_id, text):
        self.chunk_id, self.text = chunk_id, text


def test_legal_scan_detects_provisions_once():
    chunks = [("c1", "The facility is covenant-lite with an uptier priming mechanism."),
              ("c2", "A J.Crew style transfer to an unrestricted subsidiary is permitted."),
              ("c3", "cov-lite again should not double count")]
    flagged = scan_provisions(chunks)
    labels = {f["provision"] for f in flagged}
    assert any("cov-lite" in l for l in labels) and any("uptier" in l for l in labels)
    assert any("J.Crew" in l for l in labels)
    assert sum("cov-lite" in f["provision"] for f in flagged) == 1  # deduped


def test_legal_payload_valid_lineage_clean_and_scored():
    async def retrieve(q, k):
        return [_Hit("c1", "covenant-lite package with uptier priming and a J.Crew trapdoor")]
    p = _run(synthesize_legal_review(retrieve))
    assert p.module_id == "CP-4" and p.runtime_output["aggressiveness_score"] == 6
    assert p.runtime_output["covenant_structure"] == "cov-lite"
    assert validate_payload(p) == [] and validate_lineage([p]) == []  # resolved chunks


def test_legal_no_provisions_is_insufficient():
    async def retrieve(q, k):
        return [_Hit("c1", "ordinary boilerplate with nothing aggressive")]
    p = _run(synthesize_legal_review(retrieve))
    assert p.confidence == "Insufficient Information" and not p.claims


# ── debate integration ─────────────────────────────────────────────────────────

def test_new_modules_feed_the_ic_debate():
    cp2b = _run(synthesize_downside(_cp1(7.5)))           # fragility HIGH → bear
    cp3 = _run(synthesize_relative_value(_cp1c(10, 15)))  # UNDERWEIGHT → bear
    up = {"CP-1": _cp1(7.5), "CP-2B": cp2b, "CP-3": cp3,
          "CP-4": ModulePayload("CP-4", "", "legal_covenant_review", {"aggressiveness_score": 8})}
    bull, bear = debate._ic_signals(up)
    sources = {p.source for p in bear}
    assert {"CP-2B", "CP-3", "CP-4"} <= sources
    assert debate._ic_verdict(bull, bear)["lean"] == "CAUTIOUS"
