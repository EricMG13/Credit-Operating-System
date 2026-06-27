"""The metric dictionary (the queryable catalog) and run-output extraction.

``METRIC_CATALOG`` is the closed vocabulary the NL→query translator and the UI
both draw from — defining it *is* the "dictionary" cross-issuer query ranges
over. ``extract_facts`` projects a completed run's CP-1 normalized_financials
into structured, cited metric facts (the run-derived half of ``metric_facts``).
Qualitative / not-yet-modeled metrics (gross_margin, fcf_conversion,
energy_cost_pct) are seed-only illustrative values populated by seed_metrics —
they are deliberately not faked from a run.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from engine.gate import Finding
from engine.periods import is_finite_number, latest, sort_key
from engine.schemas import ModulePayload


@dataclass(frozen=True)
class MetricDef:
    key: str
    label: str
    unit: str            # "x" | "%" | "$M"
    category: str        # profitability | leverage | scale | cash | cost exposure
    higher_is_better: bool
    description: str


METRIC_CATALOG: List[MetricDef] = [
    MetricDef("revenue", "Revenue", "$M", "scale", True,
              "LTM total revenue."),
    MetricDef("adj_ebitda", "Adj. EBITDA", "$M", "scale", True,
              "LTM adjusted EBITDA."),
    MetricDef("ebitda_margin", "EBITDA margin", "%", "profitability", True,
              "Adjusted EBITDA as a percent of revenue."),
    MetricDef("gross_margin", "Gross margin", "%", "profitability", True,
              "Gross profit as a percent of revenue."),
    MetricDef("net_leverage", "Net leverage", "x", "leverage", False,
              "Net debt / adjusted EBITDA (lower is stronger credit)."),
    MetricDef("interest_coverage", "Interest coverage", "x", "leverage", True,
              "Adjusted EBITDA / interest."),
    MetricDef("fcf_conversion", "FCF conversion", "%", "cash", True,
              "Free cash flow as a percent of adjusted EBITDA."),
    MetricDef("energy_cost_pct", "Energy cost exposure", "%", "cost exposure", False,
              "Energy as a percent of the cost base — a proxy for how exposed "
              "margins are to energy-price inflation (higher = more exposed)."),
    MetricDef("altman_z", "Altman Z''", "", "distress", True,
              "Altman Z''-Score from the XBRL balance sheet (private-firm variant): "
              "below 1.1 distress, 1.1-2.6 grey, above 2.6 safe (higher is safer)."),
]

CATALOG_BY_KEY: Dict[str, MetricDef] = {m.key: m for m in METRIC_CATALOG}


def catalog_dicts() -> List[dict]:
    """The catalog as plain dicts (for the API and the LLM system prompt)."""
    return [asdict(m) for m in METRIC_CATALOG]


# metric_key -> keywords used to find the CP-1 claim that supports it, so each
# run-derived fact can cite the claim/evidence/chunk behind it.
_CITE_KEYWORDS: Dict[str, List[str]] = {
    "net_leverage": ["leverage"],
    "interest_coverage": ["coverage", "interest"],
    "adj_ebitda": ["ebitda", "add-back"],
    "revenue": ["revenue"],
    "altman_z": ["altman"],
}


def _citation(payload: ModulePayload, metric_key: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """(claim_id, evidence_id, chunk_id) for the metric, or (None, None, None)."""
    for c in payload.claims:
        text = c.claim_text.lower()
        if any(k in text for k in _CITE_KEYWORDS.get(metric_key, [])):
            ev = c.evidence[0] if c.evidence else None
            return c.claim_id, (ev.evidence_id if ev else None), (ev.resolved_chunk_id if ev else None)
    return None, None, None


def _is_ltm(period: str) -> bool:
    return period.upper().startswith("LTM")


def _headline_period(periods: Sequence[str]) -> Optional[str]:
    """The period whose value is the cross-issuer headline: an explicit LTM /
    trailing period if one exists (the fixture/LLM case), else the most recent
    fiscal year (the EDGAR annual-filer case, where the latest 10-K *is* the
    headline). Keeps headline selection correct for both provenances."""
    periods = list(periods)
    if not periods:
        return None
    # Prefer an explicit LTM/trailing period as the headline; among ties pick the
    # MOST RECENT (total order), not whichever happened to come first.
    ltm = [p for p in periods if _is_ltm(p)]
    return max(ltm or periods, key=sort_key)


def extract_facts(
    run_id: str, payload: ModulePayload, qa_status: str, *, is_reference_issuer: bool = True
) -> List[dict]:
    """Project CP-1 normalized_financials into MetricFact kwarg dicts (run-derived).

    Emits revenue / adj_ebitda per period, a computed ebitda_margin, and the LTM
    net_leverage / interest_coverage. Each metric is cited back to the CP-1 claim
    that asserts it where one matches. LTM periods are the headline values used
    for cross-issuer ranking.

    ``is_reference_issuer`` distinguishes the genuine Atlas Forge demo issuer (for
    which the fixture *is* the intended demo content) from any other issuer the
    keyless fixture path served the same demo numbers to. A fixture payload for a
    NON-reference issuer is tagged ``demo_fixture`` provenance — clearly non-
    authoritative — rather than the plain ``fixture`` provenance the genuine demo
    keeps, so a UI/peer read never mistakes fabricated demo figures for a real run.
    """
    ro = payload.runtime_output or {}
    fin = ro.get("normalized_financials") or {}
    rev = fin.get("revenue") or {}
    eb = fin.get("adj_ebitda") or {}
    # EDGAR = reported GAAP; issuer-disclosed = reported_disclosure (distinct from
    # fully-modeled/fixture); fixture/LLM carry covenant-adjusted figures. (#27)
    raw_basis = ro.get("basis")
    basis = {"reported_gaap_xbrl": "reported", "reported_disclosure": "reported_disclosure"}.get(
        raw_basis if isinstance(raw_basis, str) else "", "adjusted")
    # A fixture-sourced CP-1 (ATLF demo numbers) must not enter the cross-issuer store
    # as a real run (#04). The genuine demo issuer keeps "fixture"; the same fixture
    # served for ANOTHER issuer is "demo_fixture" — fabricated, flagged as such. (#10)
    if getattr(payload, "is_fixture", False):
        provenance = "fixture" if is_reference_issuer else "demo_fixture"
    else:
        provenance = "run"
    facts: List[dict] = []

    def add(metric_key: str, period: str, value, unit: str, headline: bool) -> None:
        # is_finite_number (not just `value is None`): a live LLM CP-1 can emit a NaN/
        # ±inf figure, which would otherwise land as a NaN MetricFact in the SHARED
        # cross-issuer store and contaminate peer medians for *other* issuers. Drop
        # any non-finite value at the projection boundary. (bool is accepted as int.)
        if not is_finite_number(value):
            return
        cid, eid, chunk = _citation(payload, metric_key)
        facts.append(dict(
            run_id=run_id, module_id=payload.module_id, metric_key=metric_key,
            period=period, value=float(value), unit=unit, headline=headline,
            qa_status=qa_status, source_claim_id=cid, source_evidence_id=eid,
            document_chunk_id=chunk, provenance=provenance, basis=basis,
        ))

    rev_headline = _headline_period(list(rev.keys()))
    eb_headline = _headline_period(list(eb.keys()))
    for period, v in rev.items():
        add("revenue", period, v, "$M", period == rev_headline)
    for period, v in eb.items():
        add("adj_ebitda", period, v, "$M", period == eb_headline)
        rv = rev.get(period)
        # Both operands must be finite before the divide: a NaN rv is truthy, so a
        # bare `isinstance(rv,..) and rv` would let NaN through and poison the margin
        # (add() would then drop it, but compute it cleanly here regardless).
        if is_finite_number(rv) and rv and is_finite_number(v):
            add("ebitda_margin", period, round(100 * v / rv, 1), "%", period == eb_headline)

    # Free cash flow + cash conversion (FCF / revenue), per period. Conversion is
    # derived here from the FCF and revenue series, not trusted as an input.
    fcf = fin.get("free_cash_flow") or {}
    fcf_headline = _headline_period(list(fcf.keys()))
    for period, v in fcf.items():
        add("fcf", period, v, "$M", period == fcf_headline)
        rv = rev.get(period)
        if is_finite_number(rv) and rv and is_finite_number(v):
            add("fcf_conversion", period, round(100 * v / rv, 1), "%", period == fcf_headline)

    # Net leverage: a per-period series (drives the leverage trend) when CP-1
    # provides one; else the single LTM scalar. Interest coverage stays LTM.
    lev = fin.get("net_leverage") or {}
    if lev:
        lev_headline = _headline_period(list(lev.keys()))
        for period, v in lev.items():
            add("net_leverage", period, v, "x", period == lev_headline)
    else:
        add("net_leverage", "LTM", fin.get("net_leverage_adj_ltm"), "x", True)
    add("interest_coverage", "LTM", fin.get("interest_coverage_ltm"), "x", True)
    # Altman Z'' distress score (EDGAR-derived; lives outside normalized_financials).
    dz = (payload.runtime_output or {}).get("distress") or {}
    add("altman_z", "LTM", dz.get("altman_z"), "", True)
    return facts


def extract_cost_facts(run_id: str, payload: ModulePayload, qa_status: str) -> List[dict]:
    """Project CP-2 CostStructure into a MetricFact kwarg dict (run-derived).

    Lands energy_cost_pct as a run-provenance, headline fact cited to the CP-2
    claim/evidence/chunk that asserts it. Empty if the module derived no value.
    """
    val = (payload.runtime_output or {}).get("energy_cost_pct")
    if val is None:
        return []
    claim_id = evidence_id = chunk = None
    for c in payload.claims:
        if c.evidence:
            claim_id, ev = c.claim_id, c.evidence[0]
            evidence_id, chunk = ev.evidence_id, ev.resolved_chunk_id
            break
    return [dict(
        run_id=run_id, module_id=payload.module_id, metric_key="energy_cost_pct",
        period="LTM", value=float(val), unit="%", headline=True, qa_status=qa_status,
        source_claim_id=claim_id, source_evidence_id=evidence_id,
        document_chunk_id=chunk, provenance="run", basis=None,  # energy is basis-agnostic
    )]


def leverage_plausibility_finding(cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """MATERIAL CP-5B finding when CP-1's asserted net leverage disagrees with
    net_debt / latest adj-EBITDA beyond a rounding band — a deterministic
    cross-check that catches a live LLM emitting an internally-inconsistent
    leverage (the open runtime_output schema, #21). Skipped when any input is
    absent (e.g. a reported-disclosure CP-1 that carries leverage but no net debt);
    the deterministic EDGAR/fixture paths compute leverage consistently, so they
    never trip it."""
    if cp1 is None:
        return None
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    lev, nd = nf.get("net_leverage_adj_ltm"), nf.get("net_debt_ltm")
    eb = latest(nf.get("adj_ebitda") or {})
    if not (is_finite_number(lev) and lev and is_finite_number(nd) and nd
            and is_finite_number(eb) and eb):
        return None
    recomputed = nd / eb
    # Relative deviation against abs(lev): a net-cash issuer has NEGATIVE net
    # leverage, and dividing by the signed lev would make the ratio negative —
    # always <= 0.05 — so EVERY negative asserted leverage (and any sign-flip
    # vs the recomputed value) would silently escape this MATERIAL cross-check.
    if abs(recomputed - lev) / abs(lev) <= 0.05:
        return None
    return Finding(
        finding_id="CP-1-LEV-PLAUS", severity="MATERIAL", lane=6, module_id="CP-1",
        description=(
            f"Asserted net leverage {lev:g}x disagrees with net debt / LTM adjusted EBITDA "
            f"({nd:g} / {eb:g} = {recomputed:.2f}x) — the CP-1 figures are internally inconsistent."
        ),
        required_remediation="Reconcile the asserted leverage against net debt and adjusted EBITDA.",
    )


# Energy cost exposure stated as a percent of the cost base, alongside an
# energy keyword — the specific "N percent of cost of goods sold" pattern avoids
# grabbing unrelated percentages (e.g. a gross-margin figure in the same chunk).
_ENERGY_KW = ("energy", "power", "natural gas", "electricity", "fuel")
_COST_PCT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+(?:the\s+)?(?:cost of goods sold|cogs|cost base)",
    re.IGNORECASE,
)


def derive_energy_cost_pct(
    chunks: Sequence[Tuple[str, str, str]]
) -> Optional[Tuple[float, str, str]]:
    """Extract energy-as-%-of-cost-base from an issuer's document chunks.

    ``chunks`` is ``(chunk_id, doc, text)``. Returns ``(value, chunk_id, doc)`` for
    the first chunk that both mentions energy and states a cost-base percentage,
    else None. Deterministic and offline — the evidence-grounded counterpart to a
    hardcoded seed value for energy_cost_pct.
    """
    for chunk_id, doc, text in chunks:
        low = text.lower()
        if not any(kw in low for kw in _ENERGY_KW):
            continue
        m = _COST_PCT_RE.search(text)
        if m:
            return float(m.group(1)), chunk_id, doc
    return None
