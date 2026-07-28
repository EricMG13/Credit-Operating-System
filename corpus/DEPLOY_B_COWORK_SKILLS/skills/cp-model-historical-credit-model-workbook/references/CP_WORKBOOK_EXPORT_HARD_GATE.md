# CP Workbook Export Hard Gate

Version: 1.0  
Applies only to: `CP-MODEL`, `CP-SNAP`

## Identity lock

`WORKBOOK_EXPORT` is valid only for CP-MODEL and CP-SNAP. These modules are
deployed in Structures A and B. Packaging differs, but the runtime capability,
template, preservation and validation gates are identical.

| Module | Owned object | Permitted file |
|---|---|---|
| CP-MODEL | `historical_credit_model_workbook` | `[Issuer]_CP-MODEL_[YYYYMMDD].xlsx` |
| CP-SNAP | `qualitative_credit_snapshot_workbook` | `[Issuer]_CP-SNAP_[YYYYMMDD].xlsx` |

## Runtime hard gates

1. A file-generation runtime capable of reading and writing `.xlsx` is mandatory.
   CP-MODEL additionally requires reliable row insert/delete, style/formula copy
   and shifted-reference update capability.
2. The exact shared binary `REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx` is mandatory.
   A link, shortcut, missing-file message or other text placeholder is not the
   template and must fail before population.
3. Work on a fresh in-memory or temporary copy. Never overwrite the reference.
4. Export exactly one validated `.xlsx` for the invoked module.
5. Do not emit an analytical Markdown, DOCX or PDF artifact.
6. Return only concise status, limitations and a link to the workbook actually created.
7. `confidence_score` and `confidence_band` do not apply to this output class.

## Preservation hard gates

- Preserve worksheet names, visible layout, dimensions, formatting, formulas,
  merged cells, named controls and unmapped cells.
- CP-MODEL may resize only ranges classified `MODEL_REPEAT_BLOCK`, with
  identical row operations in `Model` and `_RBOT_INPUTS`, and may write only
  cells classified `MODEL_SOURCE`. `MODEL_FORMULA` cells remain formulas.
- CP-SNAP may write only cells classified `SNAP_SUPPORTED`.
- `VENDOR_MANUAL`, `MODEL_DERIVED_SNAPSHOT`, `FORECAST_LOCKED`,
  `PRESERVE` and `CONTROL` are never runtime write targets.
- Reject an export if a protected cell, formula or sheet differs from the
  reference outside the invoked module's authorised write set.

## Independence hard gate

CP-MODEL and CP-SNAP do not consume, invoke, wait for, recommend, merge with or
route to one another. Each starts from the shared reference workbook and
produces its own independent export.

## Fail closed

Do not export when the template is missing or incompatible, the required
upstream owner is not ready, a mandatory mapping is unresolved, a protected
cell would change, structural repeat-block operations cannot be performed
without loss, or workbook validation fails. Never truncate or merge
issuer-specific business-unit or add-back rows to fit template placeholders.
