"""
CP-5 Severity Engine — Programmatic Integrity QA middleware.

Intercepts agent outputs and assigns severity verdicts:
  PASS     - Output meets all validation criteria
  WARNING  - Minor issues; output accepted with caveats noted
  CRITICAL - Output blocked; DAG node state mutated to BLOCKED

A CRITICAL finding halts downstream propagation.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Callable

from pydantic import BaseModel

# A severity rule: takes a payload, returns a finding (or None for "no issue").
RuleFn = Callable[[dict[str, Any]], "IntegrityFinding | None"]


class Severity(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class IntegrityFinding(BaseModel):
    severity: Severity
    module_id: str
    rule_id: str
    message: str
    field_path: str | None = None
    evidence: str | None = None


class IntegrityReport(BaseModel):
    module_id: str
    overall_severity: Severity
    findings: list[IntegrityFinding]
    blocked: bool
    blocked_reason: str | None = None


class SeverityEngine:
    """
    Applies rule sets to agent output payloads.
    Rules are registered per module_id and evaluated in order.
    """

    def __init__(self) -> None:
        self._rules: dict[str, list[RuleFn]] = {}

    def register(self, module_id: str, rule_fn: RuleFn) -> None:
        self._rules.setdefault(module_id, []).append(rule_fn)

    def evaluate(self, module_id: str, payload: dict[str, Any]) -> IntegrityReport:
        findings: list[IntegrityFinding] = []
        rules = self._rules.get(module_id, []) + self._rules.get("*", [])

        for rule_fn in rules:
            result = rule_fn(payload)
            if result:
                findings.append(result)

        if not findings:
            return IntegrityReport(
                module_id=module_id,
                overall_severity=Severity.PASS,
                findings=[],
                blocked=False,
            )

        overall = max(findings, key=lambda f: list(Severity).index(f.severity)).severity
        blocked = overall == Severity.CRITICAL
        blocked_reason = next((f.message for f in findings if f.severity == Severity.CRITICAL), None)

        return IntegrityReport(
            module_id=module_id,
            overall_severity=overall,
            findings=findings,
            blocked=blocked,
            blocked_reason=blocked_reason,
        )


# ─── Global Severity Engine instance ─────────────────────────────────────
_engine = SeverityEngine()


def get_severity_engine() -> SeverityEngine:
    return _engine


# ─── Universal rules (applied to ALL modules) ─────────────────────────────
def _rule_no_inferred_metrics(payload: dict[str, Any]) -> IntegrityFinding | None:
    """Flag any field annotated as 'inferred' — must be source-backed."""
    if payload.get("has_inferred_metrics"):
        return IntegrityFinding(
            severity=Severity.CRITICAL,
            module_id="*",
            rule_id="NO_INFERRED_METRICS",
            message="Output contains inferred metrics not sourced from documents. BLOCKED.",
        )
    return None


def _rule_evidence_chain_present(payload: dict[str, Any]) -> IntegrityFinding | None:
    """Every material conclusion must carry an evidence_chain entry."""
    conclusions = payload.get("material_conclusions", [])
    for c in conclusions:
        if not c.get("evidence_chain"):
            return IntegrityFinding(
                severity=Severity.CRITICAL,
                module_id="*",
                rule_id="MISSING_EVIDENCE_CHAIN",
                message=f"Material conclusion '{c.get('label', 'unknown')}' missing evidence chain. BLOCKED.",
                field_path="material_conclusions[].evidence_chain",
            )
    return None


_engine.register("*", _rule_no_inferred_metrics)
_engine.register("*", _rule_evidence_chain_present)
