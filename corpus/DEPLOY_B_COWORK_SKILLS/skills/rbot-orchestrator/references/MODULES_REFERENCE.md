<!-- Structure B progressive-disclosure companion for RBOT Orchestrator. Source: README/MODULES_REFERENCE_v2.md. -->

# Modules Reference

> **Artifact model.** There is no separate renderer/parser agent or database; the deterministic renderer tool is preferred (CP-RENDER, CP-EXTRACT, and CP-DB have been removed). Each module authors canonical Markdown first and produces requested DOCX view only as its validated projection: requested DOCX view a report `.docx` (professional Word report — Audit Summary and a numeric Confidence Score at the top, analysis narrative projected from canonical Markdown, and one Audit Appendix containing all audit items); and canonical Markdown a handoff `.md` (YAML envelope plus canonical headings — the agent-to-agent handoff, attached as grounding to the next module, with no parser). Confidence is a numeric score 0–100 (with a High / Medium / Low / Insufficient Information band for back-compat). See `CP_AB_EXPORT_SPEC.md` and `CP_CONFIDENCE_SCORE.md`. The legacy export model is gone: no five lettered appendices (A–E), no six canonical JSON blocks, no export manifest, no extraction envelope, no JSONL.

## L-1 — Data Preparation

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-PARSE DataPreparation | Triage mixed source packs, select full/targeted/pass-through/skip decisions, adapt parsing to filings, lender/investor presentations, legal/transaction documents and schedules, and preserve locators/tables/charts/clauses. Out-of-band pre-step (not CP-X-routed) | Accessible PDF, DOCX, PPTX, XLSX/CSV, HTML/TXT and scan/image sources; single files or packs | Validated ZIP batch(es) containing per-source canonical Markdown plus requested DOCX/PDF exports, triage and batch indexes, and checksums; pass-through originals remain unchanged | Upstream: none. Downstream: CP-0 |

## L0 — Source Readiness

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-0 SourceReadiness | Assess source quality and readiness before analysis begins | Selected source documents, CP-PARSE ZIP/Markdown/DOCX outputs and unchanged pass-through originals | Source readiness assessment, source quality labels, routing recommendation, source gaps | Upstream: CP-PARSE when used. Downstream: CP-X |

## Orchestration

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-X PlannerRouter | Route user requests and CP-0 readiness results to the correct modules | CP-0 readiness output, user workflow objective | Route plan, module activation plan, blocked-module list | Upstream: CP-0. Downstream: all analytical modules |

## L1 — Data Foundation

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-1 CanonicalDataFoundation | Normalise financial statements into canonical financial data and KPIs | Financial statements. Example: FY2024/FY2023 income statement, balance sheet, cash flow statement | Canonical financials, KPI dashboard, calculation register, downstream readiness | Upstream: CP-0/CP-X. Downstream: CP-1B, CP-1C, CP-2, CP-2A, CP-2D, CP-2G, CP-2H, CP-3, CP-3C, CP-3D, CP-4, CP-4A |
| CP-1A BusinessTransactionFactPack | Extract business, transaction, ownership, and operating-model facts | Offering memorandum, prospectus, company filings. Example: sponsor acquisition memorandum | Transaction summary, company description, ownership/sponsor register, credit translation summary | Upstream: CP-0/CP-X. Downstream: CP-2, CP-2C |
| CP-1B EarningsDelta | Compare current vs prior period performance | CP-1 canonical financials for at least two periods | Multi-period financial performance table (19 required line items), delta summary, monitoring signals | Upstream: CP-1. Downstream: CP-2, CP-2A |
| CP-1C PeerBenchmark | Compare issuer to peers using 15 core formulas and 6-level peer hierarchy | CP-1 canonical data plus peer company data | Peer selection register, metric comparison, outlier analysis | Upstream: CP-1. Downstream: CP-2, CP-3 |

## L2 — Fundamental Credit Synthesis

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-2 FundamentalCreditSynthesizer | Produce integrated 21-section credit synthesis | CP-1, CP-1A, CP-1B, CP-1C outputs | Credit mechanism map, 9-dimension financial profile, committee memo, credit implications | Upstream: CP-1, CP-1A, CP-1B, CP-1C. Downstream: CP-2A, CP-2B, CP-2C, CP-2D, CP-2E, CP-3, CP-6 |
| CP-2A DownsidePathway | Model stress transmission from operating drivers to credit consequences | CP-1, CP-1B, CP-2 outputs | Causal chains, pathway register, sensitivity matrix, 8 fragility groups, 11 pathway labels | Upstream: CP-1, CP-1B, CP-2. Downstream: CP-3C, CP-6 |
| CP-2B EventCatalystRegister | Identify event catalysts and trigger events | CP-2 output | Catalyst register with timing and credit implications | Upstream: CP-2. Downstream: CP-6 |
| CP-2C GovernanceSponsorScore | Assess governance quality and sponsor / management strength | CP-1A and CP-2 outputs | Governance score, sponsor assessment | Upstream: CP-1A, CP-2. Downstream: CP-6 |
| CP-2D LiquidityCashFlowBridge | Build liquidity assessment and cash-flow bridge | CP-1 and CP-2 outputs | Cash-flow bridge, liquidity assessment | Upstream: CP-1, CP-2. Downstream: CP-3, CP-3C, CP-6 |
| CP-2E MacroFXHedgingSensitivity | Assess macro sensitivity, FX exposure, and hedging | CP-2 output plus any FX / hedging disclosures | Macro sensitivity, FX exposure, hedging assessment | Upstream: CP-2. Downstream: CP-6 |
| CP-2F ESGSustainabilityCreditRisk | Translate material ESG and sustainability factors into credit mechanisms | CP-1, CP-1A, CP-2 and relevant disclosures/terms | Materiality and transition-risk registers; SLL mechanics | Upstream: CP-1, CP-1A, CP-2. Downstream: CP-6 |
| CP-2G ForwardCreditModel | Build auditable multi-period base, upside and downside credit trajectories | CP-1 canonical history plus relevant CP-2/CP-2A/CP-2D/CP-2E drivers and labelled assumptions | Earnings, FCF, debt, liquidity, leverage, coverage and breakpoint paths | Upstream: CP-1 and selected L2 drivers. Downstream: CP-2H, CP-3, CP-3C, CP-3D, CP-4C, CP-6 |
| CP-2H RatingTransitionCase | Map sourced agency ratings, methodologies and issuer triggers against forecast cases | Current agency evidence, criteria, metric bridges and preferably CP-2G | Trigger-headroom matrix, migration pressure and agency divergence; no formal/shadow rating | Upstream: CP-1, CP-2, CP-2G and agency sources. Downstream: CP-2B, CP-3, CP-3C, CP-3D, CP-6 |

## L3 — Valuation, Portfolio, and Refinancing

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-3 RelativeValueSecuritySelection | Analyse spread, relative value, and security selection | CP-1, CP-1C, CP-2, CP-2D outputs plus market pricing | RV analysis, spread analysis, security selection | Upstream: CP-1, CP-1C, CP-2, CP-2D. Downstream: CP-3A, CP-3B, CP-6, CP-6A |
| CP-3A RecoveryInstrumentPreference | Build recovery waterfall and LGD estimates | CP-3 output; capital structure with seniority/subordination | Recovery waterfall, instrument preference, LGD estimates | Upstream: CP-3. Downstream: CP-6 |
| CP-3B PortfolioFitPositionSizing | Assess portfolio fit and size recommendation | CP-3 output plus portfolio constraints | Portfolio fit, sizing posture, 5-input evidence gate, constraint register | Upstream: CP-3. Downstream: CP-6A |
| CP-3C RefinancingLMERisk | Assess refinancing risk, LME risk, and maturity wall | CP-1, CP-2A, CP-2D outputs | Refinancing risk register, LME risk register, maturity wall, 7 path types | Upstream: CP-1, CP-2A, CP-2D. Downstream: CP-4, CP-6 |
| CP-3D MarketImpliedRiskMap | Explain what timestamped prices/spreads imply and distinguish liquidity/technical dislocation | Security identity, quote convention, timestamp, benchmark and market evidence; fundamental/forecast context | Issuer curve, break-even risk calculations, liquidity/technical register and fundamental-market gap | Upstream: CP-1, CP-2, CP-2G, CP-2H and market observations. Downstream: CP-3, CP-3A, CP-3B, CP-4C, CP-6 |

## L4 — Legal and Covenant

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-4 LegalCovenantInterpreter | Interpret legal covenants, covenant aggressiveness, and legal/covenant credit implications | CP-1, CP-3C outputs plus credit agreement or indenture | 12 required covenant tables, legal covenant interpretation, aggressiveness rubric | Upstream: CP-1, CP-3C. Downstream: CP-4A, CP-6 |
| CP-4A CovenantCapacityCalculator | Calculate covenant capacity and headroom | CP-4 and CP-1 outputs | Covenant capacity calculations, headroom analysis; each calculation requires formula, numerator, denominator, period, source trace, normalisation | Upstream: CP-4, CP-1. Downstream: CP-6, CP-6A |
| CP-4B RestrictedGroupGuaranteeMap | Build legal-entity claim topology and structural-priority map | CP-1 debt-by-entity, CP-1A ownership facts, CP-4 findings, guarantor/collateral evidence | Entity perimeter, guarantee/collateral and structural-priority registers | Upstream: CP-1, CP-1A, CP-4. Downstream: CP-4A, CP-4C, CP-6 |
| CP-4C RestructuringScenario | Compare restructuring paths and estimate fulcrum/class recoveries after a sourced distress gate | Jurisdiction/process evidence, CP-2G, CP-3C, CP-4/4D, claims and valuation assumptions | Path comparison, claims reconciliation, EV bridge, waterfall, fulcrum range and recoveries | Upstream: CP-2A, CP-2D, CP-2G, CP-3C, CP-3D, CP-4, CP-4A, CP-4B. Downstream: CP-6, CP-6A |

## L5 — Quality Assurance

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-5 EvidenceTraceValidator | Validate evidence lineage and identify orphan claims | Handoff .md (and report .docx) Audit Appendix from all analytical modules | Lineage validation using 8-value taxonomy, orphan claim register | Upstream: all analytical modules. Downstream: CP-5A |
| CP-5A ResearchIntegrityQA | Audit research integrity and gate module outputs | All analytical outputs plus CP-5 trace validation | QA audit across 8 lanes, severity classification, qa_status: Blocked / Restricted / Passed | Upstream: all analytical modules, CP-5. Downstream: gates upstream outputs |

## L6 — Debate and Decision

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-6 ICDebateChallenge | Run adversarial IC debate and determine action bias | CP-2, CP-2A, CP-2B, CP-2C, CP-2D, CP-2E, CP-3, CP-3A, CP-3C, CP-4, CP-4A | IC action bias, debate resolution matrix, final memo, single greatest uncertainty | Upstream: 11 analytical modules. Downstream: CP-6A |
| CP-6A PortfolioDebateChallenge | Run portfolio debate and determine final portfolio posture | CP-3, CP-3B, CP-4A, CP-6 | Portfolio posture, CIO memo, 9-dimension CIO scoring, binding constraint | Upstream: CP-3, CP-3B, CP-4A, CP-6. Downstream: terminal |

## L7 — Deep Research & Intelligence

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-DR DeepResearch | Answer one user-defined issuer or sector question through an approved plan, web/internal research, claim-evidence ledger, contradiction testing and bounded synthesis | Required research brief; web capability for web/hybrid; CP-0 source map optional | Research dossier, claim-evidence ledger, source/conflict registers and stop reason; may display a manual CP-EMAIL recommendation | Optional input: CP-0/user sources. Analytical handoffs: CP-X, CP-1, CP-2, CP-5A, CP-6, CP-6A. A CP-EMAIL recommendation is manual and creates no edge. |
| CP-EMAIL CreditIntelligenceClassifier | Aggregate accessible email/public news, resolve and cluster stories, classify run-local credit signals and display one ranked digest | Explicit/conversational scope plus runtime-accessible mailbox/web evidence; no upstream CP module required | Displayed `intelligence_digest` with coverage, ranked story cards, limitations and manual follow-up commands; no file or canonical handoff | Standalone with no dependency edge. CP-X, specialist and CP-DR follow-ups require separate user invocation. |

## Additional Modules (promoted)

These modules are first-class members of the 32-module deployment. Their detailed rows above or below are authoritative.

| Module | Purpose | Required Inputs | Outputs | Dependencies |
|--------|---------|-----------------|---------|--------------|
| CP-4B RestrictedGroupGuaranteeMap | Own the structural-priority map: restricted/unrestricted entity perimeter, guarantee & security packages, structural subordination, asset-leakage (drop-down/trapdoor) and uptier/priming exposure | CP-1 debt-by-entity, CP-1A ownership facts, CP-4 covenant findings, org chart, guarantor/collateral schedules (SEC Ex-21/10.x/4.x) | Entity perimeter register, guarantor coverage matrix, collateral-by-entity matrix, structural priority table, leakage-route register, trapdoor/uptier findings | Upstream: CP-1, CP-1A, CP-4. Downstream: CP-4A, CP-6 (map referenced by CP-3A) |
| CP-2F ESGSustainabilityCreditRisk | Materiality-gated ESG/transition credit risk + sustainability-linked-debt (KPI/SPT/margin-ratchet) mechanics; governance/sponsor conduct stays with CP-2C | CP-1, CP-1A, CP-2 outputs, issuer ESG/transition disclosures, sustainability-linked debt terms | Transition risk register, materiality table, KPI/SPT/ratchet table, ESG credit implication table | Upstream: CP-1, CP-1A, CP-2. Downstream: CP-6 |
| CP-8 DecisionLedgerPostMortem | Close the feedback loop: capture IC decision + thesis, track realized vs expected, attribute (process vs outcome), emit pattern-gated advisory calibration | CP-6 action bias, CP-6A posture, independently sourced realized events and original thesis records; a CP-EMAIL digest is an optional lead only | Decision ledger, realized-outcome log, variance & attribution tables, calibration register (advisory), track-record dashboard | Upstream: CP-6, CP-6A. Downstream: CP-1C/CP-2/CP-3A (advisory, non-binding) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-18 | Initial modules reference (22 analytical modules + 3 infrastructure) |
| 2.0 | 2026-06-08 | Added sector review and CP-MON; CP-DR DeepResearch superseded sector review on 2026-07-21 |
| 2.1 (proposed) | 2026-06-22 | Added proposed modules CP-4B (L4), CP-2F (L2), CP-8 (new L8) under _PROPOSED/ |
| 2.5 | 2026-07-21 | Added CP-2G, CP-2H, CP-3D and CP-4C and updated dependencies for 32 deployable modules. |
| 2.6 | 2026-07-22 | Replaced the former CP-MON module with standalone CP-EMAIL; removed monitoring trigger/dependency claims |
