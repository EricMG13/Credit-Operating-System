"""CP-5B EvidenceTraceValidator — validate claim→source lineage.

Walks every claim across the produced module payloads and emits findings for
broken or weak lineage, which the CP-5 gate then turns into a status:

  - a claim with no evidence item        -> CRITICAL (Unsupported Claim, lane 1)
  - Untraced / Weak Lineage / Conflicting -> MATERIAL (Evidence Trace, lane 6)
  - Assumption-Based / Analyst Inference / Insufficient Information -> MINOR
  - a sourced citation that BM25 could not resolve to an ingested chunk -> MINOR

This is the methodology's differentiator made executable: it operates on the
structured evidence the runner persisted, not on free text.
"""

from __future__ import annotations

from typing import List, Optional, Sequence

from engine.gate import SEVERITY_RANK, Finding
from engine.schemas import ModulePayload

LANE_UNSUPPORTED = 1
LANE_EVIDENCE_TRACE = 6

# lineage_class -> finding severity when present (others raise no finding).
_LINEAGE_SEVERITY = {
    "Untraced": "MATERIAL",
    "Weak Lineage": "MATERIAL",
    "Conflicting": "MATERIAL",
    "Assumption-Based": "MINOR",
    "Analyst Inference": "MINOR",
    "Insufficient Information": "MINOR",
    # "Directly Sourced" / "Calculated" -> no finding
}

_SOURCED_TYPES = {"sourced_fact", "quoted_text", "table_value"}


def validate_lineage(payloads: Sequence[ModulePayload]) -> List[Finding]:
    findings: List[Finding] = []
    seq = 0

    def next_id() -> str:
        nonlocal seq
        seq += 1
        return f"QA-{seq:03d}"

    for p in payloads:
        for c in p.claims:
            if not c.evidence:
                findings.append(
                    Finding(
                        finding_id=next_id(),
                        severity="CRITICAL",
                        lane=LANE_UNSUPPORTED,
                        description=f"Orphan claim {c.claim_id} in {p.module_id} has no evidence item.",
                        affected_claim_id=c.claim_id,
                        module_id=p.module_id,
                        required_remediation="Attach a source-traced evidence item or withdraw the claim.",
                    )
                )
                continue

            worst_sev: Optional[str] = None
            worst_reason = ""
            for e in c.evidence:
                sev = _LINEAGE_SEVERITY.get(e.lineage_class)
                reason = f"{e.lineage_class} lineage on {e.evidence_id} ({e.source_locator})"
                if sev is None and e.resolved_chunk_id is None and e.extraction_type in _SOURCED_TYPES:
                    sev, reason = "MINOR", f"{e.evidence_id} could not be resolved to an ingested source chunk"
                if sev and (worst_sev is None or SEVERITY_RANK[sev] > SEVERITY_RANK[worst_sev]):
                    worst_sev, worst_reason = sev, reason

            if worst_sev:
                findings.append(
                    Finding(
                        finding_id=next_id(),
                        severity=worst_sev,
                        lane=LANE_EVIDENCE_TRACE,
                        description=f"{p.module_id} claim {c.claim_id}: {worst_reason}.",
                        affected_claim_id=c.claim_id,
                        module_id=p.module_id,
                        required_remediation="Re-anchor to a grade-A source or re-classify the claim.",
                    )
                )

    return findings
