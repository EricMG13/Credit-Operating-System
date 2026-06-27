"""CP-1B EarningsDelta — period-over-period performance and monitoring signals.

The "what changed" module: it reads CP-1's multi-period canonical financials and
computes the year-over-year deltas (revenue, adjusted EBITDA, margin) plus the
early-warning signals an analyst watches for — declining revenue/EBITDA, margin
compression. Purely computational from CP-1 (no documents, no LLM), so it is
deterministic and runs for any issuer with at least two periods.

Deterioration is surfaced as an informational CP-5 finding (MINOR): a signal to
watch, not a defect that should block committee export.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from engine.gate import Finding
from engine.periods import sort_key
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# Margin compression of at least this many points YoY is a monitoring signal.
_MARGIN_COMPRESSION_PP = 1.0


def _yoy(rows: List[dict], key: str) -> Optional[Tuple[float, str, str]]:
    """(YoY % change, prior period, latest period) for ``key`` across the ordered
    rows, or None when fewer than two periods carry the value."""
    vals = [(r["period"], r[key]) for r in rows if isinstance(r.get(key), (int, float))]
    if len(vals) < 2:
        return None
    (pp, prev), (lp, last) = vals[-2], vals[-1]
    if not prev:
        return None
    return round(100 * (last - prev) / prev, 1), pp, lp


def compute_deltas(normalized_financials: dict) -> dict:
    """Period rows + the YoY delta summary + monitoring signals (pure)."""
    rev = normalized_financials.get("revenue") or {}
    eb = normalized_financials.get("adj_ebitda") or {}
    periods = sorted(set(rev) | set(eb), key=sort_key)

    rows: List[dict] = []
    for p in periods:
        r, e = rev.get(p), eb.get(p)
        margin = (round(100 * e / r, 1)
                  if isinstance(r, (int, float)) and r and isinstance(e, (int, float)) else None)
        rows.append({"period": p, "revenue": r, "adj_ebitda": e, "ebitda_margin": margin})

    rev_yoy = _yoy(rows, "revenue")
    eb_yoy = _yoy(rows, "adj_ebitda")
    margins = [r["ebitda_margin"] for r in rows if isinstance(r.get("ebitda_margin"), (int, float))]
    margin_change = round(margins[-1] - margins[-2], 1) if len(margins) >= 2 else None

    summary = {
        "revenue_growth_pct": rev_yoy[0] if rev_yoy else None,
        "ebitda_growth_pct": eb_yoy[0] if eb_yoy else None,
        "margin_change_pp": margin_change,
        "latest_period": rows[-1]["period"] if rows else None,
        "prior_period": rows[-2]["period"] if len(rows) >= 2 else None,
    }

    signals: List[str] = []
    if rev_yoy and rev_yoy[0] < 0:
        signals.append(f"Revenue declined {abs(rev_yoy[0]):g}% YoY ({rev_yoy[1]}→{rev_yoy[2]}).")
    if eb_yoy and eb_yoy[0] < 0:
        signals.append(f"Adjusted EBITDA declined {abs(eb_yoy[0]):g}% YoY ({eb_yoy[1]}→{eb_yoy[2]}).")
    if margin_change is not None and margin_change <= -_MARGIN_COMPRESSION_PP:
        signals.append(f"EBITDA margin compressed {abs(margin_change):g}pp YoY.")

    return {"periods": rows, "summary": summary, "monitoring_signals": signals}


def synthesize_earnings_delta(cp1: ModulePayload) -> ModulePayload:
    """Build the CP-1B payload from CP-1's multi-period financials."""
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    deltas = compute_deltas(nf)
    summary = deltas["summary"]

    if summary["revenue_growth_pct"] is None and summary["ebitda_growth_pct"] is None:
        return ModulePayload(
            module_id="CP-1B", module_name="EarningsDelta", owned_object="earnings_delta",
            runtime_output={**deltas, "note": "Fewer than two comparable periods — no delta computed."},
            confidence="Insufficient Information",
            limitation_flags=["CP-1 provided fewer than two comparable periods."],
            downstream_consumers=["CP-2", "CP-2B"],
        )

    rg, eg = summary["revenue_growth_pct"], summary["ebitda_growth_pct"]
    parts = []
    if rg is not None:
        parts.append(f"revenue {'grew' if rg >= 0 else 'declined'} {abs(rg):g}%")
    if eg is not None:
        parts.append(f"adjusted EBITDA {'grew' if eg >= 0 else 'declined'} {abs(eg):g}%")
    claim_text = (
        f"Between {summary['prior_period']} and {summary['latest_period']}, "
        + " and ".join(parts) + " YoY."
    )

    return ModulePayload(
        module_id="CP-1B", module_name="EarningsDelta", owned_object="earnings_delta",
        runtime_output=deltas, confidence="High",
        downstream_consumers=["CP-2", "CP-2B"],
        claims=[ClaimSpec(
            claim_id="C-DELTA1", claim_text=claim_text,
            evidence=[EvidenceSpec(
                "E-DELTA1", "upstream_artifact", "Calculated",
                "Derived from CP-1 canonical financials (multi-period series)", "High")],
        )],
    )


def monitoring_finding(cp1b: Optional[ModulePayload]) -> Optional[Finding]:
    """A MINOR (informational) finding when CP-1B raised deterioration signals."""
    if cp1b is None:
        return None
    signals = (cp1b.runtime_output or {}).get("monitoring_signals") or []
    if isinstance(signals, str):  # a bare string would join char-by-char ("d e c…")
        signals = [signals]
    if not signals:
        return None
    return Finding(
        finding_id="CP-1B-MONITOR", severity="MINOR", lane=2, module_id="CP-1B",
        affected_claim_id="C-DELTA1",
        # str() each item: runtime_output is an unvalidated free-form dict, so a
        # non-str signal must not crash the join and abort the whole CP-5 run.
        description="Monitoring signals: " + " ".join(str(s) for s in signals),
        required_remediation="Assess whether the deterioration is structural; refresh the thesis.",
    )
