# CP-PARSE — Packaging and QA

## Per-source output set

For each parsed source, author and validate canonical Markdown first:

- required `[SourceKey]_CP-PARSE_[YYYYMMDD].md`;
- optional requested `[SourceKey]_CP-PARSE_[YYYYMMDD].docx`.

The Markdown front matter records module/run/source IDs, source name/hash, document family/profile, decision, parse mode, period/date, locator type, coverage, limitations, `qa_status`, confidence score/band and package batch. Requested DOCX is copy-only. A requested visual PDF defaults to one `[PackKey]_CP-PARSE_[YYYYMMDD]_VISUAL.pdf` package overview; per-source PDFs require explicit request.

## ZIP batching

Name batches `[PackKey]_CP-PARSE_[YYYYMMDD]_BATCH-[NNN]-of-[NNN].zip`. Sort sources deterministically by issuer/entity, document date, document family and source ID. Keep each source's canonical Markdown and declared requested exports together. Default limits are 20 parsed sources or 250 MB uncompressed per batch; reduce for tenant/runtime constraints and record the effective limit.

Every ZIP contains:

1. `PACKAGE_INDEX.md` — pack/run identity, total batches, counts by decision/profile, limitations and next step.
2. `TRIAGE_REGISTER.md` — every input and its scores, decision, selected replacement/related base and reason.
3. `BATCH_INDEX.md` — entries in this batch and links/names for other batches.
4. `CHECKSUMS.sha256` — SHA-256 for every packaged file other than the checksum file itself.
5. `parsed/[SourceKey]/...` — canonical Markdown plus declared requested exports.
6. `originals/...` only when the user explicitly requests originals and the runtime permits it.

Reject absolute paths, `..`, hidden/secret files, executable content and duplicate ZIP member names. Do not nest ZIPs. Filenames use safe ASCII slugs while indexes preserve original names.

## Triage-only run

If no source is parsed, produce canonical `TRIAGE_REGISTER.md`, required indexes/checksum, and only requested optional exports in a triage-only ZIP. State `NO_PARSE_CANDIDATES`; do not create empty placeholder parsed files.

## Verification gates

1. All intake files appear exactly once in the triage register.
2. Scores add correctly and critical overrides/user overrides are disclosed.
3. Duplicate decisions name the selected copy and document non-overlap inspection.
4. Every parsed block/table/chart/clause has a valid locator or explicit limitation.
5. Visible values and text match the source; no invented calculations or interpretation.
6. Coverage reconciles for every selected source.
7. Every selected source has valid canonical Markdown; every requested export passes its parity and required metadata gate.
8. Every declared source output set occurs in exactly one batch and is not split.
9. Batch indexes, counts and names agree across all ZIPs.
10. Checksums match extracted bytes; safe paths and unique members pass.

Any unresolved failure in inventory, fidelity, canonical Markdown completeness, ZIP safety, checksum or batch reconciliation blocks package delivery. A requested DOCX/PDF failure is reported independently and does not invalidate valid Markdown. Lower-severity OCR/table degradation may ship only with per-source and package-level limitations.
