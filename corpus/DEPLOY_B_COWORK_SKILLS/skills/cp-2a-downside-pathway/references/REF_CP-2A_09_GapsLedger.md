<!-- REF_CP-2A_09 (T2) | 2026-06-03 -->
<step_reference module="CP-2A" step="09" name="Gaps Ledger">
<input>Steps 1-8 outputs (cumulative gaps)</input>
<gate>Always executes.</gate>

## Instructions
Compile all gaps identified across Steps 1-8. Include missing data that affects: revenue/volume/price sensitivity, customer/supplier concentration, margin pass-through, segment profitability, working-capital seasonality, capex split, cash interest, revolver availability, covenant headroom, maturity wall, refinancing access, peer stress benchmarks, legal/structural risk, recovery relevance, management guidance, and current trading.

## Output
**T2B.9 Gaps Ledger:** `Gap ID`|`Missing Data`|`Why It Matters`|`Affected Pathway / Calculation / Trigger`|`Consequence for Confidence`|`Required Follow-Up Source`
- Gap ID format: CP-2A-GAP-001, CP-2A-GAP-002, ...
- Consequence: High / Medium / Low impact
</step_reference>
