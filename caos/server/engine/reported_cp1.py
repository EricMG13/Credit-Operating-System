"""Reported-disclosure CP-1 for non-EDGAR issuers.

For issuers with no SEC XBRL — non-US / IFRS filers (e.g. Virgin Media O2, a mixed
bond + senior-secured-term-loan credit) — the deterministic EDGAR lane
(edgar_cp1.py) doesn't apply: the runner would otherwise fall straight to the
LLM/fixture CP-1. But HY leveraged-finance issuers *disclose* their own headline
credit metrics — net leverage (their covenant metric), Adjusted EBITDA, revenue —
in the quarterly investor report / earnings release. This extracts those
issuer-disclosed figures into a reported-basis CP-1, cited to the source chunk, so
the keyless path produces real numbers (not the ATLF fixture) and CP-4C has a
leverage to work against.

These are figures the issuer disclosed *about itself*, taken as reported — not
independently re-derived from the primary statements (flagged in limitations). Net
leverage gates: if no disclosed leverage is found, this returns None and the runner
falls through to the LLM/fixture path.
"""

from __future__ import annotations

import re
from typing import Awaitable, Callable, Dict, List, Optional, Sequence, Tuple

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

RetrieveFn = Callable[[str, int], Awaitable[list]]

_RETRIEVE_QUERY = (
    "net total debt to annualised adjusted EBITDA leverage ratio covenant; "
    "adjusted EBITDA; total revenue"
)

# Issuer-disclosed net leverage, most precise first. Currency-agnostic (a ratio).
_LEVERAGE_PATTERNS = (
    re.compile(r"net\s+(?:total\s+)?debt\s+to\s+(?:annualised\s+|annualized\s+)?(?:adjusted\s+)?"
               r"ebitda\s+(?:ratio\s+)?(?:of\s+|was\s+|:\s*)?(\d+(?:\.\d+)?)\s*x", re.IGNORECASE),
    re.compile(r"(?:consolidated\s+)?(?:net\s+)?leverage\s+(?:ratio\s+)?(?:of\s+|was\s+|:\s*)"
               r"(\d+(?:\.\d+)?)\s*x", re.IGNORECASE),
    re.compile(r"(\d+(?:\.\d+)?)\s*x\s+(?:consolidated\s+)?(?:net\s+)?leverage", re.IGNORECASE),
)
# A disclosed amount: currency + number (+ scale). period token captured if nearby.
_AMOUNT = r"([£$€])\s?([\d,]+(?:\.\d+)?)\s*(billion|million|bn\b|m\b)?"
_EBITDA_AMOUNT = re.compile(r"adjusted\s+ebitda[^.\n]{0,40}?" + _AMOUNT, re.IGNORECASE)
_REVENUE_AMOUNT = re.compile(r"(?:total\s+(?:service\s+)?)?revenue[^.\n]{0,40}?" + _AMOUNT, re.IGNORECASE)
_PERIOD = re.compile(r"\b(Q[1-4]|FY|H[12]|LTM|annualised|annualized)\b", re.IGNORECASE)


def _leverage(text: str) -> Optional[float]:
    for pat in _LEVERAGE_PATTERNS:
        m = pat.search(text)
        if m:
            v = float(m.group(1))
            if 0.5 <= v <= 15.0:  # plausible HY leverage; reject stray multiples
                return v
    return None


def _amount(pat: re.Pattern, text: str) -> Optional[Tuple[float, str, str]]:
    """(value_in_units, currency, period) for the first disclosed amount, or None.
    'billion' is scaled to the same unit as 'million' (×1000)."""
    m = pat.search(text)
    if not m:
        return None
    cur, num, scale = m.group(1), m.group(2).replace(",", ""), (m.group(3) or "").lower()
    try:
        val = float(num)
    except ValueError:
        return None
    if scale.startswith("b"):
        val *= 1000.0  # billion → million
    period_m = _PERIOD.search(text[max(0, m.start() - 40): m.end() + 10])
    period = (period_m.group(1).upper() if period_m else "Reported")
    return round(val, 1), cur, period


# Recency of a chunk — so the *latest* disclosed figure wins when several quarterly
# filings are present. Read ONLY the reporting-period date ("...ended <date>" / "as at
# <date>" / "results to <date>"): financial text is dense with maturity / projection
# years ("Senior Notes due 2033") that a bare-year scan would mistake for the period.
_MONTHS = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
           "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}
_REPORT_DATE = re.compile(
    r"(?:(?:period|months?|quarter|year)\s+ended|ended|as\s+at|as\s+of|results\s+to|period\s+to)"
    r"\s+(?:\d{1,2}\s+)?(" + "|".join(_MONTHS) + r")\s+(20[0-4]\d)",
    re.IGNORECASE,
)


def _recency(text: str) -> float:
    """Reporting-period recency (year + month/12) from period-end cues only, or 0.0."""
    best = 0.0
    for m in _REPORT_DATE.finditer(text):
        best = max(best, int(m.group(2)) + _MONTHS[m.group(1).lower()] / 12)
    return best


def _pick_recent(chunks: Sequence[Tuple[str, str]], extract):
    """(value, chunk_id) for ``extract(text)`` from the most recently dated chunk."""
    best = None  # (recency, value, cid)
    for cid, text in chunks:
        v = extract(text)
        if v is not None:
            r = _recency(text)
            if best is None or r > best[0]:
                best = (r, v, cid)
    return (best[1], best[2]) if best else None


def extract_reported_metrics(
    chunks: Sequence[Tuple[str, str]]
) -> Optional[Dict[str, object]]:
    """Issuer-disclosed {net_leverage:(val,cid), adj_ebitda:(val,cur,period,cid),
    revenue:(...)} — the *most recently dated* chunk's figure for each — or None when
    no leverage is disclosed."""
    leverage = _pick_recent(chunks, _leverage)
    if leverage is None:
        return None
    eb = _pick_recent(chunks, lambda t: _amount(_EBITDA_AMOUNT, t))
    rv = _pick_recent(chunks, lambda t: _amount(_REVENUE_AMOUNT, t))
    return {
        "net_leverage": leverage,
        "adj_ebitda": (*eb[0], eb[1]) if eb else None,
        "revenue": (*rv[0], rv[1]) if rv else None,
    }


async def build_reported_cp1_payload(issuer_name: str, retrieve: RetrieveFn) -> Optional[ModulePayload]:
    """A reported-basis CP-1 from the issuer's own disclosures, or None if no
    disclosed net leverage is found (caller falls through to the LLM/fixture CP-1)."""
    hits = await retrieve(_RETRIEVE_QUERY, 12)
    metrics = extract_reported_metrics([(h.chunk_id, h.text) for h in hits])
    if metrics is None:
        return None

    lev_val, lev_cid = metrics["net_leverage"]  # type: ignore[misc]
    nf: dict = {"net_leverage_adj_ltm": lev_val}
    currency = None
    claims: List[ClaimSpec] = [ClaimSpec(
        claim_id="C-RPT-LEV",
        claim_text=(f"Issuer-disclosed net leverage is {lev_val:g}x (as reported in the issuer's "
                    "quarterly investor report / earnings release; not independently re-derived)."),
        evidence=[EvidenceSpec("E-RPT-LEV", "table_value", "Directly Sourced",
                               "Issuer disclosure (quarterly investor report / earnings release)", "High",
                               resolved_chunk_id=lev_cid)],
    )]

    eb = metrics.get("adj_ebitda")
    if eb:
        val, cur, period, cid = eb  # type: ignore[misc]
        currency = currency or cur
        nf["adj_ebitda"] = {period: val}
        claims.append(ClaimSpec(
            claim_id="C-RPT-EBITDA",
            claim_text=f"Issuer-disclosed Adjusted EBITDA is {cur}{val:,.1f}M ({period}).",
            evidence=[EvidenceSpec("E-RPT-EBITDA", "table_value", "Directly Sourced",
                                   "Issuer disclosure (Adjusted EBITDA)", "High", resolved_chunk_id=cid)],
        ))
    rev = metrics.get("revenue")
    if rev:
        val, cur, period, cid = rev  # type: ignore[misc]
        currency = currency or cur
        nf["revenue"] = {period: val}
        claims.append(ClaimSpec(
            claim_id="C-RPT-REV",
            claim_text=f"Issuer-disclosed revenue is {cur}{val:,.1f}M ({period}).",
            evidence=[EvidenceSpec("E-RPT-REV", "table_value", "Directly Sourced",
                                   "Issuer disclosure (revenue)", "High", resolved_chunk_id=cid)],
        ))

    return ModulePayload(
        module_id="CP-1", module_name="CanonicalDataFoundation",
        owned_object="canonical_financials",
        runtime_output={
            "basis": "reported_disclosure",
            "source": "Issuer disclosure (non-EDGAR: quarterly investor report / earnings)",
            "currency": currency,
            "normalized_financials": nf,
        },
        confidence="Medium",
        limitation_flags=[
            "Figures are issuer-disclosed headline metrics (quarterly investor report / earnings release), "
            "taken as reported — not independently re-derived from the primary financial "
            "statements, and not covenant-adjusted. For non-US/IFRS issuers with no SEC XBRL.",
        ],
        downstream_consumers=["CP-1B", "CP-1C", "CP-2", "CP-4C"],
        claims=claims,
    )
