"""The L2/L3 overlay synthesizers (CP-2C/2D/2E/2F, CP-3B/3C/3D) and that the
wired ones feed the CP-6A debate. Deterministic / offline."""

from __future__ import annotations

import asyncio

from engine import debate
from engine.capstructure import scan_tranches, synthesize_capital_structure
from engine.catalysts import synthesize_catalysts
from engine.lineage import validate_lineage
from engine.liquidity import scan_liquidity, synthesize_liquidity
from engine.macro import compute_rate_sensitivity, synthesize_macro
from engine.portfoliofit import synthesize_portfolio_fit
from engine.refinancing import score_vulnerability, synthesize_refinancing
from engine.schemas import ModulePayload, validate_payload
from engine.sponsor import scan_governance, synthesize_sponsor_review


def _run(coro):
    return asyncio.run(coro)


def _cp1(leverage=5.68, net_debt=2391.0, coverage=2.1, ebitda=421.0):
    nf = {"net_leverage_adj_ltm": leverage, "net_debt_ltm": net_debt,
          "interest_coverage_ltm": coverage, "adj_ebitda": {"FY24": ebitda - 6, "LTM_Q1_26": ebitda}}
    return ModulePayload("CP-1", "CanonicalDataFoundation", "canonical_financials",
                         {"normalized_financials": nf})


class _Hit:
    def __init__(self, chunk_id, text):
        self.chunk_id, self.text = chunk_id, text


def _retrieve(*texts):
    async def r(q, k):
        return [_Hit(f"c{i}", t) for i, t in enumerate(texts)]
    return r


def _ok(p, module_id):
    assert p.module_id == module_id
    assert validate_payload(p) == [] and validate_lineage([p]) == []


# ── CP-2C catalysts ────────────────────────────────────────────────────────────

def test_catalysts_register_from_monitoring_signals():
    cp1b = ModulePayload("CP-1B", "EarningsDelta", "earnings_delta",
                         {"monitoring_signals": ["Revenue declined 8% YoY."],
                          "summary": {"latest_period": "Q1-26"}})
    p = _run(synthesize_catalysts({"CP-1": _cp1(), "CP-1B": cp1b}))
    _ok(p, "CP-2C")
    events = [c["event"] for c in p.runtime_output["catalysts"]]
    assert any("Revenue declined" in e for e in events) and p.runtime_output["high_impact"] >= 1


def test_catalysts_empty_is_clean_medium():
    p = _run(synthesize_catalysts({"CP-1": _cp1(leverage=3.0)}))
    assert p.confidence == "Medium" and not p.claims and validate_payload(p) == []


# ── CP-2F macro / rate sensitivity ───────────────────────────────────────────────

def test_macro_rate_sensitivity_math():
    s = compute_rate_sensitivity({"net_debt_ltm": 2000.0, "interest_coverage_ltm": 2.0,
                                  "adj_ebitda": {"LTM": 400.0}})
    # base interest = 400/2 = 200; +100bps on 2000 = +20 → coverage 400/220 ≈ 1.82
    assert s["scenarios"][0]["incremental_interest_musd"] == 20.0
    assert s["scenarios"][0]["stressed_interest_coverage"] == 1.82


def test_macro_payload_and_no_net_debt_insufficient():
    _ok(_run(synthesize_macro(_cp1())), "CP-2F")
    p = _run(synthesize_macro(ModulePayload("CP-1", "", "canonical_financials",
                                            {"normalized_financials": {"adj_ebitda": {"FY": 100}}})))
    assert p.confidence == "Insufficient Information"


# ── CP-3C portfolio fit ──────────────────────────────────────────────────────────

def _cp3(rec, composite=55):
    return ModulePayload("CP-3", "RelativeValueAnalysis", "relative_value_analysis",
                         {"recommendation": rec, "composite_percentile": composite})


def test_portfolio_fit_maps_recommendation_and_flags_leverage():
    p = _run(synthesize_portfolio_fit(_cp3("OVERWEIGHT"), _cp1(leverage=6.5)))
    _ok(p, "CP-3C")
    assert p.runtime_output["sleeve_fit"] == "core" and p.runtime_output["risk_flags"]


def test_portfolio_fit_no_recommendation_insufficient():
    p = _run(synthesize_portfolio_fit(ModulePayload("CP-3", "", "relative_value_analysis", {}), _cp1()))
    assert p.confidence == "Insufficient Information"


# ── CP-3D refinancing / LME ──────────────────────────────────────────────────────

def test_refinancing_vulnerability_score():
    score, band, drivers = score_vulnerability(6.5, "HIGH")
    assert score == 8 and band == "HIGH" and len(drivers) == 2
    assert score_vulnerability(3.0, "LOW")[1] == "LOW"


def test_refinancing_payload_uses_fragility():
    cp2b = ModulePayload("CP-2B", "DownsidePathwayAnalysis", "downside_pathway", {"fragility": "HIGH"})
    p = _run(synthesize_refinancing(_cp1(leverage=6.5), cp2b))
    _ok(p, "CP-3D")
    assert p.runtime_output["lme_vulnerability_band"] == "HIGH"


# ── CP-2D sponsor (doc scan) ─────────────────────────────────────────────────────

def test_sponsor_scan_and_payload():
    flagged = scan_governance([("c1", "A dividend recap to the sponsor and a monitoring fee are permitted.")])
    assert len(flagged) == 2
    p = _run(synthesize_sponsor_review(_retrieve("dividend recapitalization paid to the sponsor; management fee")))
    _ok(p, "CP-2D")
    assert p.runtime_output["governance_risk_score"] >= 2


def test_sponsor_no_flags_insufficient():
    p = _run(synthesize_sponsor_review(_retrieve("ordinary operating disclosure, nothing notable")))
    assert p.confidence == "Insufficient Information"


# ── CP-2E liquidity (doc scan + amount) ──────────────────────────────────────────

def test_liquidity_scan_captures_amount():
    found = scan_liquidity([("c1", "The $250 million revolving credit facility was undrawn at quarter end.")])
    assert found and found[0]["amount_musd"] == 250.0
    p = _run(synthesize_liquidity(_retrieve("$1.2 billion undrawn revolving credit facility available")))
    _ok(p, "CP-2E")
    assert p.runtime_output["disclosed_liquidity_musd"] == 1200.0


def test_liquidity_none_insufficient():
    p = _run(synthesize_liquidity(_retrieve("nothing about funding here")))
    assert p.confidence == "Insufficient Information"


# ── CP-3B capital structure (doc scan) ───────────────────────────────────────────

def test_capstructure_orders_by_seniority():
    found = scan_tranches([("c1", "a subordinated note"), ("c2", "first-lien term loan B and a revolving credit facility")])
    assert [t["code"] for t in found] == ["RCF", "1L", "SUB"]  # senior → junior
    p = _run(synthesize_capital_structure(_retrieve("revolving credit facility, first-lien term loan, second-lien")))
    _ok(p, "CP-3B")
    assert p.runtime_output["seniority_order"][0] == "RCF"


# ── debate integration ─────────────────────────────────────────────────────────

def test_overlays_feed_the_ic_debate():
    up = {
        "CP-1": _cp1(leverage=6.5),
        "CP-2D": ModulePayload("CP-2D", "", "sponsor_governance_review", {"governance_risk_score": 3}),
        "CP-2F": ModulePayload("CP-2F", "", "macro_sector_overlay",
                               {"scenarios": [{"rate_shock_bps": 200, "stressed_interest_coverage": 1.2}]}),
        "CP-3D": ModulePayload("CP-3D", "", "trading_liquidity_analysis", {"lme_vulnerability_band": "HIGH"}),
    }
    bull, bear = debate._ic_signals(up)
    assert {"CP-2D", "CP-2F", "CP-3D"} <= {p.source for p in bear}
