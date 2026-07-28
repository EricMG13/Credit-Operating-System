---
name: RBOT Orchestrator
description: Use RBOT Orchestrator only to plan and gate a multi-module end-to-end pathway, propagate limitations, and stop on Blocked. Trigger on full credit, covenant, earnings, distressed, relative-value, portfolio, sector, or monitoring pipelines. This entry provides instructions only and assumes no autonomous module calls; for one module, load that entry directly.
---

# Orchestrator: RBOT-ORCHESTRATOR

This is a deployment-level conductor, not a CP analytical module and it owns no module payload. It uses CP-X routing canon without assuming autonomous module-to-module execution.

## Progressive-disclosure entry launcher

Every invocation is a full run. Before analysis, load `./references/MODULE_RUNBOOK.md`; it preserves the binding role, complete workflow, methods, system rules, and module-specific export requirements. Load each other step companion only when the runbook invokes it. Open only the relevant sections of `./references/CANON_RELEVANT.md` when the inline hard gates or runbook do not resolve a source, calculation, taxonomy, schema, or QA ambiguity. Never replace the runbook with a summary and never skip a workflow step.

Compatibility intake: if the user command is exactly `Run CP-MON`, rewrite it to `Run CP-EMAIL [mode: Monitoring] [minimum level: WATCH]` and begin exactly: `CP-MON is retired; this command is running CP-EMAIL in compatibility Monitoring mode.` Then use the display-only branch. CP-MON is not an active node, owner or handoff.

Output-class branch: apply the canonical Markdown and requested-export gates only to `CANONICAL_MARKDOWN` nodes. For CP-EMAIL, follow the runbook's `DISPLAY_DIGEST` branch, display and inspect the digest, then stop; request no files and treat no digest as a handoff.

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
- `./references/EXECUTION_ORDER.md` — step or method companion; load only when the runbook invokes it.
- `./references/MODULES_REFERENCE.md` — step or method companion; load only when the runbook invokes it.
- `./references/PATHWAYS.md` — step or method companion; load only when the runbook invokes it.
- `./references/ROUTE_GRAPH.md` — step or method companion; load only when the runbook invokes it.
- `./references/ROUTING_LOGIC.md` — step or method companion; load only when the runbook invokes it.
- `./references/ROUTING_INDEX.md` — trigger-to-owner registry; load when translating user scope into modules.
- `./references/ORCHESTRATOR_SPEC.md` — binding design-time sequencing constraints; load before issuing a pathway.
- `./references/RBOT_EXPANSION.md` — binding CP-2G/CP-2H/CP-3D/CP-4C insertion; it overrides stale counts or pathways in older companions.
- `./references/MODULE_ID_ALIASES.md` — legacy-to-canonical ID resolution for historical handoffs; new runs use canonical IDs only.

# Hard-Gate Recap
<!-- CANON_RECAP:BEGIN -->
## Canon Core — binding on every CP-X run
1. Every run=full workflow+outputs+QA; no reduced mode.
2. Markdown first→validate identity/contract, fail closed→Markdown completes run→optional requested DOCX/PDF. Chat is non-canonical.
3. Exact filename=`[SubjectKey]_CP-X_[YYYYMMDD].md`: SubjectKey is front-matter `issuer_id` (CP-DR: `scope_key`), module/date are `module_id`/`analysis_date`; never use reporting period/name/alias. Validate the attachment name before completion; inability to create it→Blocked. YAML=`qa_status`, Confidence Score/band, six H2s. Optional-export failure cannot invalidate valid Markdown.
4. upstream re-anchor module/run/entity/period scope/values. Missing/Blocked/mismatch→`[Insufficient Information]`+stop/no inference. Figure=file+locator or null+gap; null≠zero; keep rows/`—`; never fabricate/reconcile.
5. Debt=BS carrying value(current+long-term, net issuance costs); log gross delta. finance-company/services/financing subsidiary: separate industrial vs finance cash/debt/CFO/capex/liquidity/FCF; matched-funding debt not industrial leverage; state perimeter/definition/conflicts.
6. Multi-figure event: all figures+roles, one conflict row; never silently choose.
7. Subsequent event: flag date; never blend into period figures.
8. Non-debt funding float: trend deposits/deferred revenue/supplier finance—not payables; Evidence→Risk Mechanic→Credit Implication.
9. Show source vs normalized one-offs; label normalization+Analyst Judgement. Never infer covenant capacity; absent inputs=`Not Calculable`.
<!-- CANON_RECAP:END -->
