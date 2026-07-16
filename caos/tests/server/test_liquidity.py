"""CP-2E LiquidityMaturityAnalysis (review run-2 #B1): the maturity wall is a USE of
liquidity, not a source — it must not inflate disclosed_liquidity_musd or the interest
runway, though it stays in the sources register as a disclosed fact."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

from engine.liquidity import synthesize_liquidity
from engine.schemas import ModulePayload


def _retrieve(chunks):
    async def retrieve(_q, _k=6):
        return [SimpleNamespace(chunk_id=c, text=t) for c, t in chunks]
    return retrieve


def _cp1(eb=400.0, cov=2.0):
    return ModulePayload("CP-1", "X", "canonical_financials", {
        "normalized_financials": {
            "adj_ebitda": {"LTM_Q1_26": eb},
            "interest_coverage_ltm": cov,
        },
    })


def test_disclosed_liquidity_excludes_maturity_wall():
    p = asyncio.run(synthesize_liquidity(_retrieve([
        ("c-cash", "Cash and cash equivalents of $300 million at period end."),
        ("c-rcf", "$200 million undrawn under the revolving credit facility."),
        ("c-mat", "$800 million of debt matures in 2027."),
    ])))
    ro = p.runtime_output
    assert ro["disclosed_liquidity_musd"] == 500.0  # 300 + 200, NOT + the 800 maturity wall
    assert any(s["source"] == "Maturity wall" for s in ro["sources"])  # still disclosed


def test_disclosed_liquidity_sums_real_sources():
    p = asyncio.run(synthesize_liquidity(_retrieve([
        ("c-cash", "Cash and cash equivalents of $150 million."),
        ("c-rcf", "$50 million undrawn revolver availability."),
    ])))
    assert p.runtime_output["disclosed_liquidity_musd"] == 200.0


def test_interest_runway_none_on_nan_ebitda():
    # is_finite_number(ebitda) guard (engine/liquidity.py _interest_runway_months):
    # a NaN LTM EBITDA must degrade the runway to None, not poison the divide.
    # The liquidity sum itself is unaffected — it does not depend on CP-1.
    p = asyncio.run(synthesize_liquidity(_retrieve([
        ("c-cash", "Cash and cash equivalents of $300 million at period end."),
        ("c-rcf", "$200 million undrawn under the revolving credit facility."),
    ]), cp1=_cp1(eb=float("nan"))))
    ro = p.runtime_output
    assert ro["disclosed_liquidity_musd"] == 500.0
    assert ro["annual_cash_interest_musd"] is None
    assert ro["months_liquidity_covers_interest"] is None


def test_interest_runway_none_on_inf_ebitda():
    # is_finite_number(ebitda) guard: +inf LTM EBITDA must degrade to None, not
    # poison the divide into an inf (truthy, so it would survive the downstream
    # "if not annual_cash_interest" zero-check unless the finite guard rejects it
    # up front). NOTE: an inf *coverage* is not a useful adversarial case here —
    # eb / inf always rounds to a falsy 0.0, so the separate zero-guard below
    # masks a weakened isinstance check regardless; inf must be on the numerator.
    p = asyncio.run(synthesize_liquidity(_retrieve([
        ("c-cash", "Cash and cash equivalents of $150 million."),
        ("c-rcf", "$50 million undrawn revolver availability."),
    ]), cp1=_cp1(eb=float("inf"))))
    ro = p.runtime_output
    assert ro["disclosed_liquidity_musd"] == 200.0
    assert ro["annual_cash_interest_musd"] is None
    assert ro["months_liquidity_covers_interest"] is None


def test_zero_liquidity_claim_is_finite_and_reconciles_to_zero(monkeypatch):
    import engine.liquidity as liquidity

    monkeypatch.setattr(liquidity, "scan_liquidity", lambda _pairs: [{
        "source": "Cash and cash equivalents",
        "amount_musd": 0.0,
        "chunk_id": "zero-cash",
    }])
    p = asyncio.run(liquidity.synthesize_liquidity(
        _retrieve([("zero-cash", "Cash and cash equivalents were nil.")]),
        cp1=_cp1(),
    ))

    assert p.runtime_output["disclosed_liquidity_musd"] == 0.0
    assert p.runtime_output["months_liquidity_covers_interest"] == 0.0
    assert "~$0M" in p.claims[0].claim_text
    assert "~0 months" in p.claims[0].claim_text


def test_negative_liquidity_is_excluded_from_claim_and_loudly_degraded(monkeypatch):
    import engine.liquidity as liquidity

    monkeypatch.setattr(liquidity, "scan_liquidity", lambda _pairs: [{
        "source": "Undrawn revolving credit facility",
        "amount_musd": -25.0,
        "chunk_id": "negative-rcf",
    }])
    p = asyncio.run(liquidity.synthesize_liquidity(
        _retrieve([("negative-rcf", "Revolver availability was reported.")]),
        cp1=_cp1(),
    ))

    assert p.runtime_output["disclosed_liquidity_musd"] is None
    assert p.runtime_output["months_liquidity_covers_interest"] is None
    assert p.confidence == "Insufficient Information"
    assert any("Negative" in flag for flag in p.limitation_flags)
    assert "-25" not in p.claims[0].claim_text
    assert "$-" not in p.claims[0].claim_text
