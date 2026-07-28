"""Identity-locked visual profile registry for every deployable CP module."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ProfileState(str, Enum):
    UNSUPPORTED = "unsupported"
    BETA = "beta"
    PRODUCTION = "production"


class VisualArchetype(str, Enum):
    CONTROL = "control-and-assurance"
    FINANCIAL = "financial-and-quantitative"
    FUNDAMENTAL = "fundamental-and-event"
    SECURITY = "security-legal-and-recovery"
    DECISION = "decision-and-learning"
    DISPLAY_ONLY = "display-only"


@dataclass(frozen=True)
class TableSpec:
    role: str
    stable_id: str
    heading: str
    required: bool = True


@dataclass(frozen=True)
class VisualProfile:
    module_id: str
    module_name: str
    archetype: VisualArchetype
    state: ProfileState
    renderer_key: str
    accent_hex: str
    kicker: str
    story_title: str
    story_subtitle: str
    tables: tuple[TableSpec, ...] = ()
    pdf_enabled: bool = True
    special_gate: str | None = None
    typical_page_budget: int = 5
    stress_page_budget: int = 8

    @property
    def required_table_ids(self) -> tuple[str, ...]:
        return tuple(table.stable_id for table in self.tables if table.required)


def table(role: str, stable_id: str, heading: str, *, required: bool = True) -> TableSpec:
    return TableSpec(role, stable_id, heading, required)


def profile(
    module_id: str,
    module_name: str,
    archetype: VisualArchetype,
    renderer_key: str,
    accent_hex: str,
    kicker: str,
    story_title: str,
    story_subtitle: str,
    *tables: TableSpec,
    state: ProfileState = ProfileState.PRODUCTION,
    pdf_enabled: bool = True,
    special_gate: str | None = None,
    typical_page_budget: int = 5,
    stress_page_budget: int = 8,
) -> VisualProfile:
    return VisualProfile(
        module_id=module_id,
        module_name=module_name,
        archetype=archetype,
        state=state,
        renderer_key=renderer_key,
        accent_hex=accent_hex,
        kicker=kicker,
        story_title=story_title,
        story_subtitle=story_subtitle,
        tables=tables,
        pdf_enabled=pdf_enabled,
        special_gate=special_gate,
        typical_page_budget=typical_page_budget,
        stress_page_budget=stress_page_budget,
    )


PROFILES: dict[str, VisualProfile] = {
    # Control and assurance
    "CP-PARSE": profile(
        "CP-PARSE",
        "DataPreparation",
        VisualArchetype.CONTROL,
        "control",
        "#087C78",
        "Package control",
        "Document-pack coverage and fidelity",
        "Triage, parsing, fidelity, and packaging states remain exactly as recorded.",
        table("pack_inventory", "cpparse.pack_inventory", "Pack inventory"),
        table("triage_register", "cpparse.triage_register", "Triage register"),
        table("fidelity_status", "cpparse.fidelity_status", "Fidelity status"),
        special_gate="package-overview-only; preserve ZIP verification",
        typical_page_budget=5,
        stress_page_budget=9,
    ),
    "CP-0": profile(
        "CP-0",
        "SourceReadiness",
        VisualArchetype.CONTROL,
        "control",
        "#087C78",
        "Readiness control tower",
        "Source quality, coverage, and blockers",
        "Readiness states and downstream coverage are presentation-only views of the canonical register.",
        table("readiness_summary", "cp0.readiness_summary", "Readiness summary"),
        table("source_register", "cp0.source_register", "Source register"),
        table("routing_recommendation", "cp0.routing_recommendation", "Routing recommendation"),
    ),
    "CP-X": profile(
        "CP-X",
        "PlannerRouter",
        VisualArchetype.CONTROL,
        "control",
        "#6752C9",
        "Execution map",
        "Dependency order, readiness, and ownership",
        "The route view preserves canonical dependencies, blockers, and limitation propagation.",
        table("route_plan", "cpx.route_plan", "Route plan"),
        table("readiness_register", "cpx.readiness_register", "Readiness register"),
        table("limitation_propagation", "cpx.limitation_propagation", "Limitation propagation"),
        typical_page_budget=6,
        stress_page_budget=10,
    ),
    "CP-5": profile(
        "CP-5",
        "EvidenceTraceValidator",
        VisualArchetype.CONTROL,
        "control",
        "#AD3744",
        "Traceability report",
        "Claim coverage, lineage, and weak evidence",
        "Coverage and lineage views retain every claim and evidence status from Markdown.",
        table("coverage_summary", "cp5.coverage_summary", "Coverage summary"),
        table("claim_lineage", "cp5.claim_lineage", "Claim lineage"),
        table("weak_claims", "cp5.weak_claims", "Weak and orphan claims"),
    ),
    "CP-5A": profile(
        "CP-5A",
        "ResearchIntegrityQA",
        VisualArchetype.CONTROL,
        "cp5a",
        "#AD3744",
        "Research integrity",
        "Clearance, findings, and remediation",
        "Severity, status, and clearance implications remain controlled canonical values.",
        table("clearance_summary", "cp5a.clearance_summary", "Clearance summary"),
        table("audit_lanes", "cp5a.audit_lanes", "Audit lane results"),
        table("findings_register", "cp5a.findings_register", "Findings register"),
        table("retest_status", "cp5a.retest_status", "Retest status"),
        state=ProfileState.PRODUCTION,
        typical_page_budget=4,
        stress_page_budget=7,
    ),
    # Financial and quantitative
    "CP-1": profile(
        "CP-1",
        "CanonicalDataFoundation",
        VisualArchetype.FINANCIAL,
        "cp1",
        "#2F6BFF",
        "Financial profile",
        "Credit-relevant financial snapshot",
        "Reported values and calculated metrics retain their canonical bases and definitions.",
        table("core_financials", "cp1.core_financials", "Core financials"),
        table("derived_metrics", "cp1.derived_metrics", "Derived metrics"),
        state=ProfileState.PRODUCTION,
        typical_page_budget=4,
        stress_page_budget=7,
    ),
    "CP-1B": profile(
        "CP-1B",
        "EarningsDelta",
        VisualArchetype.FINANCIAL,
        "financial",
        "#2F6BFF",
        "Earnings pulse",
        "Performance deltas, bridges, and monitoring",
        "Current/prior values, deltas, guidance, and catalysts retain their source periods and bases.",
        table("delta_summary", "cp1b.delta_summary", "Delta summary"),
        table("financial_performance", "cp1b.financial_performance", "Financial performance"),
        table("monitoring_signals", "cp1b.monitoring_signals", "Monitoring signals"),
    ),
    "CP-1C": profile(
        "CP-1C",
        "PeerBenchmark",
        VisualArchetype.FINANCIAL,
        "financial",
        "#2F6BFF",
        "Peer position",
        "Issuer position, distribution, and outliers",
        "Every comparison retains cohort size, metric definition, and comparability limits.",
        table("peer_universe", "cp1c.peer_universe", "Peer universe"),
        table("peer_metrics", "cp1c.peer_metrics", "Peer metrics"),
        table("outliers", "cp1c.outliers", "Outliers"),
    ),
    "CP-2D": profile(
        "CP-2D",
        "LiquidityCashFlowBridge",
        VisualArchetype.FINANCIAL,
        "cp2d",
        "#087C78",
        "Liquidity runway",
        "Runway, cash uses, and pressure points",
        "The bridge preserves opening liquidity, operating generation, uses, and minimum-cash constraints.",
        table("liquidity_snapshot", "cp2d.liquidity_snapshot", "Liquidity snapshot"),
        table("liquidity_bridge", "cp2d.liquidity_bridge", "Twelve-month liquidity bridge"),
        table("quarterly_runway", "cp2d.quarterly_runway", "Quarterly runway"),
        state=ProfileState.PRODUCTION,
        typical_page_budget=4,
        stress_page_budget=7,
    ),
    "CP-2E": profile(
        "CP-2E",
        "MacroFXHedgingSensitivity",
        VisualArchetype.FINANCIAL,
        "financial",
        "#087C78",
        "Exposure and hedge",
        "Rate, FX, commodity, and inflation sensitivity",
        "Exposure, hedge, and sensitivity values retain their units, dates, and stated assumptions.",
        table("exposure_summary", "cp2e.exposure_summary", "Exposure summary"),
        table("hedge_register", "cp2e.hedge_register", "Hedge register"),
        table("sensitivities", "cp2e.sensitivities", "Sensitivities"),
    ),
    "CP-2G": profile(
        "CP-2G",
        "ForwardCreditModel",
        VisualArchetype.FINANCIAL,
        "financial",
        "#087C78",
        "Forward outlook",
        "Scenario trajectories and breakpoints",
        "Historical, forecast, and assumption states remain visibly distinct and numerically unchanged.",
        table("scenario_forecast", "cp2g.scenario_forecast", "Scenario forecast"),
        table("metric_trajectories", "cp2g.metric_trajectories", "Metric trajectories"),
        table("breakpoints", "cp2g.breakpoints", "Breakpoints"),
    ),
    "CP-2H": profile(
        "CP-2H",
        "RatingTransitionCase",
        VisualArchetype.FINANCIAL,
        "financial",
        "#6752C9",
        "Ratings transition",
        "Trigger headroom and migration paths",
        "Agency evidence, triggers, cases, and notching remain attributed and source-bound.",
        table("trigger_headroom", "cp2h.trigger_headroom", "Trigger headroom"),
        table("migration_cases", "cp2h.migration_cases", "Migration cases"),
        table("agency_divergence", "cp2h.agency_divergence", "Agency divergence"),
    ),
    "CP-3D": profile(
        "CP-3D",
        "MarketImpliedRiskMap",
        VisualArchetype.FINANCIAL,
        "financial",
        "#2F6BFF",
        "Market signals",
        "Curve, peer context, and implied risk",
        "Prices, spreads, timestamps, and conventions remain exactly as observed.",
        table("market_observations", "cp3d.market_observations", "Market observations"),
        table("issuer_curve", "cp3d.issuer_curve", "Issuer curve"),
        table("peer_context", "cp3d.peer_context", "Peer context"),
    ),
    # Fundamental and event
    "CP-1A": profile(
        "CP-1A",
        "BusinessTransactionFactPack",
        VisualArchetype.FUNDAMENTAL,
        "fundamental",
        "#2F6BFF",
        "Issuer and transaction",
        "Deal facts, ownership, and timeline",
        "The profile distinguishes sourced transaction facts from stated credit translations.",
        table("transaction_snapshot", "cp1a.transaction_snapshot", "Transaction snapshot"),
        table("ownership_structure", "cp1a.ownership_structure", "Ownership structure"),
        table("transaction_timeline", "cp1a.transaction_timeline", "Transaction timeline"),
    ),
    "CP-2": profile(
        "CP-2",
        "FundamentalCreditSynthesizer",
        VisualArchetype.FUNDAMENTAL,
        "fundamental",
        "#2F6BFF",
        "Credit thesis",
        "Drivers, vulnerabilities, and monitoring",
        "Driver rankings and evidence chains remain tied to the integrated canonical credit profile.",
        table("credit_profile", "cp2.credit_profile", "Credit profile"),
        table("dimension_scores", "cp2.dimension_scores", "Dimension scores"),
        table("monitoring_dashboard", "cp2.monitoring_dashboard", "Monitoring dashboard"),
    ),
    "CP-2A": profile(
        "CP-2A",
        "DownsidePathway",
        VisualArchetype.FUNDAMENTAL,
        "fundamental",
        "#AD3744",
        "Downside mechanics",
        "Stress transmission, sensitivities, and breakpoints",
        "Causal paths use only canonical links and preserve leading/lagging distinctions.",
        table("stress_pathways", "cp2a.stress_pathways", "Stress pathways"),
        table("sensitivities", "cp2a.sensitivities", "Sensitivities"),
        table("monitoring_indicators", "cp2a.monitoring_indicators", "Monitoring indicators"),
    ),
    "CP-2B": profile(
        "CP-2B",
        "EventCatalystRegister",
        VisualArchetype.FUNDAMENTAL,
        "cp2b",
        "#2F6BFF",
        "Catalyst calendar",
        "Dated events, priority, and monitoring",
        "Timing, probability, impact, direction, and status remain canonical values.",
        table("catalyst_summary", "cp2b.catalyst_summary", "Catalyst summary"),
        table("catalyst_register", "cp2b.catalyst_register", "Catalyst register"),
        table("monitoring_actions", "cp2b.monitoring_actions", "Monitoring actions"),
        state=ProfileState.PRODUCTION,
        typical_page_budget=4,
        stress_page_budget=7,
    ),
    "CP-2C": profile(
        "CP-2C",
        "GovernanceSponsorScore",
        VisualArchetype.FUNDAMENTAL,
        "fundamental",
        "#6752C9",
        "Governance risk",
        "Control, behaviour, and disclosure",
        "Ownership, behaviour, and dimension scores remain evidence-bound and time-stamped.",
        table("ownership_control", "cp2c.ownership_control", "Ownership and control"),
        table("governance_scores", "cp2c.governance_scores", "Governance scores"),
        table("behaviour_timeline", "cp2c.behaviour_timeline", "Behaviour timeline"),
    ),
    "CP-2F": profile(
        "CP-2F",
        "ESGSustainabilityCreditRisk",
        VisualArchetype.FUNDAMENTAL,
        "fundamental",
        "#167B55",
        "Materiality-led ESG",
        "Credit materiality and financing access",
        "The report remains deliberately short when the canonical assessment is immaterial.",
        table("materiality_assessment", "cp2f.materiality_assessment", "Materiality assessment"),
        table("sustainability_terms", "cp2f.sustainability_terms", "Sustainability terms"),
        table("financing_implications", "cp2f.financing_implications", "Financing implications"),
        typical_page_budget=4,
        stress_page_budget=7,
    ),
    "CP-DR": profile(
        "CP-DR",
        "DeepResearch",
        VisualArchetype.FUNDAMENTAL,
        "fundamental",
        "#6752C9",
        "Research dossier",
        "Answer, evidence coverage, and contradictions",
        "Issuer and sector scopes use the same evidence-bound presentation contract.",
        table("research_answer", "cpdr.research_answer", "Research answer"),
        table("evidence_coverage", "cpdr.evidence_coverage", "Evidence coverage"),
        table("contradiction_matrix", "cpdr.contradiction_matrix", "Contradiction matrix"),
        special_gate="support issuer and sector scope identities",
        typical_page_budget=6,
        stress_page_budget=10,
    ),
    # Security, legal, and recovery
    "CP-3": profile(
        "CP-3",
        "RelativeValueSecuritySelection",
        VisualArchetype.SECURITY,
        "security",
        "#2F6BFF",
        "Relative value",
        "Risk, compensation, and security ranking",
        "Recommendations retain instrument identity, market timestamp, and canonical compensation measures.",
        table("recommendation", "cp3.recommendation", "Recommendation"),
        table("security_scorecards", "cp3.security_scorecards", "Security scorecards"),
        table("peer_curve_context", "cp3.peer_curve_context", "Peer and curve context"),
    ),
    "CP-3A": profile(
        "CP-3A",
        "RecoveryInstrumentPreference",
        VisualArchetype.SECURITY,
        "security",
        "#6752C9",
        "Recovery and preference",
        "Priority, waterfall, and compensation",
        "Claims, recoveries, and preferences preserve canonical assumptions and sensitivity cases.",
        table("capital_structure", "cp3a.capital_structure", "Capital structure"),
        table("recovery_waterfall", "cp3a.recovery_waterfall", "Recovery waterfall"),
        table("instrument_comparison", "cp3a.instrument_comparison", "Instrument comparison"),
    ),
    "CP-3B": profile(
        "CP-3B",
        "PortfolioFitPositionSizing",
        VisualArchetype.SECURITY,
        "security",
        "#087C78",
        "Portfolio implementation",
        "Sizing, constraints, and exit liquidity",
        "Sizing posture and constraint headroom remain tied to the canonical mandate and risk budget.",
        table("sizing_decision", "cp3b.sizing_decision", "Sizing decision"),
        table("constraint_headroom", "cp3b.constraint_headroom", "Constraint headroom"),
        table("concentration", "cp3b.concentration", "Concentration"),
    ),
    "CP-3C": profile(
        "CP-3C",
        "RefinancingLMERisk",
        VisualArchetype.SECURITY,
        "security",
        "#AD3744",
        "Refinancing and LME",
        "Maturity wall, paths, and creditor vulnerability",
        "Path and vulnerability views preserve legal capacity, willingness, and creditor-class exposure.",
        table("maturity_wall", "cp3c.maturity_wall", "Maturity wall"),
        table("path_comparison", "cp3c.path_comparison", "Path comparison"),
        table("vulnerability", "cp3c.vulnerability", "Vulnerability"),
        typical_page_budget=6,
        stress_page_budget=10,
    ),
    "CP-4": profile(
        "CP-4",
        "LegalCovenantInterpreter",
        VisualArchetype.SECURITY,
        "security",
        "#6752C9",
        "Covenant architecture",
        "Authority, provisions, and creditor effects",
        "Exact provisions and citations remain adjacent to each interpreted canonical finding.",
        table("source_authority", "cp4.source_authority", "Source authority"),
        table("covenant_register", "cp4.covenant_register", "Covenant register"),
        table("provision_findings", "cp4.provision_findings", "Provision findings"),
        typical_page_budget=6,
        stress_page_budget=10,
    ),
    "CP-4A": profile(
        "CP-4A",
        "CovenantCapacityCalculator",
        VisualArchetype.SECURITY,
        "security",
        "#6752C9",
        "Capacity and headroom",
        "Formulas, capacity, and pressure points",
        "Every headroom value remains paired with its canonical formula, definition, and assumptions.",
        table("capacity_summary", "cp4a.capacity_summary", "Capacity summary"),
        table("formula_inputs", "cp4a.formula_inputs", "Formula inputs"),
        table("pressure_points", "cp4a.pressure_points", "Pressure points"),
        typical_page_budget=6,
        stress_page_budget=10,
    ),
    "CP-4B": profile(
        "CP-4B",
        "RestrictedGroupGuaranteeMap",
        VisualArchetype.SECURITY,
        "cp4b",
        "#6752C9",
        "Structural priority",
        "Where value sits and which claims reach it",
        "Entity, guarantee, collateral, and leakage relationships use only explicit canonical links.",
        table("entity_perimeter", "cp4b.entity_perimeter", "Entity perimeter"),
        table("guarantor_coverage", "cp4b.guarantor_coverage", "Guarantor coverage"),
        table("structural_priority", "cp4b.structural_priority", "Structural priority"),
        table("leakage_routes", "cp4b.leakage_routes", "Leakage routes"),
        state=ProfileState.PRODUCTION,
        typical_page_budget=6,
        stress_page_budget=10,
    ),
    "CP-4C": profile(
        "CP-4C",
        "RestructuringScenario",
        VisualArchetype.SECURITY,
        "security",
        "#AD3744",
        "Restructuring outcomes",
        "Paths, fulcrum, and class recoveries",
        "Claims, enterprise values, priorities, and recoveries retain their canonical cases and units.",
        table("claims_reconciliation", "cp4c.claims_reconciliation", "Claims reconciliation"),
        table("path_comparison", "cp4c.path_comparison", "Path comparison"),
        table("recovery_by_class", "cp4c.recovery_by_class", "Recovery by class"),
        typical_page_budget=7,
        stress_page_budget=11,
    ),
    # Decision and learning
    "CP-6": profile(
        "CP-6",
        "ICDebateChallenge",
        VisualArchetype.DECISION,
        "cp6",
        "#A96500",
        "Investment committee decision",
        "Evidence weighting and resolution",
        "Bull, Bear, Chair, and action-bias values remain exactly as adjudicated.",
        table("bull_opening", "cp6.bull_opening", "Bull opening"),
        table("bear_cross_examination", "cp6.bear_cross_examination", "Bear cross-examination"),
        table("evidence_weighting", "cp6.evidence_weighting", "Evidence weighting"),
        table("resolution_matrix", "cp6.resolution_matrix", "Resolution matrix"),
        table("decision_summary", "cp6.decision_summary", "Decision summary"),
        state=ProfileState.PRODUCTION,
        typical_page_budget=6,
        stress_page_budget=9,
    ),
    "CP-6A": profile(
        "CP-6A",
        "PortfolioDebateChallenge",
        VisualArchetype.DECISION,
        "decision",
        "#A96500",
        "Portfolio decision",
        "Relative value, compliance, and binding constraint",
        "CIO scoring, posture, and residual risks remain canonical controlled values.",
        table("cio_scoring", "cp6a.cio_scoring", "CIO scoring"),
        table("decision_matrix", "cp6a.decision_matrix", "Decision matrix"),
        table("final_posture", "cp6a.final_posture", "Final posture"),
    ),
    "CP-8": profile(
        "CP-8",
        "DecisionLedgerPostMortem",
        VisualArchetype.DECISION,
        "decision",
        "#A96500",
        "Decision learning",
        "Expected versus realised outcomes",
        "Attribution separates process quality from outcome and retains pattern-gating limitations.",
        table("original_decision", "cp8.original_decision", "Original decision"),
        table("outcome_variance", "cp8.outcome_variance", "Outcome variance"),
        table("attribution", "cp8.attribution", "Attribution"),
    ),
    # Identity-locked display-only exception
    "CP-EMAIL": profile(
        "CP-EMAIL",
        "CreditIntelligenceClassifier",
        VisualArchetype.DISPLAY_ONLY,
        "none",
        "#596779",
        "Display-only digest",
        "No PDF",
        "CP-EMAIL creates no artifact.",
        state=ProfileState.PRODUCTION,
        pdf_enabled=False,
        special_gate="identity-locked DISPLAY_DIGEST; no Markdown, DOCX, or PDF",
        typical_page_budget=0,
        stress_page_budget=0,
    ),
}


EXPECTED_MODULES = frozenset(
    {
        "CP-PARSE", "CP-0", "CP-X", "CP-1", "CP-1A", "CP-1B", "CP-1C",
        "CP-2", "CP-2A", "CP-2B", "CP-2C", "CP-2D", "CP-2E", "CP-2F",
        "CP-2G", "CP-2H", "CP-3", "CP-3A", "CP-3B", "CP-3C", "CP-3D",
        "CP-4", "CP-4A", "CP-4B", "CP-4C", "CP-5", "CP-5A", "CP-6",
        "CP-6A", "CP-8", "CP-DR", "CP-EMAIL",
    }
)

if frozenset(PROFILES) != EXPECTED_MODULES:
    missing = sorted(EXPECTED_MODULES - PROFILES.keys())
    extra = sorted(PROFILES.keys() - EXPECTED_MODULES)
    raise RuntimeError(f"visual profile registry drift: missing={missing} extra={extra}")

if sum(profile.pdf_enabled for profile in PROFILES.values()) != 31:
    raise RuntimeError("visual profile registry must expose exactly 31 PDF-eligible modules")


def get_profile(module_id: str) -> VisualProfile:
    try:
        return PROFILES[module_id]
    except KeyError as error:
        raise ValueError(f"unknown CP module identity: {module_id}") from error
