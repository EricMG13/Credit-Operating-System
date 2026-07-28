<!-- REF_CP-8_08 (T2) | PROPOSED | 2026-06-22 -->
<step_reference module="CP-8" step="08" name="Gaps Ledger">
<input>All prior step outputs (T7.1–T7.7); cumulative gaps identified throughout the workflow.</input>
<gate>Always executes.</gate>

## Instructions
1. Compile all gaps from Steps 1–7 into one consolidated ledger.
2. For each gap record: Gap, Missing Item (decision record, thesis statement, realized-outcome source, observation window), Why It Matters, Impact on Output, Required Follow-Up.
3. Flag decisions whose observation window is still open (outcome not yet attributable) for future revisit.
4. Every section marked [Insufficient Information] in Steps 1–7 must have a corresponding gap entry.

## Output
T7.8: Gaps Ledger — `Gap`|`Missing Item`|`Why It Matters`|`Impact on Output`|`Required Follow-Up`
</step_reference>
