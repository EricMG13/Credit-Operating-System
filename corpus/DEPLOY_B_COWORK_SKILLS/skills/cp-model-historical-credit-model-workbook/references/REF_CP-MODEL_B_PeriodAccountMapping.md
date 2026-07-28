# REF CP-MODEL B — Period and Account Mapping

## Period hierarchy

1. Use direct reported discrete quarter when available.
2. If absent, Q2 = H1 − Q1 and Q3 = 9M − H1.
3. Use reported unaudited Q4 independently when available.
4. Only if Q4 is absent, calculate Q4 = reported FY − 9M and label it
   calculated.
5. Use direct reported audited FY. Never replace it with a quarterly sum.
6. Flow LTM = latest FY + current YTD − prior comparable YTD, or the
   equivalent four discrete quarters when the same perimeter/basis is locked.
7. Balance-sheet LTM = latest period end.
8. A missing component makes the derived value null.

Quarterly, YTD, FY and LTM can legitimately differ because audit status,
restatement or perimeter differs. Keep both representations and disclose the
reconciliation.

## Account mapping

Use `_RBOT_MAP` as the sole cell-address authority. Populate `_RBOT_INPUTS`
from the CP-1 Model Account Register, Segment Revenue Schedule, Adjusted EBITDA
Bridge and Debt Facility Register.

Before value mapping, process exactly two `MODEL_REPEAT_BLOCK` definitions:

- `business_unit_revenue`: one source row and one paired YoY formula row per
  distinct `OPERATING_SEGMENT` `segment_id`, ordered by `display_priority`;
- `adjusted_ebitda_addbacks`: one source row per distinct `addback_id`, ordered
  by `display_priority`.

Insert or delete the identical row count in `Model` and `_RBOT_INPUTS`, copy
the template row pattern including style/number format/borders/formulas, replace
labels with exact upstream names, and update all shifted formulas and map
addresses. Keep `CORPORATE_ELIMINATION` as its separate row. There is no maximum
slot count: never truncate, combine or relabel source items. Remove unused
placeholders. An explicitly empty add-back bridge collapses its block.

Expand placeholder map entries to deterministic runtime field IDs:
`segment_revenue::<segment_id>` and
`adjusted_ebitda_addback::<addback_id>`. Retain the applicable `period_id` on
each expanded map row. No exported workbook may retain a template-slot field ID.

Use inflows and positive balances as positive; outflows as negative. Preserve
source signs in the CP-1 audit record. Map:

- cash-flow Interest → `cash_interest_paid`;
- cash-flow Tax → `cash_taxes_paid`;
- CFO → `cfo_ncfo` (CFO/OCF/NCFO/net cash provided by operations);
- debt totals → carrying values, not principal;
- Tax Rate → sourced `effective_tax_rate`, else
  `income_tax_expense / pretax_income`;
- visible `SG&A % Sales` → semantic metric `opex_pct_sales`.

Do not source the visible FFO `Other` row. It is the calculated reconciliation
residual defined in REF C.
