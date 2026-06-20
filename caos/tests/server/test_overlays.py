"""The L2/L3 overlay synthesizers (CP-2C/2D/2E/2F, CP-3B/3C/3D) and that the
wired ones feed the CP-6A debate. Deterministic / offline."""

from __future__ import annotations

import asyncio

from engine import debate
from engine.capstructure import (
    recovery_waterfall, scan_tranches, synthesize_recovery_preference)
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


def test_macro_hedge_and_fx_register_from_scan():
    p = _run(synthesize_macro(_cp1(), _retrieve(
        "The group entered a pay-fixed interest-rate swap.",
        "A portion of revenue is foreign-currency denominated, creating an FX exposure.")))
    _ok(p, "CP-2F")
    kinds = {r["kind"] for r in p.runtime_output["hedge_register"]}
    assert p.runtime_output["rate_hedge_disclosed"] is True
    assert p.runtime_output["fx_exposure_flagged"] is True and "fx_exposure" in kinds


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


# ── CP-3B recovery / instrument preference (doc scan + waterfall) ────────────────

def test_capstructure_orders_by_seniority():
    found = scan_tranches([("c1", "a subordinated note"), ("c2", "first-lien term loan B and a revolving credit facility")])
    assert [t["code"] for t in found] == ["RCF", "1L", "SUB"]  # senior → junior
    p = _run(synthesize_recovery_preference(_retrieve("revolving credit facility, first-lien term loan, second-lien")))
    _ok(p, "CP-3B")
    assert p.runtime_output["seniority_order"][0] == "RCF"


def test_recovery_waterfall_absolute_priority():
    # $1000M EV over RCF 200 / 1L 800 / 2L 200: senior fully recover, 2L wiped.
    rows = recovery_waterfall(
        [{"code": "RCF", "seniority_rank": 0, "amount_musd": 200.0},
         {"code": "1L", "seniority_rank": 1, "amount_musd": 800.0},
         {"code": "2L", "seniority_rank": 3, "amount_musd": 200.0}], 1000.0)
    by = {r["code"]: r for r in rows}
    assert by["RCF"]["recovery_pct"] == 100.0 and by["1L"]["recovery_pct"] == 100.0
    assert by["2L"]["recovery_pct"] == 0.0


def test_recovery_preference_ranks_by_recovery():
    # CP-1 EBITDA 421 → distressed EV 2105; sized stack fully covered → senior preferred.
    p = _run(synthesize_recovery_preference(_retrieve(
        "The revolving credit facility is $200 million.",
        "The first-lien term loan B is $800 million.",
        "The second-lien term loan is $200 million."), _cp1()))
    _ok(p, "CP-3B")
    assert p.runtime_output["distressed_ev_musd"] == round(421.0 * 5.0, 1)
    assert p.runtime_output["preference"][0]["recovery_pct"] == 100.0


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


# ── Phase 5: quantum capture (sizes / ledger / runway) ───────────────────────────

def test_textscan_amount_musd():
    import re as _re
    from engine.textscan import amount_musd
    assert amount_musd("a $1.2 billion revolver", _re.compile("revolver")) == 1200.0
    assert amount_musd("a revolver of $250 million", _re.compile("revolver")) == 250.0
    assert amount_musd("a revolver, size undisclosed", _re.compile("revolver")) is None


def test_capstructure_sizes_tranches_and_pct():
    # One tranche per chunk so each amount is unambiguous (the ±120-char proximity
    # heuristic can't disambiguate two tranches+amounts in the same sentence).
    p = _run(synthesize_recovery_preference(_retrieve(
        "The revolving credit facility is $200 million.",
        "The first-lien term loan B is $800 million.",
        "The second-lien term loan is $200 million.")))
    _ok(p, "CP-3B")
    assert p.runtime_output["total_debt_musd"] == 1200.0
    by = {t["code"]: t for t in p.runtime_output["tranches"]}
    assert by["1L"]["amount_musd"] == 800.0
    assert by["1L"]["pct_of_structure"] == round(100 * 800 / 1200, 1)


def test_sponsor_ledger_captures_quantum():
    p = _run(synthesize_sponsor_review(_retrieve(
        "An annual management fee of $5 million is payable to the sponsor.")))
    _ok(p, "CP-2D")
    assert any(e["amount_musd"] == 5.0 for e in p.runtime_output["ledger"])


def test_liquidity_runway_priced_off_cp1():
    # $300M liquidity; CP-1 EBITDA 421 / coverage 2.1 → cash interest 200.5 → ~18 months.
    p = _run(synthesize_liquidity(
        _retrieve("$300 million of undrawn revolving credit facility availability"), _cp1()))
    _ok(p, "CP-2E")
    rt = p.runtime_output
    assert rt["disclosed_liquidity_musd"] == 300.0
    assert rt["annual_cash_interest_musd"] == 200.5
    assert 17.0 <= rt["months_liquidity_covers_interest"] <= 19.0


def test_liquidity_runway_absent_without_cp1():
    p = _run(synthesize_liquidity(_retrieve("$300 million undrawn revolving credit facility")))
    assert p.runtime_output["months_liquidity_covers_interest"] is None
