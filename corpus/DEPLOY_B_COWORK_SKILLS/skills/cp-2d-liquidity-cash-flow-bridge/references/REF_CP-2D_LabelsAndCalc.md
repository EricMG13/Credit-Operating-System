<!-- REF_CP-2D LabelsAndCalc (T2 support) | 2026-06-22 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8) -->
<reference module="CP-2D" name="Liquidity Labels, Categories & Calculation Rules">

Authoritative for CP-2D bridge construction and risk classification (Steps 2–8). Load alongside the CP-2D workflow. The Liquidity-to-Credit Translation rules stay in the ACTIVE_PROMPT.

## Liquidity Component Labels
Cash | Restricted cash | Revolver commitment | Revolver drawn | Undrawn revolver | Accessible revolver availability | Borrowing-base constrained availability | Covenant-constrained availability | Other committed liquidity | Asset-sale proceeds | Sponsor support | Equity cure | Working-capital release

## Cash-Use Categories
Cash interest | Cash taxes | Debt amortization | Maturity | Lease payment | Mandatory capex | Growth capex | Restructuring cost | Integration cost | Working-capital outflow | Dividend / distribution | Litigation / settlement | Pension contribution | Other mandatory cash use | Other discretionary cash use

## Liquidity Data Status Labels
NOTE: These classify the data-quality basis of individual bridge items. Distinct from the canonical 8-value Calculation Status taxonomy (CP-1).
Reported | Calculated | Provisional | Management-guided | Analyst estimate | Insufficient Information | Not Available | Not Comparable | Conflict Logged | Blocked

## Liquidity Risk Levels
**Adequate:** Source-supported liquidity coverage of mandatory cash uses; no identified access constraint that materially weakens availability.
**Tight:** Liquidity covers near-term needs but headroom is narrow, seasonal, covenant-constrained, or dependent on execution.
**Weak:** Accessible liquidity appears insufficient, near-term maturities/cash burn are material, or covenant/revolver access constraints materially pressure liquidity.
**Insufficient Information:** Decision-useful classification not supportable.

## Monitoring Trigger Types
Cash below threshold | Revolver draw | Revolver availability decline | Working-capital outflow | Cash burn acceleration | Capex inflexibility | Maturity wall | Covenant access constraint | Borrowing-base deterioration | Sponsor support dependence | Asset-sale dependence | Refinancing failure | Reporting gap

## Core Calculation Definitions
- **Cash** = reported cash and cash equivalents, excluding restricted cash unless source explicitly says available.
- **Accessible revolver** = disclosed undrawn and available committed capacity after borrowing-base, covenant, jurisdictional, collateral, and other known constraints.
- **Beginning accessible liquidity** = Cash + Accessible revolver + Other committed accessible liquidity (source-supported).
- **12-month cash uses** = mandatory + source-supported discretionary cash uses within bridge horizon.
- **Ending accessible liquidity** = Beginning accessible liquidity + operating cash inflow/outflow + WC impact − cash interest − cash taxes − mandatory capex − debt amortization/maturities − other cash uses + committed inflows (source-supported).
- **Months to Empty** = Beginning accessible liquidity / average monthly cash burn. Calculate only where both inputs are supported.

## Calculation Rules
1. Use Python for all liquidity runway, bridge total, average monthly cash burn, revolver availability, cash-use, headroom, and Months to Empty calculations.
2. Distinguish cash from total liquidity; distinguish committed available revolver from inaccessible/covenant-constrained liquidity.
3. Do not calculate Months to Empty unless beginning accessible liquidity and cash-burn basis are supported.
4. If cash burn is based on a recent period, state source period and whether recurring, seasonal, or distorted.
5. Store unavailable numeric values as null in structured exports, not zero.
6. Percentages must be stored as decimals where numeric storage is required.
7. Preserve CP-1 metric definitions where applicable.

</reference>
