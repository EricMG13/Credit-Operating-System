"""Source gates and non-fabricating fallbacks for CP-4D and CP-2G."""

from __future__ import annotations

from typing import Iterable

from engine.module_contracts import CP2GRuntime, CP4DRuntime
from engine.prompt_bundles import PromptBundle
from engine.schemas import ModulePayload


RETRIEVAL_QUERIES: dict[str, tuple[str, ...]] = {
    "CP-4D": (
        "subsidiary entity perimeter restricted unrestricted entity Exhibit 21 organization chart",
        "guarantor schedule guarantee release upstream downstream cross-stream guarantee",
        "security collateral lien excluded assets perfection release intercreditor",
        "designation investments restricted payments transfer dropdown sacred rights uptier priming",
    ),
    "CP-2G": (
        "ESG sustainability disclosure emissions transition climate remediation environmental regulation",
        "labor safety product liability license to operate social operational incident",
        "sustainability linked loan bond KPI SPT ratchet margin step up verification",
        "refinancing greenium investor exclusion cost of capital maturity funding access",
    ),
}


def _text(hits: Iterable[object]) -> str:
    return "\n".join(str(getattr(hit, "text", "")) for hit in hits).lower()


def _has_any(text: str, words: tuple[str, ...]) -> bool:
    return any(word in text for word in words)


def source_gate(module_id: str, hits: list[object]) -> tuple[str, list[str]]:
    """Return the methodology status plus explicit missing capabilities."""
    if module_id == "CP-2G":
        if not hits:
            return "Blocked", ["No issuer-specific ESG, transition, social, or linked-debt source was retrieved."]
        return "Completed with Limitations", [
            "Sources were retrieved, but deterministic fallback cannot classify credit materiality."
        ]
    if module_id != "CP-4D":
        raise ValueError(f"unsupported specialized module {module_id}")
    text = _text(hits)
    entity = _has_any(text, (
        "subsidiar", "entity", "organizational chart", "exhibit 21", "parent:", "borrower:",
    ))
    guarantee = _has_any(text, ("guarant", "guarantee", "guarantor schedule"))
    security = _has_any(text, ("collateral", "security interest", "lien", "secured"))
    if any(phrase in text for phrase in (
        "guarantor schedule not provided",
        "guarantee evidence not provided",
        "guarantee schedule: not provided",
        "guarantee documents missing",
    )):
        guarantee = False
    if any(phrase in text for phrase in (
        "security agreement not provided",
        "security documents not provided",
        "security agreement, intercreditor agreement, and restricted-group schedule: not provided",
        "security documents missing",
    )):
        security = False
    missing: list[str] = []
    if not entity:
        missing.append("Entity-perimeter evidence was not retrieved.")
    if not guarantee:
        missing.append("Guarantee-status evidence was not retrieved.")
    if not security:
        missing.append("Security/collateral evidence was not retrieved.")
    if not entity or not guarantee:
        return "Blocked", missing
    if missing:
        return "Completed with Limitations", missing
    # Even with all three capability classes, the deterministic path does not
    # interpret provisions or invent a structural conclusion.
    return "Completed with Limitations", [
        "Source gate passed, but no live synthesis was available to classify structural priority."
    ]


def _source_rows_cp4d(hits: list[object]) -> list[dict]:
    return [
        {
            "source": f"Vault chunk {getattr(hit, 'chunk_id', '')}",
            "status": "Partial",
            "authority_rank": "Unknown",
            "limitations": ["Document execution and authority were not inferred from filename or text alone."],
            "evidence_ids": [str(getattr(hit, "chunk_id", ""))],
        }
        for hit in hits
        if getattr(hit, "chunk_id", None)
    ]


def _gaps(messages: list[str], downstream: list[str]) -> list[dict]:
    return [
        {
            "gap_id": f"GAP-{i}",
            "missing_item": message,
            "why_it_matters": "The module cannot make a defensible credit conclusion without this evidence.",
            "impact_on_output": "Analysis remains unavailable or limited.",
            "required_follow_up": "Vault and classify the governing issuer document, then re-run.",
            "affected_downstream_modules": downstream,
        }
        for i, message in enumerate(messages, 1)
    ]


def unavailable_payload(module_id: str, hits: list[object], bundle: PromptBundle) -> ModulePayload:
    """Build a complete, honest payload without synthesizing analytical findings."""
    status, messages = source_gate(module_id, hits)
    if module_id == "CP-4D":
        runtime = CP4DRuntime.model_validate({
            "schema_version": "cp-4d.v1",
            "prompt_bundle_fingerprint": bundle.fingerprint,
            "prompt_bundle_files": list(bundle.files),
            "module_status": status,
            "status_basis": " ".join(messages),
            "source_gate_register": _source_rows_cp4d(hits),
            "entity_register": [],
            "guarantee_matrix": [],
            "collateral_matrix": [],
            "structural_priority": [],
            "leakage_routes": [],
            "priming_exposures": [],
            "gaps": _gaps(messages, ["CP-4C", "CP-6A", "CP-3B next run"]),
            "overall_structural_view": "Insufficient Information — no structural finding was generated.",
            "handoffs": {"cp_3b_next_run": None, "cp_4c": None, "cp_6a": None},
        }).model_dump(mode="json")
        return ModulePayload(
            module_id="CP-4D", module_name="RestrictedGroupGuaranteeMap",
            owned_object="structural_priority_map", runtime_output=runtime,
            confidence="Insufficient Information", limitation_flags=messages,
            downstream_consumers=["CP-4C", "CP-6A", "CP-3B (next run)"],
        )
    source_rows = [
        {
            "source": f"Vault chunk {getattr(hit, 'chunk_id', '')}",
            "source_date": None,
            "source_type": "Vaulted issuer document",
            "reliability": "Unknown",
            "greenwashing_flag": "Insufficient Information",
            "evidence_ids": [str(getattr(hit, "chunk_id", ""))],
        }
        for hit in hits
        if getattr(hit, "chunk_id", None)
    ]
    runtime = CP2GRuntime.model_validate({
        "schema_version": "cp-2g.v1",
        "prompt_bundle_fingerprint": bundle.fingerprint,
        "prompt_bundle_files": list(bundle.files),
        "module_status": status,
        "status_basis": " ".join(messages),
        "source_register": source_rows,
        "transition_risks": [],
        "social_event_risks": [],
        "materiality_assessments": [],
        "sustainability_linked_debt_status": "Insufficient Information",
        "sustainability_linked_instruments": [],
        "demand_access_implications": [],
        "credit_implications": [],
        "gaps": _gaps(messages, ["CP-6A"]),
        "overall_credit_view": "Insufficient Information — no ESG credit finding was generated.",
        "cp6a_handoff": None,
    }).model_dump(mode="json")
    return ModulePayload(
        module_id="CP-2G", module_name="ESGSustainabilityCreditRisk",
        owned_object="esg_credit_risk", runtime_output=runtime,
        confidence="Insufficient Information", limitation_flags=messages,
        downstream_consumers=["CP-6A"],
    )


def runtime_evidence_ids(runtime_output: object) -> set[str]:
    """Collect every explicit ``evidence_ids`` entry from a runtime tree."""
    found: set[str] = set()
    if isinstance(runtime_output, dict):
        for key, value in runtime_output.items():
            if key == "evidence_ids" and isinstance(value, list):
                found.update(str(item) for item in value if isinstance(item, str))
            else:
                found.update(runtime_evidence_ids(value))
    elif isinstance(runtime_output, list):
        for value in runtime_output:
            found.update(runtime_evidence_ids(value))
    return found
