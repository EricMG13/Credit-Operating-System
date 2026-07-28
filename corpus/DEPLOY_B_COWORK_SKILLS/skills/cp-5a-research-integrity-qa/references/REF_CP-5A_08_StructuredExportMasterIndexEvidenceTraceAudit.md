<!-- REF_CP-5A_08 (T2) | 2026-06-26 | Phase 1: Structured-Export audit retargeted to canonical Markdown Handoff Envelope and Evidence Trace audit -->
<step_reference module="CP-5A" step="08" name="Handoff Envelope and Evidence Trace Audit">
<input>T5.1; each audited module's canonical Markdown handoff `.md` (YAML envelope + canonical H2 headings); CP-5 evidence trace outputs.</input>
<gate>Step 7 complete.</gate>

## Instructions
1. Execute Audit Lanes 6 (Evidence Trace), 7 (Schema), and 8 (Handoff Envelope) across all audited modules.
2. **Evidence Trace (Lane 6):** Check CP-5 classification of material conclusions and the `## Evidence Trace` section of each handoff. Identify orphan claims (VE-015). Flag weak-lineage and untraced conclusions. Verify the evidence trace is consistent with the `## Analysis` section.
3. **Schema (Lane 7):** Verify the YAML front-matter envelope has all required fields populated or correctly null (module_id, run_id, issuer_id, reporting_period, analysis_date, confidence_score, confidence_band, qa_status, committee_status, limitation_flags, validation_warnings, upstream_artifacts_used, downstream_consumers). Confirm numeric values represented correctly (null not zero, percentages as decimals).
4. **Handoff Envelope (Lane 8):** Verify canonical Markdown carries the YAML front-matter envelope and ALL canonical H2 headings (## Audit Summary, ## Analysis, ## Evidence Trace, ## Source Registry, ## Gaps & Conflicts, ## QA Validation). For each requested export, verify a matching `[IssuerID]_[ModuleID]_[YYYYMMDD]` filename derived exactly from front-matter `issuer_id`, `module_id`, and `analysis_date`, plus value/content parity appropriate to DOCX or visual PDF. Missing/empty envelope fields, missing canonical headings, a filename mismatch, or a falsely claimed export are defects. There are no lettered appendices (A–E), embedded JSON blocks, or export manifest.
5. For each finding: record Severity, Module, Handoff Component, Defect, Required Fix, Downstream Handoff Impact.
6. Severity: Critical if it breaks the agent-to-agent handoff (missing envelope or required heading); Material if data quality; Minor if metadata/formatting.

## Output
T5.8: `Severity`|`Module`|`Handoff Component`|`Defect`|`Required Fix`|`Downstream Handoff Impact`
</step_reference>
