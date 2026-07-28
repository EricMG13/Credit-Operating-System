# REF CP-MODEL A — Source and Template Gate

## Source gate

Accept only matching CP-1 and CP-1B canonical Markdown handoffs. Validate:

- module identity and common handoff envelope;
- exact stable table-ID comments;
- table headers and controlled identifiers;
- unique period IDs, `(metric_id, period_id)`, `(segment_id, period_id)` and
  `(addback_id, period_id)` keys;
- cross-table period references;
- source locators for sourced values;
- absence of mandatory reconciliation `BLOCK`;
- exactly one `ready` CP-MODEL row from each owner.

CP-1B can identify a mismatch but cannot emit or select a replacement CP-1
value. A CP-1B `BLOCK` blocks the workbook.

## Template gate

Require exact filename `REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx` and template
version `CP-MODEL-SNAPSHOT-v1.0`. Verify the five-sheet registry, hidden
control-sheet state, `_RBOT_MAP` headers and absence of macro, external-link or
connection parts.
In Structure B resolve the binary only from
`./assets/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx` and validate it with the
packaged materializer; never substitute a session attachment, shortcut, URL or
placeholder text.

Create a fresh working copy. Record reference hash and output hash. Never
overwrite the reference.

## Capability gate

The runtime must be able to open a binary workbook, preserve formatting and
formulas, insert/delete rows inside authorised repeat blocks, copy the complete
row style/formula pattern, update shifted references and map addresses, write
mapped cells and export a downloadable `.xlsx`. If any structural operation
cannot be performed reliably, or the runtime can only read indexed knowledge
text, stop without an export.
