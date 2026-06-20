"""CP-2F MacroFXHedgingSensitivity — base-rate + FX/hedging sensitivity.

Two parts, both deterministic:
  1. Off CP-1: shock the base rate +100/+200bps against net debt; compute the
     incremental annual interest and the stressed interest coverage.
  2. Scan retrieved chunks for an interest-rate hedge register (swap/cap/collar)
     and FX exposure (foreign-currency revenue/debt mismatch). When hedges are
     disclosed the unhedged read is annotated; when none are found it stays the
     conservative 100%-floating-unhedged assumption (flagged). No LLM.

ponytail: hedge/FX detection is keyword-level (flag, not notional-netted) — the
rate shock still runs on gross net debt. Net the disclosed hedge notional out of
the floating base if you ingest a structured hedge schedule.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from engine.periods import latest
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import scan

_SHOCKS_BPS = (100, 200)

# (label, kind, pattern) for the hedge / FX register scan.
_HEDGES: Tuple[Tuple[str, str, str], ...] = (
    ("Interest-rate swap", "rate_hedge", r"interest[-\s]rate swap|\bpay[-\s]fixed\b|rate swap"),
    ("Interest-rate cap", "rate_hedge", r"interest[-\s]rate cap\b|rate cap\b"),
    ("Interest-rate collar", "rate_hedge", r"\bcollar\b"),
    ("Cross-currency swap", "fx_hedge", r"cross[-\s]currency swap|currency swap"),
    ("FX forward / hedge", "fx_hedge", r"fx forward|foreign[-\s]exchange (?:forward|hedge|contract)"),
    ("FX exposure", "fx_exposure", r"foreign[-\s]currency (?:revenue|denominat|debt)|currency mismatch|fx exposure"),
)


def compute_rate_sensitivity(nf: dict) -> Optional[dict]:
    """Interest / coverage under base-rate shocks, or None if CP-1 lacks net debt."""
    net_debt = nf.get("net_debt_ltm")
    eb = latest(nf.get("adj_ebitda") or {})
    if not isinstance(net_debt, (int, float)) or not isinstance(eb, (int, float)) or not eb:
        return None
    cov = nf.get("interest_coverage_ltm")
    base_interest = round(eb / cov, 1) if isinstance(cov, (int, float)) and cov else None

    scenarios = []
    for bps in _SHOCKS_BPS:
        add = round(net_debt * bps / 10000, 1)  # $M incremental annual interest
        new_interest = round(base_interest + add, 1) if base_interest else None
        new_cov = round(eb / new_interest, 2) if new_interest else None
        scenarios.append({"rate_shock_bps": bps, "incremental_interest_musd": add,
                          "stressed_interest_coverage": new_cov})

    return {
        "net_debt_musd": round(float(net_debt), 1),
        "base_interest_musd": base_interest,
        "base_interest_coverage": cov if isinstance(cov, (int, float)) else None,
        "scenarios": scenarios,
        "assumption": "Assumes 100% floating-rate and unhedged (no hedge register ingested).",
    }


def scan_hedges(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Detect each disclosed hedge / FX-exposure item (once) with its source chunk."""
    return [{"item": label, "kind": kind, "chunk_id": cid}
            for (label, kind, _pat), cid, _text in scan(chunks, _HEDGES, key=1)]


async def synthesize_macro(cp1: ModulePayload, retrieve=None) -> ModulePayload:
    """Build the CP-2F payload from CP-1's net debt / coverage + a hedge/FX scan."""
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    s = compute_rate_sensitivity(nf)

    register = scan_hedges([(h.chunk_id, h.text) for h in await retrieve(
        "interest rate swap cap hedge foreign currency exposure", 6)]) if retrieve else []
    rate_hedged = any(r["kind"] == "rate_hedge" for r in register)
    fx_flagged = any(r["kind"] in ("fx_hedge", "fx_exposure") for r in register)

    if s is None:
        return ModulePayload(
            module_id="CP-2F", module_name="MacroFXHedgingSensitivity",
            owned_object="macro_sector_overlay",
            runtime_output={"scenarios": [], "hedge_register": register,
                            "note": "CP-1 provided no net debt to stress for rate sensitivity."},
            confidence="Insufficient Information",
            limitation_flags=["CP-1 provided no net debt; no rate sensitivity computed."],
            downstream_consumers=["CP-6A"],
        )

    # Refine the unhedged assumption when a hedge register is actually disclosed.
    if rate_hedged:
        s["assumption"] = ("Rate hedge(s) disclosed (see hedge_register); rate shock shown on "
                           "gross net debt — not netted of hedge notional (not ingested).")
    s["hedge_register"] = register
    s["rate_hedge_disclosed"] = rate_hedged
    s["fx_exposure_flagged"] = fx_flagged

    sc100 = s["scenarios"][0]
    cov_txt = (f"interest coverage {s['base_interest_coverage']:g}x → {sc100['stressed_interest_coverage']:g}x"
               if sc100["stressed_interest_coverage"] is not None
               else "coverage not computable (no base interest)")
    hedge_txt = (" Rate hedge(s) disclosed; FX exposure flagged." if rate_hedged and fx_flagged
                 else " Rate hedge(s) disclosed." if rate_hedged
                 else " FX exposure flagged." if fx_flagged
                 else " No hedges disclosed (assumed unhedged).")
    limitations = [s["assumption"]]
    if fx_flagged:
        limitations.append("FX exposure flagged in disclosure; mismatch not quantified (no FX schedule ingested).")

    return ModulePayload(
        module_id="CP-2F", module_name="MacroFXHedgingSensitivity",
        owned_object="macro_sector_overlay", runtime_output=s, confidence="High",
        downstream_consumers=["CP-6A"],
        limitation_flags=limitations,
        claims=[ClaimSpec(
            claim_id="C-MAC1",
            claim_text=(f"A +100bps base-rate move adds ~${sc100['incremental_interest_musd']:g}M "
                        f"annual interest ({cov_txt})." + hedge_txt),
            evidence=[EvidenceSpec("E-MAC1", "upstream_artifact", "Calculated",
                                   "Derived from CP-1 net debt / interest coverage under rate stress", "Medium")]
            + [EvidenceSpec(f"E-MAC-H{i}", "quoted_text", "Directly Sourced",
                            f"{r['item']} (ingested chunk)", "High", resolved_chunk_id=r["chunk_id"])
               for i, r in enumerate(register)],
        )],
    )
