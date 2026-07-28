# CP-MODEL Schema Reference

Central payload:
`CP-MODEL__HistoricalCreditModelWorkbook__payload.schema.txt`

## Workbook contract

Expected worksheets:

1. `Model` — visible
2. `Credit Snapshot` — visible and preserved
3. `_RBOT_INPUTS` — hidden
4. `_RBOT_MAP` — hidden
5. `_RBOT_CHECKS` — hidden

Authorised operations are `MODEL_REPEAT_BLOCK` structural resizing in the two
mapped row ranges and `MODEL_SOURCE` writes in `_RBOT_INPUTS`. Visible
`MODEL_FORMULA` cells remain formulas. `FORECAST_LOCKED`,
`SNAP_SUPPORTED`, `MODEL_DERIVED_SNAPSHOT`, `VENDOR_MANUAL`, `PRESERVE` and
`CONTROL` are protected.

## Required runtime records

- `periods_written`: unique CP-1 period IDs.
- `metrics_written`: unique CP-1 metric IDs.
- `repeat_blocks`: group, source/rendered row count and status for both
  issuer-specific variable row blocks.
- `formula_checks`: check ID, PASS/WARN/BLOCK, detail.
- `reconciliations`: check ID, PASS/WARN/BLOCK, detail.
- `preservation_checks`: check ID, PASS/WARN/BLOCK, detail.

`qa_status` is `Passed` only when there is no BLOCK, workbook structure is
valid, formulas have no error token and every protected region matches the
reference.

Output: `[Issuer]_CP-MODEL_[YYYYMMDD].xlsx`.
