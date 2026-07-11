# Frontend Functional Audit — 2026-07-10

Run per [caos/docs/qa/playbooks/frontend-functional.md](../playbooks/frontend-functional.md) against the branch's staged frontend diff (56 files — new per-route error boundaries, new engine-hook/persistence-race tests, several component edits). Scope discovery re-run fresh: 15 routes, 80 vitest files, 9 e2e specs.

**Overall verdict: PASS with 2 real gaps to fix (no CRITICAL, no confirmed regression).** Static gates clean, vitest clean (79/80 files, one contention-timeout disproven by isolated reproduction), e2e clean and reproduced 3×, engine-hook fallback/numeric guards sound with one real edge-case miss, no live/demo evidence collision, SAVE MODEL persistence verified working end-to-end. Two MEDIUM findings and a handful of LOW coverage/hygiene items below.

## Verdict table

| Domain | Verdict | Evidence |
|---|---|---|
| A — Component contracts | PASS w/ LOW findings | no-alpha-concat guard passes (34/34 targeted run, reconfirmed clean in the 79-file full run); 4 persistence-race/corruption suites read and confirmed genuine (not trivial round-trips), all pass live; hand-rolled formatting duplication in 1 confirmed + 3 pattern-matched spots (FF-4) |
| B — Engine hooks + numeric edges | PASS w/ 1 MEDIUM finding | finiteNumber/adapter guards verified sound by direct code read + existing tests; hooks confirmed read-only (zero POST/PUT/PATCH/DELETE calls, grep-verified); real edge-case miss found and verified (FF-1) |
| C — Live run-state + Evidence Sync | PASS | E-103-class evidence collision confirmed fixed and dedicated-tested (`evidence-shadow-resolve.test.tsx`); Evidence Sync cross-pane highlight unit-tested (mouse) + e2e-tested (keyboard); CP-2B skip verified environment-legitimate, not a stale-build false skip |
| D — Loading/empty/error states | PASS w/ 2 findings (1 retracted) | 15-route sweep; 1 sub-agent-reported HIGH finding independently verified as a **false positive** (code already fixes it) and retracted; 2 real findings survive (FF-2 MEDIUM, FF-3 LOW) |
| E — E2E journeys | PASS | 30 passed / 0 failed / 5 skipped, reproduced 3× clean against a fresh build; 1 skip proven stale and recommended for un-skip (FF-5); 3 skips in `model_flow.spec.ts` are a test-authoring gap, not a product bug (FF-6) — underlying feature manually verified working |

## Static gates

- `npx tsc --noEmit` — clean, 0 errors.
- **Real ESLint result: clean.** `./node_modules/.bin/eslint src` run directly — 0 errors, 0 warnings, exit 0.
- **Tooling-reliability finding (process, not code):** both `npm run lint` and bare `npx eslint src` returned a fabricated failure in this environment — "3477 errors, 25081 warnings in 478 files," dominated by pre-existing `.next-qa2/.next-qa3` build-cache chunks that are nowhere near `src/`. Root cause not fully isolated (stale rtk tee cache and/or npx resolution flakiness — `npx eslint` also intermittently threw `npm error could not determine executable to run`); confirmed the real command (`eslint src`, per `package.json`) only ever touches `src/` and is clean. **Recommendation for future runs of this playbook:** verify lint via `./node_modules/.bin/eslint src` directly if `npm run lint` reports an alarming file/error count that doesn't match the diff.

## Full vitest suite

Initial attempts were blocked by severe multi-session resource contention: this machine had **3–4 other concurrent `vitest run` full-suite invocations from other sessions** competing for 10 CPU cores (confirmed via `ps aux` — up to 116 vitest-related processes at once). Three of my own background invocations were eventually reaped by the harness after 10+ minutes at 0% scheduled CPU, never completing.

Contention cleared (116 → 4 processes) once those stale invocations were reaped. A fresh full-suite run then executed genuinely: **79 of 80 test files completed (165+ individual tests), with exactly one test failure**, before the harness reaped this run too, apparently right at/after the final file, just short of printing the aggregate summary line. Partial-but-near-total, real, unconflicted evidence — not an estimate.

**The one failure does not survive isolation.** `src/components/command/SectorRV.test.tsx > SectorRV Scatter Interaction > renders scatter points as accessible buttons and handles keyboard press` timed out at 20000ms while running inside the contended full suite (that one file alone took 69.5s for its 14 tests under load). Isolated and reproduced 3×, standalone: **passed cleanly every time, ~0.9s each run.** Confirmed a CPU-contention artifact (this specific interaction test uses real timers/`userEvent` delays that got starved under load), not a product regression.

Separately, `src/no-alpha-concat.test.ts` + all of `src/lib/engine/*` (34 tests: the guard plus `adapt`, `downsidePathway`, `modelAnchor`, `useLiveRun`, `useModelEngine`, `usePortfolio`) were run standalone earlier, unconflicted — 34/34 pass.

**Net: no confirmed vitest failure anywhere in this diff.** The suite is effectively clean; the single anomaly was contention-induced and disproven by direct reproduction, matching this branch's own recent stability work (`9cd81311 fix(frontend): stop full-suite vitest flakiness in localStorage polyfill + SectorReviewWorkspace race`). One residual honest gap: the final aggregate summary line (exact total pass count including the 1 file this run may not have reached) was never printed before the process was reaped — re-run `npm run test` on a quiet machine to capture that one line for the record, but it is not expected to change this verdict.

## E2E — Playwright (9 specs, 35 tests)

Built a fresh static export (`npm run build`) reflecting the current staged source, staged it to an isolated `caos/server/static_audit/` (never touched the shared `caos/server/static` another session's process on :8010 was already serving from), and ran the full suite against an isolated FastAPI instance on :8040 with its own fresh demo-seeded SQLite DB and fixed session secret — zero shared state with any other session.

**Result: 30 passed / 0 failed / 5 skipped, reproduced 3× consecutively with clean, identical counts.** No flake observed — the one earlier "24 pass / 1 fail" reading was traced to output-capture noise from a backgrounded shell pipe (grep+tee losing interleaved lines), not a real failure; a full unfiltered re-run and two subsequent clean runs confirm 0 fails is the true state (adversarial-verification per §5 — see below).

## Findings

**FF-1 (MEDIUM) — `caos/frontend/src/lib/engine/downsidePathway.ts:62` + `caos/frontend/src/components/model/ScenarioPanel.tsx:85-87`.** A garbage (NaN) `shock_to_breach_pct` from a live CP-2B payload is silently displayed as the reassuring "**Net leverage stays below the distress marker through a −30% EBITDA decline**" — the opposite of an honest "unknown" state. Root cause: `finiteNumber(NaN) → null`, and `null` is deliberately overloaded to mean two different things — "backend legitimately reports no breach within −30%" (a real, intended null) and "backend sent garbage on this one non-required field" (an error masquerading as the same null), and `shock_to_breach_pct` is not one of the fields `cp2bToDownside` requires to be present/finite to accept the payload (only `current_net_leverage`, `breach_threshold_x`, `fragility`, and `shocks.length` gate acceptance). Verified precisely: traced `ro.shock_to_breach_pct: NaN` through `finiteNumber` → `null` → `ScenarioPanel.tsx:85` ternary → the "stays below" branch, with `fragility` (a separate, independently-valid field) still correctly showing e.g. "MODERATE" — so a reader could see "MODERATE fragility" next to "survives to −30%," an internally inconsistent, falsely-reassuring pairing. No test covers this specific case (`downsidePathway.test.ts:26-35` tests a **legitimate** `shock_to_breach_pct: null`, not a NaN-while-other-fields-valid case). **Fix direction:** distinguish "key absent" from "key present but non-finite" for this one field — e.g. degrade the whole payload to `null` (hide the section) if `shock_to_breach_pct` is present in the raw payload but not finite and not explicitly `null`, mirroring the CLAUDE.md engine-conventions NaN-guard discipline this codebase otherwise follows closely.

**FF-2 (MEDIUM) — `caos/frontend/src/app/command/page.tsx` and `caos/frontend/src/app/sector-rv/page.tsx`.** `usePortfolio()` (`lib/engine/usePortfolio.ts`) exposes a correct, tested `error: boolean` field distinguishing a genuine `getPortfolio` fetch failure from empty coverage (proven by `usePortfolio.test.ts`), but neither consuming page ever reads `portfolio.error` (confirmed via grep — zero `.error` references in either file). A live backend outage on either board silently renders the seeded/static fallback with no visible indicator that the "live" data is actually stale/failed. Mitigated by the accepted-risk register (Command Center is documented as seeded-mock-plus-one-live-overlay), so this is a real but non-blocking gap — the hook already did the hard part; wiring a small banner closes it.

**FF-3 (LOW) — `caos/frontend/src/app/issuers/profile/ProfileContent.tsx:388-409`.** A genuine fetch error and a legitimate "issuer not found" both route through the same `ErrorView`, differing only in message text; no retry affordance is offered for the transient-error case (only "Back to Directory" / "Open Deep-Dive"). Weaker recovery UX than the issuers-list page's degraded-banner-with-retry pattern (`issuers/page.tsx`), though not a silent blank — verified directly, confirmed accurate.

**FF-4 (LOW, coverage) — hand-rolled numeric formatting bypasses `lib/format.ts`.** Confirmed by direct read: `ProfileContent.tsx:42-46,161-169` reimplements `$Xm`/`X.X×`/`X.X%` formatting locally (`TREND_FMT` + a local `fmt()` helper) instead of importing `fmtUsdM`/`fmtMult`/`fmtPct`. Three more instances were flagged by pattern match (not independently re-verified by me at the same depth): `components/command/LiveCoverage.tsx:16` (duplicates `fmtMult` exactly, on the one genuinely-live Command Center element), `components/settings/PortfoliosPanel.tsx:30-31`, and extensive `SectorRV.tsx` raw formatting (lower stakes — sample-spread accepted-risk surface). Not a correctness bug today (no divergent output observed), but duplicated formatting logic is exactly the kind of drift that produces a silently-wrong-precision number later; consolidate opportunistically.

**FF-5 (LOW, coverage) — stale e2e skip, verified fixable now.** `caos/tests/frontend/e2e/research_run.spec.ts:164`, `test.skip("...AI-synthesized marker text [E2E-6c marker]...")`, cites "the served 2026-07-02 static build" as the reason. **Verified directly:** temporarily un-skipped, ran against the fresh build built for this audit — **passed cleanly** (single-test run, clean). The marker text is present in current source (`ReportPane.tsx:226`). Re-skipped and reverted immediately after verification (no residual diff — confirmed via `git status`). Recommend un-skipping in a follow-up commit now that the static bundle is current.

**FF-6 (LOW, coverage) — SAVE MODEL persistence has no e2e coverage, but the feature itself works.** `model_flow.spec.ts` skips 3 tests: the CP-2B downside readout (verified environment-legitimate — the fresh demo-seeded DB genuinely has no completed run for the ATLF reference issuer, so CP-2B cannot render; not a stale-build issue) and 2 SAVE/reload tests, skipped because the test never dirties the model before clicking SAVE (the button is dirty-gated, so no PUT fires on an unchanged model — a test-authoring gap, not a product bug). **Verified the underlying behavior directly:** wrote a temporary probe spec that double-clicks an editable historical cell, commits an override value, clicks SAVE MODEL, confirms the PUT 200 + "SAVED" stamp, reloads, and confirms the overridden value survives — **passed cleanly**. Deleted the probe file immediately after (confirmed via `git status` — no residual diff). Recommend adding a cell-dirty step to the two skipped tests and un-skipping.

## Confirmed-fine (verified, not just assumed)

- **E-103-class evidence collision — fixed and tested.** `EvidenceModal.tsx:236-239` correctly resolves live-run evidence ids to the run's own map and never shadow-falls-back to the seeded ATLF map for a live run's unresolved id (renders an explicit "Unresolved" panel instead). Directly covered by `evidence-shadow-resolve.test.tsx` (2 tests, read in full, sound).
- **Engine hooks are genuinely read-only.** `grep -n "api\.\(post\|put\|delete\|patch\)"` across `useLiveRun.ts`, `useModelEngine.ts`, `usePortfolio.ts`, `useLatestRun.ts` — zero matches.
- **`reports/page.tsx` error-vs-empty handling is correct** (a sub-agent's initial sweep flagged this as a HIGH finding — see Adversarial verification below; independently re-checked and the finding does not hold).
- **CP-2B downside skip is legitimately environment-dependent**, not a stale-build false skip (no completed run exists for the reference issuer in a fresh demo seed — confirmed via direct API query).
- **Evidence Sync keyboard operability** — confirmed via the passing e2e test `deepdive_flow.spec.ts:109` ("focusing an evidence chip by keyboard fires the same cross-highlight"), corroborating the mouse-only unit-test coverage in `evidence-sync.test.tsx`.
- **4 persistence-round-trip suites are genuine, not trivial**: `model-restore-race.test.tsx` reproduces a real cross-issuer switch race with deferred promises; `history-restore.test.tsx` covers malformed/wrong-shape localStorage JSON; `model-mode.test.ts` covers `Storage.getItem` throwing (blocked/private-mode storage); `research-prefs.test.ts` covers per-field type validation with well-typed siblings surviving a corrupt neighbor.
- **The 6 new `error.tsx` route boundaries** (command, deepdive, model, query, reports, root) are correctly scoped React error boundaries (catch thrown render/data exceptions, not hook-level `phase==="error"` states — that split is intentional and correct) and all have matching coverage in `error-surfaces.test.tsx`.

## Adversarial verification

- **E2E stability**: reproduced the full suite 3× from a clean state (fresh build, no orphan server, no stale lock) — consistent 30/0/5 every time. The one anomalous "1 fail" reading was traced to a shell output-capture artifact (piped grep+tee losing interleaved stdout on an early exit), not the product — ruled out by re-running unfiltered to a file twice more.
- **Sub-agent finding refuted (process win for this discipline):** a delegated sweep initially reported a HIGH finding — that `reports/page.tsx` omits `useModelEngine`'s `phase` param, collapsing a genuine backend error into the same "no run for this issuer" empty state as `model/page.tsx`'s already-fixed M-5 issue. Direct code read (`reports/page.tsx:223-224`, `deepdive/caveat.ts:28`) shows `phase: eng.phase` **is** threaded through, with a dedicated `caveatKind === "error"` branch rendering "could not load live run" in critical styling, plus an explanatory comment confirming this was deliberately fixed. **Retracted** — not included in the findings list above. This is exactly the "agents inflate severity → adversarial-verify" pattern this project has hit before; every other sub-agent-reported finding in this report (FF-2, FF-3, and A1 of FF-4) was independently re-verified by direct code read before inclusion.

## Coverage gaps

- `/sector` route: the page is a thin wrapper delegating to `SectorReviewWorkspace`; not deep-audited in this pass beyond confirming it exists and has its own component test file.
- `/upload` loading/empty/error states beyond the `Suspense fallback={null}` (which only guards `useSearchParams()`, not real async data) were not deep-audited.
- Domain A findings A2–A4 (LiveCoverage, PortfoliosPanel, SectorRV hand-rolled formatting) were pattern-matched by a sub-agent and not independently re-verified line-by-line by me at the same depth as A1 — treat as probable, not certain, until spot-checked.
- Full-suite vitest pass/fail count unconfirmed live (see environmental-limitation note above) — re-run on an uncontended machine before treating this report's vitest gate as fully closed.

## Accepted-risk register — reviewed, no drift

Checked the playbook's register against current behavior; all 8 entries still hold as described (Command/Monitor seeded-mock-plus-live-overlay, Pipeline sim, Deep-Dive static fallback, bespoke reference tabs, CP-2B ScenarioPanel-not-grid, Phase-2 market-spread RV, login `/me` stub, Node localStorage polyfill). No new seam needs registering.

## Gate summary

| Gate | Result |
|---|---|
| vitest failure | None — 79/80 files (165+ tests) ran clean; the one apparent failure (SectorRV keyboard test) was a contention timeout, disproven by 3× clean isolated reproduction |
| e2e failure after retry | None — 0/30 across 3 clean reproductions |
| no-alpha-concat guard | PASS |
| NaN/undefined/Infinity rendered in a numeric surface | **FF-1 — one confirmed instance** (shock-to-breach display) |
| engine hook issuing a mutation | None found |
| live data resolving against seeded evidence map | None found — confirmed fixed and tested |

**Net: no blocking regression.** FF-1 and FF-2 are real, worth fixing before or shortly after merge; FF-3–FF-6 are coverage/hygiene. Recommend closing the full-suite vitest gate on a quieter machine before final sign-off.
