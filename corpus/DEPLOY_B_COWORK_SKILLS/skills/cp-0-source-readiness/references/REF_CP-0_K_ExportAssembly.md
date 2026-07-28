<!-- REF_CP-0_K_ExportAssembly (Tier 2) | 2026-06-26 | migrated to requested DOCX view+canonical Markdown export contract per CP_AB_EXPORT_SPEC.md -->
<step_reference module="CP-0" step="K" name="ExportAssembly">
Author and validate canonical `[IssuerID]_CP-0_[YYYYMMDD].md` first per `CP_AB_EXPORT_SPEC.md`, using exact front-matter `issuer_id` and `analysis_date` without hyphens. It carries the YAML envelope (`confidence_score` + `confidence_band`) and canonical H2 headings and is the CP-X handoff.

On request, create an editable DOCX with Header → Audit Summary → analysis → one Audit Appendix, a module-profiled visual PDF with a compact complete appendix, or both. Verify each view independently. Export failure does not invalidate canonical Markdown or a successful sibling export. No lettered appendices, JSON blocks, export manifest, separate CP-RENDER/CP-EXTRACT agent, or database.
</step_reference>
