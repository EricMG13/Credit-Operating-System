"""EDGAR XBRL → CP-1 reported foundation.

The financial-data counterpart to the covenant/legal retrieval lane in
[edgar.py]: it reads an issuer's us-gaap **company facts** and builds a CP-1
payload on a **reported GAAP basis**, each figure cited to the exact XBRL fact
(concept · fiscal year · accession). Deterministic and reproducible — no key, no
token cost — it is the run-time counterpart to the LLM/fixture CP-1.

It deliberately does **not** invent covenant-adjusted EBITDA or add-backs: those
exist only in the credit agreement and are the job of the LLM-adjusted CP-1 layer
/ CP-4C. EBITDA here is an explicit ``operating income + D&A`` proxy, flagged in
``limitation_flags``; the reported-vs-adjusted gap is itself a credit signal.

Network access is **reused from [edgar.py]** (``_get_json`` over stdlib urllib,
SEC fair-access throttle + the ``EDGAR_USER_AGENT`` off-switch), so this module
adds no new dependency and stays importable on Python 3.9.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Sequence, Tuple

import edgar  # the covenant/legal retrieval lane — reused for HTTP + CIK helpers
from engine.distress import altman_z_double_prime
from engine.periods import is_finite_number
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

logger = logging.getLogger("caos.edgar")

_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

# us-gaap concept fallbacks (first present wins).
_REVENUE = ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
            "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet")
_OP_INCOME = ("OperatingIncomeLoss",)
_DA = ("DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet",
       "DepreciationAndAmortization")
# Many filers (satellite / telecom / industrials — e.g. Viasat) report no combined
# D&A tag, only the components; sum them as the EBITDA add-back when the combined
# tag is absent.
_DEPRECIATION = ("Depreciation", "DepreciationNonproduction")
_AMORTIZATION = ("AmortizationOfIntangibleAssets", "AmortizationOfAcquiredIntangibleAssets")
# Non-cash impairments to add back to the EBITDA proxy (first present wins) — a
# goodwill write-down can swamp operating income for a year (e.g. Six Flags FY25).
_IMPAIRMENT = ("GoodwillAndIntangibleAssetImpairment", "GoodwillImpairmentLoss",
               "AssetImpairmentCharges", "ImpairmentOfLongLivedAssetsHeldAndUsed",
               "TangibleAssetImpairmentCharges")
_INTEREST = ("InterestExpense", "InterestExpenseDebt", "InterestAndDebtExpense")
_LT_DEBT = ("LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations", "LongTermDebt")
_DEBT_CURRENT = ("LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent", "DebtCurrent")
_CASH = ("CashAndCashEquivalentsAtCarryingValue",
         "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents")
# Balance-sheet concepts for the Altman Z'' distress score (all instant).
_TOTAL_ASSETS = ("Assets",)
_CURRENT_ASSETS = ("AssetsCurrent",)
_CURRENT_LIAB = ("LiabilitiesCurrent",)
_RETAINED = ("RetainedEarningsAccumulatedDeficit",)
_TOTAL_LIAB = ("Liabilities",)
_EQUITY = ("StockholdersEquity",
           "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest")
# Cash-flow statement (flow) for free cash flow = operating cash flow − capex.
_CFO = ("NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations")
_CAPEX = ("PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets")


@dataclass
class Cp1Build:
    """A CP-1 grounding from EDGAR: the payload + the source text to vault as a
    chunk (so evidence resolves to a real chunk / click-to-source) + the CIK."""

    payload: ModulePayload
    facts_text: str
    cik: str


# ── Pure XBRL parsing (unit-tested, no network) ──────────────────────────────
def _annual_series(units: Sequence[dict], kind: str, max_years: int = 5) -> Dict[int, Tuple[float, str]]:  # noqa: C901 — flat XBRL point filter; splitting would obscure the form/fp/span guards
    """Annual values keyed by the period's **end year** → (value, accession).

    Annual-report points only (form 10-K*, fp FY); full-year spans for flow
    items, fiscal year-end balances for instants. Keys by the value's own period
    end (not the filing ``fy``, which would collapse a 10-K's comparative years).
    Restatements supersede: latest-filed wins per year.
    """
    best: Dict[int, dict] = {}
    for e in units:
        if not str(e.get("form", "")).startswith("10-K") or str(e.get("fp", "")) != "FY":
            continue
        start, end = e.get("start"), e.get("end")
        if not end:
            continue
        try:
            end_d = date.fromisoformat(end)
        except ValueError:
            continue
        if kind == "flow":
            if not start:
                continue
            try:
                span = (end_d - date.fromisoformat(start)).days
            except ValueError:
                continue
            if not (350 <= span <= 380):
                continue
        elif start:  # instant facts carry only `end`
            continue
        val = e.get("val")
        # is_finite_number (not a bare isinstance): edgar._get_json uses the default
        # json decoder, which parses NaN/Infinity tokens — a plain isinstance passes
        # them (and bool(NaN) is True), leaking a non-finite value into every CP-1
        # series and on into e.g. interest_coverage_ltm. Reject at the parse boundary
        # per the CLAUDE.md invariant. (confidence-review 2026-07-01)
        if not is_finite_number(val):
            continue
        cur = best.get(end_d.year)
        if cur is None or str(e.get("filed", "")) > str(cur.get("filed", "")):
            best[end_d.year] = e
    keep = sorted(best)[-max_years:]
    return {y: (float(best[y]["val"]), str(best[y].get("accn", ""))) for y in keep}


def _series(us_gaap: dict, names: Sequence[str], kind: str) -> Tuple[Optional[str], Dict[int, Tuple[float, str]]]:
    """First present concept's annual series → (concept_name, {year: (val, accn)})."""
    for name in names:
        data = (us_gaap.get(name) or {}).get("units", {}).get("USD")
        if data:
            series = _annual_series(data, kind)
            if series:
                return name, series
    return None, {}


def _da_series(us_gaap: dict) -> Tuple[Optional[str], Dict[int, Tuple[float, str]]]:
    """D&A annual series → (label, {year: (val, accn)}). Prefer a combined D&A
    concept; otherwise sum the components (depreciation + intangible amortization),
    which is how many filers (e.g. Viasat) report it rather than a single D&A line."""
    name, series = _series(us_gaap, _DA, "flow")
    if series:
        return name, series
    _, dep = _series(us_gaap, _DEPRECIATION, "flow")
    _, amort = _series(us_gaap, _AMORTIZATION, "flow")
    if not dep and not amort:
        return None, {}
    combined: Dict[int, Tuple[float, str]] = {}
    for y in sorted(set(dep) | set(amort)):
        val = (dep[y][0] if y in dep else 0.0) + (amort[y][0] if y in amort else 0.0)
        combined[y] = (val, dep[y][1] if y in dep else amort[y][1])
    return "Depreciation+AmortizationOfIntangibleAssets", combined


def _latest(series: Dict[int, Tuple[float, str]], year: int) -> Optional[Tuple[float, str]]:
    if year in series:
        return series[year]
    earlier = [y for y in series if y <= year]
    return series[max(earlier)] if earlier else None


def _recent_instant(us_gaap: dict, names: Sequence[str], year: int):
    """Among candidate instant concepts, the one whose latest value at-or-before
    ``year`` is the *most recent* — so a concept a filer stopped tagging years ago
    (e.g. Viasat's LongTermDebtNoncurrent, last tagged 2019, after it moved to
    LongTermDebtAndCapitalLeaseObligations) never supplies a stale figure. Returns
    ``(value_year, value, accession, concept)`` or None."""
    best = None
    for name in names:
        data = (us_gaap.get(name) or {}).get("units", {}).get("USD")
        if not data:
            continue
        series = _annual_series(data, "instant")
        cand = [y for y in series if y <= year]
        if not cand:
            continue
        y = max(cand)
        if best is None or y > best[0]:
            best = (y, series[y][0], series[y][1], name)
    return best


def _m(v: float) -> float:
    """USD → $M, one decimal (the catalog/UI unit)."""
    return round(v / 1e6, 1)


@dataclass
class _LevFacts:
    """Leverage-year debt/cash/coverage facts derived at the EBITDA period."""

    total_debt: float
    net_debt: float
    leverage: Optional[float]
    debt_fresh: bool
    int_ly: Optional[Tuple[float, str]]
    int_fresh: bool
    ltd_c: Optional[str]
    dc_c: Optional[str]
    cash_c: Optional[str]


def _ebitda_proxy(years: Sequence[int], opinc: Dict[int, Tuple[float, str]],
                  da: Dict[int, Tuple[float, str]],
                  impair: Dict[int, Tuple[float, str]]) -> Dict[int, float]:
    """Reported EBITDA proxy = operating income + D&A, plus a non-cash impairment add-back
    ONLY in a year the impairment drove operating income negative (Six Flags FY25: op
    income -$1.4bn on a ~$1.5bn goodwill write-down, masking a cash-generative
    business). On a profitable year, adding the impairment back would overstate EBITDA
    and understate leverage, and companyfacts gives no calc-linkbase to confirm the
    charge sits above the operating-income subtotal — so gate on opinc < 0. (#26)"""
    return {y: opinc[y][0] + da[y][0] + (impair[y][0] if (y in impair and opinc[y][0] < 0) else 0.0)
            for y in years if y in opinc and y in da}


def _leverage_and_coverage(us: dict, ly: int, eb_ly: Optional[float],
                           interest: Dict[int, Tuple[float, str]], financials: dict) -> _LevFacts:
    """Debt/cash at the leverage year, net leverage and interest coverage. Mutates
    ``financials`` with net_debt_ltm / net_leverage_adj_ltm / interest_coverage_ltm
    when meaningful; returns the facts the claims + limitation flags consume."""
    # Debt/cash at the leverage year, picking the concept with the most recent
    # coverage — filers (e.g. Viasat) stop tagging LongTermDebtNoncurrent and switch
    # to LongTermDebtAndCapitalLeaseObligations, so never trust a stale concept.
    ltd_at = _recent_instant(us, _LT_DEBT, ly)
    dcur_at = _recent_instant(us, _DEBT_CURRENT, ly)
    cash_at = _recent_instant(us, _CASH, ly)
    total_debt = (ltd_at[1] if ltd_at else 0.0) + (dcur_at[1] if dcur_at else 0.0)
    net_debt = total_debt - (cash_at[1] if cash_at else 0.0)
    # Don't compute leverage off stale legs: net debt is summed from three
    # independently-dated XBRL instants (LT debt, current debt, cash), so EVERY
    # present leg must be within a year of the EBITDA period — a discontinued
    # current-debt tag inflates leverage, a discontinued cash tag understates it,
    # and the FY{ly} label would silently misdate both. Mirror the bs_stale Altman
    # discipline below. (review run-2 #B2/#B3)
    # ponytail: suppress leverage when any leg is stale; refine to drop-stale-cash
    # (conservative gross-debt leverage + flag) if losing the figure ever matters.
    leg_years = [at[0] for at in (ltd_at, dcur_at, cash_at) if at is not None]
    debt_fresh = bool(leg_years) and all(y >= ly - 1 for y in leg_years)
    int_ly = _latest(interest, ly)
    # Interest coverage must use interest from the EBITDA period, not a discontinued
    # concept: _series picks the first _INTEREST tag with any data and never merges,
    # so a filer that switched concepts can leave the series topping out years before
    # EBITDA. Gate on freshness like debt (mirror debt_fresh). (#25)
    int_year = ly if ly in interest else max((y for y in interest if y <= ly), default=None)
    int_fresh = int_year is not None and int_year >= ly - 1
    # Only emit leverage when it is meaningful: positive EBITDA and positive net
    # debt. A loss year, a net-cash position, or captive-finance debt not fully
    # captured by these tags (e.g. Ford Credit) would otherwise yield a
    # misleading figure (negative or absurd leverage).
    leverage = None
    if eb_ly and eb_ly > 0 and total_debt and net_debt > 0 and debt_fresh:
        leverage = round(net_debt / eb_ly, 2)  # reported basis
        financials["net_debt_ltm"] = _m(net_debt)
        financials["net_leverage_adj_ltm"] = leverage
    # int_ly[0] > 0, not just truthy — symmetric with the leverage guard above: a
    # filer tagging interest as a negative XBRL value would otherwise emit a
    # nonsensical NEGATIVE coverage (finite but wrong-signed, BE1-1).
    if eb_ly and eb_ly > 0 and int_ly and int_ly[0] and int_ly[0] > 0 and int_fresh:
        financials["interest_coverage_ltm"] = round(eb_ly / int_ly[0], 2)
    return _LevFacts(
        total_debt=total_debt, net_debt=net_debt, leverage=leverage, debt_fresh=debt_fresh,
        int_ly=int_ly, int_fresh=int_fresh,
        ltd_c=ltd_at[3] if ltd_at else None, dc_c=dcur_at[3] if dcur_at else None,
        cash_c=cash_at[3] if cash_at else None,
    )


def _altman_distress(us: dict, ly: int, opinc: Dict[int, Tuple[float, str]],
                     nf: dict) -> Tuple[Optional[Tuple[float, str]], bool]:
    """Altman Z'' distress score (balance-sheet only) when every input is present
    AND fresh. Mutates ``nf['distress']`` when a score is emitted; returns
    ``(z, bs_stale)`` for the claims + limitation flags. _inst_at returns (year,
    value): the leverage path already gates on debt_fresh, so the Z'' inputs must get
    the same freshness discipline or a long-discontinued balance-sheet tag would feed
    a score the FY{ly} label silently mislabels. (#17)"""
    def _inst_at(names: Sequence[str]) -> Optional[Tuple[int, float]]:
        _, s = _series(us, names, "instant")
        yrs = [y for y in s if y <= ly]
        if not yrs:
            return None
        y = ly if ly in s else max(yrs)
        return y, s[y][0]

    bs_at = {
        "current_assets": _inst_at(_CURRENT_ASSETS),
        "current_liabilities": _inst_at(_CURRENT_LIAB),
        "total_assets": _inst_at(_TOTAL_ASSETS),
        "retained_earnings": _inst_at(_RETAINED),
        "total_liabilities": _inst_at(_TOTAL_LIAB),
        "book_equity": _inst_at(_EQUITY),
    }
    bs = {k: (t[1] if t else None) for k, t in bs_at.items()}
    bs_year: Dict[str, Optional[int]] = {k: (t[0] if t else None) for k, t in bs_at.items()}
    # Many filers report no standalone us-gaap:Liabilities (only the
    # Liabilities+Equity total) — derive total liabilities from assets less book
    # equity so the Altman score still computes (e.g. Carnival, cruise lines). Its
    # freshness is the older of the two inputs it derives from.
    if bs["total_liabilities"] is None and bs["total_assets"] is not None and bs["book_equity"] is not None:
        bs["total_liabilities"] = bs["total_assets"] - bs["book_equity"]
        ta_y, be_y = bs_year["total_assets"], bs_year["book_equity"]
        bs_year["total_liabilities"] = min(ta_y, be_y) if ta_y is not None and be_y is not None else None
    ebit = opinc[ly][0] if ly in opinc else None  # EBIT = operating income (excl. D&A)
    z = None
    bs_stale = False
    if ebit is not None and all(v is not None for v in bs.values()):
        # Every balance-sheet input must be within a year of the EBITDA period.
        bs_stale = any(y is None or y < ly - 1 for y in bs_year.values())
        if not bs_stale:
            z = altman_z_double_prime(ebit=ebit, **bs)  # type: ignore[arg-type]
            if z is not None:
                nf["distress"] = {"altman_z": z[0], "zone": z[1], "model": "Altman Z''"}
    return z, bs_stale


def _claims(rev: Dict[int, Tuple[float, str]], rev_c: Optional[str], ly: int,
            op_c: Optional[str], eb_accn: str, eb_ly: Optional[float],
            lev: _LevFacts, z: Optional[Tuple[float, str]]) -> List[ClaimSpec]:
    """Source-cited CP-1 claims: reported revenue, plus net leverage and the Altman
    Z'' distress signal when each was derived."""
    def src(concept: Optional[str], year: int, accn: str) -> str:
        return f"SEC EDGAR XBRL · us-gaap:{concept} · FY{year} · accession {accn or 'n/a'}"

    rly = rev[ly] if ly in rev else rev[max(rev)]
    claims: List[ClaimSpec] = [ClaimSpec(
        claim_id="C-EDG-REV",
        claim_text=f"FY{ly} reported revenue was approximately ${_m(rly[0]):,.0f}M (SEC filing, us-gaap:{rev_c}).",
        evidence=[EvidenceSpec("E-EDG-1", "table_value", "Directly Sourced", src(rev_c, ly, rly[1]), "High")],
    )]
    if lev.leverage is not None:
        claims.append(ClaimSpec(
            claim_id="C-EDG-LEV",
            claim_text=(
                f"Reported net leverage is approximately {lev.leverage:g}x at FY{ly} "
                f"(net debt ${_m(lev.net_debt):,.0f}M / reported EBITDA ${_m(eb_ly):,.0f}M). EBITDA is a "
                "GAAP proxy (operating income + D&A + non-cash impairments); covenant-adjusted EBITDA "
                "and add-backs require the credit agreement and are not reflected here."
            ),
            evidence=[EvidenceSpec("E-EDG-2", "calculated_metric", "Calculated", src(op_c, ly, eb_accn), "Medium")],
        ))
    if z is not None:
        claims.append(ClaimSpec(
            claim_id="C-EDG-Z",
            claim_text=(
                f"Altman Z''-Score is {z[0]:g} ({z[1]} zone) — a balance-sheet distress signal "
                "(private-firm variant; below 1.1 distress, above 2.6 safe)."
            ),
            evidence=[EvidenceSpec(
                "E-EDG-3", "calculated_metric", "Calculated",
                f"SEC EDGAR XBRL balance sheet (Assets, current assets/liabilities, retained "
                f"earnings, liabilities, equity) + operating income · FY{ly}", "Medium")],
        ))
    return claims


def _limitation_flags(impair: Dict[int, Tuple[float, str]], imp_c: Optional[str], ly: int,
                      opinc: Dict[int, Tuple[float, str]], interest: Dict[int, Tuple[float, str]],
                      eb_ly: Optional[float], ebitda: Dict[int, float], financials: dict,
                      lev: _LevFacts, bs_stale: bool) -> List[str]:
    """The reported-vs-adjusted caveat plus the not-derived reasons (impairment add-back,
    stale interest / balance-sheet / debt tags, net-cash) that make a reported figure
    something to verify against the filing."""
    limitations = [
        "EBITDA is a reported GAAP proxy (operating income + D&A + non-cash impairments) "
        "from XBRL — not covenant-adjusted EBITDA. Adjusted EBITDA / add-backs require the "
        "credit agreement (CP-1 adjusted layer / CP-4C); reported-vs-adjusted leverage may diverge.",
    ]
    if impair and ly in impair and impair[ly][0] and ly in opinc and opinc[ly][0] < 0:
        limitations.append(
            f"FY{ly} reported EBITDA adds back a ${_m(impair[ly][0]):,.0f}M non-cash impairment "
            f"(us-gaap:{imp_c}) that drove reported operating income negative.")
    if interest and eb_ly and eb_ly > 0 and "interest_coverage_ltm" not in financials and not lev.int_fresh:
        limitations.append(
            "Interest coverage not derived: the latest interest-expense XBRL tag predates the "
            "EBITDA period (the filer likely switched interest concepts) — verify against the filing.")
    if bs_stale:
        limitations.append(
            f"Altman Z'' not derived: the latest balance-sheet XBRL tags predate the EBITDA "
            f"period (FY{ly}) — a distress score from stale inputs would mislabel the period.")
    if not ebitda:
        limitations.append("No operating-income/D&A XBRL tags found — EBITDA and leverage not derived.")
    elif lev.total_debt and lev.leverage is None and not lev.debt_fresh:
        limitations.append(
            "Net leverage not derived: a long-term-debt, current-debt, or cash XBRL tag predates "
            "the EBITDA period (the filer likely switched concepts) — verify net debt against the "
            "most recent balance sheet.")
    elif lev.total_debt and lev.leverage is None:
        limitations.append(
            "Net leverage not derived: reported net debt <= 0 or EBITDA <= 0 from XBRL tags "
            "(net cash, a loss year, or captive-finance debt not fully captured) — verify total "
            "debt against the filing.")
    return limitations


def build_cp1_payload(entity_name: str, facts: dict, max_years: int = 4) -> Optional[ModulePayload]:
    """Reported-basis CP-1 payload from SEC company facts, or None if the facts
    carry no usable revenue series (the minimum to ground a foundation)."""
    us = (facts.get("facts") or {}).get("us-gaap") or {}

    rev_c, rev = _series(us, _REVENUE, "flow")
    if not rev:
        return None
    op_c, opinc = _series(us, _OP_INCOME, "flow")
    da_c, da = _da_series(us)
    int_c, interest = _series(us, _INTEREST, "flow")
    imp_c, impair = _series(us, _IMPAIRMENT, "flow")
    cfo_c, cfo = _series(us, _CFO, "flow")
    capex_c, capex = _series(us, _CAPEX, "flow")

    years = sorted(rev)[-max_years:]
    ebitda = _ebitda_proxy(years, opinc, da, impair)

    revenue = {f"FY{y}": _m(rev[y][0]) for y in years}
    adj_ebitda = {f"FY{y}": _m(ebitda[y]) for y in sorted(ebitda)}

    ly = max(ebitda) if ebitda else max(years)
    eb_ly = ebitda.get(ly)
    eb_accn = opinc[ly][1] if ly in opinc else ""

    # normalized_financials matches the CP-1 contract the adapter + metric-facts
    # projection consume; adj_ebitda is the reported proxy (see limitation_flags).
    financials: dict = {"revenue": revenue, "adj_ebitda": adj_ebitda}
    # Free cash flow = operating cash flow − capex, per fiscal year (both 10-K FY
    # flows; capex is reported positive). Drives the FCF / cash-conversion snapshot
    # metrics (metrics.py computes conversion = FCF / revenue).
    fcf = {y: cfo[y][0] - capex[y][0] for y in years if y in cfo and y in capex}
    if fcf:
        financials["free_cash_flow"] = {f"FY{y}": _m(fcf[y]) for y in sorted(fcf)}
    lev = _leverage_and_coverage(us, ly, eb_ly, interest, financials)

    nf: dict = {
        "basis": "reported_gaap_xbrl",
        "ebitda_definition": "operating_income_plus_dna_and_impairments",
        "source": "SEC EDGAR company facts (us-gaap)",
        "normalized_financials": financials,
        "xbrl_concepts": {k: v for k, v in {
            "revenue": rev_c, "operating_income": op_c, "d_and_a": da_c,
            "impairment": imp_c, "interest_expense": int_c, "long_term_debt": lev.ltd_c,
            "current_debt": lev.dc_c, "cash": lev.cash_c,
            "operating_cash_flow": cfo_c, "capex": capex_c}.items() if v},
    }

    z, bs_stale = _altman_distress(us, ly, opinc, nf)
    claims = _claims(rev, rev_c, ly, op_c, eb_accn, eb_ly, lev, z)
    limitations = _limitation_flags(
        impair, imp_c, ly, opinc, interest, eb_ly, ebitda, financials, lev, bs_stale)

    return ModulePayload(
        module_id="CP-1",
        module_name="CanonicalDataFoundation",
        owned_object="canonical_financials",
        runtime_output=nf,
        confidence="Medium",  # reported proxy, deterministic but not covenant-adjusted
        limitation_flags=limitations,
        downstream_consumers=["CP-1B", "CP-1C", "CP-2", "CP-3", "CP-4"],
        claims=claims,
    )


def render_facts_text(entity_name: str, payload: ModulePayload) -> str:
    """A compact text block of the extracted XBRL figures to vault as a chunk, so
    CP-1 evidence resolves to a real source and click-to-source has content."""
    fin = payload.runtime_output.get("normalized_financials", {})
    lines = [
        f"SEC EDGAR XBRL extract — {entity_name}",
        "Reported GAAP basis (us-gaap company facts). EBITDA = operating income + D&A (proxy).",
        "Revenue ($M): " + "; ".join(f"{k} {v:,.0f}" for k, v in fin.get("revenue", {}).items()),
    ]
    if fin.get("adj_ebitda"):
        lines.append("Reported EBITDA proxy ($M): "
                     + "; ".join(f"{k} {v:,.0f}" for k, v in fin["adj_ebitda"].items()))
    if "net_leverage_adj_ltm" in fin:
        lines.append(f"Net debt ($M): {fin.get('net_debt_ltm'):,.0f} · "
                     f"reported net leverage: {fin['net_leverage_adj_ltm']:g}x")
    if "interest_coverage_ltm" in fin:
        lines.append(f"Interest coverage: {fin['interest_coverage_ltm']:g}x")
    concepts = payload.runtime_output.get("xbrl_concepts", {})
    if concepts:
        lines.append("XBRL concepts: " + ", ".join(f"{k}=us-gaap:{v}" for k, v in concepts.items()))
    return "\n".join(lines)


# ── Network (reuses edgar.py's throttled, UA-gated _get_json) ─────────────────
_TICKER_CACHE: Dict[str, str] = {}  # ticker(upper) -> 10-digit CIK; filled once per process


def resolve_cik(ticker: str) -> Optional[str]:
    """Map a ticker to its zero-padded CIK via SEC's ticker map (cached). Returns
    None when the ticker isn't a registered filer (e.g. a private issuer)."""
    t = (ticker or "").strip().upper()
    if not t:
        return None
    if not _TICKER_CACHE:
        data = edgar._get_json(_TICKERS_URL)
        for row in (data.values() if isinstance(data, dict) else []):
            sym = str(row.get("ticker", "")).upper()
            cik = row.get("cik_str")
            if sym and cik is not None:
                _TICKER_CACHE[sym] = edgar.normalize_cik(str(cik))
    return _TICKER_CACHE.get(t)


def fetch_cp1(ticker: str, entity_name: str) -> Optional[Cp1Build]:
    """Ground CP-1 in EDGAR for ``ticker`` (synchronous — the runner calls it in a
    thread). Fail-safe: returns None on *any* failure (not a filer, no facts, EDGAR
    off/unreachable, or a parse surprise on real XBRL) so the runner always degrades
    to the LLM/fixture path rather than failing the whole run."""
    try:
        cik = resolve_cik(ticker)
        if not cik:
            return None
        facts = edgar._get_json(_FACTS_URL.format(cik=cik))
        payload = build_cp1_payload(entity_name or str(facts.get("entityName") or ticker), facts)
        if payload is None:
            return None
        return Cp1Build(payload=payload, facts_text=render_facts_text(entity_name or ticker, payload), cik=cik)
    except Exception as e:  # noqa: BLE001 — degrade to fallback on any EDGAR/parse failure
        logger.warning("EDGAR CP-1 unavailable for %s (%s) — falling back", ticker, e)
        return None
