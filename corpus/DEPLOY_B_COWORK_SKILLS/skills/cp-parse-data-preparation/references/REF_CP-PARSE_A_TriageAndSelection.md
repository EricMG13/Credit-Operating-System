# CP-PARSE — Triage and Selection

## Objective

Select documents on downstream evidence value and the benefit of restructuring them, not on page count. Triage is pack-level because duplication, versioning and amendments cannot be judged reliably one file at a time.

## Required inventory fields

For every supplied file record: stable `source_id`, original file name, format, byte size, page/slide/sheet count when available, issuer/entity, title, date/period, document family, version status, language, native-text/OCR status, source hash when available, related/base document and access condition.

## Scoring rubric

| Component | Score | Guide |
|---|---:|---|
| Evidence value | 0–5 | 0 no HY-credit evidence; 1 contextual; 2 limited operating/market context; 3 useful issuer/transaction evidence; 4 material debt/liquidity/legal/financial evidence; 5 authoritative or potentially decision-critical evidence. |
| Authority and uniqueness | 0–3 | 0 derivative/repeated; 1 useful secondary or partly overlapping; 2 primary or meaningfully incremental; 3 definitive/current/unique. |
| Structural benefit | 0–3 | 0 clean direct-use file; 1 minor normalization helps; 2 tables/slides/clauses/layout materially impede use; 3 scan/OCR, complex legal/table structure or fragmented pack requires preparation. |
| Duplication/noise penalty | 0–4 | 0 no penalty; 1 modest repeated matter; 2 predominantly noise/overlap; 3 almost fully duplicated; 4 exact duplicate or no evidence-bearing content. |

The arithmetic supports, but does not replace, the decision rules in the active prompt. Apply accessibility and duplicate gates first. Next apply `PASS_THROUGH` to useful, native-text-complete, structurally simple and bounded evidence—unless exact legal structure is itself material. Use score/complexity to choose full versus targeted parsing after that. A high-value clean earnings release may therefore be `PASS_THROUGH`; a two-page waiver may be `PARSE_FULL`; a 200-page glossy brochure may be `SKIP_LOW_VALUE`.

## Version and duplicate rules

- Hash-identical file: select one copy and mark the rest `SKIP_DUPLICATE`.
- Near duplicate: compare titles, dates, page/slide counts, section map and extracted text. Skip only after confirming the selected version contains all evidence-bearing differences.
- Draft/final: prefer final, but retain the draft when changes or removed provisions may matter.
- Restatement: do not silently replace the original; retain both and label supersession/affected periods.
- Base legal document plus amendment/waiver: treat as a linked set. Never discard the amendment as duplication.
- Presentation plus transcript/earnings release: separate evidence classes; do not deduplicate solely because the event date matches.

## Calibration cases

| Case | Expected decision | Reason |
|---|---|---|
| 180-page annual report with tables and notes | `PARSE_FULL` | Broad authoritative evidence and strong structural benefit. |
| 12-slide lender presentation with leverage and sources & uses | `PARSE_FULL` | Short but dense, unique financing evidence. |
| Two-page covenant waiver | `PARSE_FULL` | Critical-document override; every clause matters. |
| Clean four-page earnings release | `PASS_THROUGH` or `PARSE_TARGETED` | Useful; parse only if tables/layout need normalization or the user requests it. |
| 80-page brand/ESG brochure with no issuer-credit evidence | `SKIP_LOW_VALUE` | Length does not create relevance. |
| Identical annual-report download with a different filename | `SKIP_DUPLICATE` | Hash/content duplicate; reference selected copy. |
| Scanned credit agreement | `PARSE_FULL` using `OCR_SCAN` + `LEGAL_CLAUSE` | High value and high structural benefit. |
| Mixed investor deck with 10 evidence slides and 30 decorative slides | `PARSE_TARGETED` | Preserve evidence slides and map all excluded slides. |
| Password-protected offering memorandum | `BLOCKED` | Request unlocked source; never guess contents. |

## User overrides

Record `force include`, `force exclude`, `priority documents` and `page/slide/clause scope` separately from the default model verdict. An override changes execution but never erases the audit trail or permits fabrication.
