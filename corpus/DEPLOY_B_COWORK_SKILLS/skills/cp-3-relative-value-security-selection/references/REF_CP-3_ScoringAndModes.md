<!-- REF_CP-3 ScoringAndModes (T2 support) | 2026-06-22 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8) -->
<reference module="CP-3" name="Execution Modes, Scoring & RV/Recommendation Labels">

Authoritative for CP-3 mode selection (Step 1) and scoring/labelling (Steps 3–8). Load alongside the CP-3 workflow. The RV / Security-Selection / Portfolio discipline rules stay in the ACTIVE_PROMPT.

## Execution Modes

### CLO Screening Mode
Required: CP-1 export or equivalent; CP-2 export or equivalent; CLO list or investable security universe; risk scorecard or equivalent; Sector Review RV Table or peer/market data.

### Single-Name RV Mode
Required: CP-1 or equivalent; CP-2 or equivalent; capital structure and instrument terms; current or dated pricing/spread/yield/DM evidence; at least one comparable instrument or explicit statement that comparables are unavailable.

### Capital-Structure RV Mode
Required: instrument stack; seniority/collateral/covenant/maturity details; market data by instrument if available; legal review or limitation flag where not available.

### Watchlist Monitoring Mode
Required: prior CP-3 output or prior security-selection rationale; latest pricing/spread/yield/DM where available; new credit, legal, liquidity, catalyst, technical, or market information.

## Score Direction
Raw scores from 1 to 5:
- **1** = Conservative / creditor-favorable / low-risk
- **3** = Market-standard / acceptable / mid-risk
- **5** = Aggressive / creditor-unfavorable / high-risk

## Score Confidence Tags
**High:** Source-supported financial, legal, and market evidence available.
**Medium:** Core evidence available but one important area incomplete.
**Low:** Market data, legal data, or financial data materially incomplete.
**Not Assessable:** Scoring would require fabrication or unsupported assumptions.

## Credit Tier Mapping
| Score Range | Credit Tier |
|-------------|-------------|
| 1.0–1.9 | High Quality |
| 2.0–2.9 | Acceptable |
| 3.0–3.7 | Stretched |
| 3.8–5.0 | Weak |
| N/A | Not Scorable |

## Relative-Value Labels
**Cheap:** Compensation appears high relative to sourced fundamental risk, structural position, maturity, liquidity, and comparables.
**Fair:** Compensation appears broadly aligned with sourced risk and comparables.
**Rich:** Compensation appears insufficient for sourced fundamental, structural, maturity, liquidity, or downside risks.
**Unclear:** Market data, comparables, quote quality, or security-level information are insufficient.

## Recommendation Labels
**Preferred:** Fundamentals, structure, downside protection, liquidity, refinancing profile, and relative value are collectively supportive.
**Neutral:** Risk-adjusted compensation is adequate but not compelling, or positives and negatives are balanced.
**Avoid:** Credit risk, structural risk, valuation richness, liquidity risk, refinancing risk, technical risk, or governance risk is not adequately compensated.
**Requires More Work:** Missing information prevents a decision-useful conclusion.

</reference>
