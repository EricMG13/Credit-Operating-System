<!-- REF_CP-3_03 (T2) | 2026-06-03 -->
<step_reference module="CP-3" step="03" name="Issuer / Security Scorecard">
<input>T3.1, Step 2 narrative; fundamental evidence from CP-1/CP-2 family.</input>
<gate>Step 2 complete.</gate>

## Instructions
1. Build the scorecard using the Score Direction and rubric in the Active Prompt. Factor weights are **mode-dependent**: use weights supplied by the portfolio mandate, sector framework, or explicit user instruction. No system default weights exist. If no weights are supplied, present unweighted scores, mark the composite [Provisional — Equal-Weight] or Not Scorable, and log the missing weighting framework in the Gaps Ledger. Do not invent weights.
2. Score Direction: 1 = Conservative/creditor-favorable/low-risk → 5 = Aggressive/creditor-unfavorable/high-risk.
3. For each factor: assign Raw Score (1–5), apply Weight, calculate Weighted Score, assign Confidence tag (High/Medium/Low/Not Assessable).
4. For each score: provide Evidence, Risk Mechanic, and Credit Implication.
5. If factor evidence is materially incomplete, do NOT assign a precise score — use range, Not Scorable, or Not Assessable.
6. Calculate composite score (weighted sum) and map to Credit Tier (1.0–1.9 = High Quality, 2.0–2.9 = Acceptable, 3.0–3.7 = Stretched, 3.8–5.0 = Weak, Not Scorable).

## Output
T3.3: `Category`|`Factor`|`Weight`|`Raw Score 1–5`|`Weighted Score`|`Confidence`|`Evidence`|`Risk Mechanic`|`Credit Implication`
+ Composite Score + Credit Tier
</step_reference>
