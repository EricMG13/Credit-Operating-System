<!-- REF_CP-2B_06 (T2) | 2026-06-03 -->
<step_reference module="CP-2B" step="06" name="Downside Sensitivity Matrix">
<input>Steps 1-5 outputs; financial data</input>
<gate>Step 5 complete.</gate>

## Instructions
Where source data supports quantitative sensitivity, calculate or summarize directional effects. Otherwise mark [Directional Only]. Apply No False Precision rule: use quantitative sensitivities only where source inputs support the calculation.

Potential sensitivities: revenue decline, price decline, volume decline, gross margin compression, EBITDA margin compression, working-capital outflow, capex increase, cash-interest increase, liquidity draw, leverage increase, covenant headroom erosion, refinancing spread/coupon reset.

## Output
**T2B.6 Downside Sensitivity Matrix:** `Sensitivity`|`Input Basis`|`Formula / Method`|`Result`|`Credit Interpretation`|`Status`|`Source Trace`
- Status: Calculated / Directional Only / Not Calculable
</step_reference>
