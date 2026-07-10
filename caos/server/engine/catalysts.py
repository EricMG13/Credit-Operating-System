"""CP-2C EventCatalystRegister — a forward catalyst / watchlist register.

Deterministic: turns the monitoring signals upstream modules already surfaced
(CP-1B earnings deltas, CP-1C peer gaps, CP-1 leverage) into a register of
forward events to watch, each tagged with a horizon and an impact. No documents,
no LLM — the same idiom as [earnings.py].
"""

from __future__ import annotations

from typing import Dict, List

from engine.periods import is_finite_number
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload


def build_register(up: Dict[str, ModulePayload]) -> List[dict]:
    """Forward catalysts derived from the produced upstream payloads."""
    catalysts: List[dict] = []

    if cp1b := up.get("CP-1B"):
        rt = cp1b.runtime_output or {}
        catalysts.extend({"event": f"Confirm/refute: {sig}", "type": "earnings",
                          "horizon": "next reporting period", "impact": "HIGH", "source": "CP-1B"}
                         for sig in rt.get("monitoring_signals") or [])
        if latest := (rt.get("summary") or {}).get("latest_period"):
            catalysts.append({"event": f"Next print after {latest}", "type": "earnings",
                              "horizon": "next quarter", "impact": "MEDIUM", "source": "CP-1B"})

    if cp1c := up.get("CP-1C"):
        catalysts.extend({"event": f"Close/widen the peer gap on {label}", "type": "relative_value",
                          "horizon": "ongoing", "impact": "MEDIUM", "source": "CP-1C"}
                         for label in (cp1c.runtime_output or {}).get("outlier_metrics") or [])

    if cp1 := up.get("CP-1"):
        lev = (cp1.runtime_output or {}).get("normalized_financials", {}).get("net_leverage_adj_ltm")
        # CP-1 net leverage check per engine CP-1 convention
        if is_finite_number(lev) and lev >= 5.0:
            catalysts.append({"event": f"Deleveraging progress from {lev:g}x net", "type": "credit",
                              "horizon": "current FY", "impact": "MEDIUM", "source": "CP-1"})

    return catalysts


async def synthesize_catalysts(upstream: Dict[str, ModulePayload]) -> ModulePayload:
    """Build the CP-2C payload from the upstream monitoring signals."""
    register = build_register(upstream)
    high = sum(1 for c in register if c["impact"] == "HIGH")

    if not register:
        return ModulePayload(
            module_id="CP-2C", module_name="EventCatalystRegister",
            owned_object="event_catalyst_register",
            runtime_output={"catalysts": [], "note": "No forward catalysts flagged from upstream signals."},
            confidence="Medium", downstream_consumers=["CP-6A"],
        )
    return ModulePayload(
        module_id="CP-2C", module_name="EventCatalystRegister",
        owned_object="event_catalyst_register",
        runtime_output={"catalysts": register, "catalyst_count": len(register), "high_impact": high},
        confidence="High", downstream_consumers=["CP-6A"],
        claims=[ClaimSpec(
            claim_id="C-CAT1",
            claim_text=(f"Catalyst register: {len(register)} forward events to watch "
                        f"({high} high-impact)."),
            evidence=[EvidenceSpec("E-CAT1", "upstream_artifact", "Calculated",
                                   "Derived from upstream monitoring signals (CP-1/1B/1C)", "Medium")],
        )],
    )
