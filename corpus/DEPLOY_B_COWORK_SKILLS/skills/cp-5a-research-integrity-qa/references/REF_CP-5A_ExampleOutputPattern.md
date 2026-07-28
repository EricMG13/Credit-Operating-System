<!-- REF_CP-5A_ExampleOutputPattern.md (T2 Example Library) | 2026-06-26 | Ported from Agent Files: CP-5A__SUPPORT__EXAMPLE_OUTPUT.txt; Phase 1: added Audit Summary + numeric Confidence Score example -->


================================================================================
FILE: CP-5A__SUPPORT__EXAMPLE_OUTPUT.txt
MODULE: CP-5A — ResearchIntegrityQA
STATUS: UPDATED (vNext)
MECHANICAL CHANGES APPLIED: MC-1, MC-2, MC-3, MC-5
GOVERNING CONTRACT: CP_GLOBAL_AGENT_INSTRUCTIONS_v3.2.txt
PURPOSE: Example QA output format for CP-5A findings.
================================================================================

EXAMPLE_OUTPUT_FORMAT

Purpose: Provide standard formatting templates for CP-5A QA findings,
consolidated issue log entries, remediation map entries, and clearance
decisions. All examples are illustrative only — do not use as issuer data.

1. Example Citation and Evidence Support Audit Entry

| Severity | Module | Claim / Section | Evidence Status | Issue | Required Fix | Clearance Impact |
|---|---|---|---|---|---|---|
| Critical | CP-2 | "LTM EBITDA margin of 28% demonstrates resilient operating model" (Section 4) | Partially Supported | Source (Lender Presentation, p.12) reports 28% but includes €15m of non-recurring cost savings add-back. Adjusted margin without add-back is ~24%. Claim overstates margin by 4pp without disclosure. | Restate margin with and without add-back; disclose adjustment basis; cite specific add-back components. | Blocks Committee Use |

2. Example Math / Logic / Definition Audit Entry

| Severity | Module | Metric / Logic Issue | Formula / Definition Issue | Source Conflict | Required Fix | Clearance Impact |
|---|---|---|---|---|---|---|
| Material | CP-4A | Maintenance leverage headroom stated as 1.2x | CP-4A uses reported EBITDA (€150m) as denominator; covenant definition requires Consolidated EBITDA including permitted add-backs. CP-1B reports Consolidated EBITDA of €165m. | CP-1B vs CP-4A denominator mismatch | Recalculate headroom using covenant EBITDA definition; reconcile with CP-1B; disclose definition used. | Restricts Committee Use |

3. Example Consolidated Issue Log Entry

| Issue ID | Severity | Module | Issue Type | Description | Required Fix | Clearance Impact | Status |
|---|---|---|---|---|---|---|---|
| CP5-001 | Critical | CP-2 | Unsupported Claim | EBITDA margin claim overstated by ~4pp due to undisclosed add-back | Restate with add-back disclosure | Blocks Committee Use | Open |
| CP5-002 | Material | CP-4A | Calculation Error | Headroom uses wrong EBITDA definition | Recalculate using covenant EBITDA | Restricts Committee Use | Open |
| CP5-003 | Minor | CP-3 | Duplicative Content | RV summary paragraph repeated in Sections 3 and 7 | Remove duplicate | Formatting / Hygiene Only | Open |

4. Example Remediation Priority Map

Must-fix before committee:
- CP5-001: Restate CP-2 EBITDA margin with add-back disclosure.

Must-fix before canonical Markdown handoff is consumed downstream:
- CP5-002: Recalculate CP-4A headroom using covenant EBITDA definition.

Monitoring follow-up:
- None.

Formatting / hygiene:
- CP5-003: Remove duplicated RV summary paragraph.

5. Example Audit Summary + Confidence Score (top of requested DOCX view, before the narrative)

Confidence Score: 35 / 100  (Band: Insufficient Information)
qa_status: Blocked | committee_status: Prohibited
Summary: 1 Critical (CP-2 EBITDA margin overstatement), 1 Material (CP-4A
headroom definition mismatch), 1 Minor. Critical defect changes the credit
conclusion → hard cap applies (score ≤ 39, Blocked). Score below the High band
— see the Audit Appendix for the full gap ledger, evidence trace, and QA
validation findings.
(Score per CP_CONFIDENCE_SCORE.md: clamp((0.6·E + 0.4·C)·S − P, 0, 100), then
the unresolved-Critical hard cap.)

6. Example Clearance Decision

CLEARANCE DECISION: Fail. Critical Issues: 1. Material Issues: 1. Minor
Issues: 1. Committee Use: Blocked.

The output is blocked from committee use due to one Critical issue (CP5-001:
EBITDA margin overstatement in CP-2) that could change the credit conclusion.
One Material issue (CP5-002: CP-4A headroom calculation definition mismatch)
additionally restricts database ingestion. Remediation of CP5-001 is required
before committee clearance can be reconsidered.

SEVERITY ENGINE:
  Any Critical finding    → qa_status = Blocked
  Any Material, no Critical → qa_status = Restricted
  Only Minor or none      → qa_status = Passed

EXCEPTION SEVERITY: CRITICAL | MATERIAL | MINOR
