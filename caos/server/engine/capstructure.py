"""CP-3B CapitalStructureMap — the debt stack, ordered by seniority.

Deterministic scan over retrieved agreement / offering chunks (the idiom of
[legal.py]) for the tranches that make up the capital structure (RCF, 1L, 2L,
secured/unsecured notes, sub), ordered by priority for a recovery read. Each
tranche is evidence-traced to the chunk it was named in. No LLM; degrades to
Insufficient when no agreement text is ingested.
"""

from __future__ import annotations

import re
from typing import List, Tuple

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import amount_musd, scan

_QUERY = "term loan revolving credit facility senior secured notes second lien subordinated capital structure"

# (label, tranche code, seniority rank [lower = more senior], pattern).
_TRANCHES: Tuple[Tuple[str, str, int, str], ...] = (
    ("Revolving credit facility", "RCF", 0, r"revolving credit facilit|\brcf\b|revolver"),
    ("First-lien term loan", "1L", 1, r"first[-\s]lien|term loan b\b|\btlb\b"),
    ("Senior secured notes", "SSN", 2, r"senior secured note"),
    ("Second-lien term loan", "2L", 3, r"second[-\s]lien|\b2l\b"),
    ("Senior unsecured notes", "SUN", 4, r"senior unsecured note|senior note"),
    ("Subordinated notes", "SUB", 5, r"subordinat"),
)


def scan_tranches(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Detect each tranche (once) with its size when stated, most-senior first."""
    found = [{"tranche": label, "code": code, "seniority_rank": rank,
              "amount_musd": amount_musd(text, re.compile(pattern, re.IGNORECASE)), "chunk_id": cid}
             for (label, code, rank, pattern), cid, text in scan(chunks, _TRANCHES, key=1)]
    found.sort(key=lambda t: t["seniority_rank"])
    return found


async def synthesize_capital_structure(retrieve) -> ModulePayload:
    """Build the CP-3B payload by scanning retrieved agreement / offering chunks."""
    hits = await retrieve(_QUERY, 6)
    found = scan_tranches([(h.chunk_id, h.text) for h in hits])

    if not found:
        return ModulePayload(
            module_id="CP-3B", module_name="CapitalStructureMap",
            owned_object="capital_structure_map",
            runtime_output={"tranches": [], "note": "No debt tranches identified in ingested agreement text."},
            confidence="Insufficient Information",
            limitation_flags=["No capital-structure disclosure detected in ingested sources."],
            downstream_consumers=["CP-6A"],
        )

    # Size the stack where amounts were stated; % of structure is recovery-relevant.
    sized = [t for t in found if isinstance(t["amount_musd"], (int, float))]
    total = round(sum(t["amount_musd"] for t in sized), 1) if sized else None
    for t in found:
        t["pct_of_structure"] = (round(100 * t["amount_musd"] / total, 1)
                                 if total and isinstance(t["amount_musd"], (int, float)) else None)

    layers = " → ".join(
        (f"{t['code']} ${t['amount_musd']:g}M" if isinstance(t["amount_musd"], (int, float)) else t["code"])
        for t in found)
    sized_note = f" · ${total:g}M sized across {len(sized)}/{len(found)} tranche(s)" if sized else ""
    return ModulePayload(
        module_id="CP-3B", module_name="CapitalStructureMap",
        owned_object="capital_structure_map",
        runtime_output={
            "tranches": [{"tranche": t["tranche"], "code": t["code"], "seniority_rank": t["seniority_rank"],
                          "amount_musd": t["amount_musd"], "pct_of_structure": t["pct_of_structure"],
                          "chunk_id": t["chunk_id"]} for t in found],
            "seniority_order": [t["code"] for t in found],
            "total_debt_musd": total,
            "register_basis": "keyword scan of ingested agreement / offering chunks",
        },
        confidence="High", downstream_consumers=["CP-6A"],
        claims=[ClaimSpec(
            claim_id="C-CAP1",
            claim_text=f"Capital structure ({len(found)} tranche(s), senior→junior): {layers}{sized_note}.",
            evidence=[EvidenceSpec(
                f"E-CAP-{i}", "quoted_text", "Directly Sourced",
                "Agreement / offering disclosure (ingested chunk)", "High",
                resolved_chunk_id=t["chunk_id"]) for i, t in enumerate(found)],
        )],
    )
