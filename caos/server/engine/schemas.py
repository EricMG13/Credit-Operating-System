"""Canonical engine vocabularies and the in-memory payload a module produces.

The enums mirror the methodology schemas in
``Modular OS/KNOWLEDGE SOURCES/02_SCHEMA/`` exactly:

  - extraction_type — 13 values (CP_EVIDENCE_TRACE)
  - lineage_class   — 8 values  (CP_EVIDENCE_TRACE, L2)
  - confidence      — 4 values  (CP_MODULE_PAYLOAD_BASE)
  - qa_status       — 4 values  (CP_QA_RESULT)
  - committee_status — 6 values (CP_QA_RESULT)
  - severity        — 3 values  (CP_QA_RESULT.findings.severity)

A ``ModulePayload`` is the runner's normalised view of one module output before
it is persisted; ``validate_payload`` enforces the parts of
CP_MODULE_PAYLOAD_BASE the engine relies on, so a malformed live LLM response is
caught and gated rather than silently stored.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional

# ── Canonical vocabularies (frozensets so membership checks are O(1)) ────────
EXTRACTION_TYPES = frozenset({
    "sourced_fact", "quoted_text", "table_value", "calculated_metric",
    "analyst_inference", "upstream_artifact", "user_instruction",
    "documentary_fact", "definition_conflict", "gap", "source_limitation",
    "insufficient_information", "not_available",
})
LINEAGE_CLASSES = frozenset({
    "Directly Sourced", "Calculated", "Assumption-Based", "Analyst Inference",
    "Weak Lineage", "Untraced", "Conflicting", "Insufficient Information",
})
CONFIDENCE = frozenset({"High", "Medium", "Low", "Insufficient Information"})
QA_STATUS = frozenset({"Not Reviewed", "Passed", "Restricted", "Blocked"})
COMMITTEE_STATUS = frozenset({
    "Committee Ready", "Draft Only", "Requires More Work",
    "Insufficient Information", "Restricted", "Blocked",
})
SEVERITY = frozenset({"CRITICAL", "MATERIAL", "MINOR"})

# module_id pattern from CP_MODULE_PAYLOAD_BASE.schema (F1: L7 + infra included).
MODULE_ID_RE = re.compile(r"^CP-(0|[1-6][A-F]?|X|SR|MON|DB|RENDER|EXTRACT)$")


@dataclass
class EvidenceSpec:
    """One claim→source link (CP_EVIDENCE_TRACE.evidence_items[])."""

    evidence_id: str
    extraction_type: str
    lineage_class: str
    source_locator: str
    confidence: str = "Medium"
    # Set by the runner once BM25 resolves this evidence to an ingested chunk.
    resolved_chunk_id: Optional[str] = None


@dataclass
class ClaimSpec:
    """A narrative claim and its evidence (CP_EVIDENCE_TRACE.claims[])."""

    claim_id: str
    claim_text: str
    evidence: List[EvidenceSpec] = field(default_factory=list)


@dataclass
class ModulePayload:
    """A module's output (CP_MODULE_PAYLOAD_BASE), pre-persistence."""

    module_id: str
    module_name: str
    owned_object: str
    runtime_output: dict
    claims: List[ClaimSpec] = field(default_factory=list)
    schema_family: str = "Nested"
    confidence: str = "Medium"
    limitation_flags: List[str] = field(default_factory=list)
    downstream_consumers: List[str] = field(default_factory=list)


def validate_payload(p: ModulePayload) -> List[str]:
    """Return a list of schema errors (empty == valid).

    Enforces the CP_MODULE_PAYLOAD_BASE constraints the engine depends on so a
    malformed model response is recorded as a validation failure and gated,
    never persisted as if it were sound.
    """
    errors: List[str] = []
    if not MODULE_ID_RE.match(p.module_id):
        errors.append(f"module_id {p.module_id!r} does not match the CP module pattern")
    if p.confidence not in CONFIDENCE:
        errors.append(f"confidence {p.confidence!r} is not a permitted value")
    if p.schema_family not in {"Nested", "Infrastructure"}:
        errors.append(f"schema_family {p.schema_family!r} is invalid")
    if not isinstance(p.runtime_output, dict):
        errors.append("runtime_output must be an object")
    seen_claim_ids: set[str] = set()
    for c in p.claims:
        if c.claim_id in seen_claim_ids:
            errors.append(f"duplicate claim_id {c.claim_id!r}")
        seen_claim_ids.add(c.claim_id)
        for e in c.evidence:
            if e.extraction_type not in EXTRACTION_TYPES:
                errors.append(f"{c.claim_id}: extraction_type {e.extraction_type!r} invalid")
            if e.lineage_class not in LINEAGE_CLASSES:
                errors.append(f"{c.claim_id}: lineage_class {e.lineage_class!r} invalid")
            if e.confidence not in CONFIDENCE:
                errors.append(f"{c.claim_id}: evidence confidence {e.confidence!r} invalid")
    return errors
