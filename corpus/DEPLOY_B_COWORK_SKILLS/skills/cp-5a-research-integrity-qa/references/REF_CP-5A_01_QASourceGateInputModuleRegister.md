<!-- REF_CP-5A_01 (T2) | 2026-06-26 | Phase 1: input = upstream canonical `.md` handoffs (envelope + canonical headings) -->
<step_reference module="CP-5A" step="01" name="QA Source Gate and Input Module Register">
<input>Each upstream module's canonical Markdown handoff `.md` (YAML front-matter envelope + canonical H2 headings: ## Audit Summary, ## Analysis, ## Evidence Trace, ## Source Registry, ## Gaps & Conflicts, ## QA Validation), CP-5 evidence trace outputs, all source materials referenced by audited modules. Read the handoffs directly — do NOT parse .docx JSON appendices; there is no CP-EXTRACT.</input>
<gate>Always executes. This IS the gate check. BLOCKING: At least one upstream module canonical Markdown handoff must be available for audit. If no auditable handoffs: Module Status = Blocked, STOP.</gate>

## Instructions
1. Inventory all upstream module canonical Markdown handoff `.md` files available for QA.
2. For each module: record Module, Handoff canonical `.md` / run_id, Scope, Source Quality, Envelope / Headings Status (YAML front-matter fields present + canonical H2 headings present), QA Status (pre-audit), and Notes.
3. Confirm CP-5 evidence trace is available.
4. Assess source quality and handoff envelope/heading completeness for each module (missing front-matter fields or canonical headings are gate findings).
5. Assign Module Status:
   - **Completed:** All target modules available with complete canonical Markdown envelopes and canonical headings.
   - **Ready with Limitations:** Some modules available but with incomplete handoff envelopes/headings, incomplete source packages, or CP-5 trace unavailable.
   - **Blocked:** No upstream module canonical Markdown handoffs available for audit. Output blocked message and STOP.
6. State missing required inputs, external-source usage status, and citation discipline requirement.

## Output
T5.1: `Module`|`Handoff canonical `.md` / run_id`|`Scope`|`Source Quality`|`Envelope / Headings Status`|`QA Status`|`Notes`
+ Module Status: Completed / Ready with Limitations / Blocked
<!-- Upstream re-anchor (common_rules #10): at this gate, re-import and verify the specific upstream module outputs this module consumes (per declared Upstream); restate the exact datapoints/run_id/period used. If a required upstream value is absent or its run_id/period mismatches this run, mark [Insufficient Information] and gate the dependent step — do not re-derive or infer the upstream value from memory. -->
</step_reference>
