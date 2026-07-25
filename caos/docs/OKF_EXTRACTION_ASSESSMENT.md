# OKF extraction — assessment criteria

How the OKF ingestion pipeline is judged, and what the judgement is worth. Scored
by `caos/tests/server/test_okf_corpus.py` against the labelled corpus in
`caos/tests/server/corpus/okf_corpus.py`.

## What is being measured, and what is not

**Measured:** the *deterministic* extraction lane — classification, segmentation,
page anchoring, typed key facts, degradation behaviour, and the safety gates that
decide whether a figure may reach a credit view.

**Deliberately not measured here:**

- **Vision-lane accuracy.** The vision extractor's output quality depends on a live
  multimodal model. `test_okf_vision.py` asserts what the lane *does with a reply*
  — the injection, hallucination, basis and confidence gates — which is where the
  safety properties live. Model accuracy itself is not scored offline and no claim
  about it is made.
- **Real-filing fidelity.** See the corpus caveat below. Nothing here proves
  behaviour on a genuine rating-agency PDF.

### Corpus caveat — read before quoting any number

The corpus is **constructed, not real filings.** Three reasons, stated plainly:

1. **No financial PDFs are checked into this repository.** The 61-issuer
   `corpus/MANIFEST.md` cohort is fetched from EDGAR at run time into a gitignored
   `samples/`; the checked-in fixtures are captured **XBRL facts JSON**, not
   documents. The only PDF in the tree is a synthetic scanned OCR fixture.
2. **EDGAR is unreachable from the CI/dev sandbox**, so real documents cannot be
   pulled during a run.
3. **Rating-agency reports, offering memoranda and sponsor decks are proprietary**
   and cannot be committed regardless.

The corpus therefore uses **real cohort issuer names** (from `corpus/_capture.py`)
in **synthetic documents with known ground truth**. That makes the scores a
regression net and a floor — *"the extractor still finds what it is supposed to
find, and still refuses what it should refuse"* — **not** an accuracy claim about
production documents. A score of 1.00 here means the extractor handles the
document shapes we modelled; it does not mean it handles Moody's.

**Upgrade path:** when licensed or owner-supplied documents become available, drop
them into the corpus with the same ground-truth shape and the harness scores them
unchanged. That is the point of separating the corpus from the scorer.

## The criteria

Each criterion has a **threshold** the suite asserts. Thresholds are set where a
regression would represent a real loss of capability, not at 100% for its own sake
— a brittle 100% target invites tests that encode the implementation instead of
the requirement.

### A. Routing — does the document reach the right lane?

| ID | Criterion | Metric | Threshold |
|---|---|---|---|
| **A1** | Doc-type classification | correct `DocType` / total | **≥ 0.90** |
| **A2** | Title markers beat quoted agency names | offering memos quoting an agency still classify as `offering-memo` | **1.00** (no tolerance) |
| **A3** | Unknown documents fall back, never crash | unclassifiable → `source-document` | **1.00** |

A1 is the headline routing number. A2 and A3 are absolute because they are
correctness properties, not accuracy trade-offs: mis-routing an offering memo as a
rating report changes which extractors run, and a classifier that raises kills an
upload.

### B. Structure — is the document usable as evidence?

| ID | Criterion | Metric | Threshold |
|---|---|---|---|
| **B1** | Sections found | docs with ≥1 non-empty section / text-bearing docs | **≥ 0.95** |
| **B2** | Page-anchor rate | sections with a resolved `page_start` / sections in page-mapped docs | **≥ 0.70** |
| **B3** | Anchors are never fabricated | every non-null anchor is within `1..page_count` | **1.00** |
| **B4** | Chunks are retrievable | text-bearing docs producing ≥1 chunk | **≥ 0.95** |

B2 is deliberately not 1.00. Anchoring locates a section's text inside a
*separately extracted* page map by substring; when the canonical text came from a
different extractor the match can legitimately fail, and the design says degrade to
`None` rather than guess. B3 is absolute — a *wrong* anchor is worse than none,
because it sends an analyst to the wrong page while looking authoritative.

### C. Facts — are the numbers right and safe?

| ID | Criterion | Metric | Threshold |
|---|---|---|---|
| **C1** | Key-fact recall | expected facts found / expected | **≥ 0.80** |
| **C2** | Key-fact precision (no invention) | extracted values present verbatim in source / extracted | **1.00** |
| **C3** | Verbatim preservation | `4.25x` stored as `4.25x`, never rounded | **1.00** |
| **C4** | Rating attribution | a rating is attributed only to the publishing agency | **1.00** |

C1 is a recall floor, not a ceiling: the deterministic extractors are intentionally
conservative, and a missed fact is a gap while an invented one is a defect. C2 and
C3 are absolute for that reason — **precision over recall is the house position on
a credit platform.** C3 protects the downstream grounding gate, which compares
formatting-tolerantly and desyncs if extraction normalises.

### D. Degradation — does failure stay honest?

| ID | Criterion | Metric | Threshold |
|---|---|---|---|
| **D1** | Empty/scanned docs still vault | no exception; `extraction_status="empty"` | **1.00** |
| **D2** | Empty docs produce zero chunks, not boilerplate | `chunk_count == 0` | **1.00** |
| **D3** | Status is honest | `full` only when text **and** a page map exist | **1.00** |
| **D4** | Nothing raises | no unhandled exception across the whole corpus | **1.00** |

All absolute. The pipeline's contract is *"every seam degrades"*; a silent
success-shaped failure on an unreadable document is the specific outcome this
project treats as unacceptable, because it lets an analyst build a view on a
document the engine never read.

### E. Safety — can a bad read reach a credit decision?

| ID | Criterion | Metric | Threshold |
|---|---|---|---|
| **E1** | No synthetic numerals in chunk text | chunks containing a page anchor `(p. N)` | **0** |
| **E2** | Marketed figures never enter reported CP-1 | reported `normalized_financials` unchanged by the bridge | **1.00** |
| **E3** | Basis is always from the closed set | facts with a basis outside `FACT_BASES` | **0** |
| **E4** | Vision confidence never exceeds Medium | vision facts with `High` | **0** |

E1 protects `grounding.all_grounded`'s numeric pool. E2 is red-team objection
RT-2026-07-24-01 — the single most consequential property in the pipeline. Both are
absolute, and both are also asserted by unit tests; scoring them corpus-wide
catches a regression that a targeted test might miss on an unmodelled shape.

## Reading a result

- **A failing threshold is a build failure**, not a report line. The suite asserts.
- **A perfect score is not evidence of production accuracy** — see the corpus
  caveat. The number bounds regression, not reality.
- **Recall metrics (A1, B1, B2, B4, C1) are floors.** Raising them is a real
  improvement. **Precision and safety metrics (A2–A3, B3, C2–C4, D*, E*) are
  contracts.** Lowering one to make a suite pass is a defect, not a tuning
  decision.
