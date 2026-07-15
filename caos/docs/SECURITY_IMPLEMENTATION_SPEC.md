# CAOS Security & Data-Integrity Implementation Spec (for Opus 4.8)

**Scope:** `caos/frontend/src/` and `caos/server/`  
**Audit vectors:** Concurrency & State; Data Integrity; Silent Failures  
**Audit date:** 2026-07-15  
**Execution rule:** Apply confirmed items top-to-bottom by severity; do not expand the single-team authorization model or change intentional best-effort document parsing.

## CRITICAL — silent-wrong-read / cross-request leak / dead security gate (do first)

### [CRITICAL] Security assurance — Repair the false-green route-auth detector
- **Failure state (1 sentence):** `python3 run_sec_audit.py` exits successfully with `[]` after inspecting zero `async def` FastAPI handlers, so a future unauthenticated route can pass the security gate unnoticed.
- **Location:** `run_sec_audit.py` → module-level AST route-handler scan (`for node in ast.walk(tree)`).
- **Lens:** STRIDE Elevation of Privilege + OWASP A01/A10; this is a dead assurance control, not a claim that current routes lack authentication or that single-team row authorization is required.
- **Opus instruction (technical):** Match both `ast.FunctionDef` and `ast.AsyncFunctionDef`; resolve router decorators whether expressed as `router.get(...)` or another attribute call; inspect each parameter's **default** for `Depends(get_identity)` as well as its `CallerIdentity` annotation; replace filename substring exclusions with an explicit allowlist of intentional pre-auth/health endpoints; fail non-zero on parse errors or findings; and add fixtures proving one protected async route passes while an unprotected async route fails.
- **Integrity payoff (1 line):** Restores a meaningful fail-closed security gate so authentication regressions cannot ship behind a false pass.

## HIGH — races & unhandled rejections that degrade correctness under concurrency; swallows on data paths

### [HIGH] Cross-worker coordination — Fail closed when advisory-lock release fails
- **Failure state (1 sentence):** If `pg_advisory_unlock` raises, `advisory_lock` silently returns the pooled PostgreSQL session with its session-level lock potentially still held, starving other workers from that single-flight lane until the physical connection is recycled.
- **Location:** `caos/server/engine/locks.py` → `advisory_lock` finalizer and `release_advisory_lock`.
- **Lens:** STRIDE Denial of Service / Tampering; this concerns a process-shared concurrency primitive and does not reduce to per-issuer authorization or the SQLite test fallback.
- **Opus instruction (technical):** In the PostgreSQL release-failure path, log the exception with the advisory key, invalidate the underlying checked-out connection so the physical session closes and PostgreSQL releases all session locks, and preserve the original critical-section exception if one is already propagating; add a PostgreSQL integration test that forces unlock failure and proves the connection is not returned reusable with the lock held.
- **Integrity payoff (1 line):** Prevents a hidden unlock failure from degrading cross-worker serialization into a persistent, intermittently unavailable processing lane.

## MEDIUM — missing error boundaries, non-critical leaks, CI-hygiene, defensive gaps at real boundaries

### [MEDIUM] Startup concurrency — Retain and drain the embeddings warmup task
- **Failure state (1 sentence):** During startup the lifespan creates `run_warmup()` without retaining its task, allowing the event loop's weakly referenced background task to disappear or remain undrained during shutdown and leave embeddings cold without a deterministic lifecycle signal.
- **Location:** `caos/server/main.py` → `lifespan` and nested `run_warmup` block.
- **Lens:** STRIDE Denial of Service; this is background-task lifecycle reliability, not ordinary awaited-promise behavior.
- **Opus instruction (technical):** Store the created task on `app.state` (or in the same retained-task set plus discard callback pattern used by the executors), attach a done callback that logs unexpected terminal exceptions, and on lifespan shutdown cancel and await it with `CancelledError` handled before stopping the executors.
- **Integrity payoff (1 line):** Makes startup readiness and shutdown deterministic so enterprise workers do not silently serve with an abandoned embeddings warmup.

### [MEDIUM] Desk Brief integrity — Re-guard persisted metric deltas as finite
- **Failure state (1 sentence):** A legacy or manually corrupted `MetricFact.value` containing `NaN` or infinity reaches `_delta_entries`, where subtraction and formatting emit non-finite Desk Brief evidence instead of rejecting the poisoned value.
- **Location:** `caos/server/engine/queryinsights.py` → `_delta_entries` grouping and latest-versus-prior subtraction block.
- **Lens:** STRIDE Tampering + OWASP A08/A10; this is a defensive read-boundary consistency gap for persisted external-derived data, not an allegation of an unguarded CP-1 divide or a live write-path bypass.
- **Opus instruction (technical):** Import and apply `engine.periods.is_finite_number` to both `latest` and `prior` immediately before subtraction, skip the delta when either value is non-finite, and add a regression test mirroring `engine.metricengine._delta_entries` with `NaN`/`Infinity` rows.
- **Integrity payoff (1 line):** Stops corrupted historical facts from becoming literal non-finite evidence in an analyst-facing, model-grounding pack.

### [MEDIUM] Document intake — Surface issuer-directory load failure
- **Failure state (1 sentence):** When `getIssuers()` rejects on an unseeded Upload page, the empty catch leaves the issuer picker indistinguishable from a genuinely empty directory and blocks intake with no error or retry path.
- **Location:** `caos/frontend/src/components/upload/UploadWizard.tsx` → mount effect that calls `getIssuers` when `issuers.length === 0`.
- **Lens:** STRIDE Denial of Service + OWASP A10; this is a swallowed operational failure on the first pipeline step, not best-effort document parsing.
- **Opus instruction (technical):** Add an explicit issuer-load state (`loading | ready | error`), route rejection through `toErrorMessage`, render the existing error treatment with a retry action that reissues `getIssuers`, and reserve the empty-directory copy for a successful empty response.
- **Integrity payoff (1 line):** Prevents an API outage from masquerading as “no issuers” and silently dead-ending the extraction pipeline before source intake.

### [MEDIUM] Deep Research — Preserve durable-job reattachment on transient probe failure
- **Failure state (1 sentence):** A timeout, network blip, or 5xx on the single mount-time `getResearchStatus` probe deletes the saved durable job id, permanently orphaning an in-flight or completed paid research report from the browser even though the server job still exists.
- **Location:** `caos/frontend/src/app/research/page.tsx` → reattach-on-mount effect, outer `getResearchStatus(stored).catch` block.
- **Lens:** STRIDE Denial of Service / Repudiation + OWASP A10; the trigger is a transient exceptional condition being treated as terminal loss, not the intentional handling of an actual owner-scoped 404.
- **Opus instruction (technical):** Keep the stored id on non-404 probe errors, expose a compact “research status unavailable” retry affordance, and retry with bounded backoff while mounted; delete the id only when `getResearchStatus` returns the typed `gone` or `failed` terminal state, and cancel retry timers in effect cleanup.
- **Integrity payoff (1 line):** Preserves expensive durable research across transient transport failures and prevents a silent loss of the analyst's only reattachment pointer.

### [MEDIUM] Deep Research — Make model-configuration status failure explicit
- **Failure state (1 sentence):** If `getSettings()` fails, the empty catch leaves `llmConfigured` unknown while the primary action still presents “Run deep research,” hiding whether the next run will be live or deterministic demo output.
- **Location:** `caos/frontend/src/app/research/page.tsx` → demo-versus-live `getSettings` mount effect and primary action/banner rendering.
- **Lens:** STRIDE Repudiation / Tampering + OWASP A10; the failure obscures provenance mode at an analyst decision point and is not a permitted deterministic-fallback swallow.
- **Opus instruction (technical):** Represent configuration as `loading | live | demo | error`, set `error` on rejection, render a visible “configuration unavailable” state with retry, and disable or require explicit confirmation before starting research while the provenance mode is unknown; keep the existing demo path when a successful response reports `llm_configured === false`.
- **Integrity payoff (1 line):** Ensures analysts never launch or interpret a research run without knowing whether its output is live-model or canned-demo provenance.

### [MEDIUM] Query — Handle rejected run and pin actions in the workbench
- **Failure state (1 sentence):** A network/5xx rejection from `createQueryRun` or `createFinding` escapes the `void` click handler as an unhandled promise rejection, resets the busy flag in `finally`, and leaves the analyst with no failure state or retry guidance.
- **Location:** `caos/frontend/src/components/query/QueryInvestigationWorkbench.tsx` → `runQuery`, `pinFinding`, and their `void` event-handler call sites.
- **Lens:** STRIDE Repudiation / Denial of Service + OWASP A10; these are genuinely unhandled event-promise failures, not awaited promises with a handler.
- **Opus instruction (technical):** Add typed `runError` and `pinError` state; catch each API rejection with `toErrorMessage`, preserve the prior successful result/history, render an inline retryable alert beside the affected action, and keep `finally` solely for clearing `running`/`pinning`; add rejected-promise component tests that assert no `unhandledrejection` event fires.
- **Integrity payoff (1 line):** Prevents a failed investigation or evidence pin from disappearing silently while stale successful state remains on screen.

### [MEDIUM] Global ASK — Handle rejected finding pins
- **Failure state (1 sentence):** When `analysisApi.createFinding` rejects, `void pinQueryFinding()` produces an unhandled promise rejection and the ASK drawer gives no indication that the cited answer was not preserved.
- **Location:** `caos/frontend/src/components/shared/Ask.tsx` → `AskModal.pinQueryFinding` and the “PIN FINDING” click handler.
- **Lens:** STRIDE Repudiation + OWASP A10; this is an unhandled persistence failure on an analyst work-product action, not a permitted read fallback.
- **Opus instruction (technical):** Wrap the pin call in `try/catch/finally`, add a `pinning` guard against duplicate clicks, surface `toErrorMessage` in a retryable inline status, set `pinned` only after the write resolves, and test rejection plus rapid double-click behavior.
- **Integrity payoff (1 line):** Gives the analyst a truthful durable-state signal instead of silently losing a finding they believed they pinned.

### [MEDIUM] Pipeline — Distinguish an absent CP-X module from a failed module read
- **Failure state (1 sentence):** Any `getModule(latest.id, "CP-X")` rejection is converted to `null`, so a 5xx/timeout builds a nominal live pipeline with fallback gate status and an empty route summary exactly as if CP-X were legitimately absent.
- **Location:** `caos/frontend/src/lib/pipeline/useLivePipeline.ts` → `buildPipeline`'s `Promise.all` CP-X fetch.
- **Lens:** STRIDE Tampering / Repudiation + OWASP A10; the swallow changes the meaning of a live analytical result and is not the documented static-demo fallback.
- **Opus instruction (technical):** Catch only an Axios 404 as the intentional `null` case; rethrow non-404 failures so `useLatestRunStatus` / `useExactPipelineStatus` enters its existing `error` phase, and add tests for 404-versus-500 behavior.
- **Integrity payoff (1 line):** Stops a backend failure from being rendered as a valid but less-informative execution graph.

### [MEDIUM] Route resilience — Complete per-surface error-boundary coverage
- **Failure state (1 sentence):** A render or lifecycle exception in Decisions, Issuers, Monitor, Pipeline, Portfolios, Research, Sector, Sector RV, Settings, Sponsors, or Upload bubbles to the root error boundary and replaces the entire application surface instead of containing the failure at the affected route.
- **Location:** `caos/frontend/src/app/` → missing top-level `error.tsx` files for `decisions`, `issuers`, `monitor`, `pipeline`, `portfolios`, `research`, `sector`, `sector-rv`, `settings`, `sponsors`, and `upload`; existing `command/error.tsx`, `deepdive/error.tsx`, `model/error.tsx`, `query/error.tsx`, and `reports/error.tsx` are the reuse pattern.
- **Lens:** STRIDE Denial of Service + OWASP A10; this is missing failure containment, not ordinary Next.js error propagation mislabeled as a framework bug.
- **Opus instruction (technical):** Add an `error.tsx` in each named top-level segment that re-exports or renders `components/shared/RouteErrorBoundary`, add a smoke test that throws inside representative segments and asserts the route-local recovery UI preserves the root shell, and keep `app/global-error.tsx` only for root-layout failure.
- **Integrity payoff (1 line):** Contains a broken analytical surface so concurrent work elsewhere in the institutional workspace remains navigable and recoverable.

### [MEDIUM] Report Studio — Handle analysis-context link rejection
- **Failure state (1 sentence):** When the effect that attaches the live run to the analysis context rejects, its `void analysis.patch(...)` call emits an unhandled promise rejection and the report gives no indication that its context still points at the prior run.
- **Location:** `caos/frontend/src/app/reports/page.tsx` → `ReportStudio` effect that patches `issuer_ids`, `artifacts.issuer_run_id`, and report `surface_state` when `live.runId` changes.
- **Lens:** STRIDE Tampering / Repudiation + OWASP A10; this is a failed metadata write that leaves durable context stale, not an intentional local-draft fallback.
- **Opus instruction (technical):** Add a cancellation guard and `.catch` that sets a dedicated context-link error (without overwriting publish/autosave status), expose a retry action that reissues the same patch against the current context/run, and add a rejection test asserting no `unhandledrejection` and no false “linked” state.
- **Integrity payoff (1 line):** Prevents Report Studio from silently presenting a live report while its shared analysis context remains bound to an older execution.

> Checkpoint 1: pending fresh-context verification of 5 files; 5 candidates proposed, 4 tiered, 1 retained as non-tiered informational.

> Checkpoint 2: pending fresh-context verification of 5 files; 2 inherited candidates proposed, 0 tiered provisionally because current principal-bound storage clearing and Model Builder stale-response guards appear to resolve both.

> Checkpoint 3: pending fresh-context verification of 5 files; 6 candidates proposed, 3 tiered provisionally, 2 appear fixed/moved, and the uncancelled toast timer remains below the implementation threshold.

> Checkpoint 4: pending fresh-context verification of 5 files; 4 candidates proposed, 3 tiered provisionally, while the autonomy poller and role-view debounce passed local lifecycle review.

> Checkpoint 5: pending fresh-context verification of 5 files; 3 candidates proposed, 2 tiered provisionally, and the remaining assumptions-storage validation gap stayed below threshold.

> Checkpoint 6: pending fresh-context verification of 5 files; 1 inherited defensive candidate rechecked, 1 retained provisionally, and 0 new data-integrity candidates proposed.

> Checkpoint 7: pending fresh-context verification of 5 files; 3 apparent arithmetic candidates examined, 0 proposed after reading their finite and denominator guards in context.

> Checkpoint 8: pending fresh-context verification of 5 files; 1 latent unused-claim candidate proposed, 0 tiered provisionally because the active executors retain/drain tasks and the helper has no current caller.

> Checkpoint 9: pending fresh-context verification of 5 files; 7 broad-catch candidates examined, 0 proposed after separating intentional best-effort parsing from fail-closed authoritative workbook validation.

> Checkpoint 10: pending fresh-context verification of 5 files; 6 process-global candidates examined, 0 proposed after confirming request-scoped sessions/identity, ContextVar model state, and locked shared-desk caches.
