# CP-SNAP Schema Reference

Central payload:
`CP-SNAP__QualitativeCreditSnapshotWorkbook__payload.schema.txt`

## Authorised fields

| field_id | owner | target class |
|---|---|---|
| company | CP-1A | SNAP_SUPPORTED |
| sector | CP-1A | SNAP_SUPPORTED |
| shareholders | CP-1A | SNAP_SUPPORTED |
| country | CP-1A | SNAP_SUPPORTED |
| transaction_summary | CP-1A | SNAP_SUPPORTED |
| business_description | CP-1A | SNAP_SUPPORTED |
| historical_performance | CP-1B | SNAP_SUPPORTED |
| strengths | CP-2 | SNAP_SUPPORTED |
| weaknesses | CP-2 | SNAP_SUPPORTED |
| catalysts_near_term_events | CP-2B | SNAP_SUPPORTED |

The live `_RBOT_MAP` cell addresses are authoritative.

## Required runtime records

- `fields_written`: field ID, owner module, `written`.
- `missing_fields`: field ID, owner module, `missing`.
- `ignored_fields`: field ID, owner module, `ignored`.
- `preservation_checks`: check ID, PASS/WARN/BLOCK, detail.

Output: `[Issuer]_CP-SNAP_[YYYYMMDD].xlsx`.
