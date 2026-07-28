<!-- CP-4 Schema Reference (T3) | 2026-06-03 -->

## Required Output Sections (14)
All 14 sections must be present. If source materials do not support analysis, the section must still appear with [Insufficient Information] and a gap ledger entry.

## Required Tables (7)
| ID | Table Name | Key Columns |
|----|-----------|-------------|
| T4.2 | Controlling Document Register | Authority Rank, Document, Document Type, Version / Date, Status, Governing Role, Credit Relevance, Evidence ID |
| T4.3 | Covenant Feature Register | Topic, Provision Summary, Source / Clause, Risk Mechanic, Credit Implication, Market Norm Assessment, Evidence ID |
| T4.9 | PD vs LGD / Recovery Translation | Legal Topic, Supported Fact, Risk Mechanic, PD Effect, LGD / Recovery Effect, Monitoring Implication, Evidence ID |
| T4.10 | Market Norm Comparison | Topic, Issuer Provision, Market / Third-Party Reference, Relative Assessment, Agreement / Discrepancy, Credit Implication, Evidence ID |
| T4.11 | Covenant Aggressiveness Score | Area, Score 1–5, Evidence, Risk Mechanic, Credit Implication, Confidence, Evidence ID |
| T4.12 | Red Flags and Monitoring Triggers | Red Flag / Trigger, Provision or Signal, Why It Matters, PD / LGD / RV Impact, Monitoring Action, Evidence ID |
| T4.13 | Gaps Ledger | Gap, Missing Document / Clause / Schedule, Why It Matters, Impact on Output, Required Follow-Up |

## Provision-Level Analysis Sections (5 — Standard Finding Format)
| Step | Section | Format |
|------|---------|--------|
| 4 | EBITDA, Definitions, and Ratio Mechanics | Standard Finding Format: Provision → Source → Summary → Risk Mechanic → PD Effect → LGD/Recovery Effect → Monitoring Implication → Credit Implication → Confidence → Evidence ID |
| 5 | Debt Incurrence, Incremental Facilities, and MFN | Standard Finding Format |
| 6 | Leakage, Restricted Payments, Investments, and Asset Transfers | Standard Finding Format |
| 7 | Collateral, Guarantees, and Structural Subordination | Standard Finding Format |
| 8 | Events of Default, Remedies, and Amendment Risk | Standard Finding Format |

## QA Checklist
- [ ] All 14 output sections present and populated (or marked [Insufficient Information] with gap logged)
- [ ] Every covenant finding includes: provision text, source trace, interpretation, aggressiveness score, credit implication, and legal-review dependency status
- [ ] All aggressiveness scores (1–5) are justified with specific criteria from Covenant Aggressiveness Rubric
- [ ] Composite aggressiveness score calculated from scored dimensions only
- [ ] Every credit implication uses one of the 8 canonical CP-4 values
- [ ] All legal conclusions distinguish contractual provision from analyst interpretation
- [ ] Legal-review dependencies flagged where governing documents are unavailable or analysis is based on summary materials only
- [ ] Source gate status documented (Completed / Completed with Limitations / Blocked) with reasons
- [ ] All gaps logged in Gaps Ledger with affected downstream modules
- [ ] Numeric Confidence Score (0–100) + band computed per `CP_CONFIDENCE_SCORE.md` and placed in the Audit Summary before the narrative
- [ ] Canonical Markdown validates and completes the run; each requested DOCX/PDF view passes view-appropriate parity; one export failure does not invalidate Markdown or a successful sibling view; single Audit Appendix (no lettered A–E, no JSON blocks, no export manifest)
- [ ] Content distinctions maintained: Documentary Fact | Analyst Interpretation | Market Comparison | PD Effect | LGD/Recovery Effect | Monitoring Implication
- [ ] Source authority hierarchy applied: executed docs outrank drafts, summaries, term sheets
- [ ] No fabricated covenant terms, baskets, thresholds, or legal conclusions
- [ ] Vague labels (aggressive, loose, flexible, etc.) not used without provision-level evidence
- [ ] Market-norm commentary only where comparative source exists

## Export

Canonical Markdown is the required analytical output and downstream handoff. Author and validate it first. Create an editable DOCX, a visually rich PDF, or both only when requested; verify each view independently. A failed optional view does not invalidate valid Markdown or a successful sibling export.

**Output order: (1) author complete canonical Markdown; (2) validate contract and identity, fail closed; (3) create requested DOCX and/or visual PDF views independently; (4) return concise status, limitations, and links actually created.**
