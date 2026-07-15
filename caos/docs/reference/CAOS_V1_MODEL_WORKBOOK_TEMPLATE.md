# CAOS v1 model-workbook specification

The CAOS v1 workbook has exactly six physical sheets: `Cover`, `Model`,
`Assumptions`, `Debt Schedule`, `Overrides`, and `Sources - Audit`. The last
sheet implements the logical `Sources/Audit` contract; `/` cannot appear in an
Excel worksheet title.

Model rows use stable `row_key` values; periods use ISO dates or canonical
`FYyyyy`/`Qn-yyyy` `period_key` values. Display labels may change, but keys may
not be reused. Imported values carry source cell, workbook SHA-256, uploader,
timestamp, type, and units.

Import is a four-step transaction: upload and quarantine; preview; explicit row
and period mapping with validation; authorized commit. Preview has no downstream
effects. Commit is atomic, uses integer-revision compare-and-swap, creates typed
audited overrides, and triggers the one production model calculator plus
downstream recomputation.

CAOS does not execute workbook formulas. On model import, every mapped
authoritative input cell must be a literal value: a formula is informational
only and blocks that input even when the workbook carries a finite cached
result. Cached-formula ingestion belongs only to the separate Bloomberg price
feed contract. External links, macros, volatile functions, circular references,
errors, hidden unexpected sheets, ambiguous keys, and unmapped required rows
fail closed.

`Model` is a presentation of the canonical calculation, not an executable
formula authority. `Assumptions` and `Debt Schedule` carry the importable input
nodes. `Overrides` records typed node replacements, including the displaced
formula/value and audit fields. `Sources/Audit` binds the workbook to the model
revision, engine version, source fingerprint, calculation hash, source IDs, and
export actor/time. Imported formula text is informational only.

## Units and signs

- `reporting_currency` is an ISO 4217 code. `reporting_unit` is the common
  monetary scale for Model and Debt Schedule amounts (for example, `millions`).
  A workbook must not mix raw currency units and millions inside one model.
- Rates are annual decimal fractions, not percentages: `0.05` means `5%`.
  This applies to benchmark, floor, spread, coupon, commitment-fee, and PIK
  rates. Period interest is multiplied by `months / 12`.
- Revenue, EBITDA, cash, debt, taxes, capex, fees, and cash-flow amounts use the
  stated reporting scale. Taxes and capex are entered as positive outflows.
- Cash interest is entered and calculated as a positive expense. A negative
  effective value is invalid and makes dependent coverage and free-cash-flow
  outputs unavailable.
- `working_capital_change` and `other_cash_flow` follow cash-flow signs because
  they are added to free cash flow: positive is a source of cash; negative is a
  use of cash.
- Debt balances, draws, repayments, amortization, commitment, `cash_fees`, and
  `hedge_effect` are stated in the instrument currency at the reporting scale.
  Draws increase debt; repayments and amortization reduce it. Positive
  `cash_fees` and positive `hedge_effect` increase interest expense; a negative
  hedge effect reduces it.
- `fx_rate` is reporting-currency units per one instrument-currency unit. For
  example, a GBP instrument in a USD model uses USD per GBP. Same-currency debt
  uses `1`; cross-currency debt without an explicit rate is incomplete.
