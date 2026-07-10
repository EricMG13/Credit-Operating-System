# SECURITY_IMPLEMENTATION_SPEC — CAOS Phase-1 Hardening

**Vectors:** Concurrency & State · Data Integrity · Silent Failures
**Surfaces:** `caos/frontend/src` (Next 15 / React 19, static export) · `caos/server` (FastAPI)
**Audit date:** 2026-07-08 · **Executor:** implementing agent (Opus 4.8), strictly top-to-bottom
**Result:** 0 Critical · 1 High · 14 Medium confirmed (2 candidates rejected, 2 adversarially refuted, server surface clean)

---

## 0. Read Me First — execution protocol

1. **Execute items in order, top to bottom.** H-1 first, then M-1 … M-14. Several Medium items share a file or a dependency; the order below already respects those (`Depends on:` is called out per item).
2. **One item per commit.** Commit message references the item id (e.g. `fix(model): guard hydrate against stale-issuer race [H-1]`).
3. **Run the suites named in each `Accept` line before committing.** Frontend: `cd caos/frontend && npm run test` (Vitest). Backend (only if a server item is ever added): `caos/server/.venv311/bin/python -m pytest`. If an `Accept` criterion fails, **stop that item, record the failure in Appendix C, and move to the next item** — do not improvise a different fix.
4. **The DO-NOT-FIX ledger (§3) overrides any instinct to improve adjacent code.** Every item's `Do not:` line is binding.
5. **Locator convention:** each item's canonical locator is `File` + `Block` (a *named* functional block — exported function / component / handler). Line numbers that appear inside `Evidence` / `Verifier note` are the verifier's *reproduction anchors* (verified against the current tree at audit time), not the locator — grep the named block, do not trust the line number.
6. **Every finding in §4–§6 was independently reproduced by a fresh-context verifier and survived an adversarial refutation pass** (Appendix C). The patches reuse only utilities confirmed to exist (`patch_check: YES`).

> ⚠ **Provenance of the by-design ledger.** The governing audit brief (`.agent-reviews/src-security-audit-brief.md`) was not available at audit time (missing on disk; the source URL was auth-gated). The DO-NOT-FIX ledger below was reconstructed from the task charge + corroborating repo evidence (`.agent-reviews/redteam.md`, `test_runs_idor`, inline review annotations) and every finding was verified against the live tree regardless. If the original brief resurfaces, re-reconcile §3 against it before executing.

---

## 1. Scope & Method

**Method.** Two-tree reconnaissance (auth/session/executor/state map + frontend async/boundary/state map) → 9 deep-read batches of 5 files each (FE-1…FE-6, SV-1…SV-3) → a **fresh-context verifier gate after every batch** (reproduce-from-source or reject: `HALLUCINATED | NOT_REPRODUCIBLE | BY_DESIGN | FRAMEWORK_NORMAL | DUPLICATE`) → an **adversarial refuter** per confirmed finding (kill unless the defect concretely stands) → a **completeness critic** sweeping the unaudited remainder of both trees. Only findings that passed *both* the verifier and the refuter enter §4–§6.

**Architecture facts that bound the vectors.**
- The frontend is a **static export** (`output: "export"` in `next.config.js`) served by FastAPI — there is no Next server runtime, no middleware, no route handlers. Server components render at build time only, so **cross-user frontend module-state leakage is structurally impossible**; all frontend state is per-browser-tab. Concurrency findings on the frontend are therefore per-tab races, not cross-user leaks.
- Server identity is fully request-derived (HMAC-signed cookie + edge-secret gate, fail-closed boot guards); the DB is session-per-request; the four background executors retain task references, mark rows failed in terminal guards, and sweep stranded rows on boot. The server surface audited **clean** — both server candidates raised were rejected/refuted (Appendix B).

**Cleared by recon + completeness sweep (not re-read line-by-line; verified sound):** identity/auth (`identity.py`, `passwords.py`, `routes/auth.py`), upload ingress + AV (`ingest.py`, `avscan.py`, magic-byte sniff, ClamAV fail-closed), EDGAR SSRF guard (`edgar.py`), NL→SQL closed-Pydantic allowlists (`nlquery.py`), LLM fault-isolation lanes, and the server data-integrity math (`is_finite_number` enforced on every divide/round path inspected: `engine/portfolio.py`, `engine/relval.py`, `portfolio_ingest._num`, ratings parsing). The completeness critic confirmed the unaudited frontend pages that fetch (`issuers`, `settings`, `research`, `pipeline`) are uniformly stale-race-guarded, and found no unlabeled fallback, swallowed write-failure, or missing boundary on the remainder.

---

## 2. Severity Rubric (as calibrated)

- **Critical** — a cross-user/request data leak or state corruption reachable in normal multi-user operation; **or** a surface rendering fallback/seeded **numerals with no provenance affordance at the point of reading** (PROMOTION RULE). *None found* — see §4.
- **High** — a race or swallow that corrupts a run, strands pipeline state, or hides a money-impact failure, with a plausible concurrent-analyst trigger. **LABELING-DEFENSE RULE:** a provenance label visible at the point of reading (badge / caveat / banner) caps a *silent-fallback* finding at High — the lie is about **why**, not **what**.
- **Medium** — robustness: crash blast radius, unschema'd `localStorage` parses, unreferenced-task GC pitfalls, unlogged swallows that only cost observability, re-entrancy/double-submit.

The provenance badges shipped on Deep-Dive (`LIVE`/`REFERENCE` + `deepDiveCaveatKind`), Model Builder (`SEEDED · demo` vs `CP-1 LIVE`), and Command Center (`Sample portfolio — not live`) are the labeling defense that capped the entire "error-phase-destruction" family (M-1…M-6) at Medium: no unlabeled seeded numeral is ever misread as live, so nothing promoted to Critical.

---

## 3. DO-NOT-FIX Ledger (binding)

An implementing agent must **not** "fix" any of these — they are deliberate design or accepted risk:

1. **Single-team authorization** — there are no per-user row filters anywhere; read/inspect/export handlers take `caller` but do not filter by `caller.id`. Pinned by `test_runs_idor` (`caos/server/routes/runs.py`). **Never add ownership/IDOR checks.**
2. **Ingestion document-parse swallowing** — malformed PDFs / filings / workbooks degrade to skip-and-continue by design (`ingest.py`, `ratings.py`, `portfolio_ingest.py`).
3. **LLM-lane fault isolation** — Blocked-gate findings, `asyncio.gather(return_exceptions=True)`, and deterministic fallbacks are the design (e.g. `routes/autonomy.py` blanket except *logs via `logger.exception`* then falls back). Never add raises to an LLM lane.
4. **RT-2026-07-04-06 (ACCEPTED, `.agent-reviews/redteam.md`)** — the in-process rate limiter (`rate_limit.py::_windows`) and asyncio single-flight locks (`routes/runs.py::_CREATE_RUN_LOCK`, `engine/queryinsights.py::_regen_inflight`) break under Phase-2 multi-worker; this is deliberately deferred. **Do not migrate them to `engine/locks.py` advisory locks** — those exist for Phase-3 pipeline lanes only.
5. **Mock-overlay fallback stance** — falling back to seeded/demo data is the product design. **Only missing labeling / phase / logging *around* a fallback is a defect. Never remove a fallback; only label it.** (This is the exact carve-out every M-1…M-6 item lives in.)
6. **Server numeric hygiene** — `is_finite_number` (`engine/periods.py`) is verified clean and rigorously enforced. Verify-only; do not refactor engine math.
7. **Other accepted redteam risks** — graph 1-hop cap (RT-2026-07-07-01), covenant scan cap 2000 (RT-2026-07-04-13), metric-key substring false-positive (RT-2026-07-07-03). Do not re-flag.

---

## 4. CRITICAL

**None confirmed at audit close.** The promotion rule (§2) was actively hunted in batches FE-2 and FE-3 (does any surface render seeded/fallback numerals with no provenance affordance at the point of reading?) — every consuming surface carries a badge or a labeled empty state, so no seeded numeral is presentable as live data. This empty section is a **finding, not an omission**: do not invent a Critical, and if future work removes a provenance badge, that surface becomes Critical by the promotion rule.

---

## 5. HIGH

### H-1 — Guard the Model Builder hydrate fetch against stale-issuer cross-contamination
- **File:** `caos/frontend/src/app/model/page.tsx`
- **Block:** `ModelBuilder` — the hydrate `useEffect` keyed on `[issuerId, ovKey, isReference]` (and the sibling `retryRestore`)
- **Vector:** Concurrency & State · **STRIDE:** Tampering (stale response writes the wrong issuer's model); secondary Information Disclosure (issuer A's saved overrides render under issuer B)
- **Failure state:** An analyst switches `/model?issuer=A` → `/model?issuer=B` client-side (no remount) before A's saved-model fetch resolves; the un-cancelled `getSavedModel(A)` lands late and overwrites B's grid with A's DB overrides/assumptions/collapsedRows and stamps B's header `SAVED` with A's `updated_at` — and because the post-hydration persist effects then write current state under the *new* issuer's key, A's overrides auto-persist into B's `localStorage` and B's saved assumptions **with no explicit save**, durably corrupting B's committee model for the whole single team.
- **Evidence:** The hydrate effect reads `localStorage` per-issuer synchronously (correct for B) but then calls `getSavedModel(issuerId).then(({o,a,c,updatedAt}) => { if(o) setOverrides(o); … setSavedAt(updatedAt); savedSnapshot.current = serializeSavable(...) })` with **no cancellation token**. The sibling `getIssuer` effect in `deepdive/page.tsx` (verified ~:96–101) uses `let stale=false; … if(!stale)…; return ()=>{stale=true}`, and `useLatestRunStatus` (`useLatestRun.ts` ~:42–70) uses a `cancelled` flag — this effect does not. `retryRestore` shares the same un-cancelled shape. The corruption is then made durable without any save action by the post-hydration persist effects — `localStorage.setItem(ovKey, JSON.stringify(overrides))` and `saveAssumptions(issuerId, assumptions)` — which fire on the next render with B's `ovKey` and A's stale state. *(The cancellation guard in the patch prevents the stale `setOverrides` entirely, so these persist effects never observe stale data — one fix closes the whole path.)*
- **Patch:**
  1. In the hydrate `useEffect`, declare `let cancelled = false` at the top and `return () => { cancelled = true }` from the effect.
  2. Gate every `setState` inside the `getSavedModel(issuerId).then(...)` **and** `.catch(...)` on `if (!cancelled)`, mirroring the `stale` guard in `deepdive/page.tsx`'s `getIssuer` effect.
  3. Apply the same `cancelled` guard to `retryRestore` (or re-check the current `issuerId` at resolution time). Leave the synchronous `localStorage` read unchanged.
- **Reuse:** stale-guard pattern → `caos/frontend/src/app/deepdive/page.tsx` (`getIssuer` effect); cancelled-guard pattern → `caos/frontend/src/lib/engine/useLatestRun.ts` (`useLatestRunStatus`); `parseSavedPayload` → `caos/frontend/src/app/model/page.tsx`
- **Accept:** Add a Model Builder hydrate test that resolves `getSavedModel(A)` *after* `issuerId` has switched to B and asserts B's overrides/`savedAt` are not clobbered by A's payload — and that neither B's `localStorage` override key nor `saveAssumptions` is written with A's data. Keep the model-page + engine-hook Vitest suites green.
- **Do not:** Do not cancel/debounce the synchronous `localStorage` read — only the async `getSavedModel` resolution must be guarded. Do not add per-user/ownership filters (single-team, ledger #1).
- **Depends on:** none. *(Severity: cross-issuer state corruption within a single-team single user, not cross-user — High, not Critical.)*

---

## 6. MEDIUM

The first six items (M-1 … M-6) are one defect class: **error-phase destruction**. `useLatestRunStatus` computes a `RunPhase` (`loading|error|none|in_flight|complete`) *specifically so a caller can distinguish a backend error from genuinely-empty coverage*, but the value-only `useLatestRun` wrapper discards the phase, so every live hook collapses `error` into the same empty value as `none`. The fix is uniform: adopt `useLatestRunStatus`, thread the phase, and let each surface show an "engine unreachable" affordance (never a seeded numeral). Reference implementation: `useLivePipelineStatus` in `lib/pipeline/useLivePipeline.ts` already does exactly this. Do M-1 before M-3, and M-4 before M-5.

### M-1 — Expose a load-error phase from `useLiveRun`
- **File:** `caos/frontend/src/lib/engine/useLiveRun.ts` · **Block:** `useLiveRun`
- **Vector:** Silent Failures · **STRIDE:** Denial of Service (observability) / Information (wrong read)
- **Failure state:** During a transient `listRuns` 5xx or network blip, Deep-Dive receives the same `EMPTY{runId:null, loading:false}` it gets for a never-analysed issuer, so a covered issuer is labeled "never analysed — figures are template" during a backend outage.
- **Evidence:** `useLiveRun` wraps the value-only `useLatestRun<LiveRunState>(...)`, which returns only `.value` and discards the `error` phase `useLatestRunStatus` already computes; `EMPTY` carries `loading:false`/`runId:null` identically for `error`, `none`, and `in_flight`.
- **Patch:** Switch `useLiveRun` to consume `useLatestRunStatus`; add `phase: RunPhase` to `LiveRunState`; thread it through so Deep-Dive can branch on `phase === 'error'`. Keep the seeded fallback for `none`/`in_flight`; only stop `error` masquerading as empty. Mirror `useLivePipelineStatus`.
- **Reuse:** `useLatestRunStatus`, `RunPhase` → `caos/frontend/src/lib/engine/useLatestRun.ts`; `useLivePipelineStatus` reference → `caos/frontend/src/lib/pipeline/useLivePipeline.ts`
- **Accept:** Hook test — mock `listRuns` to reject → assert exposed `phase === 'error'` (value still `EMPTY`); mock runs with no complete status → assert `phase` `in_flight`/`none`. Keep `components/deepdive/issuer-chat-context.test.ts` + deepdive render tests green.
- **Do not:** Do not remove the seeded fallback or make `useLiveRun` create a run; only expose the computed phase.
- **Depends on:** none.

### M-2 — Distinguish a 404-absent module from a transient failure in `useLiveRun`'s per-fetch catches
- **File:** `caos/frontend/src/lib/engine/useLiveRun.ts` · **Block:** `useLiveRun` (the `LIVE_MODULES.map(getModule …)` and `getQA(...).catch` inside the build callback)
- **Vector:** Silent Failures · **STRIDE:** Information / Denial of Service (observability)
- **Failure state:** Inside a confirmed-live run, a transient `getModule` 5xx for one module is caught to `null` identically to a by-design 404-absent module, so that tab shows a false NO-OUTPUT / "run the issuer" state (a real non-reference issuer never renders seeded content — `allowSeededFallback={isReference}` is false), indistinguishable from a genuinely-absent module; a transient `getQA` 5xx empties the CP-5C council so the analyst sees no committee findings — neither failure is logged.
- **Evidence:** The per-module catch is a blanket `catch { return null; }` that cannot tell 404-absent (by design) from a 5xx; the dropped module also drops its `liveEvidence`. For a real issuer, `deepdive/page.tsx` passes `allowSeededFallback={isReference}` (false) and `tabs.tsx` resolves `liveOut ?? (allowSeededFallback ? MODULE_OUTPUTS[id] : undefined)` → `undefined` → the labeled "OPEN PIPELINE — RUN THE ISSUER" no-output state under a ◦ REFERENCE badge, so nothing seeded is shown. `getQA(latest.id).catch(() => null)` yields `council:[]` on any QA failure. *(The E-103 cross-issuer "VERIFIED" misattribution the file header warns about is already defended in `EvidenceModal.tsx` via the `liveEv || isLiveRun ? undefined : EVIDENCE[id]` guard — the residual here is a transient failure masquerading as a by-design absent module, plus lost observability, not a seeded-numeral leak.)*
- **Patch:** In the per-module catch, inspect `axios.isAxiosError(e) && e.response?.status`: treat 404 as the silent by-design skip (`return null`) and `console.warn` (or surface a non-live marker) for any non-404. Do the same for the `getQA` catch. Reuse the axios status-inspection idiom from the `api.ts` response interceptor.
- **Reuse:** `axios.isAxiosError(e) && e.response?.status` → `caos/frontend/src/lib/api.ts` (response interceptor); `getModule`/`getQA` → `caos/frontend/src/lib/api.ts`
- **Accept:** Hook test — `getModule` rejects 404 for one module → silently skipped, others adapt; rejects 500 → a warning is logged / non-live marker surfaced. Keep `issuer-chat-context.test.ts` green.
- **Do not:** Do not turn a 404-absent module into a hard raise that aborts the live run; only branch on status + log the non-404. Do not touch the `EvidenceModal` `isLiveRun` guard.
- **Depends on:** M-1 (same file; land together).

### M-3 — Surface a distinct "engine unreachable" caveat on Deep-Dive
- **File:** `caos/frontend/src/app/deepdive/page.tsx` · **Block:** `DeepDive` — `caveatKind` computation via `useLiveRun` + `deepDiveCaveatKind`; sub-header identity render
- **Vector:** Silent Failures · **STRIDE:** Repudiation (system can't truthfully report why panes are empty); secondary DoS (outage masked)
- **Failure state:** With `listRuns` down/5xx while opening a covered issuer, `deepDiveCaveatKind` returns `noRun` and the sub-header reads "no run for {code} · run analysis to populate", telling the analyst a fully-analysed name is un-analysed and directing a wrong action during an outage.
- **Evidence:** `deepDiveCaveatKind({isReference, loading, runId})` has no error/degraded member in its union (`'reference'|'loading'|'live'|'noRun'`), so an outage (once M-1 lands, `phase:'error'`) still renders the same "run analysis" note as an untouched issuer.
- **Patch:** (1) Extend the `DeepDiveCaveatKind` union in `caveat.ts` with a `'degraded'` member and add an `error`/`phase` parameter to `deepDiveCaveatKind`, returning `'degraded'` when error, before the `noRun` branch. (2) Pass the phase from `useLiveRun` (M-1). (3) Render an "engine unreachable · retry" sub-header for `'degraded'`, reusing the existing `issuerErr` RETRY button pattern in the identity slot. **Keep issuer-scoped output suppressed in the degraded state — relabel *why* the panes are empty, do not surface seeded ATLF numerals.**
- **Reuse:** `useLatestRunStatus`/`RunPhase` → `lib/engine/useLatestRun.ts`; `deepDiveCaveatKind` union → `lib/deepdive/caveat.ts`; RETRY button pattern → `app/deepdive/page.tsx` (`issuerErr` branch)
- **Accept:** `caveat.ts` unit test — `deepDiveCaveatKind` returns `'degraded'` on error and `'noRun'` only when reachable-but-empty. Keep deepdive provenance/badge + `useLiveRun` tests green.
- **Do not:** Do not surface seeded numerals in the degraded state; do not remove the reference-deal seeded fallback. *(Ledger-#5 carve-out — missing labeling around a fallback, not by-design.)*
- **Depends on:** M-1.

### M-4 — Expose a load-error phase from `useModelEngine`
- **File:** `caos/frontend/src/lib/engine/useModelEngine.ts` · **Block:** `useModelEngine`
- **Vector:** Silent Failures · **STRIDE:** Information (wrong read)
- **Failure state:** A transient `listRuns` 5xx (or a CP-1 `getModule` 5xx, which rejects the un-caught `Promise.all`) returns the same `EMPTY{live:false, anchor:null}` as a genuinely-unanalysed issuer, so Model Builder shows its labeled "Run the issuer first" empty state during a transient outage — the analyst reads a modelled name as unmodelled with no signal the backend is merely unreachable.
- **Evidence:** `useModelEngine` wraps the value-only `useLatestRun<ModelEngineState>(...)`, discarding the `error` phase; on any error `EMPTY` is `live:false`/`anchor:null`, identical to no-run. Only the CP-2B fetch is guarded (`.catch(()=>null)`); a CP-1 5xx rejects `Promise.all` into the wrapper catch. *(The grid itself is gated behind `hasIssuerModel` and never renders seeded constants for a non-reference issuer — the residual is error-indistinguishable-from-no-coverage, not a numeral leak.)*
- **Patch:** Switch `useModelEngine` to `useLatestRunStatus`; add `phase: RunPhase` (or an `error` boolean) to `ModelEngineState`; keep the seeded fallback for `none`/`in_flight`.
- **Reuse:** `useLatestRunStatus`, `RunPhase` → `lib/engine/useLatestRun.ts`; `useLivePipelineStatus` reference → `lib/pipeline/useLivePipeline.ts`
- **Accept:** Hook test — mock `listRuns` (and CP-1 `getModule`) to reject → `phase === 'error'`, `anchor` null; no runs → `phase 'none'`. Keep Model Builder tests green.
- **Do not:** Do not remove the seeded fallback or create a run; do not add a per-user filter.
- **Depends on:** none.

### M-5 — Distinguish "engine unreachable" from "no model output" in Model Builder
- **File:** `caos/frontend/src/app/model/page.tsx` · **Block:** `ModelBuilder` (`hasIssuerModel`/`engineLoading` empty-state branch) + `ModelProvenance`
- **Vector:** Silent Failures · **STRIDE:** Repudiation (false "no output" provenance); secondary DoS (masked outage)
- **Failure state:** With the engine unreachable while opening a covered issuer, `useModelEngine`'s error collapses to `{live:false, anchor:null, loading:false}`, so `hasIssuerModel` is false and the workspace renders "No issuer-specific model output — Run the issuer first" plus a "NO MODEL OUTPUT" provenance badge — telling the analyst a modelled name is unmodelled during a transient outage.
- **Evidence:** `hasIssuerModel = isReference || !!eng.anchor` and `engineLoading = !isReference && eng.loading`; an error (loading already false) falls straight through to the "Run the issuer first" state, and `ModelProvenance` renders the idle-dot "NO MODEL OUTPUT" branch — neither is reachable-vs-unreachable aware. `SAVE`/`EXPORT` stay disabled (`disabled={!hasIssuerModel}`), so there is no destructive action — purely a why-mislabel.
- **Patch:** (1) Consume M-4's phase. (2) Add an `engineError = !isReference && eng.phase === 'error'` branch rendering an "engine unreachable · retry" panel (reuse the existing `restoreError` retry button, `role="alert"`) **before** the "No model output" empty state. (3) In `ModelProvenance`, render a distinct degraded chip for the error phase instead of the idle "NO MODEL OUTPUT".
- **Reuse:** `useLatestRunStatus`/`RunPhase` → `lib/engine/useLatestRun.ts`; `restoreError` retry (`role=alert`) → `app/model/page.tsx`; `StatusGlyph` → `components/shared/StatusGlyph`
- **Accept:** Model Builder test — error phase renders the retry/unreachable panel (not "Run the issuer first") and `SAVE`/`EXPORT` stay disabled. Keep `useModelEngine` + `ModelProvenance` suites green.
- **Do not:** Do not fall back to the seeded Atlas Forge grid for a non-reference issuer in the error state; only relabel the empty reason. Do not migrate in-process guards / add advisory locks (ledger #4).
- **Depends on:** M-4.

### M-6 — Give `usePortfolio` an error phase and log its swallow
- **File:** `caos/frontend/src/lib/engine/usePortfolio.ts` · **Block:** `usePortfolio`
- **Vector:** Silent Failures · **STRIDE:** Denial of Service (observability) / Information
- **Failure state:** A transient `GET /api/portfolio` 5xx runs `.catch(() => setState(EMPTY))` with no log, so Command Center resets to `covered=0`/`issuerCount=0`/`live:false` — indistinguishable from a genuinely-empty portfolio — and a PM scanning "what changed" reads coverage as silently dropped during an outage.
- **Evidence:** `getPortfolio().then(...).catch(() => { if (alive) setState(EMPTY); })` swallows every error into `EMPTY{coveredCount:0, issuerCount:0, live:false, loading:false}` with no phase field and no `console` log; `PortfolioState` cannot represent "backend errored" distinct from "no coverage yet".
- **Patch:** Add an `error` flag / phase to `PortfolioState` (mirror the `RunPhase 'error'` concept), set it in the catch, and add a `console.warn` there so the swallow is observable. Let Command Center show an explicit degraded affordance when set. Keep the mock fallback and the existing `alive`-guard.
- **Reuse:** `RunPhase 'error'` pattern → `lib/engine/useLatestRun.ts`; `alive`-guarded setState cancel pattern already in `usePortfolio`
- **Accept:** Hook test — mock `getPortfolio` to reject → error flag set + warning logged; zero-row success → error stays false with `live:false`. Keep Command Center tests green.
- **Do not:** Do not remove the mock fallback or add per-user row filters; only add the phase + log around the existing swallow.
- **Depends on:** none.

### M-7 — Catch the dynamic `@antv/g2` import so a chunk-load failure shows the dead-frame
- **File:** `caos/frontend/src/components/charts/G2Chart.tsx` · **Block:** `G2Chart` (the `useEffect` dynamic-import of `@antv/g2`)
- **Vector:** Silent Failures · **STRIDE:** Denial of Service (availability); secondary unhandled promise rejection
- **Failure state:** After a redeploy purges old chunks (or a brief offline blip), `import('@antv/g2')` rejects, the promise is unhandled, and `settle`/`build`/`fail` never run — so every module chart on `/deepdive` and `/reports` renders as a fixed-height empty frame with no "CHART UNAVAILABLE" indicator.
- **Evidence:** The effect's `import("@antv/g2").then((m) => { … settleTimer = setTimeout(settle, 0); })` has **no `.catch`**, unlike the render path just above it (`p.catch(fail)`). The file's own comment states `fail()` exists because "a failed render used to be swallowed silently, leaving a blank frame nobody notices" — a rejected import re-opens exactly that hole.
- **Patch:** Append `.catch(() => { if (!dead) fail(); })` to the `import("@antv/g2")` promise, reusing the existing local `fail()` dead-frame affordance (already guards on `dead`, destroys/clears any chart). No retry.
- **Reuse:** `fail()` dead-frame affordance → `caos/frontend/src/components/charts/G2Chart.tsx` (defined in the same effect)
- **Accept:** `G2Chart` test — mock `import('@antv/g2')` to reject → container renders "CHART UNAVAILABLE". Keep `normalizeFy*` unit suites green.
- **Do not:** Do not add a retry loop; surface the dead-frame once.
- **Depends on:** none.

### M-8 — Validate the parsed query-history array shape before `setHistory`
- **File:** `caos/frontend/src/app/query/page.tsx` · **Block:** `QueryWorkspace` — the `caos:query-history` load `useEffect`
- **Vector:** Data Integrity · **STRIDE:** Tampering / Denial of Service (robustness crash)
- **Failure state:** A poisoned or legacy `caos:query-history` value (e.g. the JSON number `5`, the string `"foo"`, or `[{bad:1}]`) is parsed and pushed straight into state; on the next render `history.slice`/`.map` throws and escalates to the root error boundary, which replaces the whole Query surface — and because the poison persists in `localStorage`, the surface re-crashes on every reload.
- **Evidence:** `if (stored) setHistory(JSON.parse(stored));` — the try/catch guards only the parse, not the shape. Downstream `historyRows = history.slice(0,3)` then `.map(...)` throw during render if `history` is a number/string; a wrong-shape array later throws in `addToHistory`'s `h.text.toLowerCase()` and runs a walk with an `undefined` `capId`. The sibling `parseStoredReport` (used for the report blob a few lines below) does exactly the narrowing this lacks.
- **Patch:** (1) After `JSON.parse`, reject non-arrays and per-entry require string `text`/`capId`/`capLabel` (drop non-conforming rows), mirroring `parseStoredReport`. (2) `setHistory(clean)` only when `clean.length > 0`; else leave the default `[]`. Keep the `console.warn` fallback.
- **Reuse:** `parseStoredReport` → `caos/frontend/src/lib/query/report.ts`; `Array.isArray` (native)
- **Accept:** RTL test — seed `"5"`, `'"foo"'`, `'[{"bad":1}]'` → `QueryWorkspace` mounts without throwing, Recent list empty. Keep the query-page suite green.
- **Do not:** Do not remove the try/catch or the `localStorage` read; only add shape-narrowing between parse and `setHistory`.
- **Depends on:** none.

### M-9 — Per-field-validate `loadPrefs` instead of spreading arbitrary JSON over defaults
- **File:** `caos/frontend/src/lib/research-prefs.ts` · **Block:** `loadPrefs`
- **Vector:** Data Integrity · **STRIDE:** Tampering
- **Failure state:** A legacy or hand-edited `caos.research.prefs` blob with a wrong-typed field (e.g. `criteria` as an array, or `ai_mode:"evil"`) is spread verbatim over `DEFAULT_PREFS`; the Research form then seeds a non-string into its criteria textarea (next render's `criteria.split("\n")` throws → surface crashes, persisting via `localStorage`) and the deep-research request carries an out-of-enum mode to the server.
- **Evidence:** `loadPrefs` returns `{ ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }`; the try/catch guards only a parse throw, every parsed field overwrites its default with no validation. The sibling loaders `model-mode.ts` (`MODEL_MODES.some(m => m.value === v)`) and `layout-pref.ts` (literal whitelist) validate against their allowed sets; `loadPrefs` validates nothing.
- **Patch:** (1) Build the return object field-by-field from `DEFAULT_PREFS`: accept `ai_mode` only if `max|standard|lite`, `mode` only if `sector|issuer`, else default — using the `.some(...)`/literal-whitelist idiom from `loadMode`/`loadLayout`. (2) For `audience`/`decision`/`timeframe`/`criteria`, keep the parsed value only when `typeof === "string"`, else default.
- **Reuse:** whitelist-membership idiom → `caos/frontend/src/lib/model-mode.ts`; literal whitelist branch → `caos/frontend/src/lib/deepdive/layout-pref.ts`
- **Accept:** Unit test — seed `{ai_mode:"evil", mode:99, criteria:[1,2]}` → `loadPrefs` returns `DEFAULT_PREFS` values for those fields. Keep the research/settings suite green.
- **Do not:** Do not add a server round-trip or a schema library — validate inline, keep the function synchronous and browser-local.
- **Depends on:** none.

### M-10 — Add per-segment error boundaries to the money workspaces
- **File:** `caos/frontend/src/app/error.tsx` (template) · **Block:** route segments `deepdive` / `model` / `command` / `query` / `reports` (each `page.tsx`) — no sibling `error.tsx`
- **Vector:** Silent Failures · **STRIDE:** Denial of Service
- **Failure state:** A single component in `deepdive` (or `model`/`command`/`query`/`reports`) throwing during render escalates to the root error boundary, which renders in the layout's `{children}` slot and replaces the entire surface — including that surface's own `ResponsiveShell`/`SubHeader` nav — leaving the analyst on a full-screen card whose only Retry re-runs the same failing render.
- **Evidence:** `find` over `app/` confirms only `./error.tsx` + `./global-error.tsx` exist against 15 `page.tsx` segments; `layout.tsx` renders no navigation (only `AuthProvider`/`GlobalIssuerSearch`/`AskLauncher` wrapping `<main>{children}</main>`), so per-surface nav lives *inside* each page and is wiped when the root boundary takes the `{children}` slot.
- **Patch:** Add an `error.tsx` to each of the five money-workspace segment folders, each a `"use client"` default-exported Error component mirroring `app/error.tsx` (`role="alert"` card, `console.error(error)` in `useEffect`, reset button); render the message through `toErrorMessage` so a thrown axios/FastAPI detail object never hits JSX as a raw object. Keep root `app/error.tsx` as the catch-all.
- **Reuse:** root error-boundary pattern → `caos/frontend/src/app/error.tsx`; `toErrorMessage` → `caos/frontend/src/lib/api.ts`
- **Accept:** Per new boundary, an RTL test that a child throwing renders the segment card (`role=alert`) with a working Retry. Keep existing `app/error.tsx` + `global-error.tsx` behavior green.
- **Do not:** Do not wrap panels in bare `try/catch` that swallows the throw — use real Next segment `error.tsx` boundaries. Do not delete the root catch-all.
- **Depends on:** none. *(Complements M-8/M-9: those stop the localStorage crashes at the source; this bounds the blast radius of any residual render throw.)*

### M-11 — Stop collapsing a transient probe error to `state:'gone'` in `getResearchStatus`
- **File:** `caos/frontend/src/lib/api.ts` · **Block:** `getResearchStatus`
- **Vector:** Silent Failures · **STRIDE:** Denial of Service
- **Failure state:** On reattach-after-reload, if the single `GET /api/research/{id}` probe hits a proxy 502/504 or a network blip (not a 404), the bare catch returns `{state:'gone'}`, the page drops the `sessionStorage` id, and the analyst forfeits a still-running/complete multi-minute Deep Research report (real LLM spend) with no way to reattach.
- **Evidence:** `try { job = (await api.get(...)).data } catch { return { state: 'gone' } }` inspects nothing, conflating a genuine 404 with any transient transport error — defeating the durability the code comments claim. The sibling `_pollResearch` does the correct discrimination (`if (axios.isAxiosError(e) && e.response?.status === 404) throw _gone()` else keep polling).
- **Patch:** In `getResearchStatus`'s catch, reuse the `_pollResearch` discrimination: return `{state:'gone'}` only when `axios.isAxiosError(e) && e.response?.status === 404`; for any other transport error return `{state:'running'}` (the mount then reattaches via `_pollResearch`, which tolerates blips and surfaces a real 404 as gone) and `console.error` the swallowed error.
- **Reuse:** 404-vs-transient discrimination → `_pollResearch` in `caos/frontend/src/lib/api.ts`; `RESEARCH_GONE`/`ResearchStatus` union → same file
- **Accept:** Unit test — 404 → `{state:'gone'}`, 503/network → `{state:'running'}`. Keep `_pollResearch`/`resumeResearch` tests green.
- **Do not:** Do not map a transient error to `{state:'complete'}` (would render an empty report). Keep 404 → gone.
- **Depends on:** none. *(Note: `research/page.tsx` also has a belt-and-braces `.catch(() => _storeJobId(analystId, null))` that compounds the forfeiture — fixing `getResearchStatus` is the single correct point of repair.)*

### M-12 — Surface how many EDGAR URLs failed instead of silently dropping partial failures
- **File:** `caos/frontend/src/lib/api.ts` · **Block:** `edgarVaultUrls`
- **Vector:** Data Integrity · **STRIDE:** Tampering
- **Failure state:** An analyst pastes several comma-separated EDGAR exhibit URLs and 2 of 5 fail mid-batch; `edgarVaultUrls` returns only the 3 fulfilled results with no failure count, so on a "show your work" platform the analyst believes all source filings were vaulted and proceeds on an incomplete evidence set.
- **Evidence:** `const ok = settled.flatMap(s => s.status==='fulfilled' ? [s.value] : [])` and it `throw`s only when `!ok.length`; the code comment acknowledges "partial failures are dropped, not surfaced per-URL", and the `EdgarVaultResult[]` return type has no channel to convey that N of M inputs failed.
- **Patch:** This is a return-type change, so the item must update the function **and its one consumer + test in the same commit** (per §0.2 — the commit must build and its Accept must pass):
  1. In `edgarVaultUrls`, collect the rejections (`settled.filter(s => s.status === 'rejected')`) and return `{ results, failures: [{ url, message }] }` (format each `message` via `toErrorMessage`); keep the current all-fail `throw`.
  2. Update the sole consumer `EdgarImport.vault` (`caos/frontend/src/components/upload/EdgarImport.tsx` — currently `const res = await edgarVaultUrls(...); setResults(res); res.forEach(...)`): destructure `const { results, failures } = await edgarVaultUrls(...)`, `setResults(results)`, iterate `results`, and when `failures.length > 0` render a "k of n vaulted" caveat via the component's existing error/alert display.
  3. Update `EdgarImport.test.tsx`'s `edgarVaultUrls` mock from `mockResolvedValue([{…}])` to the `{ results, failures }` shape.
- **Reuse:** `Promise.allSettled` ok/rejected split → `edgarVaultUrls` in `caos/frontend/src/lib/api.ts`; `toErrorMessage` → same file; existing result/alert render → `caos/frontend/src/components/upload/EdgarImport.tsx`
- **Accept:** Unit test — a 2-of-5 partial batch returns 3 `results` + a 2-entry `failures` list (keep the all-fail-throws test green); component test — a partial batch renders the "k of n vaulted" caveat. Keep the existing `EdgarImport` render tests green (they must be updated to the new return shape in this same commit).
- **Do not:** Do not start throwing on partial failure (one bad URL must not sink the vaulted successes); only add the failure surface. *(Ledger #5-compatible: adds labeling around the drop, keeps behavior.)*
- **Depends on:** none. *(Shares `EdgarImport.tsx::vault` with M-14 — apply M-12 first; the two edits touch different lines of `vault()` and do not conflict.)*

### M-13 — Guard the unguarded `localStorage` reads in the request interceptor and `loadMode`
- **File:** `caos/frontend/src/lib/api.ts` · **Block:** `api.interceptors.request.use` handler (calls `loadMode` + `localStorage.getItem`)
- **Vector:** Silent Failures · **STRIDE:** Denial of Service
- **Failure state:** In a locked-down enterprise browser that throws on `localStorage` access (Safari "Block All Cookies", a storage-blocking VDI policy), `loadMode()`'s unguarded `getItem` throws synchronously inside the axios request interceptor, so **every** `/api` call rejects with a non-axios error — including `getMe` — and `AuthProvider` maps it to `error:true`, showing "Can't reach the CAOS API" though the server is healthy.
- **Evidence:** The interceptor runs `config.headers.set('X-Model-Mode', loadMode())` and `localStorage.getItem('caos_query_model')` with no try/catch; `loadMode()` in `model-mode.ts` reads `localStorage` unguarded while its own sibling `saveMode()` wraps `setItem` in try/catch — proving reads were overlooked. A throwing interceptor rejects pre-send, and `AuthProvider`'s `axios.isAxiosError` is false for a raw storage `SecurityError`, so it sets `error(true)`.
- **Patch:** Wrap the interceptor's two `localStorage` reads in a small safe-read helper (try/catch → null) mirroring `saveMode`'s guard, and add the same try/catch inside `loadMode()` falling back to `DEFAULT_MODE`; the header stays best-effort and the request still goes out.
- **Reuse:** try/catch storage guard pattern → `saveMode` in `caos/frontend/src/lib/model-mode.ts`; `DEFAULT_MODE` → same file
- **Accept:** Unit test — stub `localStorage.getItem` to throw → `loadMode()` returns `DEFAULT_MODE` and the interceptor still produces a request. Keep api/model-mode tests green.
- **Do not:** Do not swallow silently without falling back to `DEFAULT_MODE` for the header — the request must still be sent.
- **Depends on:** none. *(Directly relevant to the enterprise-deployment goal — locked-down managed browsers are exactly the target environment.)*

### M-14 — Guard `EdgarImport.vault` against concurrent Enter-key double-submit
- **File:** `caos/frontend/src/components/upload/EdgarImport.tsx` · **Block:** `vault` (inside `EdgarImport`)
- **Vector:** Concurrency & State · **STRIDE:** Tampering (primary); Repudiation (secondary)
- **Failure state:** An analyst presses Enter twice (or holds Enter → keydown auto-repeat) on the URL field → two concurrent `edgarVaultUrls` writes fire, the same URL is vaulted twice, and the displayed result count reflects whichever request resolves last (stale-response race) rather than the true persisted state.
- **Evidence:** `vault()` opens with only `if (!u) return;` then `setVaulting(true)` — there is no `if (vaulting) return` busy-guard. The VAULT button is `disabled={vaulting || !url.trim()}`, but the `TextInput`'s `onKeyDown={(e) => e.key === "Enter" && vault()}` bypasses the disabled button and re-enters `vault()` while `vaulting` is true; each re-entry runs `setResults([])` before awaiting, so the shown `setResults(res)` is order-dependent. Sibling write handlers all guard (`VaultMemoUpload.submit`: `if (!file || busy) return`; `ExportToVaultButton.onClick`: `if (state.kind === "busy") return`).
- **Patch:** Add an early `if (vaulting) return;` at the top of `vault()` (right after `const u = url.trim(); if (!u) return;`), mirroring the sibling busy-guards; this de-dupes the write and eliminates the stale-response race.
- **Reuse:** busy-guard pattern → `caos/frontend/src/components/query/VaultMemoUpload.tsx` (`submit`); busy-guard pattern → `caos/frontend/src/components/reports/ExportToVaultButton.tsx` (`onClick`)
- **Accept:** Component test — render `EdgarImport`, mock `edgarVaultUrls` with a deferred promise, fire `keyDown` Enter twice → assert `edgarVaultUrls` called exactly once. Keep existing `EdgarImport` render tests green.
- **Do not:** Do not disable the Enter-to-submit affordance or remove `setResults([])`; only add the in-flight guard. No server-side dedup change — frontend re-entrancy fix only.
- **Depends on:** none. *(Shares `EdgarImport.tsx::vault` with M-12; apply after M-12 — the busy-guard is an early return at the top of `vault()`, independent of M-12's destructure edit.)*

---

## Appendix A — Verified non-findings (do not re-derive)

These were checked first-hand and are **not** defects — an executing agent must not "fix" them:

- **`app/issuers/profile/ProfileContent.tsx` — covenant-headroom / source-readiness `Number(...)` coercions.** *(Rejected: NOT_REPRODUCIBLE.)* The server only ever feeds these a finite number or `null`, and the sibling `Number(coverage.documents)` is guarded `|| 0`, so the existing `!= null` guards are sufficient — a NaN render cannot trigger.
- **`lib/api.ts` throw/propagate contract** (incl. the 401 interceptor re-throw dispatching `caos:auth-lost`). Intentional and correct — callers depend on the throw.
- **`engine/edgar_cp1.py::_TICKER_CACHE`** — an unguarded module-dict fill, but idempotent public ticker→CIK data under one event loop; a double-populate is a redundant identical write, not corruption.
- **Server data-integrity math** — `is_finite_number` is enforced on every divide/round path inspected (`engine/portfolio.py`, `engine/relval.py::build_scorecard`, `portfolio_ingest._num`, ratings parsing); zero denominators are guarded. Clean.
- **Server fire-and-forget tasks** — all `create_task` sites retain a task ref + done-callback and wrap the body in try/except (executors + `queryinsights._ensure_regen`); stranded rows are swept on boot / reaped by lease.
- **Frontend stale-response discipline** — the fetching pages not in the money-workspace set (`issuers`, `settings`, `research`, `pipeline`) already use a `stale` closure flag or an `AbortController` (`research`'s `pollAbort.current === ctrl` guard is textbook).

## Appendix B — Rejected / unconfirmed observations (non-executable)

Raised during the audit, then killed at the verifier or refuter gate. Recorded for human recall only — **do not implement**:

- **`app/reports/page.tsx` — narrow `caos-e-omit`/`caos-e-edits` maps to known report ids.** *(Rejected: NOT_REPRODUCIBLE.)* The `typeof === "object"` guard plus downstream usage did not yield a reproducible crash/poison trace; unlike M-8's `history.slice`, no render path throws on the plausible wrong shapes. If a concrete trigger is later found, it would be a Medium sibling of M-8.
- **`server/main.py::lifespan` — retain/cancel the fire-and-forget `run_warmup` task.** *(Refuted.)* The only failure state is cold-start latency (the pre-warmup baseline) with no correctness/security impact — the blessed FastAPI lifespan pattern; not a defect.
- **`server/routes/sector.py::_review_response` — log the swallowed `SectorReviewRun` payload-deserialize failure.** *(Refuted.)* Dead-defensive code: nothing in `caos/server` persists a `SectorReviewRun`, so the swallow branch is unreachable at runtime; the finding is conditioned on future work that does not exist. Revisit only if a CP-SR live-synthesis writer is added.
- **Minor observations (not spec items):** the shutdown block awaits the four `executor.stop()` calls sequentially rather than via `gather` (each `stop()` internally uses `gather(return_exceptions=True)` and is very unlikely to raise); `SectorReviewRun` has no DB index (moot — no writer). No action.

## Appendix C — Verification log

- **Coverage:** 45 files deep-read across 9 batches (FE-1…FE-6 = 30 frontend, SV-1…SV-3 = 15 server); detector sweeps + a completeness critic covered the remainder of both trees (224 frontend + 147 server files). Completeness verdict: *no high-value defect outside the audited set or the accepted-risk ledger.*
- **Gate:** every batch's draft findings passed a fresh-context verifier (independent reproduction from source, quote + one concrete trigger trace, ledger/framework-normal check, `patch_check`). Every confirmed finding then passed an adversarial refuter (survives unless concretely refuted).
- **Disposition:** 19 candidates raised → **15 confirmed** (1 High, 14 Medium) · 2 rejected (NOT_REPRODUCIBLE) · 2 refuted (by-design / unreachable). The server surface produced **zero** spec items — both server candidates were refuted, matching the recon prediction of a heavily-hardened backend.
- **Calibration:** the "error-phase-destruction" family (M-1…M-6) was recon-flagged at High and **recalibrated to Medium** by the labeling-defense rule — every consuming surface carries a provenance badge/caveat, so the defect is a mislabeled *why*, never an unlabeled seeded numeral presented as live. Critical is empty by the promotion rule (hunted, none found).
- **One classifier gap:** the refuter for FE-5-c (M-12) ran while the safety classifier was unavailable; the finding was independently re-confirmed by hand (real Data-Integrity gap; conservative fix that keeps the all-fail `throw` and only adds a failure surface; `patch_check: YES`) before inclusion.
- **Post-write verification:** a fresh whole-spec verifier independently opened every cited file and returned **SHIP-WITH-FIXES**; both fixes were applied. (1) **M-2** symptom reworded — a real (non-reference) issuer never renders seeded content (`allowSeededFallback={isReference}` is false), so a transiently-dropped module shows a *labeled* no-output state, not seeded numerals; this reinforces the empty-Critical section. (2) **M-12** patch extended to update its sole consumer `EdgarImport.vault` + `EdgarImport.test.tsx` in the same commit, since the return-type change would otherwise fail the commit's own build under §0.2. H-1's evidence was also strengthened to note the post-hydration auto-persist path (`localStorage`/`saveAssumptions`) that makes the cross-issuer corruption durable without an explicit save (the same single cancellation guard closes it).
