# CP-3D F — Output and QA

Required QA tests:

1. Security identifiers and terms match the observed quote.
2. Every market value has source, timestamp, quote type and freshness status.
3. Price, yield, spread, benchmark, call and settlement conventions are explicit.
4. Vendor observations remain separate from RBOT calculations.
5. Implied risk is labelled model-dependent with assumptions and sensitivity.
6. Liquidity/ownership/flow claims are evidence-backed and dated.
7. Fundamental-versus-market disagreement remains visible.
8. No market value, probability, recommendation, rank or size is fabricated.
9. Markdown validates before Word projection and semantic/numerical parity passes.

The Analysis section contains T3E.1–T3E.10. Evidence Trace records quote and calculation lineage. Gaps & Conflicts captures stale, missing or inconsistent observations. QA Validation reports each test and final status.
