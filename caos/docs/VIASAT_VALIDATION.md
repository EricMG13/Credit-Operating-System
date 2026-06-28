# Viasat — Phase-1 Real-File Validation

**Date:** 2026-06-16 · **Issuer:** Viasat, Inc. (VSAT, CIK `0000797721`)
**Mode:** keyless local validation — no `ANTHROPIC_API_KEY`; nothing left the host.
**Inputs:** two 10-Ks (FYE Mar-2025, Mar-2026), the **EX-10.1 credit agreement**
(Jan-2026 EXIM / J.P. Morgan facility), and two earnings-call decks.

> **Status (as of the shipped engine):** the run exercised the full wired DAG —
> **19 implemented modules** (+ 4 spec-only) per [`server/engine/registry.py`](../server/engine/registry.py),
> gated by CP-5B/5C/5 — not a "7-module" slice (an earlier draft of this log said 7).

First end-to-end exercise of the engine on real third-party filings, run through
the app's own ingestion / runner / QA stack. Purpose: validate the Phase-1
pipeline and **surface faults before the internal pilot** (Phase-1's stated goal).
Companion to [LAUNCH_PHASE1.md](LAUNCH_PHASE1.md) and [AUDIT.md](AUDIT.md).

## What was validated ✓

| Stage | Result |
|---|---|
| **PDF parse** (`ingest.extract_pdf_text` → pypdf) | 10-Ks + credit agreement extract cleanly (~3.2–3.9k chars/page, alpha 0.78); earnings **decks parse sparsely** (~1.1k chars/page — inherent to slide decks, not a pypdf failure). **804 chunks** total across 5 docs. |
| **BM25 retrieval** | Surfaces the right credit content on real docs — *"net leverage total debt covenant compliance"* → #1 hit is **EX-10.1 §13 "Total Leverage Ratio … Maximum Permitted: 5.75:1.00"**; other queries returned the debt-maturity stack and liquidity figures. |
| **Full pipeline** (upload → chunk → modules → CP-5B/5C/5) | Completed end-to-end; run `complete`. |
| **CP-5 QA gate** | **Honest** — run roll-up **`Restricted`** on 2 MATERIAL lineage findings (Weak / Conflicting lineage in CP-1); did *not* rubber-stamp. The CP-5 invariant held (the LLM never set its own committee status). |
| **Provenance / click-to-source** | Every claim resolved `claim → evidence → document_chunk_id`; `metric_facts` tagged `prov=run` with period + headline flags. |
| **EDGAR XBRL → CP-1** (`fetch_cp1("VSAT")`, deterministic, no LLM) | **Real reported revenue** $2,556M (FY23) → $4,284M (FY24, Inmarsat) → $4,520M (FY25) → $4,640M (FY26), plus **Altman Z'' 4.47** (safe), each **cited to a `us-gaap:` XBRL concept**. |

## Findings (tracked)

| # | Severity | Finding |
|---|---|---|
| — | **Critical for real use** | **Fixture gotcha:** with no key, CP-1 renders the **ATLF fixture** (leverage 5.68x, revenue ~$2.4–2.8bn, doc codes D-01…D-07) for *any* issuer — tagged `prov=run`, so it looks authoritative. **Fix:** wire `ANTHROPIC_API_KEY` and/or use the EDGAR lane (demonstrated above). |
| [#25](https://github.com/EricMG13/Credit-Operating-System/issues/25) | P2 (bug) | CP-0 doesn't classify real 10-Ks / EX-10.1 by content → reports "no key credit category". |
| [#26](https://github.com/EricMG13/Credit-Operating-System/issues/26) | P2 | CP-4C abstains (`Insufficient Information`) on a covenant that is present **and BM25-retrievable** (the 5.75x max total leverage). |
| [#27](https://github.com/EricMG13/Credit-Operating-System/issues/27) | P3 | EDGAR CP-1 leaves `adj_ebitda` empty → leverage / coverage not yet derived from XBRL. |

## Readiness conclusion

The **ingestion → retrieval → run → QA-gate → provenance** chain works end-to-end
on real Viasat filings, and the QA gate is trustworthy. For **real numbers** on
real issuers, run with the API key **and/or** the EDGAR lane (both paths exist;
EDGAR was demonstrated keyless here). The three engine gaps (#25 / #26 / #27) are
the concrete Phase-1 fault-finding output and should be closed before CP-0's
coverage gate and CP-4C's covenant output are relied on for real filings.

> **Reproduce:** the keyless harness for this run (parse smoke test, end-to-end
> `TestClient` upload→run, EDGAR `fetch_cp1`) was run from `/tmp` and is not
> committed; the steps are described above and in [LAUNCH_PHASE1.md](LAUNCH_PHASE1.md) §5.
