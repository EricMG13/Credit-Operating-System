"""
Pydantic schemas for all CP-X agent outputs.
These are the enforced JSON contracts that LangGraph nodes must produce.
CP-5 validates all outputs against these schemas.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


# ─── Shared ───────────────────────────────────────────────────────────────

class EvidenceChain(BaseModel):
    """CP-5B lineage entry: required on every material conclusion."""
    evidence: str = Field(..., description="Verbatim source excerpt or document reference")
    source_doc: str = Field(..., description="Document name and page/section")
    risk_mechanic: str = Field(..., description="How this evidence creates credit risk")
    credit_implication: str = Field(..., description="Impact on credit quality/rating")


class MaterialConclusion(BaseModel):
    label: str
    value: str
    evidence_chain: list[EvidenceChain]


class BaseAgentOutput(BaseModel):
    module_id: str
    issuer_id: str
    fiscal_period: str
    has_inferred_metrics: bool = False  # Must be False — CP-5 blocks if True
    material_conclusions: list[MaterialConclusion] = Field(default_factory=list)


# ─── CP-0: Readiness ──────────────────────────────────────────────────────

class CP0ReadinessOutput(BaseAgentOutput):
    module_id: Literal["CP-0"] = "CP-0"
    run_type: Literal["FULL_RUN", "DELTA_RUN"]
    canonical_docs_present: list[str]
    missing_docs: list[str]
    verdict: Literal["READY", "BLOCKED"]
    blocking_reason: str | None = None


# ─── CP-1: Capital Structure ───────────────────────────────────────────────

class DebtTranche(BaseModel):
    name: str
    type: str  # 'TLB' | 'TLA' | 'RCF' | 'SSN' | 'SUB' | etc.
    amount_mm: Decimal
    currency: str = "USD"
    maturity: str
    rate: str
    seniority_rank: int
    lien_position: int


class CP1CapitalStructureOutput(BaseAgentOutput):
    module_id: Literal["CP-1"] = "CP-1"
    total_debt_mm: Decimal
    tranches: list[DebtTranche]
    total_equity_mm: Decimal | None = None
    enterprise_value_mm: Decimal | None = None


# ─── CP-1A: Debt Waterfall ─────────────────────────────────────────────────

class WaterfallStep(BaseModel):
    rank: int
    instrument: str
    claim_mm: Decimal
    recovery_scenario_base: Decimal | None = None  # %
    recovery_scenario_stress: Decimal | None = None


class CP1ADebtWaterfallOutput(BaseAgentOutput):
    module_id: Literal["CP-1A"] = "CP-1A"
    waterfall_steps: list[WaterfallStep]
    total_claims_mm: Decimal
    blended_recovery_base: Decimal | None = None


# ─── CP-1B: Earnings Update (Delta Run) ───────────────────────────────────

class CP1BEarningsUpdateOutput(BaseAgentOutput):
    module_id: Literal["CP-1B"] = "CP-1B"
    revenue_mm: Decimal
    ebitda_mm: Decimal
    ebitda_margin_pct: Decimal
    net_leverage_x: Decimal
    fcf_mm: Decimal
    vs_prior_period_commentary: str


# ─── CP-2: Fundamentals ───────────────────────────────────────────────────

class FinancialPeriod(BaseModel):
    period: str
    revenue_mm: Decimal
    ebitda_mm: Decimal
    ebitda_margin_pct: Decimal
    net_leverage_x: Decimal
    interest_coverage_x: Decimal
    fcf_mm: Decimal
    capex_mm: Decimal | None = None


class CP2FundamentalsOutput(BaseAgentOutput):
    module_id: Literal["CP-2"] = "CP-2"
    historical_periods: list[FinancialPeriod]
    ltm_period: FinancialPeriod
    business_description: str
    key_revenue_drivers: list[str]
    key_cost_drivers: list[str]


# ─── CP-3: Relative Value ─────────────────────────────────────────────────

class Comparable(BaseModel):
    issuer_name: str
    instrument: str
    net_leverage_x: Decimal
    spread_bps: Decimal
    ytw_pct: Decimal
    rating: str | None = None


class CP3RelativeValueOutput(BaseAgentOutput):
    module_id: Literal["CP-3"] = "CP-3"
    subject_spread_bps: Decimal
    subject_ytw_pct: Decimal
    comparables: list[Comparable]
    rv_commentary: str
    fair_value_verdict: Literal["CHEAP", "FAIR", "RICH"]


# ─── CP-4: Covenant Interpreter ───────────────────────────────────────────

class Covenant(BaseModel):
    name: str
    covenant_type: Literal["MAINTENANCE", "INCURRENCE", "NEGATIVE_PLEDGE", "OTHER"]
    limit_description: str
    limit_value: Decimal | None = None
    test_frequency: str | None = None
    source_section: str


class CP4CovenantOutput(BaseAgentOutput):
    module_id: Literal["CP-4"] = "CP-4"
    covenants: list[Covenant]
    restricted_payments_basket_mm: Decimal | None = None
    debt_incurrence_capacity_mm: Decimal | None = None
    restricted_payment_capacity_mm: Decimal | None = None
    key_risks: list[str]


# ─── CP-4C: Capacity Headroom ─────────────────────────────────────────────

class CovenantHeadroom(BaseModel):
    covenant_name: str
    limit_value: Decimal
    actual_value: Decimal
    headroom_pct: Decimal
    severity: Literal["OK", "WARNING", "CRITICAL"]  # WARNING >75%, CRITICAL >90%


class CP4CCapacityOutput(BaseAgentOutput):
    module_id: Literal["CP-4C"] = "CP-4C"
    headroom_items: list[CovenantHeadroom]
    liquidity_runway_months: Decimal | None = None
    rcf_availability_mm: Decimal | None = None


# ─── CP-5: Integrity QA Report ────────────────────────────────────────────
# (See core/severity_engine.py for runtime; this schema is for persistence)

class CP5IntegrityOutput(BaseAgentOutput):
    module_id: Literal["CP-5"] = "CP-5"
    target_module_id: str
    overall_severity: Literal["PASS", "WARNING", "CRITICAL"]
    findings: list[dict[str, Any]]
    blocked: bool
    blocked_reason: str | None = None


# ─── CP-6E: Portfolio Debate ──────────────────────────────────────────────

class DebateAgent(BaseModel):
    persona: Literal["RV_TRADER", "COMPLIANCE", "CIO"]
    posture: Literal["BUY", "HOLD", "SELL", "AVOID"]
    conviction: int = Field(..., ge=1, le=5, description="1=Low, 5=High")
    thesis: str
    key_risks: list[str]
    key_supports: list[str]


class CP6EDebateOutput(BaseAgentOutput):
    module_id: Literal["CP-6E"] = "CP-6E"
    debate_agents: list[DebateAgent]
    consensus_posture: Literal["BUY", "HOLD", "SELL", "AVOID", "SPLIT"]
    composite_score: int = Field(..., ge=1, le=100)
    final_recommendation: str
