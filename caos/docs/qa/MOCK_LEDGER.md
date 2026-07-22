# Mock Ledger — seeded/sample/sim data burndown (C1)

> **2026-07-20 authority-mode update:** Pipeline and Monitor now expose
> explicit, separately controlled `LIVE` and `REFERENCE` states; Sector RV
> retains per-result LIVE/DEMO/REFERENCE authority; Deep-Dive, Reports, and
> Issuers keep visibly labelled reference/demo paths. This improves truth
> disclosure but does not activate licensed market data, enterprise email, or
> spec-only analytical modules. PD-04 removed 16 superseded/test-only modules,
> including the old Command RV/dislocation stack; the current 262/263 walk has
> one intentional test-support seam (`color-literal-policy.ts`).
> No all-clear follows from visible labels alone: L9/L23/L27 must rescan and
> exercise the exact H0 image. Current status:
> [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md).

> **2026-07-18 reconciliation — historical baseline:** the original 2026-07-12 table is retained as
> history, but several ownership rows have moved. The current main Command
> datasets use live portfolio/context APIs; the old `SectorRV`/
> `ActionableDislocations` stack was removed under PD-04 and `/sector-rv`
> now renders the API-backed `RVScreenerWorkbench` with explicit
> LIVE/DEMO/REFERENCE authority. Monitor remains intentionally hybrid: live
> alert/governance rows lead, while CP-MON email/replay content is an explicitly
> disclosed illustrative sample. Deep-Dive, Pipeline, Issuers, and Reports still
> retain reference/demo paths with visible authority labels. No confirmed silent
> mock was found in the 2026-07-18 import/route sweep, but this is **not release
> closure**: C3/C5/C13, L9, L23, and L27 must prove the immutable production
> build, current route journeys, and honest unavailable states. See
> [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md).

## 2026-07-18 delta register

| Surface/module | Current disposition | Release consequence |
|---|---|---|
| Command portfolio/changes | Live `portfolioLabApi`, analysis context, digest, and governance sources; no Sample Sleeve import in the route | Old C2 sample-sleeve row is closed; current Command plus routed portfolio/decision/sponsor contracts are green on the working tree, while frozen-H0 L27 integration remains open |
| Removed Command `SectorRV` + `ActionableDislocations` + `lib/command/dislocations.ts` cluster | Deleted under PD-04 after direct/dynamic reference and LOW-impact review; `/sector-rv` continues to mount `RVScreenerWorkbench` | Closed as dead-code disposition; do not count the historical labelled sample as a live surface |
| Monitor email/replay | Still consumes `simAlertsToday`, `CRITICAL_ALERTS`, `EmailIntel`, and the shared sim behind an explicit demo disclosure; live alert inbox/governance is separate | Acceptable only as labelled sample until C3 enterprise email/CP-MON seam closes |
| Sector RV current route | API-backed workbench; per-result authority emits LIVE/DEMO/REFERENCE | Dedicated route-contract E2E is green on the working tree; C5 still owns licensed/current market activation and target entitlements |
| Report Studio | Live run/model/report services coexist with explicit Atlas Forge bespoke-tab/template fixtures; CP-RENDER module is not issuer-specific | C13 must freeze the equivalent-service map and prove live issuer publish/export |
| Deep-Dive rails | Non-reference issuers fail unavailable rather than receive ATLF CP-0/CP-5B rail fixtures | Honest behavior; runtime/equivalent-service gap remains visible and tracked |
| Issuers | `DEMO_UNIVERSE` remains a labelled demo/search fallback | Production demo seed remains forbidden; L23 verifies empty real workspace behavior |

Generated 2026-07-12 from an exhaustive import sweep of
`caos/frontend/src` (agent sweep + hand-verified edge cases). Rubric per
PRE_DEPLOYMENT_PLAN C1: **silent-mock = CRIT** (unlabeled fabricated data an
analyst could read as real), **labeled-sample = MED** (visibly marked),
live = no entry. This is the burndown input for C2/C4; re-run the sweep at C
exit — the exit gate is *zero* silent-mock rows and zero unlabeled sample in
a prod build.

## Verdict at generation

**0 silent-mock (CRIT) rows.** Every seed source consumed by a user-facing
surface carries a visible label ("Sample portfolio — not live",
"Illustrative sample — not live", "SEEDED RUN #2641", "REFERENCE TEMPLATE",
"sample sleeve", source-tag strings on Sector RV). Two watch-items below are
MED notes, not silent mocks.

## Seed source modules (what exists)

| Module | Exports (count) | Feeds |
|---|---|---|
| `lib/command/data.ts` | PORTFOLIO, COVERAGE, GAPS, QA_QUEUE, ALERTS, EMAILS, EMAIL_TILES, EMAIL_TOTAL, CRITICAL_ALERTS, SECTORS, FEED_LINKABLE_ISSUERS, simAlertsToday (12) | Command, Monitor |
| `lib/command/rvdata.ts` (+ `market-data.json`) | RV_SOURCE, RV_FILE_LABEL, RV_AS_OF, RV_SECTORS, INDEX_STATS, BUCKETS | Sector RV |
| `lib/pipeline/data.ts` | MODULES, SIM_PLAN, DRIVERS, EDGES, LAYERS, NODE_QA, NODE_LIMITS, NODE_REQS, RUN_MODES | Pipeline, Deep-Dive |
| `lib/reports/deal.ts` | DEAL, DOCS, DEBATE, DEBATE_6E, COVENANTS, CAPACITY, CAPSTACK, RECOVERY, SIZING, TRIGGERS, MODULE_NAMES | Deep-Dive bespoke tabs, Reports |
| `lib/issuers.ts` | DEMO_UNIVERSE | Issuers directory, profile-overlay resolver |
| `lib/pipeline/sim.ts` / `sim-engine.ts` | useSimRun, useSharedDayRun | Pipeline/Deep-Dive/Monitor replay theater |

## Burndown rows (by surface)

| Surface | file:line | Seed consumed | Class | Label evidence | Burndown owner |
|---|---|---|---|---|---|
| Command | `app/command/page.tsx:13-15` | PORTFOLIO, COVERAGE, GAPS→(live-aware), QA_QUEUE→(live-aware), simAlertsToday, PORTFOLIO_AVG_DM_LABEL | labeled-sample (MED) | "Sample portfolio — not live" sleeve header; QA queue + Source-Gaps already prefer live rows (A-1) | **C2** (replace sleeve with real registry + designed empty state) |
| Command | `components/command/views.tsx:14` | ALERTS, EMAILS, EMAIL_TILES, EMAIL_TOTAL, FEED_LINKABLE_ISSUERS, PORTFOLIO, QA_QUEUE, GAPS | labeled-sample (MED) | same surface labels; IssuerStrip resolves live-first and SAMPLE-tags fallback | **C2** |
| Monitor | `app/monitor/page.tsx:14-15` | simAlertsToday, EMAIL_TILES, EMAIL_TOTAL, CRITICAL_ALERTS, useSharedDayRun | labeled-sample (MED) | "Illustrative sample — not live" (page.tsx:14,64-67) | **C3-seam** (alert inbox replaces the whole mock) |
| Deep-Dive | `app/deepdive/page.tsx:19-20`; `components/deepdive/{tabs,rails,IssuerChat,OutputRegister}.tsx` | MODULES, SIM_PLAN, useSimRun, DEAL fixtures (DEBATE/COVENANTS/CAPSTACK/RECOVERY/SIZING/TRIGGERS/DOCS/DRIVERS) | labeled-sample (MED) | "SEEDED RUN #2641"; bespoke tabs are the ATLF reference showcase; real issuers render live ModuleView (per-module ● LIVE / ✕ FAILED after #155) | **C4** (residual: keep reference showcase clearly gated; no change needed unless labels regress) |
| Pipeline | `app/pipeline/page.tsx:17-18`; `components/pipeline/views.tsx:8-10` | MODULES, RUN_MODES, SIM_PLAN, EDGES, LAYERS, NODE_QA/LIMITS/REQS, DRIVERS | labeled-sample (MED) | module taxonomy/DAG metadata is spec-truth (not fabricated figures); replay sim labeled | **C4** (taxonomy metadata may stay — it is the corpus DAG, not data) |
| Model Builder | `app/model/page.tsx:27` | ATLF_REFERENCE_ISSUER_ID gate | labeled-sample (MED) | "SEEDED · demo RUN #2641" | **C4** |
| Report Studio | `app/reports/page.tsx:18`; `components/reports/{EvidenceModal,ReportDoc,panels}.tsx` | ATLF_REFERENCE_ISSUER_ID, DOCS, DEBATE, MODULE_NAMES | labeled-sample (MED) | "REFERENCE TEMPLATE — bespoke tabs stay fixture" | **C4** |
| Issuers directory | `app/issuers/page.tsx:20` | DEMO_UNIVERSE, COUNTRIES | labeled-sample (MED) | "sample issuers" / "Demo coverage" / "sample sleeve" strings | **C2/C4** |
| Sector RV | `app/sector-rv/page.tsx:7-8` | PORTFOLIO overlay, market-data.json (RV_SECTORS, RV_FILE_LABEL) | labeled-sample (MED) | per-state source strings: "market-data + sample overlay (portfolio unavailable)" vs "market-data + portfolio overlay"; as-of + file label shown | **C5** (all RV surfaces move to the persisted quote store) |
| Query | — | none (analytical surfaces read live walks) | live | — | — |
| /sector | `routes/sector.py` seed review | labeled-sample (MED) | server-side `provenance: "seed"` + "Seed / demo" badges (verified A7b) | **CP-SR scope** (post-transfer X5) |

## Watch-items (MED notes, hand-verified — not silent mocks)

1. `components/shared/IssuerProfileOverlay.tsx:76-81` — the profile-overlay
   search resolver falls back to matching a query against `DEMO_UNIVERSE`
   to produce an issuer **id**. It renders no seed data itself, but it can
   route an analyst to a demo issuer's profile from a real search. Fine
   while the demo sleeve exists; dies naturally with C2/F1 (registry reset).
2. `app/sector-rv/page.tsx` — the sample-overlay label is **conditional**
   (shown when the portfolio fetch fails). Verify at C5 that every degraded
   state keeps a visible source tag; the quote-store migration replaces this
   logic wholesale.

## Rules for new code (until C2/C4/C5 land)

- Importing anything from the seed modules above into a user-facing surface
  requires a visible sample/reference label in the same view — CI-greppable
  wiring lands with C1's follow-up (loop L9's grep list is exactly the
  import list in the first table).
- Never persist seed figures under run provenance (`prov=run`) — covered by
  the engine's demo-fixture MATERIAL finding and the B1 golden E2E.
