"""
CP-5 Research-Integrity QA (8 lanes) + CP-5B evidence-trace validation (P2).

Implements the deterministic core of the QA gate per CP_QA_POLICY_v1.0 and
CP_SYSTEM_QA_GATES: the 8 audit lanes, the severity gate
(CRITICAL→Blocked, MATERIAL→Restricted, else Passed), and committee_status.
LLM-judgment lanes (Unsupported Claim, Calculation, Legal/Covenant, Market/RV)
accept findings supplied by the CP-5 agent; the rest are checked here.

Output conforms to CP_QA_RESULT.schema. Pure stdlib.
"""

from __future__ import annotations

from .enums import LineageClass, QaStatus, Severity
from .registry import load_registry
from .validation import Finding, max_severity, validate_render_enums

LANES = [
    "Unsupported Claim", "Calculation", "Legal / Covenant", "Market / RV",
    "Cross-Module Consistency", "Evidence Trace", "Schema", "Export",
]

_BASE_REQUIRED = [
    "module_id", "module_name", "owned_object", "schema_family", "runtime_output",
    "evidence_trace", "confidence", "limitation_flags", "qa_status",
    "validation_warnings", "downstream_consumers",
]

# Lineage classes that make a committee-facing material claim an orphan (VE-015).
_ORPHAN_LINEAGE = {
    LineageClass.UNTRACED.value, LineageClass.WEAK_LINEAGE.value,
    LineageClass.INSUFFICIENT.value,
}


def _lane_schema(payload: dict) -> list[Finding]:
    missing = [f for f in _BASE_REQUIRED if f not in payload]
    findings = []
    if missing:
        findings.append(Finding.of("VE-001", "Schema",
                                   f"missing required envelope fields: {missing}"))
    return findings


def _lane_cross_module(payload: dict) -> list[Finding]:
    findings: list[Finding] = []
    reg = load_registry()
    mid = payload.get("module_id")
    m = reg.modules.get(mid) if mid else None
    if m is None:
        findings.append(Finding.of("VE-002", "Cross-Module Consistency",
                                   f"unknown module_id {mid!r}"))
        return findings
    if payload.get("owned_object") not in (None, m.owned_object):
        findings.append(Finding.of(
            "VE-002", "Cross-Module Consistency",
            f"owned_object {payload.get('owned_object')!r} != registry {m.owned_object!r}"))
    return findings


def _lane_enum(payload: dict) -> list[Finding]:
    return validate_render_enums(payload.get("runtime_output", {}) or {})


def _lane_evidence_trace(payload: dict) -> list[Finding]:
    """Material conclusions must carry evidence (VE-003)."""
    findings: list[Finding] = []
    ro = payload.get("runtime_output", {}) or {}
    for c in ro.get("material_conclusions", []) or []:
        if not c.get("evidence_chain") and not c.get("evidence"):
            findings.append(Finding.of(
                "VE-003", "Evidence Trace",
                f"material conclusion {c.get('label', '?')!r} lacks evidence",
                claim=c.get("id")))
    return findings


def validate_lineage(evidence_trace: list[dict]) -> list[Finding]:
    """
    CP-5B: orphan-claim detection over evidence-trace entries.
    Entry shape: {claim_id, lineage_class, committee_facing, mitigation}.
    """
    findings: list[Finding] = []
    for e in evidence_trace or []:
        lc = e.get("lineage_class")
        committee = e.get("committee_facing", True)
        mitigated = bool(e.get("mitigation"))
        if lc in _ORPHAN_LINEAGE and committee and not mitigated:
            findings.append(Finding.of("VE-015", "Evidence Trace",
                                       f"orphan claim (lineage={lc})", claim=e.get("claim_id")))
        elif lc == LineageClass.WEAK_LINEAGE.value:
            findings.append(Finding.of("VE-016", "Evidence Trace",
                                       "weak lineage", claim=e.get("claim_id")))
    return findings


def _gate(findings: list[Finding]) -> tuple[QaStatus, str]:
    sev = max_severity(findings)
    if sev == Severity.CRITICAL:
        return QaStatus.BLOCKED, "Blocked"
    if sev == Severity.MATERIAL:
        return QaStatus.RESTRICTED, "Restricted"
    return QaStatus.PASSED, "Committee Ready"


def run_qa(payload: dict, *, agent_findings: list[Finding] | None = None) -> dict:
    """
    Run the deterministic CP-5 lanes (+ any agent-supplied findings) and produce
    a CP_QA_RESULT. CP-5B lineage findings are merged via the payload's
    evidence_trace.
    """
    findings: list[Finding] = []
    findings += _lane_schema(payload)
    findings += _lane_cross_module(payload)
    findings += _lane_enum(payload)
    findings += _lane_evidence_trace(payload)
    findings += validate_lineage(payload.get("evidence_trace", []) if isinstance(payload.get("evidence_trace"), list) else [])
    findings += list(agent_findings or [])

    qa_status, committee_status = _gate(findings)
    return {
        "artifact_id": payload.get("module_id", "unknown"),
        "qa_status": qa_status.value,
        "committee_status": committee_status,
        "findings": [
            {"finding_id": f"{f.ve_code}-{i}", "ve_code": f.ve_code,
             "severity": f.severity.value, "lane": f.lane,
             "description": f.description, "affected_claim_id": f.affected_claim_id}
            for i, f in enumerate(findings)
        ],
        "required_remediation": sorted({f.ve_code for f in findings
                                        if f.severity in (Severity.CRITICAL, Severity.MATERIAL)}),
    }
