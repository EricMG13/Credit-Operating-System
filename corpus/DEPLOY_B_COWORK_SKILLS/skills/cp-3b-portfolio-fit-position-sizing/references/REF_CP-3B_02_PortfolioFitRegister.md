<!-- REF_CP-3B_02 (T2) | 2026-06-03 -->
<step_reference module="CP-3B" step="02" name="Portfolio Fit Register">
<input>T3C.1 Portfolio Input Gate; CP-3 output, CP-3A instrument preference, CP-3C refinancing/LME, CP-2A downside, CP-2D liquidity, CP-4/CP-4A legal/covenant, mandate guidelines.</input>
<gate>Step 1 complete; Module Status ≠ Blocked.</gate>

## Instructions
1. Assess whether the issuer/security fits the relevant strategy, mandate, and portfolio role.
2. Assign Fit Category: Mandate fit / RV fit / Liquidity fit / Risk-budget fit / Not fit / Not assessable.
3. Identify portfolio role where supported: yield carry, spread duration, convexity, defensive senior secured, catalyst, RV switch, recovery-sensitive upside, watchlist/monitoring only.
4. For each issuer/security: provide Evidence, Risk Mechanic, Why It Fits / Does Not Fit, Constraints/Notes, and Source Trace.
5. Incorporate where available: mandate eligibility, RV support (CP-3), instrument support (CP-3A), downside support (CP-2A/CP-2D), legal/covenant support (CP-4/CP-4A), refinancing/LME support (CP-3C).

## Output
T3C.2: `Name / Instrument`|`Fit Category`|`Evidence`|`Risk Mechanic`|`Why It Fits / Does Not Fit`|`Constraints / Notes`|`Source Trace`
</step_reference>
