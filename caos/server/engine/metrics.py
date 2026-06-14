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
              "Adjusted EBITDA / cash interest."),
    MetricDef("fcf_conversion", "FCF conversion", "%", "cash", True,
              "Free cash flow as a percent of adjusted EBITDA."),
    MetricDef("energy_cost_pct", "Energy cost exposure", "%", "cost exposure", False,
              "Energy as a percent of the cost base — a proxy for how exposed "
              "margins are to energy-price inflation (higher = more exposed)."),
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


def extract_facts(run_id: str, payload: ModulePayload, qa_status: str) -> List[dict]:
    """Project CP-1 normalized_financials into MetricFact kwarg dicts (run-derived).

    Emits revenue / adj_ebitda per period, a computed ebitda_margin, and the LTM
    net_leverage / interest_coverage. Each metric is cited back to the CP-1 claim
    that asserts it where one matches. LTM periods are the headline values used
    for cross-issuer ranking.
    """
    fin = (payload.runtime_output or {}).get("normalized_financials") or {}
    rev = fin.get("revenue") or {}
    eb = fin.get("adj_ebitda") or {}
    facts: List[dict] = []

    def add(metric_key: str, period: str, value, unit: str, headline: bool) -> None:
        if value is None:
            return
        cid, eid, chunk = _citation(payload, metric_key)
        facts.append(dict(
            run_id=run_id, module_id=payload.module_id, metric_key=metric_key,
            period=period, value=float(value), unit=unit, headline=headline,
            qa_status=qa_status, source_claim_id=cid, source_evidence_id=eid,
            document_chunk_id=chunk, provenance="run",
        ))

    for period, v in rev.items():
        add("revenue", period, v, "$M", _is_ltm(period))
    for period, v in eb.items():
        add("adj_ebitda", period, v, "$M", _is_ltm(period))
        rv = rev.get(period)
        if isinstance(rv, (int, float)) and rv and isinstance(v, (int, float)):
            add("ebitda_margin", period, round(100 * v / rv, 1), "%", _is_ltm(period))

    # LTM credit ratios are LTM by definition → headline.
    add("net_leverage", "LTM", fin.get("net_leverage_adj_ltm"), "x", True)
    add("interest_coverage", "LTM", fin.get("interest_coverage_ltm"), "x", True)
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
        document_chunk_id=chunk, provenance="run",
    )]


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
