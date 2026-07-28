<!-- REF_CP-4A CalculationRules (T2 support) | 2026-06-22 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8) -->
<reference module="CP-4A" name="Calculation Rules, Severity & Status Labels">

Authoritative for all CP-4A capacity calculations (Steps 4–11). Load alongside the CP-4A workflow.

## Calculation Rules
### General Rules
- Use governing legal definitions for covenant tests and capacity formulas.
- Use CP-1 financial definitions only for non-legal reference metrics or where the legal definition explicitly aligns with CP-1.
- Never substitute reported EBITDA for covenant EBITDA without bridge support.
- Never assume cash netting is permitted unless the covenant definition allows it.
- Never assume basket capacity is unused unless source-supported.
- Every calculated item must include: formula, numerator, denominator, source inputs, result, period, status, limitation, and source trace.

### Null/Unavailable Handling
- **Not Available:** source does not disclose a figure.
- **Not Applicable:** provision does not exist or is not relevant.
- **Provisional:** source quality, timing, definition alignment, or completeness limits confidence.
- **Insufficient Information:** calculation cannot be performed without inventing data.
- Store unavailable numeric values as null (not zero) in structured exports, unless the source explicitly states zero.
- Store percentages as decimals where numeric storage is required.

### Core Formulas (Where Legally Supported)
- Maintenance headroom = covenant threshold − current tested ratio (max-ratio tests).
- Coverage headroom = current tested ratio − covenant threshold (min-ratio tests).
- Max additional debt before breach = solve for incremental debt at covenant threshold, using governing EBITDA/netting/pro forma/lien rules.
- Fixed basket remaining = fixed amount − documented utilization.
- Grower basket = greater of fixed amount and % of applicable base (or exact formulation as drafted).
- Builder basket = retained ECF/CNI/available amount build-up + permitted additions − documented usage.
- Ratio debt capacity = debt amount permitted while compliant with ratio test, after pro forma adjustments.
- RP capacity = fixed + builder + ratio-based RP + other permitted categories − documented usage.
- Investment capacity = fixed/grower + permitted acquisition/investment + available amount − documented usage.
- Leakage capacity = sum of value-transfer routes outside creditor reach (no double-counting).

### Double-Counting Discipline
- Do not add overlapping baskets unless the legal document permits independent use.
- Identify fungibility between debt, lien, investment, RP, and USub baskets.
- If baskets are subject to shared caps or reclassification, state the constraint.
- If capacity can be used through multiple routes, record each but do not sum as independent capacity.

### Calculation Evidence Requirements
Every calculation must cite: legal formula source, financial input source, period and currency/units, usage source, source-quality label, limitations and confidence.

## Severity Framework
| Severity | Definition |
|----------|-----------|
| Low | Capacity narrow, ordinary-course, capped, unlikely to change creditor outcome materially |
| Moderate | Capacity can affect leverage/liquidity/leakage but bounded by tests/conditions |
| High | Capacity can materially increase debt, move value, dilute collateral, or weaken lender control |
| Critical | Capacity creates plausible priming, material leakage, recovery impairment, or lender-control loss under stress |
| Insufficient Information | Source package does not support a severity conclusion |

## Data-Quality Confidence Labels
| Label | Required Support |
|-------|-----------------|
| High | Executed legal doc + current financial input + usage tracker/certificate |
| Moderate | Executed legal doc + current financial input, but usage history incomplete |
| Low | Legal provision extracted, but financial inputs stale/partial/management-adjusted |
| Formula Only | Legal formula available, no current calculation support |
| Insufficient | Legal formula or key input missing |

## Capacity Status Labels (7)
Completed | Ready with Limitations | Formula Extracted Only | Provisional | Insufficient Information | Not Applicable | Blocked

## Nearest Pressure Point Selection Rules
Preference order when evidence is comparable:
1. Maintenance covenant headroom with near-term breach relevance.
2. Debt/lien capacity that can prime or dilute existing creditors.
3. RP/investment/USub capacity that can leak value from the restricted group.
4. EBITDA add-back mechanics that inflate all ratio-based capacity.
5. Amendment/waiver mechanics that weaken lender control.
If evidence insufficient → [Insufficient Information] and state what is needed.

</reference>
