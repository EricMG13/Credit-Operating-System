"""CP-3C PortfolioFitAnalysis — sleeve fit and a sizing posture.

Deterministic off CP-3's relative-value recommendation and CP-1's leverage: maps
the issuer to a portfolio sleeve and a suggested sizing bucket, and raises risk-
budget flags. Concentration / correlation checks need a live portfolio feed (not
ingested), so those are flagged, not invented. No documents, no LLM.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engine.periods import is_finite_number
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

_FIT = {
    "OVERWEIGHT": ("core", "full target size"),
    "NEUTRAL": ("satellite", "half target size"),
    "UNDERWEIGHT": ("tactical only", "minimal / pass"),
}


def assess_fit(cp3_rt: dict, leverage: Optional[float]) -> Optional[dict]:
    """Map CP-3's relative-value lean to a portfolio sleeve, a sizing bucket, and risk-budget flags.

    Reads the credit view two upstream modules have already formed and turns it
    into an allocation posture a PM can act on:

    - CP-3's relative-value recommendation (the OVERWEIGHT / NEUTRAL / UNDERWEIGHT
      lean) selects *where* the name sits and *how big* it can run, via ``_FIT``:
        * OVERWEIGHT  -> core sleeve,        full target size   (high conviction)
        * NEUTRAL     -> satellite sleeve,   half target size   (carry, not a bet)
        * UNDERWEIGHT -> tactical only,      minimal / pass     (trade, or skip)
      A lean outside those three known buckets can't be sized, so we return None
      and let CP-3C degrade rather than guess a sleeve.
    - CP-1's net leverage is a separate, additive risk-budget check: at >= 6.0x
      the name draws down the risk budget regardless of how attractive the
      relative value looks, so we raise a caution flag (the lean still stands —
      the flag just tells the PM what it costs).

    Concentration and correlation — whether adding this name doubles up an
    existing sector/issuer bet — depend on the *current* book, which the engine
    does not ingest (no live portfolio feed). We flag that limitation in ``note``
    rather than fabricate a check we can't actually run. Output feeds CP-6E.
    """
    # Relative-value lean -> (sleeve, sizing). Only the three known leans are
    # sizable; anything else (missing / None / lowercase / "BUY" / ...) -> None.
    rec = cp3_rt.get("recommendation")
    if rec not in _FIT:
        return None
    sleeve, sizing = _FIT[rec]

    # Risk-budget overlay: leverage at or above 6.0x is a caution, independent of
    # the sleeve fit. is_finite_number rejects NaN/inf/non-numeric explicitly (the
    # CLAUDE.md convention), so such a leverage raises no flag and never crashes.
    flags = []
    if is_finite_number(leverage) and leverage >= 6.0:
        flags.append(f"High leverage ({leverage:g}x) — counts against the risk budget.")

    return {
        "sleeve_fit": sleeve, "suggested_sizing": sizing,
        "rv_recommendation": rec, "composite_percentile": cp3_rt.get("composite_percentile"),
        "risk_flags": flags,
        "note": "Concentration/correlation checks require a portfolio feed (not ingested).",
    }


async def _live_concentration(session: AsyncSession, portfolio_id: str, issuer) -> Optional[dict]:
    """The issuer's live concentration in a bound portfolio (assess_issuer_fit over
    its persisted positions + constraints). None if the portfolio has no positions."""
    from database import PortfolioConstraint, PortfolioPosition
    from engine.portfolio import assess_issuer_fit

    prows = (await session.execute(
        select(
            PortfolioPosition.issuer_id, PortfolioPosition.borrower_name, PortfolioPosition.sector,
            PortfolioPosition.ranking, PortfolioPosition.rating_moody, PortfolioPosition.rating_sp,
            PortfolioPosition.par_usd, PortfolioPosition.price
        ).where(PortfolioPosition.portfolio_id == portfolio_id)
    )).all()
    if not prows:
        return None
    positions: List[Dict[str, Any]] = [{
        "issuer_id": p.issuer_id, "borrower_name": p.borrower_name, "sector": p.sector,
        "ranking": p.ranking, "rating_moody": p.rating_moody, "rating_sp": p.rating_sp,
        "par_usd": p.par_usd, "price": p.price,
    } for p in prows]
    crows = (await session.execute(
        select(PortfolioConstraint.category, PortfolioConstraint.limit_value).where(
            PortfolioConstraint.portfolio_id == portfolio_id
        )
    )).all()
    constraints = [{"category": c.category, "limit_value": c.limit_value} for c in crows]
    return assess_issuer_fit(positions, constraints, issuer_id=issuer.id, issuer_name=issuer.name)


async def synthesize_portfolio_fit(
    cp3: ModulePayload, cp1: Optional[ModulePayload],
    session: Optional[AsyncSession] = None, issuer=None, portfolio_id: Optional[str] = None,
) -> ModulePayload:
    """Build the CP-3C payload from CP-3's recommendation + CP-1 leverage. When the
    run is bound to a portfolio (``portfolio_id``), the concentration/correlation
    stub is replaced with a real read over that book's holdings."""
    leverage = (((cp1.runtime_output or {}).get("normalized_financials") or {}).get("net_leverage_adj_ltm")
                if cp1 is not None else None)
    fit = assess_fit(cp3.runtime_output or {}, leverage)
    if fit is None:
        return ModulePayload(
            module_id="CP-3C", module_name="PortfolioFitPositionSizing",
            owned_object="portfolio_fit_analysis",
            runtime_output={"note": "CP-3 produced no relative-value recommendation to size."},
            confidence="Insufficient Information",
            limitation_flags=["No relative-value recommendation available for a portfolio-fit read."],
            downstream_consumers=["CP-6E"],
        )
    # Live concentration when the run is bound to a portfolio (replaces the stub).
    conc = None
    if session is not None and portfolio_id and issuer is not None:
        try:
            conc = await _live_concentration(session, portfolio_id, issuer)
        except Exception:  # a portfolio read must never abort the sizing read
            conc = None
    if conc is not None:
        fit["concentration"] = conc
        fit["note"] = "Concentration computed live from the bound portfolio's holdings."
        risk = conc.get("concentration_risk")
        if risk in ("HIGH", "MODERATE"):
            tail = (f", sector {conc['sector']} at {conc['sector_pct_nav']}% of NAV"
                    if conc.get("sector_pct_nav") is not None else "")
            fit["risk_flags"].append(
                f"Portfolio concentration {risk}: name is {conc['held_pct_nav']}% of NAV{tail}.")
    return ModulePayload(
        module_id="CP-3C", module_name="PortfolioFitPositionSizing",
        owned_object="portfolio_fit_analysis", runtime_output=fit, confidence="High",
        downstream_consumers=["CP-6E"],
        claims=[ClaimSpec(
            claim_id="C-FIT1",
            claim_text=(f"Fits the {fit['sleeve_fit']} sleeve at {fit['suggested_sizing']} "
                        f"({fit['rv_recommendation']} relative value)."),
            evidence=[EvidenceSpec("E-FIT1", "upstream_artifact", "Calculated",
                                   "Derived from CP-3 recommendation and CP-1 leverage", "Medium")],
        )],
    )
