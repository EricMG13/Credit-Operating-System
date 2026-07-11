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
from typing import List, Optional, Tuple

from engine.periods import is_finite_number

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
    # True when this payload is the seeded ATLF demo fixture (not a real run/
    # EDGAR/disclosure synthesis). Not persisted; read at fact-projection time so
    # fixture numbers don't masquerade as a real run in the cross-issuer store. (#04)
    is_fixture: bool = False
    # CP-1 only, set by the live synthesizer: headline normalized_financials keys
    # (e.g. "revenue", "adj_ebitda") whose latest-period value does not round-match
    # any retrieved source chunk. Not persisted; read by runner.py's
    # cp1_grounding_finding to raise a CP-5B finding when the model's income
    # statement has no basis in the actual documents — leverage_plausibility_finding
    # only catches an internally INCONSISTENT figure, not a consistently fabricated
    # one, so this is the complementary check. Empty for every deterministic path
    # (EDGAR/reported/fixture never populate it).
    ungrounded_headline_figures: List[str] = field(default_factory=list)


def _claim_errors(claims: List[ClaimSpec]) -> List[str]:
    """Errors for the claims/evidence block of CP_MODULE_PAYLOAD_BASE.

    Error text and append order are load-bearing: strings are fed verbatim to
    the corrective-retry prompt in synth.py and asserted across the test suite.
    Do not reword, reorder, or dedupe (a triplicate claim_id must yield two
    errors — the seen-set is checked before it is added to).
    """
    errors: List[str] = []
    seen_claim_ids: set[str] = set()
    for c in claims:
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


def validate_payload(p: ModulePayload) -> List[str]:
    """Return a list of schema errors (empty == valid).

    Enforces the CP_MODULE_PAYLOAD_BASE constraints the engine depends on so a
    malformed model response is recorded as a validation failure and gated,
    never persisted as if it were sound. Header errors first, then claim/
    evidence errors in input order (see _claim_errors for the string contract).
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
    errors.extend(_claim_errors(p.claims))
    return errors


def cp1_leverage(cp1: ModulePayload) -> Tuple[Optional[float], Optional[float]]:
    """(net leverage, net debt) from a CP-1 payload — each read *independently*.

    A reported-disclosure CP-1 (non-EDGAR issuer) can carry ``net_leverage_adj_ltm``
    without ``net_debt_ltm`` (headroom only needs leverage; net debt is only needed
    to reconstruct EBITDA). A missing / zero / non-numeric value comes back as None,
    so a caller that needs *both* (e.g. CP-1A's EBITDA reconstruction) must check
    each one — do not assume leverage-present implies net-debt-present.
    """
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    lev, nd = nf.get("net_leverage_adj_ltm"), nf.get("net_debt_ltm")
    # is_finite_number (not a bare isinstance/truthiness) so a NaN/±inf — which a
    # live LLM-emitted CP-1 can carry, and which would survive `isinstance(..) and x`
    # because bool(NaN) is True — comes back as None and degrades the shared CP-4C /
    # CP-1A consumers, never poisoning a divide downstream.
    lev = float(lev) if is_finite_number(lev) and lev else None
    nd = float(nd) if is_finite_number(nd) and nd else None
    return lev, nd
