<!-- REF_CP-3B_10 (T2) | 2026-06-03 -->
<step_reference module="CP-3B" step="10" name="Overall Portfolio Fit View">
<input>All prior step outputs (T3C.1–T3C.9); all sizing, risk, concentration, liquidity, downside, and gap evidence.</input>
<gate>Always executes. Synthesis only — no new data.</gate>

## Instructions
1. Write a committee-ready narrative synthesis using required formulation:
   "Overall, [Issuer / Security] is [Avoid / Watchlist / Starter Position / Core Hold / Hold Existing Only / Reduce / Trim / Requires More Work] for portfolio implementation. The sizing posture is driven by [evidence], which matters because [risk mechanic] and implies [portfolio impact]. Further analysis requires [missing constraints / data]."
2. Cover: sizing posture and justification, key risk-budget constraint, concentration/correlation highlights, liquidity/implementation feasibility, downside/recovery sensitivity, top monitoring trigger, and critical gaps.
3. Do not introduce new data, new calculations, or new assessments — synthesize only from Steps 1–9.
4. End with one of:
   - "CP-3B Completed. Sizing Posture: [Posture]."
   - "CP-3B Completed with Limitations. Sizing Posture: [Posture / Requires More Work]. Missing Inputs: [List]."
   - "CP-3B Blocked. Missing Required Inputs: [List]."
   Canonical `[IssuerID]_CP-3B_[YYYYMMDD].md` is produced and validated every run per `CP_AB_EXPORT_SPEC.md`, using exact front-matter `issuer_id` and `analysis_date` without hyphens. Produce matching DOCX and/or visual PDF only when requested; report each export result independently.

## Output
Narrative synthesis (no table). Module completion statement with Sizing Posture.
</step_reference>
