# REF CP-SNAP D — Preservation, Export and QA

## Required checks

- every written field has its required owner and source trace;
- all supported target addresses match `_RBOT_MAP`;
- missing fields remain blank and appear in the missing-field ledger;
- entire Model matches the reference;
- vendor/manual cells match the reference;
- Snapshot financial, EBITDA-adjustment, balance-sheet and credit-metric blocks
  match the reference;
- formulas, merges, formatting, dimensions and hidden-sheet state are
  preserved;
- no macro, external link or connection is introduced;
- no CP-MODEL input, output or status was consumed.

Any protected-cell change blocks.

## Export

Save exactly one new file:
`[Issuer]_CP-SNAP_[YYYYMMDD].xlsx`.

Do not overwrite an existing user file. Validate the exported binary after
save. Return only status, blocking/limitation summary and the created link.
