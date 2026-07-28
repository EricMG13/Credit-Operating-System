# CP Workbook Export Specification

Version: 1.0  
Output class: `WORKBOOK_EXPORT`

## Common contract

Every run consumes the exact shared reference workbook, validates its workbook
signature and writes a new `.xlsx`. The response contains a concise status and
the created file link; the workbook is the sole artifact and handoff.

Required payload fields are defined by
`MODULE_PAYLOADS/CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt`.

## Shared reference

Expected file:
`../06_WORKBOOK_TEMPLATES/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx`

Structure A deploys a flat binary copy beside the agent instructions.
Structure B packages the same bytes at
`./assets/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx`; the workbook must not be
placed under `references/` or transferred through a session attachment,
shortcut or URL placeholder. A Structure B exporter must resolve the asset
relative to its own script, validate the registered SHA-256 and create a fresh
working copy before any write.

Expected worksheets, in order:

1. `Model` — visible
2. `Credit Snapshot` — visible
3. `_RBOT_INPUTS` — hidden
4. `_RBOT_MAP` — hidden
5. `_RBOT_CHECKS` — hidden

The `_RBOT_MAP` sheet is the authority for runtime write permissions. A yellow
fill is visual guidance, not permission by itself.

## Write classes

| Class | CP-MODEL | CP-SNAP | Meaning |
|---|---:|---:|---|
| MODEL_REPEAT_BLOCK | resize mapped rows | preserve | paired issuer-specific row block |
| MODEL_SOURCE | write | preserve | sourced historical value |
| MODEL_FORMULA | formula only | preserve | model calculation |
| SNAP_SUPPORTED | preserve | write | supported qualitative field |
| MODEL_DERIVED_SNAPSHOT | preserve | preserve | excluded from CP-SNAP V1 |
| VENDOR_MANUAL | preserve | preserve | vendor/tool or manual field |
| FORECAST_LOCKED | preserve | preserve | PF/base/downside forecast |
| CONTROL | preserve | preserve | map/check/provenance cell |
| PRESERVE | preserve | preserve | all other cells |

## Validation

Before returning a file:

- validate workbook signature and sheet registry;
- validate every write against module and write class;
- validate each repeat block has exact upstream IDs, labels, order and count;
- validate `Model`/`_RBOT_INPUTS` row operations remain paired and every
  shifted formula/map address remains valid;
- ensure formulas contain no broken reference or Excel error token;
- ensure no macro, external link, connection or vendor formula was introduced;
- ensure protected-cell hashes match the reference;
- expose source, mapping, period, reconciliation and preservation results in
  `_RBOT_CHECKS`.

The exporters never depend on one another.
