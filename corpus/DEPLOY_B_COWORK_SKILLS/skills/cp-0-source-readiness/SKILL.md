---
name: CP-0 Source Readiness
description: Use CP-0 only to inventory supplied sources, test authority and usability, identify gaps, and issue the source-readiness gate for a new issuer package. Trigger before financial or legal analysis. Do not extract canonical financials; use CP-1 after CP-0 clears the source set.
---

# Module: CP-0

## Progressive-disclosure entry launcher

Every invocation is a full run. Before analysis, load `./references/MODULE_RUNBOOK.md`; it preserves the binding role, complete workflow, methods, system rules, and module-specific export requirements. Load each other step companion only when the runbook invokes it. Open only the relevant sections of `./references/CANON_RELEVANT.md` when the inline hard gates or runbook do not resolve a source, calculation, taxonomy, schema, or QA ambiguity. Never replace the runbook with a summary and never skip a workflow step.

<!-- CP0_ENTRY_NO_SELECTOR -->
# Canon Core (binding)
<!-- CANON_CORE:BEGIN -->
Structure-B entry-safe Canon Core. Before analysis, load `./references/MODULE_RUNBOOK.md`. Open only the sections of `./references/CANON_RELEVANT.md` needed to resolve a source, calculation, taxonomy, schema, or QA ambiguity; do not preload the whole companion. The binding hard gates remain inline below and are repeated at the end.

## Canon Core — binding on every CP module run
1. Every run=full workflow+outputs+QA; no reduced mode.
2. Markdown first→validate identity/contract, fail closed→Markdown completes run→optional requested DOCX/PDF. Chat is non-canonical.
3. Exact filename=`[SubjectKey]_[Module]_[YYYYMMDD].md`: SubjectKey is front-matter `issuer_id` (CP-DR: `scope_key`), module/date are `module_id`/`analysis_date`; never use reporting period/name/alias. Validate the attachment name before completion; inability to create it→Blocked. YAML=`qa_status`, Confidence Score/band, six H2s. Optional-export failure cannot invalidate valid Markdown.
4. upstream re-anchor module/run/entity/period scope/values. Missing/Blocked/mismatch→`[Insufficient Information]`+stop/no inference. Figure=file+locator or null+gap; null≠zero; keep rows/`—`; never fabricate/reconcile.
5. Debt=BS carrying value(current+long-term, net issuance costs); log gross delta. finance-company/services/financing subsidiary: separate industrial vs finance cash/debt/CFO/capex/liquidity/FCF; matched-funding debt not industrial leverage; state perimeter/definition/conflicts.
6. Multi-figure event: all figures+roles, one conflict row; never silently choose.
7. Subsequent event: flag date; never blend into period figures.
8. Non-debt funding float: trend deposits/deferred revenue/supplier finance—not payables; Evidence→Risk Mechanic→Credit Implication.
9. Show source vs normalized one-offs; label normalization+Analyst Judgement. Never infer covenant capacity; absent inputs=`Not Calculable`.
<!-- CANON_CORE:END -->

# Companion Files

Progressive disclosure: load the runbook for every invocation; open other companions only at the workflow step or ambiguity that needs them.

- `./references/MODULE_RUNBOOK.md` — binding full module role, workflow, method, system rules, and export specifics; load before analysis.
- `./references/CANON_RELEVANT.md` — module-profiled canon; open only the sections needed to resolve an ambiguity.
- `./references/REF_CP-0_A_FileClassification.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_B_EntityIdentification.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_C_DocumentMapping.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_D_QualityAssignment.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_E_ContentModuleMapping.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_ExampleOutputPattern.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_F_GapLogging.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_G_ConflictLogging.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_H_FileQualityRisk.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_I_DownstreamReadiness.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_J_MasterIndexUpdate.md` — step or method companion; load only when the runbook invokes it.
- `./references/REF_CP-0_K_ExportAssembly.md` — step or method companion; load only when the runbook invokes it.
- `./references/SCHEMA_REFERENCE.md` — output sections, tables, schema, and QA checklist; load at export and QA.

# Hard-Gate Recap
<!-- CANON_RECAP:BEGIN -->
## Canon Core — binding on every CP-0 run
1. Every run=full workflow+outputs+QA; no reduced mode.
2. Markdown first→validate identity/contract, fail closed→Markdown completes run→optional requested DOCX/PDF. Chat is non-canonical.
3. Exact filename=`[SubjectKey]_CP-0_[YYYYMMDD].md`: SubjectKey is front-matter `issuer_id` (CP-DR: `scope_key`), module/date are `module_id`/`analysis_date`; never use reporting period/name/alias. Validate the attachment name before completion; inability to create it→Blocked. YAML=`qa_status`, Confidence Score/band, six H2s. Optional-export failure cannot invalidate valid Markdown.
4. upstream re-anchor module/run/entity/period scope/values. Missing/Blocked/mismatch→`[Insufficient Information]`+stop/no inference. Figure=file+locator or null+gap; null≠zero; keep rows/`—`; never fabricate/reconcile.
5. Debt=BS carrying value(current+long-term, net issuance costs); log gross delta. finance-company/services/financing subsidiary: separate industrial vs finance cash/debt/CFO/capex/liquidity/FCF; matched-funding debt not industrial leverage; state perimeter/definition/conflicts.
6. Multi-figure event: all figures+roles, one conflict row; never silently choose.
7. Subsequent event: flag date; never blend into period figures.
8. Non-debt funding float: trend deposits/deferred revenue/supplier finance—not payables; Evidence→Risk Mechanic→Credit Implication.
9. Show source vs normalized one-offs; label normalization+Analyst Judgement. Never infer covenant capacity; absent inputs=`Not Calculable`.
<!-- CANON_RECAP:END -->
