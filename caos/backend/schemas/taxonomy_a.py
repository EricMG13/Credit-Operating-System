"""
Taxonomy A (Modular OS v2 Canonical) schemas + legacy translation shim.

Per `Modular OS/README/TAXONOMY_RECONCILIATION.md`:
  CP-1  = CanonicalDataFoundation        (was: Capital Structure)
  CP-1A = BusinessTransactionFactPack    (was: Debt Waterfall)

The agents in `agents/l1_base/cp1*.py` still emit the legacy shapes
(`CP1CapitalStructureOutput`, `CP1ADebtWaterfallOutput`). Rewriting them is
the proper P0 fix, but until that lands we need outputs that:

  (a) carry the canonical `module_name` so `governance.qa_engine` doesn't
      raise VE-002 ("unknown module_id"), and
  (b) preserve the legacy payload for the frontend without break.

`to_taxonomy_a(...)` wraps a legacy dict so QA passes and downstream
consumers can still read the old keys via the `legacy_payload` field.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ─── CP-1: CanonicalDataFoundation (envelope) ─────────────────────────────

class CP1CanonicalDataFoundationOutput(BaseModel):
    """Canonical-taxonomy envelope for CP-1.

    The agent that owns the CP-1_ACTIVE_PROMPT prose is responsible for
    filling `runtime_output` with the 21-section data foundation. Until
    that agent exists, the shim packs the legacy capital-structure dict
    under `legacy_payload`.
    """
    module_id: Literal["CP-1"] = "CP-1"
    module_name: Literal["CanonicalDataFoundation"] = "CanonicalDataFoundation"
    owned_object: Literal["canonical_data_foundation"] = "canonical_data_foundation"
    schema_family: Literal["nested"] = "nested"
    runtime_output: dict[str, Any] = Field(default_factory=dict)
    evidence_trace: list[dict[str, Any]] = Field(default_factory=list)
    confidence: float = 0.0
    limitation_flags: list[str] = Field(default_factory=list)
    qa_status: Literal["Passed", "Restricted", "Blocked"] = "Restricted"
    validation_warnings: list[str] = Field(default_factory=list)
    downstream_consumers: list[str] = Field(
        default_factory=lambda: ["CP-1B", "CP-1C", "CP-2", "CP-2B", "CP-2E",
                                 "CP-3", "CP-3D", "CP-4", "CP-4C", "CP-6A"]
    )
    # Transition-only: the legacy payload (Capital Structure dict) lives here
    # while the migration is in flight. Drop once the new agent ships.
    legacy_payload: dict[str, Any] | None = None


# ─── CP-1A: BusinessTransactionFactPack (envelope) ────────────────────────

class CP1ABusinessTransactionFactPackOutput(BaseModel):
    module_id: Literal["CP-1A"] = "CP-1A"
    module_name: Literal["BusinessTransactionFactPack"] = "BusinessTransactionFactPack"
    owned_object: Literal["business_transaction_fact_register"] = "business_transaction_fact_register"
    schema_family: Literal["nested"] = "nested"
    runtime_output: dict[str, Any] = Field(default_factory=dict)
    evidence_trace: list[dict[str, Any]] = Field(default_factory=list)
    confidence: float = 0.0
    limitation_flags: list[str] = Field(default_factory=list)
    qa_status: Literal["Passed", "Restricted", "Blocked"] = "Restricted"
    validation_warnings: list[str] = Field(default_factory=list)
    downstream_consumers: list[str] = Field(default_factory=lambda: ["CP-2", "CP-2D"])
    legacy_payload: dict[str, Any] | None = None


# ─── Translation shim ─────────────────────────────────────────────────────

# Map legacy `module_id` → Taxonomy A envelope class.
_TAXONOMY_A_ENVELOPES = {
    "CP-1": CP1CanonicalDataFoundationOutput,
    "CP-1A": CP1ABusinessTransactionFactPackOutput,
}


def to_taxonomy_a(module_id: str, legacy_output: dict[str, Any]) -> dict[str, Any]:
    """
    Wrap a legacy agent payload in the Taxonomy A envelope.

    Modules not yet remapped (CP-1B, CP-2, CP-3, CP-4, …) pass through
    unchanged — they already carry the canonical `module_id` because the
    legacy and canonical taxonomies agree on them.

    Side-effect-free: returns a NEW dict; the caller's payload is unchanged.
    """
    envelope_cls = _TAXONOMY_A_ENVELOPES.get(module_id)
    if envelope_cls is None:
        return legacy_output

    envelope = envelope_cls(
        legacy_payload=legacy_output,
        validation_warnings=[
            f"Taxonomy-A shim: {module_id} agent still emits legacy schema; "
            "see docs/REMEDIATION_PLAN.md §3.3."
        ],
    )
    return envelope.model_dump()
