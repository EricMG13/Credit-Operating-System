"""CP-4 LegalCovenantReview — scan ingested agreement/covenant text for the
aggressive provisions a leveraged-finance analyst flags, and score the package.

Deterministic keyword/regex scan over retrieved document chunks (the same idiom
as [coststructure.py]): each detected provision is evidence-traced to the chunk
it was found in, so CP-5B lineage passes and click-to-source resolves. No LLM.
When no agreement/covenant text is ingested it degrades to Insufficient
Information rather than inventing a register.

CP-4 owns the qualitative *legal* read (``legal_covenant_review``); the
quantitative capacity/headroom math is CP-4C's ``covenant_capacity_calculation``
— distinct owned objects, no one-owner-per-object conflict.
"""

from __future__ import annotations

from typing import List, Tuple

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import scan

_QUERY = "covenant restricted payments incremental indebtedness lien EBITDA definition negative covenant"

# (label, score weight, pattern). Weights sum into a 0-10 aggressiveness score.
# These are the canonical creditor-unfriendly structures in modern LBO docs.
_PROVISIONS: Tuple[Tuple[str, int, str], ...] = (
    ("cov-lite (no maintenance covenant)", 2, r"cov(?:enant)?[-\s]?lite"),
    ("J.Crew trapdoor (unrestricted-sub IP transfer)", 2, r"j\.?\s*crew|trap\s*door|unrestricted subsidiar"),
    ("Chewy / drop-down (non-pro-rata)", 2, r"chewy|pluralsight|drop[-\s]?down"),
    ("uptier / priming capacity", 2, r"uptier|prim(?:e|ing)\b"),
    ("MFN sunset / soft-call carve-out", 1, r"\bmfn\b|most[-\s]favou?red[-\s]nation"),
    ("uncapped EBITDA add-backs", 2, r"uncapped|no cap on .{0,20}add[-\s]?back"),
    ("free-and-clear / day-one incremental capacity", 1,
     r"free[-\s]and[-\s]clear|day[-\s]?one incremental|incremental (?:facilit|equivalent|incurrence|capacity)"),
    ("builder / available-amount RP basket", 1, r"builder basket|available amount"),
)

_MAX_SCORE = 10


def scan_provisions(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Flag each aggressive provision (once) across ``(chunk_id, text)`` pairs."""
    return [{"provision": label, "weight": weight, "chunk_id": cid}
            for (label, weight, _), cid, _ in scan(chunks, _PROVISIONS)]


async def synthesize_legal_review(retrieve) -> ModulePayload:
    """Build the CP-4 payload by scanning retrieved agreement/covenant chunks."""
    hits = await retrieve(_QUERY, 6)
    flagged = scan_provisions([(h.chunk_id, h.text) for h in hits])

    if not flagged:
        return ModulePayload(
            module_id="CP-4", module_name="LegalCovenantReview",
            owned_object="legal_covenant_review",
            runtime_output={"provisions_flagged": [], "aggressiveness_score": None,
                            "note": "No aggressive covenant provisions detected in ingested agreement text."},
            confidence="Insufficient Information",
            limitation_flags=["No covenant/agreement provisions detected in ingested sources."],
            downstream_consumers=["CP-4C", "CP-6A"],
        )

    score = min(_MAX_SCORE, sum(f["weight"] for f in flagged))
    structure = ("cov-lite" if any("cov-lite" in f["provision"] for f in flagged)
                 else "maintenance or undetermined")
    return ModulePayload(
        module_id="CP-4", module_name="LegalCovenantReview",
        owned_object="legal_covenant_review",
        runtime_output={
            "aggressiveness_score": score,
            "covenant_structure": structure,
            "provisions_flagged": [{"provision": f["provision"], "chunk_id": f["chunk_id"]} for f in flagged],
            "register_basis": "keyword scan of ingested agreement/covenant chunks",
        },
        confidence="High", downstream_consumers=["CP-4C", "CP-6A"],
        claims=[ClaimSpec(
            claim_id="C-LEG1",
            claim_text=("Covenant aggressiveness " + f"{score}/{_MAX_SCORE} — flagged: "
                        + ", ".join(f["provision"] for f in flagged) + "."),
            # Directly Sourced + a resolved chunk → CP-5B raises no finding.
            evidence=[EvidenceSpec(
                f"E-LEG-{i}", "quoted_text", "Directly Sourced",
                "Agreement/covenant disclosure (ingested chunk)", "High",
                resolved_chunk_id=f["chunk_id"]) for i, f in enumerate(flagged)],
        )],
    )
