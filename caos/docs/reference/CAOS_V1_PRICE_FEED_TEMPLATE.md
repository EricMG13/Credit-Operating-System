# CAOS v1 price-feed workbook specification

The market import boundary is `.xlsx` only. Macro-enabled, binary, CSV, and
legacy `.xls` files are rejected before parsing. Preview is stateless: it scans,
validates, and normalizes without writing the vault or database. Commit receives
the workbook again, verifies the preview SHA-256, and repeats the same validation
before creating any immutable artifact.

## Canonical fields

Every row requires:

- `figi` or an explicit stable `instrument_key`;
- `borrower`;
- `instrument`;
- `currency`;
- `price`;
- `discount_margin`; and
- `as_of`.

Optional fields are `bid`, `ask`, `benchmark`, `floor`, `spread`, `maturity`,
`seniority`, `rating`, `sector`, and `sub_sector`.

Canonical headers and unambiguous aliases may resolve automatically. The analyst
must explicitly select the sheet/header when more than one candidate exists and
must explicitly map noncanonical headers. CAOS never silently chooses Bid or Ask
as Price. Currency and market as-of may be explicit analyst constants when the
workbook applies one value to every row. Upload time is observation metadata only
and never substitutes for market as-of.

Issuer linkage is exact FIGI or an explicit authorized issuer mapping. Borrower
names are descriptive data, not identity keys, and are never fuzzy matched.
Duplicate instrument keys or inconsistent/future as-of values block commit.

## Formula and hostile-input policy

CAOS never calculates workbook formulas. Independent formula and cached-value
views are opened so formulas cannot be hidden by `data_only=True`. Every mapped
formula cell is disclosed in preview; a required formula cell without an
acceptable finite cached value is blocking. External-reference formulas,
external relationships, macros, embedded objects, connections, query tables,
encrypted/duplicate/traversing ZIP members, excessive compression, and workbook
sheet/row/column/cell/string/formula limits fail closed.

ClamAV runs before any OOXML parser whenever configured and a configured scanner
failure rejects the upload. A successful preview returns the workbook SHA-256,
selected mapping, source as-of, normalized counts/row sample, and a deterministic
blocking/warning ledger. Only a revalidated preview with zero blocking issues may
be committed.
