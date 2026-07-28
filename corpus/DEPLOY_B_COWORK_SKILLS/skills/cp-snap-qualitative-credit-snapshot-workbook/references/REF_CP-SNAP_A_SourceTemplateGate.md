# REF CP-SNAP A — Source and Template Gate

Validate one matching canonical output from every active supported owner:
CP-1A, CP-1B, CP-2 and CP-2B. Confirm issuer, as-of context and entity
perimeter. Material conflict blocks.

Required owner status is ready/supported for its fields. A missing owner is a
hard blocker because the approved V1 map treats every supported field owner as
mandatory. A missing field within an otherwise ready owner remains blank and
is logged; it is never synthesized from another module.

Require exact binary `REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx`, version
`CP-MODEL-SNAPSHOT-v1.0`, the five-sheet registry, hidden controls and active
`SNAP_SUPPORTED` map rows. Reject macros, external links and connections.
In Structure B resolve the binary only from
`./assets/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx` through the packaged exporter;
never substitute a session attachment, shortcut, URL or placeholder text.

Create a fresh working copy and record reference/output hashes. If the runtime
cannot manipulate and export a binary `.xlsx`, stop.
