<!-- CP-PARSE Schema Reference | v2.0 | 2026-07-22 -->
<schema_reference module="CP-PARSE" tier="3">

## Owned object

`document_parse_manifest` (`Nested`) — the run-level inventory, triage, parse-job, canonical/output-artifact and ZIP-package contract defined in `CP-PARSE__DataPreparation__payload.schema.txt`.

## Registers

| ID | Register | Required content |
|---|---|---|
| P1 | Pack Inventory | every supplied source, identity, family, version, locator units, hash/access state |
| P2 | Triage Register | score components, decision, override, reason, related/replacement source |
| P3 | Parse Jobs | profile(s), extraction modes, full/targeted scope, locator type, status |
| P4 | Content Coverage | inspected, retained, excluded and unreadable page/slide/sheet units |
| P5 | Evidence Objects | sections, tables, charts, legal clauses and sheet ranges with fidelity state |
| P6 | Output Artifacts | authoritative Markdown, requested DOCX/PDF state, parity/checksum and limitations |
| P7 | ZIP Batches | batch name/order, entries, source output sets, byte limits, checksum and safety status |
| P8 | Verification | triage, fidelity, coverage, requested exports, package and batch reconciliation gates |

## Decision enums

`PARSE_FULL`, `PARSE_TARGETED`, `PASS_THROUGH`, `SKIP_DUPLICATE`, `SKIP_LOW_VALUE`, `BLOCKED`.

## Document-family enums

`ANNUAL_REPORT`, `QUARTERLY_REPORT`, `EARNINGS_RELEASE`, `INVESTOR_PRESENTATION`, `LENDER_PRESENTATION`, `LEGAL_FINANCING`, `OFFERING_TRANSACTION`, `SPREADSHEET_SCHEDULE`, `OTHER`, with multiple profiles permitted for hybrids.

## Extraction-mode enums

`LAYOUT_TEXT`, `TABLE_FIRST`, `SLIDE_CHART`, `LEGAL_CLAUSE`, `OCR_SCAN`, `SHEET_RANGE`, `HYBRID`.

## Output contract

Every parsed source has validated canonical Markdown. The user may request editable DOCX, one package-overview visual PDF, or both; per-source PDFs require an explicit request. All canonical Markdown and declared requested exports are delivered inside one or more `[PackKey]_CP-PARSE_[YYYYMMDD]_BATCH-[NNN]-of-[NNN].zip` files with `PACKAGE_INDEX.md`, `TRIAGE_REGISTER.md`, `BATCH_INDEX.md` and `CHECKSUMS.sha256`. A no-selection run emits canonical triage Markdown and only requested optional exports in a triage-only ZIP. Loose-file delivery is not completion.

## QA

Inventory complete; decisions/scoring reconciled; critical override applied; duplicates/version sets resolved; locators/coverage complete; tables/charts/clauses faithful or degraded; values verbatim; canonical Markdown complete; requested exports independently parity-checked; ZIP paths safe; checksums correct; no missing, duplicate or split declared output set; batches reconcile.

</schema_reference>
