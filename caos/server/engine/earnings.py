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

import math
from typing import List, Optional, Tuple

from engine.gate import Finding
from engine.periods import is_finite_number, sort_key
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
    # Guard 0 AND a negative base: negative EBITDA is realistic here (the EDGAR proxy
    # is operating income + D&A, negative in loss years; distressed HY is in scope).
    # A negative prior base sign-flips the ratio — prev=-50, last=100 gives
    # (150)/(-50) = -300%, so a genuine EBITDA *recovery* would read as "declined
    # 300% YoY" in the committee claim, the CP-1B-MONITOR signal, catalysts, and the
    # debate points. Degrade to None (no YoY) rather than emit a sign-flipped figure.
    if not prev or prev < 0:
        return None
    return round(100 * (last - prev) / prev, 1), pp, lp


def compute_deltas(normalized_financials: dict) -> dict:
    """Period rows + the YoY delta summary + monitoring signals (pure).

    Reads CP-1's multi-period revenue and adjusted-EBITDA series and reports the
    "what changed" view a credit analyst tracks period over period:

      * **EBITDA margin** for each period — adjusted EBITDA as a percent of
        revenue (``100 * adj_ebitda / revenue``), the unit profitability read.
      * **YoY growth** for revenue and adjusted EBITDA — the *percent* change
        between the last two comparable periods (each carrying a numeric value).
      * **Margin change** — the latest margin minus the prior margin, measured in
        percentage *points* (``pp``). This is deliberately distinct from the
        growth figures: a margin moving 25.0% -> 22.2% is a 2.8pp compression, not
        an 11% drop. Points vs. percent must never be conflated on a credit desk.

    Then it raises the three early-warning deterioration signals an analyst
    watches, in the order they read on a tear sheet: declining revenue, declining
    adjusted EBITDA, and margin compression of at least the watch threshold
    (``_MARGIN_COMPRESSION_PP`` = 1.0pp). These feed CP-2/CP-2B and the
    informational CP-1B-MONITOR finding.
    """
    # --- CP-1 inputs: revenue and adjusted-EBITDA series keyed by period -----
    revenue_by_period = normalized_financials.get("revenue") or {}
    adj_ebitda_by_period = normalized_financials.get("adj_ebitda") or {}

    # Every period either series mentions, ordered oldest -> newest by the
    # corpus period ordering (FY23 before FY24, Q1 before Q2, ...).
    periods = sorted(
        set(revenue_by_period) | set(adj_ebitda_by_period), key=sort_key
    )

    # --- Per-period rows, each carrying its EBITDA margin --------------------
    rows: List[dict] = []
    for period in periods:
        revenue = revenue_by_period.get(period)
        adj_ebitda = adj_ebitda_by_period.get(period)

        # Drop a non-finite float/int to None, keeping other types (like "n/a" strings) untouched.
        if isinstance(revenue, (int, float)) and not isinstance(revenue, bool) and not math.isfinite(revenue):
            revenue = None
        if isinstance(adj_ebitda, (int, float)) and not isinstance(adj_ebitda, bool) and not math.isfinite(adj_ebitda):
            adj_ebitda = None

        if (
            is_finite_number(revenue)
            and revenue
            and is_finite_number(adj_ebitda)
        ):
            ebitda_margin = round(100 * adj_ebitda / revenue, 1)
        else:
            ebitda_margin = None

        rows.append(
            {
                "period": period,
                "revenue": revenue,
                "adj_ebitda": adj_ebitda,
                "ebitda_margin": ebitda_margin,
            }
        )

    # --- YoY growth (percent change over the last two comparable periods) ----
    revenue_yoy = _yoy(rows, "revenue")
    ebitda_yoy = _yoy(rows, "adj_ebitda")

    # --- Margin change in percentage POINTS (latest margin - prior margin) ---
    # Difference of two margins, not a percent change — so it is reported in pp.
    comparable_margins = [
        row["ebitda_margin"]
        for row in rows
        if isinstance(row.get("ebitda_margin"), (int, float))
    ]
    if len(comparable_margins) >= 2:
        margin_change_pp = round(comparable_margins[-1] - comparable_margins[-2], 1)
    else:
        margin_change_pp = None

    summary = {
        "revenue_growth_pct": revenue_yoy[0] if revenue_yoy else None,
        "ebitda_growth_pct": ebitda_yoy[0] if ebitda_yoy else None,
        "margin_change_pp": margin_change_pp,
        "latest_period": rows[-1]["period"] if rows else None,
        "prior_period": rows[-2]["period"] if len(rows) >= 2 else None,
    }

    # --- Deterioration signals an analyst watches (order is intentional) -----
    signals: List[str] = []
    # 1. Top line shrinking YoY.
    if revenue_yoy and revenue_yoy[0] < 0:
        signals.append(
            f"Revenue declined {abs(revenue_yoy[0]):g}% YoY "
            f"({revenue_yoy[1]}→{revenue_yoy[2]})."
        )
    # 2. Earnings shrinking YoY.
    if ebitda_yoy and ebitda_yoy[0] < 0:
        signals.append(
            f"Adjusted EBITDA declined {abs(ebitda_yoy[0]):g}% YoY "
            f"({ebitda_yoy[1]}→{ebitda_yoy[2]})."
        )
    # 3. Margin compressing by at least the watch threshold (inclusive at 1.0pp).
    if (
        margin_change_pp is not None
        and margin_change_pp <= -_MARGIN_COMPRESSION_PP
    ):
        signals.append(
            f"EBITDA margin compressed {abs(margin_change_pp):g}pp YoY."
        )

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
    elif not isinstance(signals, (list, tuple)):
        # A truthy scalar (int/dict) would raise on iteration in the QA phase
        # and abort the whole run (BE3-6) — wrap it like the bare-str case.
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
