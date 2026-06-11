"""
Validation exception taxonomy + render-time enum validation (P2).

Codifies CP_VALIDATION_EXCEPTION_TAXONOMY_v2.0 (20 VE codes + severities) and the
VE-010 render-enum check from CP_RENDER_COMPILE_BOUNDARY SEC3. Pure stdlib.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .enums import CreditImplication, IcActionBias, PortfolioPosture, Severity

# code -> (name, severity)
VE_TAXONOMY: dict[str, tuple[str, Severity]] = {
    "VE-001": ("SCHEMA_MISMATCH", Severity.CRITICAL),
    "VE-002": ("IDENTITY_CONFLICT", Severity.CRITICAL),
    "VE-003": ("MISSING_EVIDENCE_TRACE", Severity.CRITICAL),
    "VE-004": ("UPSTREAM_DEPENDENCY_MISSING", Severity.CRITICAL),
    "VE-005": ("EXPORT_FORMAT_VIOLATION", Severity.CRITICAL),
    "VE-006": ("TAXONOMY_VIOLATION", Severity.CRITICAL),
    "VE-007": ("FABRICATION_DETECTED", Severity.CRITICAL),
    "VE-008": ("CALCULATION_ERROR", Severity.CRITICAL),
    "VE-009": ("OWNERSHIP_VIOLATION", Severity.MATERIAL),
    "VE-010": ("ENUM_VALUE_MISMATCH", Severity.MATERIAL),
    "VE-011": ("DOWNSTREAM_MISMATCH", Severity.MATERIAL),
    "VE-012": ("CONFIDENCE_UNSUPPORTED", Severity.MATERIAL),
    "VE-013": ("LIMITATION_UNDECLARED", Severity.MATERIAL),
    "VE-014": ("STALE_INPUT", Severity.MATERIAL),
    "VE-015": ("ORPHAN_CLAIM", Severity.MATERIAL),
    "VE-016": ("WEAK_LINEAGE", Severity.MINOR),
    "VE-017": ("DELIMITER_AMBIGUITY", Severity.MINOR),
    "VE-018": ("LEGACY_REFERENCE", Severity.MINOR),
    "VE-019": ("TEMPLATE_DEVIATION", Severity.MINOR),
    "VE-020": ("DUPLICATE_FRAGMENT", Severity.MINOR),
}


@dataclass(frozen=True)
class Finding:
    ve_code: str
    severity: Severity
    lane: str
    description: str
    affected_claim_id: str | None = None

    @classmethod
    def of(cls, ve_code: str, lane: str, description: str, claim: str | None = None) -> "Finding":
        return cls(ve_code, VE_TAXONOMY[ve_code][1], lane, description, claim)


# Render-validated enum fields -> their canonical value sets (VE-010).
# binding_constraint (9+None) pending CP-6E port; see enums.RENDER_VALIDATED_ENUMS.
_RENDER_ENUM_VALUES: dict[str, set[str]] = {
    "ic_action_bias": {e.value for e in IcActionBias},
    "portfolio_posture": {e.value for e in PortfolioPosture},
    "credit_implication": {e.value for e in CreditImplication},
}


def validate_render_enums(runtime_output: dict) -> list[Finding]:
    """
    VE-010: every render-validated enum field in runtime_output must hold a value
    from its canonical set. Checks top-level keys and one nesting level.
    """
    findings: list[Finding] = []

    def _check(scope: dict):
        for field_name, valid in _RENDER_ENUM_VALUES.items():
            if field_name in scope and scope[field_name] is not None:
                val = scope[field_name]
                # credit_implication may carry a descriptive primary_* alias
                if isinstance(val, str) and val not in valid:
                    findings.append(Finding.of(
                        "VE-010", "Enum",
                        f"{field_name}={val!r} not in canonical set",
                    ))

    _check(runtime_output)
    for v in runtime_output.values():
        if isinstance(v, dict):
            _check(v)
    return findings


def max_severity(findings: list[Finding]) -> Severity | None:
    order = [Severity.MINOR, Severity.MATERIAL, Severity.CRITICAL]
    present = [f.severity for f in findings]
    return max(present, key=order.index) if present else None
