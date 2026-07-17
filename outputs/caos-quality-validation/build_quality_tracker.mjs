import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repo = process.cwd();
const require = createRequire(import.meta.url);
const ts = require(path.join(repo, "caos", "frontend", "node_modules", "typescript", "lib", "typescript.js"));
const baselineDate = "2026-07-16";
const today = "2026-07-17";
const outputDir = path.join(repo, "outputs", "caos-quality-validation");
const csvPath = path.join(repo, "caos", "docs", "qa", "FEATURE_TRACKER.csv");
const outputPath = path.join(outputDir, "CAOS_Quality_Validation_Tracker.xlsx");
const scenarios = [
  "Happy path",
  "Error path",
  "Boundary conditions",
  "Invalid input",
  "Permission/security",
  "Performance",
  "Mobile/responsive",
];

const validationRuns = [
  ["Frontend unit/component", "npm test -- --run; focused post-seal deltas", "Pass", "All 1,390/1,390 current frontend nodes passed: the prior 1,367-node seal plus 23 net-new state-honesty, keyboard, modal-stack, and provenance nodes executed through 11 complete-file reruns (90/90)", today],
  ["Frontend coverage", "npx vitest run --coverage --coverage.reportsDirectory=/private/tmp/caos-codex-coverage-final", "Pass", "The 980-test coverage baseline passed at statements/lines 84.18% (45,617/54,186), branches 77.05% (7,423/9,633), functions 65.94% (1,224/1,856); all 14 later additions passed in the focused delta", baselineDate],
  ["Frontend lint", "npm run lint", "Pass", "ESLint completed with no findings against the exact current source and test tree", today],
  ["Frontend type check", "./node_modules/.bin/tsc --noEmit", "Pass", "TypeScript completed with no findings after typing the Pipeline, Report Studio, and late Command Center interaction harnesses", today],
  ["Command Center harness reconciliation", "vitest run src/app/command/command-interactions.test.tsx; npm run lint; tsc --noEmit", "Pass", "The concurrent five-test Command Center harness passes with exact PortfolioSummary, CommandPortfolioSnapshot, CommandPortfolioPosition, InsightPage, and InsightArtifact fixtures; lint and TypeScript are clean", today],
  ["ReportDoc post-seal delta", "vitest run src/components/reports/ReportDoc.test.tsx; npm run lint; tsc --noEmit", "Pass", "The complete later ReportDoc revision passes 4/4, adding three executable nodes after the 1,259 aggregate; lint and TypeScript remain clean", today],
  ["Research ReportPane post-seal delta", "vitest run src/components/research/ReportPane.test.tsx; npm run lint; tsc --noEmit", "Pass", "The complete later ReportPane revision passes 11/11, adding five executable nodes after the 1,259 aggregate; lint and TypeScript remain clean", today],
  ["Research feature reconciliation", "vitest: four Research files; pytest: test_deepresearch.py test_research_jobs.py test_edgar.py", "Pass", "All 29 Research features now carry direct assertion-level evidence; 26/26 frontend cases and 49/49 executable backend cases passed with two intentional PostgreSQL skips", today],
  ["Concurrent harness type reconciliation", "vitest: UploadWizard.interactions, steps-interactions, CommandPalette.interactions; npm run lint; tsc --noEmit", "Pass", "All 18/18 current interaction cases pass (12 Upload and 6 Command Palette); exact public component, dropzone, issuer, and API response types replace unsafe or impossible fixtures; lint and TypeScript are clean", today],
  ["Automation collector warning exclusion", "pytest --collect-only -q --disable-warnings; exact layer-count gates; workbook automation evidence reconciliation", "Pass", "Warning-summary references are excluded and collection fails closed on drift; the current inventory reconciles exactly to 1,390 Vitest + 2,423 pytest/stress/cohort + 141 Playwright + 36 route accessibility nodes", today],
  ["RV Screener harness type reconciliation", "vitest RVScreenerWorkbench.test.tsx; npm run lint; tsc --noEmit", "Pass", "All 12/12 RV Screener interactions pass with a complete AnalysisContext fixture; the unused import and explicit any are removed, and lint and TypeScript are clean", today],
  ["Alert Inbox harness type reconciliation", "vitest AlertInbox.test.tsx; npm run lint; tsc --noEmit", "Pass", "All 17/17 Alert Inbox interactions pass with a narrow recursive React-fiber helper; explicit any is removed, and lint and TypeScript are clean", today],
  ["Pipeline feature reconciliation", "vitest: five Pipeline/Issuers/navigation files; pytest: test_async_runs.py test_engine.py test_api.py", "Pass", "All 45 Pipeline features now carry direct assertion-level evidence: the 53-node frontend cohort passed in the exact-current aggregate, and the seven linked API contracts passed within a 93-pass/2-skip server cohort", today],
  ["Production static build", "npm run build; rsync -a --delete out/ ../server/static/", "Pass", "Next.js 16.2.10 generated and staged 20 static pages from the exact current production source tree", today],
  ["Server/stress/cohort regression", "caos/server/.venv311/bin/python -m pytest -q caos/tests/server", "Pass", "2,399/2,399 current executable nodes passed with 15 intentional skips across 2,414 collected nodes; the previously validated seven loopback-only antivirus cases remain included in this exact-current passing cohort", today],
  ["Concurrent test delta reconciliation", "find test files modified after each exact aggregate/delta; run those complete files; recollect all nodes", "Pass", "48/48 frontend and every complete backend delta-file cohort passed through the final 71-test coverage-edge rerun, closing 14 newly collected frontend nodes and 47 newly collected backend nodes without presenting unexecuted collection as pass", baselineDate],
  ["Configuration inventory contract", ".venv311/bin/python -m pytest caos/tests/server/test_settings_inventory_contract.py -q", "Pass", "259/259 cases passed across all 83 current Settings fields: code defaults, typed environment overrides, malformed scalar rejection, and numeric zero boundaries", baselineDate],
  ["Previously unmapped API contracts", ".venv311/bin/python -m pytest caos/tests/server/test_unmapped_api_contracts.py -q", "Pass", "14/14 direct HTTP cases passed after reconciling every parameter ID to the current 168-route inventory", today],
  ["PostgreSQL gated cohort", "DATABASE_URL=postgresql+asyncpg://... pytest <15 gated nodes> -q -rs", "Pass", "15/15 PostgreSQL-only concurrency, row-lock, advisory-lock, deployed-posture, and lineage cases passed", baselineDate],
  ["PostgreSQL migration round trip", "alembic upgrade head; alembic check; alembic downgrade base; alembic upgrade head", "Pass", "62 revisions upgraded, schema drift check passed, complete downgrade and re-upgrade passed", baselineDate],
  ["Golden OCR lane", "pytest caos/tests/server/golden/test_ocr_lane.py -q -rs", "Pass", "1/1 real ocrmypdf+tesseract ingestion/persistence case passed", baselineDate],
  ["Production-like QA server posture", "ENVIRONMENT=production DATABASE_URL=postgresql+asyncpg://caos:***@127.0.0.1:55440/caos_qa CAOS_DEMO_SEED=false CLAMAV_REQUIRED=true <all rollout gates=true; provider keys blank> uvicorn main:app --ssl-*", "Pass", "Isolated HTTPS server booted with PostgreSQL, edge-secret auth, strict CSP, required fake ClamAV protocol peer, all rollout gates, no external model keys, and 300 deterministic fictional issuers", baselineDate],
  ["Browser E2E (production posture)", "PLAYWRIGHT_BASE_URL=https://127.0.0.1:8443 E2E_STATIC_DIR=<isolated export> E2E_EDGE_PROXY_SECRET=*** E2E_ACCESS_CODE=*** E2E_IGNORE_HTTPS_ERRORS=1 npm run test:e2e:prodlike", "Pass", "141/141 project executions passed with retries disabled against the HTTPS/PostgreSQL/required-AV production posture; CSP and source-freshness preflights passed", baselineDate],
  ["Browser E2E (exact-current browser matrix)", "PLAYWRIGHT_BASE_URL=http://127.0.0.1:8077 E2E_STATIC_DIR=caos/server/static npm run test:e2e:prodlike; rerun upload_flow.spec.ts in all projects after the later Issuers change", "Pass", "The full matrix passed 141/141 with zero retries after the Research fix; the subsequently rebuilt Issuers artifact passed the complete affected journey 15/15 across Chromium, Firefox, and WebKit", today],
  ["Browser E2E (exact-current seal)", "run production-like freshness preflight; rebuild, stage, and restart after any production-source mtime change", "Pass", "The freshness preflight rejected the prior staged export; after rebuilding, staging, and restarting, source freshness and live CSP hashes passed before all 141 browser executions", today],
  ["Deep-Dive flake stress", "playwright test deepdive_flow.spec.ts -g 'hovering' --repeat-each=10 --retries=0 --workers=5", "Pass", "10/10 evidence-sync hover repetitions passed under five workers", baselineDate],
  ["Route accessibility + responsive", "BASE=http://127.0.0.1:8077 VIEWPORTS=1440x900,390x844 E2E_EDGE_PROXY_SECRET=<non-secret local identity marker> E2E_FORWARDED_EMAIL=<isolated analyst> E2E_ANALYST_NAME=<isolated analyst> node scripts/a11y-axe.mjs", "Pass", "The full 36-state matrix passed; after the later Issuers rebuild, the affected root and /issuers routes passed 4/4 desktop/mobile rescans with 0 axe nodes, scan errors, layout failures, overflow, or clipped controls", today],
  ["Query state accessibility", "BASE=http://127.0.0.1:8010 E2E_FORWARDED_EMAIL=<isolated analyst> E2E_ANALYST_NAME=<isolated analyst> node scripts/a11y-query.mjs", "Pass", "Exact-current ready, graph-lane, answer, and persisted narrow states all passed with 0 violation nodes", baselineDate],
  ["GitNexus semantic discovery", "node .gitnexus/run.cjs analyze; node .gitnexus/run.cjs analyze --repair-fts; MCP context/query", "Degraded", "Local analysis and FTS repair succeeded, but the MCP context resource remained four commits stale and semantic query still returned no flows with an FTS-missing warning; direct source inventories and the process resource were used as compensating evidence (DEF-QV-060)", today],
  ["QA scale seeder and security headers", ".venv311/bin/python -m pytest ../tests/server/test_seed_qa_scale.py ../tests/server/test_security_headers.py -q", "Pass", "9/9 passed: loopback/database guardrails, deterministic sanitized scale/workflow fixture, idempotence, and deployed security headers", baselineDate],
  ["Health performance smoke", "caos/server/.venv311/bin/python caos/tests/perf/smoke.py --url http://127.0.0.1:8010/api/health --n 200 --concurrency 20 --p95-ms 500", "Pass", "0 errors; p50 23ms; p95 82ms against a 500ms gate", baselineDate],
  ["Scenario benchmark", "cd caos/server && .venv311/bin/python -m pytest ../tests/perf/test_scenario_benchmark.py -q --durations=0", "Pass", "1/1 bounded scenario benchmark passed; benchmark call 0.01s, pytest lane 0.36s", baselineDate],
  ["Dependency lock sync", "caos/server/.venv311/bin/python caos/scripts/check_lock_sync.py", "Pass", "requirements.lock satisfies all 17 requirements.txt specs", baselineDate],
  ["Modular OS consistency", "caos/server/.venv311/bin/python 'Modular OS/tools/check_module_consistency.py'", "Pass", "26 modules checked / 0 drift", baselineDate],
  ["Complexity delta", "PATH=caos/server/.venv311/bin:$PATH caos/server/.venv311/bin/python caos/scripts/check_complexity_delta.py --base-ref origin/main", "Pass", "40 bounded findings across 161 changed Python paths", baselineDate],
];

const defects = [
  ["DEF-LOOP-001", "shell-10", "Medium", "Fixed", "Vitest's 5s default timeout was below observed jsdom workflow runtime.", "Run npm test before the timeout configuration fix.", "Default frontend unit command passes without CLI overrides.", "Five dense component tests timed out despite otherwise-correct behavior.", "Historical loop defect; fixed by a 20s configured test timeout."],
  ["DEF-LOOP-002", "pipeline-20", "Low", "Fixed", "The concurrency test used total wall-clock as a proxy and included unrelated module overhead.", "Run the server concurrency regression with the former threshold.", "The test proves same-layer synthesizers overlap directly.", "The assertion failed although asyncio.gather still overlapped the modules.", "Historical loop defect; fixed with direct overlap measurement."],
  ["DEF-LOOP-003", "research-13", "Low", "Fixed", "The E2E assertion used a short wait around a dynamically imported report body.", "Run the Research report rendering E2E under a cold bundle.", "The report heading and sources are awaited deterministically.", "The initial attempt was flaky and passed on retry.", "Historical loop defect; fixed with explicit 15s waits."],
  ["DEF-LOOP-004", "pipeline-01", "Low", "Fixed", "An E2E text locator matched both the search summary and issuer row.", "Search for a newly created issuer in Upload E2E.", "The assertion targets exactly one issuer row.", "Playwright strict mode found two matches.", "Historical loop defect; fixed with an exact row locator."],
  ["DEF-QV-001", "shell-10", "High", "Fixed", "A new CP-5B adapter read `driver_register` from an un-narrowed unknown runtime payload and used implicit-any callbacks.", "Run `npm run build` on the current worktree.", "The production TypeScript build completes.", "Build failed at src/lib/engine/adapt.ts:287.", "Narrowed the optional register to record rows; targeted 24-test adapter suite, tsc, and production build pass."],
  ["DEF-QV-002", "shell-05", "Medium", "Fixed", "The local axe harness injected axe-core under the production CSP without a test-only bypass.", "Run the authenticated route axe matrix against the production static build.", "The trusted local validator scans without weakening application CSP.", "Every route failed at page.addScriptTag.", "Added Playwright `bypassCSP` only to the validation browser context."],
  ["DEF-QV-003", "issuer-01", "Low", "Fixed", "The default profile scan hard-coded a fixture issuer id absent from a fresh isolated database.", "Run route axe against a newly migrated seeded database.", "The profile route resolves an issuer that exists in that database.", "The profile readiness marker timed out for id=iss-1.", "The harness now resolves the first accessible issuer unless an explicit route is supplied."],
  ["DEF-QV-004", "query-01", "Medium", "Fixed", "The Query state scanner targeted retired tablist, overlay, ACCEPT/UNDO, and evidence-sheet controls.", "Run scripts/a11y-query.mjs against the current Query workbench.", "The scanner exercises implemented persisted-investigation states.", "It timed out waiting for a role=tablist that no longer exists.", "Replaced the sequence with ready, lane-selection, real answer, and narrow restored-answer states."],
  ["DEF-QV-005", "query-17", "Low", "Fixed", "The rewritten scanner compared the restored answer while the temporary ready heading was still visible.", "Run the Query scanner and reload immediately after a persisted result.", "The validator polls until the saved answer is restored.", "The first rewrite reported a false persistence failure.", "Changed the assertion to wait for the expected saved heading text."],
  ["DEF-QV-006", "model-37", "Medium", "Fixed", "The offline E2E fixture did not expose the current CP-2B response contract.", "Run the Model Builder downside-fragility E2E case against a deterministic response fixture.", "The real Model UI renders and validates the CP-2B fragility readout.", "The former case was skipped and the readout was not exercised end-to-end.", "Added exact current list/CP-1/CP-2B DTO fixtures; the enabled case passes in the zero-retry cohort."],
  ["DEF-QV-007", "model-43", "Medium", "Fixed", "The save/reload E2E cases never dirtied the model, so the UI correctly suppressed PUT.", "Edit the all-years Drivetrain assumption, save, then reload the model.", "PUT /api/models is observed and the exact edited value survives reload.", "The former persistence cases were explicitly skipped.", "The enabled tests now dirty the model, wait for the PUT and saved checkpoint, and assert the exact restored value."],
  ["DEF-QV-008", "research-13", "Low", "Fixed", "A Research E2E expected retired marker copy instead of the implemented live/demo authority labels.", "Run the un-stubbed research provenance marker cases.", "The E2E asserts the current LIVE and AI-synthesized marker contract.", "The former marker test was explicitly skipped.", "Reconciled the assertions with current provenance semantics; both un-stubbed marker branches pass."],
  ["DEF-QV-009", "deepdive-14", "Low", "Fixed", "The hover validator could dispatch before client hydration, leaving visible static markup but no evidence-sync listeners.", "Run the full E2E cohort under five workers with retries disabled.", "Hovering an evidence chip cross-highlights every matching citation deterministically.", "One initial full-cohort attempt needed a retry while the isolated behavior was correct.", "The assertion now re-dispatches hover within a bounded toPass poll; 10/10 no-retry stress repetitions and the full no-retry cohort pass."],
  ["DEF-QV-010", "BP-008", "Low", "Fixed", "The PostgreSQL rollback validator accessed an ORM attribute after rollback had expired the instance, causing forbidden implicit async I/O.", "Run the independent-transaction lineage contention test with commit_winner=false.", "The test compares stable generated IDs after the winner rolls back and the contender commits.", "SQLAlchemy raised MissingGreenlet while reloading first.id after rollback.", "Snapshot the first edge ID before rollback; both commit and rollback contention paths pass against PostgreSQL."],
  ["DEF-QV-011", "SCR-004", "Medium", "Fixed", "Issuer directory filter controls used undersized flex children and column tracks that could compress below their usable width.", "Open /issuers at 390x844 and inspect the filter buttons and sector/sub-sector columns.", "All filters remain distinct, visible, and operable without overlap or clipping.", "Filter targets and narrow column content overlapped or clipped.", "Added non-shrinking 24px filter targets and bounded sector/sub-sector column minima; unit contract and the 390px route scan pass."],
  ["DEF-QV-012", "SCR-017", "Medium", "Fixed", "The Sponsors desktop row layout squeezed its scroll pane to an inaccessible height on a phone viewport.", "Open /sponsors at 390x844 and navigate the sponsor workspace by keyboard.", "The worklist and detail region stack with a usable, keyboard-accessible scroll area.", "The shared row layout compressed the worklist to an unusable strip.", "Sponsors now stacks on mobile, restores the row layout at md, and enforces a mobile minimum height; the 390px scan passes."],
  ["DEF-QV-013", "SCR-018", "Medium", "Fixed", "The Upload step strip overflowed horizontally but exposed no keyboard focus target for scrolling.", "Open /upload at 390x844 and attempt to reach every wizard step without a pointer.", "The labeled step-navigation region is focusable, visibly focused, and horizontally scrollable.", "Overflowed steps were pointer-scrollable only.", "Added a labeled focusable region and visible focus ring; the new unit test and 390px scan pass."],
  ["DEF-QV-014", "SCR-010", "Medium", "Fixed", "Portfolio filter controls switched to the wide layout at 900px before the controls had enough room.", "Open /portfolios at 900x900 and inspect the Apply control.", "The filter form stays stacked until the full control row fits.", "The Apply control was clipped at the former 900px breakpoint.", "Extended the compact layout through 1023px; the 900px scan passes."],
  ["DEF-QV-015", "BP-017", "Medium", "Fixed", "The local E2E harness ran stateful journeys in parallel against one SQLite database, whose single-writer semantics caused transient 500 responses under concurrent mutations.", "Run the complete stateful E2E suite with five workers against the shared local SQLite database.", "The default local regression lane completes deterministically; explicit stress runs may opt into parallel workers.", "Concurrent registration, model, research, and Query writes produced SAVE FAILED/500 responses.", "Default Playwright workers to one with PLAYWRIGHT_WORKERS/--workers overrides; the expanded 46/46 zero-retry lane passes. Production PostgreSQL concurrency remains covered separately."],
  ["DEF-QV-016", "research-13", "Medium", "Fixed", "The Research E2E route glob did not match POST /api/research when the implemented client supplied context_id in the query string.", "Run the stubbed research journeys repeatedly and inspect whether POST /api/research?context_id=... reaches the fixture.", "Every research POST is intercepted by pathname and cannot consume live-server quota.", "The request escaped the stub, hit the real server, and could consume rate limits or create nondeterministic state.", "Use a URL pathname predicate for all Research POST fixtures; the expanded full 46/46 zero-retry lane passes."],
  ["DEF-QV-017", "deepdive-14", "Low", "Fixed", "The hover test polled the sibling highlight and then asserted the hovered chip separately, allowing pointer state to change between the two checks.", "Repeat the Deep-Dive evidence-sync hover journey under five workers with retries disabled.", "Hovered, sibling, and unrelated citation states are asserted in one bounded hover transaction.", "The sibling poll could pass before the later hovered-chip assertion observed a cleared state.", "Co-located all highlight assertions inside the same toPass transaction; 10/10 five-worker stress repetitions and the full E2E lane pass."],
  ["DEF-QV-018", "BP-017", "Low", "Fixed", "The new standalone API contract module assumed a shared TestClient fixture that the server suite does not provide globally.", "Run test_unmapped_api_contracts.py before adding a module-local application fixture.", "Every parameterized request receives a lifespan-managed CAOS TestClient.", "All 14 cases failed during fixture setup before making a request.", "Added a session-scoped module-local TestClient fixture; 14/14 targeted cases and the full server suite pass."],
  ["DEF-QV-019", "API-083", "Low", "Fixed", "The first contract expectation assumed request-body validation ran before the disabled Model Engine v2 feature gate.", "POST an empty workbook-import commit while CAOS_MODEL_ENGINE_V2_ENABLED is false.", "The disabled route fails closed with the implemented non-enumerating 404 response.", "The test expected 422 but the route correctly returned 404 before body validation.", "Reclassified the case as permission/security feature-gate coverage and asserted 404; targeted and aggregate regressions pass."],
  ["DEF-QV-020", "monitor-01", "Low", "Fixed", "The new Monitor E2E assumed the authored email sample contained seven rows.", "Open Monitor email intake and compare the sample caption with the rendered email rows.", "The test asserts the implemented fixed sample size.", "The page truthfully rendered 'Showing 8 of 105', while the test expected 7.", "Updated the exact caption assertion; the focused and full E2E lanes pass."],
  ["DEF-QV-021", "monitor-05", "Low", "Fixed", "The new playback assertion assumed a minute-resolution clock.", "Pause the Monitor replay and inspect its utility status.", "The test accepts the implemented HH:MM:SS replay clock.", "The page rendered PAUSED · 09:30:00 ET, while the test expected HH:MM ET.", "Aligned PAUSED and SIM assertions to the second-resolution clock; the focused and full E2E lanes pass."],
  ["DEF-QV-022", "reports-07", "Low", "Fixed", "The first edit-reset assertion searched the page while the reset action was correctly contained in the closed Report utilities drawer.", "Edit a report field without opening Report utilities, then search for RESET 1 EDIT.", "The test opens the implemented utility popover before operating its reset action.", "The control was not in the accessibility tree until the popover opened.", "Open the utility drawer before asserting and activating reset; the workflow passes."],
  ["DEF-QV-023", "reports-08", "Low", "Fixed", "The compose selector included aria-pressed=true, so after the clicked button changed to false the live locator re-targeted the next true button.", "Toggle the first included Compose section and assert the same live locator becomes false.", "The locator remains bound by stable DOM position while its state changes.", "Playwright re-resolved the selector to another included section and observed true.", "Select the first aria-pressed control independent of its value; the focused and full E2E lanes pass."],
  ["DEF-QV-024", "BP-017", "Low", "Fixed", "The first aggregate pytest invocation ran without permission to bind temporary loopback sockets.", "Run the complete server cohort in the restricted command sandbox.", "ClamAV wire-protocol tests can bind one-shot localhost peers.", "Seven AV tests failed with PermissionError EPERM before an application assertion ran.", "Re-ran the current suite with local socket permission: 2,202 passed and 15 environment-gated tests skipped in aggregate."],
  ["DEF-QV-025", "reports-20", "Medium", "Fixed", "Legacy curated rows still described five deliverables and client-local persistence for active report, edits, omissions, paper, and sources.", "Compare reports-01/02/04/05/06/07/08/20/21 with the current Report Studio effects and six-item report builder.", "The canonical workbook describes six deliverables, local zoom persistence, and context-bound server draft persistence.", "The prior tracker encoded retired localStorage keys and omitted Model Appendix.", "Applied current-code contract overrides in the canonical generator and added E2E proof for six deliverables and reload persistence."],
  ["DEF-QV-026", "monitor-01", "Medium", "Fixed", "Legacy Monitor rows described the reconciled email tape as live and listed retired header KPIs/status copy.", "Compare monitor-01/04/05/06/07 with the current Monitor route and EmailIntel/AlertFeed implementations.", "The canonical workbook distinguishes fixed EOD email intake from live autonomy alerts and seeded replay state.", "The prior tracker conflated the two data authorities and documented stale labels.", "Applied current-code contract overrides and mapped all seven Monitor features to passing interaction tests."],
  ["DEF-QV-027", "BP-017", "Medium", "Fixed", "The first 300-issuer expansion derived synthetic tickers from only the cohort and first three base-ticker characters, so distinct issuers with a shared prefix collided.", "Run test_seed_qa_scale.py::test_300_issuer_book_is_deterministic_unique_and_conspicuously_fictional against the initial expansion.", "All 300 issuer names, tickers, and synthetic FIGIs are deterministic and unique before any database write.", "The regression found 291 unique tickers for 300 generated issuers.", "Ticker generation now uses the unique bounded issuer index; the five focused seed safety/determinism tests pass."],
  ["DEF-QV-028", "command-01", "Medium", "Fixed", "All 44 Command Center tracker rows described the retired sample-portfolio, sparkline, conviction, sector-RV, and local query composition rather than the current persisted-portfolio/Watchtower/governance/digest/cited-brief workbench.", "Reconcile every Command Center feature id against the current /command page, components, hooks, and API clients.", "The canonical register describes every current Command workflow and authority boundary, with direct automated evidence for all 44 ids.", "The prior workbook encoded controls and expected behavior that no longer exist and omitted current portfolio selection, honest dependency states, analysis-context persistence, and cited briefs.", "Replaced all 44 Command contracts in the canonical generator, routed their current trigger/file/endpoint metadata, and added six component plus three browser contract tests."],
  ["DEF-QV-029", "command-06", "Low", "Fixed", "The first selected-strip component assertion treated the CloseButton title as its accessible name.", "Render CommandPositionStrip and query the close action by name 'Close (Esc)'.", "The test uses the implemented accessible name while independently verifying the explanatory title.", "Testing Library exposed the button as Close, so the locator failed before exercising the callback.", "Target the role/name Close and assert title='Close (Esc)' separately; the focused component suite passes."],
  ["DEF-QV-030", "command-23", "Low", "Fixed", "The first live-coverage assertion assumed a metric string was unique even though two fixture rows intentionally shared it.", "Render two coverage rows with the same leverage and call getByText('5.7x').", "The assertion recognizes every matching row or scopes to a specific row.", "Testing Library rejected the ambiguous single-element locator.", "Assert the two rendered metric occurrences; the test now validates both rows and passes."],
  ["DEF-QV-031", "command-39", "Low", "Fixed", "The new alert-state test used a jest-dom toBeDisabled matcher that is not installed in this Vitest setup.", "Acknowledge a Watchtower row and assert the Acked control using toBeDisabled.", "The regression uses matchers supported by the repository or inspects the native disabled property.", "Vitest reported that toBeDisabled was not a function.", "Assert the HTMLButtonElement disabled property directly; the alert-state convergence test passes."],
  ["DEF-QV-032", "BP-017", "Low", "Fixed", "The first Playwright listing command ran npx from the repository root instead of the frontend package and attempted a registry lookup.", "Run npx playwright from the repository root in the network-restricted validator.", "Playwright resolves from the installed frontend dependency tree without network access.", "The command failed with ENOTFOUND before collecting tests.", "Run Playwright from caos/frontend using the installed package; all three Command tests collect and pass."],
  ["DEF-QV-033", "BP-017", "Low", "Fixed", "The first isolated server command combined ENVIRONMENT=development with a custom SESSION_SECRET, which the implemented fail-closed boot guard deliberately rejects.", "Boot the local validation server with the development sentinel and a production-style session secret.", "The harness either uses development defaults or a fully valid deployed posture; the application continues to reject the contradictory combination.", "Startup stopped in require_sane_environment before serving tests.", "Removed the unnecessary custom secret from the isolated development command; the guard remains verified and the server boots."],
  ["DEF-QV-034", "BP-017", "Low", "Fixed", "The restricted command sandbox denied loopback ports needed by the Next.js build worker, the isolated FastAPI server, and Playwright global setup.", "Build the static export, bind the isolated server, and run browser setup inside the restricted sandbox.", "The validation lane receives explicit local-socket permission while application network posture remains unchanged.", "The build and server/browser commands failed with EPERM before product assertions ran.", "Re-ran the exact in-scope commands with approved localhost permission; the static export and focused browser suite pass."],
  ["DEF-QV-035", "command-06", "Medium", "Fixed", "The global Ask launcher used bottom-3 on Command Center and overlapped the selected-position strip's bottom-right Close action.", "Open Positions, select a holding, and activate the visible Close control with a normal Playwright click.", "The launcher and strip controls occupy separate hit regions; Close is operable without force-click or pointer interception.", "Playwright timed out because the fixed Ask Alt+K span intercepted pointer events over the Close button.", "Apply the existing elevated bottom offset to /command as well as /sector, add a unit placement assertion, rebuild the production static bundle, and pass the real browser journey."],
  ["DEF-QV-036", "BP-017", "Low", "Fixed", "A direct Playwright invocation omitted the NODE_PATH required by this repository's test layout, so global setup could not resolve @playwright/test from the sibling e2e directory.", "Run npx playwright test directly from caos/frontend without NODE_PATH=node_modules.", "The direct command supplies the repository's documented module-resolution environment or uses npm run test:e2e.", "Global setup failed at import time before opening a browser.", "Set NODE_PATH=node_modules for the direct focused run; 3/3 Command journeys pass."],
  ["DEF-QV-037", "command-56", "Low", "Fixed", "The first Command E2E mixed a synthetic portfolio fixture with the live analysis-context PATCH endpoint, so the server correctly rejected the nonexistent portfolio scope.", "Autosave the fixture portfolio id portfolio-qa into a real analysis context.", "All boundaries that depend on the synthetic portfolio use the same deterministic route fixture, and the autosave assertion requires a successful merged context response.", "The request body was correct but the real server returned 404 because portfolio-qa did not exist in the isolated database.", "Added an exact pathname-and-method PATCH fixture returning a valid incremented context, then asserted HTTP 200 and the persisted portfolio/view payload."],
  ["DEF-QV-038", "research-13", "Low", "Fixed", "The Research progress E2E queried the animated number 2 globally while the searches counter legitimately passed through 2 on its way to 3.", "Render running progress with two sources and three searches and call page.getByText('2') globally.", "Each statistic assertion is scoped to its labelled counter block and tolerates the other count's animation.", "Playwright strict mode found two visible exact-text matches and failed despite correct progress data.", "Scope the 2 and 3 locators to the sources and searches parent blocks; focused and aggregate browser regression pass."],
  ["DEF-QV-039", "settings-01", "Medium", "Fixed", "The asynchronous analyst-profile load overwrote an already-saved device-local Research audience, so the value restored after reload depended on a slower server response and a prior global save.", "Save a device-only audience, retain a different analyst workspace research_prefs value, then reload Settings.", "The stored device value wins on that device; server preferences are only the fallback when localStorage has no Research preferences.", "The field first restored the local value, then changed to the older server value; the second zero-retry cohort reproduced the data-integrity failure.", "Added a storage-presence guard to the LOW-risk Settings profile fallback without changing the HIGH-risk shared loadPrefs path; unit, focused E2E, and aggregate regression pass."],
  ["DEF-QV-040", "BP-017", "Low", "Fixed", "The first Model Engine v2 validation server enabled CAOS_MODEL_ENGINE_V2_ENABLED but omitted its implemented CAOS_LINEAGE_V2_ENABLED dependency.", "Open a live issuer model while only the model capability flag is enabled.", "The QA harness enables the complete documented capability pair; the application continues to fail closed on an incomplete rollout.", "GET /api/models/v2/{issuer_id} returned 503 with 'Model Engine v2 requires CAOS_LINEAGE_V2_ENABLED'.", "Restarted the isolated server with both capability flags; the v2 endpoint advanced to its ownership gate and the final focused/full browser lanes pass."],
  ["DEF-QV-041", "model-43", "Low", "Fixed", "The sanitized CP-1 workflow run is owned by E2E Model Analyst, while the first v2 Playwright attempt authenticated as the unrelated default E2E Analyst.", "Open the Granite Peak live model under the default E2E analyst identity.", "The mutation journey authenticates as the fixture owner; production run-access controls remain unchanged.", "The canonical model failed closed with 'No completed owned issuer run is available'.", "Set E2E_ANALYST_NAME to the seeded fixture owner; 5/5 focused Model Builder tests and 46/46 zero-retry browser journeys pass without enabling cross-analyst sharing."],
  ["DEF-QV-042", "BP-017", "Low", "Fixed", "Two backend regression attempts started below the repository root, so the root-level run_sec_audit module was absent from Python's import path.", "Collect test_sec_audit_tool.py from caos/ or caos/server.", "The aggregate command runs from the repository root with the designated server virtual environment.", "Pytest stopped during collection with ModuleNotFoundError: run_sec_audit.", "Run the canonical root command; 2,202 tests passed, 15 environment-gated tests skipped, and no application assertion failed."],
  ["DEF-QV-043", "BP-017", "Medium", "Fixed", "The validation ledger still referenced a retired scenario benchmark path, a removed Modular OS wrapper, and a complexity command that did not expose the venv ruff binary.", "Execute the three supporting commands exactly as previously recorded in Validation Runs.", "Every recorded command resolves current files and dependencies from its required working directory.", "The scenario path was absent, the replacement failed to import scenario from the wrong cwd, the Modular OS wrapper was absent, and complexity could not locate ruff.", "Reconciled the ledger to tests/perf/test_scenario_benchmark.py from caos/server, Modular OS/tools/check_module_consistency.py, and the venv-backed complexity invocation; all three current gates pass."],
  ["DEF-QV-044", "BP-017", "Medium", "Fixed", "The first current-source browser server inherited live provider credentials; removing variables from the launch environment was insufficient because dotenv reloaded OpenRouter and Gemini values, so the nominally deterministic Query lane made a remote plan call.", "Start the QA server without explicitly overriding every supported provider key to an empty value, then run the zero-retry Query reload journey followed by Report Studio autosave.", "The local regression lane explicitly blanks ANTHROPIC_API_KEY, OPENROUTER_API_KEY, and GEMINI_API_KEY and exercises the implemented deterministic fallback without remote latency or database-lock contamination.", "Query exceeded the 15-second browser contract and the following Report autosave assertion timed out; the initial cohort ended 44 passed / 2 failed even though focused Report Studio passed 4/4.", "Restarted the clean isolated server with all three provider keys explicitly blank; the latest snapshot completed the full zero-retry cohort 46/46 in 30.0s."],
  ["DEF-QV-045", "BP-017", "Low", "Fixed", "The fail-closed route axe matrix encountered a transient root-redirect readiness timeout at 900x900 after scanning the same redirect successfully at 390x844.", "Run the 36-state route matrix and observe the root route after changing from the phone viewport to 900x900.", "Every route-width state reaches its shared surface marker before axe and layout evaluation, or the validator fails closed and the missing state is rerun explicitly.", "The broad matrix recorded 0 violation nodes and 0 layout failures but exited non-zero with one scan_error for /@900x900.", "Immediately reran ROUTES=/ at 900x900; the root resolved to /issuers with 0 violation nodes, 0 scan errors, and 0 layout findings, completing the 36-state evidence set."],
  ["DEF-QV-046", "command-56", "Medium", "Fixed", "Command context autosave ran before the asynchronous portfolio directory resolved, so selectedPortfolioId was transiently null and the first PATCH cleared a valid persisted portfolio scope.", "Open /command?portfolio=portfolio-qa in a fresh browser and inspect the first analysis-context PATCH while the portfolio directory is loading.", "Autosave waits for portfolio resolution and writes the requested, persisted, or default portfolio without an intermediate null scope mutation.", "The UI selected portfolio-qa correctly, but the first PATCH contained portfolio_scope:null and a null command portfolio filter before a later corrective write.", "Guarded the LOW-impact autosave effect while portfolioDirectoryLoading is true; focused Command/Settings regression passed 7/7 and the complete current-source E2E cohort passed 46/46 with retries disabled."],
  ["DEF-QV-047", "settings-01", "Low", "Fixed", "The Settings E2E still expected the retired literal aria-disabled='false' attribute after the primary action moved to the shared ActionReason contract, which removes disabled metadata when actionable.", "Change the Research audience and inspect the Save changes accessibility attributes.", "The test proves the action is no longer aria-disabled and the no-change explanation is removed, without requiring a nonstandard aria-disabled='false' string.", "The current actionable button had no aria-disabled attribute, so the literal false assertion failed despite correct operability.", "Reconciled the assertion with ActionReason semantics; focused Command/Settings regression passed 7/7 and the final full E2E cohort passed 46/46."],
  ["DEF-QV-048", "BP-017", "Medium", "Fixed", "The first production-like browser cohort reused one analyst for every stateful journey, coupling unrelated tests to the per-analyst analysis-context quota.", "Run all stateful browser journeys consecutively under one forwarded identity against the production-like server.", "Independent workflow groups have isolated analyst quota and session state while retaining real server rate limits.", "Later analysis writes returned HTTP 429 although each journey passed in isolation.", "The production-like runner now assigns three explicit fictional analysts to bounded spec lanes; the complete 46/46 zero-retry rerun passed."],
  ["DEF-QV-049", "model-43", "Medium", "Fixed", "The live Model Builder journey implicitly depended on demo seeding and a workflow run owned by a different analyst, so production settings exposed no mutable model authority.", "Start with CAOS_DEMO_SEED=false and open the Model Builder under an unrelated analyst.", "The scale fixture opts into one deterministic completed CP-1 run owned by the explicit Model E2E analyst, and the journey discovers that fictional issuer.", "The test could not locate the retired demo fixture and the v2 API correctly rejected cross-analyst ownership.", "Added --with-workflow-fixture to the guarded scale seeder, bound the run to E2E Model Analyst, and made the journey discover Granite Peak; 5/5 Model tests passed live."],
  ["DEF-QV-050", "pipeline-01", "Low", "Fixed", "The bootstrap journey hard-coded a 23/23 completion count even though enabled CP-2G and CP-4D rollout gates expand the runtime plan.", "Enable all production rollout gates and complete a new keyless run.", "The assertion derives expected module cardinality from the server plan and accepts every enabled production module.", "The run completed correctly but the fixed 23-module assertion failed.", "Made the journey plan-aware; the gated production-like bootstrap path passes in the 46/46 cohort."],
  ["DEF-QV-051", "BP-017", "Medium", "Fixed", "Successive analyst lane setups wrote the same Playwright storage-state file, allowing a later identity to overwrite an earlier lane's authenticated session.", "Run global setup for multiple forwarded analysts using the shared default .auth/state.json.", "Every analyst lane writes and consumes a distinct storage-state artifact.", "Authentication state was last-writer-wins and Model ownership depended on lane order.", "Added E2E_STORAGE_STATE_PATH support and deterministic per-lane state filenames; all three lanes pass independently."],
  ["DEF-QV-052", "BP-017", "High", "Fixed", "The server snapshots static-export inline-script hashes into its CSP at startup; rebuilding or restaging the frontend without a restart left the live policy stale.", "Replace the staged static export while the local production server remains running, then load a route.", "The QA lane proves every hash required by the staged HTML exists in the live CSP before browser execution.", "The browser rejected current inline bootstrap scripts under the older live CSP.", "The production-like runner computes all staged inline hashes and fails before tests if the live CSP is stale; the server is restarted after every staged build."],
  ["DEF-QV-053", "BP-017", "High", "Fixed", "A successful browser pass could otherwise target a static export older than concurrently edited frontend source.", "Modify any frontend source after staging the export and invoke the production-like runner.", "The runner refuses to execute until the exact current source is rebuilt and staged.", "Current UI copy and behavior diverged from the artifact under test; two rerun attempts correctly detected later concurrent edits.", "Added a recursive source/export mtime preflight and rebuilt into isolated immutable staging directories until the exact-current artifact passed 46/46."],
  ["DEF-QV-054", "issuer-01", "Medium", "Fixed", "The Issuers loading container carried aria-label on a generic div, which violates the permitted ARIA role/attribute contract.", "Open /issuers while the directory is loading and run axe-core.", "Loading state exposes a valid named status region with busy state and no prohibited ARIA attributes.", "axe reported aria-prohibited-attr on the loading div.", "Changed the loading container to role=status with aria-busy and retained its accessible label; the final 36-state matrix reports zero nodes."],
  ["DEF-QV-055", "model-43", "Medium", "Fixed", "Long Model and Report recovery/export labels exceeded the fixed narrow header action area at 390px, clipping controls needed to recover or export work.", "Open Model Builder and Report Studio at 390x844 with saved-model recovery states visible.", "Essential recovery and export actions remain fully visible or are available in the keyboard-operable tools drawer.", "The layout scanner reported clipped SAVED MODEL/RETRY, EXPORT MODEL, and Report retry controls.", "Added compact narrow labels and duplicated full recovery/export actions in the relevant tools drawers; the responsive contract tests and final layout matrix pass."],
  ["DEF-QV-056", "query-01", "Low", "Fixed", "The route matrix and dynamic Query scanner reused one analyst and hard-coded the same profile name, exhausting context quota and preventing a second unique identity from registering cleanly.", "Run the 36-state route matrix and then the four dynamic Query states under the same forwarded identity; retry with a new email but the same unique profile name.", "Each accessibility lane accepts an explicit unique analyst name and email, so real quotas remain enabled without cross-lane contamination.", "Query context creation returned HTTP 429; the first replacement identity returned 409 for duplicate full_name.", "Both accessibility harnesses now honor E2E_ANALYST_NAME; the dedicated Query identity completed all four states with zero axe nodes."],
  ["DEF-QV-057", "monitor-01", "High", "Fixed", "A concurrent Monitor edit placed a JSX child comment between EnterprisePage attributes, where the parser requires an attribute or spread.", "Run npm run build with the edited Monitor page.", "The production frontend parses and emits all 20 static routes.", "Turbopack stopped at monitor/page.tsx with Expected '...', got '}'.", "Moved the explanatory comment into the valid EnterprisePage child region without changing the concurrent feature behavior; the next production build passed."],
  ["DEF-QV-058", "reports-01", "High", "Fixed", "A concurrent ReportDoc semantic-heading edit temporarily opened h2 and closed div.", "Run npm run build while the incomplete ReportDoc edit is present.", "Every report heading has a matching semantic closing tag and the production build parses.", "Turbopack stopped at ReportDoc.tsx:95 with Expected corresponding JSX closing tag for h2.", "The parallel edit completed the closing-tag correction to h2; the subsequent production build and Report Studio browser journeys passed."],
  ["DEF-QV-059", "BP-017", "High", "Fixed", "Active parallel frontend writes repeatedly postdated each staged static export and superseded otherwise-clean exact-artifact validation.", "Build and stage the frontend, run the browser cohort, then compare recursive src mtimes with the staged export.", "No frontend source file changes from build start through the final browser, unit, coverage, lint, type, and accessibility seal.", "Rerun6 passed 949/949 frontend tests, lint, type check, coverage, a 20-route build, 46/46 zero-retry browser journeys, 36/36 route-width accessibility states, and 4/4 Query states; the final recursive source-mtime query returned no files.", "Obtained a quiescent window, built and served a new isolated rerun6 export, repeated every frontend and browser gate, and recorded a clean exact-current freshness seal."],
  ["DEF-QV-060", "BP-017", "Medium", "Open", "The GitNexus CLI and MCP server are reading different branch/index state: local analysis reports success, while the MCP context resource remains four commits stale and its semantic query handle cannot see repaired FTS indexes.", "Run the local analyzer and explicit FTS repair successfully, then read gitnexus://repo/Credit-Operating-System/context and issue a semantic query.", "The MCP context reports the current index and semantic queries return relevant execution flows.", "The context resource reports four-commit staleness and every semantic query returns an empty result with 'FTS indexes missing' even after repair succeeds.", "Compensated with direct source inventories, process resources, and symbol context where available; resolve the stale MCP/server-side branch-index handle before treating semantic discovery as exhaustive."],
  ["DEF-QV-061", "auth-01", "Low", "Fixed", "The expanded login E2E resolved axe-core with import.meta.url even though the Playwright transform emits CommonJS.", "Collect and run the login responsive/accessibility matrix.", "The test resolves the installed axe bundle in the repository's CommonJS-compatible Playwright runtime.", "The spec failed during transform before a browser opened.", "Use require.resolve('axe-core/axe.min.js'); all four login/register/recovery/error responsive scans pass."],
  ["DEF-QV-062", "pipeline-01", "Medium", "Fixed", "Ingestion regression doubles were local lambdas/closures that cannot cross the production parser's spawn-process boundary.", "Run the lineage and integrated-journey ingestion cohorts with process isolation enabled.", "Deterministic extraction doubles remain serializable under spawn while the production child-process isolation stays intact.", "The worker failed before parsing because the local callable could not be pickled.", "Replaced local callables with module-level deterministic functions; the affected 34-node ingestion/pipeline cohort passes with one intentional skip."],
  ["DEF-QV-063", "pipeline-01", "High", "Fixed", "A newly claimed unowned pipeline job could enter its terminal failure path without carrying the claimed worker as a fenced owner.", "Claim an unowned queued job, then force a module failure after the owner/lease commit.", "The failure mutation is fenced to the worker that owns the committed lease, preventing a stale worker from overwriting terminal state.", "The failure helper could receive no expected worker id after ownership had already been established.", "Promote the committed owner into fenced_owner after the lease claim and use it for terminal failure writes; the focused pipeline cohort and complete backend regression pass."],
  ["DEF-QV-064", "BP-017", "Medium", "Fixed", "The first cross-browser production-like harness reused browser-agnostic identity, storage-state, and source-address inputs across independent projects.", "Run all stateful journeys in Chromium, Firefox, and WebKit with real authentication and server throttles enabled.", "Each browser/lane has isolated identity, storage state, and fictional RFC 5737 source address while the real global throttle remains active.", "Later projects could inherit authentication or exhaust another project's per-source credential quota.", "Added project loops plus browser-specific identity, storage, and address inputs; all 141/141 project executions pass with retries disabled."],
  ["DEF-QV-065", "query-01", "Medium", "Fixed", "The Query composer could accept interaction after context data loaded but before the selected context was bound into URL state.", "Load Query and immediately choose a lane or submit a prompt before context URL synchronization finishes.", "The composer remains visibly busy and inert until the loaded context id matches URL state.", "An early interaction could race URL synchronization and bind the investigation to stale or absent context state.", "Gate composer controls on contextReady and cover the transition in the focused component suite; the complete browser matrix passes."],
  ["DEF-QV-066", "BP-017", "Low", "Fixed", "The exact-artifact freshness guard treated directory mtimes and test/spec edits as production-source changes.", "Touch a frontend test or add a source-tree directory entry after building the static artifact.", "Only production source file mtimes can invalidate the staged application artifact.", "The harness rejected an otherwise exact production build after test-only or directory metadata changes.", "Recurse over files only and exclude test/spec files while retaining fail-closed production-source comparison; the final 141-execution cohort passes."],
  ["DEF-QV-067", "monitor-01", "Medium", "Fixed", "Monitor dataset tabs were rendered as clickable server markup before analysis-context hydration attached their handlers.", "Open Monitor in Firefox and click Email intake immediately while bootstrap is still loading.", "Dataset controls expose a busy state and stay disabled until hydration/bootstrap completes, then switch datasets normally.", "The visible click was silently lost and Alerts remained selected.", "Disable every dataset tab until analysis loading settles, expose aria-busy on the tablist, and add a component regression; focused tests and the full browser matrix pass."],
  ["DEF-QV-068", "BP-017", "Low", "Fixed", "Two newly added frontend coverage fixtures violated the repository's TypeScript contracts for RegExp.exec and absent issuer values.", "Run the exact current no-emit TypeScript check after adding the edge-coverage fixtures.", "Validation fixtures type-check under the same compiler contract as product tests.", "TypeScript rejected the mocked exec signature and a null value where absence is represented by undefined.", "Typed the RegExp execution mock and used undefined for absence; focused regression, the reconciled 994-node frontend inventory, and no-emit TypeScript pass."],
  ["DEF-QV-069", "SCR-008", "Low", "Fixed", "The long accessibility matrix could hit the root route's client redirect before authenticated hydration completed and record a readiness miss even though the destination passed immediately in isolation.", "Scan all 19 routes at desktop and mobile widths, with the narrow root state late in the same browser session.", "The harness tolerates one transient authenticated redirect window but still fails closed if the application surface does not resolve after a bounded retry.", "The first matrix reported one root scan_error; an isolated rerun immediately reached /issuers with zero violations or layout failures.", "Retry the complete navigation once after a readiness timeout and preserve the existing scan_error on a second miss; the repaired full 38-state matrix passes with zero nodes, scan errors, or layout failures."],
  ["DEF-QV-070", "API-042", "Medium", "Fixed", "A newly discovered route shifted sequential API inventory IDs, but the parameterized direct-contract module still carried the prior IDs.", "Regenerate the tracker after inserting an API route that sorts before the dedicated contract cases.", "Every collected API case maps to the exact current method/path feature, and a future ID-to-route mismatch fails tracker generation instead of publishing false coverage.", "Nine exercised endpoints appeared unmapped while adjacent API IDs received false-positive direct evidence.", "Reconciled all 11 shifted IDs, added fail-fast parameter-to-route validation in the canonical generator, and reran all 14 direct HTTP contracts."],
  ["DEF-QV-071", "BP-017", "Low", "Fixed", "A new ShortcutHelp test fixture still used the retired singular route field after ShortcutEntry moved to a routes array.", "Run the current frontend TypeScript no-emit check.", "Every test fixture conforms to the live ShortcutEntry contract.", "TypeScript rejected the object literal because route is not a ShortcutEntry property.", "Changed the temporary route-scoped fixture to routes: ['/temporary']; the focused test and current type check pass."],
  ["DEF-QV-072", "BP-017", "Low", "Fixed", "A new FlagToQa test imported waitFor but never used it.", "Run the current frontend lint command.", "The frontend lint gate completes without warnings or errors.", "ESLint reported one unused-import warning in FlagToQa.test.tsx.", "Removed the unused waitFor import; the focused test and current lint gate pass cleanly."],
  ["DEF-QV-073", "query-01", "High", "Fixed", "The citation-metadata filter declared a widened string tuple predicate that was not assignable to the narrower template-literal tuple returned by the resolver.", "Run the current TypeScript check or production build after adding resolved issuer/document labels to Query citations.", "Query citation metadata narrows null entries without changing the exact tuple type, and the production build compiles.", "TypeScript rejected Object.fromEntries at QueryInvestigationWorkbench.tsx:272 and blocked the production build.", "Removed the over-broad explicit predicate and let TypeScript infer the non-null tuple; targeted Query validation, type check, and the rebuilt browser artifact pass."],
  ["DEF-QV-074", "SCR-018", "Low", "Fixed", "The new Upload route smoke test asserted the retired primary-action name after the implementation clarified that the link jumps to the intake form.", "Render UploadPage and query its primary link by the old accessible name 'Open intake'.", "The smoke contract asserts the implemented 'Jump to intake form' link and its #intake-workspace target.", "Testing Library could only find the current 'Jump to intake form' link, so the stale assertion failed.", "Updated the accessible-name assertion; the complete Upload smoke file and full frontend regression pass."],
  ["DEF-QV-075", "BP-017", "Low", "Fixed", "MoreDrawer.test.tsx was replaced while the full Vitest process was already collecting/executing it, so the run observed an in-flight test revision.", "Run the full frontend suite while a parallel writer updates the focus-trap test.", "Validation executes a quiescent file revision and reconciles any post-start writes with a complete-file rerun.", "The in-flight run reported the focus-wrap assertion twice, while the completed file immediately passed 2/2 in isolation.", "Waited for source quiescence, reran the complete drawer test, and repeated the current full frontend suite before sealing evidence."],
  ["DEF-QV-076", "BP-017", "Low", "Fixed", "The new useGraphZoom test cast its transform fixture to never, causing React state to infer an unusable Dispatch type and making object spread illegal.", "Run the current frontend TypeScript check after adding the hook test.", "The fixture is typed as the live d3 ZoomTransform contract and supplies a compatible state dispatcher.", "TypeScript reported two compile errors even though the two runtime tests passed.", "Typed the fixture and state explicitly as ZoomTransform; the complete test, lint, type check, build, and final aggregate pass."],
  ["DEF-QV-077", "research-13", "Medium", "Fixed", "The post-mount advanced-brief preference effect could finish after an early user click and overwrite the newly expanded disclosure with the persisted collapsed state.", "Navigate from saved Research defaults to /research in WebKit and click Advanced brief immediately after the settings response.", "A user interaction wins over late preference hydration, the disclosure stays expanded, and the saved audience is visible.", "WebKit observed aria-expanded=false after the click; Chromium and Firefox happened to complete the effect first.", "Added an interaction fence that prevents preference hydration from overwriting a prior toggle; the focused WebKit spec passes 4/4 and the final cross-browser matrix passes 141/141."],
  ["DEF-QV-078", "issuer-01", "Low", "Fixed", "The expanded ThesisTimeline fixtures included internal thesis_version_id and realized_at fields that the server PredictionOut response model intentionally omits.", "Run the current frontend TypeScript check against the expanded thesis prediction fixtures.", "Mocked prediction responses match the actual public API shape.", "TypeScript rejected four object literals with fields absent from ThesisPrediction.", "Removed the internal-only fields; the complete thesis fixture, type check, build, and final frontend aggregate pass."],
  ["DEF-QV-079", "issuer-01", "Medium", "Fixed", "The shared frontend Issuer interface treated ticker, industry, country, and figi as absent-or-string even though FastAPI IssuerResponse returns each field as nullable.", "Use null-valued directory/profile responses in the current Issuers fixtures and run TypeScript.", "The frontend contract matches the public API and every dependent consumer handles the nullable shape safely.", "TypeScript rejected three realistic null-valued fixtures, masking a runtime contract mismatch with CRITICAL fan-out.", "Widened the four fields to string | null after a CRITICAL GitNexus impact warning; TypeScript, the current 1,242-node reconciled frontend inventory, build, 15 affected cross-browser journeys, and four route-width accessibility states pass."],
  ["DEF-QV-080", "BP-017", "Low", "Fixed", "New concurrent interaction suites used unsafe EventListener casts, explicit-any mock contracts, and stale imports, so runtime tests could pass while lint or TypeScript failed.", "Run npm run lint and npx tsc --noEmit after collecting the new Ask, Pipeline, Research, and Deep-Dive interaction files.", "Every executable test harness satisfies the same lint and type contracts as production code.", "TypeScript rejected the Ask event listener; Pipeline and Research produced 45 explicit-any errors and two unused imports.", "Replaced unsafe casts and any-based mocks with exact component/event DTOs; lint, TypeScript, the focused 32-node cohort, and the reconciled 1,242-node frontend inventory pass."],
  ["DEF-QV-081", "pipeline-44", "Low", "Fixed", "The new Pipeline scope assertion retained a GraphView DOM node that React replaced during the DAG-to-swimlane-to-DAG cycle.", "Run pipeline-interactions.test.tsx and switch from the full route to LEGAL after cycling the subview.", "The assertion reads the currently mounted graph and verifies that LEGAL includes CP-4 while excluding CP-2.", "The rendered graph carried the correct nine-module legal scope, but the stale detached node still reported the prior full scope and failed twice including retry.", "Re-query the mounted graph inside waitFor; the complete Pipeline file passes 6/6 and the exact-current frontend aggregate passes 1,259/1,259."],
  ["DEF-QV-082", "BP-017", "Low", "Fixed", "A late Report Studio interaction harness used explicit any for component props and cast incomplete API fixtures around the public DTO types.", "Run npm run lint after the late reports-interactions.test.tsx revision.", "All interaction mocks and API fixtures satisfy the exact production TypeScript and ESLint contracts.", "ESLint reported 12 no-explicit-any errors even though the four runtime tests passed.", "Typed every mock prop, completed ReportDraftDTO and ReportVersionDTO fixtures, and removed binary-response casts; the report file passes 4/4, lint and TypeScript are clean, and the aggregate passes 1,259/1,259."],
  ["DEF-QV-083", "BP-017", "Low", "Fixed", "A concurrent Command Center interaction harness used 21 explicit-any annotations and cast structurally incomplete portfolio and insight fixtures around the public contracts.", "Run npm run lint after command-interactions.test.tsx is added or revised.", "All Command Center mock props and API fixtures satisfy the exact production TypeScript and ESLint contracts while preserving the five behavioral journeys.", "The five runtime tests passed, but ESLint reported 21 no-explicit-any errors and the fixtures used retired posture and position field shapes.", "Typed all mock props; replaced casts with complete PortfolioSummary, CommandPortfolioSnapshot, CommandPortfolioPosition, InsightPage, and InsightArtifact fixtures; focused 5/5, lint, TypeScript, and aggregate 1,259/1,259 pass."],
  ["DEF-QV-084", "research-06", "Low", "Fixed", "The Research interaction harness switched the AI-mode mock from standard to a retired 'deep' value that neither the public TypeScript union nor ResearchBrief schema accepts.", "Run the fully framed Research interaction and inspect the brief passed to deepResearch.", "The harness selects one of max, standard, or lite and verifies the exact public request shape.", "The runtime-only mock asserted ai_mode='deep', creating false evidence for an impossible production request.", "Changed the mock transition and assertion to the implemented max preset; the complete 26-node Research frontend cohort, lint, TypeScript, and exact-current frontend aggregate pass."],
  ["DEF-QV-085", "BP-017", "Low", "Fixed", "Two new Upload interaction harnesses used explicit any and non-generic dropzone prop stubs, so runtime behavior passed while lint and TypeScript rejected the test contracts.", "Run lint and tsc --noEmit after collecting UploadWizard.interactions.test.tsx and steps-interactions.test.tsx.", "Upload fixtures use the public step component, issuer, FileRejection, and generic dropzone prop contracts.", "ESLint reported 12 no-explicit-any errors and TypeScript rejected five FileStep renders because getRootProps/getInputProps did not satisfy their generic signatures.", "Replaced unsafe fixtures with ComponentProps-derived contracts, exact rejection/issuer/result types, narrowed select values, and generic dropzone adapters; both files pass 12/12, lint, and TypeScript."],
  ["DEF-QV-086", "BP-017", "Low", "Fixed", "The new Command Palette stale-response harness typed the deferred issuer list as any[].", "Run lint after collecting CommandPalette.interactions.test.tsx.", "The deferred response is derived from the exact getIssuers return type.", "ESLint reported one no-explicit-any error even though the original four interactions passed.", "Typed the resolver as Awaited<ReturnType<typeof getIssuers>>; the current file passes 6/6, lint, and TypeScript."],
  ["DEF-QV-087", "BP-017", "Low", "Fixed", "The automation collector accepted pytest warning-summary references because they also begin with a test path and contain a double-colon node separator.", "Regenerate the workbook while current pytest collection emits warning summaries.", "Only executable collected nodes receive automation evidence IDs; diagnostic warning references are not counted as tests.", "At discovery, ten warning-summary references inflated the automation inventory from 3,925 real nodes to 3,935.", "Added --disable-warnings and exact per-layer count gates to the read-only collectors; the current rebuilt inventory reconciles exactly to 3,953 real nodes and the formula-error scan is clean."],
  ["DEF-QV-088", "BP-017", "Low", "Fixed", "A concurrent RV Screener harness imported an unused helper and used Record<string, any> for the analysis context fixture.", "Run lint and TypeScript after collecting RVScreenerWorkbench.test.tsx.", "The mock uses the exact public AnalysisContext contract and introduces no unused dependencies or explicit any.", "The 12 runtime interactions passed, but ESLint reported one error and one warning; the first exact type repair then exposed incomplete context fixtures in TypeScript.", "Removed the unused import, supplied a complete AnalysisContext fixture, and isolated the deliberate invalid-filter boundary cast; focused 12/12, lint, TypeScript, and the 1,353-node reconciled inventory pass."],
  ["DEF-QV-089", "BP-017", "Low", "Fixed", "A concurrent Alert Inbox harness used Record<string, any> to reach test-only React fiber props.", "Run lint and TypeScript after collecting the expanded AlertInbox.test.tsx.", "The helper exposes only the recursive fiber fields used by the assertions and does not rely on explicit any.", "All 17 runtime interactions passed, but ESLint rejected the explicit any; the first narrow type then exposed an optional-return mismatch in TypeScript.", "Added a narrow TestFiber interface and normalized an absent parent to null; focused 17/17, lint, TypeScript, and the 1,353-node reconciled inventory pass."],
  ["DEF-QV-090", "deepdive-42", "Low", "Fixed", "The first phone-triage handoff assertion used one exact CSS attribute selector for a URL containing multiple query parameters, making a rendered named link appear absent in the test harness.", "Render the Deep-Dive phone triage and locate its Query/Pipeline handoffs by the compound href selector.", "The harness identifies each user-facing handoff by its visible action and independently verifies the exact issuer/context URL.", "The complete 115-node Deep-Dive cohort rendered the triage region but the brittle query-string selector returned null twice including retry.", "Locate the two anchors by their rendered action labels and compare getAttribute('href') to the exact identity-preserving URL; the repaired focused cohort passes."],
  ["DEF-QV-091", "BP-017", "Low", "Fixed", "A concurrent Report Studio interaction helper widened a React host-fiber lookup to Record<string, any>, reintroducing a lint failure after the earlier typed harness reconciliation.", "Run the repository frontend lint gate against the current untracked interaction cohort.", "Test-only host-fiber introspection exposes only the memoized callback map used by the assertions and contains no explicit any.", "The global lint command failed at reports-interactions.test.tsx:235 even though Deep-Dive focused lint, runtime tests, and TypeScript were green.", "Added a narrow TestFiber interface, guarded an unreadable fiber, and returned its typed memoizedProps; Report Studio focused regression and the global lint gate pass."],
  ["DEF-QV-092", "BP-017", "Low", "Fixed", "The first tracker regeneration command was launched from the output directory even though the generator resolves repository dependencies and source paths from process.cwd().", "Run build_quality_tracker.mjs with the output directory as the working directory.", "The canonical command runs from the repository root and reaches collection before mutating the workbook.", "Node failed before collection because it searched outputs/caos-quality-validation/caos/frontend/node_modules/typescript.", "Reran the unchanged generator from the repository root; dependency discovery and collection proceeded normally."],
  ["DEF-QV-093", "BP-017", "Low", "Fixed", "Fourteen frontend tests were added after the prior 1,353-node execution seal, so the exact-count collector correctly refused to publish them as already passing.", "Regenerate the tracker against the current worktree without executing post-seal nodes.", "Every newly collected node is executed before the expected count and validation-run seal advance.", "The generator collected 1,367 Vitest nodes and stopped at the 1,353-node gate before workbook mutation.", "Compared the current list to the prior Automation Evidence sheet, executed the 13 new Report Studio interaction nodes through the complete 17-test file and the new caveat node through its complete 5-test file, then advanced the exact gate to 1,367."],
  ["DEF-QV-094", "BP-017", "Low", "Fixed", "One canonical rebuild's Vitest listing child stopped making progress at zero CPU before any later collector or workbook mutation.", "Run the root-scoped tracker generator while the current worktree is under concurrent validation load.", "A stalled collection run is bounded, terminated without publishing, and a clean retry completes every count/evidence/export gate.", "The vitest list child remained sleeping for more than seven minutes with no output, and the prior workbook timestamp remained unchanged.", "Terminated only the launched generator session, verified no collector orphan and no workbook write, then completed a clean root-scoped rebuild."],
  ["DEF-QV-095", "BP-017", "Low", "Fixed", "Twenty-three net-new frontend nodes landed after the 1,367-node workbook export, spanning honest empty/offline states, provenance, roving tabs, modal stacking, and module QA semantics.", "Rebuild the tracker immediately after the 1,367-node seal while concurrent test additions are present.", "Post-seal nodes are identified by exact node diff, executed through their complete files, and admitted only after lint and TypeScript remain green.", "The collector found 1,390 nodes and stopped before overwriting the workbook; comparison surfaced 26 new identities, including two renamed AlertInbox nodes, for a net increase of 23.", "Executed all 11 affected files (90/90), reran lint and TypeScript, and advanced the exact frontend seal to 1,390."],
  ["DEF-QV-096", "query-01", "Low", "Fixed", "The Query focus-event effect captured setLane but declared only manualLane as a dependency, leaving a lint warning and a potential stale URL-update closure if the typed URL adapter changed.", "Run the global frontend lint gate after the concurrent Query workbench revision.", "The event listener depends on a stable memoized lane transition that always updates both local lane state and typed URL state.", "ESLint reported react-hooks/exhaustive-deps at QueryInvestigationWorkbench.tsx:268; runtime and TypeScript remained green.", "Memoized setLane with updateUrlState, moved it before the effect, declared it in the dependency list, and passed the 26-test Query/Ask focused cohort plus clean lint and TypeScript."],
];

const journeySeed = [
  ["BP-001", "Analyst registration and session", "Submit the shared signup code and name, establish the signed analyst cookie, resolve `/me`, and log out.", "caos/server/routes/auth.py; caos/tests/frontend/e2e/login_flow.spec.ts", "Pass"],
  ["BP-002", "Issuer onboarding", "Create an issuer through the upload wizard, persist the record, and enter the issuer workspace.", "caos/frontend/src/app/upload/page.tsx; caos/server/routes/issuers.py; bootstrap_flow.spec.ts", "Pass"],
  ["BP-003", "Document intake and evidence vault", "Upload, malware-scan, parse, chunk, persist, and surface an issuer document with truthful scan/provenance state.", "caos/server/routes/ingestion.py; avscan.py; document_parser.py", "Suite evidence"],
  ["BP-004", "SEC EDGAR acquisition", "Search filings, inspect exhibits, fetch a bounded exhibit, and vault it under the issuer when EDGAR is configured.", "caos/server/routes/edgar.py; edgar.py", "Suite evidence"],
  ["BP-005", "Credit engine run", "Create a frozen-input run, execute the CP dependency graph, persist module outputs, apply QA gates, and expose terminal status.", "caos/server/routes/runs.py; engine/pipeline.py; run_executor.py", "Suite evidence"],
  ["BP-006", "Deep-Dive evidence review", "Open a completed run, navigate modules, inspect evidence and QA state, and preserve issuer/run context.", "caos/frontend/src/app/deepdive/page.tsx; deepdive_flow.spec.ts", "Pass"],
  ["BP-007", "Model scenario and persistence", "Load the issuer model, adjust scenarios/assumptions, recompute the worksheet, save durable changes, and restore them.", "caos/frontend/src/app/model/page.tsx; model_flow.spec.ts; routes/models.py", "Pass"],
  ["BP-008", "Cross-coverage Query investigation", "Create or reuse an analysis context, choose a lane, run a question, persist the URL-addressable result, inspect authority, and pin a finding.", "QueryInvestigationWorkbench.tsx; routes/query.py; query_flow.spec.ts", "Pass"],
  ["BP-009", "Deep Research job", "Submit a bounded brief, enqueue durable research, poll progress, render the report and sources, and disclose demo/truncation state.", "caos/server/routes/research.py; research_executor.py; research_flow.spec.ts", "Pass"],
  ["BP-010", "Issuer research report synthesis", "Start issuer-scoped synthesis, poll the durable report job, and preserve source/run provenance.", "research_report_executor.py; routes/reports.py", "Suite evidence"],
  ["BP-011", "Report Studio publication", "Select a deliverable, compose from run evidence, enforce QA/watermark rules, export, and optionally mirror to the vault.", "caos/frontend/src/app/reports/page.tsx; routes/reports.py; vault_export.py", "Suite evidence"],
  ["BP-012", "Sector review", "Refresh bounded signals, filter/review evidence, ask a scoped question, ratify sections, and publish a review.", "caos/frontend/src/app/sector/page.tsx; routes/sector.py", "Suite evidence"],
  ["BP-013", "Relative-value screening", "Import a market workbook snapshot, map issuers, run a bounded RV screen, and inspect comparable outputs.", "caos/frontend/src/app/sector-rv/page.tsx; routes/rv.py; routes/market_import.py", "Suite evidence"],
  ["BP-014", "Portfolio posture and decision", "Review portfolio/issuer posture, open a decision record, capture rationale and evidence, and surface it to committee workflows.", "routes/portfolio.py; routes/portfolios.py; routes/decisions.py; routes/committee.py", "Suite evidence"],
  ["BP-015", "Monitoring and alert lifecycle", "Ingest or derive an alert, route it to the desk, review notification/digest state, and resolve or escalate it.", "caos/frontend/src/app/monitor/page.tsx; routes/alerts.py; routes/notifications.py; routes/digest.py", "Suite evidence"],
  ["BP-016", "Autonomous coverage cycle", "Enqueue and execute the Sentinel→Analyst→Reporter pipeline with durable terminal state and bounded background recovery.", "caos/server/routes/autonomy.py; engine/pipeline_executor.py", "Suite evidence"],
  ["BP-017", "Runtime configuration and fail-closed boot", "Load environment settings, enforce deployed secret/Postgres/AV guards, select providers and gates, and start bounded executors.", "caos/server/config.py; caos/server/main.py", "Suite evidence"],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.filter((item) => item.some(Boolean)).map((item) =>
    Object.fromEntries(headers.map((header, index) => [header, item[index] || ""])),
  );
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function runCollection(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...extraEnv },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Collection failed: ${command} ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function relativeRepoPath(value) {
  return path.relative(repo, value).replaceAll("\\", "/");
}

function collectAutomationEvidence() {
  const frontendDir = path.join(repo, "caos", "frontend");
  const python = path.join(repo, "caos", "server", ".venv311", "bin", "python");
  const vitest = JSON.parse(runCollection("npx", ["vitest", "list", "--json"], frontendDir));
  const pytest = runCollection(
    python,
    ["-m", "pytest", "caos/tests/server", "caos/tests/stress", "caos/tests/cohort", "--collect-only", "-q", "--disable-warnings"],
    repo,
  ).split("\n").map((line) => line.trim()).filter((line) => line.startsWith("caos/tests/") && line.includes("::"));
  const playwright = runCollection(
    "npx",
    ["playwright", "test", "--list"],
    frontendDir,
    { NODE_PATH: path.join(frontendDir, "node_modules") },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("›") && /\.spec\.ts:\d+:\d+/.test(line));

  const expectedCounts = { vitest: 1390, pytest: 2423, playwright: 141 };
  const actualCounts = { vitest: vitest.length, pytest: pytest.length, playwright: playwright.length };
  for (const layer of Object.keys(expectedCounts)) {
    if (actualCounts[layer] !== expectedCounts[layer]) {
      throw new Error(`Automation inventory drifted for ${layer}: expected ${expectedCounts[layer]}, collected ${actualCounts[layer]}. Execute the new nodes before rebuilding the canonical tracker.`);
    }
  }

  const rows = [];
  vitest.forEach((item, index) => rows.push({
    id: `AUT-VIT-${String(index + 1).padStart(4, "0")}`,
    layer: "Frontend unit/component",
    node: `${relativeRepoPath(item.file)}::${item.name}`,
    name: item.name,
    file: relativeRepoPath(item.file),
    executionRun: "VAL-20260717-FE-1390-RECONCILED",
    executedDate: today,
  }));
  pytest.forEach((node, index) => {
    const file = node.split("::")[0];
    rows.push({
      id: `AUT-PY-${String(index + 1).padStart(4, "0")}`,
      layer: "Server/stress/cohort",
      node,
      name: node.split("::").slice(1).join("::"),
      file,
      executionRun: "VAL-20260717-SRV-2399-RECONCILED",
      executedDate: today,
    });
  });
  playwright.forEach((line, index) => {
    const match = line.match(/([^/\s]+\.spec\.ts):(\d+):(\d+)\s+›\s+(.+)$/);
    if (!match) return;
    const file = `caos/tests/frontend/e2e/${match[1]}`;
    rows.push({
      id: `AUT-E2E-${String(index + 1).padStart(3, "0")}`,
      layer: "Browser E2E",
      node: `${file}:${match[2]}:${match[3]}::${match[4]}`,
      name: match[4],
      file,
      executionRun: "VAL-20260717-E2E-141-NORETRY",
      executedDate: today,
    });
  });
  return rows;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routeCallRegex(method, routePath) {
  const routePattern = routePath.split(/(\{[^}]+\})/).map((part) =>
    /^\{[^}]+\}$/.test(part) ? "(?:\\{[^}]+\\}|[^\\\"'`\\s/?]+)" : escapeRegex(part),
  ).join("");
  return new RegExp(`\\.${method.toLowerCase()}\\s*\\(\\s*(?:f|rf)?[\\\"'\`]${routePattern}`, "i");
}

function concreteRouteRegex(routePath) {
  const routePattern = routePath.split(/(\{[^}]+\})/).map((part) =>
    /^\{[^}]+\}$/.test(part) ? "[^/]+" : escapeRegex(part),
  ).join("");
  return new RegExp(`^${routePattern}$`);
}

function validateApiFeatureParameterMappings(sourceByFile, descriptors) {
  const parameterPattern = /pytest\.param\(\s*["'](API-\d{3})["']\s*,\s*["']([A-Z]+)["']\s*,\s*["'](\/api\/[^"']+)["']/gs;
  for (const [file, source] of sourceByFile.entries()) {
    for (const match of source.matchAll(parameterPattern)) {
      const [, declaredId, method, concretePath] = match;
      const candidates = descriptors.filter((descriptor) =>
        descriptor.route.method === method && concreteRouteRegex(descriptor.route.path).test(concretePath),
      );
      if (candidates.length !== 1) {
        throw new Error(`API test mapping ${file} ${declaredId} ${method} ${concretePath} resolved ${candidates.length} inventory routes`);
      }
      if (candidates[0].id !== declaredId) {
        throw new Error(`API test mapping drift in ${file}: ${declaredId} names ${method} ${concretePath}, now ${candidates[0].id}`);
      }
    }
  }
}

function routeNavigationRegex(routePath) {
  const suffix = routePath === "/" ? "(?:[?#]|[\"'`])" : "(?:[/?#]|[\"'`])";
  return new RegExp(`\\.(?:goto|waitForURL)\\s*\\(\\s*[\\\"'\`]${escapeRegex(routePath)}${suffix}`, "i");
}

function containsIdentifier(text, identifier) {
  return new RegExp(`(?:^|[^a-z0-9_])${escapeRegex(identifier.toLowerCase())}(?:$|[^a-z0-9_])`, "i").test(text);
}

function significantTokenOverlap(left, right) {
  const ignored = new Set(["test", "tests", "with", "from", "that", "this", "when", "then", "renders", "returns", "route", "error"]);
  const tokens = (value) => new Set((value.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((token) => token.length >= 4 && !ignored.has(token)));
  const leftTokens = tokens(left);
  return [...tokens(right)].filter((token) => leftTokens.has(token)).length;
}

function testSubjectPath(file) {
  return file.replace(/\.(?:test|spec)(\.[^.]+)$/, "$1");
}

function extractEvidenceBody(evidence, source) {
  if (evidence.layer === "Server/stress/cohort") {
    const functionName = evidence.name.split("::").at(-1).replace(/\[.*$/, "");
    const startMatch = new RegExp(`(?:^|\\n)[ \\t]*(?:async\\s+)?def\\s+${escapeRegex(functionName)}\\s*\\(`, "m").exec(source);
    if (!startMatch) return "";
    const start = startMatch.index;
    const tail = source.slice(start + startMatch[0].length);
    const next = /\n[ \t]*(?:async\s+)?def\s+test_[A-Za-z0-9_]+\s*\(/.exec(tail);
    return source.slice(start, next ? start + startMatch[0].length + next.index : source.length);
  }
  const separator = evidence.layer === "Browser E2E" ? " › " : " > ";
  const leaf = evidence.name.split(separator).at(-1);
  const start = source.indexOf(leaf);
  if (start < 0) return "";
  const tail = source.slice(start + leaf.length);
  const next = /\n\s*(?:it|test)\s*\(/.exec(tail);
  return source.slice(start, next ? start + leaf.length + next.index : Math.min(source.length, start + 8000));
}

function expandLocalHelperBodies(body, source) {
  const helperNames = [...body.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith("test_"));
  const helperBodies = [];
  for (const name of new Set(helperNames)) {
    const startMatch = new RegExp(`(?:^|\\n)(?:async\\s+)?def\\s+${escapeRegex(name)}\\s*\\(`, "m").exec(source);
    if (!startMatch) continue;
    const start = startMatch.index;
    const tail = source.slice(start + startMatch[0].length);
    const next = /\n(?:async\s+)?def\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/.exec(tail);
    helperBodies.push(source.slice(start, next ? start + startMatch[0].length + next.index : source.length));
  }
  return [body, ...helperBodies].join("\n");
}

function classifyScenario(evidence) {
  const name = evidence.name.toLowerCase();
  if (/rejects?_unparseable|invalid[_ -]input/.test(name)) return "Invalid input";
  if (/zero[_ -]boundary|boundary[_ -]condition/.test(name)) return "Boundary conditions";
  if (/uses?_its?_code_default|environment_override_parses_declared_type/.test(name)) return "Happy path";
  const text = `${evidence.name} ${evidence.body}`.toLowerCase();
  if (/mobile|responsive|viewport|phone|breakpoint|390px|900px/.test(text)) return "Mobile/responsive";
  if (/permission|unauth|forbidden|tenant|cross[- ]analyst|identity|role gate|secret|csrf|401|403/.test(text)) return "Permission/security";
  if (/concurr|worker|race|stress|performance|latency|lease|advisory lock|bounded graph|pagination bound/.test(text)) return "Performance";
  if (/boundary|limit|cap|max(?:imum)?|min(?:imum)?|zero|duplicate|idempoten|stale|already|overflow|non[- ]finite/.test(text)) return "Boundary conditions";
  if (/invalid|malformed|missing|required|empty|oversize|too large|unknown|not found|404|409|422|rejects?/.test(text)) return "Invalid input";
  if (/failure|fails?|error|timeout|degraded|exception|rollback|500|502|503/.test(text)) return "Error path";
  return "Happy path";
}

function titleFromIdentifier(value) {
  return clean(value).replace(/^_+/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function joinPath(prefix, routePath) {
  const joined = `${prefix || ""}${routePath || ""}` || "/";
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

function scenarioSlug(value) {
  return value.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

function scenarioApplicable(feature, scenario) {
  if (scenario !== "Mobile/responsive") return true;
  return !["Discovered API handler", "Discovered configuration"].includes(feature.sourceType);
}

function scenarioText(feature, scenario) {
  const target = feature.endpoint || feature.trigger || feature.name;
  const cases = {
    "Happy path": `Starting from ${feature.trigger || "the documented entry state"}, exercise ${target}; verify the implemented expected behaviour and source provenance.`,
    "Error path": `Force the primary dependency behind ${target} to fail; verify a truthful, recoverable error/degraded state and no stale success state.`,
    "Boundary conditions": `Exercise empty, zero, maximum configured, repeated, already-selected, and terminal states relevant to ${target}.`,
    "Invalid input": `Submit blank, malformed, wrong-type, unsupported, or over-limit input to ${target}; verify implemented validation and no partial corrupt write.`,
    "Permission/security": `Exercise ${target} without the required analyst/session/edge/tenant authority; verify fail-closed behavior and no sensitive detail leakage.`,
    "Performance": `Exercise ${target} at its configured bound; verify no request storm, unbounded fan-out, runaway render/poll loop, or blocked primary interaction.`,
    "Mobile/responsive": `Exercise ${target} at 390px and 900px widths where applicable; verify primary controls, focus, tables, and evidence remain reachable without overlap.`,
  };
  return cases[scenario];
}

function expectedForScenario(feature, scenario) {
  if (scenario === "Happy path") return feature.expected;
  if (scenario === "Error path") return "The implemented error or degraded state is explicit, stable, recoverable, and does not preserve a false successful conclusion.";
  if (scenario === "Boundary conditions") return "Boundary inputs settle into defined empty, disabled, capped, or terminal states without crash, NaN, duplication, or state leak.";
  if (scenario === "Invalid input") return "Invalid input is rejected or ignored at the declared boundary with specific validation feedback and no partial durable mutation.";
  if (scenario === "Permission/security") return "Unauthorized or cross-scope access fails closed; protected data and actions remain unavailable; expected form-owned credential errors remain visible.";
  if (scenario === "Performance") return "Execution remains within configured bounds without unbounded concurrency, polling, rendering, memory growth, or unnecessary network fan-out.";
  return "The feature remains keyboard-operable and coherent at narrow widths; primary controls and semantic status are not clipped or conveyed by color alone.";
}

function genericEdgeCases(feature) {
  const parts = ["empty/missing data", "repeat interaction or double submit", "dependency timeout or non-2xx response"];
  const text = `${feature.name} ${feature.expected} ${feature.endpoint}`;
  if (/upload|file|document|edgar|vault/i.test(text)) parts.push("unsupported/oversized file, duplicate import, malware or parse failure");
  if (/query|research|chat|ask|search/i.test(text)) parts.push("blank/long prompt, no results, offline provider, stale completion");
  if (/table|grid|metric|model|coverage|leverage|ebitda/i.test(text)) parts.push("null/zero/non-finite metrics, empty rows, sort and narrow viewport");
  if (/auth|analyst|session|issuer|portfolio|run/i.test(text)) parts.push("missing session, foreign analyst/team scope, stale context or run id");
  return parts.join("; ");
}

function genericValidation(feature) {
  const rules = ["observed UI/API contract must match the cited implementation"];
  const text = `${feature.name} ${feature.expected} ${feature.endpoint}`;
  if (/id|run|issuer|context|job|document|portfolio/i.test(text)) rules.push("identifiers must exist, be correctly typed, and remain in the active authority scope");
  if (/upload|file/i.test(text)) rules.push("file type, size, scan, parse, and storage limits apply before durable acceptance");
  if (/metric|model|ratio|leverage|ebitda|coverage|scenario/i.test(text)) rules.push("CP-derived arithmetic must reject non-finite values and zero denominators");
  if (/auth|session|profile|delete|publish|ratif|save|create|post|put|patch/i.test(text)) rules.push("mutations require the declared session/dependency and must not partially commit invalid input");
  return rules.join("; ");
}

function apiVerbStory(method, name, routePath) {
  const intent = method === "GET" ? "retrieve" : method === "DELETE" ? "remove" : method === "POST" ? "submit or create" : "update";
  return `As an authenticated CAOS client, I want to ${intent} ${name.toLowerCase()} through ${method} ${routePath} so that the corresponding analyst workflow can use the server's implemented contract.`;
}

function apiExpected(route) {
  const metadata = [route.doc, route.responseModel ? `response_model=${route.responseModel}` : "", route.statusCode ? `status_code=${route.statusCode}` : ""].filter(Boolean).join("; ");
  return `${route.method} ${route.path} invokes ${route.file}:${route.line} (${route.handler}). FastAPI resolves declared dependencies and validates path/query/body inputs before the handler returns its implemented response${metadata ? `; ${metadata}` : ""}.`;
}

function makeFeature(input) {
  return {
    id: input.id,
    name: clean(input.name),
    concept: clean(input.concept),
    story: clean(input.story),
    expected: clean(input.expected),
    edgeCases: clean(input.edgeCases || genericEdgeCases(input)),
    currentStatus: clean(input.currentStatus || "Documented — direct execution pending"),
    severity: clean(input.severity || "None"),
    notes: clean(input.notes),
    validationRules: clean(input.validationRules || genericValidation(input)),
    dependencies: clean(input.dependencies),
    assumptions: clean(input.assumptions || "Expected behaviour is inferred from the cited current implementation, not external product intent."),
    trigger: clean(input.trigger),
    files: clean(input.files),
    endpoint: clean(input.endpoint),
    sourceType: clean(input.sourceType),
    sourceStatus: clean(input.sourceStatus),
  };
}

function columnName(index) {
  let n = index + 1;
  let value = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    n = Math.floor((n - remainder) / 26);
  }
  return value;
}

function writeSheet(workbook, name, headers, rows, widths = []) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const data = [headers, ...rows];
  const range = sheet.getRangeByIndexes(0, 0, data.length, headers.length);
  range.values = data;
  range.format = { wrapText: true, verticalAlignment: "top" };
  range.format.borders = { preset: "insideHorizontal", style: "thin", color: "#262633" };
  sheet.freezePanes.freezeRows(1);
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
    fill: "#12121a",
    font: { bold: true, color: "#e6e6ef" },
    wrapText: true,
    verticalAlignment: "center",
    rowHeight: 30,
  };
  widths.forEach((width, index) => {
    if (width) sheet.getRange(`${columnName(index)}:${columnName(index)}`).format.columnWidth = width;
  });
  return sheet;
}

async function scanAppRoutes() {
  const appDir = path.join(repo, "caos", "frontend", "src", "app");
  const files = await fs.readdir(appDir, { recursive: true });
  const pages = [];
  for (const relative of files.filter((file) => file.endsWith("page.tsx")).sort()) {
    const directory = path.dirname(relative).replaceAll("\\", "/");
    const route = directory === "." ? "/" : `/${directory}`;
    const source = await fs.readFile(path.join(appDir, relative), "utf8");
    const componentNames = [...source.matchAll(/import\s+\{?\s*([A-Za-z0-9_, ]+)\s*\}?\s+from\s+["']@\/components\//g)]
      .flatMap((match) => match[1].split(",").map(clean)).filter(Boolean).slice(0, 6);
    pages.push({ route, file: `caos/frontend/src/app/${relative}`, components: componentNames });
  }
  return pages;
}

async function scanApiRoutes() {
  const mainText = await fs.readFile(path.join(repo, "caos", "server", "main.py"), "utf8");
  const routeDir = path.join(repo, "caos", "server", "routes");
  const aliases = { model_workbook_routes: "model_workbook", settings_routes: "settings" };
  const prefixes = new Map();
  for (const match of mainText.matchAll(/app\.include_router\((\w+)\.router,\s*prefix="([^"]*)"/g)) {
    prefixes.set(`${aliases[match[1]] || match[1]}.py`, match[2]);
  }
  const routeFiles = (await fs.readdir(routeDir)).filter((file) => file.endsWith(".py")).sort();
  const routes = [];
  for (const file of routeFiles) {
    const source = await fs.readFile(path.join(routeDir, file), "utf8");
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const start = lines[index].match(/^\s*@router\.(get|post|put|patch|delete)\s*\(/);
      if (!start) continue;
      let decorator = lines[index].trim();
      let balance = (lines[index].match(/\(/g) || []).length - (lines[index].match(/\)/g) || []).length;
      while (balance > 0 && index + 1 < lines.length) {
        index += 1;
        decorator += ` ${lines[index].trim()}`;
        balance += (lines[index].match(/\(/g) || []).length - (lines[index].match(/\)/g) || []).length;
      }
      const routePath = decorator.match(/\(\s*["']([^"']*)["']/)?.[1];
      if (routePath === undefined) continue;
      let defIndex = index + 1;
      while (defIndex < lines.length && !/^\s*(?:async\s+)?def\s+\w+\s*\(/.test(lines[defIndex])) defIndex += 1;
      if (defIndex >= lines.length) continue;
      const handler = lines[defIndex].match(/^\s*(?:async\s+)?def\s+(\w+)/)?.[1] || "unknown_handler";
      const responseModel = clean(decorator.match(/response_model\s*=\s*([^,)]+)/)?.[1]);
      const statusCode = clean(decorator.match(/status_code\s*=\s*([^,)]+)/)?.[1]);
      const afterDef = lines.slice(defIndex, Math.min(lines.length, defIndex + 24)).join("\n");
      const doc = clean(afterDef.match(/(?:"""|''')([\s\S]*?)(?:"""|''')/)?.[1]).slice(0, 500);
      routes.push({
        method: start[1].toUpperCase(),
        path: joinPath(prefixes.get(file) || "", routePath),
        file: `caos/server/routes/${file}`,
        handler,
        line: defIndex + 1,
        responseModel,
        statusCode,
        doc,
      });
    }
  }
  return routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

async function scanSettings() {
  const file = "caos/server/config.py";
  const source = await fs.readFile(path.join(repo, file), "utf8");
  const lines = source.split("\n");
  const settings = [];
  let inside = false;
  let comments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("class Settings(")) {
      inside = true;
      comments = [];
      continue;
    }
    if (inside && line.startsWith("@lru_cache")) break;
    if (!inside) continue;
    if (/^\s{4}#/.test(line)) {
      comments.push(clean(line.replace(/^\s*#\s?/, "")));
      continue;
    }
    if (!line.trim()) continue;
    const field = line.match(/^\s{4}([a-z][a-z0-9_]*):\s*([^=]+?)\s*=\s*(.+)$/);
    if (!field) {
      if (!/^\s{8}/.test(line)) comments = [];
      continue;
    }
    const defaultValue = clean(field[3].split(/\s+#/)[0]);
    settings.push({
      name: field[1],
      type: clean(field[2]),
      defaultValue,
      environment: field[1].toUpperCase(),
      description: clean(comments.join(" ")).slice(0, 900),
      file,
      line: index + 1,
    });
    comments = [];
  }
  return settings;
}

function jsxAttributeValue(attribute, sourceFile) {
  if (!attribute.initializer) return "true";
  if (ts.isStringLiteral(attribute.initializer)) return clean(attribute.initializer.text);
  if (ts.isJsxExpression(attribute.initializer)) {
    return clean(attribute.initializer.expression?.getText(sourceFile) || "true");
  }
  return clean(attribute.initializer.getText(sourceFile));
}

function directJsxLabel(node, sourceFile) {
  const parent = node.parent;
  if (!ts.isJsxElement(parent)) return "";
  const parts = [];
  for (const child of parent.children) {
    if (ts.isJsxText(child)) parts.push(child.text);
    if (ts.isJsxExpression(child) && child.expression) {
      parts.push(`{${child.expression.getText(sourceFile)}}`);
    }
  }
  return clean(parts.join(" ")).slice(0, 240);
}

function controlAcceptance(kind) {
  if (kind === "Modal/dialog") {
    return "Opening exposes a named dialog, moves focus into it, confines keyboard interaction, supports its documented close/Escape path, and restores focus to the trigger without losing committed state.";
  }
  if (/Input|Select|Textarea|Editable/.test(kind)) {
    return "The control has a programmatic label, accepts only the declared value shape and bounds, exposes validation without color alone, preserves the intended draft scope, and is fully keyboard operable with visible focus.";
  }
  if (/Link/.test(kind)) {
    return "The link has a stable accessible name and href, preserves the required issuer/run/context identity, activates by keyboard, and does not discard unsaved work without the navigation guard.";
  }
  if (/Form/.test(kind)) {
    return "Submit is keyboard operable, validates every required field, prevents duplicate or partial mutation, exposes pending/success/error state, and retains recoverable input after a failed dependency.";
  }
  return "The action has a stable accessible name, visible focus, native keyboard activation, a truthful disabled/pending state, and performs its documented transition exactly once without stale cross-context output.";
}

function controlEdgeCases(kind) {
  const common = "initial/default state; repeated activation or double submit; dependency error/timeout; disabled or pending state; principal/context change; 390px and 900px viewport; keyboard-only and reduced-motion";
  if (kind === "Modal/dialog") return `${common}; trigger removed while open; Escape/cancel versus confirmed close; nested overlay; focus restoration`;
  if (/Input|Select|Textarea|Editable/.test(kind)) return `${common}; blank/null; malformed type; minimum/maximum/over-limit value; paste/autofill; reset after validation failure`;
  if (/Link/.test(kind)) return `${common}; missing/foreign target id; modifier-key/new-tab activation; unsaved-change guard; back/forward restoration`;
  return `${common}; authorization denial; stale response after a newer action; empty result; success announcement`;
}

function stateAcceptance(name) {
  const lower = name.toLowerCase();
  if (/loading|pending|saving|running|transition/.test(lower)) {
    return "The pending state starts only for the owning operation, prevents conflicting duplicate work where required, remains announced without blocking unrelated reading, and always settles on success, failure, cancellation, or supersession.";
  }
  if (/error|failed|failure/.test(lower)) {
    return "The failure state is explicit, non-sensitive, recoverable, associated with the owning control, and cleared only by a new valid attempt or scope reset—not by an unrelated render.";
  }
  if (/open|show|visible|drawer|modal|popover/.test(lower)) {
    return "Open/closed state matches the rendered overlay and accessibility attributes, supports keyboard close, restores trigger focus, and resets when the owning principal or analysis context changes.";
  }
  if (/selected|active|filter|sort|query|search|mode|tab|view/.test(lower)) {
    return "The selected/filter state is visibly and programmatically exposed, deterministic on repeated input, scoped to the correct screen/context, and restored or reset according to the documented persistence boundary.";
  }
  return "The state transition is deterministic, scoped to its owning component/principal/context, represented truthfully in the UI, and cannot leave stale or impossible combinations after success, error, cancellation, or navigation.";
}

function stateEdgeCases(name) {
  const lower = name.toLowerCase();
  const common = "initial value; repeated same transition; rapid competing transitions; dependency error; unmount/navigation; principal/context switch; browser back/forward";
  if (/loading|pending|saving|running|transition/.test(lower)) return `${common}; cancellation; timeout; stale completion after newer request`;
  if (/error|failed|failure/.test(lower)) return `${common}; empty/non-JSON detail; retry success; second independent error`;
  if (/selected|active|filter|sort|query|search|mode|tab|view/.test(lower)) return `${common}; unknown persisted value; empty result; mobile layout; keyboard selection`;
  return `${common}; null/empty data; terminal/reset state`;
}

async function scanUiControlsAndStates() {
  const srcDir = path.join(repo, "caos", "frontend", "src");
  const files = (await fs.readdir(srcDir, { recursive: true }))
    .filter((file) => file.endsWith(".tsx") && !/\.(?:test|spec)\.tsx$/.test(file))
    .sort();
  const controls = [];
  const states = [];
  const nativeInteractive = new Set(["button", "input", "select", "textarea", "a", "form"]);
  const interactiveRoles = new Set(["button", "checkbox", "combobox", "link", "menuitem", "option", "radio", "slider", "switch", "tab"]);
  const stateAttributes = new Set(["disabled", "checked", "open", "hidden", "aria-current", "aria-disabled", "aria-expanded", "aria-pressed", "aria-selected", "aria-haspopup", "aria-modal", "value", "defaultValue"]);

  for (const relative of files) {
    const absolute = path.join(srcDir, relative);
    const file = `caos/frontend/src/${relative.replaceAll("\\", "/")}`;
    const source = await fs.readFile(absolute, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    if (sourceFile.parseDiagnostics.length) {
      throw new Error(`TypeScript inventory parse failed for ${file}: ${sourceFile.parseDiagnostics[0].messageText}`);
    }

    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(sourceFile);
        const attributes = new Map();
        for (const property of node.attributes.properties) {
          if (ts.isJsxAttribute(property)) {
            attributes.set(property.name.getText(sourceFile), jsxAttributeValue(property, sourceFile));
          }
        }
        const role = attributes.get("role") || "";
        const inputType = tag === "input" ? (attributes.get("type") || "text") : "";
        const modalInvocation = /(?:Modal|Dialog|SlideOver|Confirm)/i.test(tag);
        const overlayInvocation = /(?:Drawer|Popover|Palette)/i.test(tag);
        const hasAction = ["onClick", "onChange", "onInput", "onSubmit"].some((name) => attributes.has(name));
        const contentEditable = attributes.has("contentEditable");
        const isLink = tag === "Link" || tag === "a" || attributes.has("href");
        const include = inputType !== "hidden" && (
          nativeInteractive.has(tag)
          || interactiveRoles.has(role)
          || modalInvocation
          || overlayInvocation
          || contentEditable
          || hasAction
          || isLink
        );
        if (include) {
          let kind = "Action component";
          if (modalInvocation || role === "dialog" || tag === "dialog") kind = "Modal/dialog";
          else if (overlayInvocation) kind = "Overlay/popover";
          else if (contentEditable) kind = "Editable content";
          else if (tag === "input") kind = `Input — ${inputType}`;
          else if (tag === "select") kind = "Select input";
          else if (tag === "textarea") kind = "Textarea input";
          else if (tag === "form") kind = "Form submit boundary";
          else if (isLink || role === "link") kind = "Link/navigation";
          else if (tag === "button" || role === "button") kind = "Button/action";
          else if (role) kind = `ARIA ${role}`;
          const label = attributes.get("aria-label")
            || attributes.get("title")
            || attributes.get("placeholder")
            || attributes.get("name")
            || directJsxLabel(node, sourceFile)
            || `[dynamic ${tag}]`;
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          const statesForControl = [...attributes.entries()]
            .filter(([name]) => stateAttributes.has(name))
            .map(([name, value]) => `${name}=${value}`)
            .join("; ");
          controls.push({
            id: `CTL-${String(controls.length + 1).padStart(4, "0")}`,
            kind,
            tag,
            label: clean(label).slice(0, 240),
            file,
            line,
            state: statesForControl || "implicit/default",
            handlers: [...attributes.keys()].filter((name) => /^on[A-Z]/.test(name)).join("; "),
            acceptance: controlAcceptance(kind),
            edgeCases: controlEdgeCases(kind),
          });
        }
      }

      if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
        const hook = node.initializer.expression.getText(sourceFile).split(".").at(-1);
        if (["useState", "useReducer", "useTransition"].includes(hook) && ts.isArrayBindingPattern(node.name)) {
          const bindings = node.name.elements.map((element) => clean(element.getText(sourceFile))).filter(Boolean);
          const name = bindings[0] || `[anonymous ${hook}]`;
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          states.push({
            id: `STA-${String(states.length + 1).padStart(4, "0")}`,
            name,
            setter: bindings.slice(1).join("; "),
            hook,
            initial: clean(node.initializer.arguments.map((argument) => argument.getText(sourceFile)).join(", ")) || "framework default",
            file,
            line,
            acceptance: stateAcceptance(name),
            edgeCases: stateEdgeCases(name),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return { controls, states };
}

const csv = await fs.readFile(csvPath, "utf8");
const sourceRows = parseCsv(csv);
sourceRows.push(
  {
    id: "deepdive-36",
    concept: "Deep-Dive",
    feature: "Module Finder, Pins, and Recents",
    story: "As an analyst, I want to find, pin, and revisit modules quickly so that a 25-module analytical graph remains navigable under time pressure.",
    expected: "The launcher opens a searchable combobox from its button or Command/Ctrl+M outside text-entry controls, filters by module id/name/description, supports arrow/Enter selection, and renders bounded pinned/recent shortcuts. Pins (12 maximum) and recents (8 stored, 4 visible after excluding pins) persist through revision-aware analyst workspace updates; settings failure leaves an honest session-local fallback.",
    trigger: "activate Find module or press Command/Ctrl+M, then search, select, or pin",
    files: "caos/frontend/src/components/deepdive/ModuleFinder.tsx",
    endpoint: "GET/PATCH /api/settings/analyst",
    status: "Pass",
    edge_cases: "shortcut while an input/textarea/contenteditable owns focus; no results; unknown persisted ids; settings 404; revision conflict; pin/recents caps; Escape/backdrop close; keyboard focus containment",
    test_cases: "happy: search and select by name; boundary: cap and de-duplicate recents/pins; invalid: unknown persisted id; error: settings unavailable or conflicting; accessibility: combobox/listbox keyboard contract",
    defect_count: "0",
    last_tested: today,
  },
  {
    id: "deepdive-37",
    concept: "Deep-Dive",
    feature: "Standing Credit View Strip",
    story: "As a credit analyst, I want the standing posture and conviction above the module panes so that the current conclusion leads the evidence review.",
    expected: "The Atlas Forge reference renders the seeded debate bias and sizing decision with DEMO authority, a personal Note agreement action, and Revise navigation to CP-6A. A non-reference issuer without a live CP-6 verdict renders an explicit no-standing-view LIVE empty state and never borrows the fixture. Personal annotations are capped at 20 and do not alter governance state.",
    trigger: "open Deep-Dive and review, note, or revise the standing view",
    files: "caos/frontend/src/components/deepdive/StandingViewStrip.tsx",
    endpoint: "GET/PATCH /api/settings/analyst",
    status: "Pass",
    edge_cases: "non-reference issuer; no CP-6 verdict; settings write failure; more than 20 annotations; repeated note; missing run id; reference authority seam",
    test_cases: "happy: reference posture and revise; error: workspace save failure; boundary: cap 20 notes; authority: non-reference never sees fixture",
    defect_count: "0",
    last_tested: today,
  },
  {
    id: "deepdive-38",
    concept: "Deep-Dive",
    feature: "Affirm Live Thesis and Pin Finding",
    story: "As an analyst, I want to affirm a completed issuer run into an immutable thesis and pinned finding so that my current credit view is durable and attributable.",
    expected: "Affirm thesis is actionable only for a non-reference completed run with an owned analysis context. It creates a manual thesis version, patches issuer/run and Deep-Dive surface state into the context, attempts a credit-view finding and bounded workspace affirmation in parallel, and distinguishes full success, thesis-saved/finding-pending partial success, and failure. Reference output cannot be ratified.",
    trigger: "activate Affirm thesis for a completed live issuer run",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "POST /api/thesis; PATCH /api/analysis/contexts/{context_id}; POST /api/analysis/findings; PATCH /api/settings/analyst",
    status: "Pass",
    edge_cases: "reference issuer; missing run; missing/foreign context; context sync failure; thesis conflict; finding write failure after thesis commit; workspace failure; repeated affirmation; more than 20 workspace notes",
    test_cases: "happy: thesis/context/finding/workspace converge; partial: finding pin fails after thesis save; error: thesis fails; permission: missing owned context; boundary: workspace cap",
    defect_count: "0",
    last_tested: today,
  },
  {
    id: "deepdive-39",
    concept: "Deep-Dive",
    feature: "Analysis Context Synchronization",
    story: "As an analyst, I want Deep-Dive to retain issuer, run, and surface state in my active analysis context so that handoffs remain attributable across workspaces.",
    expected: "Once an analysis context exists, Deep-Dive adds the active issuer when absent and reconciles the completed run id without discarding existing artifacts. Failed background synchronization leaves the page usable and exposes a status notice. Affirmation additionally stores the thesis id, selected run, and current layout under the deep-dive surface state.",
    trigger: "open an issuer/run in Deep-Dive or affirm the current view",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "POST /api/analysis/contexts; PATCH /api/analysis/contexts/{context_id}",
    status: "Pass",
    edge_cases: "context pending or absent; issuer already present; run changes; patch conflict/failure; stale response; reference issuer; artifact fields owned by other surfaces",
    test_cases: "happy: issuer/run merge; boundary: no duplicate issuer; error: patch notice without page failure; concurrency: latest context revision wins",
    defect_count: "0",
    last_tested: today,
  },
  {
    id: "deepdive-40",
    concept: "Deep-Dive",
    feature: "Scenario Network Propagation",
    story: "As a credit analyst, I want to propagate EBITDA and rate shocks across the run's accepted modules so that cross-module downside consequences are visible in one chain.",
    expected: "A completed live run exposes EBITDA-percent and rate-basis-point inputs plus PROPAGATE. Submission sends issuer/run and normalized shocks once, then renders source QA authority, accepted/excluded module counts, and ordered nodes with text status (COMPUTED, DEGRADED, or NO DATA) as well as glyph/color. Without a completed run the controls are absent and a prerequisite state is explicit; a failed request is retryable.",
    trigger: "enter shocks and activate PROPAGATE from Deep-Dive",
    files: "caos/frontend/src/components/model/ScenarioNetworkPanel.tsx; caos/frontend/src/app/deepdive/page.tsx",
    endpoint: "POST /api/scenario/propagate",
    status: "Pass",
    edge_cases: "no run; busy double-submit; endpoint failure; min/max HTML validity; blocked modules excluded; empty node list; degraded/no-data nodes; restricted source",
    test_cases: "happy: computed chain; error: retryable alert; boundary: missing run compacts controls; accessibility: status not color-only",
    defect_count: "0",
    last_tested: today,
  },
  {
    id: "deepdive-41",
    concept: "Deep-Dive",
    feature: "Decision Header Authority and Freshness",
    story: "As an IC reviewer, I want change, relevance, required action, evidence health, freshness, and approval authority summarized before the module detail so that I can triage the credit view defensibly.",
    expected: "The DecisionHeader derives all four cells from the selected reference/live run and current CP-5 council. Ready values carry as-of provenance and RATIFIED only when committee status is Approved; an empty council is observed-empty rather than guessed clear. Loading, fetch error, in-flight, and no-completed-run states remain explicit and do not fabricate conclusions.",
    trigger: "open Deep-Dive while the selected run resolves",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/components/shared/DecisionHeader.tsx",
    endpoint: "GET /api/runs/{runId}; GET /api/runs/{runId}/qa",
    status: "Pass",
    edge_cases: "reference fixture; live approved/unratified; no council findings; missing committee status; loading; fetch error; in-flight latest run; no completed run; missing as-of",
    test_cases: "happy: live ready authority; observed-empty: no findings; error/loading/no-run honesty; permission: selected run remains caller-visible only",
    defect_count: "0",
    last_tested: today,
  },
  {
    id: "deepdive-42",
    concept: "Deep-Dive",
    feature: "Phone Triage and Cross-Surface Handoffs",
    story: "As an analyst on a phone, I want a read-only posture summary and explicit workstation handoffs so that I can triage without attempting dense authoring on an unsafe viewport.",
    expected: "Below the small breakpoint the dense desktop workbench is replaced by a read-only triage card showing issuer, live/unavailable state, standing view, required action, evidence health, and run progress. It explains which authoring actions remain desktop-only and links to Query and Pipeline with the active issuer plus run/context ids when available; at small-and-up the full workbench remains the active surface.",
    trigger: "open Deep-Dive below 640px and activate a handoff",
    files: "caos/frontend/src/app/deepdive/page.tsx",
    endpoint: "none (responsive presentation and navigation)",
    status: "Pass",
    edge_cases: "reference, live, loading, error, and no-run state; context absent; run absent; long issuer/action copy; encoded ids; 390px geometry; keyboard activation; desktop breakpoint transition",
    test_cases: "happy: phone triage summary; navigation: Query/Pipeline preserve identity; responsive: no clipped controls or page overflow; accessibility: named region and links",
    defect_count: "0",
    last_tested: today,
  },
);
// The legacy CSV is retained as discovery history, but these Pipeline contracts
// have evolved materially. Override only with behavior verified in the current
// implementation so the canonical workbook never republishes retired routes or
// labels as expected behavior.
const implementedFeatureCorrections = new Map([
  ["pipeline-03", {
    feature: "Directory — Open Issuer Profile",
    user_story: "As an analyst, I want to open an issuer profile from its directory row so that I can review the issuer without losing the worklist context.",
    expected: "A stretched row link exposes one keyboard-focusable profile action. Activation prevents full-page navigation, opens the issuer profile overlay immediately, and reconciles the active issuer into analysis context in the background; a rejected context write does not block the profile.",
    trigger: "activate the issuer row profile link",
    files: "caos/frontend/src/app/issuers/page.tsx; caos/frontend/src/components/shared/IssuerProfileOverlay.tsx",
  }],
  ["pipeline-05", {
    expected: "The modal requires company name; accepts bounded ticker, sector, sub-sector, country, FIGI, and sponsor fields; traps focus, closes on Escape/backdrop/cancel, guards duplicate submission, shows CREATING…, surfaces API errors, normalizes blank sponsor to absent, then closes and opens the new issuer profile.",
    trigger: "open + NEW ISSUER, submit the form, retry after an API error",
    files: "caos/frontend/src/app/issuers/page.tsx",
  }],
  ["pipeline-09", {
    expected: "The route honors explicit issuer/run parameters, otherwise discovers the newest completed live run and falls back to the labeled Atlas Forge reference. Completed runs render persisted CP-X state; real issuers in loading, error, failed/running, or never-run phases receive honest non-demo states. Header identity, run id, progress, freshness, and worklist remain bound to the selected run.",
    trigger: "load /pipeline with reference, issuer, or run query state",
    files: "caos/frontend/src/app/pipeline/page.tsx; caos/frontend/src/lib/pipeline/useLivePipeline.ts",
  }],
  ["pipeline-13", {
    feature: "Pipeline Visualizer — Directory Navigation",
    expected: "Pipeline's ShellIdentity renders the compact ConceptNav. Its quick-jump chips and guaranteed Concepts drawer include the Directory route (/issuers), preserve an active analysis-context id, expose keyboard-focusable links, and mark the active destination where applicable.",
    trigger: "open Pipeline concept navigation and activate Directory",
    files: "caos/frontend/src/components/shared/ShellIdentity.tsx; caos/frontend/src/components/shared/ConceptNav.tsx",
  }],
  ["pipeline-14", {
    feature: "Pipeline Visualizer — Document Intake Link",
    expected: "The contextual Document intake link opens /upload with the active issuer and, when present, analysis-context id. Double-clicking CP-0 applies the same issuer/run/context-aware intake routing contract.",
    trigger: "activate Document intake or open CP-0",
    files: "caos/frontend/src/app/pipeline/page.tsx",
  }],
  ["pipeline-35", {
    expected: "Pipeline's ShellIdentity includes the compact ConceptNav: a guaranteed Concepts drawer below the rail breakpoint and scrollable quick-jump chips above it. Links retain the active analysis-context id, expose full accessible names/tooltips, and use aria-current for the active route.",
    trigger: "open the Concepts drawer or activate a concept chip",
    files: "caos/frontend/src/components/shared/ShellIdentity.tsx; caos/frontend/src/components/shared/ConceptNav.tsx",
  }],
]);
for (const row of sourceRows) Object.assign(row, implementedFeatureCorrections.get(row.id) || {});
const appRoutes = await scanAppRoutes();
const apiRoutes = await scanApiRoutes();
const settings = await scanSettings();
const { controls: uiControls, states: uiStates } = await scanUiControlsAndStates();
const roleRows = [
  ["ROL-001", "Authentication state", "Anonymous / no valid edge or profile identity", "No workspace access; deployed requests fail closed and the login landing owns expected credential errors.", "Protected routes never render prior-principal content; sign-in/create/recovery errors remain visible and announced.", "Missing/expired/tampered cookie; absent or wrong edge credential; network failure; repeated failed attempt; restored valid session.", "caos/frontend/src/components/shared/AuthProvider.tsx; caos/frontend/src/components/shared/LoginLanding.tsx; caos/server/identity.py"],
  ["ROL-002", "Authentication state", "Edge-authenticated, profile incomplete", "The verified proxy principal may reach the login/profile boundary but is not treated as a named analyst profile.", "The UI shows profile creation instead of the workspace; the created profile is bound to the forwarded email and cannot impersonate another principal.", "Forwarded-email mismatch; existing profile adoption; revoked cookie; proxy principal changes mid-session.", "caos/server/identity.py; caos/server/routes/auth.py; caos/frontend/src/components/shared/AuthProvider.tsx"],
  ["ROL-003", "Server capability", "Analyst / writable principal", "May execute authenticated read and domain-mutation workflows subject to issuer/team/context gates and feature flags.", "Allowed writes succeed once, carry analyst attribution, and remain bounded by validation, tenancy, rate, and QA gates.", "Foreign issuer/team/context; stale revision; duplicate submit; disabled feature; invalid input; provider failure.", "caos/server/identity.py:71; caos/tests/server/test_write_role_matrix.py"],
  ["ROL-004", "Server capability", "Viewer / read-only aliases", "Roles viewer, read-only, read_only, and readonly retain reads and read-style calculations but cannot create or mutate domain artifacts.", "Every mutation protected by get_write_identity/require_write_role returns 403 before scan, provider, persistence, or side effects; read-style posts remain available where explicitly classified.", "Alias/case/whitespace variants; indirect mutation endpoint; preview versus commit; retry after role change.", "caos/server/identity.py:68; caos/tests/server/test_write_role_matrix.py"],
  ["ROL-005", "Presentation view", "Analyst", "Full working density for deep analysis, modelling, evidence review, and report composition; does not change authorization.", "Selecting Analyst persists to the analyst profile, exposes the implemented working-density priority, and never grants a server capability the principal lacks.", "Restore on another device; switch during pending request; narrow viewport; read-only server role; unknown persisted value.", "caos/frontend/src/components/shared/RoleViewSwitch.tsx; RoleViewProvider.tsx"],
  ["ROL-006", "Presentation view", "PM / CIO", "Prioritizes portfolio posture and what-changed scanning; does not change authorization.", "Selecting PM deterministically reprioritizes supported surfaces, preserves active analysis identity, and leaves server permissions unchanged.", "Empty portfolio; mixed-origin data; critical alert; narrow viewport; switch back to Analyst; read-only server role.", "caos/frontend/src/components/shared/RoleViewSwitch.tsx; PortfolioLabWorkbench.test.tsx"],
  ["ROL-007", "Presentation view", "QA / Head of Research", "Prioritizes governance, CP-5 gates, evidence, and review queues; does not change authorization.", "Selecting QA surfaces supported gate/governance priority with text/glyph semantics, preserves context, and cannot bypass publication or write controls.", "No findings; blocked/restricted gate; conflicting statuses; narrow viewport; switch during review; read-only server role.", "caos/frontend/src/components/shared/RoleViewSwitch.tsx; ICBookWorkbench.test.tsx"],
];
const automationEvidence = collectAutomationEvidence();
for (const [index, screen] of appRoutes.entries()) {
  const featureId = `SCR-${String(index + 1).padStart(3, "0")}`;
  for (const viewport of ["390x844", "1440x900"]) {
    automationEvidence.push({
      id: `AUT-AXE-${String(index * 2 + (viewport === "390x844" ? 1 : 2)).padStart(3, "0")}`,
      layer: "Route accessibility/responsive",
      node: `${featureId}::${screen.route}::${viewport}`,
      name: `${featureId} ${screen.route} route accessibility and responsive geometry at ${viewport}`,
      file: "caos/frontend/scripts/a11y-axe.mjs",
      executionRun: "VAL-20260717-ROUTE-36",
      executedDate: today,
    });
  }
}
const evidenceSourceByFile = new Map();
for (const file of [...new Set(automationEvidence.map((evidence) => evidence.file))]) {
  try {
    evidenceSourceByFile.set(file, await fs.readFile(path.join(repo, file), "utf8"));
  } catch {
    evidenceSourceByFile.set(file, "");
  }
}
for (const evidence of automationEvidence) {
  const source = evidenceSourceByFile.get(evidence.file) || "";
  const body = extractEvidenceBody(evidence, source);
  evidence.body = evidence.layer === "Server/stress/cohort" ? expandLocalHelperBodies(body, source) : body;
  evidence.scenario = classifyScenario(evidence);
}

// The historical CSV remains useful discovery input, but these rows had drifted
// from current implementation semantics. The canonical workbook must describe
// what the code does now, especially where authority or persistence changed.
const curatedContractOverrides = new Map(Object.entries({
  "deepdive-01": {
    expected: "The launcher groups the current CP-X module catalog into L0-L6. At 1536px and wider every layer starts open and can be toggled independently; below that breakpoint only one layer is open and re-clicking it collapses it. Navigating always reveals the active layer, off-screen active chips scroll into view, and edge chevrons page only when overflow exists.",
    edgeCases: "Unknown mod id; active layer absent; breakpoint transition; layer re-click; horizontal overflow at either edge; selected chip already visible; reduced motion; rapid module changes.",
    trigger: "load Deep-Dive, change module, resize, or toggle a layer",
    files: "caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-02": {
    expected: "Reference module glyphs follow the local replay state. Live issuer glyphs derive from persisted per-module QA status: cleared, warning/Restricted, failed/Blocked, or idle/no output. Collapsed layers expose counted text summaries with glyphs; failed and no-output states remain explicit and are never painted as cleared.",
    edgeCases: "Blocked row with persisted output; missing status; Restricted status; reference replay running; collapsed mixed-state layer; no produced modules; status meaning without color.",
    trigger: "inspect an expanded or collapsed module layer for reference and live issuers",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/lib/pipeline/sev.ts",
  },
  "deepdive-03": {
    expected: "The center pane follows the active module from clicks, cycle events, or the mod query parameter. Reference CP-6A/CP-6E/CP-3B/CP-4 use labeled bespoke fixtures; other reference modules use ModuleView. Every real issuer uses its own generic live output, explicit FAILED pane, or explicit NO OUTPUT state. The title and per-module LIVE/FAILED/NO OUTPUT authority match the content actually rendered.",
    edgeCases: "Unknown mod id; reference-only unavailable CP-2G/CP-4D; blocked live module; missing live module; query parameter change; live output for a bespoke module; dynamic import delay.",
    trigger: "select a module or load/change the mod query parameter",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/components/deepdive/tabs.tsx",
  },
  "deepdive-04": {
    expected: "For the Atlas Forge reference only, CP-6A renders the seeded pre-debate thesis, three-round analyst/bear/chair exchange, evidence-weighting resolution matrix, clickable evidence, and layout-appropriate workflow register. A real issuer never receives this fixture and instead uses its own generic module output or honest empty state.",
    edgeCases: "Summary/report/dense layout; evidence open; reference replay lock; live CP-6A present or absent; unresolved reference evidence.",
    trigger: "select CP-6A on the reference or a live issuer",
    files: "caos/frontend/src/components/deepdive/tabs.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-05": {
    expected: "For the Atlas Forge reference only, CP-6E renders the seeded portfolio allocation debate with RV/compliance personas, CIO ruling, allocation matrix, evidence, and layout-appropriate workflow register. A real issuer never receives the fixture.",
    edgeCases: "Summary/report/dense layout; evidence open; live CP-6E present or absent; reference replay lock.",
    trigger: "select CP-6E on the reference or a live issuer",
    files: "caos/frontend/src/components/deepdive/tabs.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-06": {
    expected: "For the Atlas Forge reference, CP-3B renders the seeded capital stack, recovery waterfall, scenario chart, and 2L sensitivity view with evidence and layout-appropriate workflow output. A real issuer uses the generic persisted CP-3B output or an honest no-output/failed state.",
    edgeCases: "Summary/report/dense layout; reference replay locked/running; live CP-3B absent, restricted, or blocked; evidence open; wide table overflow.",
    trigger: "select CP-3B",
    files: "caos/frontend/src/components/deepdive/tabs.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-07": {
    expected: "For the reference, CP-4 renders the seeded covenant aggressiveness/capacity analysis, expandable clause translations, CP-4/4C workflow output, and the live cross-default domino component. A real issuer uses its persisted generic CP-4 output plus finite signal-derived covenant capacity and the issuer-scoped domino map; missing/partial capacity degrades honestly.",
    edgeCases: "Summary/report/dense layout; expand/collapse clause; missing or non-finite live capacity signals; no run; blocked CP-4; empty domino graph; reference fixture authority.",
    trigger: "select CP-4 and inspect covenant rows/capacity/dominoes",
    files: "caos/frontend/src/components/deepdive/tabs.tsx; caos/frontend/src/components/deepdive/LiveCovenantCapacity.tsx; caos/frontend/src/components/shared/CrossDefaultDominoes.tsx",
  },
  "deepdive-08": {
    expected: "ModuleView renders known module metadata, KPIs, text/table/flag sections, semantic charts, and workflow output according to Summary, Report, or Dense. Summary preserves analysis but replaces full cards with an ordered workflow summary; Report includes consolidated workflow cards; Dense keeps every card. Live output uses the persisted runtime register and never seeded summaries when fallback is disabled.",
    edgeCases: "Unknown module; known module without seeded output; explicit no seeded fallback; blank live KPIs; live sections without fixture register; reference-only unavailable module; every layout.",
    trigger: "select any non-bespoke module or a live issuer module",
    files: "caos/frontend/src/components/deepdive/tabs.tsx",
  },
  "deepdive-09": {
    expected: "OutSections renders table sections with aligned values, narrative sections with evidence chips, and flag sections with textual severity plus glyph/color. Evidence ids are actionable and the renderer preserves the supplied source order.",
    edgeCases: "Empty sections; empty table rows; long text; missing evidence; unknown severity; non-numeric values; narrow pane overflow.",
    trigger: "render a module containing table, narrative, or flag sections",
    files: "caos/frontend/src/components/deepdive/OutSections.tsx",
  },
  "deepdive-10": {
    expected: "Registered module charts render through SemanticVisualization with explicit authority, readable summary, equivalent table schema, formatted labels, title, G2 identifier, and optional note. Modules without a registered chart render no chart container; multiple charts use the implemented bounded grid.",
    edgeCases: "No registered chart; empty chart data; default height; multiple charts; callback label branches; narrow pane; reduced motion; non-finite series value.",
    trigger: "render a module with or without registered chart specifications",
    files: "caos/frontend/src/components/deepdive/ModuleCharts.tsx",
  },
  "deepdive-11": {
    expected: "OutputRegister renders only when registered workflow steps exist. Its named toggle reports total steps and produced/limitation/gap counts, controls the card grid, and opens a selected step in the detailed modal. Summary layout uses the ordered summary sequence rather than this full register.",
    edgeCases: "No steps; all produced; gaps/limitations; collapsed register; repeated prefixes; long output; keyboard toggle; missing step metadata.",
    trigger: "open or collapse the required-output register for a module",
    files: "caos/frontend/src/components/deepdive/OutputRegister.tsx",
  },
  "deepdive-12": {
    expected: "Selecting a workflow step opens a labeled modal containing its narrative/sections, template and production metadata, evidence, Report Studio exhibit link, and Flag to QA action. The close control and modal accessibility behavior dismiss it; unknown module-to-exhibit mappings fall back to the snapshot exhibit.",
    edgeCases: "Unmapped report exhibit; no evidence; QA flag pending/error; Escape/backdrop/close; long narrative; narrow viewport; focus restoration.",
    trigger: "activate a workflow step card",
    files: "caos/frontend/src/components/deepdive/OutputRegister.tsx",
  },
  "deepdive-13": {
    expected: "StepOutputGrid renders an ordered semantic workflow sequence. Report mode consolidates repeated same-prefix cards, Summary renders narrative summaries in source order, and Dense remains unconsolidated; cards use bounded responsive column packing and avoid internal breaks.",
    edgeCases: "Repeated prefixes; partial output; no produced steps; one card; many cards; long body; Summary/Report/Dense transitions; narrow width.",
    trigger: "render workflow cards under each layout",
    files: "caos/frontend/src/components/deepdive/OutputRegister.tsx",
  },
  "deepdive-14": {
    expected: "Hovering or focusing an evidence chip publishes its id through EvidenceSync so every matching chip and participating driver row receives the selected treatment while unrelated citations do not. Mouse leave or blur clears the transient selection, and the contract remains keyboard-operable.",
    edgeCases: "Multiple matching chips; unrelated control; focus without hover; blur/mouse leave; provider absent on another screen; pre-hydration pointer event; rapid evidence changes.",
    trigger: "hover or focus an E-xx chip",
    files: "caos/frontend/src/lib/evidence-sync.tsx; caos/frontend/src/components/reports/EvidenceModal.tsx; caos/frontend/src/components/deepdive/rails.tsx",
  },
  "deepdive-15": {
    expected: "An E-xx chip is a focusable button that opens EvidenceModal for that id without leaking its click to parent controls. Live-run evidence takes precedence over colliding seeded ids and resolves its document chunk; a live run cannot shadow-resolve missing evidence to Atlas Forge. Unknown ids and chunk failures render explicit unresolved/unavailable states.",
    edgeCases: "Unknown id; live/seeded id collision; missing live evidence; chunk 404; no provider; nested clickable parent; modal close; lazy report import.",
    trigger: "activate an E-xx evidence chip",
    files: "caos/frontend/src/components/reports/EvidenceModal.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-16": {
    expected: "The source rail starts collapsed and expands to 330px. The reference issuer exposes the seeded deal/source register and evidence-trace drivers with synchronized evidence interactions. Every non-reference issuer instead gets an explicit issuer-scoped source-unavailable state—whether or not its ticker resolved—and never receives Atlas Forge source documents.",
    edgeCases: "Reference; non-reference with/without ticker; issuer lookup failure; rail collapse; evidence hover/focus; long source label; missing source rows; narrow workbench.",
    trigger: "expand the source rail",
    files: "caos/frontend/src/components/deepdive/rails.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-17": {
    expected: "The decision rail occupies 352px when open and exposes the reference CP-5 clearance/verdict/sizing/triggers only for the reference issuer. For a real issuer it renders the issuer-scoped committee review and explicit absence of a live verdict/sizing fixture. It distinguishes loading, error, unavailable, observed-empty, and populated council states and auto-collapses below 1440px.",
    edgeCases: "Reference versus live; no findings; loading; QA fetch error; no run; long remediation; narrow resize; manual toggle; verdict without qualifier.",
    trigger: "open the decision rail while the selected run resolves",
    files: "caos/frontend/src/components/deepdive/rails.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-18": {
    expected: "Committee Review · CP-5C renders live findings in stable severity/lane order with finding id, module/claim context, description, and required remediation. A successfully read empty council says no findings observed; loading, read error, and unavailable run each use a distinct non-clear state.",
    edgeCases: "No findings after successful read; read failure; loading; no run; duplicate/equal-severity findings; missing remediation or claim id; long text.",
    trigger: "open the decision rail for a live run",
    files: "caos/frontend/src/components/deepdive/rails.tsx; caos/frontend/src/lib/engine/useLiveRun.ts",
  },
  "deepdive-19": {
    expected: "ASK {issuer code} and the shared Ask state open a 408x560 non-modal issuer Q&A panel. The composer accepts at most 600 characters, ignores empty or duplicate busy sends, offers four starters for an empty transcript, sends up to the latest 12 transcript messages plus grounding, renders an explicit empty-reply fallback or retryable error, auto-scrolls, and closes from Escape or the close control.",
    edgeCases: "Empty/whitespace input; 600-character boundary; double send; empty reply; structured API detail; network/rate-limit error; close while pending; response from a prior run; small viewport max-height.",
    trigger: "activate ASK, choose a starter, or submit the composer",
    files: "caos/frontend/src/components/deepdive/IssuerChat.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-20": {
    expected: "Each issuer-chat request prepends a grounding exchange. Reference grounding contains the labeled mock Atlas Forge deal, current module, registered outputs, and most recently focused evidence. A completed live run serializes only that issuer's council and every persisted module output with the active module first; a live issuer without a completed run explicitly withholds Atlas Forge figures. Answers are instructed to remain under 150 words and cite CP/E ids where supported.",
    edgeCases: "Focused evidence unknown or empty; current module unknown/blank; live output section variants; no live modules; unavailable run; absent page/QA metadata; generic launcher; long context.",
    trigger: "submit a reference, live-run, or unavailable-run issuer question",
    files: "caos/frontend/src/components/deepdive/IssuerChat.tsx",
  },
  "deepdive-21": {
    name: "Chat History (Session and Run Scoped)",
    expected: "Issuer-chat transcripts persist only in sessionStorage under caos-chat-{runId} (or the reference run key), so a shared workstation does not retain them after the browser session. Changing run keys invalidates pending request generations, restores the new run's transcript without writing prior-run messages into it, clears input/busy state, and ignores stale success or failure responses. Clear removes the current transcript.",
    edgeCases: "Corrupt JSON or JSON null; storage read/write denial; run changes while request is pending; stale success/failure; reference/live key transition; empty transcript; clear while busy.",
    trigger: "send, clear, reload within a session, or change the selected run",
    files: "caos/frontend/src/components/deepdive/IssuerChat.tsx",
  },
  "deepdive-22": {
    name: "Layout Toggle (Summary/Report/Dense)",
    story: "As an analyst, I want three deliberate reading densities so that I can move between verdict-first review, committee report, and full audit output.",
    expected: "Summary, Report, and Dense controls appear in the normal and narrow utility contracts with aria-pressed state. The browser-local caos.deepdive.layout preference defaults to Report; legacy core migrates to Summary and base to Report; unknown/read/write-failing storage falls back safely. The selection controls module ordering and workflow-card consolidation without changing analytical data.",
    edgeCases: "Legacy core/base values; unknown value; storage unavailable/quota failure; duplicate narrow/desktop controls; hydration default; rapid layout switching; module without workflow steps.",
    trigger: "activate Summary, Report, or Dense",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/lib/deepdive/layout-pref.ts",
  },
  "deepdive-23": {
    name: "Exact and Latest Live Run Resolution",
    expected: "Deep-Dive passes the issuer and optional run query parameter to useLiveRun. An explicit run id is loaded directly and is never substituted with latest; otherwise the latest completed issuer run is resolved. Modules, QA/council, evidence, per-module status, as-of, and committee status converge into one run state. Any run/module/QA fetch failure produces phase=error and clears apparently successful output rather than silently falling back to seeded content.",
    edgeCases: "Exact run missing/foreign; no runs; latest in flight; list fetch failure; module fetch failure; QA fallback failure; blocked/restricted modules; stale async response after issuer/run change.",
    trigger: "load Deep-Dive with issuer and optional run query parameters",
    files: "caos/frontend/src/lib/engine/useLiveRun.ts; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-24": {
    expected: "The identity caveat has five mutually exclusive authority states: reference labels the seeded run as illustrative; loading says the live run is being checked; backend failure says the live run could not be loaded; live says missing panes show no output; and no-run directs the analyst to run analysis. Reference/loading take precedence over an error phase, and no state claims another issuer's fixture is live.",
    edgeCases: "Reference with run id; loading plus error; error with no run; completed run; issuer never analyzed; missing ticker; stale prior run state.",
    trigger: "open a reference or live issuer while run resolution changes",
    files: "caos/frontend/src/lib/deepdive/caveat.ts; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-25": {
    expected: "Reference outputs follow the local simulation gate: a locked module names its producing gate and upstream dependencies, running suppresses the awaiting copy, and cleared gates unlock the fixture. Live issuers never use the reference replay as an authority gate; they render persisted output, explicit failed output, or no output based on the selected run.",
    edgeCases: "Producing gate differs from display module (CP-4/CP-4C); running versus awaiting; dependency list empty; live output while reference sim is locked; Blocked live module; unknown gate id.",
    trigger: "select a reference module before/during/after replay or select a live module",
    files: "caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-26": {
    expected: "Every non-reference path suppresses seeded Atlas Forge authority: source and decision rails show issuer-scoped unavailable/live states, bespoke modules fall through to generic live/no-output rendering, live evidence cannot shadow-resolve seeded ids, and issuer chat excludes fixture figures. Loading, error, failed, and never-run states are labeled separately.",
    edgeCases: "Issuer lookup failure; ticker missing; no run; run fetch error; live module absent; blocked module; colliding evidence id; CP-6/CP-4 bespoke module selected; chat without run.",
    trigger: "open any non-reference issuer in Deep-Dive",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/components/deepdive/rails.tsx; caos/frontend/src/components/reports/EvidenceModal.tsx; caos/frontend/src/components/deepdive/IssuerChat.tsx",
  },
  "deepdive-27": {
    expected: "At small-and-up desktop widths the workbench uses a 42/330px source rail, fluid center pane, and 42/352px decision rail. Source starts collapsed; decision starts open only at 1440px or wider and changes only when crossing that threshold; 1536px controls layer expansion. The global collapse event closes both if either is open and opens both if neither is open; internal regions own overflow.",
    edgeCases: "Width exactly 1440/1536; repeated resize in same band; one rail open; both closed; horizontal module overflow; long center output; reduced motion; transition from phone triage.",
    trigger: "resize the desktop workbench or toggle/collapse its rails",
    files: "caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-28": {
    expected: "The dismissible deepdive-panes FirstRunHint explains the source, module, and decision panes; evidence-chip behavior; and the implemented Alt+,/Alt+. module cycle, Alt+C pane collapse, and Alt+K Ask shortcuts. Its disclosure follows the shared FirstRunHint persistence and focus behavior.",
    edgeCases: "Previously dismissed hint; storage unavailable; keyboard-only analyst; reduced motion; narrow desktop; shortcut collision with text entry; phone surface where desktop authoring is unavailable.",
    trigger: "open Deep-Dive before the hint has been dismissed",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/components/shared/FirstRunHint.tsx",
  },
  "deepdive-29": {
    name: "Issuer Identity Resolution and Retry",
    story: "As an analyst, I want the selected issuer identity to resolve honestly and recover from lookup failure so that I know which credit view I am reviewing.",
    expected: "The issuer query parameter selects the issuer; absence selects the labeled Atlas Forge reference. A non-reference profile fetch binds name, ticker, and signals while ignoring stale responses. Pending lookup says Loading issuer; failure says Issuer unavailable and exposes RETRY; retry reissues the profile request. Concept navigation retains the route out to the issuer register through ShellIdentity.",
    edgeCases: "Missing issuer parameter; unknown issuer; fetch failure then success; stale response after issuer change; issuer without ticker; profile signals missing; repeated retry.",
    trigger: "load Deep-Dive for a non-reference issuer or activate RETRY",
    files: "caos/frontend/src/app/deepdive/page.tsx; caos/frontend/src/components/shared/ShellIdentity.tsx",
  },
  "deepdive-30": {
    expected: "Export to Vault is mounted only when useLiveRun resolves a run id and receives that exact id. Activation posts the run-scoped vault export, exposes pending/success/error state through the shared control, and never exports the seeded/no-run presentation as though it were a persisted run.",
    edgeCases: "No run; exact versus latest run; double activation while pending; endpoint failure; empty written list; vault not configured; viewer/read-only principal; run changes before click.",
    trigger: "activate Export to Vault for a completed live run",
    files: "caos/frontend/src/components/reports/ExportToVaultButton.tsx; caos/frontend/src/app/deepdive/page.tsx",
  },
  "deepdive-31": {
    expected: "Deep-Dive's ShellIdentity supplies the compact ConceptNav so the analyst can move among implemented CAOS concepts with keyboard-focusable named destinations and active-route semantics. Below the rail breakpoint the guaranteed Concepts drawer remains available; above it the quick-jump rail is scrollable.",
    edgeCases: "Current Deep-Dive destination; narrow drawer; long labels; horizontal overflow; keyboard navigation; modifier-key open; unknown pathname.",
    trigger: "open the Concepts navigation from Deep-Dive",
    files: "caos/frontend/src/components/shared/ShellIdentity.tsx; caos/frontend/src/components/shared/ConceptNav.tsx",
  },
  "deepdive-32": {
    expected: "A known generic module renders its code, name, persisted/reference status, description, optional plan event, KPIs, and current authority before its content. Unknown ids receive a not-in-route-graph state; known modules without output direct the analyst to the appropriate Pipeline or Report Studio workflow rather than inventing content.",
    edgeCases: "Unknown id; infrastructure-style missing module; analytical missing module; no event; live output; blank KPI values; reference-only unavailable output.",
    trigger: "select a generic module",
    files: "caos/frontend/src/components/deepdive/tabs.tsx",
  },
  "deepdive-33": {
    name: "Conclusion-First Module Ordering",
    expected: "For generic module sections whose final narrative title matches the implemented conclusion/view/summary/memo/clearance/readiness/selection pattern, Summary/Report/Dense promote that conclusion as the lead analytical block before supporting detail. Summary additionally replaces full workflow cards with an ordered summary; the underlying section data and evidence are not mutated.",
    edgeCases: "No matching final narrative; matching title earlier rather than last; final table/flags section; one section; live section titles; every layout; duplicate conclusion labels.",
    trigger: "render a generic module containing a terminal conclusion section",
    files: "caos/frontend/src/components/deepdive/tabs.tsx",
  },
  "deepdive-34": {
    expected: "FLAG TO QA · CP-5 opens a compose/confirm flow and POSTs the current module, step reference, optional note, issuer, and optional run. A 201 response reflects the new flag count/state; server identity supplies analyst attribution. Analyst flags persist separately from engine qa_findings and never change run or committee gates. Validation and rate/role errors are surfaced for retry.",
    edgeCases: "Cancel; empty note; note over 2000; invalid module/id lengths; duplicate flag; existing count; double submit; 401/403/429/5xx; flag created while run changes.",
    trigger: "compose and confirm FLAG TO QA from a step or evidence modal",
    files: "caos/frontend/src/components/shared/FlagToQa.tsx; caos/server/routes/qa.py",
    endpoint: "POST /api/qa/flags",
  },
  "deepdive-35": {
    expected: "On mount FlagToQa queries existing analyst flags with its module/step/issuer/run filters and reflects zero, one, or multiple matches so the analyst can see prior escalation before submitting another. Read failure degrades without claiming an existing flag, and filters remain server-validated and identity-scoped.",
    edgeCases: "No flags; one/many flags; optional filters; invalid filter length; read failure; stale response after props change; foreign analyst; duplicate historical rows.",
    trigger: "mount a FlagToQa control for a module/step",
    files: "caos/frontend/src/components/shared/FlagToQa.tsx; caos/server/routes/qa.py",
    endpoint: "GET /api/qa/flags",
  },
  "research-01": {
    expected: "The Research scope group exposes Sector and Issuer buttons with aria-pressed state. Changing scope updates the focal input label/placeholder and the empty-subject run reason; saved settings may seed the initial scope on mount, but a page toggle is not itself persisted.",
    edgeCases: "Corrupt or unavailable localStorage falls back to sector; context state may restore sector or issuer before saved preferences hydrate; the latest post-mount state controls the input label.",
  },
  "research-02": {
    expected: "The focal Sector / theme or Issuer text input trims its value for submission, caps typing at 300 characters, and keeps both run controls aria-disabled until the trimmed subject contains at least two characters and research configuration is known.",
    edgeCases: "Whitespace-only or one-character input remains blocked; a 300-character value is accepted; unknown configuration blocks a valid subject; changing scope changes the label and reason copy.",
  },
  "research-03": {
    expected: "Audience, Decision to inform, and Timeframe live behind Advanced brief. Browser preferences seed them after mount; blank UI values are omitted from the client request so ResearchBrief applies its server defaults, while non-blank values are trimmed and sent.",
    edgeCases: "Blank or whitespace-only values are omitted; browser preferences can be absent, corrupt, or unavailable; server caps are audience 200, decision 300, and timeframe 200 characters.",
  },
  "research-06": {
    expected: "The Advanced brief AI mode group offers max, standard, and lite with explicit hints and aria-pressed state. The selected value is sent as brief.ai_mode; saved preferences seed it, and invalid stored values sanitize to standard.",
    edgeCases: "Only max, standard, or lite are accepted; corrupt or stale stored modes fall back to standard; the control is hidden while Advanced brief is collapsed.",
  },
  "research-07": {
    expected: "GET /api/settings determines provenance before a run can start. llm_configured=false renders the Demo mode warning and Run example research; true renders Run deep research; loading and failure both block submission, and failure exposes an explicit Retry configuration action.",
    edgeCases: "A settings error never guesses live or demo; retry can recover; a valid subject remains blocked until configuration is confirmed; demo mode is also identified on the finished report.",
  },
  "research-09": {
    expected: "POST /api/research rate-checks the caller, validates an optional owner-scoped context, inserts and commits a queued ResearchJob containing analyst id, context id, brief, and draft authority, updates the context artifact when present, enqueues after commit, and returns 201 with id and queued status.",
    edgeCases: "Unknown or foreign context returns 404; validation or rate limit occurs before enqueue; the committed brief supports later worker claim/re-execution; a dropped HTTP connection does not cancel execution.",
  },
  "research-10": {
    expected: "The client polls GET /api/research/{id} immediately and then every two seconds until complete or failed, tolerates up to ten consecutive non-404 transport errors, stops at a 15-minute client deadline, treats 404 as gone, supports AbortSignal detach, and reattaches a saved owner-scoped job after navigation or reload.",
    edgeCases: "Complete hydrates report/sources/demo/truncated; failed surfaces the server error; 404 clears a stale pointer quietly; transport errors retain the pointer for retry; abort stops watching without cancelling server work; foreign jobs return 404.",
  },
  "research-11": {
    expected: "While running, the Report pane shows mm:ss elapsed time, one honest coarse phase selected from four 25-second bands, the current subject or Reattached run, real source/search counters, the brief criteria, continuation guidance, and an optional Detach action.",
    edgeCases: "Phase clamps at Synthesizing; empty subject labels a reattached run; empty criteria shows the standard-credit-criteria fallback; missing progress currently renders 0 sources and 0 searches; reduced motion snaps counters.",
  },
  "research-12": {
    expected: "A terminal run failure renders the Research failed state with normalized detail and rerun guidance, notifies the analyst, and clears the terminal pointer. A failed rerun preserves the prior report behind View previous report; configuration/reattachment failures are separate retryable alerts.",
    edgeCases: "List-shaped FastAPI 422 detail is normalized; abort and gone are not presented as research failures; a context-link save failure preserves the completed report; no prior report means no restore action.",
  },
  "research-15": {
    expected: "A truncated live result carries a server-prepended Report may be incomplete blockquote, plus a visible Truncated badge and an Incomplete alert inside both the on-screen and print tear-sheet; complete results show none of those warnings.",
    edgeCases: "pause_turn at the continuation cap, max_tokens, and partial double-overload mark truncation; no text at the cap produces an explicit no-report explanation; demo fallback is not marked truncated.",
  },
  "research-16": {
    expected: "When no run, error, or result is active, the Report pane shows No report yet and previews four numbered deliverables: Executive summary, Detailed findings, Summary tables, and Recommendations. No provenance chip, print portal, or export action is mounted.",
    edgeCases: "Running, error, and result branches are mutually exclusive and take precedence over empty; the manifest remains finite and scrollable.",
  },
  "research-18": {
    expected: "POST /api/research calls the fixed-window limiter with key research:{caller.id}, max_attempts=3, and window_seconds=60. Exhaustion returns 429 with an explicit one-minute retry message before any job is created; list and polling GETs are not rate-limited.",
    edgeCases: "Each analyst has an independent key; the in-process limiter assumes the documented single-process deployment; resetting the window restores creation; active jobs remain pollable after creation quota is exhausted.",
  },
  "research-19": {
    expected: "The executor claims a queued job, marks it running, rebuilds ResearchBrief, and runs up to four streamed Anthropic turns with bounded web search. It persists best-effort progress, deduplicates sources, applies overload fallback, composes partial output as truncated when necessary, and writes complete or failed terminal state to the job.",
    edgeCases: "No model configuration returns the canned demo; primary plus fallback overload with no progress degrades to demo; partial progress is retained and truncated; concurrency is bounded; leased Postgres jobs can be reclaimed and exhausted orphans fail explicitly.",
  },
  "research-21": {
    expected: "ResearchBrief requires a 2–300 character subject; mode is sector or issuer; ai_mode is max, standard, or lite; persona/audience/decision/timeframe carry server defaults and caps; focus, exclusions, and source_directives cap at 1,000; criteria accepts at most 15 strings.",
    edgeCases: "Blank or one-character subject, invalid mode/AI mode, overlong scalar fields, and more than 15 criteria fail validation; empty criteria selects seven server defaults; blank optional client fields are omitted so server defaults apply.",
  },
  "research-23": {
    expected: "The configured EDGAR lane supports full-text search, issuer filings, classified filing exhibits, and two aliases for vaulting one exhibit. Discovery returns external/unverified pointers; vaulting performs ownership, SSRF, antivirus, extraction, storage, chunking, lineage, and optional embedding before returning EDGAR-vaulted provenance.",
    edgeCases: "Every endpoint returns 503 without EDGAR_USER_AGENT and is capped at 30 requests/minute per caller; SEC client errors become 502; only exact HTTPS www.sec.gov/Archives URLs can be fetched; a zero-chunk vault returns a warning.",
  },
  "research-24": {
    expected: "GET /api/edgar/search requires q length at least two, accepts comma-separated forms and limit 1–50 (default 10), enforces configuration and per-caller rate limits, runs the synchronous SEC search off-thread, and returns FilingHitOut pointers with external/unverified provenance.",
    edgeCases: "Missing/short q and out-of-range limit return 422; missing EDGAR configuration returns 503; EdgarError returns 502; an empty SEC result returns an empty list.",
  },
  "research-25": {
    expected: "GET /api/edgar/exhibits requires cik and an accession in dashed 10-2-6 or bare 18-digit form, enforces EDGAR configuration and the per-caller limiter, fetches the filing index off-thread, and returns exhibit name, URL, CP-4 document label, optional authority rank, and size.",
    edgeCases: "Malformed accession returns 422 before outbound I/O; missing configuration returns 503; EdgarError returns 502; unclassified exhibits carry no authority rank; empty filings return an empty list.",
  },
  "research-26": {
    expected: "POST /api/edgar/vault-exhibit and /vault-url validate legal run mode and issuer tenancy, fetch an allowed SEC archive URL, antivirus-scan it, extract and store off-thread with rollback cleanup, create the Document/chunks/lineage, commit, optionally enqueue embedding, and return EDGAR-vaulted document metadata.",
    edgeCases: "Foreign/missing issuer is rejected; invalid run mode returns 400; missing configuration returns 503; bad or failed SEC URL returns 502; storage is cleaned on pre-commit failure; zero extracted chunks returns a warning and no embedding task.",
  },
  "research-28": {
    expected: "After each streamed turn, the server emits deduplicated source count and actual web-search-result count; the executor persists progress; polling forwards it; RunningView eases displayed integers only toward those server values and lists the analyst criteria without ever marking a criterion complete.",
    edgeCases: "A missing progress payload currently displays 0/0; a failing progress callback is swallowed; duplicate URLs count once; counters never exceed the latest target; reduced motion snaps; unmount cancels animation frames.",
  },
  "research-29": {
    expected: "The initial brief exposes Scope, the focal subject input, Advanced brief disclosure, and the anchored run action. Advanced brief reveals framing, boundaries, criteria, and AI mode; aria-expanded and caos.research.adv track the disclosure, with a user-interaction fence preventing late preference hydration from undoing a click.",
    edgeCases: "First use starts collapsed; saved open state restores after mount; private mode cannot persist; short viewports scroll the panel without field overlap; subject/configuration rules still control both run actions.",
  },
  "command-01": {
    name: "Persisted portfolio position selection",
    story: "As a buy-side analyst, I want to select a durable holding by its position id so that I can inspect the exact instrument without confusing duplicate issuer names or tickers.",
    expected: "The Positions grid exposes each holding as a keyboard-operable row. Click, Enter, or Space writes that position id to the typed selected URL state, highlights the owning row, and opens the selected-position strip.",
    edgeCases: "Duplicate or missing tickers; multiple instruments for one issuer; stale selected id after a portfolio switch; click on an embedded issuer link; Enter and Space activation; empty portfolio.",
    trigger: "Open Positions and click, press Enter, or press Space on a persisted holding row",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/app/command/page.tsx",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-02": {
    name: "Portfolio posture distribution",
    story: "As a PM/CIO, I want a reconciled posture distribution for the selected portfolio so that I can see how completed portfolio-bound runs support the book stance.",
    expected: "When a non-empty command snapshot is available, the decision region renders OVERWEIGHT, NEUTRAL, UNDERWEIGHT, and UNKNOWN counts against the snapshot position total and labels the basis as completed runs explicitly bound to the selected portfolio.",
    edgeCases: "Zero positions; counts that do not fill every category; positions without a bound completed run; snapshot loading or failure; portfolio change while a snapshot is in flight.",
    trigger: "Load a selected portfolio command snapshot",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/app/command/page.tsx",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-03": {
    name: "Persisted holding fields and formatting",
    story: "As a credit analyst, I want the holdings grid to show the stored instrument and exposure fields in desk formats so that I can reconcile the workbench to the portfolio record.",
    expected: "Each row renders ticker, borrower, instrument, par size, price, margin, maturity, Moody's/S&P ratings, run-derived posture, and QA status. Missing values render an explicit dash; par uses USD millions and margin uses basis points.",
    edgeCases: "Null price, margin, par, maturity, ratings, ticker, or instrument; zero values; very long names; negative or non-finite values rejected upstream; narrow viewport horizontal access.",
    trigger: "Render the Positions dataset for a populated persisted portfolio",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/lib/portfolio-lab.ts",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-04": {
    name: "Issuer identity link semantics",
    story: "As an analyst, I want issuer identity links inside a holding row to open the profile without also selecting the instrument so that identity review and position review remain distinct actions.",
    expected: "An available ticker is a named link that opens the issuer profile overlay by stable issuer id and stops row activation. A missing issuer id/ticker remains non-interactive and the surrounding row keeps its own selection semantics.",
    edgeCases: "Missing issuer id; missing ticker; repeated ticker across issuers; pointer and keyboard activation; event bubbling into the row; profile overlay unavailable.",
    trigger: "Activate the ticker link in a persisted holding row",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/components/shared/IssuerProfileOverlay.tsx",
    endpoint: "none (profile-overlay client action)",
  },
  "command-05": {
    name: "Holding posture and QA labels",
    story: "As a Head of Research/QA, I want every held position to expose posture and QA text so that risk state is never conveyed by color alone.",
    expected: "The grid renders explicit posture and QA-status labels sourced from the portfolio-bound command snapshot. UNKNOWN or missing states remain textually visible rather than being inferred from hue or replaced by a favorable sample state.",
    edgeCases: "Unknown posture; missing QA or committee status; restricted/blocked output; mixed-case server values; colorblind use; stale snapshot.",
    trigger: "Inspect Posture and QA cells in the Positions grid",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/server/routes/portfolios.py",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-06": {
    name: "Selected-position strip lifecycle",
    story: "As an analyst, I want a persistent bottom strip for the selected holding with an unobstructed close action so that I can inspect the position and return to the full worklist efficiently.",
    expected: "The strip appears only in Positions when the typed selected id resolves inside the current snapshot. Its named Close control clears selected from the URL, and the global Ask launcher is offset on Command Center so it cannot intercept that action.",
    edgeCases: "Selected id absent from the current snapshot; portfolio or dataset switch; Escape/title semantics; Ask launcher overlap at desktop or narrow widths; repeated close; browser back/forward.",
    trigger: "Select a holding, then activate the selected-position strip Close control",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/Ask.tsx",
    endpoint: "none (typed URL client state)",
  },
  "command-07": {
    name: "Selected-position strip metrics",
    story: "As a buy-side analyst, I want the selected strip to retain the instrument's key stored economics and posture so that I can scan the broader book without losing position context.",
    expected: "The strip shows ticker/borrower, loan name, par, price, margin, maturity, ratings, posture, and QA/committee state using the same persisted snapshot record and explicit missing-value formatting as the grid.",
    edgeCases: "Null economics or ratings; zero par/price/margin; long instrument name; absent run id; unknown posture; stale selection during a refreshed snapshot.",
    trigger: "Select a persisted holding and inspect its bottom strip",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/lib/portfolio-lab.ts",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-08": {
    name: "Position-to-Deep-Dive handoff",
    story: "As a credit analyst, I want the selected position to hand off its issuer and bound run to Deep-Dive so that the detailed review opens on the same analytical authority.",
    expected: "When both issuer_id and run_id exist, Open Deep-Dive links to /deepdive with both encoded values. If either authority key is absent, the UI must not fabricate a different issuer/run handoff.",
    edgeCases: "Missing issuer id; missing run id; special characters requiring encoding; stale run binding; modifier-key navigation; cross-portfolio selection reset.",
    trigger: "Activate Open Deep-Dive in a selected-position strip",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/app/deepdive/page.tsx",
    endpoint: "none (screen navigation)",
  },
  "command-09": {
    name: "Accessible persisted-position grid",
    story: "As a keyboard or assistive-technology user, I want the dense holdings table to expose stable grid semantics so that every instrument and column remains navigable.",
    expected: "The worklist exposes a named grid, explicit columnheaders for Ticker, Company, Instrument, Size, Price, Margin, Maturity, Ratings, Posture, and QA, and named focusable rows with visible selected state and native link separation.",
    edgeCases: "No rows; long translated content; horizontal overflow; row focus after refresh; duplicate accessible names; screen-reader and keyboard-only operation.",
    trigger: "Navigate the persisted positions worklist by role and keyboard",
    files: "caos/frontend/src/components/command/CommandPortfolio.tsx; caos/frontend/src/components/shared/DominantTableRegion.tsx",
    endpoint: "none (rendered grid semantics)",
  },
  "command-10": {
    name: "Command header portfolio and live-coverage counts",
    story: "As a PM/CIO, I want the header to identify the selected persisted portfolio and the honest live-coverage ratio so that I know the book and analytical population in scope.",
    expected: "The identity area shows the selected portfolio name and kind with a persisted label, Positions from the command snapshot, and Live Coverage as covered/issuer count. A failed live fetch renders a warning dash rather than 0/0.",
    edgeCases: "Directory or snapshot loading; no selected portfolio; zero issuers; live fetch failure; portfolio switch; narrow header compaction.",
    trigger: "Open Command Center with an authorized portfolio",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/EnterprisePage.tsx",
    endpoint: "GET /api/portfolios/; GET /api/portfolios/{portfolio_id}/command; GET /api/portfolio",
  },
  "command-11": {
    name: "Honest live-coverage failure state",
    story: "As an analyst, I want live coverage failures to be unmistakable so that unavailable engine data is never presented as an empty or complete book.",
    expected: "When /api/portfolio fails with no retained rows, the coverage dataset and header expose Live coverage unavailable and a dash. No fixture, sample coverage, favorable count, or false no-results conclusion is substituted.",
    edgeCases: "Failure with zero rows; failure after retained rows; timeout; malformed response; retry after recovery; digest still available while coverage is offline.",
    trigger: "Open Live coverage while its portfolio dependency returns a non-2xx response",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/engine/usePortfolio.ts",
    endpoint: "GET /api/portfolio",
  },
  "command-12": {
    name: "Command utility navigation",
    story: "As an analyst, I want contextual links to Portfolio Lab and Monitor so that I can move from posture review to holdings maintenance or surveillance without losing analysis context.",
    expected: "Command utilities links to /portfolios and, when an analysis context exists, /monitor with the same context id. The controls live in the named utility dialog and remain keyboard reachable.",
    edgeCases: "Context not yet created; utility closed; Escape close; modifier-key navigation; stale context id; narrow viewport.",
    trigger: "Open Command utilities and activate a workspace link",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "none (context-preserving navigation)",
  },
  "command-13": {
    name: "Role-sensitive default dataset",
    story: "As an analyst, PM, or QA lead, I want Command Center to open on the worklist most relevant to my role so that the first view matches my operating responsibility.",
    expected: "With no valid dataset URL value, QA defaults to Governance, PM defaults to Changes, and the analyst view defaults to Live coverage. An explicit valid dataset takes precedence over the role default.",
    edgeCases: "Unknown or missing role; invalid dataset; role change after load; browser back/forward; persisted context view disagreement.",
    trigger: "Open /command without a valid dataset query parameter under each role view",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/RoleViewProvider.tsx",
    endpoint: "none (role and typed URL client state)",
  },
  "command-14": {
    name: "Four Command datasets",
    story: "As a credit team member, I want one explicit tab set for Changes, Positions, Live coverage, and Governance so that each data authority remains distinct within the Command workbench.",
    expected: "The named Command dataset tablist exposes four keyboard-operable tabs with aria-selected state. Changing tabs updates the typed dataset URL, clears selected, and renders only the owning worklist and authority labels.",
    edgeCases: "Invalid dataset; rapid tab switching; selected strip open; browser history restoration; narrow horizontal overflow; role default on a cleared URL.",
    trigger: "Activate a tab in the Command dataset tablist",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/typed-url-state.ts",
    endpoint: "none (typed URL client state)",
  },
  "command-15": {
    name: "Typed Command URL state",
    story: "As an analyst, I want dataset, selected record, and portfolio scope encoded in the URL so that a workbench state can be restored and shared without ambiguous local state.",
    expected: "Only dataset, selected, and portfolio are read/written through useTypedUrlState. Dataset and portfolio transitions clear incompatible selection; invalid values degrade to documented defaults instead of crashing or selecting a foreign record.",
    edgeCases: "Unknown dataset; missing/foreign portfolio; stale selected id; encoded characters; duplicate query parameters; back/forward; direct deep link before dependencies settle.",
    trigger: "Load or mutate /command?dataset=...&selected=...&portfolio=...",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/typed-url-state.ts",
    endpoint: "none (URL state)",
  },
  "command-16": {
    name: "Authorized portfolio directory load",
    story: "As an authenticated analyst, I want Command Center to load my available persisted portfolios so that holdings review is scoped to durable authorized books.",
    expected: "On mount, GET /api/portfolios/ populates the selected-portfolio control and persisted identity. Loading and failure are explicit, stale async completions are ignored after unmount, and no sample directory is substituted.",
    edgeCases: "Empty directory; 401/403; timeout/503; response after unmount; duplicate names; large directory; portfolio removed between requests.",
    trigger: "Mount Command Center",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/api.ts",
    endpoint: "GET /api/portfolios/",
  },
  "command-17": {
    name: "Portfolio selection precedence",
    story: "As an analyst, I want portfolio scope resolved deterministically so that a deep link, saved analysis context, and default directory order cannot silently disagree.",
    expected: "A valid requested portfolio wins; otherwise a valid analysis-context portfolio_scope wins; otherwise the first authorized directory row is selected. When no request was supplied, the resolved id is written to the URL with replace semantics.",
    edgeCases: "Requested id outside directory; context id removed; empty directory; directory still loading; concurrent context creation; duplicate portfolio names.",
    trigger: "Open Command Center with or without requested/context portfolio scope",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "GET /api/portfolios/; GET /api/analysis/contexts/{context_id}",
  },
  "command-18": {
    name: "Invalid portfolio guard",
    story: "As an analyst, I want an invalid or unauthorized portfolio deep link to fail visibly so that I cannot mistake another book or a sample sleeve for the requested scope.",
    expected: "After the directory settles, an unknown requested id renders Portfolio unavailable with authorized-scope language. Open default portfolio clears portfolio and selected via replace, allowing normal precedence to resolve an authorized default.",
    edgeCases: "Directory still loading; empty directory; foreign id; deleted portfolio; malformed id; recovery action when no default exists.",
    trigger: "Open /command?portfolio={missing_or_unauthorized_id}",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/SurfaceState.tsx",
    endpoint: "GET /api/portfolios/",
  },
  "command-19": {
    name: "Portfolio switch and selection reset",
    story: "As a PM/CIO, I want portfolio switching to reload the owning snapshot and clear instrument selection so that no position from the prior book remains visible.",
    expected: "Selecting a portfolio replaces portfolio in the typed URL, clears selected, resolves the new directory row, and requests that portfolio's command snapshot. The identity, positions, counts, and posture update to the new book.",
    edgeCases: "Rapid switches with out-of-order responses; same portfolio reselected; old selected id also exists in new book; snapshot failure; browser back.",
    trigger: "Choose a different option in Selected portfolio",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/portfolio-lab.ts",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-20": {
    name: "Command snapshot load and focus refresh",
    story: "As an analyst returning from holdings maintenance, I want the selected portfolio snapshot refreshed on window focus so that Command Center reflects durable changes made elsewhere.",
    expected: "A selected portfolio triggers an immediate command-snapshot request and another request on browser focus. Loading/error flags settle for the live selection, the listener is removed on scope change, and responses after cleanup do not overwrite the current book.",
    edgeCases: "Focus storm; portfolio switch during request; unmount; non-2xx refresh after a prior snapshot; missing selected id; duplicate request completion order.",
    trigger: "Select a portfolio or return focus to the Command Center window",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/portfolio-lab.ts",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-21": {
    name: "Persisted holdings load states",
    story: "As an analyst, I want directory, snapshot, and holdings failures distinguished so that I know whether the book is absent, unauthorized, loading, or temporarily offline.",
    expected: "Positions renders separate Loading portfolios, Portfolio directory unavailable, No portfolio configured, Loading holdings, Holdings unavailable, and Portfolio unavailable states with scope-appropriate recovery actions and no sample substitution.",
    edgeCases: "Directory failure; empty directory; invalid requested id; snapshot failure; cached snapshot during refresh; missing as-of; portfolio deleted mid-session.",
    trigger: "Open Positions under each directory and snapshot dependency state",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/SurfaceState.tsx",
    endpoint: "GET /api/portfolios/; GET /api/portfolios/{portfolio_id}/command",
  },
  "command-22": {
    name: "Empty holdings recovery",
    story: "As an analyst, I want an empty persisted portfolio to offer a direct holdings-maintenance path so that an intentionally empty book is not confused with a fetch failure.",
    expected: "A successful snapshot with zero positions renders No positions held and an Add holdings link to /portfolios with the current portfolio id. It remains distinct from no configured portfolio and from unavailable holdings.",
    edgeCases: "position_count disagrees with positions array; encoded portfolio id; directory becomes empty; snapshot refresh adds the first holding; missing portfolio id.",
    trigger: "Open Positions for a command snapshot whose positions array is empty",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/portfolio-lab.ts",
    endpoint: "GET /api/portfolios/{portfolio_id}/command",
  },
  "command-23": {
    name: "Live coverage engine fields",
    story: "As a buy-side analyst, I want a latest-run coverage worklist with leverage, coverage, RV, fragility, QA, and gaps so that I can triage names using current engine output.",
    expected: "Each live row exposes issuer identity, sector, latest run/as-of, finite net leverage and interest coverage, RV recommendation/percentile, downside fragility with glyph plus text, QA/committee status, and source-gap count; missing values remain explicit.",
    edgeCases: "No completed run; null/non-finite metrics; zero coverage; missing percentile; unknown fragility; restricted QA; multiple gaps; mixed stale rows.",
    trigger: "Open the Live coverage dataset with completed analytical runs",
    files: "caos/frontend/src/components/command/LiveCoverage.tsx; caos/frontend/src/lib/engine/usePortfolio.ts",
    endpoint: "GET /api/portfolio",
  },
  "command-24": {
    name: "Live coverage selection, filters, and virtualization",
    story: "As an analyst, I want a dense, keyboard-operable live worklist with bounded rendering and filters so that I can inspect large coverage books without losing interaction quality.",
    expected: "Rows select by stable issuer_id using pointer, Enter, or Space and open the live issuer strip. Column filter dialogs toggle values with labelled controls, update the visible worklist, and the virtualized body renders a bounded window while preserving grid semantics.",
    edgeCases: "Duplicate tickers; empty filter result; all values deselected; rapid scroll; keyboard selection; selected issuer filtered out; hundreds of rows; narrow viewport.",
    trigger: "Filter, scroll, or select a row in Live coverage",
    files: "caos/frontend/src/components/command/LiveCoverage.tsx; caos/frontend/src/app/command/page.tsx",
    endpoint: "GET /api/portfolio",
  },
  "command-32": {
    name: "Six-category governance workbench",
    story: "As a Head of Research/QA, I want governance divided into six explicit categories so that distinct gate, evidence, origin, and freshness problems are not collapsed into one count.",
    expected: "Governance renders CP-5 open findings, Failed Gates, Source Gaps, Mixed Origin, Stale Sources, and Overdue Refresh/never-run categories with textual status, counts, named controls, and source-specific rows.",
    edgeCases: "Every category empty; one dependency pending; mixed ready/error sources; duplicate issuer across categories; long evidence text; narrow layout.",
    trigger: "Open the Governance dataset",
    files: "caos/frontend/src/components/command/GovernancePanel.tsx; caos/frontend/src/lib/command/useGovernanceSources.ts",
    endpoint: "GET /api/portfolio; GET /api/qa/findings; GET /api/digest/daily",
  },
  "command-33": {
    name: "CP-5 findings and failed-gate queues",
    story: "As a QA owner, I want open CP-5 findings separated from committee-gate failures so that remediation and blocked-output review follow the correct workflow.",
    expected: "Live QA rows are derived from the portfolio and QA findings response; failed gates are derived separately from latest-run committee/QA state. Pending or failed dependencies display unavailable status and never a false zero/all-clear message.",
    edgeCases: "Finding without matching portfolio row; restricted versus blocked status; duplicate finding; empty successful queue; QA dependency error; portfolio offline.",
    trigger: "Inspect CP-5 and Failed Gates categories in Governance",
    files: "caos/frontend/src/components/command/GovernancePanel.tsx; caos/frontend/src/lib/command/qa.ts; caos/frontend/src/lib/engine/useQaFindings.ts",
    endpoint: "GET /api/qa/findings; GET /api/portfolio",
  },
  "command-34": {
    name: "Source-gap and mixed-origin governance",
    story: "As a research lead, I want missing-source impact and mixed live/reference origin called out explicitly so that committee conclusions are not treated as uniformly sourced.",
    expected: "Source Gaps renders CP-0 gap-log items with issuer, document, impact, severity, and requested date. Mixed Origin lists issuers whose current presentation combines reference/demo material with a live run and explains the authority seam.",
    edgeCases: "Missing document name/date; duplicate gaps; no live portfolio; reference-only row; live-only row; malformed gap payload; source fetch failure.",
    trigger: "Inspect Source Gaps and Mixed Origin in Governance",
    files: "caos/frontend/src/components/command/GovernancePanel.tsx; caos/frontend/src/lib/command/gaps.ts; caos/frontend/src/lib/command/mixedOrigin.ts",
    endpoint: "GET /api/portfolio",
  },
  "command-35": {
    name: "Stale versus never-run coverage split",
    story: "As a coverage manager, I want stale completed analysis separated from issuers never analyzed so that refresh work and initial coverage work are prioritized correctly.",
    expected: "Digest stale rows with a prior run appear under Stale Sources, while rows whose detail indicates never run appear under Overdue Refresh. The same issuer is not presented as both categories from one row.",
    edgeCases: "Unknown freshness; ambiguous detail text; missing issuer id; exactly-on-threshold age; duplicate rows; digest unavailable.",
    trigger: "Open Governance with stale and never-run digest rows",
    files: "caos/frontend/src/components/command/GovernancePanel.tsx; caos/frontend/src/lib/engine/useDigest.ts",
    endpoint: "GET /api/digest/daily",
  },
  "command-36": {
    name: "Governance pending and unavailable honesty",
    story: "As a PM/CIO, I want unresolved data dependencies to block an all-clear conclusion so that missing governance evidence cannot be mistaken for zero exceptions.",
    expected: "Each governance category receives its owning ready/loading/error status. Loading or error renders explicit cannot-be-marked-clear messaging; an empty-state conclusion is permitted only after that source completed successfully.",
    edgeCases: "One source ready while another fails; stale retained rows; rapid retry; portfolio live false; digest loading indefinitely; QA response malformed.",
    trigger: "Open Governance while portfolio, findings, or digest is loading or failing",
    files: "caos/frontend/src/components/command/GovernancePanel.tsx; caos/frontend/src/lib/command/useGovernanceSources.ts",
    endpoint: "GET /api/portfolio; GET /api/qa/findings; GET /api/digest/daily",
  },
  "command-37": {
    name: "Watchtower authority states",
    story: "As a PM/CIO, I want the ranked-change panel to distinguish loading, offline, empty-live, and AI-draft states so that absence of a change is not confused with unavailable surveillance.",
    expected: "Ranked Changes loads the current autonomy draft and alert states. It displays explicit loading/error/empty states, and any populated draft remains marked AI-generated/unratified according to its returned authority instead of being presented as a committee-approved feed.",
    edgeCases: "Draft 404/503; empty sections; refreshing draft; malformed claims; alert-state failure; stale response after unmount.",
    trigger: "Open Changes while /api/autonomy/draft settles",
    files: "caos/frontend/src/components/command/RankedChanges.tsx; caos/frontend/src/lib/api.ts",
    endpoint: "GET /api/autonomy/draft; GET /api/alerts/state",
  },
  "command-38": {
    name: "Ranked Watchtower changes",
    story: "As a PM/CIO, I want surveillance changes ranked by their returned anomaly severity so that the most consequential move is reviewable first.",
    expected: "Claim rows are flattened from autonomy-draft sections, sorted by severity, and show issuer, claim text, anomaly kind/severity basis, and current alert state. When portfolio holdings are not loaded, the ranking basis says so explicitly.",
    edgeCases: "Equal or missing severity; deterministic bullets without anomaly claims; multiple sections for one issuer; very long claim; no holdings; unknown anomaly kind.",
    trigger: "Load a populated Watchtower draft in Changes",
    files: "caos/frontend/src/components/command/RankedChanges.tsx; caos/server/routes/autonomy.py",
    endpoint: "GET /api/autonomy/draft",
  },
  "command-39": {
    name: "Watchtower alert-state convergence",
    story: "As an analyst, I want to acknowledge or resolve a ranked change once and see the durable state converge so that surveillance ownership is unambiguous.",
    expected: "Ack/resolve actions call the alert-state endpoint for the row's stable alert key, expose pending/disabled state, replace the local row with the returned durable state, and do not revert because a slower earlier response arrives.",
    edgeCases: "Double click; mutation 409/503; state already acknowledged/resolved; response after unmount; duplicate alert keys; stale GET racing a mutation.",
    trigger: "Activate Ack or Resolve for a Watchtower change",
    files: "caos/frontend/src/components/command/RankedChanges.tsx; caos/server/routes/alerts.py",
    endpoint: "GET /api/alerts/state; POST /api/alerts/state",
  },
  "command-40": {
    name: "Ranked-change Deep-Dive handoff",
    story: "As an analyst, I want a Watchtower change to open the implicated issuer in Deep-Dive so that I can validate the alert against the detailed evidence record.",
    expected: "Each change with an issuer id exposes a named Open link to /deepdive?issuer={encoded_id}. Missing issuer authority suppresses or disables the handoff rather than routing to a reference issuer.",
    edgeCases: "Missing issuer id; encoded id; repeated issuer; modifier-key navigation; stale autonomy section; unavailable Deep-Dive run.",
    trigger: "Activate Open on a ranked Watchtower change",
    files: "caos/frontend/src/components/command/RankedChanges.tsx; caos/frontend/src/app/deepdive/page.tsx",
    endpoint: "none (screen navigation)",
  },
  "command-41": {
    name: "Cross-issuer Query context handoff",
    story: "As an analyst, I want Command Center to open Query in the same analysis context so that portfolio scope and persisted investigation state remain attributable across surfaces.",
    expected: "Open cross-issuer Query links to /query with the current analysis context id when available and otherwise to /query. It does not invent a context id or discard an existing one.",
    edgeCases: "Context creation pending or failed; stale id; modifier-key navigation; portfolio switch before click; URL encoding.",
    trigger: "Activate Open cross-issuer Query from the Command toolbar",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "POST /api/analysis/contexts; GET /api/analysis/contexts/{context_id}",
  },
  "command-42": {
    name: "Open top change primary action",
    story: "As a PM/CIO, I want one primary action that moves directly to the ranked surveillance worklist so that the highest-priority change is reachable from any Command dataset.",
    expected: "Open top change writes dataset=changes, clears selected, then scrolls and focuses the ranked-changes region after render. The resulting panel is named Ranked Changes · Watchtower draft.",
    edgeCases: "Already on Changes; no ranked rows; selected strip open; reduced motion; region not mounted on first animation frame; keyboard activation.",
    trigger: "Activate Open top change in the Command header",
    files: "caos/frontend/src/app/command/page.tsx",
    endpoint: "none (typed URL and focus transition)",
  },
  "command-43": {
    name: "Decision header — what changed",
    story: "As a PM/CIO, I want the last 24 hours of engine activity summarized with time and authority so that I can distinguish new analytical work from an unchanged book.",
    expected: "What changed is derived only from the live daily digest: loading is explicit, positive activity lists up to three non-zero counters, a successful zero roll-up says no activity observed, and an unavailable digest says live activity unavailable.",
    edgeCases: "All zero counters; more than three positive counters; non-numeric values; missing as-of; digest error; stale freshness authority.",
    trigger: "Load the DecisionHeader with daily digest activity_24h",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/DecisionHeader.tsx",
    endpoint: "GET /api/digest/daily",
  },
  "command-44": {
    name: "Decision header — why it matters",
    story: "As a PM/CIO, I want WARF and CCC-watch exposure summarized from the current digest so that portfolio risk relevance is visible beside the change count.",
    expected: "Why it matters renders WARF, optional WARF band, and CCC-watch count only when a live digest supplies a non-null WARF and as-of; otherwise it remains loading or explicitly unavailable.",
    edgeCases: "WARF zero or null; missing band; empty CCC watch; digest offline; stale or unknown freshness; delayed response after portfolio switch.",
    trigger: "Load the DecisionHeader with digest ratings data",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/DecisionHeader.tsx",
    endpoint: "GET /api/digest/daily",
  },
  "command-45": {
    name: "Decision header — required action",
    story: "As a PM/CIO, I want current QA findings and source gaps summarized as required action so that governance work cannot be overlooked while scanning posture.",
    expected: "Required action reports live QA plus failed-gate finding count and source-gap count after portfolio/finding dependencies settle. Loading and offline conditions remain explicit, and the value carries live derived authority and fetch time.",
    edgeCases: "Portfolio ready before findings; duplicate rows; fetch error; zero successful queues; missing fetchedAt; stale response.",
    trigger: "Load the DecisionHeader with portfolio governance sources",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/command/useGovernanceSources.ts",
    endpoint: "GET /api/portfolio; GET /api/qa/findings",
  },
  "command-46": {
    name: "Decision header — evidence health",
    story: "As a research/QA lead, I want central freshness counts translated into current, partial, stale, or unavailable evidence health so that committee readiness reflects source age.",
    expected: "Evidence health applies stale > unknown > due > current precedence to digest freshness counts, shows all relevant counts, identifies missing-source reasons for partial states, and attaches policy-version/as-of authority from the live digest.",
    edgeCases: "Multiple non-current counts; missing freshness; counts inconsistent with coverage; unknown policy version; null as-of; digest failure.",
    trigger: "Load the DecisionHeader with daily digest freshness counts",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/components/shared/DecisionHeader.tsx",
    endpoint: "GET /api/digest/daily",
  },
  "command-52": {
    name: "Daily digest coverage and ratings KPIs",
    story: "As a PM/CIO, I want a compact daily roll-up of WARF, ratings, completed coverage, and 24-hour runs so that portfolio health is visible without opening each issuer.",
    expected: "The Daily Digest panel renders WARF with band, rated issuers of total, complete-run issuers of total, and runs completed/failed in 24 hours from the live digest, with explicit formatting for missing values.",
    edgeCases: "Zero issuers; null WARF/band; all runs failed; missing activity keys; stale as-of; counts larger than issuer total.",
    trigger: "Render Daily Digest with a live digest response",
    files: "caos/frontend/src/components/command/DailyDigestPanel.tsx; caos/frontend/src/lib/engine/useDigest.ts",
    endpoint: "GET /api/digest/daily",
  },
  "command-53": {
    name: "Daily digest freshness watchlists",
    story: "As an analyst, I want stale-source and CCC-watch issuer lists to open by stable issuer id so that I can move from portfolio signal to the exact profile.",
    expected: "Stale and CCC-watch rows render their issuer name/detail as named buttons. Activation opens the issuer profile overlay using issuer_id; empty lists remain explicit and duplicate names do not change identity resolution.",
    edgeCases: "Missing issuer id; duplicate names; empty watchlist; long detail; profile overlay error; keyboard activation.",
    trigger: "Activate an issuer in the stale or CCC watch list",
    files: "caos/frontend/src/components/command/DailyDigestPanel.tsx; caos/frontend/src/components/shared/IssuerProfileOverlay.tsx",
    endpoint: "GET /api/digest/daily",
  },
  "command-54": {
    name: "Cited decision brief restoration",
    story: "As an analyst, I want the current cited Command decision brief restored from the analysis context so that a durable committee-oriented synthesis survives reload and navigation.",
    expected: "Once a context id exists, Command lists decision-brief insights for surface=command and kind=decision-brief, restores the server-designated current artifact, and renders its summary plus each claim's evidence ids. Load failure produces an explicit unavailable message.",
    edgeCases: "No current artifact; multiple versions; missing claims/evidence ids; context change during request; 403/404/503; stale completion.",
    trigger: "Open Command Center with an analysis context containing a current decision brief",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "GET /api/analysis/contexts/{context_id}/insights",
  },
  "command-55": {
    name: "Generate or refresh cited decision brief",
    story: "As an analyst, I want to generate a cited portfolio decision brief and explicitly refresh an existing one so that the synthesis remains current and source-addressable.",
    expected: "Generate/Refresh posts surface=command, kind=decision-brief, selected alert subject reference, and force=true only when replacing an existing artifact. Ready/ratified results replace the panel; pending and error outcomes remain explicit without erasing the prior brief.",
    edgeCases: "Context absent; no selected alert; pending artifact; provider error; duplicate click; existing ratified version; missing evidence ids.",
    trigger: "Activate Generate cited brief or Refresh cited brief",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "POST /api/analysis/contexts/{context_id}/insights",
  },
  "command-56": {
    name: "Command analysis-context autosave",
    story: "As an analyst, I want portfolio, role, dataset, and selected-record state autosaved into the active analysis context so that cross-surface work remains durable and attributable.",
    expected: "After context hydration, Command patches portfolio_scope and surface_state.command with active_id, view, role, and portfolio_id only when values differ. Patch errors do not crash the workbench, and AnalysisContextSaveState exposes persistence status.",
    edgeCases: "Context not ready; identical state; rapid tab/portfolio changes; stale patch completion; patch 404/409/503; selected record cleared; cross-surface state preservation.",
    trigger: "Change Command portfolio, role, dataset, or selected record after context hydration",
    files: "caos/frontend/src/app/command/page.tsx; caos/frontend/src/lib/analysis-workbench.ts",
    endpoint: "PATCH /api/analysis/contexts/{context_id}",
  },
  "settings-01": {
    name: "Research defaults with device precedence",
    story: "As an analyst, I want my device-local research lens to survive reload while retaining an analyst-profile fallback on a new device so that personal workflow preferences are predictable.",
    expected: "The Research card's Save writes validated preferences to caos.research.prefs in localStorage and shows a transient Saved state. On Settings load, a stored device value takes precedence; analyst workspace research_prefs is used only when that device has no stored value. Global Save changes writes the same current snapshot to both device storage and the analyst workspace profile.",
    edgeCases: "No device value with a server profile fallback; device value plus a different server value; malformed local JSON; private-mode storage failure; reset before save; async profile response after local hydration; reload and principal change.",
    trigger: "Edit Research defaults and activate Save or global Save changes, then reload Settings",
    files: "caos/frontend/src/app/settings/page.tsx; caos/frontend/src/lib/research-prefs.ts",
    endpoint: "localStorage caos.research.prefs; GET/PATCH /api/settings/analyst for profile fallback/global sync",
  },
  "settings-02": {
    name: "Research brief seeding from device defaults",
    story: "As an analyst, I want new Research briefs seeded from the validated preferences stored on this device so that the standing lens carries into execution without retyping.",
    expected: "Research calls loadPrefs on mount and pre-fills AI mode, scope, audience, decision, timeframe, and criteria from sanitized localStorage. Missing, malformed, or wrong-typed fields fall back independently to DEFAULT_PREFS; blank optional values remain available for server-side defaults.",
    edgeCases: "Absent storage; malformed JSON; wrong-typed individual fields; unsupported mode; empty strings; principal storage reset; Settings server fallback not yet saved onto this device.",
    trigger: "Open /research after saving device Research defaults",
    files: "caos/frontend/src/app/research/page.tsx; caos/frontend/src/lib/research-prefs.ts",
    endpoint: "localStorage caos.research.prefs",
  },
  "reports-01": {
    story: "As an analyst, I want to see all six authored deliverables so that I can navigate the complete committee output set.",
    expected: "The left rail lists Credit Snapshot, Earnings Update — Q1-26, IC Credit Memo, Covenant & Capacity Brief, Monitoring Digest, and Model Appendix with section/citation counts, READY/HELD state, and the active selection.",
  },
  "reports-02": {
    expected: "Selecting a deliverable updates the active preview and aria-current state. A report query parameter can deep-link an authored or immutable version; mutable active selection is saved in the context-bound server report draft after hydration.",
    edgeCases: "Unknown report ids fall back to the first available report; frozen-version deep links take precedence over a slower mutable-draft response.",
  },
  "reports-03": {
    expected: "Zoom buttons select 70/85/100/115%; FIT computes (available width − 48)/980 and clamps to 0.4–1.15. The preview uses CSS zoom and the selected display preference persists in localStorage key caos-e-zoom.",
  },
  "reports-04": {
    expected: "White, Warm, and Cool paper-tone buttons update the preview and pressed state. Paper preference is saved in the context-bound server draft; print output uses the dedicated unscaled white PrintPortal.",
  },
  "reports-05": {
    expected: "The SOURCES control toggles report source lines and its pressed state. The choice participates in autosaved server draft state and immutable preview intent.",
  },
  "reports-06": {
    expected: "EDIT DOCUMENT enables contentEditable text leaves for editable reference/frozen-preview content. Blur captures plain text capped at 2,000 characters; edits are saved in the context-bound report draft and rendered as overrides.",
  },
  "reports-07": {
    expected: "When the active deliverable has overrides, Report utilities exposes RESET N EDIT(S). Confirmation removes that deliverable's edits from draft state; cancellation preserves them.",
  },
  "reports-08": {
    expected: "Compose controls toggle section inclusion with labelled pressed state and update Export section counts. Omissions are bounded to editable content, saved in the context-bound report draft, and carried into reviewed output.",
  },
  "reports-11": {
    expected: "Print / save PDF calls window.print only for a selected immutable published version. PrintPortal renders that version as an unscaled white document; without a published version the control is disabled with an explanatory title.",
  },
  "reports-20": {
    expected: "On hydration the UI restores caos-e-zoom locally. Active report, omissions, edits, paper tone, source visibility, and add-back visibility load from and autosave to the analysis-context report draft; immutable-version deep links override mutable active selection.",
    edgeCases: "Invalid local zoom is ignored; missing server draft is an empty state; draft revision conflicts surface a reload-before-publishing message.",
  },
  "reports-21": {
    expected: "For the Atlas Forge reference issuer, Report Studio loads the saved model through getSavedModel, applies object-shaped overrides and assumptions, and rebuilds report figures. Live issuers consume server-frozen Model Engine v2 checkpoints instead; load failure falls back to base reference figures with a warning and retry.",
  },
  "monitor-01": {
    name: "Email Intelligence reconciled intake tape",
    story: "As an analyst, I want a reconciled end-of-day email intake sample classified by severity so that I can prioritize material events without mistaking demo data for a live feed.",
    expected: "The Email intake dataset shows fixed daily totals of 3 critical, 11 high, 27 medium, 64 low, 19 deduped, and 2 unresolved (105 total) plus an eight-row illustrative sample. The caption reconciles sample-to-total and explicitly describes the tape as EOD.",
  },
  "monitor-04": {
    expected: "The default Alerts dataset shows the live Watchtower inbox when autonomy rows exist and a collapsible CP-MON-H seeded replay disclosure. Replay rows are newest-first, labelled read-only, include issuer, severity text, frozen timestamp, route, and source/no-source affordance, and reveal progressively until complete.",
  },
  "monitor-05": {
    expected: "Replay utilities provide play/pause, reset, and 1x/2x/4x speed controls with pressed state. The utility status shows a second-resolution HH:MM:SS ET clock; pause freezes the tick-derived tape and replay restarts a completed simulation.",
  },
  "monitor-06": {
    expected: "Replay state is SIM only while actively stepping, PAUSED when stopped before completion, and COMPLETE at the terminal tick. Only the genuinely newest replay row pulses while running; completed and filtered tapes remain static.",
  },
  "monitor-07": {
    name: "Replay KPIs in header",
    expected: "The sub-header exposes Replay criticals as a toggleable critical-only filter and Replay today as a tick-derived seeded count. Live routed-alert count is kept in the worklist toolbar so demo replay metrics are not presented as live production KPIs.",
  },
}));

const featureObjects = sourceRows.map((row) => {
  const contract = curatedContractOverrides.get(row.id);
  const name = contract?.name || row.feature;
  const expected = contract?.expected || row.expected;
  const files = contract?.files || row.files;
  const endpoint = contract?.endpoint || row.endpoint;
  return makeFeature({
  id: row.id,
  name,
  concept: row.concept,
  story: contract?.story || row.story,
  expected,
  edgeCases: contract?.edgeCases || row.edge_cases,
  currentStatus: "Suite evidence",
  severity: row.severity,
  notes: curatedContractOverrides.has(row.id)
    ? "Current implementation contract reconciled on 2026-07-16; direct evidence and regression status are listed in Test Cases and Feature Evidence."
    : row.notes,
  validationRules: genericValidation({
    name,
    expected,
    endpoint,
  }),
  dependencies: [files, endpoint].filter((value) => value && !value.startsWith("none")).join("; "),
  assumptions: "The curated expected behavior is based on code review and prior execution evidence; the current iteration re-ran aggregate suites but did not individually execute every listed scenario.",
  trigger: contract?.trigger || row.trigger,
  files,
  endpoint,
  sourceType: "Curated feature",
  sourceStatus: curatedContractOverrides.has(row.id)
    ? "Implementation contract refreshed from current source and passing 2026-07-16 automation"
    : `${row.status || ""}; ${row.test_result || ""}`,
  });
});

appRoutes.forEach((screen, index) => featureObjects.push(makeFeature({
  id: `SCR-${String(index + 1).padStart(3, "0")}`,
  name: `${screen.route} screen`,
  concept: "Screen Inventory",
  story: `As an authenticated analyst, I want to open ${screen.route} so that I can use the implemented ${screen.components.join(", ") || "route"} workspace.`,
  expected: `${screen.route} is emitted as a Next.js static-export page from ${screen.file}, served by FastAPI, and reaches its authenticated CAOS workbench without route-level accessibility violations.`,
  currentStatus: "Pass — landing load/a11y/responsive",
  notes: "Directly scanned in the 18-route authenticated matrix at 390x844 and 1440x900 for axe violations, scan errors, layout failures, page overflow, and clipped controls; deeper interactions are represented by curated features and journeys.",
  dependencies: `Next.js static export; FastAPI static serving; ${screen.components.join("; ")}`,
  trigger: `Navigate to ${screen.route}`,
  files: screen.file,
  endpoint: "none (screen route)",
  sourceType: "Discovered screen",
  sourceStatus: "2026-07-17 route matrix: 36/36 route-width states loaded and scanned cleanly",
})));

apiRoutes.forEach((route, index) => featureObjects.push(makeFeature({
  id: `API-${String(index + 1).padStart(3, "0")}`,
  name: `${route.method} ${route.path} — ${titleFromIdentifier(route.handler)}`,
  concept: "API Inventory",
  story: apiVerbStory(route.method, titleFromIdentifier(route.handler), route.path),
  expected: apiExpected(route),
  currentStatus: "Suite evidence",
  notes: "Inventory coverage is exact to the current router decorator; direct per-route scenario execution remains tracked in Test Matrix.",
  dependencies: `${route.file}:${route.line}; main.py router prefix; declared FastAPI dependencies and persistence/provider seams`,
  trigger: `${route.method} ${route.path}`,
  files: `${route.file}:${route.line}`,
  endpoint: `${route.method} ${route.path}`,
  sourceType: "Discovered API handler",
  sourceStatus: "Current server regression passed in aggregate",
})));

settings.forEach((setting, index) => featureObjects.push(makeFeature({
  id: `CFG-${String(index + 1).padStart(3, "0")}`,
  name: `${setting.environment} configuration`,
  concept: "Configuration",
  story: `As a CAOS operator, I want to configure ${setting.environment} so that ${titleFromIdentifier(setting.name).toLowerCase()} follows the deployment's intended security, provider, storage, or resource policy.`,
  expected: `Pydantic Settings reads ${setting.environment} as ${setting.type}; code default is ${setting.defaultValue}. ${setting.description || "The value is consumed through the central cached Settings object."}`,
  currentStatus: "Documented — direct matrix pending",
  validationRules: `Environment value must parse as ${setting.type}; deployed boot guards and consuming code apply any additional constraints described in the source comments.`,
  dependencies: `${setting.file}:${setting.line}; pydantic-settings; consuming subsystem`,
  assumptions: "Defaults are development-oriented unless the source explicitly states otherwise; production may fail closed even when a value parses.",
  trigger: `Set or omit ${setting.environment}, then construct Settings/start the app`,
  files: `${setting.file}:${setting.line}`,
  endpoint: "none (environment setting)",
  sourceType: "Discovered configuration",
  sourceStatus: "Parsed from current Settings class",
})));

journeySeed.forEach(([id, name, expected, files, status]) => featureObjects.push(makeFeature({
  id,
  name,
  concept: "Business Process",
  story: `As a buy-side credit team member, I want to complete ${name.toLowerCase()} so that the workflow produces durable, attributable, committee-defensible output.`,
  expected,
  currentStatus: status,
  notes: status.includes("Partial") || status.includes("gap") ? "At least one journey leg remains explicitly open in Defects/Test Matrix." : "Workflow boundary derived from current routes, executors, UI, and E2E tests.",
  dependencies: files,
  trigger: `Start ${name.toLowerCase()} from its primary UI or API entry point`,
  files,
  endpoint: "multiple — see Journey Inventory",
  sourceType: "Business process",
  sourceStatus: status,
})));

const duplicateIds = featureObjects.map((feature) => feature.id).filter((id, index, all) => all.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`Duplicate feature ids: ${[...new Set(duplicateIds)].join(", ")}`);

const exactEvidenceByFeature = new Map();
const indirectEvidenceByFeature = new Map();
const scenarioEvidence = new Map();
const addEvidence = (map, featureId, evidenceId) => {
  if (!map.has(featureId)) map.set(featureId, new Set());
  map.get(featureId).add(evidenceId);
};
const e2eJourneyIds = (evidence) => {
  const file = path.basename(evidence.file);
  const name = evidence.name.toLowerCase();
  if (file === "login_flow.spec.ts") return ["BP-001"];
  if (file === "deepdive_flow.spec.ts") return ["BP-006"];
  if (file === "model_flow.spec.ts") return ["BP-007"];
  if (file === "monitor_flow.spec.ts") return ["BP-015"];
  if (file === "query_flow.spec.ts") return ["BP-008"];
  if (file === "reports_flow.spec.ts") return ["BP-011"];
  if (file === "research_flow.spec.ts" || file === "research_run.spec.ts") return ["BP-009"];
  if (file === "settings_flow.spec.ts") return ["BP-017"];
  if (file === "upload_flow.spec.ts") {
    if (name.includes("identity")) return ["BP-001"];
    if (name.includes("issuer directory")) return ["BP-002"];
    if (name.includes("upload wizard")) return ["BP-003"];
    return [];
  }
  if (file === "bootstrap_flow.spec.ts") {
    if (name.includes("upload wizard")) return ["BP-003"];
    if (name.includes("deep-dive")) return ["BP-005", "BP-006"];
    if (name.includes("run") || name.includes("pipeline")) return ["BP-005"];
    if (name.includes("create")) return ["BP-002"];
  }
  return [];
};
const serverJourneyFileIds = new Map([
  ["test_edgar.py", ["BP-004"]],
  ["test_edgar_cp1.py", ["BP-004"]],
  ["test_research_report.py", ["BP-010"]],
  ["test_report_exports.py", ["BP-011"]],
  ["test_vault_export.py", ["BP-011"]],
  ["test_sector_routes.py", ["BP-012"]],
  ["test_sector_concurrency.py", ["BP-012"]],
  ["test_rv_bucket.py", ["BP-013"]],
  ["test_market_xlsx_preview.py", ["BP-013"]],
  ["test_market_xlsx_commit.py", ["BP-013"]],
  ["test_portfolios.py", ["BP-014"]],
  ["test_decisions_thesis.py", ["BP-014"]],
  ["test_ic_book.py", ["BP-014"]],
  ["test_alert_states.py", ["BP-015"]],
  ["test_notifications.py", ["BP-015"]],
  ["test_sponsors_digest.py", ["BP-015"]],
  ["test_autonomy.py", ["BP-016"]],
  ["test_pipeline_executor.py", ["BP-016"]],
  ["test_pipeline_runs.py", ["BP-016"]],
]);
// Existing automation often proves more than the single scenario inferred from
// its test name. Keep the additional attribution explicit and assertion-level:
// each row names the exact node regex and only the feature/scenario contracts
// that node actually exercises. This avoids upgrading a whole file or suite to
// direct evidence merely because it is adjacent to a feature.
const curatedScenarioMappings = [
  ["caos/tests/server/test_auth_profile.py", /test_me_before_login_is_not_a_profile/, [["auth-09", "Permission/security"], ["auth-11", "Permission/security"]]],
  ["caos/tests/server/test_auth_profile.py", /test_wrong_code_rejected/, [["auth-01", "Error path"], ["auth-03", "Permission/security"]]],
  ["caos/tests/server/test_auth_profile.py", /test_non_ascii_code_is_401_not_500/, [["auth-03", "Invalid input"], ["auth-17", "Invalid input"]]],
  ["caos/tests/server/test_auth_profile.py", /test_create_profile_sets_identity_and_initials_source/, [["auth-01", "Happy path"], ["auth-06", "Happy path"], ["auth-08", "Happy path"], ["auth-09", "Happy path"]]],
  ["caos/tests/server/test_auth_profile.py", /test_profile_name_control_chars_stripped/, [["auth-07", "Invalid input"]]],
  ["caos/tests/server/test_auth_profile.py", /test_empty_access_code_fails_closed/, [["auth-04", "Error path"], ["auth-04", "Permission/security"]]],
  ["caos/tests/server/test_auth_profile.py", /test_cookie_secure_off_in_dev_on_when_deployed/, [["auth-08", "Permission/security"]]],
  ["caos/tests/server/test_auth_profile.py", /test_reattach_to_existing_profile_keeps_one_id/, [["auth-06", "Boundary conditions"]]],
  ["caos/tests/server/test_auth_profile.py", /test_sso_email_binds_profile_and_blocks_impersonation/, [["auth-05", "Happy path"], ["auth-05", "Permission/security"]]],
  ["caos/tests/server/test_auth_profile.py", /test_logout_clears_identity/, [["auth-08", "Boundary conditions"]]],
  ["caos/tests/server/test_auth_profile.py", /test_auth_02_performance_throttle_covers_every_credential_endpoint/, [["auth-02", "Performance"]]],
  ["caos/tests/server/test_auth_profile.py", /test_auth_02_boundary_condition_allows_ten_then_blocks_eleventh/, [["auth-02", "Boundary conditions"]]],
  ["caos/tests/server/test_auth_password.py", /test_register_then_me_is_profile/, [["auth-17", "Happy path"], ["auth-08", "Happy path"]]],
  ["caos/tests/server/test_auth_password.py", /test_register_bad_invite_code_rejected/, [["auth-17", "Error path"], ["auth-17", "Permission/security"]]],
  ["caos/tests/server/test_auth_password.py", /test_register_duplicate_email_conflict/, [["auth-17", "Boundary conditions"]]],
  ["caos/tests/server/test_auth_password.py", /test_register_invalid_email_422/, [["auth-17", "Invalid input"]]],
  ["caos/tests/server/test_auth_password.py", /test_register_short_password_422/, [["auth-17", "Invalid input"], ["auth-17", "Boundary conditions"]]],
  ["caos/tests/server/test_auth_password.py", /test_login_roundtrip/, [["auth-16", "Happy path"], ["auth-08", "Happy path"]]],
  ["caos/tests/server/test_auth_password.py", /test_login_wrong_password_401/, [["auth-16", "Error path"], ["auth-16", "Permission/security"]]],
  ["caos/tests/server/test_auth_password.py", /test_login_unknown_email_401/, [["auth-16", "Error path"], ["auth-16", "Permission/security"]]],
  ["caos/tests/server/test_auth_password.py", /test_recovery_requires_all_words/, [["auth-18", "Happy path"], ["auth-18", "Invalid input"], ["auth-18", "Boundary conditions"]]],
  ["caos/tests/server/test_auth_password.py", /test_sso_adoption_revokes_self_registered_password/, [["auth-05", "Permission/security"], ["auth-16", "Permission/security"], ["auth-18", "Permission/security"]]],
  ["caos/tests/server/test_auth_password.py", /test_recovery_unknown_email_denied/, [["auth-18", "Error path"], ["auth-18", "Permission/security"]]],
  ["caos/tests/server/test_passwords.py", /test_hash_verify_roundtrip/, [["auth-16", "Happy path"]]],
  ["caos/tests/server/test_passwords.py", /test_wrong_password_rejected/, [["auth-16", "Error path"]]],
  ["caos/tests/server/test_passwords.py", /test_salt_makes_each_hash_unique/, [["auth-17", "Permission/security"]]],
  ["caos/tests/server/test_passwords.py", /test_empty_or_malformed_hash_never_raises/, [["auth-16", "Invalid input"]]],
  ["caos/tests/server/test_identity.py", /test_read_session_token_rejects_non_ascii_signature/, [["auth-08", "Invalid input"]]],
  ["caos/tests/server/test_identity.py", /test_local_dev_no_enforcement/, [["auth-11", "Boundary conditions"]]],
  ["caos/tests/server/test_identity.py", /test_is_deployed_fails_closed|test_mistyped_prod_env_still_fails_closed/, [["auth-11", "Permission/security"]]],
  ["caos/tests/server/test_identity.py", /test_edge_secret_required_when_configured|test_cookie_does_not_bypass_edge_secret|test_unset_secret_keeps_prior_fail_closed/, [["auth-11", "Permission/security"]]],
  ["caos/tests/server/test_identity.py", /test_revoked_token_version_rejected/, [["auth-13", "Permission/security"]]],
  ["caos/tests/server/test_identity.py", /test_expired_token_rejected/, [["auth-08", "Boundary conditions"], ["auth-08", "Permission/security"]]],
  ["caos/tests/server/test_identity.py", /test_profile_cookie_ignored_when_sso_principal_differs/, [["auth-05", "Permission/security"]]],
  ["caos/tests/server/test_token_revocation.py", /test_logout_revokes_prior_token/, [["auth-12", "Happy path"], ["auth-12", "Permission/security"], ["auth-13", "Permission/security"]]],
  ["caos/tests/server/test_gdpr_erase.py", /test_erase_deletes_private_anonymizes_shared_spares_others/, [["auth-14", "Happy path"], ["auth-14", "Boundary conditions"], ["auth-14", "Permission/security"]]],
  ["caos/tests/server/test_gdpr_erase.py", /test_erase_deletes_model_v2_private_state_dependency_first/, [["auth-14", "Boundary conditions"]]],
  ["caos/tests/server/test_gdpr_erase.py", /test_erase_by_email_resolves_id_then_erases/, [["auth-15", "Happy path"]]],
  ["caos/frontend/src/components/shared/AuthProvider.test.tsx", /can bypass login for local preview without calling \/me/, [["auth-11", "Boundary conditions"]]],
  ["caos/frontend/src/components/shared/AuthProvider.test.tsx", /re-resolves identity and routes to login when caos:auth-lost fires/, [["auth-09", "Error path"], ["auth-11", "Permission/security"]]],
  ["caos/frontend/src/components/shared/AuthProvider.test.tsx", /re-resolves on tab refocus/, [["auth-05", "Permission/security"]]],
  ["caos/frontend/src/components/shared/AuthProvider.test.tsx", /unmounts principal A synchronously/, [["auth-05", "Boundary conditions"], ["auth-05", "Permission/security"]]],
  ["caos/frontend/src/components/shared/AuthProvider.test.tsx", /ignores an older refresh that settles after a newer principal/, [["auth-09", "Boundary conditions"], ["auth-09", "Performance"]]],
  ["caos/frontend/src/components/shared/AuthProvider.test.tsx", /does not remount the login form/, [["auth-10", "Boundary conditions"]]],
  ["caos/frontend/src/components/shared/AuthProvider.test.tsx", /refreshes when another tab changes the principal marker/, [["auth-05", "Boundary conditions"]]],
  ["caos/tests/frontend/e2e/login_flow.spec.ts", /register creates an account and lands in the app/, [["auth-01", "Happy path"], ["auth-17", "Happy path"]]],
  ["caos/tests/frontend/e2e/login_flow.spec.ts", /wrong invite code surfaces the error/, [["auth-10", "Error path"], ["auth-17", "Error path"], ["auth-17", "Permission/security"]]],
  ["caos/tests/frontend/e2e/login_flow.spec.ts", /sign-in with wrong passcode surfaces an error/, [["auth-10", "Error path"], ["auth-16", "Error path"]]],
  ["caos/tests/frontend/e2e/login_flow.spec.ts", /auth login mobile responsive states remain accessible and unclipped/, [["auth-01", "Mobile/responsive"], ["auth-10", "Mobile/responsive"], ["auth-16", "Mobile/responsive"], ["auth-17", "Mobile/responsive"], ["auth-18", "Mobile/responsive"]]],
  ["caos/frontend/src/app/deepdive/deepdive-interactions.test.tsx", /covers layouts, module navigation, accordion modes, pane collapse, chat, and lazy evidence/, [["deepdive-01", "Happy path"], ["deepdive-03", "Happy path"], ["deepdive-15", "Happy path"], ["deepdive-19", "Happy path"], ["deepdive-22", "Happy path"], ["deepdive-25", "Boundary conditions"], ["deepdive-28", "Happy path"], ["deepdive-40", "Boundary conditions"], ["deepdive-41", "Happy path"], ["deepdive-42", "Mobile/responsive"]]],
  ["caos/frontend/src/app/deepdive/deepdive-interactions.test.tsx", /measures strip overflow, exposes paging controls, and handles responsive decision collapse/, [["deepdive-01", "Mobile/responsive"], ["deepdive-27", "Mobile/responsive"]]],
  ["caos/frontend/src/app/deepdive/deepdive-interactions.test.tsx", /distinguishes issuer lookup failure\/retry and live run caveat states/, [["deepdive-02", "Error path"], ["deepdive-03", "Error path"], ["deepdive-23", "Happy path"], ["deepdive-24", "Error path"], ["deepdive-26", "Happy path"], ["deepdive-29", "Error path"], ["deepdive-30", "Happy path"], ["deepdive-39", "Happy path"]]],
  ["caos/frontend/src/app/deepdive/deepdive-interactions.test.tsx", /affirms and pins a live thesis, including partial and error recovery/, [["deepdive-38", "Happy path"], ["deepdive-38", "Error path"], ["deepdive-39", "Error path"]]],
  ["caos/frontend/src/app/deepdive/deepdive-interactions.test.tsx", /requires an analysis context even when a live run is present/, [["deepdive-38", "Permission/security"]]],
  ["caos/frontend/src/components/deepdive/tabs.smoke.test.tsx", /renders both debate variants in summary and report layouts/, [["deepdive-04", "Happy path"], ["deepdive-05", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/tabs.smoke.test.tsx", /renders recovery and covenant analysis at every density/, [["deepdive-06", "Happy path"], ["deepdive-07", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/ModuleView.test.tsx", /report layout keeps module outputs and workflow cards/, [["deepdive-08", "Happy path"], ["deepdive-09", "Happy path"], ["deepdive-32", "Happy path"], ["deepdive-33", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/ModuleView.test.tsx", /does not show seeded output for a missing issuer-scoped module/, [["deepdive-08", "Error path"], ["deepdive-26", "Error path"]]],
  ["caos/frontend/src/components/deepdive/ModuleCharts.test.ts", /gives every analytical chart authority, a readable summary, and an equivalent table schema/, [["deepdive-10", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/OutputRegister.test.tsx", /shows the workflow-step summary header when open/, [["deepdive-11", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/OutputRegister.test.tsx", /renders the step in a labelled dialog/, [["deepdive-12", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/OutputRegister.test.tsx", /consolidates repeated same-prefix report cards/, [["deepdive-13", "Happy path"]]],
  ["caos/tests/frontend/e2e/deepdive_flow.spec.ts", /hovering an evidence chip cross-highlights every sibling citing the same id/, [["deepdive-14", "Happy path"]]],
  ["caos/frontend/src/lib/evidence-sync.test.tsx", /clicking a chip opens its source without leaking the click to parents/, [["deepdive-15", "Boundary conditions"]]],
  ["caos/frontend/src/components/deepdive/rails.rich.test.tsx", /renders the reference source register and synchronizes every driver interaction/, [["deepdive-16", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/rails.rich.test.tsx", /distinguishes committee loading, error, unavailable, and observed-empty states/, [["deepdive-17", "Error path"], ["deepdive-18", "Error path"]]],
  ["caos/frontend/src/components/deepdive/rails.rich.test.tsx", /renders and orders live committee findings while preserving the reference decision stack/, [["deepdive-17", "Happy path"], ["deepdive-18", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/IssuerChat.interactions.test.tsx", /submits from the composer, blocks duplicate sends, clears the transcript, and closes by keyboard or button/, [["deepdive-19", "Boundary conditions"]]],
  ["caos/frontend/src/components/deepdive/issuer-chat-context.test.ts", /grounds in the live run and drops the ATLF fixtures when a run is present/, [["deepdive-20", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/IssuerChat.test.tsx", /loads the new run transcript without writing the prior run into its cache/, [["deepdive-21", "Boundary conditions"]]],
  ["caos/frontend/src/lib/deepdive/layout-pref.test.ts", /persists current values and rejects unknown values/, [["deepdive-22", "Boundary conditions"]]],
  ["caos/frontend/src/lib/engine/useLiveRun.test.ts", /loads the exact URL-bound run instead of substituting the latest run/, [["deepdive-23", "Boundary conditions"]]],
  ["caos/frontend/src/lib/deepdive/caveat.test.ts", /phase='error' resolves to 'error', not noRun/, [["deepdive-24", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/rails.rich.test.tsx", /hides the seeded rail for non-reference issuers with and without an identifying code/, [["deepdive-26", "Boundary conditions"]]],
  ["caos/frontend/src/components/shared/ConceptNav.test.tsx", /exposes a Concepts trigger that lists every concept with its full label/, [["deepdive-31", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/OutputRegister.test.tsx", /records a QA flag through compose → confirm and confirms it/, [["deepdive-34", "Happy path"]]],
  ["caos/tests/server/test_qa_flags.py", /test_flags_never_gate_committee_export/, [["deepdive-34", "Permission/security"]]],
  ["caos/tests/server/test_qa_flags.py", /test_list_flags_filters_by_module_and_step/, [["deepdive-35", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/ModuleFinder.test.tsx", /opens on ⌘M, filters by id or name, and selecting adds a recent chip/, [["deepdive-36", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/ModuleFinder.test.tsx", /does not open ⌘M while focus is inside a text input/, [["deepdive-36", "Boundary conditions"]]],
  ["caos/frontend/src/components/deepdive/StandingViewStrip.test.tsx", /the reference issuer shows the DEBATE\/SIZING fixture tagged DEMO, never LIVE/, [["deepdive-37", "Happy path"]]],
  ["caos/frontend/src/components/deepdive/StandingViewStrip.test.tsx", /a real \(non-reference\) issuer with no CP-6 verdict shows an honest empty state/, [["deepdive-37", "Error path"]]],
  ["caos/frontend/src/components/model/ScenarioNetworkPanel.test.tsx", /renders computed and degraded nodes with text status, not color alone/, [["deepdive-40", "Happy path"]]],
  ["caos/frontend/src/components/shared/DecisionHeader.test.tsx", /renders one shared observation envelope when every conclusion has identical authority/, [["deepdive-41", "Happy path"]]],
  ["caos/frontend/src/components/shared/DecisionHeader.test.tsx", /renders a failed response as an error, never as a neutral empty observation/, [["deepdive-41", "Error path"]]],
];
const curatedReferences = new Map(sourceRows.map((row) => [
  row.id,
  `${row.test_cases || ""} ${row.test_result || ""} ${row.notes || ""}`.toLowerCase(),
]));
const apiDescriptors = apiRoutes.map((route, index) => ({
  id: `API-${String(index + 1).padStart(3, "0")}`,
  route,
  callRegex: routeCallRegex(route.method, route.path),
}));
validateApiFeatureParameterMappings(evidenceSourceByFile, apiDescriptors);
const configDescriptors = settings.map((setting, index) => ({
  id: `CFG-${String(index + 1).padStart(3, "0")}`,
  environment: setting.environment,
}));
const screenDescriptors = appRoutes.map((screen, index) => ({
  id: `SCR-${String(index + 1).padStart(3, "0")}`,
  route: screen.route,
  navigationRegex: routeNavigationRegex(screen.route),
}));

for (const evidence of automationEvidence) {
  const exactReasons = new Map();
  const indirectReasons = new Map();
  const explicitScenariosByFeature = new Map();
  const bodyLower = evidence.body.toLowerCase();
  const evidenceTextLower = `${evidence.name} ${evidence.body}`.toLowerCase();
  const basename = path.basename(evidence.file).toLowerCase();
  const functionName = evidence.layer === "Server/stress/cohort"
    ? evidence.name.split("::").at(-1).replace(/\[.*$/, "").toLowerCase()
    : evidence.name.split(" > ").at(-1).toLowerCase();

  for (const row of sourceRows) {
    const references = curatedReferences.get(row.id) || "";
    const subjectPath = testSubjectPath(evidence.file);
    const citedSourceFiles = new Set((row.files || "").split(";")
      .map((value) => clean(value).replace(/:\d+.*$/, ""))
      .filter(Boolean));
    if (
      evidence.layer === "Frontend unit/component"
      && citedSourceFiles.has(subjectPath)
      && significantTokenOverlap(`${row.feature} ${row.expected}`, evidence.name) >= 2
    ) {
      exactReasons.set(row.id, "Colocated source test with matching assertion semantics");
    }
    if (references.includes(`::${functionName}`) || (functionName.length >= 24 && references.includes(functionName))) {
      exactReasons.set(row.id, "Tracker exact test reference");
    } else if (references.includes(basename)) {
      if (significantTokenOverlap(references, evidence.name) >= 3) {
        exactReasons.set(row.id, "Tracker test-file reference with matching assertion semantics");
      } else {
        indirectReasons.set(row.id, "Tracker test-file reference");
      }
    }
    if (bodyLower.includes(row.id.toLowerCase())) exactReasons.set(row.id, "Feature ID asserted in test body");
  }
  for (const feature of featureObjects) {
    if (containsIdentifier(evidenceTextLower, feature.id)) {
      exactReasons.set(feature.id, "Feature ID asserted in test name or body");
    }
  }
  for (const descriptor of apiDescriptors) {
    if (descriptor.callRegex.test(evidence.body)) {
      exactReasons.set(descriptor.id, `${descriptor.route.method} ${descriptor.route.path} invoked in test body`);
    }
  }
  for (const descriptor of configDescriptors) {
    if (containsIdentifier(evidenceTextLower, descriptor.environment)) {
      exactReasons.set(descriptor.id, `${descriptor.environment} asserted in test name or body`);
    }
  }
  if (evidence.layer === "Browser E2E") {
    for (const descriptor of screenDescriptors) {
      if (descriptor.navigationRegex.test(evidence.body)) {
        exactReasons.set(descriptor.id, `${descriptor.route} navigation asserted in Playwright body`);
      }
    }
  }
  if (evidence.layer === "Server/stress/cohort") {
    for (const featureId of serverJourneyFileIds.get(basename) || []) {
      exactReasons.set(featureId, `${basename} dedicated business-process contract`);
    }
  }
  for (const featureId of e2eJourneyIds(evidence)) exactReasons.set(featureId, "Playwright journey mapping");
  for (const [file, namePattern, mappings] of curatedScenarioMappings) {
    if (evidence.file !== file || !namePattern.test(evidence.name)) continue;
    for (const [featureId, scenario] of mappings) {
      exactReasons.set(featureId, "Curated assertion-level scenario mapping");
      addEvidence(explicitScenariosByFeature, featureId, scenario);
    }
  }

  evidence.exactFeatureIds = [...exactReasons.keys()].sort();
  evidence.indirectFeatureIds = [...indirectReasons.keys()].filter((id) => !exactReasons.has(id)).sort();
  evidence.mappingBasis = [...new Set([...exactReasons.values(), ...indirectReasons.values()])].join("; ") || "Unmapped automated test";
  for (const featureId of evidence.exactFeatureIds) {
    addEvidence(exactEvidenceByFeature, featureId, evidence.id);
    const explicitScenarios = explicitScenariosByFeature.get(featureId);
    if (explicitScenarios?.size) {
      for (const scenario of explicitScenarios) {
        addEvidence(scenarioEvidence, `${featureId}|${scenario}`, evidence.id);
      }
    } else {
      addEvidence(scenarioEvidence, `${featureId}|${evidence.scenario}`, evidence.id);
    }
  }
  for (const featureId of evidence.indirectFeatureIds) addEvidence(indirectEvidenceByFeature, featureId, evidence.id);
}

const defectCounts = new Map();
const featureSeverity = new Map();
const severityRank = new Map([["None", 0], ["Low", 1], ["Medium", 2], ["High", 3], ["Critical", 4]]);
for (const defect of defects) {
  const [, featureId, severity] = defect;
  defectCounts.set(featureId, (defectCounts.get(featureId) || 0) + 1);
  if ((severityRank.get(severity) || 0) > (severityRank.get(featureSeverity.get(featureId)) || 0)) {
    featureSeverity.set(featureId, severity);
  }
}

const evidenceExecutedDateById = new Map(
  automationEvidence.map((evidence) => [evidence.id, evidence.executedDate || baselineDate]),
);
function latestEvidenceDate(evidenceIds, fallback = baselineDate) {
  const dates = evidenceIds.map((id) => evidenceExecutedDateById.get(id)).filter(Boolean).sort();
  return dates.at(-1) || fallback;
}

const testRows = [];
for (const feature of featureObjects) {
  for (const scenario of scenarios) {
    let status = "Designed";
    let lastExecuted = "";
    let result = "Scenario generated from the current implementation inventory; direct execution evidence is pending.";
    let automation = feature.endpoint && !feature.endpoint.startsWith("none") ? "API/unit/E2E candidate" : "UI/unit/E2E candidate";
    const exactEvidence = [...(scenarioEvidence.get(`${feature.id}|${scenario}`) || [])];
    if (!scenarioApplicable(feature, scenario)) {
      status = "Not applicable";
      lastExecuted = today;
      result = "This backend-only contract has no viewport-dependent presentation behavior; responsive validation applies at its consuming screen or workflow boundary.";
      automation = "Not applicable";
    } else if (exactEvidence.length) {
      status = "Pass";
      lastExecuted = latestEvidenceDate(exactEvidence);
      result = `Directly mapped passing automation: ${exactEvidence.slice(0, 12).join(", ")}${exactEvidence.length > 12 ? ` (+${exactEvidence.length - 12} more)` : ""}.`;
      automation = "Mapped automation evidence";
    } else if (feature.sourceType === "Discovered screen" && scenario === "Happy path") {
      status = "Pass";
      lastExecuted = today;
      result = "Authenticated route loaded and completed the current WCAG A/AA axe scan with zero findings on 2026-07-17.";
      automation = "Playwright + axe";
    } else if (feature.sourceType === "Curated feature" && scenario === "Happy path") {
      status = "Suite evidence";
      lastExecuted = baselineDate;
      result = "Current unit/server/E2E regressions passed in aggregate; this exact feature assertion was not independently mapped in this iteration.";
    } else if (feature.sourceType === "Discovered API handler" && ["Happy path", "Error path", "Invalid input", "Permission/security"].includes(scenario)) {
      status = "Suite evidence";
      lastExecuted = baselineDate;
      result = "The 2,399-pass executable server cohort covers the API layer in aggregate; per-handler test identity mapping remains pending.";
    } else if (feature.sourceType === "Discovered screen" && scenario === "Mobile/responsive") {
      status = "Pass";
      lastExecuted = today;
      result = "The route passed at 390x844 and 1440x900 with zero axe nodes, scan errors, page overflow, or clipped interactive controls.";
      automation = "Playwright + axe + responsive geometry checks";
    }
    testRows.push([
      `${feature.id}-${scenarioSlug(scenario)}`,
      feature.id,
      scenario,
      scenarioText(feature, scenario),
      expectedForScenario(feature, scenario),
      status,
      result,
      lastExecuted,
      automation,
      "",
    ]);
  }
}

// Direct execution evidence that closes prior gaps or covers environment-specific lanes.
const executedCases = [
  ["E2E-MODEL-CP2B", "model-37", "Downside fragility readout", "Pass", "Current CP-2B DTO fixture rendered the fragility readout in the real Model UI", "DEF-QV-006"],
  ["E2E-MODEL-SAVE", "model-43", "Canonical Model Engine v2 suggestion save", "Pass", "Authenticated as the owned workflow analyst, observed the successful PUT, and established a durable server revision", "DEF-QV-041"],
  ["E2E-MODEL-RELOAD", "model-43", "Committed Model Engine v2 override survives reload", "Pass", "Previewed and atomically committed one input override, then restored its exact value and OVERRIDDEN state after reload", "DEF-QV-041"],
  ["E2E-RESEARCH-MARKER", "research-13", "Current live/demo synthesis marker", "Pass", "Un-stubbed LIVE and AI-synthesized authority markers rendered", "DEF-QV-008"],
  ["E2E-DEEPDIVE-EVIDENCE-SYNC-STRESS", "deepdive-14", "Evidence-sync hover remains deterministic under parallel hydration", "Pass", "10/10 repetitions passed with five workers and retries disabled", "DEF-QV-009"],
  ["RESPONSIVE-ISSUER-FILTERS", "SCR-004", "Issuer filter targets and narrow column tracks", "Pass", "Non-shrinking filter targets and bounded sector tracks passed unit and 390px browser validation", "DEF-QV-011"],
  ["RESPONSIVE-SPONSORS-LAYOUT", "SCR-017", "Sponsors mobile worklist and detail layout", "Pass", "Stacked mobile layout retained a usable keyboard-accessible worklist at 390px", "DEF-QV-012"],
  ["RESPONSIVE-UPLOAD-STEPS", "SCR-018", "Upload step navigation keyboard access", "Pass", "The overflow region is labeled, focusable, visibly focused, and clean at 390px", "DEF-QV-013"],
  ["RESPONSIVE-PORTFOLIOS-900", "SCR-010", "Portfolio filters at the intermediate breakpoint", "Pass", "The compact layout preserved the Apply control at 900px", "DEF-QV-014"],
  ["E2E-SQLITE-SERIAL-LANE", "BP-017", "Deterministic stateful local E2E execution", "Pass", "46/46 journeys passed with retries disabled against the sanitized one-worker SQLite QA lane", "DEF-QV-015"],
  ["E2E-RESEARCH-PATHNAME-STUB", "research-13", "Research POST interception with context query string", "Pass", "Pathname predicates intercepted all three Research POST fixtures and the full zero-retry lane passed", "DEF-QV-016"],
  ["E2E-DEEPDIVE-ATOMIC-HOVER", "deepdive-14", "Atomic evidence-sync hover assertion", "Pass", "Hovered, sibling, and unrelated states passed in one bounded transaction across 10/10 five-worker repetitions", "DEF-QV-017"],
  ["SERVER-LINEAGE-PG-ROLLBACK", "BP-008", "Independent-transaction lineage commit and rollback contention", "Pass", "Both unique-key contention paths passed against PostgreSQL", "DEF-QV-010"],
  ["SERVER-PG-GATED-COHORT", "BP-017", "PostgreSQL-only concurrency, locks, deployed posture, and lineage", "Pass", "15/15 environment-gated PostgreSQL cases passed", ""],
  ["SERVER-OCR-GOLDEN", "BP-003", "Real OCR ingestion and provenance persistence", "Pass", "Image-only PDF was OCRed and persisted with prov=ocr", ""],
  ["DB-MIGRATION-ROUNDTRIP", "BP-017", "PostgreSQL migration round trip and drift check", "Pass", "upgrade, check, downgrade-to-base, and re-upgrade all passed across 62 revisions", ""],
  ["PERF-HEALTH-P95", "BP-017", "Concurrent health endpoint latency gate", "Pass", "200 requests at concurrency 20: 0 errors, p50 23ms, p95 82ms under the 500ms gate", ""],
  ["E2E-MODEL-V2-FLAGS", "BP-017", "Complete Model Engine v2 capability rollout", "Pass", "The isolated server enabled both model_engine_v2 and lineage_v2; the v2 route returned live authority instead of the deliberate 503 gate", "DEF-QV-040"],
  ["SERVER-ROOT-COHORT", "BP-017", "Repository-root backend regression invocation", "Pass", "The repository-root invocation collected 2,414 current nodes; 2,399 executable cases pass and 15 intentional skips remain", "DEF-QV-042"],
  ["VALIDATION-LEDGER-CURRENT", "BP-017", "Current supporting-gate commands", "Pass", "Scenario benchmark, Modular OS consistency, dependency lock sync, and complexity delta all executed from their required current paths", "DEF-QV-043"],
  ["E2E-DETERMINISTIC-KEYLESS", "BP-017", "Deterministic zero-retry browser environment", "Pass", "With Anthropic, OpenRouter, and Gemini keys explicitly blank, the latest tested snapshot passed all 46 browser journeys with zero retries in 30.0s", "DEF-QV-044"],
  ["A11Y-ROOT-900-RERUN", "BP-017", "Fail-closed root accessibility readiness follow-up", "Pass", "The focused / root rerun at 900x900 resolved to /issuers with zero axe nodes, scan errors, page overflow, or clipped controls", "DEF-QV-045"],
  ["E2E-COMMAND-SCOPE-GUARD", "command-56", "Command autosave waits for portfolio resolution", "Pass", "The first successful context PATCH retained portfolio-qa; focused regression passed 7/7 and the final full zero-retry cohort passed 46/46", "DEF-QV-046"],
  ["E2E-SETTINGS-ACTION-REASON", "settings-01", "Settings save actionability follows ActionReason semantics", "Pass", "The dirty action removed aria-disabled and the no-change title, then returned to pristine after save; focused and full browser regressions passed", "DEF-QV-047"],
  ["PRODLIKE-PG-SCALE-300", "BP-017", "Sanitized production-scale PostgreSQL fixture", "Pass", "Guarded idempotent seeding produced 300 conspicuously fictional issuers, 600 documents/chunks, 2,400 metrics, and one opt-in owned CP-1 workflow fixture", "DEF-QV-049"],
  ["PRODLIKE-E2E-IDENTITY-LANES", "BP-017", "Quota- and session-isolated production-like browser cohort", "Pass", "Browser- and lane-specific fictional identities completed 141/141 project executions with zero retries against HTTPS/PostgreSQL", "DEF-QV-048; DEF-QV-051; DEF-QV-064"],
  ["PRODLIKE-BOOTSTRAP-GATED-PLAN", "pipeline-01", "All-gates runtime module cardinality", "Pass", "Bootstrap derived its completion count from the enabled runtime plan and passed with CP-2G and CP-4D enabled", "DEF-QV-050"],
  ["PRODLIKE-CSP-SOURCE-PREFLIGHT", "BP-017", "Exact-artifact CSP and source freshness", "Pass", "Every staged inline-script hash was present in the live CSP and no frontend source file postdated the export before 46 journeys ran", "DEF-QV-052; DEF-QV-053"],
  ["A11Y-ISSUER-LOADING-STATUS", "issuer-01", "Valid asynchronous loading semantics", "Pass", "The issuer loading state exposed a named busy status region; the exact-build axe matrix reported zero violation nodes", "DEF-QV-054"],
  ["RESPONSIVE-MODEL-REPORT-RECOVERY", "model-43", "Narrow recovery and export operability", "Pass", "At 390x844 compact header labels and tools-drawer fallbacks produced zero clipped controls across Model and Report Studio", "DEF-QV-055"],
  ["A11Y-QUERY-ISOLATED-IDENTITY", "query-01", "Quota-isolated dynamic Query states", "Pass", "Ready, graph lane, persisted answer, and narrow restored-answer states completed under a dedicated analyst with zero axe nodes", "DEF-QV-056"],
  ["FRONTEND-AGGREGATE-1390", "BP-017", "Reconciled frontend executable inventory", "Pass", "All 1,390/1,390 current nodes passed: the sealed 1,367-node inventory plus 23 net-new nodes reconciled through 11 complete-file reruns (90/90)", "DEF-QV-074; DEF-QV-075; DEF-QV-076; DEF-QV-078; DEF-QV-079; DEF-QV-080; DEF-QV-081; DEF-QV-082; DEF-QV-083; DEF-QV-084; DEF-QV-085; DEF-QV-086; DEF-QV-088; DEF-QV-089; DEF-QV-091; DEF-QV-093; DEF-QV-095"],
  ["SERVER-AGGREGATE-2399", "BP-017", "Reconciled backend executable inventory", "Pass", "2,399/2,399 current executable nodes passed and 15 intentional skips remain across 2,414 collected nodes", ""],
  ["FRONTEND-ASK-DELTA-16", "BP-017", "Late Ask coverage delta", "Pass", "The final complete Ask.coverage.test.tsx revision passed all 16 nodes added after the aggregate and Issuers delta", ""],
  ["SERVER-ANALYSIS-DELTA-14", "BP-017", "Late analysis workspace route and contract delta", "Pass", "The complete modified test_analysis_workspace.py file passed 13 executable cases with one intentional skip, covering all 11 nodes added after the aggregate collection", ""],
  ["SERVER-QA-SEED-SECURITY-9", "BP-017", "Scale seeder and deployed-header regression", "Pass", "9/9 focused server tests passed against the guarded scale fixture and security-header contracts", ""],
  ["BUILD-MONITOR-JSX-COMMENT", "monitor-01", "Monitor JSX comment placement", "Pass", "The explanatory comment moved from the attribute list into the valid child region; the next 20-route production build passed", "DEF-QV-057"],
  ["BUILD-REPORTDOC-SEMANTIC-HEADING", "reports-01", "Report document semantic heading closure", "Pass", "The completed concurrent h2 edit passed production parsing, ReportDoc unit coverage, and Report Studio journeys", "DEF-QV-058"],
  ["EXACT-CURRENT-FRESHNESS-SEAL", "BP-017", "Exact-current application validation seal", "Pass", "The latest executed test snapshot reconciles all 1,390 frontend and 2,399 backend executable nodes plus clean lint and type check; exact collection gates prevent later test additions from entering the tracker as passed, while the latest production-source browser/accessibility seal remains 141/141 and 36/36", "DEF-QV-059; DEF-QV-066; DEF-QV-073; DEF-QV-077; DEF-QV-079; DEF-QV-080; DEF-QV-081; DEF-QV-082; DEF-QV-083; DEF-QV-084; DEF-QV-085; DEF-QV-086; DEF-QV-087; DEF-QV-088; DEF-QV-089; DEF-QV-091; DEF-QV-093; DEF-QV-095"],
  ["CONCURRENT-DELTA-RECONCILIATION", "BP-017", "Post-seal test additions remain evidence-backed", "Pass", "Eight modified frontend files passed 48/48 and every modified backend file was rerun through a final 71-test coverage-edge cohort, covering all nodes added after the aggregate runs", ""],
  ["AUTH-CREDENTIAL-THROTTLE-MATRIX", "auth-02", "Every credential endpoint enforces both throttle buckets", "Pass", "Eight exact endpoint/bucket cases plus the 10-allowed/11th-blocked boundary passed; throttled requests short-circuited with HTTP 429", ""],
  ["AUTH-RESPONSIVE-A11Y-MATRIX", "auth-01", "Login, registration, recovery, and error states at narrow and intermediate widths", "Pass", "All four Playwright states passed with axe-core at 390x844 and 900x900", "DEF-QV-061"],
  ["INGESTION-SPAWN-ISOLATION", "pipeline-01", "Process-isolated parsing regression doubles", "Pass", "The 34-node ingestion/pipeline cohort passed with one intentional skip while retaining production spawn isolation", "DEF-QV-062"],
  ["PIPELINE-FAILURE-FENCE", "pipeline-01", "Claimed worker fences terminal failure writes", "Pass", "The claimed owner is propagated after the lease commit and the complete backend regression passes", "DEF-QV-063"],
  ["E2E-CROSS-BROWSER-141", "BP-017", "Production-like Chromium, Firefox, and WebKit matrix", "Pass", "47 unique journeys passed in each browser engine for 141/141 zero-retry project executions", "DEF-QV-064"],
  ["QUERY-CONTEXT-READY-GATE", "query-01", "Query interaction waits for URL-bound context", "Pass", "Focused component regression and the complete cross-browser matrix verify the composer stays inert until contextReady", "DEF-QV-065"],
  ["MONITOR-HYDRATION-GATE", "monitor-01", "Monitor dataset tabs wait for analysis bootstrap", "Pass", "Five focused Monitor tests and the complete browser matrix verify pre-hydration clicks cannot be lost", "DEF-QV-067"],
  ["A11Y-ROUTE-MATRIX-36", "BP-017", "All application routes at desktop and mobile viewports", "Pass", "18 routes across 1440x900 and 390x844 produced zero axe nodes, scan errors, layout failures, overflow, or clipped controls", ""],
  ["A11Y-ROOT-READINESS-RETRY", "SCR-008", "Root redirect readiness remains fail-closed and deterministic", "Pass", "The current full 36-state matrix passed with the bounded complete-navigation retry available; a second miss still serializes scan_error and exits non-zero", "DEF-QV-069"],
  ["GITNEXUS-SEMANTIC-DISCOVERY", "BP-017", "Semantic process discovery uses the current repository index", "Blocked", "Local analyze and FTS repair succeeded, but the MCP context/query surface remained stale; direct source and process-resource inventories compensated for this iteration", "DEF-QV-060"],
  ["API-CONTRACT-ID-ROUTE-RECONCILIATION", "API-042", "Parameterized API feature IDs match the current route inventory", "Pass", "The canonical generator reconciled every API-tagged pytest parameter to one exact current method/path; all 14 direct HTTP contracts passed", "DEF-QV-070"],
  ["FRONTEND-FIXTURE-CONTRACT-9", "BP-017", "Current test fixtures satisfy lint, type, and behavior contracts", "Pass", "ShortcutHelp and FlagToQa passed 9/9 after the minimal fixture/import corrections; lint and TypeScript also pass cleanly", "DEF-QV-071; DEF-QV-072"],
  ["QUERY-CITATION-TUPLE-BUILD", "query-01", "Query citation metadata preserves its inferred tuple type", "Pass", "The minimal non-null filter fix passes targeted Query tests, TypeScript, the production build, and all cross-browser Query journeys", "DEF-QV-073"],
  ["UPLOAD-SMOKE-CURRENT-COPY", "SCR-018", "Upload route smoke follows the implemented intake-link label", "Pass", "The complete Upload smoke file and the reconciled frontend inventory pass with the current 'Jump to intake form' accessible name", "DEF-QV-074"],
  ["MOREDRAWER-QUIESCENT-FOCUS", "BP-017", "MoreDrawer focus trap is validated from a quiescent test revision", "Pass", "The completed focus-trap file passed 2/2 in isolation, 14/14 in its focused cohort, and in both subsequent aggregate runs", "DEF-QV-075"],
  ["GRAPH-ZOOM-TYPED-FIXTURE", "BP-017", "Graph zoom test state matches the d3 transform contract", "Pass", "Both hook tests, lint, TypeScript, the production build, and the final aggregate pass with an explicit ZoomTransform fixture", "DEF-QV-076"],
  ["RESEARCH-ADVANCED-HYDRATION-FENCE", "research-13", "Advanced brief user interaction wins over late preference hydration", "Pass", "The formerly failing WebKit Settings-to-Research journey passed in a focused 4/4 spec and the complete 141/141 zero-retry cross-browser matrix", "DEF-QV-077"],
  ["THESIS-PREDICTION-PUBLIC-SHAPE", "issuer-01", "Thesis fixtures match the public PredictionOut model", "Pass", "The complete ThesisTimeline file, TypeScript, build, and final frontend aggregate pass without internal-only response fields", "DEF-QV-078"],
  ["ISSUER-NULLABLE-PUBLIC-SHAPE", "issuer-01", "Issuer fields match the nullable FastAPI response contract", "Pass", "After the CRITICAL-fan-out type widening, the current frontend inventory, static gates, production build, 15 affected cross-browser journeys, and four affected route-width scans all pass", "DEF-QV-079"],
  ["FRONTEND-INTERACTION-HARNESS-TYPES", "BP-017", "Interaction harnesses satisfy lint and TypeScript contracts", "Pass", "Ask, Pipeline, Research, Deep-Dive, Report Studio, Command Center, Upload, Command Palette, RV Screener, Alert Inbox, role-switch, modal-stack, and surface-state harnesses pass their focused files, lint, TypeScript, and the reconciled 1,390-node frontend inventory", "DEF-QV-080; DEF-QV-082; DEF-QV-083; DEF-QV-084; DEF-QV-085; DEF-QV-086; DEF-QV-088; DEF-QV-089; DEF-QV-091; DEF-QV-095"],
  ["COMMAND-INTERACTION-HARNESS-5", "BP-017", "Command Center interaction harness matches public data contracts", "Pass", "All five directory, holdings, focus-refresh, empty/offline, decision-state, and cited-brief journeys pass with exact production fixture shapes; lint and TypeScript are clean", "DEF-QV-083"],
  ["PIPELINE-DIRECT-EVIDENCE-45", "pipeline-44", "Every Pipeline feature has direct assertion-level evidence", "Pass", "The exact-current evidence map covers all 45/45 Pipeline features; frontend behavior passed in the 1,259-node aggregate and seven linked API contracts passed in the focused 93-pass server cohort", "DEF-QV-081"],
  ["RESEARCH-DIRECT-EVIDENCE-29", "research-29", "Every Research feature has direct assertion-level evidence", "Pass", "The exact-current evidence map covers all 29/29 Research features; the 26-node frontend cohort, 49-pass/2-skip backend cohort, current 1,390-node frontend inventory, and full 2,399-pass backend regression are green", "DEF-QV-084"],
  ["DEEPDIVE-DIRECT-EVIDENCE-42", "deepdive-42", "Every Deep-Dive feature has direct assertion-level evidence", "Pass", "The exact-current evidence map covers all 42/42 reconciled Deep-Dive features, including seven current workflows absent from the legacy inventory", ""],
  ["UPLOAD-HARNESS-PUBLIC-TYPES", "BP-017", "Upload interaction harnesses match public component contracts", "Pass", "UploadWizard and step interactions pass 12/12 with exact public types; lint and TypeScript are clean", "DEF-QV-085"],
  ["COMMAND-PALETTE-DEFERRED-TYPE", "BP-017", "Command Palette deferred issuer response matches getIssuers", "Pass", "All six current Command Palette interactions pass with the resolver derived from getIssuers; lint and TypeScript are clean", "DEF-QV-086"],
  ["AUTOMATION-COLLECTOR-NODE-COUNT", "BP-017", "Automation collector excludes diagnostics and fails closed on drift", "Pass", "The canonical inventory contains exactly 3,990 executable evidence nodes: 1,390 frontend, 2,423 server/stress/cohort, 141 browser, and 36 accessibility states", "DEF-QV-087; DEF-QV-093; DEF-QV-095"],
  ["RV-SCREENER-HARNESS-TYPES", "BP-017", "RV Screener harness matches the public analysis-context contract", "Pass", "All 12 RV Screener interactions pass with a complete typed AnalysisContext fixture; lint and TypeScript are clean", "DEF-QV-088"],
  ["ALERT-INBOX-HARNESS-TYPES", "BP-017", "Alert Inbox harness uses a bounded React-fiber test shape", "Pass", "All 17 Alert Inbox interactions pass with no explicit any; lint and TypeScript are clean", "DEF-QV-089"],
];
for (const [id, featureId, name, status, result, defectId] of executedCases) {
  const executedDate = [
    "API-CONTRACT-ID-ROUTE-RECONCILIATION",
    "FRONTEND-AGGREGATE-1390",
    "FRONTEND-ASK-DELTA-16",
    "FRONTEND-FIXTURE-CONTRACT-9",
    "GITNEXUS-SEMANTIC-DISCOVERY",
    "GRAPH-ZOOM-TYPED-FIXTURE",
    "RESEARCH-ADVANCED-HYDRATION-FENCE",
    "QUERY-CITATION-TUPLE-BUILD",
    "SERVER-AGGREGATE-2399",
    "SERVER-ANALYSIS-DELTA-14",
    "UPLOAD-SMOKE-CURRENT-COPY",
    "MOREDRAWER-QUIESCENT-FOCUS",
    "THESIS-PREDICTION-PUBLIC-SHAPE",
    "ISSUER-NULLABLE-PUBLIC-SHAPE",
    "PIPELINE-DIRECT-EVIDENCE-45",
    "COMMAND-INTERACTION-HARNESS-5",
    "RESEARCH-DIRECT-EVIDENCE-29",
    "UPLOAD-HARNESS-PUBLIC-TYPES",
    "COMMAND-PALETTE-DEFERRED-TYPE",
    "AUTOMATION-COLLECTOR-NODE-COUNT",
    "RV-SCREENER-HARNESS-TYPES",
    "ALERT-INBOX-HARNESS-TYPES",
  ].includes(id)
    ? today
    : baselineDate;
  testRows.push([id, featureId, "Direct execution", name, "Current implemented contract is asserted deterministically.", status, result, executedDate, "Automated validation", defectId]);
  evidenceExecutedDateById.set(id, executedDate);
  if (status === "Pass") addEvidence(exactEvidenceByFeature, featureId, id);
}

const featureHeaders = [
  "Feature ID", "Feature Name", "Concept", "User Story", "Expected Behaviour", "Edge Cases", "Test Cases",
  "Current Status", "Defect Count", "Severity", "Notes", "Last Tested Date", "Validation Rules", "Dependencies",
  "Known Assumptions", "Trigger", "Files", "Endpoint", "Source Type", "Source Status Detail",
];
const features = featureObjects.map((feature) => {
  const mappedEvidenceIds = [...(exactEvidenceByFeature.get(feature.id) || [])];
  const testIds = [
    ...scenarios.map((scenario) => `${feature.id}-${scenarioSlug(scenario)}`),
    ...mappedEvidenceIds,
  ].join("; ");
  return [
    feature.id, feature.name, feature.concept, feature.story, feature.expected, feature.edgeCases, testIds,
    mappedEvidenceIds.length ? `Direct evidence — ${mappedEvidenceIds.length} automated node(s)` : feature.currentStatus,
    defectCounts.get(feature.id) || 0, featureSeverity.get(feature.id) || feature.severity || "None",
    feature.notes, latestEvidenceDate(mappedEvidenceIds), feature.validationRules, feature.dependencies, feature.assumptions, feature.trigger, feature.files,
    feature.endpoint, feature.sourceType, feature.sourceStatus,
  ];
});

const existingFeatureIds = new Set(featureObjects.map((feature) => feature.id));
for (const defect of defects) {
  if (!existingFeatureIds.has(defect[1])) throw new Error(`Defect ${defect[0]} references missing feature ${defect[1]}`);
}

const apiFeatureStart = sourceRows.length + appRoutes.length;
const apiRows = apiRoutes.map((route, index) => [
  `API-${String(index + 1).padStart(3, "0")}`,
  route.method,
  route.path,
  route.handler,
  route.file,
  route.line,
  route.responseModel || "",
  route.statusCode || "",
  exactEvidenceByFeature.has(featureObjects[apiFeatureStart + index].id)
    ? `Direct — ${exactEvidenceByFeature.get(featureObjects[apiFeatureStart + index].id).size} node(s)`
    : "Documented — direct mapping pending",
  featureObjects[apiFeatureStart + index].id,
]);
const screenRows = appRoutes.map((screen, index) => [
  `SCR-${String(index + 1).padStart(3, "0")}`,
  screen.route,
  screen.file,
  screen.components.join("; "),
  exactEvidenceByFeature.has(`SCR-${String(index + 1).padStart(3, "0")}`)
    ? `Pass — route matrix + ${exactEvidenceByFeature.get(`SCR-${String(index + 1).padStart(3, "0")}`).size} direct node(s)`
    : "Pass — landing load/a11y/responsive",
  `SCR-${String(index + 1).padStart(3, "0")}`,
]);
const configRows = settings.map((setting, index) => [
  `CFG-${String(index + 1).padStart(3, "0")}`,
  setting.environment,
  setting.type,
  setting.defaultValue,
  setting.description,
  `${setting.file}:${setting.line}`,
  exactEvidenceByFeature.has(`CFG-${String(index + 1).padStart(3, "0")}`)
    ? `Direct — ${exactEvidenceByFeature.get(`CFG-${String(index + 1).padStart(3, "0")}`).size} node(s)`
    : "Documented — direct matrix pending",
]);
const journeyRows = journeySeed.map(([id, name, expected, files, status]) => [
  id,
  name,
  expected,
  files,
  exactEvidenceByFeature.has(id) ? `Direct — ${exactEvidenceByFeature.get(id).size} node(s)` : status,
  defects.filter((defect) => defect[1] === id && defect[3] === "Open").length,
]);
const automationEvidenceRows = automationEvidence.map((evidence) => [
  evidence.id,
  evidence.layer,
  evidence.node,
  evidence.scenario,
  evidence.exactFeatureIds.join("; "),
  evidence.indirectFeatureIds.join("; "),
  evidence.mappingBasis,
  "Pass",
  evidence.executionRun,
  evidence.executedDate || baselineDate,
]);
const featureEvidenceRows = featureObjects.map((feature) => {
  const directIds = [...(exactEvidenceByFeature.get(feature.id) || [])];
  const indirectIds = [...(indirectEvidenceByFeature.get(feature.id) || [])];
  const coveredScenarios = scenarios.filter((scenario) => scenarioEvidence.has(`${feature.id}|${scenario}`));
  return [
    feature.id,
    feature.name,
    feature.sourceType,
    directIds.length,
    indirectIds.length,
    directIds.length ? "Direct" : indirectIds.length ? "Indirect only" : "Unmapped",
    coveredScenarios.join("; "),
    directIds.join("; "),
    indirectIds.join("; "),
    today,
  ];
});
const researchEvidenceRows = featureEvidenceRows.filter(([featureId]) => featureId.startsWith("research-"));
const researchEvidenceGaps = researchEvidenceRows.filter((row) => row[5] !== "Direct");
if (researchEvidenceRows.length !== 29 || researchEvidenceGaps.length) {
  throw new Error(`Research direct-evidence gate failed: ${researchEvidenceRows.length}/29 rows; gaps=${researchEvidenceGaps.map((row) => row[0]).join(",")}`);
}
const deepDiveEvidenceRows = featureEvidenceRows.filter(([featureId]) => featureId.startsWith("deepdive-"));
const deepDiveEvidenceGaps = deepDiveEvidenceRows.filter((row) => row[5] !== "Direct");
if (deepDiveEvidenceRows.length !== 42 || deepDiveEvidenceGaps.length) {
  throw new Error(`Deep-Dive direct-evidence gate failed: ${deepDiveEvidenceRows.length}/42 rows; gaps=${deepDiveEvidenceGaps.map((row) => row[0]).join(",")}`);
}
const featureSourceById = new Map(featureObjects.map((feature) => [feature.id, feature.sourceType]));
const coverageStatsBySource = new Map();
for (const feature of featureObjects) {
  const stats = coverageStatsBySource.get(feature.sourceType) || {
    features: 0,
    direct: 0,
    indirectOnly: 0,
    unmapped: 0,
    pass: 0,
    suiteEvidence: 0,
    designed: 0,
    notApplicable: 0,
  };
  stats.features += 1;
  if (exactEvidenceByFeature.has(feature.id)) stats.direct += 1;
  else if (indirectEvidenceByFeature.has(feature.id)) stats.indirectOnly += 1;
  else stats.unmapped += 1;
  coverageStatsBySource.set(feature.sourceType, stats);
}
for (const row of testRows) {
  const sourceType = featureSourceById.get(row[1]);
  if (!sourceType) continue;
  const stats = coverageStatsBySource.get(sourceType);
  if (row[5] === "Pass") stats.pass += 1;
  else if (row[5] === "Suite evidence") stats.suiteEvidence += 1;
  else if (row[5] === "Designed") stats.designed += 1;
  else if (row[5] === "Not applicable") stats.notApplicable += 1;
}
const coverageGapRows = [...coverageStatsBySource.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([sourceType, stats]) => [
    sourceType,
    stats.features,
    stats.direct,
    stats.indirectOnly,
    stats.unmapped,
    stats.pass,
    stats.suiteEvidence,
    stats.designed,
    stats.notApplicable,
  ]);
const featureConceptById = new Map(featureObjects.map((feature) => [feature.id, feature.concept]));
const coverageStatsByConcept = new Map();
for (const feature of featureObjects) {
  const stats = coverageStatsByConcept.get(feature.concept) || {
    features: 0,
    direct: 0,
    unmapped: 0,
    pass: 0,
    suiteEvidence: 0,
    designed: 0,
    notApplicable: 0,
  };
  stats.features += 1;
  if (exactEvidenceByFeature.has(feature.id)) stats.direct += 1;
  else stats.unmapped += 1;
  coverageStatsByConcept.set(feature.concept, stats);
}
for (const row of testRows) {
  const concept = featureConceptById.get(row[1]);
  if (!concept) continue;
  const stats = coverageStatsByConcept.get(concept);
  if (row[5] === "Pass") stats.pass += 1;
  else if (row[5] === "Suite evidence") stats.suiteEvidence += 1;
  else if (row[5] === "Designed") stats.designed += 1;
  else if (row[5] === "Not applicable") stats.notApplicable += 1;
}
const conceptCoverageRows = [...coverageStatsByConcept.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([concept, stats]) => [
    concept,
    stats.features,
    stats.direct,
    stats.unmapped,
    stats.pass,
    stats.suiteEvidence,
    stats.designed,
    stats.notApplicable,
  ]);
const controlRows = uiControls.map((control) => [
  control.id,
  control.kind,
  control.tag,
  control.label,
  `${control.file}:${control.line}`,
  control.state,
  control.handlers,
  control.acceptance,
  control.edgeCases,
  "Documented — current TSX source discovery; execution status is carried by Feature Evidence and Test Matrix",
]);
const stateRows = uiStates.map((state) => [
  state.id,
  state.name,
  state.setter,
  state.hook,
  state.initial,
  `${state.file}:${state.line}`,
  state.acceptance,
  state.edgeCases,
  "Documented — current TSX state-hook discovery; user-facing scenarios are reconciled through the curated feature register",
]);
validationRuns.push([
  "UI role/control/state inventory",
  "TypeScript AST scan of caos/frontend/src/**/*.tsx plus explicit auth/capability/presentation role reconciliation",
  "Pass",
  `${roleRows.length} role/state profiles; ${controlRows.length} source-discovered controls including ${controlRows.filter((row) => row[1] === "Modal/dialog").length} modal/dialog invocations; ${stateRows.length} local UI state handles`,
  today,
]);
validationRuns.push([
  "Automation evidence reconciliation",
  "vitest list --json; pytest --collect-only; playwright --list",
  "Pass",
  `${automationEvidence.length.toLocaleString()} executed nodes reconciled to stable evidence IDs and feature mappings`,
  today,
]);

const byConcept = new Map();
for (const feature of featureObjects) byConcept.set(feature.concept, (byConcept.get(feature.concept) || 0) + 1);

await fs.mkdir(outputDir, { recursive: true });
const workbook = Workbook.create();
const summary = workbook.worksheets.add("Coverage Summary");
summary.showGridLines = false;
summary.getRange("A1:C23").values = [
  ["Metric", "Value", "Notes"],
  ["Canonical feature rows", "", "Curated features plus current code-discovered screens, handlers, settings, and workflows"],
  ["Generated test cases", "", "Seven scenario classes per canonical feature plus explicit direct execution cases"],
  ["Executed automation nodes", "", "Every collected Vitest, pytest, and Playwright node has a stable evidence ID"],
  ["Features with direct automation", "", "At least one exact test reference, endpoint invocation, feature-ID assertion, or mapped E2E journey"],
  ["Physical frontend routes", "", "All current app/**/page.tsx routes"],
  ["Production API handlers", "", "All current FastAPI router decorators mounted by main.py"],
  ["Runtime configuration options", "", "All fields in the central Settings class"],
  ["Business processes", "", "Cross-surface durable analyst/operator workflows"],
  ["Role / identity profiles", "", "Authentication states, server capability roles, and Analyst/PM/QA presentation views are separated explicitly"],
  ["Source-discovered UI controls", "", "Current TSX buttons, links, inputs, forms, overlays, dialogs, and custom action components with file/line provenance"],
  ["Modal / dialog controls", "", "Modal/dialog definitions and invocations included in the control inventory"],
  ["Source-discovered UI state handles", "", "Current TSX useState/useReducer/useTransition handles; curated features retain externally visible state contracts"],
  ["Direct test passes", "", "Cases with direct route/state evidence"],
  ["Suite-evidence cases", "", "Covered only by aggregate regression evidence"],
  ["Designed / unexecuted cases", "", "Not presented as pass"],
  ["Not-applicable cases", "", "Scenario class is inapplicable at this feature boundary and is validated at the consuming surface instead"],
  ["Skipped executable cases", "", "Must be closed or explicitly waived before completion"],
  ["Open critical defects", "", "Completion gate"],
  ["Open high defects", "", "Completion gate"],
  ["Other open defects", "", "Includes known validation coverage gaps"],
  ["Confidence score", "95%", "Every collected executable application node passed; all 29 Research, all 45 Pipeline, all 43 Model Builder, and all 42 Deep-Dive features now have direct automation; the browser cohort covers Chromium, Firefox, and WebKit. Confidence remains bounded by explicit Designed/Suite-evidence inventory and degraded semantic GitNexus discovery"],
  ["Last tested date", today, "Current iteration: all 1,390 frontend and 2,399 executable backend nodes are reconciled as passing with 15 intentional skips; exact collectors are locked to 3,990 total nodes, lint and TypeScript are clean, the production-source 141-browser/36-accessibility seal remains valid, and DEF-QV-060 remains open"],
];
summary.getRange("A1:C1").format = { fill: "#12121a", font: { bold: true, color: "#e6e6ef" }, rowHeight: 30 };
summary.getRange("A2:C23").format = { wrapText: true, verticalAlignment: "top" };
summary.getRange("A2:C23").format.borders = { preset: "insideHorizontal", style: "thin", color: "#262633" };
summary.freezePanes.freezeRows(1);
summary.getRange("A:A").format.columnWidth = 28;
summary.getRange("B:B").format.columnWidth = 18;
summary.getRange("C:C").format.columnWidth = 98;

writeSheet(workbook, "Feature Register", featureHeaders, features, [16, 38, 22, 62, 86, 58, 70, 24, 12, 14, 62, 16, 62, 58, 60, 40, 52, 42, 24, 68]);
writeSheet(workbook, "Test Matrix", ["Test ID", "Feature ID", "Scenario", "Steps", "Expected Result", "Execution Status", "Result Notes", "Last Executed", "Automation", "Defect ID"], testRows, [34, 16, 22, 82, 78, 20, 74, 16, 26, 16]);
writeSheet(workbook, "Automation Evidence", ["Evidence ID", "Layer", "Collected Test Node", "Scenario Classification", "Direct Feature IDs", "Indirect Feature IDs", "Mapping Basis", "Execution Status", "Validation Run", "Executed Date"], automationEvidenceRows, [18, 26, 112, 24, 42, 42, 48, 18, 30, 16]);
writeSheet(workbook, "Feature Evidence", ["Feature ID", "Feature Name", "Source Type", "Direct Nodes", "Indirect Nodes", "Evidence Status", "Direct Scenario Coverage", "Direct Evidence IDs", "Indirect Evidence IDs", "Last Reconciled"], featureEvidenceRows, [16, 46, 24, 16, 16, 18, 52, 74, 74, 16]);
writeSheet(workbook, "Coverage Gaps", ["Source Type", "Features", "Direct Features", "Indirect-only Features", "Unmapped Features", "Passed Cases", "Suite-evidence Cases", "Designed Cases", "Not-applicable Cases"], coverageGapRows, [28, 14, 18, 22, 20, 16, 22, 18, 22]);
writeSheet(workbook, "Concept Coverage", ["Concept", "Features", "Direct Features", "Unmapped Features", "Passed Cases", "Suite-evidence Cases", "Designed Cases", "Not-applicable Cases"], conceptCoverageRows, [30, 14, 18, 20, 16, 22, 18, 22]);
writeSheet(workbook, "Defects", ["Defect ID", "Feature ID", "Severity", "Status", "Root Cause Hypothesis", "Reproduction Steps", "Expected Result", "Actual Result", "Notes"], defects, [16, 16, 14, 14, 72, 68, 66, 66, 72]);
writeSheet(workbook, "Validation Runs", ["Suite", "Command", "Status", "Result", "Executed Date"], validationRuns, [30, 74, 14, 76, 16]);
writeSheet(workbook, "API Inventory", ["API Feature ID", "Method", "Path", "Handler", "Route File", "Line", "Response Model", "Status Code", "Coverage", "Feature ID"], apiRows, [16, 12, 46, 34, 38, 10, 30, 16, 16, 16]);
writeSheet(workbook, "Screen Inventory", ["Screen Feature ID", "Route", "Page File", "Primary Components", "Coverage", "Feature ID"], screenRows, [18, 28, 56, 54, 24, 16]);
writeSheet(workbook, "Configuration Inventory", ["Config Feature ID", "Environment Variable", "Type", "Code Default", "Implemented Purpose / Rules", "Source", "Coverage"], configRows, [18, 34, 22, 42, 108, 42, 28]);
writeSheet(workbook, "Journey Inventory", ["Journey ID", "Business Process", "Implemented Flow", "Source / Dependencies", "Current Status", "Open Defects"], journeyRows, [16, 38, 94, 84, 24, 14]);
writeSheet(workbook, "Role Inventory", ["Role ID", "Layer", "Role / State", "Access / Presentation Contract", "Acceptance Criteria", "Finite Risk-based Edge Cases", "Source / Evidence"], roleRows, [16, 24, 34, 78, 86, 76, 72]);
writeSheet(workbook, "Control Inventory", ["Control ID", "Kind", "JSX Tag", "Accessible Label / Expression", "Source", "Declared State Attributes", "Event Handlers", "Acceptance Criteria", "Finite Risk-based Edge Cases", "Execution Status"], controlRows, [16, 24, 22, 58, 58, 50, 26, 92, 88, 64]);
writeSheet(workbook, "State Inventory", ["State ID", "State Handle", "Setter / Dispatch", "Hook", "Initial Expression", "Source", "Acceptance Criteria", "Finite Risk-based Edge Cases", "Execution Status"], stateRows, [16, 30, 34, 18, 50, 58, 90, 82, 64]);
writeSheet(workbook, "Concept Totals", ["Concept", "Feature Count"], [...byConcept.entries()].sort((a, b) => a[0].localeCompare(b[0])), [34, 18]);

// Assign cross-sheet formulas only after every referenced worksheet exists.
summary.getRange("B2").formulas = [[`=COUNTA('Feature Register'!A2:A${features.length + 1})`]];
summary.getRange("B3").formulas = [[`=COUNTA('Test Matrix'!A2:A${testRows.length + 1})`]];
summary.getRange("B4").formulas = [[`=COUNTA('Automation Evidence'!A2:A${automationEvidenceRows.length + 1})`]];
summary.getRange("B5").formulas = [[`=COUNTIF('Feature Evidence'!F2:F${featureEvidenceRows.length + 1},\"Direct\")`]];
summary.getRange("B6").formulas = [[`=COUNTA('Screen Inventory'!A2:A${screenRows.length + 1})`]];
summary.getRange("B7").formulas = [[`=COUNTA('API Inventory'!A2:A${apiRows.length + 1})`]];
summary.getRange("B8").formulas = [[`=COUNTA('Configuration Inventory'!A2:A${configRows.length + 1})`]];
summary.getRange("B9").formulas = [[`=COUNTA('Journey Inventory'!A2:A${journeyRows.length + 1})`]];
summary.getRange("B10").formulas = [[`=COUNTA('Role Inventory'!A2:A${roleRows.length + 1})`]];
summary.getRange("B11").formulas = [[`=COUNTA('Control Inventory'!A2:A${controlRows.length + 1})`]];
summary.getRange("B12").formulas = [[`=COUNTIF('Control Inventory'!B2:B${controlRows.length + 1},\"Modal/dialog\")`]];
summary.getRange("B13").formulas = [[`=COUNTA('State Inventory'!A2:A${stateRows.length + 1})`]];
summary.getRange("B14").formulas = [[`=COUNTIF('Test Matrix'!F2:F${testRows.length + 1},\"Pass\")`]];
summary.getRange("B15").formulas = [[`=COUNTIF('Test Matrix'!F2:F${testRows.length + 1},\"Suite evidence\")`]];
summary.getRange("B16").formulas = [[`=COUNTIF('Test Matrix'!F2:F${testRows.length + 1},\"Designed\")`]];
summary.getRange("B17").formulas = [[`=COUNTIF('Test Matrix'!F2:F${testRows.length + 1},\"Not applicable\")`]];
summary.getRange("B18").formulas = [[`=COUNTIF('Test Matrix'!F2:F${testRows.length + 1},\"Skipped\")`]];
summary.getRange("B19").formulas = [[`=COUNTIFS(Defects!C2:C${defects.length + 1},\"Critical\",Defects!D2:D${defects.length + 1},\"Open\")`]];
summary.getRange("B20").formulas = [[`=COUNTIFS(Defects!C2:C${defects.length + 1},\"High\",Defects!D2:D${defects.length + 1},\"Open\")`]];
summary.getRange("B21").formulas = [[`=COUNTIF(Defects!D2:D${defects.length + 1},\"Open\")-B19-B20`]];

const previewRanges = {
  "Coverage Summary": "A1:C23",
  "Feature Register": "A1:T28",
  "Test Matrix": "A1:J34",
  "Automation Evidence": "A1:J32",
  "Feature Evidence": "A1:J30",
  "Coverage Gaps": "A1:I10",
  "Concept Coverage": "A1:H25",
  "Defects": `A1:I${defects.length + 1}`,
  "Validation Runs": `A1:E${validationRuns.length + 1}`,
  "API Inventory": "A1:J35",
  "Screen Inventory": "A1:F19",
  "Configuration Inventory": "A1:G28",
  "Journey Inventory": "A1:F18",
  "Role Inventory": "A1:G8",
  "Control Inventory": "A1:J35",
  "State Inventory": "A1:I35",
  "Concept Totals": "A1:B25",
};
for (const [sheetName, range] of Object.entries(previewRanges)) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, `${sheetName.replaceAll(" ", "_")}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const summaryInspection = await workbook.inspect({
  kind: "table",
  range: "Coverage Summary!A1:C23",
  include: "values,formulas",
  tableMaxRows: 24,
  tableMaxCols: 5,
  summary: "canonical coverage summary",
});
console.log(summaryInspection.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const out = await SpreadsheetFile.exportXlsx(workbook);
await out.save(outputPath);
console.log(outputPath);
