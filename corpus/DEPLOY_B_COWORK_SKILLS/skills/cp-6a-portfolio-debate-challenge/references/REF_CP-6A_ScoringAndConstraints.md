<!-- REF_CP-6A ScoringAndConstraints (T2 support) | 2026-06-22 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8) -->
<reference module="CP-6A" name="Scoring, Evidence & Constraint Rules">

Load this alongside the CP-6A workflow. It holds the posture definitions, mappings, evidence rules, the 9-dimension allocation rubric, constraint taxonomies, CIO decision rules, and posture guardrails. Authoritative for all CP-6A scoring and posture decisions.

## Portfolio Posture Definitions
- **Include:** RV supports allocation; credit acceptable; mandate/concentration permit sizing; downside manageable; legal/recovery adequate. Maps → Starter Position, Core Hold, or Add/Increase.
- **Avoid:** Spread/yield does not compensate for risk, or fundamental evidence insufficient. Maps → Avoid or Exit.
- **Resize-Reduce:** Risk-reward deteriorated, position consumes too much risk budget, concentration pressure, or downside/legal/liquidity weakened. Maps → Reduce/Trim.
- **Resize-Increase:** Existing exposure can increase; RV attractive, downside controlled, mandate/concentration permit. Maps → Add/Increase.
- **Maintain-Hold:** Current position defensible; no evidence supports increasing or reducing. Maps → Hold Existing Only or Core Hold.
- **Requires More Work:** Missing information prevents decision-useful sizing. Maps → Requires More Work.

## Translation to Canonical 9
Include → Starter Position, Core Hold, Add / Increase | Avoid → Avoid, Exit | Resize-Reduce → Reduce / Trim | Resize-Increase → Add / Increase | Maintain-Hold → Hold Existing Only, Core Hold | Requires More Work → Requires More Work

## Canonical Credit Implication (13 values)
Positive — Deleveraging | Positive — Margin Expansion | Positive — Revenue Growth | Positive — Liquidity Improvement | Positive — Covenant Headroom Expansion | Neutral — Stable | Negative — Leverage Increase | Negative — Margin Compression | Negative — Revenue Decline | Negative — Liquidity Deterioration | Negative — Covenant Erosion | Negative — Refinancing Risk | Insufficient Information

## Evidence Hierarchy (highest → lowest)
1. Current market data (spreads, yields, prices, DM, trading levels) from dated, sourced pricing runs or broker sheets
2. CP-3 / CP-3A / CP-3B RV and portfolio-fit outputs citing underlying market data and peer comparables
3. CP-2A / CP-2D / CP-2E downside, liquidity, and macro outputs with source-supported stress scenarios
4. CP-4 / CP-4A legal / covenant outputs citing governing documents
5. CP-6 IC debate output with evidence-based action bias
6. Portfolio constraints, mandate documents, risk dashboards, exposure reports
7. Analyst interpretation based on sourced facts

## Evidence Quality Labels (4)
- **Strong:** Directly supported by current market data, executed mandate/exposure report, audited financials, or source-backed module output.
- **Moderate:** Supported by company-reported data, prior module analysis with limitations, or stale-but-recent market data.
- **Weak:** Partial, stale, draft, incomplete, or non-comparable evidence.
- **Insufficient:** Required evidence missing, conflicting, or not decision-useful.

## 9-Dimension Allocation Rubric
**Scale:** 1 = RV clearly superior → 3 = Balanced/unresolved → 5 = Compliance clearly superior
**Dimensions:** Spread/YTW Benefit | Peer Relative Value | Downside Pathway Severity | Liquidity/Refinancing Risk | Legal/Recovery Protection | CCC-Basket/Downgrade Risk | Concentration/Correlation Risk | Mandate Compliance | Implementation Liquidity
**Interpretation:** 1.0–2.0 = RV wins (Include: Core Hold/Add if mandate permits) | 2.1–2.9 = RV modestly ahead (Include: Starter Position) | 3.0 = Unresolved (Requires More Work) | 3.1–4.0 = Compliance modestly ahead (Avoid/Resize-Reduce/constrained Include) | >4.0 = Compliance wins decisively (Avoid)
*Do not calculate average unless all dimensions scored. If incomplete, mark Provisional.*

## 9-Item Constraint Taxonomy
Mandate | Concentration | Rating | Geography | Liquidity | Correlation | Downside | Legal / Recovery | Data quality

## Portfolio Constraint Taxonomy (binding-constraint priority order)
1. Explicit mandate prohibition or eligibility failure
2. Hard issuer/borrower concentration limit
3. Hard sector/industry concentration limit
4. Rating bucket / CCC basket / downgrade trajectory limit
5. Country / currency / geography limit
6. Sponsor / ownership / PE concentration limit
7. Instrument type / lien / secured-unsecured / subordinated bucket limit
8. Liquidity / tradability / position exitability limit
9. Correlation / factor-risk budget limit
10. Downside-budget / expected-loss / stress-loss limit
11. Legal / recovery / LME-risk tolerance limit
12. Data-quality limitation preventing decision-useful sizing

## CIO Decision Rules
1. If CP-3 is missing → do not underwrite an Include posture.
2. If CP-3B / mandate data is missing → do not claim sizing is within limits.
3. If CP-2A is missing → do not claim downside is controlled.
4. If current market pricing is missing → do not claim spread is attractive.
5. If portfolio exposure data is missing → do not claim concentration is safe.
6. If Compliance proves binding constraint breach and RV Trader cannot demonstrate headroom → posture cannot be Include.
7. If RV Trader proves attractive spread + controlled downside + mandate headroom but legal leakage unresolved → default = Include (Starter Position) with constraint, not full Include.
8. If both sides rely on weak evidence → use Requires More Work.

## Posture Guardrails
| Evidence Pattern | Default Posture |
|-----------------|----------------|
| Strong RV + controlled downside + acceptable legal + mandate headroom | Include (Core Hold / Add) |
| Strong RV + unresolved legal or liquidity issue | Include (Starter Position) with constraint |
| Average RV + fair fundamentals + manageable downside | Include (Starter Position) or Maintain-Hold |
| Weak RV or spread insufficient for risk | Avoid |
| Concentration / mandate breach or near-breach | Avoid or Resize-Reduce |
| CCC-basket / downgrade risk binding | Avoid or Resize-Reduce |
| Missing CP-3 / market data | Requires More Work |
| Missing mandate / exposure data | Requires More Work |
| Compliance wins implementation liquidity | Avoid or Resize-Reduce |
| RV wins spread but Compliance wins downside | Maintain-Hold or Resize-Reduce |
| Both sides rely on weak evidence | Requires More Work |

</reference>
