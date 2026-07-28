# CP module ID alias register v1.2

Effective 2026-07-22. New runs use only the canonical ID. Several old IDs are now assigned to another module, so historical artifacts must be resolved by legacy ID plus matching module name or owned object. ID-only alias resolution is prohibited; ambiguity blocks the handoff. CP-0A is the legacy SourceReadiness identity and resolves to canonical CP-0. CP-MON is a compatibility command only and owns no active object.

| Legacy ID | Legacy module name | Owned object | Canonical ID |
|---|---|---|---|
| CP-00 | DataPreparation | `document_parse_manifest` | CP-PARSE |
| CP-0A | SourceReadiness | `source_readiness_register` | CP-0 |
| CP-0B | PlannerRouter | `route_plan` | CP-X |
| CP-2B | DownsidePathway | `downside_pathway` | CP-2A |
| CP-2C | EventCatalystRegister | `event_catalyst_register` | CP-2B |
| CP-2D | GovernanceSponsorScore | `governance_sponsor_score` | CP-2C |
| CP-2E | LiquidityCashFlowBridge | `liquidity_cash_flow_bridge` | CP-2D |
| CP-2F | MacroFXHedgingSensitivity | `macro_fx_hedging_sensitivity` | CP-2E |
| CP-2G | ESGSustainabilityCreditRisk | `esg_credit_risk` | CP-2F |
| CP-2H | ForwardCreditModel | `forward_credit_model` | CP-2G |
| CP-2R | RatingTransitionCase | `rating_transition_case` | CP-2H |
| CP-3B | RecoveryInstrumentPreference | `recovery_instrument_assessment` | CP-3A |
| CP-3C | PortfolioFitPositionSizing | `portfolio_fit_position_sizing` | CP-3B |
| CP-3D | RefinancingLMERisk | `refinancing_lme_risk` | CP-3C |
| CP-3E | MarketImpliedRiskMap | `market_implied_risk_map` | CP-3D |
| CP-4C | CovenantCapacityCalculator | `covenant_capacity_calculation` | CP-4A |
| CP-4D | RestrictedGroupGuaranteeMap | `structural_priority_map` | CP-4B |
| CP-4E | RestructuringScenario | `restructuring_scenario` | CP-4C |
| CP-5B | EvidenceTraceValidator | `evidence_trace_validation` | CP-5 |
| CP-5 | ResearchIntegrityQA | `qa_result` | CP-5A |
| CP-6A | ICDebateChallenge | `ic_debate_challenge` | CP-6 |
| CP-6E | PortfolioDebateChallenge | `portfolio_debate_challenge` | CP-6A |
| CP-7 | DecisionLedgerPostMortem | `decision_ledger` | CP-8 |
| CP-MON | CreditPulse | `issuer_signal_register` | CP-EMAIL |

## CP-MON compatibility command

`Run CP-MON` rewrites exactly to `Run CP-EMAIL [mode: Monitoring] [minimum level: WATCH]`.

The response begins: `CP-MON is retired; this command is running CP-EMAIL in compatibility Monitoring mode.` CP-MON is not an active module, route node or owner; `issuer_signal_register` is predecessor/history context only. CP-EMAIL owns `intelligence_digest`.

## Migration sequencing

`MODULE_ID_MIGRATION_CP0_20260722.json` remains byte-frozen. `MODULE_ID_MIGRATION_CP_MON_TO_CP_EMAIL_20260722.json` is the authoritative correction: CP-MON was retained during the CP-0 rename and retired later as a separate change.

CP-DR remains unchanged. The deployment-level orchestrator is `RBOT-ORCHESTRATOR` and is not a CP analytical module.
