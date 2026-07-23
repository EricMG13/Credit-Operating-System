# CAOS Security & Data-Integrity Implementation Spec (for Opus 4.8)

**Board ruling:** **NO-GO for enterprise multi-user deployment** until every Critical and High item below is closed and its acceptance test passes; close the Medium queue before general availability unless the security owner records an explicit, time-bounded exception.

**Scope audited:** `caos/frontend/src/` (Next.js 16 / React 19) and `caos/server/` (FastAPI), with the root security detector included because it gates those sources.
**Vectors:** Concurrency & State; Data Integrity; Silent Failures.
**Audit date:** 2026-07-15.
**Execution law:** Apply items top-to-bottom; do not add tenant/issuer ACLs to the intentional single-team model, alter the trusted-proxy boundary, or turn intentional document parsing into fail-closed ingestion.

## CRITICAL — silent-wrong-read / cross-request leak / dead security gate (do first)

### [CRITICAL] Issuer Research Report — Validate the payload before rendering the durable Markdown

- **Failure state (1 sentence):** When a live model emits an unsupported figure or mismatched action bias, `synthesize_research_report` renders it before `validate_report_figures` drops or gates the payload field, so `_run_report` persists a `complete` Markdown report that still contains the false figure and ungated action.
- **Location:** `caos/server/research_report.py` → `synthesize_research_report` final rendering block, `_render_sections_markdown`, and `validate_report_figures`; `caos/server/research_report_executor.py` → `_run_report` validation and persistence block.
- **Lens:** STRIDE Tampering / Repudiation; DREAD **9.2/10**; this is the committee-facing denormalized output disagreeing with its validated source payload, not best-effort document parsing.
- **Owner:** Opus 4.8 — Backend Research, with Security review.
- **Opus instruction (technical):** Make live synthesis return the structured payload and truncation metadata without final Markdown; in `_run_report`, call `validate_report_figures` first and render only from the mutated payload through one public validated-render helper, then apply the truncation banner; keep the no-key demo path explicitly `demo=True`; add an invariant test whose 9.9x mismatched figure is absent from both payload and Markdown and whose mismatched CP-6A action bias renders `(GATED)`.
- **Integrity payoff (1 line):** The durable analyst report becomes a deterministic rendering of the exact figure-validated payload instead of a stale pre-validation copy.

### [CRITICAL] Security assurance — Repair the false-green route-auth detector

- **Failure state (1 sentence):** `python3 run_sec_audit.py` exits successfully with `[]` after inspecting zero FastAPI route handlers because it matches `ast.FunctionDef` while all current handlers are `ast.AsyncFunctionDef`.
- **Location:** `run_sec_audit.py` → module-level route-file AST loop, route-decorator recognition, identity-dependency recognition, and exclusion logic.
- **Lens:** STRIDE Elevation of Privilege; DREAD **8.0/10**; manual review found current auth coverage intact, so the defect is the dead assurance control rather than a request for per-issuer authorization.
- **Owner:** Opus 4.8 — Security Tooling.
- **Opus instruction (technical):** Scan both sync and async definitions; recognize router decorators expressed as attribute calls; inspect `CallerIdentity` annotations and parameter defaults containing `Depends(get_identity)` / `Depends(get_write_identity)` plus router-level dependencies; replace filename-substring exclusions with an exact allowlist of intentional pre-auth and health blocks; fail non-zero on parse errors or findings; add positive, negative, async, router-dependency, and allowlisted fixtures.
- **Integrity payoff (1 line):** Route-auth regressions can no longer ship behind a security gate that reports success without inspecting a handler.

## HIGH — races & unhandled rejections that degrade correctness under concurrency; swallows on data paths

### [HIGH] Principal lifecycle — Make an identity change an atomic client-state boundary

- **Failure state (1 sentence):** On a shared browser, a 401, legacy first login, cross-tab principal swap, or late auth/context response can leave analyst A's stored or mounted work product alive and then render or persist it under analyst B.
- **Location:** `caos/frontend/src/components/shared/AuthProvider.tsx` → `refresh`, auth-lost/visibility effect, and provider subtree; `caos/frontend/src/lib/api.ts` → `clearWorkspaceStorage` and `bindWorkspacePrincipal`; `caos/frontend/src/components/deepdive/IssuerChat.tsx` → `IssuerChat` storage initializer and persistence effect; `caos/frontend/src/lib/analysis-workbench.ts` → `pendingContextCreates`, `createContextOnce`, and `useAnalysisContext` load effect.
- **Lens:** STRIDE Information Disclosure / Tampering; DREAD **8.0/10**; this is cross-principal browser state, not the server's intentional single-team visibility.
- **Owner:** Opus 4.8 — Frontend/Auth, with Security review.
- **Opus instruction (technical):** Add a generation or abort guard so only the newest `refresh` may set identity; clear workspace storage on a confirmed 401 and whenever the principal marker is absent or differs; listen for cross-tab marker changes; key/remount the protected subtree by resolved principal id (including the unauthenticated state); reset mounted issuer-owned state before persistence; and move pending context-create dedup into principal-scoped state or key it by principal plus generation; test legacy no-marker login, A→B same-tab and cross-tab swaps, a deferred A context creation during B login, and mounted chat state that must not write back after the swap.
- **Integrity payoff (1 line):** A principal transition can no longer carry transcripts, model inputs, report edits, query history, model tier, or in-flight context state into the next analyst session.

### [HIGH] Analysis Context — Serialize server merges and reject stale client responses

- **Failure state (1 sentence):** Two concurrent context patches can each merge against the same old JSON snapshot and last-writer-win away a disjoint artifact or surface update, while an older HTTP response can later overwrite the newer client context.
- **Location:** `caos/server/routes/analysis.py` → `_owned_context`, `patch_context`, artifact merge, surface-state merge, and whole-column assignment blocks; `caos/server/database.py` → `AnalysisContextRecord`; `caos/frontend/src/lib/analysis-workbench.ts` → `useAnalysisContext.patch`.
- **Lens:** STRIDE Tampering; DREAD **7.6/10**; this is a confirmed read/merge/write race on analyst-owned analytical lineage, not cross-team authorization.
- **Owner:** Opus 4.8 — Backend Analysis Context + Frontend Platform.
- **Opus instruction (technical):** Lock the owned context row with `SELECT ... FOR UPDATE` before reading merge bases and add a monotonic integer revision/ETag for compare-and-swap; accept sparse nested artifact/surface deltas and merge them under the lock; return 409 with the current revision on conflict; serialize client mutations or apply responses only when their generation/revision is current, refetching and replaying the sparse delta after a conflict; add two-session tests for disjoint artifact and surface updates plus a component test where patch B resolves before patch A.
- **Integrity payoff (1 line):** Concurrent surfaces retain every lineage and selection update, and the browser cannot regress to an older context than the database.

### [HIGH] Model Builder — Establish an issuer-scoped hydration and checkpoint boundary

- **Failure state (1 sentence):** Navigating issuer A→B without a remount leaves hydration marked complete and A's assumptions, overrides, saved flags, collapsed rows, or checkpoints actionable long enough to persist or restore them under B, especially when B storage is malformed or its async checkpoint read is pending.
- **Location:** `caos/frontend/src/app/model/page.tsx` → `ModelBuilder` issuer hydration effect, persistence effects, and saved-model restore block; `caos/frontend/src/lib/model/useModelHistory.ts` → issuer-change hydration effect, `restoreCheckpoint`, and `deleteCheckpoint`.
- **Lens:** STRIDE Tampering; DREAD **7.6/10**; this is cross-issuer analytical state corruption in one authorized session, not a missing ACL.
- **Owner:** Opus 4.8 — Model Builder Frontend.
- **Opus instruction (technical):** Key the stateful builder by `issuerId` or use an issuer-keyed reducer; replace `hydrated` with `hydratedIssuerId`; synchronously reset every issuer-owned field and checkpoint list on transition; validate local override objects before applying them; gate persistence and checkpoint actions on `hydratedIssuerId === loadedIssuerId === issuerId`; reject late callbacks with an issuer generation; test malformed B storage, A-saved→B-unsaved, A checkpoints visible while B loads, and restore/delete clicks during transition.
- **Integrity payoff (1 line):** An analyst can switch issuers without silently seeding the new credit model from the prior issuer's work.

### [HIGH] Report export — Move bounded XLSX/PDF rendering off the FastAPI event loop

- **Failure state (1 sentence):** A contract-valid large published report synchronously runs `render_report_xlsx` or `render_report_pdf` inside the async endpoint, blocking unrelated requests for the full render duration and allowing concurrent exports to exhaust a worker.
- **Location:** `caos/server/routes/reports.py` → `export_report_version`; `caos/server/report_exports.py` → `render_report_xlsx` and `render_report_pdf`.
- **Lens:** STRIDE Denial of Service; DREAD **8.0/10**; a verifier measured a 1.615-second event-loop stall from an accepted XLSX payload.
- **Owner:** Opus 4.8 — Backend Reports/Runtime.
- **Opus instruction (technical):** Run both renderers through `asyncio.to_thread` behind a process-local semaphore sized from configuration, preserve cancellation/HTTP error mapping, and add an event-loop-liveness test plus a concurrency-cap test at the existing maximum payload bounds.
- **Integrity payoff (1 line):** One analyst's committee export cannot pause auth, ingestion, monitoring, or other analysts' requests on the same worker.

### [HIGH] Research report queue — Use one lease owner and fence terminal writes

- **Failure state (1 sentence):** `ReportQueueWorker._claim_one` stores `self._worker_id`, `_run_report` overwrites it with `_WORKER_ID`, and `_heartbeat` still filters on the former, so long jobs lose heartbeats and can be reclaimed and completed twice with duplicate spend and last-writer-wins report output.
- **Location:** `caos/server/research_report_executor.py` → module `_WORKER_ID`, `_run_report`, `ReportQueueWorker._claim_one`, `_heartbeat`, and `_run_loop`.
- **Lens:** STRIDE Tampering / Denial of Service; DREAD **7.2/10**; this is a deterministic multi-worker lease-ownership mismatch, not ordinary crash recovery.
- **Owner:** Opus 4.8 — Backend Job Runtime.
- **Opus instruction (technical):** Generate one owner/claim token per worker attempt and pass it into `_run_report` without overwriting it; use `caos_report_lease_seconds` consistently; make heartbeat log/fail when its conditional update affects zero owned rows; condition every terminal success/failure update on `(id, worker_id, attempt, status='running')`; stop work if ownership is lost; test a job beyond one lease interval, sibling reclaim, worker crash, and stale completion rejection.
- **Integrity payoff (1 line):** Exactly one worker owns and finalizes each durable research report attempt.

### [HIGH] Live analytical state — Do not convert primary module-read failures into complete runs

- **Failure state (1 sentence):** A 401, missing run, 5xx, or network failure while loading the primary module register or CP-X is converted to an empty/fallback value, producing a live `complete` run or nominal pipeline whose authoritative analytical content was never read.
- **Location:** `caos/frontend/src/lib/engine/useLiveRun.ts` → build callback and `getModules(...).catch(() => [])`; `caos/frontend/src/lib/pipeline/useLivePipeline.ts` → `buildPipeline` CP-X fetch.
- **Lens:** STRIDE Tampering / Repudiation; DREAD **8.0/10**; the failure is rendered as authoritative engine state rather than the documented static reference demo.
- **Owner:** Opus 4.8 — Frontend Engine Integration.
- **Opus instruction (technical):** Remove the primary `getModules` catch because a legitimate empty register is already `200 []`; let rejection enter `useLatestRunStatus`'s existing `error` phase and clear `runId`; for CP-X, map only a typed 404 absence to the intentional fallback and rethrow 401/5xx/network errors; add 200-empty, 404, 500, and network tests asserting phase, run id, and absence of a false live/complete label.
- **Integrity payoff (1 line):** Deep-Dive, ASK, and Pipeline cannot affirm or ground decisions in an analytical run that failed to load.

### [HIGH] Portfolio Fit — Fail visibly when a bound book's concentration read fails

- **Failure state (1 sentence):** Any exception in the live concentration read is converted to `None`, after which CP-3C persists a High-confidence fit with the false “portfolio feed not ingested” note and CP-6A receives no actual concentration warning.
- **Location:** `caos/server/engine/portfoliofit.py` → `_live_concentration` and `synthesize_portfolio_fit` live concentration block; `caos/server/engine/runner.py` → `_attempt_synth` and session-bound module execution.
- **Lens:** STRIDE Tampering; DREAD **8.0/10**; this hides a bound portfolio risk and is unrelated to document parsing.
- **Owner:** Opus 4.8 — Portfolio Engine.
- **Opus instruction (technical):** Return an explicit empty-book result only when the position query succeeds with no rows; remove the broad catch and convert non-transaction-poisoning calculation/access failures to a blocked CP-3C result with a limitation and non-High confidence; make transaction/connection failures from session-bound synthesizers abort and retry the run after rollback instead of attempting persistence on a poisoned session; test empty book, HIGH concentration, missing bound portfolio, calculation exception, and DB exception.
- **Integrity payoff (1 line):** A book-read outage cannot masquerade as a concentration-free sizing recommendation.

### [HIGH] Issuer Research Report — Fail closed when structured synthesis cannot be repaired

- **Failure state (1 sentence):** If the live model retry raises or still omits the required tool payload, `synthesize_research_report` returns free text or `_demo_report()` with `demo=False`, and `_run_report` records it as a completed live report.
- **Location:** `caos/server/research_report.py` → `synthesize_research_report` one-shot repair branches; `caos/server/research_report_executor.py` → `_run_report` result persistence.
- **Lens:** STRIDE Tampering / Repudiation; DREAD **8.6/10**; configured live synthesis is being mislabeled rather than using the explicit no-key demo boundary.
- **Owner:** Opus 4.8 — Backend Research.
- **Opus instruction (technical):** After a configured live call fails to produce a valid tool payload on the allowed repair attempt, raise a typed synthesis exception; never call `_demo_report` from the configured-live branch; let `_run_report` mark the durable job failed with a bounded diagnostic; keep deterministic demo output only behind `llm_configured() === false`; test retry exception, second no-tool response, empty text, and correct `failed`/`demo`/provenance status.
- **Integrity payoff (1 line):** Analysts can distinguish a failed live report from a successful model-grounded report and from an explicit demo.

### [HIGH] Downside Pathway — Do not label a modeled 30% distress breach LOW

- **Failure state (1 sentence):** With finite 5.0x current leverage, the 30% scenario reaches 7.14x and sets `shock_to_breach_pct=30` but the ladder returns `fragility='LOW'`, which downstream debate can restate as resilience.
- **Location:** `caos/server/engine/downside.py` → `compute_pathways` fragility ladder and `synthesize_downside`; downstream consumers `caos/server/engine/debate.py` → `_ic_signals` and `caos/server/routes/issuers.py` → issuer-profile strength/weakness assembly.
- **Lens:** STRIDE Tampering; DREAD **8.6/10**; this is an ordinary finite-input classification defect confirmed by direct reproduction, not a manufactured unguarded divide.
- **Owner:** Opus 4.8 — Credit Engine.
- **Opus instruction (technical):** Classify already-distressed or breach-by-10 as HIGH, any later modeled breach (20 or 30) as at least MODERATE, and LOW only when no modeled shock breaches; update the ladder documentation and `test_compute_pathways_contract.py`, then add downstream debate/profile regressions for 5.0x and threshold-adjacent values.
- **Integrity payoff (1 line):** A modeled distress breach can no longer be converted into a bullish resilience signal.

### [HIGH] Liquidity — Reject negative or sign-inconsistent runway outputs

- **Failure state (1 sentence):** Finite but domain-inconsistent liquidity, EBITDA, or coverage values can yield negative annual cash interest and a negative month runway that is published at High confidence as “covers ~-24 months.”
- **Location:** `caos/server/engine/liquidity.py` → `_interest_runway_months` and `synthesize_liquidity` summary/claim construction.
- **Lens:** STRIDE Tampering; DREAD **7.4/10**; all finite and zero guards execute, so this is a reproduced domain-sign validation gap rather than a missed `is_finite_number` check.
- **Owner:** Opus 4.8 — Credit Engine.
- **Opus instruction (technical):** Require disclosed liquidity to be finite and non-negative and the derived annual cash-interest result to be finite and strictly positive before computing runway; require the final runway to be finite and non-negative; otherwise return `(None, None)` with an explicit limitation/Insufficient confidence; replace the negative golden expectations in `test_interest_runway_contract.py` and add claim-level tests for inconsistent signs and zero/negative liquidity.
- **Integrity payoff (1 line):** The liquidity module degrades on economically invalid inputs instead of publishing an impossible runway.

## MEDIUM — missing error boundaries, non-critical leaks, CI-hygiene, defensive gaps at real boundaries

### [MEDIUM] Advisory locks — Invalidate a PostgreSQL session after unlock failure

- **Failure state (1 sentence):** If `pg_advisory_unlock` raises, `advisory_lock` swallows the error and may return a pooled PostgreSQL session that still owns the session-level lock, starving that single-flight lane.
- **Location:** `caos/server/engine/locks.py` → `release_advisory_lock` and `advisory_lock` finalizer.
- **Lens:** STRIDE Denial of Service; DREAD **5.0/10**; the current consumer is availability-sensitive and this does not imply unauthorized data access.
- **Opus instruction (technical):** Log the advisory key and release exception; invalidate the underlying checked-out connection so the physical session closes; preserve an exception already propagating from the critical section; add a PostgreSQL integration test that forces unlock failure and proves the connection is not returned reusable with the lock held.
- **Integrity payoff (1 line):** A hidden unlock failure cannot strand a cross-worker processing lane.

### [MEDIUM] Startup lifecycle — Retain and drain the embeddings warmup task

- **Failure state (1 sentence):** Lifespan starts `run_warmup` without retaining its task and shuts down without cancelling or awaiting it, so the worker can exit with warmup still pending and no deterministic completion state.
- **Location:** `caos/server/main.py` → `lifespan`, nested `run_warmup`, and shutdown sequence.
- **Lens:** STRIDE Denial of Service; DREAD **5.6/10**; this is a reproduced lifecycle gap, not a claim about normal Python task scheduling.
- **Opus instruction (technical):** Store the task on `app.state` or in the executors' retained-task set pattern; attach a done callback for unexpected terminal errors; cancel and await it with `CancelledError` handling before executor shutdown completes; add a lifespan test with a deliberately blocked warmup.
- **Integrity payoff (1 line):** Startup readiness and shutdown become deterministic under worker rotation.

### [MEDIUM] Vault memo sync — Advance the scan fingerprint only with a committed link set

- **Failure state (1 sentence):** `sync_analyst_memos` advances process-global vault mtime/count after uncommitted DELETE/INSERT work, so a later dependency commit failure rolls back `AnalystLink` rows while every unchanged request skips the resync indefinitely.
- **Location:** `caos/server/vault_export.py` → `sync_analyst_memos`; `caos/server/database.py` → `get_db` post-yield commit boundary.
- **Lens:** STRIDE Tampering / Repudiation; DREAD **5.2/10**; the cache is shared process state becoming authoritative before its database transaction.
- **Opus instruction (technical):** Make the committed database fingerprint authoritative—prefer a sync-state row updated in the same transaction as `AnalystLink`—and treat module globals only as a cooldown hint; alternatively register a post-commit callback and never advance the correctness fingerprint before commit; test a forced commit failure followed by an unchanged vault scan and prove links are rebuilt.
- **Integrity payoff (1 line):** A transient commit failure cannot freeze a stale memo-link graph until restart or file modification.

### [MEDIUM] Watchlist — Serialize replace semantics per analyst

- **Failure state (1 sentence):** Two concurrent `replace_watchlist` requests that both read the same starting set can each apply their delta and commit the unintended union `{A,B}` even though each caller requested a complete replacement.
- **Location:** `caos/server/routes/query.py` → `replace_watchlist` validation, existing-row read, delete/insert, and commit block.
- **Lens:** STRIDE Tampering; DREAD **6.4/10**; this corrupts Desk Brief scope for the caller and does not concern shared-team visibility.
- **Opus instruction (technical):** Lock the authenticated analyst row with `SELECT ... FOR UPDATE` before reading current watchlist rows, then apply the complete replacement in that transaction; add two-session tests for disjoint concurrent sets and assert a serial last-writer result, never a union.
- **Integrity payoff (1 line):** Concurrent tabs cannot silently broaden the issuer universe used for an analyst's Desk Brief.

### [MEDIUM] Atomic workbook storage — Bound final names and use a short temp component

- **Failure state (1 sentence):** A valid long XLSX basename makes `.{filename}.{uuid}.tmp` exceed filesystem `NAME_MAX`, and the cleanup unlink can raise again before the new UUID directory is removed.
- **Location:** `caos/server/model_storage.py` → `store_atomic`; `caos/server/market_storage.py` → `store_atomic`.
- **Lens:** STRIDE Denial of Service; DREAD **6.6/10**; direct probes reproduced `ENAMETOOLONG` and orphaned object directories in both stores.
- **Opus instruction (technical):** Cap the encoded final basename to the filesystem component limit while preserving a bounded extension; use a fixed short temp filename inside the already-unique UUID directory; make temporary unlink, final unlink, and parent removal independent best-effort cleanup steps that cannot mask the original error; add 219/240/over-limit Unicode and ASCII filename tests.
- **Integrity payoff (1 line):** An accepted filename cannot crash atomic intake and leak empty vault directories.

### [MEDIUM] Analysis Context UI — Surface and retry failed persistence from every optimistic surface

- **Failure state (1 sentence):** A rejected context patch leaves the URL and visible run/sponsor/issuer/alert selection changed while the persisted analysis context remains old, and several `void` calls also emit unhandled promise rejections.
- **Location:** `caos/frontend/src/app/command/page.tsx` → `CommandCenter` sync effect; `caos/frontend/src/app/pipeline/page.tsx` → `PipelineVisualizer` `selectRun` and sync effect; `caos/frontend/src/app/monitor/page.tsx` → `Monitor.updateSelection`; `caos/frontend/src/app/reports/page.tsx` → `ReportStudio` live-run sync effect; `caos/frontend/src/app/sponsors/page.tsx` → `SponsorsView` selection effect and `openSponsorIssuer`; `caos/frontend/src/app/issuers/page.tsx` → `IssuersDirectory` persistence effect and `openIssuer`.
- **Lens:** STRIDE Tampering / Repudiation; DREAD **6.6/10**; this is client/server lineage divergence, not a financial-read failure in issuer profile (that lower-impact candidate was rejected).
- **Opus instruction (technical):** Extend `useAnalysisContext` with explicit mutation/error state and a retryable last sparse patch; require each caller to await or catch the mutation; for navigation either persist before finalizing or keep the optimistic state visibly marked “context not saved” with retry/rollback; test 401, 409, 429, 5xx, and network rejection with no `unhandledrejection` and no false linked/saved indicator.
- **Integrity payoff (1 line):** The shared context cannot silently point to a different run or selection than the surface the analyst is viewing.

### [MEDIUM] Monitor — Handle rejected alert workflow mutations without discarding input

- **Failure state (1 sentence):** Failed Ack/Assign/Resolve/Reopen calls in desktop and phone triage escape without a visible error, while assignee/note input or selection is cleared before persistence succeeds.
- **Location:** `caos/frontend/src/components/monitor/AlertInbox.tsx` → `persistState`, active row callbacks, `caos:monitor-ack-selected` effect, and `ReopenDecision`; `caos/frontend/src/components/monitor/PhoneTriage.tsx` → Assign, Ack, and Resolve-confirm handlers.
- **Lens:** STRIDE Tampering / Denial of Service; DREAD **6.6/10**.
- **Opus instruction (technical):** Add per-action pending/error state; catch every `setAlertState`/`patchAlertEvent` rejection; clear note, assignee, or selected ids only after success; preserve input and offer retry on failure; keep BatchBar's existing handled summary; add rejected-promise and rapid-repeat tests that assert no unhandled rejection.
- **Integrity payoff (1 line):** Watchtower workflow state remains truthful when the mutation API is unavailable.

### [MEDIUM] Model checkpoints — Do not treat failed hydration or persistence as saved history

- **Failure state (1 sentence):** A checkpoint load failure becomes an empty list and every write failure is swallowed, so an optimistic create/delete can disappear on reload or a later successful write can erase pre-existing server checkpoints.
- **Location:** `caos/frontend/src/lib/model/useModelHistory.ts` → issuer hydration effect, `persistCheckpoints`, `checkpoint`, and `deleteCheckpoint`.
- **Lens:** STRIDE Tampering / Repudiation; DREAD **6.4/10**.
- **Opus instruction (technical):** Track `loading | ready | error | saving`; disallow server writes before successful hydration; distinguish the explicit local-dev 404 fallback from all other errors; await persistence before claiming success or roll back the optimistic list; preserve and rebase against the current workspace revision on 409; test load-fail-then-create and save/delete rejection.
- **Integrity payoff (1 line):** Saved model history cannot be silently lost or overwrite a server list it never loaded.

### [MEDIUM] Settings — Rebase a 409 retry on the server's current revision

- **Failure state (1 sentence):** On a settings conflict, `saveAnalyst` discards `detail.current`, restores the stale snapshot, and `analystRetry` resends the same stale revision, so Retry save repeats 409 until reload.
- **Location:** `caos/frontend/src/app/settings/page.tsx` → `saveAnalyst` rejection handler, `analystRetry`, and Retry save action.
- **Lens:** STRIDE Tampering / Denial of Service; DREAD **6.2/10**.
- **Opus instruction (technical):** Parse the structured 409 payload, rebase only the user's intended field changes onto `detail.current`, retry with its revision, serialize overlapping saves, and keep transient 5xx/network retry separate from conflict resolution; test one conflict followed by a successful rebase and two rapid saves.
- **Integrity payoff (1 line):** Concurrent settings edits converge instead of trapping the analyst on an unretryable stale revision.

### [MEDIUM] Optional analytical reads — Distinguish unavailable from genuinely absent

- **Failure state (1 sentence):** QA, optional CP-2B, or daily-digest read failures collapse to `null`/empty and let complete surfaces omit committee findings, hide downside, or print green “No stale sources” states.
- **Location:** `caos/frontend/src/lib/engine/useLiveRun.ts` → legacy `getQA(...).catch(() => null)`; `caos/frontend/src/lib/engine/useModelEngine.ts` → CP-2B `getModule(...).catch(() => null)`; `caos/frontend/src/lib/engine/useDigest.ts` → `getDigest` rejection state and governance consumers.
- **Lens:** STRIDE Tampering; DREAD **6.8/10**.
- **Opus instruction (technical):** Treat successful empty responses as empty; for CP-2B only, map a typed 404 to legitimate absence; propagate or explicitly represent 401/429/5xx/network failures; block an all-clear/complete interpretation while QA or digest status is unknown; add error-state tests at Decision Rail, ScenarioPanel, and GovernancePanel.
- **Integrity payoff (1 line):** Missing analytical evidence is never presented as evidence that no risk exists.

### [MEDIUM] Report assumptions — Validate every persisted case driver as a known finite number

- **Failure state (1 sentence):** `parseAssumptions` shallow-merges arbitrary base/down values, so a stored `null`, string, `NaN`, or infinity can replace a numeric multiplier and silently coerce or poison model arithmetic.
- **Location:** `caos/frontend/src/lib/reports/assumptions.ts` → `parseAssumptions`, contrasted with `sanitizeYears`.
- **Lens:** STRIDE Tampering; DREAD **5.6/10**.
- **Opus instruction (technical):** Iterate only keys from `DEFAULT_CASE`, accept only finite numbers for both base and down cases, substitute defaults for invalid values, ignore unknown keys, and reuse the same sanitizer for year overrides; add null/string/NaN/infinity/unknown-key storage tests without inventing economic range clamps.
- **Integrity payoff (1 line):** Corrupted browser storage cannot silently turn a model driver into zero or non-finite output.

### [MEDIUM] Desk Brief — Re-guard persisted deltas as finite

- **Failure state (1 sentence):** A legacy or manually corrupted `MetricFact.value` containing `NaN` or infinity reaches `_delta_entries` and formats literal non-finite evidence into the Desk Brief.
- **Location:** `caos/server/engine/queryinsights.py` → `_delta_entries` latest-versus-prior subtraction and formatting block.
- **Lens:** STRIDE Tampering; DREAD **5.6/10**; current writes are finite, so this is a defensive persisted-read boundary rather than an unguarded CP-1 divide.
- **Opus instruction (technical):** Apply `engine.periods.is_finite_number` to latest and prior immediately before subtraction, skip the delta if either fails, and mirror the sibling `engine.metricengine._delta_entries` NaN/infinity regression tests.
- **Integrity payoff (1 line):** Corrupt historical facts cannot become non-finite evidence or model grounding.

### [MEDIUM] Upload — Distinguish an issuer-directory outage from an empty directory

- **Failure state (1 sentence):** When `getIssuers` rejects on an unseeded Upload page, the empty catch leaves the picker indistinguishable from a successful empty directory and dead-ends intake without retry.
- **Location:** `caos/frontend/src/components/upload/UploadWizard.tsx` → mount effect that calls `getIssuers` when the supplied issuer list is empty.
- **Lens:** STRIDE Denial of Service; DREAD **6.6/10**; this is the directory read before ingestion, not intentional document parsing.
- **Opus instruction (technical):** Add `loading | ready | error` state, use `toErrorMessage`, render the existing inline error treatment with retry, and reserve empty-directory copy for a successful empty response; test rejection then retry success.
- **Integrity payoff (1 line):** A transient API outage cannot masquerade as “no issuers” at the pipeline entrance.

### [MEDIUM] Deep Research — Preserve durable-job reattachment on transient probe failure

- **Failure state (1 sentence):** A timeout, network error, or 5xx on the mount-time `getResearchStatus` probe deletes the saved job id and removes the browser's automatic path back to an in-flight or completed paid report.
- **Location:** `caos/frontend/src/app/research/page.tsx` → reattach-on-mount effect and outer status-probe rejection branch.
- **Lens:** STRIDE Denial of Service / Repudiation; DREAD **6.6/10**.
- **Opus instruction (technical):** Keep the id for transient errors; expose retry and bounded backoff while mounted; delete only after a typed terminal gone/failed result; cancel retry timers on cleanup; test 500→success, timeout→success, and terminal gone.
- **Integrity payoff (1 line):** Transport failure cannot silently discard the client's durable research reattachment pointer.

### [MEDIUM] Deep Research — Make live/demo configuration failure explicit

- **Failure state (1 sentence):** If `getSettings` fails, the page leaves model configuration unknown while still presenting Run deep research, obscuring whether the next output will be live or deterministic demo material.
- **Location:** `caos/frontend/src/app/research/page.tsx` → settings load effect and live/demo primary-action/banner state.
- **Lens:** STRIDE Repudiation / Tampering; DREAD **6.6/10**.
- **Opus instruction (technical):** Represent `loading | live | demo | error`, render configuration unavailable with retry, and disable or require explicit confirmation while provenance is unknown; retain the normal demo path only after a successful `llm_configured === false` response; add rejection and retry tests.
- **Integrity payoff (1 line):** Analysts always know the provenance mode before spending or interpreting a research run.

### [MEDIUM] Query and ASK — Handle rejected run and finding-persistence actions

- **Failure state (1 sentence):** Rejections from Query run creation or Query/ASK finding pins escape `void` event handlers, leaving no durable result and no user-visible indication that the action failed.
- **Location:** `caos/frontend/src/components/query/QueryInvestigationWorkbench.tsx` → `runQuery`, `pinFinding`, and click/key call sites; `caos/frontend/src/components/shared/Ask.tsx` → `AskModal.pinQueryFinding` and PIN FINDING handler.
- **Lens:** STRIDE Repudiation / Denial of Service; DREAD **6.6/10**.
- **Opus instruction (technical):** Add typed per-action error and pending state; catch with `toErrorMessage`; preserve prior successful results; set pinned only after success; guard rapid duplicate clicks; render retry beside the affected action; add rejected-promise tests that assert no `unhandledrejection`.
- **Integrity payoff (1 line):** An analyst never mistakes a failed investigation or evidence pin for saved work product.

### [MEDIUM] Query workbench — Reject stale history/capability responses

- **Failure state (1 sentence):** A context or URL-run change while history/capability requests are unresolved allows the older response to overwrite the newer investigation state.
- **Location:** `caos/frontend/src/components/query/QueryInvestigationWorkbench.tsx` → combined data-loading effect for `listQueryRuns` and `queryCapabilities`.
- **Lens:** STRIDE Tampering; DREAD **5.6/10**; this is an out-of-order response race, not React StrictMode behavior.
- **Opus instruction (technical):** Split context-bound history from context-independent capabilities; use an AbortController or monotonically increasing request generation; apply state only for the current context/run; preserve explicit error state; add deferred-promise tests resolving A after B.
- **Integrity payoff (1 line):** The workbench cannot show a prior context's query history as the active investigation.

### [MEDIUM] Scenario network — Validate nested financial shapes and economic domains before propagation

- **Failure state (1 sentence):** A finite negative persisted liquidity value produces a computed negative runway, while a truthy malformed tranche such as `[{}]` raises `KeyError` during scenario propagation.
- **Location:** `caos/server/engine/scenario_network.py` → `propagate` liquidity and recovery branches.
- **Lens:** STRIDE Tampering / Denial of Service; DREAD **6.6/10**; finite arithmetic is guarded, but the persisted nested shape/domain boundary is not.
- **Opus instruction (technical):** Reuse `is_finite_number` plus explicit non-negative/positive economic checks for liquidity and derived runway; validate every tranche through a typed schema requiring seniority, amount, and other fields consumed by `recovery_waterfall`; turn invalid legacy output into an unavailable scenario cell with a limitation instead of computing or raising; add negative-liquidity and malformed-tranche tests.
- **Integrity payoff (1 line):** Scenario propagation degrades on invalid persisted modules instead of publishing impossible values or crashing the network.

### [MEDIUM] Query answer — Keep the best grounded self-correction attempt

- **Failure state (1 sentence):** In `_generate`, a first attempt with surviving grounded text can be unconditionally replaced by an empty second attempt when the retry no longer satisfies `_should_retry`.
- **Location:** `caos/server/engine/queryanswer.py` → `_generate` bounded self-correction loop and `_should_retry` decision.
- **Lens:** STRIDE Tampering / Denial of Service; DREAD **6.6/10**.
- **Opus instruction (technical):** Score every attempt by surviving validated sentences/claims and validation severity; retain the best attempt unless the retry strictly improves that score; preserve the retry diagnostic separately; test a partially grounded first answer followed by an empty, worse repair.
- **Integrity payoff (1 line):** Self-correction cannot erase a more useful validated answer and return silence.

### [MEDIUM] Sector review — Reject non-finite scores and serialize version/ratification mutations

- **Failure state (1 sentence):** Non-finite persisted materiality scores can crash JSON serialization, while concurrent review creates or section ratifications can duplicate versions or last-writer-win away a ratification decision.
- **Location:** `caos/server/routes/sector.py` → `SectorSignalOut.materiality_score`, `_db_signal`, `_build_review_payload`, `create_sector_review`, and `ratify_sector_review`.
- **Lens:** STRIDE Tampering / Repudiation / Denial of Service; DREAD **6.8/10**.
- **Opus instruction (technical):** Add a finite-number validator at the response/persisted-read boundary and degrade invalid scores to `None` with an explicit missing dependency; serialize create under a per-analyst/sector row or advisory lock and enforce a unique `(analyst_id, sector_id, version)` invariant; lock the review row or use revision/CAS before merging ratifications, preferably deriving the payload ratification map from normalized decision rows; add NaN/infinity serialization, concurrent-create, and disjoint-concurrent-ratification tests.
- **Integrity payoff (1 line):** Sector reviews remain serializable, uniquely versioned, and complete under concurrent analyst actions.

## Verification record

### Method and detector evidence

- Inventoried and pattern-scanned **617 scoped source files**: 406 frontend `.ts/.tsx` files and 211 server `.py` files excluding virtual environments; manually read the high-risk auth, persistence, executor, engine, report, upload, Query, Monitor, Model, and analysis-context seams in five-file batches.
- `python3 run_sec_audit.py` returned exit 0 and `[]`; an independent AST count found **158 async route handlers and 0 sync route handlers**, confirming the detector inspected none.
- Frontend `npm run lint` and `npx tsc --noEmit` from `caos/frontend` both passed; the brief's root-workspace spelling was adapted because the repository has no root package workspace.
- Bandit, excluding `.venv` and `.venv311`, completed over **46,806 lines** with **0 High** findings; its summary contained 114 Low and 2 Medium findings.
- Server suite: **1,829 passed, 9 skipped, 7 environment-blocked**; all seven failures were `test_avscan.py` socket-bind `PermissionError` failures caused by the managed sandbox, not failed product assertions.
- `pip-audit` could not complete because the managed approval boundary rejected the dependency-metadata network request; no vulnerability-clean claim is made from that detector.

### Five-file fresh-context checkpoints

> **Checkpoint 1:** 4 confirmed, 1 rejected; scanner, warmup, finite Desk Brief read, and advisory release survived, with advisory release revised to Medium and malformed EDGAR CIK retained below threshold.

> **Checkpoint 2:** 2 confirmed after revision; principal clearing was only partially fixed and Model Builder's issuer-transition hydration remained open, while the older late-response race itself was fixed.

> **Checkpoint 3:** 3 confirmed, 3 rejected/below threshold; Upload and two Research swallows survived, while G2 chunk failure handling was fixed, the old Query path had moved, and the toast timer stayed Low.

> **Checkpoint 4:** 4 confirmed; Query actions, ASK pinning, CP-X failure masking, and Query stale-response ordering survived; lifecycle-clean autonomy/role hooks were rejected.

> **Checkpoint 5:** 2 confirmed, 1 rejected; Report Studio context persistence and assumptions validation survived, while missing segment-level `error.tsx` was rejected because the existing root boundary correctly contains descendant failures.

> **Checkpoint 6:** 1 confirmed; the finite Desk Brief read guard survived and the remaining CP arithmetic files passed.

> **Checkpoint 7:** 2 confirmed, 3 clean; direct probes found the 30%-breach fragility and negative-runway defects despite finite guards.

> **Checkpoint 8:** 1 confirmed, 1 rejected; report-queue owner mismatch survived and unused `pipeline_executor.claim_next_job` was rejected as latent with no production caller.

> **Checkpoint 9:** 0 confirmed; 60 focused workbook/extraction tests passed and document-parse catches remained intentional.

> **Checkpoint 10:** 1 confirmed; vault fingerprint-before-commit survived, while request sessions, identity, ContextVar presets, and the shared LLM client were clean.

> **Checkpoint 11:** 1 confirmed; concurrent watchlist replacement survived, while `create_profile`, shared accepted links, research ownership, and run idempotency matched the governing design.

> **Checkpoint 12:** 4 file-level failures consolidated into 2 findings; alert mutations and Sponsors/Issuers context persistence survived, while Control Plane loading was clean.

> **Checkpoint 13:** 3 confirmed and 3 rejected/clean; cross-issuer checkpoints, checkpoint persistence, and stale Settings retry survived; Profile context sync was below threshold, the supplied ModuleFinder path was corrected, and Command Palette was clean.

> **Checkpoint 14:** 4 confirmed and 2 clean; primary live-module loading was High, optional QA/CP-2B/digest failure states were Medium, and `useLatestRunStatus`/`usePortfolio` passed.

> **Checkpoint 15:** 2 findings confirmed across 3 files and 2 paths revised/clean; event-loop export blocking and atomic temp-name overflow survived, `model_service` was clean, and the nonexistent `engine/scenario.py` path was corrected.

> **Checkpoint 16:** 3 confirmed and 1 path corrected; stale pre-validation report Markdown, live repair mislabeling, and concentration failure masking survived; the verified reporter file is `caos/server/engine/reporter.py`.

> **Checkpoint 17:** 4 confirmed and reconciled into 3 systemic items; server/client context races were High, principal-crossing pending create was Medium and folded into principal lifecycle hardening, and three page persistence failures were Medium.

> **Checkpoint 18:** 5 confirmed across 3 files, 2 clean; scenario shape/domain checks, Query take-better logic, and Sector finite/concurrency controls survived, while bindings and registry passed.

### Reconciled baseline, rejected candidates, and fixed boundaries

- `routes/auth.py::create_profile` remains fixed by verified edge identity, name-collision handling, and boot guards; it is not re-tiered.
- `routes/query.py::list_accepted_links` is shared desk work product under `SECURITY.md` S-4; no tenant/issuer ACL item appears here.
- Trusted `X-Forwarded-*` headers behind the sole-path edge and rate limiting beyond documented controls remain explicit deployment boundaries, not findings.
- `ingest.py`/pypdf/openpyxl best-effort document parsing was excluded exactly as required; no parsing catch was promoted.
- `G2Chart` now handles dynamic-import rejection; per-surface `error.tsx` expansion was rejected because `app/error.tsx` already catches descendant segment failures; React StrictMode, handled awaited promises, and effects with cleanup were not flagged.
- The non-cryptographic advisory-lock SHA-1 use is marked `usedforsecurity=False` and Bandit reported no High issue; it is not a security finding.
- The active CP-1 divide/multiply convention is enforced; no unguarded divide was added to this spec. The Downside, Liquidity, and Scenario items survived because ordinary finite inputs reproduced classification/domain/shape failures after those guards ran.

### Opus completion gate

For each item, Opus must land the named regression/concurrency test with the patch, run the affected focused suite, then rerun frontend lint/typecheck, the server suite, the repaired route-auth detector, and Bandit. Enterprise deployment remains blocked until Security confirms both Critical and every High item closed; unresolved Medium items require a named owner, expiry, and compensating control.
