<!-- REF_CP-0_ExampleOutputPattern.md (T2 Example Library) | 2026-07-26 | Markdown-first optional-export contract -->

# CP-0 example output pattern

Governing contract: `CP_AB_EXPORT_SPEC.md`, `CP_CONFIDENCE_SCORE.md`

## Output order

1. Author complete canonical Markdown.
2. Validate contract and identity, fail closed.
3. Create an editable DOCX, a visually rich PDF, or both only when requested.
4. Verify each requested view independently and return concise status, limitations, and links actually created.

## Canonical Markdown — required

Filename: `[IssuerID]_CP-0_[YYYYMMDD].md`

The canonical file is the authoritative analytical output and the handoff
attached as grounding to CP-X. It contains the YAML front-matter envelope,
including `confidence_score` and `confidence_band`, followed by the canonical
H2 headings:

- `## Audit Summary`
- `## Analysis`
- `## Evidence Trace`
- `## Source Registry`
- `## Gaps & Conflicts`
- `## QA Validation`

The analysis includes the Source Register, Readiness Summary, Routing
Recommendation, and all required audit material.

## Optional editable DOCX — only when requested

Filename: `[IssuerID]_CP-0_[YYYYMMDD].docx`

The deterministic Word view is projected from validated Markdown without
analytical rewriting and passes ordered-block parity. It uses a professional
header, Audit Summary, analysis narrative, and one compact Audit Appendix.

## Optional visual PDF — only when requested

Filename: `[IssuerID]_CP-0_[YYYYMMDD]_VISUAL.pdf`

The visual report uses CP-0's production profile and a compact canonical
appendix. It preserves canonical table cells and numeric tokens, remains A4,
and stays within the profile page budget. It is not a replica of the DOCX.

A failed optional view does not invalidate valid Markdown or a successful
sibling export. No lettered appendices, embedded JSON blocks, export manifest,
or extraction envelope. No separate rendering/parsing agent or database is
used; optional export views use the shared deterministic tools.
