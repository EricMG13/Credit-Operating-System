<!-- REF_CP-8_01 (T2) | PROPOSED | 2026-06-22 -->
<step_reference module="CP-8" step="01" name="Decision Intake and Source Gate">
<input>The IC decision record: CP-6 IC Action Bias, CP-6A Portfolio Posture, instrument, size, decision date, decision-maker role; the original thesis artifacts (CP-6 final memo, single greatest uncertainty); independent market-pricing, rating-action, default/restructuring and recovery sources. A CP-EMAIL digest may identify leads but is optional and every event must be re-verified against its cited source.</input>
<gate>Always executes. This IS the gate check. BLOCKING: a dated decision record must exist to attribute against. If none: Module Status = Blocked, STOP — do not reconstruct a thesis after the fact.</gate>

## Instructions
1. Confirm a decision was made and is dated; record action bias, posture, instrument, size, and decision-maker role (role, not individual).
2. Inventory the thesis artifacts available for capture in Step 2.
3. Identify the realized-outcome data sources and the observation window (how much time has elapsed since the decision).
4. Assign Module Status:
   - **Completed:** decision record + thesis + observable outcomes available.
   - **Completed with Limitations:** decision recorded but observation window still open — interim tracking only.
   - **Blocked:** no decision record. Output blocked message and STOP.

## Output
T7.1: Decision record + source/observation-window inventory + Module Status: Completed / Completed with Limitations / Blocked
<!-- Upstream re-anchor (common_rules #10): re-import and verify the specific upstream outputs consumed (CP-6 action bias + final memo and CP-6A posture); restate exact run_id/period. CP-EMAIL is never an upstream artifact: independently retrieve and verify any cited lead before use. If a required upstream value is absent or mismatched, mark [Insufficient Information] and gate the dependent step — do not infer it. -->
</step_reference>
