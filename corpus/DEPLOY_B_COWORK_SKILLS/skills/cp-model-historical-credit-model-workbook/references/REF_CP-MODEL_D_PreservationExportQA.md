# REF CP-MODEL D — Preservation, Export and QA

## Required checks

- source IDs and locators complete;
- period and account keys unique;
- segment revenue to reported revenue;
- EBITDA and adjusted-EBITDA bridges;
- exact issuer-specific business-unit and add-back row counts, IDs, labels and
  display order match CP-1;
- `Model` and `_RBOT_INPUTS` repeat blocks have identical row counts;
- formulas, styles, references and `_RBOT_MAP` addresses remain valid after
  every row insertion/deletion;
- all runtime repeat rows use exact `segment_id`/`addback_id`-derived field IDs;
  no template-slot field ID remains in the exported workbook;
- CFO = FFO + working-capital change;
- FCF and NCF identities;
- secured and total debt sums;
- reported FY versus quarterly sum, with audit/basis explanation;
- all mapped cells written or explicitly null;
- all template formulas preserved;
- Credit Snapshot unchanged;
- PF/base/downside forecast cells unchanged;
- hidden controls remain hidden;
- no `#REF!`, `#DIV/0!`, `#VALUE!` or `#NAME?`;
- no macro, external link, connection or vendor formula.

Warn, rather than force equality, when audited FY differs from unaudited
quarterly accounts and CP-1/CP-1B document the basis. All other unresolved
mandatory mismatches block.

## Export

Save exactly one new file:
`[Issuer]_CP-MODEL_[YYYYMMDD].xlsx`.

Do not overwrite an existing user file. Validate the exported binary after
save. Return only status, blocking/limitation summary and the created link.
There is no CP-SNAP handoff.
