"""Closed runtime contracts for optional methodology modules.

The supplied ``SCHEMA_REFERENCE.md`` files describe tables for people; these
models are the executable CAOS contract used by the forced-output tool and the
post-synthesis validator.  They deliberately retain CAOS confidence/evidence
governance instead of the prompt packs' unavailable numeric-confidence/export
references.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


NonEmpty = Annotated[str, Field(min_length=1)]
Confidence = Literal["High", "Medium", "Low", "Insufficient Information"]


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Gap(_StrictModel):
    gap_id: NonEmpty
    missing_item: NonEmpty
    why_it_matters: NonEmpty
    impact_on_output: NonEmpty
    required_follow_up: NonEmpty
    affected_downstream_modules: list[str] = Field(default_factory=list)


class CP4DSource(_StrictModel):
    source: NonEmpty
    status: Literal["Available", "Partial", "Missing", "Unknown"]
    authority_rank: Literal[
        "Executed Documentary",
        "Regulatory Filed",
        "Issuer Disclosure",
        "Upstream Artifact",
        "Unknown",
    ]
    limitations: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)


class CP4DEntity(_StrictModel):
    entity: NonEmpty
    role: NonEmpty
    jurisdiction: Optional[str]
    parent: Optional[str]
    designation: Literal["Restricted", "Unrestricted", "Unknown"]
    material_value_held: NonEmpty
    inside_credit_group: Optional[bool]
    evidence_ids: list[NonEmpty] = Field(min_length=1)


class CP4DGuarantee(_StrictModel):
    entity: NonEmpty
    tranche: NonEmpty
    guarantee_type: NonEmpty
    direction: NonEmpty
    release_trigger: NonEmpty
    guarantee_status: Literal["Guaranteed", "Not Guaranteed", "Conditional", "Unknown"]
    evidence_ids: list[NonEmpty] = Field(min_length=1)


class CP4DCollateral(_StrictModel):
    entity: NonEmpty
    lien: NonEmpty
    collateral: NonEmpty
    excluded_assets: NonEmpty
    release_mechanic: NonEmpty
    perfection_limit: NonEmpty
    evidence_ids: list[NonEmpty] = Field(min_length=1)


StructuralPriority = Literal[
    "Structurally Senior",
    "Pari",
    "Structurally Subordinated — Non-Guarantor Value",
    "Contractually Subordinated",
    "Leakage-Exposed (drop-down capable)",
    "Priming-Exposed (uptier capable)",
    "Insufficient Information",
]


class CP4DStructuralPriority(_StrictModel):
    finding_id: NonEmpty
    claim_or_tranche: NonEmpty
    obligor_entity: NonEmpty
    reachable_value: NonEmpty
    priority_label: StructuralPriority
    entity_gap: Optional[str]
    stranded_value: Optional[str]
    recovery_access_implication: NonEmpty
    confidence: Confidence
    evidence_ids: list[NonEmpty] = Field(min_length=1)

    @model_validator(mode="after")
    def require_named_subordination(self) -> "CP4DStructuralPriority":
        if self.priority_label == "Structurally Subordinated — Non-Guarantor Value":
            if not (self.entity_gap and self.entity_gap.strip()):
                raise ValueError("structural subordination must name the entity gap")
            if not (self.stranded_value and self.stranded_value.strip()):
                raise ValueError("structural subordination must name the stranded value")
        return self


LeakageSeverity = Union[Literal[1, 2, 3, 4, 5], Literal["Not Scorable"]]
CapacityBasis = Literal["Demonstrated", "Theoretical", "Contested", "Insufficient Information"]


class CP4DLeakageRoute(_StrictModel):
    finding_id: NonEmpty
    route: NonEmpty
    entity_path: NonEmpty
    enabling_provision_cp4_ref: Optional[str]
    value_exposed: NonEmpty
    leakage_severity: LeakageSeverity
    recovery_priority_implication: NonEmpty
    capacity_basis: CapacityBasis
    evidence_ids: list[NonEmpty] = Field(min_length=1)

    @model_validator(mode="after")
    def require_enabling_provision(self) -> "CP4DLeakageRoute":
        if self.leakage_severity != "Not Scorable" and not self.enabling_provision_cp4_ref:
            raise ValueError("scored leakage route requires a CP-4 enabling-provision reference")
        return self


class CP4DPrimingExposure(_StrictModel):
    finding_id: NonEmpty
    vulnerability: NonEmpty
    enabling_provision_cp4_ref: Optional[str]
    affected_creditor_classes: list[NonEmpty] = Field(min_length=1)
    capacity_basis: CapacityBasis
    structural_implication: NonEmpty
    confidence: Confidence
    evidence_ids: list[NonEmpty] = Field(min_length=1)


class CP4DHandoff(_StrictModel):
    finding_id: NonEmpty
    summary: NonEmpty
    priority_label: StructuralPriority
    leakage_severity: LeakageSeverity
    affected_creditor_classes: list[str] = Field(default_factory=list)
    capacity_basis: CapacityBasis
    confidence: Confidence
    evidence_ids: list[NonEmpty] = Field(min_length=1)


class CP4DHandoffs(_StrictModel):
    cp_3b_next_run: Optional[CP4DHandoff]
    cp_4c: Optional[CP4DHandoff]
    cp_6a: Optional[CP4DHandoff]


class CP4DRuntime(_StrictModel):
    schema_version: Literal["cp-4d.v1"]
    prompt_bundle_fingerprint: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    prompt_bundle_files: list[NonEmpty] = Field(min_length=1)
    module_status: Literal["Completed", "Completed with Limitations", "Blocked"]
    status_basis: NonEmpty
    source_gate_register: list[CP4DSource]
    entity_register: list[CP4DEntity]
    guarantee_matrix: list[CP4DGuarantee]
    collateral_matrix: list[CP4DCollateral]
    structural_priority: list[CP4DStructuralPriority]
    leakage_routes: list[CP4DLeakageRoute]
    priming_exposures: list[CP4DPrimingExposure]
    gaps: list[Gap]
    overall_structural_view: NonEmpty
    handoffs: CP4DHandoffs

    @model_validator(mode="after")
    def gate_invariants(self) -> "CP4DRuntime":
        if self.module_status == "Blocked":
            analytical = (
                self.entity_register,
                self.guarantee_matrix,
                self.collateral_matrix,
                self.structural_priority,
                self.leakage_routes,
                self.priming_exposures,
            )
            if any(analytical):
                raise ValueError("Blocked CP-4D output cannot contain analytical findings")
            if not self.gaps:
                raise ValueError("Blocked CP-4D output requires a gap ledger")
        if self.module_status == "Completed" and self.gaps:
            raise ValueError("Completed CP-4D output cannot retain unresolved gaps")
        if self.module_status == "Completed" and not (
            self.source_gate_register and self.entity_register
            and self.guarantee_matrix and self.structural_priority
        ):
            raise ValueError("Completed CP-4D requires sourced entity, guarantee, and structural registers")
        if self.module_status == "Completed with Limitations" and not self.gaps:
            raise ValueError("Completed with Limitations CP-4D requires a gap ledger")
        return self


class CP2GSource(_StrictModel):
    source: NonEmpty
    source_date: Optional[date]
    source_type: NonEmpty
    reliability: Literal[
        "Audited",
        "Assured",
        "Regulatory Filed",
        "Executed Documentary",
        "Self-Reported",
        "Promotional",
        "Unknown",
    ]
    greenwashing_flag: Literal["None Identified", "Watch", "Material", "Insufficient Information"]
    evidence_ids: list[NonEmpty] = Field(min_length=1)


CreditDriver = Literal[
    "Revenue", "Margin", "Capex", "Remediation Cost", "Asset Value",
    "Refinancing Access", "Recovery", "Other",
]


class CP2GTransitionRisk(_StrictModel):
    exposure: NonEmpty
    source_date: Optional[date]
    transmission_mechanic: NonEmpty
    affected_drivers: list[CreditDriver] = Field(min_length=1)
    evidence_ids: list[NonEmpty] = Field(min_length=1)


class CP2GSocialRisk(_StrictModel):
    exposure: NonEmpty
    source_date: Optional[date]
    transmission_mechanic: NonEmpty
    event_profile: Literal["Event Risk", "Ongoing", "Both"]
    evidence_ids: list[NonEmpty] = Field(min_length=1)


MaterialityClass = Literal[
    "Material — Quantified",
    "Material — Directional",
    "Watch",
    "Immaterial to Credit",
    "Insufficient Information",
]


class CP2GMateriality(_StrictModel):
    factor: NonEmpty
    materiality_class: MaterialityClass
    transmission_basis: NonEmpty
    catalyst: Optional[str]
    evidence_ids: list[NonEmpty] = Field(min_length=1)
    gap_id: Optional[str]

    @model_validator(mode="after")
    def classification_invariants(self) -> "CP2GMateriality":
        if self.materiality_class == "Watch" and not self.catalyst:
            raise ValueError("Watch materiality requires a catalyst")
        if self.materiality_class == "Insufficient Information" and not self.gap_id:
            raise ValueError("Insufficient Information materiality requires a gap_id")
        return self


class CP2GLinkedInstrument(_StrictModel):
    instrument: NonEmpty
    instrument_key: NonEmpty
    kpi: NonEmpty
    spt: NonEmpty
    test_date: Optional[date]
    ratchet_direction: Literal["Step-Up", "Step-Down", "Two-Way", "Insufficient Information"]
    ratchet_bps: Optional[float]
    symmetry: Literal["Symmetric", "Asymmetric", "Not Applicable", "Insufficient Information"]
    miss_consequence: NonEmpty
    reporting_verification: NonEmpty
    credit_significance: Literal["Credit-Meaningful", "Cosmetic", "Insufficient Information"]
    expected_spread_effect_bps: Optional[float]
    basis: NonEmpty
    evidence_ids: list[NonEmpty] = Field(min_length=1)
    gap_ids: list[str] = Field(default_factory=list)


class CP2GDemandAccess(_StrictModel):
    effect: NonEmpty
    direction: Literal["Supportive", "Adverse", "Mixed", "Neutral", "Insufficient Information"]
    quantification: Literal["Quantified", "Directional", "Insufficient Information"]
    linked_maturity_or_funding_need: NonEmpty
    evidence_ids: list[NonEmpty] = Field(min_length=1)


CreditChannel = Literal[
    "PD", "LGD", "Liquidity", "FCF Durability", "Refinancing Capacity",
    "Relative Value", "Security Selection", "Monitoring Posture",
]


class CP2GCreditImplication(_StrictModel):
    material_factor: NonEmpty
    materiality_class: MaterialityClass
    risk_mechanic: NonEmpty
    channels: list[CreditChannel] = Field(min_length=1)
    direction: Literal["Positive", "Negative", "Mixed", "Neutral", "Insufficient Information"]
    implication: NonEmpty
    confidence: Confidence
    evidence_ids: list[NonEmpty] = Field(min_length=1)


class CP2GHandoff(_StrictModel):
    factor: NonEmpty
    materiality_class: Literal["Material — Quantified", "Material — Directional", "Watch"]
    net_direction: Literal["Positive", "Negative"]
    risk_mechanic: NonEmpty
    channels: list[CreditChannel] = Field(min_length=1)
    summary: NonEmpty
    evidence_ids: list[NonEmpty] = Field(min_length=1)


class CP2GRuntime(_StrictModel):
    schema_version: Literal["cp-2g.v1"]
    prompt_bundle_fingerprint: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    prompt_bundle_files: list[NonEmpty] = Field(min_length=1)
    module_status: Literal["Completed", "Completed with Limitations", "Not Applicable", "Blocked"]
    status_basis: NonEmpty
    source_register: list[CP2GSource]
    transition_risks: list[CP2GTransitionRisk]
    social_event_risks: list[CP2GSocialRisk]
    materiality_assessments: list[CP2GMateriality]
    sustainability_linked_debt_status: Literal["Present", "Not Applicable", "Insufficient Information"]
    sustainability_linked_instruments: list[CP2GLinkedInstrument]
    demand_access_implications: list[CP2GDemandAccess]
    credit_implications: list[CP2GCreditImplication]
    gaps: list[Gap]
    overall_credit_view: NonEmpty
    cp6a_handoff: Optional[CP2GHandoff]

    @model_validator(mode="after")
    def gate_invariants(self) -> "CP2GRuntime":
        gap_ids = {gap.gap_id for gap in self.gaps}
        for row in self.materiality_assessments:
            if row.gap_id and row.gap_id not in gap_ids:
                raise ValueError(f"materiality gap_id {row.gap_id!r} is not present in gaps")
        if self.module_status == "Blocked":
            if self.source_register:
                raise ValueError("Blocked CP-2G is reserved for a zero-source assessment")
            if not self.gaps:
                raise ValueError("Blocked CP-2G output requires a gap ledger")
            if self.cp6a_handoff is not None:
                raise ValueError("Blocked CP-2G cannot emit a CP-6A handoff")
        if self.module_status == "Not Applicable":
            if not self.source_register:
                raise ValueError("Not Applicable requires an affirmative source inventory")
            if not self.materiality_assessments:
                raise ValueError("Not Applicable requires explicit materiality assessments")
            if any(r.materiality_class != "Immaterial to Credit" for r in self.materiality_assessments):
                raise ValueError("Not Applicable requires every factor to be Immaterial to Credit")
            if self.sustainability_linked_debt_status != "Not Applicable":
                raise ValueError("Not Applicable requires affirmative absence of sustainability-linked debt")
            if self.sustainability_linked_instruments or self.cp6a_handoff is not None:
                raise ValueError("Not Applicable cannot contain linked instruments or a CP-6A handoff")
        if self.module_status == "Completed" and self.gaps:
            raise ValueError("Completed CP-2G output cannot retain unresolved gaps")
        if self.module_status == "Completed" and not (
            self.source_register and (self.credit_implications or self.sustainability_linked_instruments)
        ):
            raise ValueError("Completed CP-2G requires sourced credit implications or linked-debt mechanics")
        if self.module_status == "Completed with Limitations" and not self.gaps:
            raise ValueError("Completed with Limitations CP-2G requires a gap ledger")
        return self


RUNTIME_MODELS = {
    "CP-4D": CP4DRuntime,
    "CP-2G": CP2GRuntime,
}


def runtime_schema_for(module_id: str) -> Optional[dict]:
    model = RUNTIME_MODELS.get(module_id)
    return model.model_json_schema() if model is not None else None


def validate_runtime_output(module_id: str, runtime_output: object) -> list[str]:
    model = RUNTIME_MODELS.get(module_id)
    if model is None:
        return []
    try:
        model.model_validate(runtime_output)
    except Exception as exc:  # Pydantic emits a complete path-aware error string.
        return [f"{module_id} runtime contract: {exc}"]
    return []
