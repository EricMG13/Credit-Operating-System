<!-- REF_CP-2A_08 (T2) | 2026-06-03 -->
<step_reference module="CP-2A" step="08" name="Cross-Module Handoff Register">
<input>Steps 1-7 outputs</input>
<gate>Step 7 complete.</gate>

## Instructions
Identify how CP-2A output should be consumed by each of 10 downstream modules. For each, specify handoff item, relevance, required consumer action, source/pathway link, and limitation.

Required pass-items per consumer:
- **CP-2D (Liquidity & Cash Flow Bridge):** working-capital pressure, capex inflexibility, cash burn drivers, revolver draw risk, cash-interest pressure, seasonality, trapped cash, liquidity pinch points.
- **CP-2E (Macro, Hedging & FX Sensitivity):** rate, FX, commodity, energy, wage, inflation, country, and macro transmission drivers.
- **CP-3 (Relative Value):** primary fragility, fastest downside path, PD / RV consequence, market-access pressure, spread / price sensitivity, top monitoring trigger.
- **CP-3A (Instrument Preference & Recovery):** security-level downside relevance, collateral / guarantee sensitivity, claim-priority impact, recovery sensitivity, structural subordination, priming risk, legal / structural risk interactions.
- **CP-3B (Portfolio Fit / Position Sizing):** downside-budget relevance, sizing caution, correlation / concentration flags, catalyst timing, liquidity risk, monitoring urgency.
- **CP-3C (Refinancing & LME Risk):** maturity-wall / refinancing inflection, leverage deterioration, liquidity pressure, ratings / market-access pressure, A&E risk, LME vulnerability, sponsor behavior, creditor-adverse transaction signals.
- **CP-4A (Covenant Capacity & Headroom):** covenant headroom pressure, EBITDA definition sensitivity, basket / leakage monitoring needs, restricted-group issues, EBITDA add-back concerns, legal-review dependencies.
- **CP-5A (QA & Integrity Control):** unsupported claims, missing inputs, conflicting sources, calculation limitations, inference-heavy pathways, structured-export validation issues.
- **CP-5 (Evidence Traceability):** top material drivers, source lineage, classification as sourced / calculated / analyst inference, weak-lineage flags, claim_status / confidence_level.
- **CP-6/CP-6A (Reviewer Mode):** committee-ready primary fragility, fastest downside path, top monitoring signals, key gaps, downstream-module dependencies.

## Output
**T2B.8 Cross-Module Handoff Register:** `Downstream Module`|`Handoff Item`|`Why It Matters`|`Required Consumer Action`|`Source / Pathway Link`|`Limitation`
</step_reference>
