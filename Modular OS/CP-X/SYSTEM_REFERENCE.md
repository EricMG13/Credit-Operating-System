<!-- CP-X System Reference (T4) | 2026-06-03 -->

## Identity
module_id: CP-X | module_name: PlannerRouter | schema_family: Nested | layer: Orch

## Dependencies
UP: CP-0 | DOWN (Analytical): CP-1, CP-1A, CP-1B, CP-1C, CP-2, CP-2B, CP-2C, CP-2D, CP-2E, CP-2F, CP-3, CP-3B, CP-3C, CP-3D, CP-4, CP-4C, CP-6A, CP-6E | DOWN (Infra): CP-5B, CP-5, CP-RENDER, CP-EXTRACT

## Governance Rules
1. CP-X routes by CP-0 content-based readiness — never by filename or assumption.
2. One-owner-per-object is enforced per CP_GLOBAL_AGENT_INSTRUCTIONS_v3.2 SEC2; conflict = VE-009 (OWNERSHIP_VIOLATION), conflicting module excluded.
3. CP-X does not perform credit analysis, legal interpretation, RV assessment, or portfolio sizing — routing and governance enforcement only.
4. All CP-0 limitations (Conditional / Not Usable) must be propagated to every downstream module in the dependency chain.
5. CP-X consumes only CP-0 output and CP_ROUTING_INDEX_v2.2 — no source documents, financial data, or analytical module outputs.

## Input Sources (2)
1. CP-0 output (readiness assessment, source registry, per-module readiness verdicts)
2. CP_ROUTING_INDEX_v2.2 (authoritative ownership registry: module → owned_object mapping)

## Module Readiness Status Values (3)
Full Run | Ready with Limitations | Blocked

## Source Dependencies Met Values (3)
Yes | Partial | No

## Conflict Detection
- VE-009: OWNERSHIP_VIOLATION — two modules claim the same owned_object → exclude conflicting module

## Layer Ordering (execution precedence)
L0 → Orch → L1 → L2 → L3 → L4 → L5/L6 → Infrastructure
CP-5B before CP-5 | CP-6A before CP-6E | Infrastructure after all analytical modules

## Route Graph — All Modules
| Module ID | Module Name | Layer |
|-----------|------------|-------|
| CP-0 | SourceReadiness | L0 |
| CP-X | PlannerRouter | Orch |
| CP-1 | FinancialDataFoundation | L1 |
| CP-1A | BusinessTransactionSummary | L1 |
| CP-1B | EarningsPerformanceUpdate | L1 |
| CP-1C | PeerBenchmark | L1 |
| CP-2 | FundamentalCreditReview | L2 |
| CP-2B | DownsidePathwayAnalysis | L2 |
| CP-2C | EventCatalystRegister | L2 |
| CP-2D | SponsorGovernanceReview | L2 |
| CP-2E | LiquidityMaturityAnalysis | L2 |
| CP-2F | MacroSectorOverlay | L2 |
| CP-3 | RelativeValueAnalysis | L3 |
| CP-3B | CapitalStructureMap | L3 |
| CP-3C | PortfolioFitAnalysis | L3 |
| CP-3D | TradingLiquidityAnalysis | L3 |
| CP-4 | LegalCovenantReview | L4 |
| CP-4C | RecoveryAnalysis | L4 |
| CP-6A | ICDebateChallenge | L6 |
| CP-6E | PortfolioDebateChallenge | L6 |

## Fail/Restrict
- **Blocked:** CP-0 unavailable or critically incomplete → CP-X Status = Blocked, STOP. No route_plan produced.
- **Ready with Limitations:** CP-0 available but some sources flagged Conditional or Not Usable → proceed with limitation propagation.
- **Ownership Conflict:** VE-009 detected → exclude conflicting module, flag violation, continue with remaining modules.

## Version: 2026-06-03
