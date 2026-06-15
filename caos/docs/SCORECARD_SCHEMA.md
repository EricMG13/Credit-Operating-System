# CAOS — Loan Scorecard methodology (`/scorecard`)

**Surface:** new top-level concept `/scorecard` · **Backend:** `/api/scorecard` +
`engine/scorecard.py` · **Storage:** none new — reads `deal_terms` (see
[COMPARE_SCHEMA](COMPARE_SCHEMA.md)) · **Ships in:** the existing single-container
Phase-1 stack — no new service · **Last updated:** 2026-06-15

A CAOS-native, **transparent** implementation of the Covenant-Review-style
"Composite Score" (Model 2.0): a 1 → 5 read of how well a credit agreement
protects lenders, where **1 = most protective** and **5 = seriously deficient**
(higher = looser = more borrower-favorable). It rolls 6 Quality Scores into 5
Sub-Scores into a weighted Composite — built on CAOS's evidence-traced engine
rather than a licensed score feed (no paid services). Companion docs:
[COMPARE_SCHEMA](COMPARE_SCHEMA.md) · [AUDIT](AUDIT.md) · [deploy/README](../deploy/README.md).

---

## 0. Where it deploys

Nothing new to stand up — same image, same process. The Scorecard adds:

| Piece | Location | Deploy impact |
| --- | --- | --- |
| Scorecard surface (static route) | `frontend/src/app/scorecard/` + an 8th entry in `SECTIONS` ([ConceptNav.tsx](../frontend/src/components/shared/ConceptNav.tsx)) | folds into the existing frontend build |
| Scorecard API | `server/routes/scorecard.py`, registered in [main.py](../server/main.py) (`prefix="/api/scorecard"`) | new router, same process |
| Scoring methodology | `server/engine/scorecard.py` (pure functions) | same engine package |
| Storage | none — reads `deal_terms` the Compare lane already defines | — |

---

## 1. Design decision — a transparent score, not a feed

The score is computed by **pure deterministic functions** over the deal's terms
(mirroring [distress.py]'s Altman Z''), not pulled from a licensed product. Every
score returns the **input drivers** that produced it, so the surface can show its
work and the QA gate can audit it — the *show your work* principle. The number
lives on a fixed 1–5 scale; nothing is a black box.

The methodology lives in **code**, not the DB — the same choice the term catalog
makes ([COMPARE_SCHEMA](COMPARE_SCHEMA.md) §1): weights and mappings are constants
that ship without a migration.

---

## 2. The scores

### 2.1 Quality Scores (6) — qualitative document categories

Each maps the relevant covenant terms to 1–5. Drivers are shown.

| Key | Measures | Primary inputs |
| --- | --- | --- |
| `ebitda_adjustment_definition` | How narrowly EBITDA adjustments are limited | synergies/cost-savings cap (Uncapped = worse), restructuring add-back, realized-action window |
| `builder_basket` | How tightly build capacity is restricted | starter base amount, starter grower %, builds-from-unswept-proceeds |
| `amendments` | How easily the borrower makes adverse changes | basket reclassification, free & clear vs MFN, MFN hard cap |
| `mandatory_prepayments` | Flexibility to avoid sweeps | ECF sweep % (smaller = looser), asset-sale step-down, reinvestment period |
| `reporting` *(2.0)* | How often lenders receive financials | reporting terms (Insufficient until a covenant-review doc supplies them) |
| `ratio_calc_basket_flexibility` *(2.0)* | How ratios are calculated for capacity / testing | free & clear ratio level, free & clear grower, general-basket grower |

### 2.2 Sub-Scores (5)

| Key | Measures | Composite weight |
| --- | --- | --- |
| `collateral_protection` | Recovery value — collateral package (1L/2L), leakage of assets out of the restricted group | **0.30** |
| `default_protection` | Limits on adverse changes + the financial-covenant cushion (cov-lite, leverage level, springing trigger) | 0.25 |
| `lenders_repricing_optionality` | Lenders' ability to extract value on distress / M&A (call protection, financial-covenant lever) | 0.20 |
| `value_leakage` *(2.0)* | Protection against assets leaving the restricted group (builder/EBITDA quality, day-one capacity) | 0.15 |
| `reporting_protection` *(2.0)* | Robustness of reporting requirements | 0.10 |

### 2.3 Composite

Weighted mean of the **present** sub-scores (weights above, renormalised across
the ones that produced a value so a missing sub-score doesn't drag the result).
Collateral is most heavily weighted — recovery value is the agreement's paramount
purpose.

### 2.4 Value-state semantics (do not collapse)

Like `deal_terms`, three states stay distinct. A category with **no usable input
reports `Insufficient Information`** — it is *never* assigned a fabricated number,
and simply drops out of the composite renormalisation. The band label (Strongly
protective → Deficient) and a glyph always accompany the number, so meaning is
never carried by color alone (a11y; CLAUDE.md / `.impeccable.md`).

---

## 3. The methodology fallback (the key behaviour)

> *"If the user does not provide a covenant review document, use the methodology
> to calculate the loan score."*

- **Covenant-review document provided** → the rich qualitative/narrative terms are
  extracted into `deal_terms`, each tracing to a document chunk. The scorer reads
  them at high confidence and the scorecard reports `basis = "covenant_review"`.
- **No covenant-review document** → the scorer falls back to the **empirical
  signals CAOS already derives** — collateral package (1L/2L from the deal
  label / collateral narrative), cov-lite & leverage & MFN cap & headroom (CP-4C),
  day-one capacity, ECF sweep — through the *same* deterministic mappings. The
  scorecard reports `basis = "methodology"`, reduces confidence, and surfaces a
  banner + limitation flag so the analyst knows the qualitative categories were
  approximated.

A term is treated as document-grounded when it traces to a real
`document_chunk_id` with a non-`Untraced` lineage class — exactly the signal that
separates an extracted covenant-review value from a seeded/empirical one.

---

## 4. Provenance & QA fit

- Each `ScoreResult` carries its `basis`, `confidence`, and the input `drivers`
  (label · detail · the 1–5 value each pushed toward), so a score is one click
  from the terms that produced it — consistent with CP-5B *show your work*.
- The cov-lite input reuses the same fact the Compare lane and `covlite_finding()`
  (CP-4C) already use, so the scorecard, the comparison grid, and the QA finding
  stay consistent.
- Pure + deterministic: no LLM, no network at request time — fully unit-tested
  (`tests/server/test_scorecard.py`).

---

## 5. Open questions / non-goals

- **Weights & mappings are a defensible default**, not the proprietary
  Covenant-Review calibration (which is licensed). They live in
  `engine/scorecard.py` as named constants for easy re-calibration.
- **Reporting** is the score most dependent on a covenant-review document;
  reporting terms aren't richly catalogued yet, so it reports Insufficient
  Information without one (rather than overstating).
- **Persistence.** Scores are computed live on read. Writing the computed
  `documentation_scores` back as `deal_terms` (provenance `methodology`) so the
  Compare grid's score rows populate consistently is a sensible follow-on.
- **Not in scope here:** the covenant-review extraction prompt (CP-4D), per-cell
  weight tuning, and persisting scores into `deal_terms`.
