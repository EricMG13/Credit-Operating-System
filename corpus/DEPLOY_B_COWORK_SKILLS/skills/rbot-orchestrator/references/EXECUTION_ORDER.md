<!-- Structure B progressive-disclosure companion for RBOT Orchestrator. Source: README/MODULE_EXECUTION_ORDER_v2.md. -->

# Module Execution Order

## Canonical Execution Order

| Order | Module | Name | Why It Runs Here |
|-------|--------|------|------------------|
| 0 | CP-PARSE | DataPreparation | Pre-source (L-1); triages mixed packs, adaptively parses selected documents and exports validated ZIP batch(es). Out-of-band; clean useful files may pass through to CP-0 |
| 1 | CP-0 | SourceReadiness | Entry point after CP-PARSE pre-processing; determines source sufficiency |
| 2 | CP-X | PlannerRouter | Routes to eligible modules after CP-0 |
| 3 | CP-1 | CanonicalDataFoundation | Financial base for most downstream modules |
| 4 | CP-1A | BusinessTransactionFactPack | Business and ownership facts; can run with CP-1 |
| 5 | CP-1B | EarningsDelta | Requires CP-1 canonical financials |
| 6 | CP-1C | PeerBenchmark | Requires CP-1 canonical financials |
| 7 | CP-2 | FundamentalCreditSynthesizer | Requires all L1 outputs |
| 8 | CP-2A | DownsidePathway | Requires CP-1, CP-1B, CP-2 |
| 9 | CP-2B | EventCatalystRegister | Requires CP-2 |
| 10 | CP-2C | GovernanceSponsorScore | Requires CP-1A and CP-2 |
| 11 | CP-2D | LiquidityCashFlowBridge | Requires CP-1 and CP-2 |
| 12 | CP-2E | MacroFXHedgingSensitivity | Requires CP-2 |
| 13 | CP-2F | ESGSustainabilityCreditRisk | L2 specialist after CP-2 when material |
| 14 | CP-2G | ForwardCreditModel | Requires canonical history and selected operating/liquidity drivers |
| 15 | CP-2H | RatingTransitionCase | Requires sourced agency evidence and preferably CP-2G cases |
| 16 | CP-3D | MarketImpliedRiskMap | Requires timestamped security/benchmark market evidence |
| 17 | CP-3 | RelativeValueSecuritySelection | Requires fundamental, peer, liquidity and market context |
| 18 | CP-3C | RefinancingLMERisk | Requires CP-1, CP-2A, CP-2D and benefits from CP-2G/CP-2H |
| 19 | CP-3A | RecoveryInstrumentPreference | Requires CP-3 and capital structure gates |
| 20 | CP-3B | PortfolioFitPositionSizing | Requires CP-3 |
| 21 | CP-4 | LegalCovenantInterpreter | Requires controlling documents and relevant credit context |
| 22 | CP-4B | RestrictedGroupGuaranteeMap | Requires entity, guarantee and collateral evidence |
| 23 | CP-4A | CovenantCapacityCalculator | Requires CP-4 definitions and CP-1 values |
| 24 | CP-4C | RestructuringScenario | Requires a sourced distress gate; otherwise Not Applicable |
| 25 | CP-5 | EvidenceTraceValidator | Requires module evidence traces |
| 26 | CP-5A | ResearchIntegrityQA | Requires CP-5 and module outputs |
| 27 | CP-6 | ICDebateChallenge | Requires the relevant available analytical feeds |
| 28 | CP-6A | PortfolioDebateChallenge | Requires CP-6 and allocation/recovery evidence as applicable |
| 29 | CP-DR | DeepResearch | User-scoped issuer/sector research; standalone; CP-0 optional; requires approved plan |
| 30 | CP-EMAIL | CreditIntelligenceClassifier | Standalone displayed digest; no dependency edge; manual follow-ups only |
| 31 | CP-8 | DecisionLedgerPostMortem | Terminal post-decision learning module |

## Why Order Matters

1. **Evidence integrity** — Downstream modules must not invent data that upstream modules have not produced.
2. **Calculation consistency** — CP-1 financial definitions propagate into all later calculations.
3. **Dependency enforcement** — Modules such as CP-3A and CP-2A have explicit gates and hard stops.
4. **QA traceability** — CP-5 and CP-5A require completed outputs to validate evidence and research integrity.
5. **Debate completeness** — CP-6 and CP-6A require upstream analytical perspectives before final recommendation.

## Parallel Execution Opportunities

| Parallel Set | Modules | Condition |
|--------------|---------|-----------|
| L1 base | CP-1 and CP-1A | Both can run after CP-0/CP-X |
| L1 follow-on | CP-1B and CP-1C | Both can run after CP-1 |
| L2 submodules | CP-2A, CP-2B, CP-2C, CP-2D, CP-2E, CP-2F | Run after CP-2 and their specific additional inputs |
| Forward and ratings | CP-2G then CP-2H | CP-2G cases precede rating-trigger headroom where used |
| L3 branches | CP-3, CP-3C and CP-3D | Run after respective inputs are complete; CP-3 consumes CP-3D when available |
| L3 follow-on | CP-3A and CP-3B | Run after CP-3 |

## Variations by Use Case

| Use Case | Recommended Execution |
|----------|-----------------------|
| Full new credit | Canonical order, all modules |
| Earnings update | CP-0 -> CP-1 -> CP-1B -> CP-2 -> CP-5 -> CP-5A |
| Covenant review | CP-0 -> CP-1 -> CP-3C -> CP-4 -> CP-4A |
| Portfolio sizing | CP-3 -> CP-3B -> CP-6A |
| IC memo only | CP-5 -> CP-5A -> CP-6, assuming upstream modules already exist |
| Distressed/LME review | CP-1 -> CP-2A + CP-2D -> CP-2G -> CP-2H + CP-3C + CP-3D -> CP-4 + CP-4B + CP-4A -> CP-4C -> CP-6 |

## Identifier Ordering

The table above is the canonical module sequence. `CP-PARSE`, `CP-DR`, and `CP-EMAIL` intentionally use descriptive IDs; `CP-8` is the terminal decision-learning module. Any intermediate suffix or numeric label absent from the table is intentionally unassigned, not a missing deployment file.


## Deep Research & Intelligence Execution Notes

CP-DR and CP-EMAIL sit outside the issuer-level L0–L6 pipeline and can be executed:
- **Independently** — CP-DR answers a scoped issuer or sector question without requiring the issuer pipeline.
- **As a displayed digest** — CP-EMAIL classifies accessible email/public news and run-local signals without requiring an upstream CP module.
- **In parallel** — independent CP-DR or CP-EMAIL runs can coexist with issuer analysis, but neither is a dependency edge.
- **As manual follow-up only** — CP-EMAIL may display a specialist, CP-X or CP-DR command; CP-DR may display a CP-EMAIL command. The user must invoke it separately; no trigger, packet or recursive run is created.

### Additional Parallel Execution Opportunities

| Parallel Set | Modules | Condition |
|---|---|---|
| Research & Intelligence | CP-DR and CP-EMAIL | Independent runs only; any cross-recommendation is a manual command |
| Research + Issuer Intake | CP-DR and CP-1 | CP-DR context may enrich CP-1 without replacing canonical extraction |
| Intelligence + Full Pipeline | CP-EMAIL alongside L1–L6 | Digest remains display-only and creates no canonical handoff or dependency edge |

### Additional Variations by Use Case

| Use Case | Recommended Execution |
|---|---|
| Issuer/sector deep research | CP-DR standalone; optionally route validated context onward through CP-X |
| Intelligence digest | `Run CP-EMAIL [qualifiers]`; user separately invokes any displayed CP-X/specialist follow-up |
| Research + portfolio allocation | CP-DR -> CP-5A -> CP-6 -> CP-6A, when in the approved scope |

### Descriptive and Reserved IDs

`CP-PARSE`, `CP-DR`, and `CP-EMAIL` are deliberate descriptive IDs. The retired CP-MON identity is compatibility/history only and rewrites through `MODULE_ID_ALIASES.md`; it is not a module or route node. Other historical IDs must be resolved using legacy ID plus matching module name or owned object; ID-only aliasing is prohibited where identities were reused.

---

## Specialist Module Insertions

These are first-class modules in the 32-module deployment.

| Layer | Module | Runs After | Before | Why It Runs There |
|-------|--------|-----------|--------|-------------------|
| L2 | CP-2F ESGSustainabilityCreditRisk | CP-2E (order 12) | CP-6 | L2 specialist branching from CP-2; joins the CP-2x parallel set |
| L2 | CP-2G ForwardCreditModel | CP-1 plus relevant L2 drivers | CP-2H / L3 | Multi-period base/upside/downside credit trajectories |
| L2 | CP-2H RatingTransitionCase | CP-2G and agency evidence | L3 / CP-6 | Agency-trigger headroom and migration pressure, not a shadow rating |
| L3 | CP-3D MarketImpliedRiskMap | CP-2/CP-2G/CP-2H plus market observations | CP-3 / CP-6 | Timestamped market-implied risk and technical dislocation |
| L4 | CP-4B RestrictedGroupGuaranteeMap | CP-4 (order 17) | CP-4A / CP-6 | Consumes CP-4 covenant findings; builds the structural-priority map for CP-6 (and CP-3A by reference) |
| L4 | CP-4C RestructuringScenario | CP-2G/CP-3C/CP-4/CP-4B and distress gate | CP-6 / CP-6A | Restructuring paths, fulcrum range and class recoveries |
| L8 (new) | CP-8 DecisionLedgerPostMortem | CP-6A (order 22) | terminal | Post-decision ledger; calibration feedback is advisory and out-of-band |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-18 | Initial execution order (22 modules) |
| 2.0 | 2026-06-08 | Added CP-DR (order 23), CP-MON (order 24), sector/monitoring execution notes, new parallel sets and use case variations |
| 2.5 | 2026-07-21 | Integrated CP-2G, CP-2H, CP-3D and CP-4C and promoted the full 32-module order |
| 2.6 | 2026-07-22 | Replaced the former CP-MON module with standalone CP-EMAIL; removed trigger/packet/dependency claims and made follow-ups manual only |
