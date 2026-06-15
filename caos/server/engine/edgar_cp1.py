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
_INTEREST = ("InterestExpense", "InterestExpenseDebt", "InterestAndDebtExpense")
_LT_DEBT = ("LongTermDebtNoncurrent", "LongTermDebt")
_DEBT_CURRENT = ("LongTermDebtCurrent", "DebtCurrent")
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


@dataclass
class Cp1Build:
    """A CP-1 grounding from EDGAR: the payload + the source text to vault as a
    chunk (so evidence resolves to a real chunk / click-to-source) + the CIK."""

    payload: ModulePayload
    facts_text: str
    cik: str


# ── Pure XBRL parsing (unit-tested, no network) ──────────────────────────────
def _annual_series(units: Sequence[dict], kind: str, max_years: int = 5) -> Dict[int, Tuple[float, str]]:
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
        if not isinstance(val, (int, float)):
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


def _latest(series: Dict[int, Tuple[float, str]], year: int) -> Optional[Tuple[float, str]]:
    if year in series:
        return series[year]
    earlier = [y for y in series if y <= year]
    return series[max(earlier)] if earlier else None


def _m(v: float) -> float:
    """USD → $M, one decimal (the catalog/UI unit)."""
    return round(v / 1e6, 1)


def build_cp1_payload(entity_name: str, facts: dict, max_years: int = 4) -> Optional[ModulePayload]:
    """Reported-basis CP-1 payload from SEC company facts, or None if the facts
    carry no usable revenue series (the minimum to ground a foundation)."""
    us = (facts.get("facts") or {}).get("us-gaap") or {}

    rev_c, rev = _series(us, _REVENUE, "flow")
    if not rev:
        return None
    op_c, opinc = _series(us, _OP_INCOME, "flow")
    da_c, da = _series(us, _DA, "flow")
    int_c, interest = _series(us, _INTEREST, "flow")
    ltd_c, ltd = _series(us, _LT_DEBT, "instant")
    dc_c, dcur = _series(us, _DEBT_CURRENT, "instant")
    cash_c, cash = _series(us, _CASH, "instant")

    years = sorted(rev)[-max_years:]
    ebitda = {y: opinc[y][0] + da[y][0] for y in years if y in opinc and y in da}

    revenue = {f"FY{y}": _m(rev[y][0]) for y in years}
    adj_ebitda = {f"FY{y}": _m(ebitda[y]) for y in sorted(ebitda)}

    ly = max(ebitda) if ebitda else max(years)
    eb_ly = ebitda.get(ly)
    eb_accn = opinc[ly][1] if ly in opinc else ""
    ltd_ly, dcur_ly, cash_ly = _latest(ltd, ly), _latest(dcur, ly), _latest(cash, ly)
    total_debt = (ltd_ly[0] if ltd_ly else 0.0) + (dcur_ly[0] if dcur_ly else 0.0)
    net_debt = total_debt - (cash_ly[0] if cash_ly else 0.0)
    int_ly = _latest(interest, ly)

    # normalized_financials matches the CP-1 contract the adapter + metric-facts
    # projection consume; adj_ebitda is the reported proxy (see limitation_flags).
    financials: dict = {"revenue": revenue, "adj_ebitda": adj_ebitda}
    leverage = None
    # Only emit leverage when it is meaningful: positive EBITDA and positive net
    # debt. A loss year, a net-cash position, or captive-finance debt not fully
    # captured by these tags (e.g. Ford Credit) would otherwise yield a
    # misleading figure (negative or absurd leverage).
    if eb_ly and eb_ly > 0 and total_debt and net_debt > 0:
        leverage = round(net_debt / eb_ly, 2)  # reported basis
        financials["net_debt_ltm"] = _m(net_debt)
        financials["net_leverage_adj_ltm"] = leverage
    if eb_ly and eb_ly > 0 and int_ly and int_ly[0]:
        financials["interest_coverage_ltm"] = round(eb_ly / int_ly[0], 2)

    nf: dict = {
        "basis": "reported_gaap_xbrl",
        "ebitda_definition": "operating_income_plus_dna",
        "source": "SEC EDGAR company facts (us-gaap)",
        "normalized_financials": financials,
        "xbrl_concepts": {k: v for k, v in {
            "revenue": rev_c, "operating_income": op_c, "d_and_a": da_c,
            "interest_expense": int_c, "long_term_debt": ltd_c,
            "current_debt": dc_c, "cash": cash_c}.items() if v},
    }

    # Altman Z'' distress score (balance-sheet only) when every input is present.
    def _inst_at(names: Sequence[str]) -> Optional[float]:
        _, s = _series(us, names, "instant")
        v = _latest(s, ly)
        return v[0] if v else None

    bs = {
        "current_assets": _inst_at(_CURRENT_ASSETS),
        "current_liabilities": _inst_at(_CURRENT_LIAB),
        "total_assets": _inst_at(_TOTAL_ASSETS),
        "retained_earnings": _inst_at(_RETAINED),
        "total_liabilities": _inst_at(_TOTAL_LIAB),
        "book_equity": _inst_at(_EQUITY),
    }
    # Many filers report no standalone us-gaap:Liabilities (only the
    # Liabilities+Equity total) — derive total liabilities from assets less book
    # equity so the Altman score still computes (e.g. Carnival, cruise lines).
    if bs["total_liabilities"] is None and bs["total_assets"] is not None and bs["book_equity"] is not None:
        bs["total_liabilities"] = bs["total_assets"] - bs["book_equity"]
    ebit = opinc[ly][0] if ly in opinc else None  # EBIT = operating income (excl. D&A)
    z = None
    if ebit is not None and all(v is not None for v in bs.values()):
        z = altman_z_double_prime(ebit=ebit, **bs)  # type: ignore[arg-type]
        if z is not None:
            nf["distress"] = {"altman_z": z[0], "zone": z[1], "model": "Altman Z''"}

    def src(concept: Optional[str], year: int, accn: str) -> str:
        return f"SEC EDGAR XBRL · us-gaap:{concept} · FY{year} · accession {accn or 'n/a'}"

    rly = rev[ly] if ly in rev else rev[max(rev)]
    claims: List[ClaimSpec] = [ClaimSpec(
        claim_id="C-EDG-REV",
        claim_text=f"FY{ly} reported revenue was approximately ${_m(rly[0]):,.0f}M (SEC filing, us-gaap:{rev_c}).",
        evidence=[EvidenceSpec("E-EDG-1", "table_value", "Directly Sourced", src(rev_c, ly, rly[1]), "High")],
    )]
    if leverage is not None:
        claims.append(ClaimSpec(
            claim_id="C-EDG-LEV",
            claim_text=(
                f"Reported net leverage is approximately {leverage:g}x at FY{ly} "
                f"(net debt ${_m(net_debt):,.0f}M / reported EBITDA ${_m(eb_ly):,.0f}M). EBITDA is a "
                "GAAP proxy (operating income + D&A); covenant-adjusted EBITDA and add-backs require "
                "the credit agreement and are not reflected here."
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

    limitations = [
        "EBITDA is a reported GAAP proxy (operating income + D&A) from XBRL — not "
        "covenant-adjusted EBITDA. Adjusted EBITDA / add-backs require the credit "
        "agreement (CP-1 adjusted layer / CP-4C); reported-vs-adjusted leverage may diverge.",
    ]
    if not ebitda:
        limitations.append("No operating-income/D&A XBRL tags found — EBITDA and leverage not derived.")
    elif total_debt and leverage is None:
        limitations.append(
            "Net leverage not derived: reported net debt <= 0 or EBITDA <= 0 from XBRL tags "
            "(net cash, a loss year, or captive-finance debt not fully captured) — verify total "
            "debt against the filing.")

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
    thread). None when it can't (not a filer, no facts, EDGAR off/unreachable) so
    the runner falls back to the LLM/fixture path."""
    try:
        cik = resolve_cik(ticker)
        if not cik:
            return None
        facts = edgar._get_json(_FACTS_URL.format(cik=cik))
    except edgar.EdgarError as e:
        logger.warning("EDGAR CP-1 fetch failed for %s: %s", ticker, e)
        return None
    payload = build_cp1_payload(entity_name or str(facts.get("entityName") or ticker), facts)
    if payload is None:
        return None
    return Cp1Build(payload=payload, facts_text=render_facts_text(entity_name or ticker, payload), cik=cik)
