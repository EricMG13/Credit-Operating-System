"""CP-2E LiquidityMaturityAnalysis (review run-2 #B1): the maturity wall is a USE of
liquidity, not a source — it must not inflate disclosed_liquidity_musd or the interest
runway, though it stays in the sources register as a disclosed fact."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

from engine.liquidity import synthesize_liquidity


def _retrieve(chunks):
    async def retrieve(_q, _k=6):
        return [SimpleNamespace(chunk_id=c, text=t) for c, t in chunks]
    return retrieve


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
