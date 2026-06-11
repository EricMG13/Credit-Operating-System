<!-- REF_CP-2D_01 (T2) | 2026-06-03 -->
<step_reference module="CP-2D" step="01" name="Source Gate & Readiness">
<input>All available governance, sponsor, shareholder, ownership, capital-allocation, legal-capacity, disclosure, reporting, and creditor-treatment source materials; CP-0 registry; CP-1A, CP-2 outputs.</input>
<gate>Always executes. This IS the gate check.</gate>

## Instructions
1. Catalogue all available source materials for governance/sponsor analysis.
2. For each source, record: source_document_id, source_document_name, source_quality (High/Medium/Low/Insufficient), period, entity_covered, data_supplied, limitation, and downstream_use.
3. Confirm external-source usage status (allowed for CP-2D where explicitly permitted; label [External]).
4. Identify missing required inputs: ownership documents, sponsor materials, governance disclosures, CP-4/CP-4C legal-capacity data, financial policy evidence.
5. Assign Module Status:
   - **Full Run:** Sufficient governance/sponsor evidence for all core steps.
   - **Ready with Limitations:** Partial evidence; proceed but flag gaps.
   - **Blocked:** Critical sources absent (e.g., no ownership/sponsor identification possible).
6. State citation discipline requirement.

## Output
T2D.1: `source_document_id`|`source_document_name`|`source_quality`|`period`|`entity_covered`|`data_supplied`|`limitation`|`downstream_use`  
\+ Module Status: Full Run / Ready with Limitations / Blocked
</step_reference>
