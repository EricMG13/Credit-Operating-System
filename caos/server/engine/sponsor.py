"""CP-2D SponsorGovernanceReview — sponsor-behaviour / governance red flags.

Deterministic keyword/regex scan over retrieved offering / CIM chunks (the idiom
of [legal.py]): flags the creditor-unfriendly governance features an analyst
watches for, each evidence-traced to the chunk it was found in, and scores
governance risk 0-10. No LLM. Degrades to Insufficient when no offering text is
ingested.
"""

from __future__ import annotations

from typing import List, Tuple

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import scan

_QUERY = "sponsor dividend distribution management fee related party board governance permitted holders"

_FLAGS: Tuple[Tuple[str, int, str], ...] = (
    ("Dividend recap / distributions to the sponsor", 2,
     r"dividend recap|recapitali[sz]ation|distribution[s]? to .{0,30}(sponsor|shareholder|equity)"),
    ("Sponsor management / monitoring fee", 1, r"management fee|monitoring fee|advisory fee"),
    ("Related-party / affiliate transactions", 1, r"related[-\s]part(?:y|ies)|affiliate transaction"),
    ("Concentrated board / sponsor control", 1,
     r"permitted holders|majority of the board|controls? the board|sponsor[- ]control"),
)

_MAX_SCORE = 10


def scan_governance(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Flag each governance red flag (once) across ``(chunk_id, text)`` pairs."""
    return [{"flag": label, "weight": weight, "chunk_id": cid}
            for (label, weight, _), cid, _ in scan(chunks, _FLAGS)]


async def synthesize_sponsor_review(retrieve) -> ModulePayload:
    """Build the CP-2D payload by scanning retrieved offering / governance chunks."""
    hits = await retrieve(_QUERY, 6)
    flagged = scan_governance([(h.chunk_id, h.text) for h in hits])

    if not flagged:
        return ModulePayload(
            module_id="CP-2D", module_name="SponsorGovernanceReview",
            owned_object="sponsor_governance_review",
            runtime_output={"flags": [], "governance_risk_score": None,
                            "note": "No sponsor-governance red flags detected in ingested offering text."},
            confidence="Insufficient Information",
            limitation_flags=["No sponsor/governance disclosure detected in ingested sources."],
            downstream_consumers=["CP-6A"],
        )

    score = min(_MAX_SCORE, sum(f["weight"] for f in flagged))
    return ModulePayload(
        module_id="CP-2D", module_name="SponsorGovernanceReview",
        owned_object="sponsor_governance_review",
        runtime_output={
            "governance_risk_score": score,
            "flags": [{"flag": f["flag"], "chunk_id": f["chunk_id"]} for f in flagged],
            "register_basis": "keyword scan of ingested offering / governance chunks",
        },
        confidence="High", downstream_consumers=["CP-6A"],
        claims=[ClaimSpec(
            claim_id="C-SPON1",
            claim_text=(f"Governance risk {score}/{_MAX_SCORE} — flagged: "
                        + ", ".join(f["flag"] for f in flagged) + "."),
            evidence=[EvidenceSpec(
                f"E-SPON-{i}", "quoted_text", "Directly Sourced",
                "Offering / governance disclosure (ingested chunk)", "High",
                resolved_chunk_id=f["chunk_id"]) for i, f in enumerate(flagged)],
        )],
    )
