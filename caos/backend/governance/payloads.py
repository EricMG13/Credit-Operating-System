"""
Per-module payload models on the canonical envelope (P1).

Each model subclasses CPModulePayloadBase and types its `runtime_output` to the
module's corpus payload schema. Per Redeploy Plan D2 these are intended to be
generated from the JSON Schemas (`datamodel-code-generator`); CP-1C and CP-2E
are hand-written here as the generation template for the remaining modules.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .enums import (
    AlertTier,
    CalculationStatus,
    Confidence,
    CreditImplication,
    IcActionBias,
    RefinancingPathType,
    SchemaFamily,
    SectorCreditPosture,
    SizingPosture,
)
from .payload_base import CPModulePayloadBase


# ── CP-1C PeerBenchmark (owned_object: peer_benchmark) ─────────────────────

class PeerEntry(BaseModel):
    name: str
    category: str  # one of the 8 peer category labels
    comparability_status: str  # Comparable | Comparable with Limitations | Not Comparable | Insufficient Information
    provenance_tier: int | None = None  # 1–7 peer source hierarchy


class MetricComparison(BaseModel):
    metric: str  # one of the 15 core formulas
    borrower_value: float | None = None
    peer_median: float | None = None
    peer_n: int | None = None
    alignment_status: str | None = None
    calculation_status: CalculationStatus = CalculationStatus.INSUFFICIENT


class OutlierEntry(BaseModel):
    metric: str
    direction: str  # Favorable | Unfavorable | Mixed | Non-Comparable | Insufficient Information
    note: str | None = None


class CP1CRuntimeOutput(BaseModel):
    peer_universe: list[PeerEntry] = Field(default_factory=list)
    metric_comparison: list[MetricComparison] = Field(default_factory=list)
    outliers: list[OutlierEntry] = Field(default_factory=list)
    overall_peer_view: str = ""


class CP1CPeerBenchmarkPayload(CPModulePayloadBase):
    module_id: str = "CP-1C"
    module_name: str = "PeerBenchmark"
    owned_object: str = "peer_benchmark"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP1CRuntimeOutput = Field(default_factory=CP1CRuntimeOutput)  # type: ignore[assignment]


# ── CP-2E LiquidityCashFlowBridge (owned_object: liquidity_cash_flow_bridge) ─

class LiquidityComponent(BaseModel):
    label: str  # Cash | Restricted cash | Accessible revolver availability | ...
    amount_mm: float | None = None
    status: str | None = None  # Reported | Calculated | Provisional | ...


class CashUse(BaseModel):
    category: str  # Cash interest | Cash taxes | Debt amortization | Mandatory capex | ...
    amount_mm: float | None = None
    mandatory: bool = True


class LiquidityBridgeResult(BaseModel):
    beginning_accessible_liquidity_mm: float | None = None
    ending_accessible_liquidity_mm: float | None = None
    months_to_empty: float | None = None  # only when both inputs supported


class CP2ERuntimeOutput(BaseModel):
    beginning_liquidity: list[LiquidityComponent] = Field(default_factory=list)
    cash_uses: list[CashUse] = Field(default_factory=list)
    bridge: LiquidityBridgeResult = Field(default_factory=LiquidityBridgeResult)
    liquidity_risk_level: str = "Insufficient Information"  # Adequate | Tight | Weak | Insufficient Information
    narrative: str = ""


class CP2ELiquidityBridgePayload(CPModulePayloadBase):
    module_id: str = "CP-2E"
    module_name: str = "LiquidityCashFlowBridge"
    owned_object: str = "liquidity_cash_flow_bridge"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP2ERuntimeOutput = Field(default_factory=CP2ERuntimeOutput)  # type: ignore[assignment]


# ── CP-2B DownsidePathway (owned_object: downside_pathway) ──────────────────

class CausalChainStep(BaseModel):
    operating_driver: str
    break_point: str | None = None
    financial_effect: str | None = None
    fcf_liquidity_effect: str | None = None
    leverage_covenant_refi_effect: str | None = None
    credit_consequence: str | None = None


class FragilityDriver(BaseModel):
    group: str  # Revenue | Margin | Cash-conversion | Liquidity | Capital-structure | Legal/structural | Governance | Macro
    assessment: str | None = None
    evidence: str | None = None


class PathwayEntry(BaseModel):
    label: str  # one of the 11 pathway labels
    severity: str | None = None
    monitoring_signal: str | None = None


class CP2BRuntimeOutput(BaseModel):
    causal_chain: list[CausalChainStep] = Field(default_factory=list)
    fragility_drivers: list[FragilityDriver] = Field(default_factory=list)
    pathway_register: list[PathwayEntry] = Field(default_factory=list)
    conditional_hard_stop: bool = False
    narrative: str = ""


class CP2BDownsidePathwayPayload(CPModulePayloadBase):
    module_id: str = "CP-2B"
    module_name: str = "DownsidePathway"
    owned_object: str = "downside_pathway"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP2BRuntimeOutput = Field(default_factory=CP2BRuntimeOutput)  # type: ignore[assignment]


# ── CP-3D RefinancingLMERisk (owned_object: refinancing_lme_risk) ───────────

class MaturityWallEntry(BaseModel):
    instrument: str
    maturity: str | None = None
    amount_mm: float | None = None
    refinancing_pressure: str | None = None  # Low | Medium | High


class RefinancingRiskEntry(BaseModel):
    factor: str
    assessment: str | None = None
    vulnerability: str | None = None  # Low | Medium | High


class LMERiskEntry(BaseModel):
    mechanism: str  # Uptier | Drop-Down | Priming | Exchange | ...
    priming_risk: str | None = None  # Low | Medium | High
    exposed_creditor_class: str | None = None


class CP3DRuntimeOutput(BaseModel):
    maturity_wall: list[MaturityWallEntry] = Field(default_factory=list)
    refinancing_risk_register: list[RefinancingRiskEntry] = Field(default_factory=list)
    lme_risk_register: list[LMERiskEntry] = Field(default_factory=list)
    refinancing_path_type: RefinancingPathType | None = None
    narrative: str = ""


class CP3DRefinancingLMEPayload(CPModulePayloadBase):
    module_id: str = "CP-3D"
    module_name: str = "RefinancingLMERisk"
    owned_object: str = "refinancing_lme_risk"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP3DRuntimeOutput = Field(default_factory=CP3DRuntimeOutput)  # type: ignore[assignment]


# ── CP-6A ICDebateChallenge (owned_object: ic_debate_challenge) ─────────────

class DebateResolutionEntry(BaseModel):
    issue: str
    bull_argument: str | None = None
    bear_argument: str | None = None
    chair_resolution: str | None = None
    evidence_weight: str | None = None


class CP6ARuntimeOutput(BaseModel):
    pre_debate_thesis_map: str = ""
    bull_opening: str = ""
    bear_cross_examination: str = ""
    debate_resolution_matrix: list[DebateResolutionEntry] = Field(default_factory=list)
    ic_action_bias: IcActionBias = IcActionBias.REQUIRES_MORE_WORK
    single_greatest_uncertainty: str = ""
    final_memo: str = ""
    primary_credit_implication: CreditImplication = CreditImplication.INSUFFICIENT


class CP6AICDebatePayload(CPModulePayloadBase):
    module_id: str = "CP-6A"
    module_name: str = "ICDebateChallenge"
    owned_object: str = "ic_debate_challenge"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP6ARuntimeOutput = Field(default_factory=CP6ARuntimeOutput)  # type: ignore[assignment]


# ── CP-3C PortfolioFitPositionSizing (owned_object: portfolio_fit_position_sizing) ─

class SizingEvidenceGate(BaseModel):
    portfolio_constraints: bool = False
    liquidity: bool = False
    mandate: bool = False
    rating: bool = False
    relative_value: bool = False


class ConstraintEntry(BaseModel):
    constraint: str
    status: str | None = None
    binding: bool = False


class CP3CRuntimeOutput(BaseModel):
    portfolio_fit: str = ""
    sizing_evidence_gate: SizingEvidenceGate = Field(default_factory=SizingEvidenceGate)
    sizing_posture: SizingPosture = SizingPosture.REQUIRES_MORE_WORK
    constraint_register: list[ConstraintEntry] = Field(default_factory=list)


class CP3CPortfolioFitPayload(CPModulePayloadBase):
    module_id: str = "CP-3C"
    module_name: str = "PortfolioFitPositionSizing"
    owned_object: str = "portfolio_fit_position_sizing"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP3CRuntimeOutput = Field(default_factory=CP3CRuntimeOutput)  # type: ignore[assignment]


# ── CP-3B RecoveryInstrumentPreference (owned_object: recovery_instrument_assessment) ─

class InstrumentRecovery(BaseModel):
    instrument_id: str
    instrument_type: str
    seniority_rank: int
    estimated_recovery_pct: float | None = None
    recovery_band: str | None = None  # 90_100 | 70_90 | ... | not_calculable
    structural_subordination_risk: str | None = None


class PreferredInstrument(BaseModel):
    instrument_id: str
    rationale: str = ""
    decision_posture: str = "insufficient_data"  # strong_conviction_buy | buy | ... | avoid | monitor


class CP3BRuntimeOutput(BaseModel):
    instrument_recovery_analysis: list[InstrumentRecovery] = Field(default_factory=list)
    recovery_ranking: list[dict] = Field(default_factory=list)
    preferred_instrument: PreferredInstrument | None = None
    narrative: str = ""


class CP3BRecoveryPayload(CPModulePayloadBase):
    module_id: str = "CP-3B"
    module_name: str = "RecoveryInstrumentPreference"
    owned_object: str = "recovery_instrument_assessment"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP3BRuntimeOutput = Field(default_factory=CP3BRuntimeOutput)  # type: ignore[assignment]


# ── CP-2C EventCatalystRegister (owned_object: event_catalyst_register) ─────

class EventEntry(BaseModel):
    event_id: str
    event_type: str  # m_and_a | refinancing | litigation | rating_action | ...
    description: str = ""
    probability_band: str | None = None  # high | moderate | low | speculative | not_assessable
    timing_horizon: str | None = None
    credit_direction: str | None = None  # positive | negative | neutral | mixed | uncertain
    severity: str | None = None  # critical | material | moderate | minor | informational


class CP2CRuntimeOutput(BaseModel):
    event_register: list[EventEntry] = Field(default_factory=list)
    overall_direction: str = "uncertain"  # net_positive | net_negative | balanced | uncertain
    narrative: str = ""


class CP2CEventCatalystPayload(CPModulePayloadBase):
    module_id: str = "CP-2C"
    module_name: str = "EventCatalystRegister"
    owned_object: str = "event_catalyst_register"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP2CRuntimeOutput = Field(default_factory=CP2CRuntimeOutput)  # type: ignore[assignment]


# ── CP-2D GovernanceSponsorScore (owned_object: governance_sponsor_score) ───

class CP2DRuntimeOutput(BaseModel):
    governance_score: dict = Field(default_factory=dict)
    sponsor_assessment: dict = Field(default_factory=dict)
    narrative: str = ""


class CP2DGovernancePayload(CPModulePayloadBase):
    module_id: str = "CP-2D"
    module_name: str = "GovernanceSponsorScore"
    owned_object: str = "governance_sponsor_score"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP2DRuntimeOutput = Field(default_factory=CP2DRuntimeOutput)  # type: ignore[assignment]


# ── CP-2F MacroFXHedgingSensitivity (owned_object: macro_fx_hedging_sensitivity) ─

class CP2FRuntimeOutput(BaseModel):
    macro_sensitivity: dict = Field(default_factory=dict)
    fx_exposure: dict = Field(default_factory=dict)
    hedging_assessment: dict = Field(default_factory=dict)
    narrative: str = ""


class CP2FMacroPayload(CPModulePayloadBase):
    module_id: str = "CP-2F"
    module_name: str = "MacroFXHedgingSensitivity"
    owned_object: str = "macro_fx_hedging_sensitivity"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CP2FRuntimeOutput = Field(default_factory=CP2FRuntimeOutput)  # type: ignore[assignment]


# ── L7 · CP-SR SectorReview (owned_object: sector_review) ───────────────────

class DimensionScore(BaseModel):
    dimension: str
    score: int | None = None  # 1–5
    rationale: str | None = None


class EarlyWarningIndicator(BaseModel):
    indicator: str
    status: str | None = None  # Red | Amber | Green
    value: str | None = None


class CPSRRuntimeOutput(BaseModel):
    executive_summary: str = ""
    sector_overview: str = ""
    key_credit_drivers: str = ""
    risk_assessment: str = ""
    comparative_table: list[dict] = Field(default_factory=list)
    early_warning_dashboard: list[EarlyWarningIndicator] = Field(default_factory=list)
    strategic_implications: str = ""
    sector_credit_posture: SectorCreditPosture = SectorCreditPosture.NEUTRAL
    posture_justification: str = ""
    dimension_scores: list[DimensionScore] = Field(default_factory=list)


class CPSRSectorReviewPayload(CPModulePayloadBase):
    module_id: str = "CP-SR"
    module_name: str = "SectorReview"
    owned_object: str = "sector_review"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    runtime_output: CPSRRuntimeOutput = Field(default_factory=CPSRRuntimeOutput)  # type: ignore[assignment]


# ── L7 · CP-MON CreditPulse (owned_object: signal_register) ─────────────────

class Signal(BaseModel):
    signal_id: str
    issuer_id: str
    issuer_name: str | None = None
    source_category: str  # an EmailCategory or other source authority
    raw_text: str = ""
    theme: str | None = None
    credit_implication_tags: list[str] = Field(default_factory=list)
    signal_type: str | None = None
    materiality_score: float | None = None  # 0–1
    temporal_tier: str | None = None
    alert_tier: AlertTier | None = None
    signal_date: str | None = None


class AlertNotification(BaseModel):
    issuer_id: str
    alert_tier: AlertTier
    summary: str = ""
    routed_to: list[str] = Field(default_factory=list)


class CPMONRuntimeOutput(BaseModel):
    signal_register: list[Signal] = Field(default_factory=list)
    alert_notifications: list[AlertNotification] = Field(default_factory=list)
    watchlist_heatmap: list[dict] = Field(default_factory=list)
    sector_digest: str = ""
    audit_log: list[dict] = Field(default_factory=list)


class CPMONCreditPulsePayload(CPModulePayloadBase):
    module_id: str = "CP-MON"
    module_name: str = "CreditPulse"
    owned_object: str = "signal_register"
    schema_family: SchemaFamily = SchemaFamily.NESTED
    confidence: Confidence = Confidence.INSUFFICIENT
    # CP-MON downstream consumers per the F5-pinned route-map contract.
    downstream_consumers: list[str] = Field(default_factory=lambda: ["CP-X", "CP-SR", "CP-1", "CP-3D"])
    runtime_output: CPMONRuntimeOutput = Field(default_factory=CPMONRuntimeOutput)  # type: ignore[assignment]


# ── Email-derived evidence metadata (REF_CP-EMAIL §8) ──────────────────────

class EmailMetadata(BaseModel):
    email_subject: str
    sender: str
    received_or_sent_date: str
    email_category: str
    source_tier: float
    issuer_refs: list[str] = Field(default_factory=list)
    sector_refs: list[str] = Field(default_factory=list)
    data_point: str = ""
    allowed_use: str = "Context"  # Evidence | Context | Trigger | Routing Signal
    staleness_rule: str = ""
    confidence: Confidence = Confidence.LOW
