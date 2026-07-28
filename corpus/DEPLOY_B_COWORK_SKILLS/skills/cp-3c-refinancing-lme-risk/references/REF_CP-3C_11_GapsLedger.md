<!-- REF_CP-3C_11 (T2) | 2026-06-03 -->
<step_reference module="CP-3C" step="11" name="Gaps Ledger">
<input>All prior step outputs (T3D.1–T3D.10); cumulative gaps identified throughout workflow.</input>
<gate>Always executes.</gate>

## Instructions
1. Compile all gaps identified across Steps 1–10 into a consolidated ledger.
2. For each gap: record Gap, Missing Data, Why It Matters, Impact on Output (which step/table/score/path/scenario is affected), and Required Follow-Up.
3. Cover gaps in: maturity/debt-schedule detail, liquidity/FCF data, market data (pricing/spreads/yields), legal/covenant evidence (CP-4/CP-4A), sponsor/governance evidence (CP-2C), downside pathways (CP-2A), liquidity bridge (CP-2D), recovery evidence, intercreditor terms, and historical LME precedent.
4. Flag gaps that prevent vulnerability scoring, path assessment, or scenario construction.
5. Flag gaps requiring downstream resolution (CP-4 for legal, CP-2C for sponsor).

## Output
T3D.11: `Gap`|`Missing Data`|`Why It Matters`|`Impact on Output`|`Required Follow-Up`
