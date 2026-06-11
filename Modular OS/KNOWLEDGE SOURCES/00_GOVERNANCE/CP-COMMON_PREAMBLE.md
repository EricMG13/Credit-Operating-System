<!-- CP-COMMON PREAMBLE v3.3 | 2026-06-08 | Audit F-2: module_manifest re-synced to v2 Canonical taxonomy; L7 + infra added; Feeds:TBD resolved -->
<cp_common_preamble version="v3.3">
<priority_legend>
| Priority | Meaning | On Violation |
|----------|---------|--------------|
| critical | Must be satisfied | Output rejection |
| standard | Expected | QA flag + review |
| reference | As needed | No flag |
</priority_legend>
<module_manifest>
<!-- v2 Canonical taxonomy. Roles = module_name per MODULES_REFERENCE_v2. Feeds = downstream edges per SYSTEM_ROUTE_MAP_v2. -->
| Module | Layer | Role (module_name) | Feeds |
|--------|-------|--------------------|-------|
| CP-0 | L0 | SourceReadiness | CP-X |
| CP-X | LX | PlannerRouter | All analytical |
| CP-1 | L1 | CanonicalDataFoundation | CP-1B, CP-1C, CP-2, CP-2B, CP-2E, CP-3, CP-3D, CP-4, CP-4C |
| CP-1A | L1 | BusinessTransactionFactPack | CP-2, CP-2D |
| CP-1B | L1 | EarningsDelta | CP-2, CP-2B |
| CP-1C | L1 | PeerBenchmark | CP-2, CP-3 |
| CP-2 | L2 | FundamentalCreditSynthesizer | CP-2B, CP-2C, CP-2D, CP-2E, CP-2F, CP-3, CP-6A |
| CP-2B | L2 | DownsidePathway | CP-3D, CP-6A |
| CP-2C | L2 | EventCatalystRegister | CP-6A |
| CP-2D | L2 | GovernanceSponsorScore | CP-6A |
| CP-2E | L2 | LiquidityCashFlowBridge | CP-3, CP-3D, CP-6A |
| CP-2F | L2 | MacroFXHedgingSensitivity | CP-6A |
| CP-3 | L3 | RelativeValueSecuritySelection | CP-3B, CP-3C, CP-6A, CP-6E |
| CP-3B | L3 | RecoveryInstrumentPreference | CP-6A |
| CP-3C | L3 | PortfolioFitPositionSizing | CP-6E |
| CP-3D | L3 | RefinancingLMERisk | CP-4, CP-6A |
| CP-4 | L4 | LegalCovenantInterpreter | CP-4C, CP-6A |
| CP-4C | L4 | CovenantCapacityCalculator | CP-6A, CP-6E |
| CP-5B | L5 | EvidenceTraceValidator | CP-5 |
| CP-5 | L5 | ResearchIntegrityQA | Gates upstream outputs |
| CP-6A | L6 | ICDebateChallenge | CP-6E |
| CP-6E | L6 | PortfolioDebateChallenge | Terminal |
| CP-SR | L7 | SectorReview | CP-5, CP-6A, CP-6E, CP-MON |
| CP-MON | L7 | CreditPulse | CP-X, CP-SR, CP-1, CP-3D |
| CP-RENDER | Infra | Report Renderer | Reports |
| CP-EXTRACT | Infra | Appendix Parser | CP-DB |
| CP-DB | Infra | Structured Store | — |
</module_manifest>
<common_rules priority="critical" enforcement="hard">
1. Source boundary enforcement 2. Evidence>Risk Mechanic>Credit Implication chain
3. [Insufficient Information] marking 4. Not Calculable from Provided Materials
5. Null != zero unless sourced 6. Preserve evidence/QA/downstream metadata
7. No silent QA repair 8. Renderer anti-fabrication 9. No fabrication
</common_rules>
<export_contract priority="critical">
Single .docx: sections + Appendix A-E (HANDOFF, EVIDENCE+SOURCE, QA, MANIFEST, GAPS).
Filename: [Issuer]_[Module]_[YYYYMMDD].docx. All 5 appendices required.
</export_contract>
<common_envelope>
module_id | run_id | issuer_name | issuer_id_or_key | reporting_period |
source_documents_used | upstream_artifacts_used | key_claims |
key_credit_mechanisms | evidence_trace | confidence_level | limitation_flags |
qa_status | validation_warnings | downstream_consumers | module_payload
</common_envelope>
</cp_common_preamble>
