---
name: CP-MODEL Historical Credit Model Workbook
description: Select for an explicit CP-MODEL command that converts ready CP-1 numeric schedules, checked by CP-1B, into the historical Model sheet. Handles paired repeat-block resizing and returns a single formula-preserving XLSX; exclude CP-2G forecasts and Credit Snapshot narratives.
---

# Module: CP-MODEL — HistoricalCreditModelWorkbook

## Structure-B launcher

This is the terminal, manually invoked `WORKBOOK_EXPORT` for historical
quarterly, YTD, reported-FY and LTM credit-model data. It has the same
calculation, preservation and independence contract as the Structure A
CP-MODEL agent. It is not an automatic RBOT node and has no downstream
consumer.

Before touching a workbook:

1. Load `./references/MODULE_RUNBOOK.md` in full.
2. Confirm the host can read, edit, validate and return binary `.xlsx` files.
3. Confirm it can insert/delete paired rows, copy styles and formulas, and
   update shifted references without loss. If not, block without export.
4. Require matching, ready CP-1 and CP-1B canonical handoffs.
5. Resolve the exact workbook from
   `./assets/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx`; never request or accept a
   session attachment, shortcut, URL or text placeholder as the template.
6. Save the matching canonical handoffs as local UTF-8 Markdown files, then
   run `python ./scripts/export_cp_model.py --cp1 <CP-1.md> --cp1b
   <CP-1B.md> --output-dir <destination>`.
7. Proceed only when the script returns `"status": "complete"`. Return its
   single canonical `.xlsx` output. On `"status": "blocked"`, return the
   reported condition and no workbook; do not substitute a template copy.

CP-1 owns numeric truth; CP-1B validates it. Resize only the two authorised
`MODEL_REPEAT_BLOCK` ranges in both `Model` and `_RBOT_INPUTS`. Write only
`MODEL_SOURCE` cells, preserve `MODEL_FORMULA` cells as formulas, reconcile all
specified checks, and emit exactly one
`[Issuer]_CP-MODEL_[YYYYMMDD].xlsx`. Never emit analytical Markdown, DOCX or
PDF, write the Credit Snapshot or forecasts, or consume/invoke CP-SNAP.

<!-- CANON_CORE:BEGIN -->
Structure-B loads the byte-identical `./references/MODULE_RUNBOOK.md` before analysis. The binding canon hard gates are retained once in the recap below; load `./references/CANON_RELEVANT.md` only to resolve a named canon ambiguity.
<!-- CANON_CORE:END -->

## Shared support files

- `./references/SCHEMA_REFERENCE.md` — CP-MODEL input and output contract.
- `./references/CP-MODEL__HistoricalCreditModelWorkbook__payload.schema.txt`
  — module payload schema.
- `./references/CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt` — shared workbook
  payload base.
- `./references/REF_CP-MODEL_A_SourceTemplateGate.md` — source, scope,
  readiness and template gate.
- `./references/REF_CP-MODEL_B_PeriodAccountMapping.md` — period hierarchy,
  accounts and repeat-block rules.
- `./references/REF_CP-MODEL_C_ModelMath.md` — formula and reconciliation
  rules.
- `./references/REF_CP-MODEL_D_PreservationExportQA.md` — preservation,
  binary validation and export QA.
- `./references/CP_WORKBOOK_EXPORT_HARD_GATE.md` — binding workbook hard
  gates.
- `./references/CP_WORKBOOK_EXPORT_SPEC.md` — shared export specification.
- `./references/CANON_RELEVANT.md` — focused canon for a named ambiguity only.
- `./assets/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx` — canonical binary output
  asset; do not load it as reference text.
- `./scripts/export_cp_model.py` — production exporter. It validates the
  canonical CP-1/CP-1B contracts, resizes both authorised repeat blocks,
  regenerates shifted map rows, writes only mapped source cells, verifies
  formulas and preservation, and derives the required output filename.
- `./scripts/validate_cp_model_inputs.py` and `./scripts/validate_handoff.py`
  — strict validators used by the production exporter.
- `./scripts/materialize_workbook_asset.py` — validates the asset signature
  and creates an exclusive diagnostic working copy; it is not the production
  export path.

If any required upstream, mapping, runtime capability or protected-cell check
fails, return concise blocking conditions and no workbook.

<!-- CANON_RECAP:BEGIN -->
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
<!-- CANON_RECAP:END -->
