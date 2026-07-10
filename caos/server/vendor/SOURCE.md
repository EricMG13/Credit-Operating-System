# Vendored third-party code (caos/server/vendor/)

| File | Upstream | Commit | License | Notes |
|------|----------|--------|---------|-------|
| `sanitize.py` | [agentward-ai/agentward](https://github.com/agentward-ai/agentward) `/agentward-sanitize-skill/scripts/sanitize.py` | `0e04906` | BUSL-1.1 (→ Apache-2.0 on 2028-04-24; **internal use free**) | Deterministic PII redaction (regex + Luhn, 15 categories). Pure stdlib (argparse/json/re/sys/dataclasses/enum/pathlib/typing) — zero third-party deps, offline. **Not yet wired into the ingestion pipeline** — available as a pre-council redaction pass; call before doc chunks reach the LLM council, keep original+redacted lineage. Regex has recall gaps and MNPI (semantic) slips past — defense-in-depth, not a compliance guarantee. Do NOT `pip install agentward` (the NER extra / gateway is heavier + BUSL-gated).
