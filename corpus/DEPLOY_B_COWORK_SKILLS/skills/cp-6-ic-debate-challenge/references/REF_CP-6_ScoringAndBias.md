<!-- REF_CP-6 ScoringAndBias (T2 support) | 2026-06-22 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8) -->
<reference module="CP-6" name="Action-Bias, Evidence & Scoring Rules">

Authoritative for CP-6 evidence weighting (Step 6), debate resolution (Step 7), and action-bias determination (Step 8). Load alongside the CP-6 workflow.

## Action Bias Definitions
- **Avoid:** Downside risk, legal leakage, liquidity risk, refinancing risk, weak recovery, or poor RV not adequately compensated.
- **Watchlist:** Potentially actionable, but evidence incomplete, catalyst timing unclear, or compensation insufficient.
- **Starter Position:** Credit evidence supportive, but uncertainty, liquidity, legal structure, recovery, mandate consumption, or market technicals justify limited sizing.
- **Core Hold:** Durable cash-flow support, acceptable legal/recovery profile, manageable downside, fair-to-attractive compensation.
- **Add / Increase:** Resilient fundamentals, credible downside protection, attractive RV, no unresolved gating risk.
- **Reduce / Trim:** Position defensible, but risk-reward deteriorated or sizing no longer justified.
- **Exit:** Bear case has materially superior evidence and remaining value protection inadequate.
- **Requires More Work:** Missing information prevents a decision-useful investment conclusion.

## Canonical Credit Implication (13 values)
Positive — Deleveraging | Positive — Margin Expansion | Positive — Revenue Growth | Positive — Liquidity Improvement | Positive — Covenant Headroom Expansion | Neutral — Stable | Negative — Leverage Increase | Negative — Margin Compression | Negative — Revenue Decline | Negative — Liquidity Deterioration | Negative — Covenant Erosion | Negative — Refinancing Risk | Insufficient Information

## Evidence Hierarchy (highest → lowest)
1. Audited financials, executed legal documents, current market levels, current portfolio/mandate data
2. Company-reported financials, management reporting, covenant certificates, lender presentations, offering memoranda
3. Prior module outputs that cite underlying documents
4. Third-party reports, rating-agency reports, covenant-review reports, broker/trading runs
5. Analyst interpretation based on sourced facts

## Evidence Quality Labels (4)
- **Strong:** Directly supported by audited financials, executed legal documents, current market data, mandate/exposure data, or source-backed module output.
- **Moderate:** Supported by company-reported data, management reporting, lender materials, or source-backed module analysis with limitations.
- **Weak:** Partial, stale, draft, incomplete, unaudited, non-comparable, or provisional evidence.
- **Insufficient:** Required evidence missing, conflicting, not decision-useful, or unsupported by cited source.

## Chair Decision Rules
1. If liquidity is not evidenced → do not underwrite a high-conviction long.
2. If CP-4 is missing → do not claim strong creditor control.
3. If CP-4A is missing → do not claim basket headroom or covenant capacity.
4. If CP-3 / market data is missing → do not claim attractive relative value.
5. If CP-2A is missing → do not claim downside resilience.
6. If CP-2D is missing → do not claim quantified liquidity runway unless directly supported by CP-1 or CP-1B.
7. If CP-3C is missing → do not claim definitive refinancing or LME path.
8. If CP-3A is missing → do not claim definitive instrument preference or recovery conclusion.
9. If Bear proves credible Zero-Bound path and Bull cannot quantify liquidity protection → bias ≤ Watchlist without explicit Chair justification.
10. If Bull proves durable FCF + accessible liquidity + manageable maturities + fair-to-cheap RV but legal leakage unresolved → default bias = Starter Position (not Core Hold or Add).
11. If both sides rely on weak evidence → use Requires More Work.

## Final Bias Guardrails
| Evidence Pattern | Default Bias |
|-----------------|-------------|
| Strong fundamentals + strong liquidity + acceptable legal + attractive RV | Core Hold / Add |
| Strong fundamentals + unresolved legal or liquidity issue | Starter Position / Watchlist |
| Average fundamentals + fair RV + manageable downside | Starter Position / Core Hold (portfolio-dependent) |
| Weak FCF + high leverage + weak liquidity | Avoid / Reduce / Exit |
| Legal leakage or priming risk not compensated by price | Avoid / Reduce |
| Missing CP-1 / CP-2 / CP-4 evidence | Requires More Work |
| Missing market data but credit otherwise sound | Watchlist / Starter Position, not Add |
| Bear wins Zero-Bound path | Avoid / Reduce / Exit |
| Bull wins fundamentals but Bear wins legal/recovery | Starter Position / Watchlist (unless RV compelling + sizing constrained) |
| Bull wins RV but Bear wins liquidity | Avoid / Reduce / Watchlist (maturity/liquidity-dependent) |
| Bear cannot prove stress path but Bull cannot prove liquidity | Watchlist / Requires More Work |

## Chair Scoring Rubric
**Scale:** 1 = Bull clearly superior → 3 = Balanced/unresolved → 5 = Bear clearly superior
**Required Dimensions (9):** Cash-flow durability | Downside pathway severity | Liquidity runway | Refinancing/maturity risk | Legal/covenant control | Recovery/LGD protection | Sponsor/governance alignment | Relative value compensation | Portfolio fit/sizing
**Interpretation:** 1.0–2.0 = Bull wins (Core Hold/Add if RV supports) | 2.1–2.9 = Bull modestly ahead (Starter/Core Hold) | 3.0 = Unresolved (Watchlist/Requires More Work) | 3.1–4.0 = Bear modestly ahead (Avoid/Reduce/Watchlist) | >4.0 = Bear wins decisively (Avoid/Reduce/Exit)
*Do not calculate average unless all dimensions scored. If incomplete, mark Provisional.*

## Debate Winner Definitions
- **Bull wins:** Bull provides superior evidence that cash-flow durability, liquidity, structural protection, refinancing capacity, recovery, and market compensation absorb identified downside risks.
- **Bear wins:** Bear provides superior evidence that downside transmission, liquidity stress, legal leakage, recovery impairment, refinancing risk, or inadequate compensation overwhelms Bull mitigants.
- **Neither wins:** Evidence is incomplete, conflicting, stale, non-comparable, or not decision-useful.

</reference>
