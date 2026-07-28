---
name: CP-SNAP Qualitative Credit Snapshot Workbook
description: Select for an explicit CP-SNAP command that maps CP-1A issuer facts, CP-1B performance commentary, CP-2 strengths and weaknesses, and CP-2B catalysts into authorised qualitative Credit Snapshot cells. Returns a single XLSX while leaving the Model, vendor/manual and model-derived fields untouched.
---

# Module: CP-SNAP — QualitativeCreditSnapshotWorkbook

## Structure-B launcher

This is the terminal, manually invoked `WORKBOOK_EXPORT` for supported
qualitative Credit Snapshot fields. It has the same mapping, preservation and
independence contract as the Structure A CP-SNAP agent. It is not an automatic
RBOT node and has no downstream consumer.

Before touching a workbook:

1. Load `./references/MODULE_RUNBOOK.md` in full.
2. Confirm the host can run Python, create files and return binary `.xlsx`
   files. If not, block without export.
3. Require matching, ready CP-1A, CP-1B, CP-2 and CP-2B canonical handoffs.
4. Resolve the exact workbook from
   `./assets/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx`; never request or accept a
   session attachment, shortcut, URL or text placeholder as the template.
5. Create one temporary JSON request containing only:
   `issuer_file_token`, `export_date` (`YYYY-MM-DD`) and `owner_payloads`.
   `owner_payloads` must contain exactly CP-1A, CP-1B, CP-2 and CP-2B, using
   the field IDs declared by `_RBOT_MAP`.
6. Run `python ./scripts/export_cp_snap.py --payload <request.json>
   --output-dir <destination>`. Proceed only when it returns
   `"status": "complete"` and the derived canonical `.xlsx` path.
7. Never edit or overwrite the packaged asset.

Read the active `_RBOT_MAP` rows and write only `SNAP_SUPPORTED` targets from
their named owners. Preserve the entire Model plus every `VENDOR_MANUAL`,
`MODEL_DERIVED_SNAPSHOT`, `FORECAST_LOCKED`, `PRESERVE` and `CONTROL` cell.
Validate protected cells, formulas, owner trace and the missing-field ledger,
then emit exactly one `[Issuer]_CP-SNAP_[YYYYMMDD].xlsx`. Never emit analytical
Markdown, DOCX or PDF, populate vendor/manual or model-derived fields, or
consume/invoke CP-MODEL.

<!-- CANON_CORE:BEGIN -->
Structure-B loads the byte-identical `./references/MODULE_RUNBOOK.md` before analysis. The binding canon hard gates are retained once in the recap below; load `./references/CANON_RELEVANT.md` only to resolve a named canon ambiguity.
<!-- CANON_CORE:END -->

## Shared support files

- `./references/SCHEMA_REFERENCE.md` — CP-SNAP input and output contract.
- `./references/CP-SNAP__QualitativeCreditSnapshotWorkbook__payload.schema.txt`
  — module payload schema.
- `./references/CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt` — shared workbook
  payload base.
- `./references/REF_CP-SNAP_A_SourceTemplateGate.md` — source, scope,
  readiness and template gate.
- `./references/REF_CP-SNAP_B_QualitativeMap.md` — supported owner-to-cell map.
- `./references/REF_CP-SNAP_C_PopulationRules.md` — narrative population and
  exclusion rules.
- `./references/REF_CP-SNAP_D_PreservationExportQA.md` — preservation,
  binary validation and export QA.
- `./references/CP_WORKBOOK_EXPORT_HARD_GATE.md` — binding workbook hard
  gates.
- `./references/CP_WORKBOOK_EXPORT_SPEC.md` — shared export specification.
- `./references/CANON_RELEVANT.md` — focused canon for a named ambiguity only.
- `./assets/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx` — canonical binary output
  asset; do not load it as reference text.
- `./scripts/materialize_workbook_asset.py` — optional isolated asset
  validation and working-copy materializer.
- `./scripts/export_cp_snap.py` — required deterministic CP-SNAP exporter. It
  derives `[Issuer]_CP-SNAP_[YYYYMMDD].xlsx`, validates the asset SHA-256,
  writes only `SNAP_SUPPORTED` targets and verifies all protected OOXML bytes
  before publishing the output.

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
