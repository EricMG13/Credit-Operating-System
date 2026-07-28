<!-- CP-5A Schema Reference (T3) | 2026-06-26 | Phase 1: requested DOCX view+canonical Markdown export; numeric confidence_score; handoff-envelope audit -->

## Required Output Sections (11)
All 11 sections must be present using exact required headings.

## Required Tables (9)
| ID | Table Name | Key Columns |
|----|-----------|-------------|
| T5.1 | Input Module Register | Module, Handoff canonical `.md` / run_id, Scope, Source Quality, Envelope / Headings Status, QA Status, Notes |
| T5.2 | Citation and Evidence Support Audit | Severity, Module, Claim / Section, Evidence Status, Issue, Required Fix, Clearance Impact |
| T5.3 | Math / Logic / Definition Audit | Severity, Module, Metric / Logic Issue, Formula / Definition Issue, Source Conflict, Required Fix, Clearance Impact |
| T5.4 | Legal / Structural Claim Audit | Severity, Module, Legal / Structural Claim, Required Legal Source, Evidence Gap, Required Fix, Legal Review Dependency |
| T5.5 | Relative Value / Market Claim Audit | Severity, Module, Market / RV Claim, Missing Datapoint, Evidence Gap, Required Fix, Committee Impact |
| T5.6 | Cross-Module Consistency and Version-Control Audit | Severity, Affected Modules, Data / Claim Conflict, Version Issue, Required Fix, Downstream Impact |
| T5.7 | Duplication / Materiality / Committee-Readiness Audit | Severity, Module, Issue Type, Description, Required Fix, Committee Impact |
| T5.8 | Handoff Envelope and Evidence Trace Audit | Severity, Module, Handoff Component, Defect, Required Fix, Downstream Handoff Impact |
| T5.9 | Issue Log | Issue ID, Severity, Module, Issue Type, Description, Required Fix, Clearance Impact, Status |

## Narrative Sections (2)
| Step | Section | Format |
|------|---------|--------|
| 10 | Remediation Priority Map | 4 prioritized groups: must-fix before committee, must-fix before canonical Markdown handoff is consumed downstream, monitoring follow-up, formatting/hygiene |
| 11 | Clearance Decision | Required format: "CLEARANCE DECISION: [Pass / Pass with Remediation / Fail]. Critical Issues: [N]. Material Issues: [N]. Minor Issues: [N]. Committee Use: [Approved / Restricted / Blocked]." |

## QA Checklist
- [ ] All 11 output sections present using exact required headings
- [ ] All severity values use ONLY: CRITICAL / MATERIAL / MINOR (no other scale)
- [ ] All evidence classifications use ONLY: Supported / Partially Supported / Unsupported / Conflicting / Insufficient Information
- [ ] All defect categories use ONLY the 23 permitted values
- [ ] All clearance impact labels use ONLY the 9 permitted values
- [ ] Every Issue Log entry has sequential Issue ID (CP5-NNN format)
- [ ] Every finding states: what is wrong, why it matters, what fix is required, whether output can be used before correction
- [ ] Severity Escalation Rules applied correctly (Critical/Material/Minor triggers verified)
- [ ] Remediation Priority Map groups all issues into exactly 4 tiers
- [ ] Clearance Decision uses exact required format
- [ ] Clearance Decision is consistent with Severity Engine (Critical → Fail/Blocked, Material → Pass with Remediation/Restricted, Minor → Pass/Approved)
- [ ] No silent rewriting of underlying module analysis
- [ ] Exact source filenames quoted when making QA findings (NATIVE CITATIONS)
- [ ] Canonical `[IssuerID]_CP-5A_[YYYYMMDD].md` is valid, using exact front-matter `issuer_id` and `analysis_date` without hyphens; each requested DOCX/PDF export exists, has the matching filename, and passes view-appropriate parity
- [ ] requested DOCX view order: Header → Audit Summary + numeric Confidence Score (0–100) + band before narrative → 11 analysis sections → single Audit Appendix
- [ ] canonical Markdown envelope carries confidence_score + confidence_band + qa_status; canonical H2 headings present (## Audit Summary, ## Analysis, ## Evidence Trace, ## Source Registry, ## Gaps & Conflicts, ## QA Validation)
- [ ] Confidence Score computed per CP_CONFIDENCE_SCORE.md (hard caps applied; band derived)
- [ ] No lettered appendices (A–E), no embedded JSON blocks, no export manifest, no extraction envelope
- [ ] Required headings match the requested DOCX view+canonical Markdown structure exactly

## Export

Canonical Markdown is the required analytical output and downstream handoff. Author and validate it first. Create an editable DOCX, a visually rich PDF, or both only when requested; verify each view independently. A failed optional view does not invalidate valid Markdown or a successful sibling export.

**Output order: (1) author complete canonical Markdown; (2) validate contract and identity, fail closed; (3) create requested DOCX and/or visual PDF views independently; (4) return concise status, limitations, and links actually created.**
