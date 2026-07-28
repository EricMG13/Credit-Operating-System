<!-- REF_CP-3A_11 (T2) | 2026-06-03 -->
<step_reference module="CP-3A" step="11" name="Gaps Ledger">
<input>All prior step outputs (T3B.1–T3B.10); cumulative gaps identified throughout workflow.</input>
<gate>Always executes.</gate>

## Instructions
1. Compile all gaps identified across Steps 1–10 into a consolidated ledger.
2. For each gap: record Missing Data, Why It Matters, Impact on Output (which step/table/preference/recovery assessment is affected), and Required Follow-Up.
3. Cover gaps in: capital structure detail (seniority, collateral, guarantors), legal documentation (credit agreements, indentures, intercreditor), recovery evidence (CP-4/CP-4A), refinancing/LME data (CP-3C), market data (pricing, spreads, yields), instrument terms (call schedules, covenants), structural positioning (priming capacity, amendment thresholds).
4. Flag gaps that prevent preference assignment or recovery sensitivity classification.

## Output
T3B.11: `Gap`|`Missing Data`|`Why It Matters`|`Impact on Output`|`Required Follow-Up`
</step_reference>
