<!-- REF_CP-8_03 (T2) | PROPOSED | 2026-06-22 -->
<step_reference module="CP-8" step="03" name="Outcome Tracking">
<input>T7.2; independently sourced market pricing, rating actions, default/restructuring records and realized-recovery data. A CP-EMAIL digest may identify leads but is optional and is not a canonical upstream handoff.</input>
<gate>Step 2 complete.</gate>

## Instructions
1. Log realized outcomes, each **sourced and dated**: realized spread move, rating migration, default / restructuring incidence, realized recovery, actual holding period, and whether stated exit triggers were honored.
2. Do not fabricate or estimate an outcome — if not yet observable, mark it interim and note the open window.
3. Keep realized facts separate from any interpretation (interpretation is Steps 4–5).
4. Where the recovery is observed, capture it for comparison against the CP-3A estimate in Step 4.

## Output
T7.3: Realized Outcome Log — `Metric`|`Realized Value`|`As-of Date`|`Source`|`Interim / Final`|`Evidence ID`
</step_reference>
