"""CP-3C live concentration + CP-6A signal + run→portfolio auto-binding (3C).

The concentration register goes live when a run is bound to a portfolio: CP-3C
reads the bound book's positions/constraints (assess_issuer_fit), and CP-6A's
debate gains a concentration point. A run auto-binds the single portfolio that
holds the issuer. These exercise the new wiring directly (real session, no LLM).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

from engine.schemas import ModulePayload  # noqa: E402


def _cp3(rec="OVERWEIGHT"):
    return ModulePayload(module_id="CP-3", module_name="RV", owned_object="rv",
                         runtime_output={"recommendation": rec, "composite_percentile": 80})


def _cp1(lev=3.0):
    return ModulePayload(module_id="CP-1", module_name="CDF", owned_object="fin",
                         runtime_output={"normalized_financials": {"net_leverage_adj_ltm": lev}})


@pytest.mark.asyncio
async def test_cp3c_goes_live_when_portfolio_bound(seeded_db):
    from database import (
        AsyncSessionLocal, Issuer, Portfolio, PortfolioConstraint, PortfolioPosition,
    )
    from engine.portfoliofit import synthesize_portfolio_fit

    async with AsyncSessionLocal() as s:
        iss = Issuer(name="BigName Co", ticker="BIG")
        s.add(iss)
        prt = Portfolio(name="Fit CLO", mandate={})
        s.add(prt)
        await s.flush()
        # BigName = 5M of a 10M book = 50% vs a 2.5% single-name cap → HIGH.
        s.add(PortfolioPosition(portfolio_id=prt.id, issuer_id=iss.id, borrower_name="BigName Co",
                                sector="Software", ranking="1L Sr. Secd", par_usd=5_000_000, price=100))
        s.add(PortfolioPosition(portfolio_id=prt.id, borrower_name="Other Co", sector="Insurance",
                                ranking="1L Sr. Secd", par_usd=5_000_000, price=100))
        s.add(PortfolioConstraint(portfolio_id=prt.id, category="Single Name",
                                  limit_value=2.5, limit_op="<="))
        await s.flush()

        # Unbound: the concentration stub stands (no portfolio_id).
        stub = await synthesize_portfolio_fit(_cp3(), _cp1())
        assert "concentration" not in stub.runtime_output
        assert "not ingested" in stub.runtime_output["note"]

        # Bound: real concentration replaces the stub.
        live = await synthesize_portfolio_fit(_cp3(), _cp1(), s, iss, prt.id)
        conc = live.runtime_output["concentration"]
        assert conc["in_portfolio"] and conc["held_pct_nav"] == 50.0
        assert conc["concentration_risk"] == "HIGH"
        assert "live" in live.runtime_output["note"].lower()
        assert any("concentration HIGH" in f for f in live.runtime_output["risk_flags"])


@pytest.mark.asyncio
async def test_bound_empty_book_is_explicit_not_masked_as_uningested(seeded_db):
    from database import AsyncSessionLocal, Issuer, Portfolio
    from engine.portfoliofit import synthesize_portfolio_fit

    async with AsyncSessionLocal() as s:
        issuer = Issuer(name="Empty Book Issuer")
        portfolio = Portfolio(name="Empty Fit Book", mandate={})
        s.add_all([issuer, portfolio])
        await s.flush()

        out = await synthesize_portfolio_fit(_cp3(), _cp1(), s, issuer, portfolio.id)
        concentration = out.runtime_output["concentration"]
        assert concentration["data_status"] == "empty-book"
        assert concentration["n_positions"] == 0
        assert "empty" in out.runtime_output["note"].lower()
        assert "not ingested" not in out.runtime_output["note"].lower()


@pytest.mark.asyncio
async def test_bound_portfolio_access_or_calculation_failure_blocks_cp3c(seeded_db, monkeypatch):
    from database import AsyncSessionLocal, Issuer
    from engine import portfoliofit

    async with AsyncSessionLocal() as s:
        issuer = Issuer(name="Blocked Fit Issuer")
        s.add(issuer)
        await s.flush()

        async def fail_read(*args, **kwargs):
            raise ValueError("calculation failed")

        monkeypatch.setattr(portfoliofit, "_live_concentration", fail_read)
        out = await portfoliofit.synthesize_portfolio_fit(
            _cp3(), _cp1(), s, issuer, "portfolio-id"
        )
        assert out.runtime_output["module_status"] == "Blocked"
        assert out.confidence == "Insufficient Information"
        assert out.limitation_flags


@pytest.mark.asyncio
async def test_missing_bound_portfolio_blocks_instead_of_claiming_uningested(seeded_db):
    from database import AsyncSessionLocal, Issuer
    from engine.portfoliofit import synthesize_portfolio_fit

    async with AsyncSessionLocal() as session:
        issuer = Issuer(name="Missing Bound Book Issuer")
        session.add(issuer)
        await session.flush()

        out = await synthesize_portfolio_fit(
            _cp3(), _cp1(), session, issuer, "missing-portfolio-id"
        )
        assert out.runtime_output["module_status"] == "Blocked"
        assert out.confidence == "Insufficient Information"
        assert "not ingested" not in out.runtime_output["note"].lower()


@pytest.mark.asyncio
async def test_bound_portfolio_database_failure_propagates_for_rollback(seeded_db, monkeypatch):
    from database import AsyncSessionLocal, Issuer
    from engine import portfoliofit
    from sqlalchemy.exc import OperationalError

    async with AsyncSessionLocal() as s:
        issuer = Issuer(name="DB Failure Fit Issuer")
        s.add(issuer)
        await s.flush()

        async def fail_read(*args, **kwargs):
            raise OperationalError("SELECT positions", {}, Exception("connection lost"))

        monkeypatch.setattr(portfoliofit, "_live_concentration", fail_read)
        with pytest.raises(OperationalError):
            await portfoliofit.synthesize_portfolio_fit(
                _cp3(), _cp1(), s, issuer, "portfolio-id"
            )


def test_ic_signals_reads_cp3c_concentration():
    from engine.debate import _ic_signals

    cp3c = ModulePayload(module_id="CP-3C", module_name="fit", owned_object="portfolio_fit_analysis",
                         runtime_output={"concentration": {
                             "concentration_risk": "HIGH", "held_pct_nav": 8.0, "in_portfolio": True,
                             "sector": "Software", "sector_pct_nav": 12.0}})
    _bull, bear = _ic_signals({"CP-3C": cp3c})
    assert any(p.source == "CP-3C" for p in bear)
    # No concentration key (unbound run) → no CP-3C point, no crash.
    empty = ModulePayload(module_id="CP-3C", module_name="fit", owned_object="portfolio_fit_analysis",
                          runtime_output={"note": "stub"})
    _b2, bear2 = _ic_signals({"CP-3C": empty})
    assert not any(p.source == "CP-3C" for p in bear2)


@pytest.mark.asyncio
async def test_run_auto_binds_holding_portfolio(seeded_db):
    from database import AsyncSessionLocal, Issuer, Portfolio, PortfolioPosition
    from routes.runs import _auto_portfolio

    async with AsyncSessionLocal() as s:
        iss = Issuer(name="Held X Co")
        s.add(iss)
        a = Portfolio(name="Book A", mandate={})
        s.add(a)
        await s.flush()
        s.add(PortfolioPosition(portfolio_id=a.id, issuer_id=iss.id, borrower_name="Held X Co",
                                par_usd=1_000_000, price=100))
        await s.flush()
        # Exactly one book holds it → auto-bind. Unheld → None.
        assert await _auto_portfolio(s, iss.id) == a.id
        assert await _auto_portfolio(s, "no-such-issuer") is None

        # Held in two books → ambiguous → None (don't guess).
        b = Portfolio(name="Book B", mandate={})
        s.add(b)
        await s.flush()
        s.add(PortfolioPosition(portfolio_id=b.id, issuer_id=iss.id, borrower_name="Held X Co",
                                par_usd=1_000_000, price=100))
        await s.flush()
        assert await _auto_portfolio(s, iss.id) is None
