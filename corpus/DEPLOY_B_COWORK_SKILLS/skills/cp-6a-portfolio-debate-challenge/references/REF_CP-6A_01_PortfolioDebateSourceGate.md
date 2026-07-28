<!-- REF_CP-6A_01 (T2) | 2026-06-03 -->
<step_reference module="CP-6A" step="01" name="Portfolio Debate Source Gate">
<input>CP-0 registry, all upstream module canonical `.md` handoffs (YAML envelope + canonical H2 headings), CP-6 debate output, source files, market data, portfolio/mandate inputs, exposure reports, optional live REF_CP-6A_Portfolio_Debate_Inputs.xlsx.</input>
<gate>Always executes. This IS the gate check. BLOCKING: If CP-3 is unavailable → Module Status = Blocked, STOP (RV Trader cannot make evidence-led pitch).</gate>

## Instructions
1. Confirm availability of all upstream canonical `.md` handoffs, source materials, market data, and portfolio/mandate inputs, plus the ability to author and validate canonical Markdown. Optional DOCX/PDF views are created only when requested and verified independently.
2. If using the consolidated workbook, validate its Mandate, Exposure Report and Compliance Monitor sheets against portfolio/legal vehicle, measurement basis and as-of. Treat mismatched Test CLO data as schema only. Do not substitute it for CP-3B.
3. Determine gate status:
   - **Full Run:** CP-3, CP-3B, CP-2A, and market data/mandate inputs available.
   - **Ready with Limitations:** CP-3 available but CP-3B, CP-2A, mandate data, exposure data, or other modules missing. Carry each limitation forward.
   - **Blocked:** CP-3 unavailable → STOP.
4. Apply limitation rules:
   - CP-3B missing → mandate fit and sizing cannot be fully tested.
   - CP-2A missing → downside path cannot be fully tested.
   - Current market pricing missing → RV conclusions = [Insufficient Information].
   - Mandate/portfolio constraints missing → exact constraint = [Insufficient Information].
   - Ratings/downgrade trajectory missing → CCC-basket/downgrade arguments = [Insufficient Information].
5. Record files and modules available, missing inputs, and limitations carried forward.

## Output
Gate status: Full Run / Ready with Limitations / Blocked
Source register: modules available, modules missing, limitations carried forward.
<!-- Upstream re-anchor (common_rules #10): at this gate, re-import and verify the specific upstream module outputs this module consumes (per declared Upstream); restate the exact datapoints/run_id/period used. If a required upstream value is absent or its run_id/period mismatches this run, mark [Insufficient Information] and gate the dependent step — do not re-derive or infer the upstream value from memory. -->
</step_reference>
