<!-- CP-1A Schema Reference (Tier 3) | 2026-06-02 -->
<schema_reference module="CP-1A" tier="3">
## Output Objects
| ID | Step | Purpose |
|----|------|---------|
| source_classification | 2 | Source quality |
| transaction_summary | 3 | Transaction terms |
| company_description | 4 | Business description |
| revenue_business_mix | 4 | Revenue breakdown |
| ownership_register | 5 | Ownership structure |
| operating_model | 6 | Operating metrics |
| events_timeline | 7 | Credit events |
| credit_translation | 8 | Risk synthesis |
| gaps_ledger | 9 | Data gaps |
| conflict_log | 9 | Source conflicts |
| downstream_readiness | 10 | Module readiness |
## Extraction Types (13): sourced_fact | quoted_text | table_value | calculated_metric | analyst_inference | upstream_artifact | user_instruction | documentary_fact | definition_conflict | gap | source_limitation | insufficient_information | not_available
## QA: Sources classified | Objects present | Chains complete | Separation maintained | No M-prefix | Audit Appendix present (single, all audit items) | No silent reconciliation | Gaps inline+ledger | Mgmt language labelled
## Export

Canonical Markdown is the required analytical output and downstream handoff. Author and validate it first. Create an editable DOCX, a visually rich PDF, or both only when requested; verify each view independently. A failed optional view does not invalidate valid Markdown or a successful sibling export.

**Output order: (1) author complete canonical Markdown; (2) validate contract and identity, fail closed; (3) create requested DOCX and/or visual PDF views independently; (4) return concise status, limitations, and links actually created.**

## canonical Markdown [IssuerID]_CP-1A_[YYYYMMDD].md — `IssuerID` is exact front-matter `issuer_id`; `YYYYMMDD` is `analysis_date` without hyphens. YAML envelope (incl confidence_score + confidence_band) + canonical H2: ## Audit Summary, ## Analysis, ## Evidence Trace, ## Source Registry, ## Gaps & Conflicts, ## QA Validation. Saved to OneDrive, attached as grounding to next agent.
## Confidence: numeric confidence_score 0-100 (primary, per CP_CONFIDENCE_SCORE.md); confidence_band = derived label (High/Medium/Low/Insufficient Information).
