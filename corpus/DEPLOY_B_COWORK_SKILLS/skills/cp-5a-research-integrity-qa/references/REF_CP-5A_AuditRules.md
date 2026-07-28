<!-- REF_CP-5A AuditRules (T2 support) | 2026-06-26 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8); Phase 1: Lanes 7-8 retargeted to canonical Markdown handoff envelope -->
<reference module="CP-5A" name="Severity Escalation, Audit Lanes & Clearance">

Authoritative for CP-5A across all eight audit lanes (Steps 2–8) and the clearance decision (Steps 9–11). Load alongside the CP-5A workflow. The Severity Engine (qa_status mapping) stays in the ACTIVE_PROMPT.

## Severity Escalation Rules
**Escalate to Critical when defect affects:**
- Credit conclusion, investment recommendation, action bias, security selection, position sizing, or committee decision
- Legal meaning, contractual interpretation, recovery ranking, or creditor rights
- Economics, leverage, liquidity, FCF, debt service capacity, maturity profile, or refinancing capacity
- A calculation error that changes a material metric by more than a rounding threshold
- A fabricated, unsourced, or materially misleading claim in committee-facing output

**Escalate to Material when defect affects:**
- Evidence traceability, source quality disclosure, or limitation transparency
- Cross-module inconsistency in material metrics or conclusions
- Structured export integrity or database ingestion
- Required monitoring trigger or remediation action omission
- Source-quality limitation that is not disclosed

**Keep as Minor when:**
- Formatting, duplication, clarity, table hygiene, or non-core presentation issue
- Does not impair interpretation, source support, credit conclusion, or downstream ingestion

## 8 Audit Lanes
| Lane | Scope | Key Severity Trigger |
|------|-------|---------------------|
| 1. Unsupported Claim | All material factual, numerical, legal, comparative, recovery, market, sponsor/governance, and committee-relevant claims | Critical if thesis-changing |
| 2. Calculation | All formulas, metrics, ratios, financial/capacity/headroom calculations, derived figures | Critical if changes material metric |
| 3. Legal / Covenant | All covenant, basket, lien, debt-incurrence, RP, investment, asset-transfer, guarantee, collateral, intercreditor, ranking, recovery, amendment, LME claims | Critical if affects creditor rights/recovery/legal meaning |
| 4. Market / RV | All price, spread, yield, DM, trading level, comparable, ranking, rating, benchmark, security-selection, RV claims | Critical if changes recommendation |
| 5. Cross-Module Consistency | All shared data points: issuer name, entity keys, EBITDA, leverage, liquidity, maturities, covenant capacity, recovery, market data, recommendations, monitoring posture | Critical if contradictory conclusions |
| 6. Evidence Trace | CP-5 evidence trace outputs and source lineage for all material conclusions | Critical if orphan claim is thesis-changing |
| 7. Schema | canonical Markdown handoff YAML front-matter envelope fields, schema versions, required fields, null-not-zero compliance | Critical if breaks the handoff envelope |
| 8. Handoff Envelope | Canonical Markdown completeness: YAML envelope + all canonical H2 headings present; requested DOCX/PDF exports exist, have matching filenames, and pass view-appropriate parity | Critical if breaks the agent-to-agent handoff |

## Evidence Support Classification
Supported | Partially Supported | Unsupported | Conflicting | Insufficient Information

## Defect Categories (23)
Unsupported Claim | Partially Supported Claim | Conflicting Evidence | Citation Gap | Source Quality Limitation | Calculation Error | Formula / Definition Drift | Period Mismatch | Entity / Perimeter Mismatch | Legal Support Gap | Covenant / Basket Overreach | Recovery / Ranking Overreach | Market Data Gap | Relative Value Unsupported | Cross-Module Inconsistency | Version Conflict | Duplicative / Immaterial Content | Promotional or Non-Credit Language | canonical Markdown Handoff Integrity Defect | Evidence Trace Defect | Markdown/export Consistency Defect | Gate Compliance Breach | Safety / Scope Breach

## Clearance Impact Labels (9)
Blocks Committee Use | Restricts Committee Use | Blocks canonical Markdown Handoff / Downstream Grounding | Requires Legal Review | Requires Market Data Refresh | Requires Calculation Rebuild | Requires Source Reconciliation | Monitoring Follow-Up | Formatting / Hygiene Only

## Calculation Audit Requirements
A calculation is QA-usable only if it includes ALL of: formula, numerator, denominator, period, units/currency, source trace, normalization/pro forma adjustments, sign convention, reconciliation to module output. If any element is missing → Not Calculable from Provided Materials (unless missing element is immaterial and limitation disclosed).

## Committee Clearance Logic
- **Pass:** No Critical issues and no unresolved Material issues affecting committee use or export integrity.
- **Pass with Remediation:** No unresolved Critical issues, but ≥1 Material or Minor issues require correction or limitation disclosure.
- **Fail:** ≥1 unresolved Critical issues, missing auditable output, inability to identify issuer/entity, or defects that block committee use.

</reference>
