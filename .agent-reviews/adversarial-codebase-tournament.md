# CAOS GitNexus Grouped Adversarial Rewrite Tournament

Date: 2026-07-15  
Branch baseline: `codex/112@7b16397`  
Mode: review-only; production source remains unchanged; candidates are verified on scratch copies.

## Index evidence

- `node .gitnexus/run.cjs status`: active branch index is up to date at `7b16397`.
- The flat MCP registry is stale (`main` is 322 commits behind and its cached
  `codex/112` row still points at `5c3466d`), so every graph query in this
  review is pinned to `branch: codex/112`.
- Pinned graph: 20,532 nodes: 5,311 functions, 4,133 sections, 3,371
  properties, 2,917 variables, 1,455 files, 1,189 constants, 504 communities,
  466 classes, 327 interfaces, 300 processes, 295 methods, 131 routes, 129
  folders, and 4 tools.
- The graph exposes 56 heuristic community labels. Generic labels and small
  Leiden clusters are assigned by their files and cross-community edges; they
  are not treated as product modules in their own right.
- Strongest cross-community edges include Routes → Server (111), Engine →
  Server (41), Server → Routes (39), Deepdive → Pipeline (17), Server → Engine
  (14), Command → Monitor (13), Model → Decisions (12), Routes → Engine (12),
  Command → Pipeline (10), and Model → Reports (9).

## Review groups

The target is a representative rewrite tournament, not a claim that one symbol
exhausts every line in its group. Group-wide adversarial findings and
target-specific rewrite results are reported separately.

| Group | Connected responsibilities | Dominant graph labels | Representative target |
|---|---|---|---|
| G1 Core CP engine | CP-0/CP-X routing, dependency layers, synthesis, QA gates, fact projection | Engine, Stress | `caos/server/engine/runner.py::execute_run` (190-572) |
| G2 Model/workbook projections | debt/PIK roll-forward, cash flow, overrides, checkpoints, workbook identity | Model plus model-engine Server/Routes | `caos/server/model_engine_v2.py::ModelEngine.calculate` (604-1416) |
| G3 API/auth/tenancy/persistence | identity, role gates, issuer/portfolio scope, database lifecycle | Routes, Server | `caos/server/identity.py::get_identity` (132-237) |
| G4 Ingestion/lineage/pipeline | uploads, vaulting, reconciliation, run lineage, pipeline execution | Upload, Pipeline plus ingestion/lineage Server/Routes | `caos/server/lineage_reconciliation.py::reconcile_lineage` (222-507) |
| G5 Query/research/LLM safety | retrieval, query planning/synthesis, evidence grounding, research jobs, Ask | Query, Research, Ask/deep-research clusters | `caos/server/nlquery.py::execute_synthesis` (608-768) |
| G6 Portfolio/desk decisions | exposures, stress, Command, Monitor, alerts, decisions, committee context | Portfolio, Command, Monitor, Alerts, Decisions, Cohort | `caos/server/engine/portfolio.py::compute_portfolio_analytics` (290-413) |
| G7 Issuer analysis surfaces | issuer profile, Deep-Dive, sector review, RV, sponsor context | Profile, Issuers, Deepdive, Sector, Rv, Sponsors | `caos/server/routes/issuers.py::get_issuer_profile` (677-787) |
| G8 Reports/exports/charts | report composition, XLSX/PDF export, paper rendering, chart payloads | Reports, Charts | `caos/server/report_exports.py::render_report_xlsx` (255-594) |
| G9 Shared frontend shell | auth state, navigation, unsaved-work guards, settings, shared composition | Settings, App, shared Cluster_163-192/262-263 | `caos/frontend/src/components/shared/NavigationGuardProvider.tsx::NavigationGuardProvider` (52-221) |
| G10 QA/bench/scripts/tooling | regression harnesses, corpus goldens, complexity and release checks | Scripts, Bench, Golden, Qa, Perf, Tools, Versions, Edgar | `caos/scripts/check_complexity_delta.py::main` (line range to confirm before tournament) |

## Repository financial invariants

1. CP-1-derived leverage, debt, EBITDA, coverage, and related multiplications or
   divisions are admitted only after `engine.periods.is_finite_number`; a zero
   or degenerate denominator degrades to `None`, never NaN/Inf or a crash.
2. Model debt schedules preserve `closing = opening + draws + PIK - repayments
   - scheduled amortization`; PIK toggles and overrides cannot silently change
   cash interest or closing balances.
3. Free cash flow preserves `adjusted EBITDA - cash interest - taxes - capex +
   working-capital change + other cash flow`, with missing required inputs
   remaining unavailable rather than coerced to zero.
4. Covenant headroom preserves actual-vs-threshold meaning, add-back caps,
   maintenance/cov-lite distinctions, and finite leverage guards.
5. Recovery preserves absolute priority between ranks and pari-passu allocation
   within a rank. An unsized senior tranche makes junior recovery indeterminate;
   non-finite claims never enter the waterfall.
6. QA-Blocked financial outputs cannot project facts, seed models/scenarios, or
   become Committee Ready through a downstream roll-up.
7. YTM and discount margin are ingested finite passthrough fields. This codebase
   does not implement a native yield solver or day-count convention, so the
   tournament must not invent or alter one.

## G1 — Core CP engine

### Target and impact set

Target: `caos/server/engine/runner.py::execute_run`, GitNexus lines 190-572.

- Exact direct caller: `caos/server/run_executor.py::execute_run_by_id`.
- Upstream blast radius: LOW, 16 symbols: d1=1, d2=13, d3=2. The d2/d3 set
  includes `InProcessExecutor._run_with_sem`, `QueueWorker._run_loop`,
  `InProcessExecutor.enqueue`, `QueueWorker.start`, and focused tests in
  `test_async_runs.py`, `test_budget.py`, `test_engine.py`, `test_retention.py`,
  `test_runner_fault_isolation.py`, and `test_specialized_modules.py`.
- Downstream blast radius: CRITICAL, 59 symbols: d1=23, d2=21, d3=15; 72
  affected processes across Engine and Server.
- Direct dependencies: `demo_fixture_finding`, `qa_status_from`,
  `committee_status_from`, `roll_up_qa_status`, `worst_confidence`,
  `validate_lineage`, `extract_facts`, `extract_cost_facts`,
  `build_route_plan`, `all_specs`, `_stamp_prompt_version`, `_now`,
  `_dependency_layers`, `_apply_blocked_upstream_cascade`, nested `_run_layer`,
  `_persist_cpx`, `_persist_cp5b`, `_persist_cp5c`, `_persist_cp5`,
  `get_synthesizer`, `build_issuer_index`, `get_settings`, and `get_reviewer`.
- Affected process names: `get_model_v2`, `restore_model_v2_checkpoint`,
  `create_stress_run`, `get_research_report`, `get_rv_screen`,
  `patch_agenda_item`, `finalize_agenda_item`,
  `mutate_model_v2_overrides_batch`, `replay_model_v2_event`, `create_run`,
  `get_analytics`, `create_insight`, `put_report_draft`,
  `preview_market_snapshot_import`, `preview_report_version`, both portfolio
  `get_portfolio` flows, `list_insights`, `reject_insight`, `get_agenda_item`,
  `get_run_freshness`, `create_decision`, `get_issuer_freshness`, `nl_query`,
  `get_autonomy_draft`, `ingestion_gaps`, `put_reporting_profile`,
  `patch_alert_event`, `reopen`, `get_chunk`, `get_watchlist`, `patch_context`,
  `get_positions`, `create_query_run`, `get_command_snapshot`, `vault_exhibit`,
  `create_finding`, `get_saved_model`, `daily_digest`, `create_agenda_item`,
  `export_report_version`, `get_context`, `calculate_model_v2`,
  `ratify_insight`, `get_report_draft`, `list_agenda`, `create_sector_review`,
  `patch_analyst_settings`, `commit_market_snapshot_import`, `put_model_v2`,
  `get_sector_review`, `get_report_version`, `create_model_v2_checkpoint`,
  `mutate_model_v2_override`, `get_issuer_profile`, `create_model_checkpoint`,
  `create_context`, `list_decisions`, `get_decision`, `get_reporting_profile`,
  `get_latest_research_report`, `commit_model_workbook_import`,
  `preview_model_workbook_import`, `get_context_lineage`, `get_taxonomy`,
  `get_capabilities`, `create_rv_screen`, `update_holdings`, `patch_finding`,
  `create_report_version`, `get_query_run`, and `get_cross_default_map`.

Contract: keep the async `(session: AsyncSession, run: Run) -> None` interface,
caller-owned commit boundary, Run/DB mutations, exact gate and persistence
ordering, deterministic result order, failure propagation, and all externally
observable status/error/token/model/prompt/fact side effects.

### G1 invariants

- CP-0 runs first; CP-X is persisted before routed analytical modules.
- Registry hard and soft edges both constrain dependency layers.
- Session-bound synthesizers are serial; pure modules may fan out, but results
  are persisted in deterministic module order on one `AsyncSession`.
- Synthesis and unexpected module failures isolate to that module's Blocked
  gate; they do not discard successful same-layer peers.
- CP-5B lineage, CP-5C council, deterministic CP-5, and CP-5D blocked-upstream
  cascade remain in that order.
- Structural findings are included in the CP-5 clearance payload.
- Blocked CP-1/CP-2 outputs do not project metric facts; prior facts are deleted
  only when the same module actually wrote replacements.
- Run-level roll-up uses only `run_blocking` modules. Budget spend is cumulative
  across attempts and remains recoverable after rollback.

### Baseline verification

- Wrong interpreter diagnostic: `caos/server/.venv/bin/python -m pytest ... -q`
  used Python 3.9.6 and failed on `typing.TypeAlias` before app collection; this
  is an environment mismatch, not a candidate result.
- Real focused command:
  `caos/server/.venv311/bin/python -m pytest caos/tests/server/test_runner_layers.py caos/tests/server/test_runner_fault_isolation.py caos/tests/server/test_retention.py caos/tests/server/test_async_runs.py caos/tests/server/test_budget.py caos/tests/server/test_specialized_modules.py caos/tests/server/test_engine.py -q`
- Baseline result: **79 passed, 2 skipped, 1 warning in 5.41s**.
- Financial-invariant command:
  `caos/server/.venv311/bin/python -m pytest caos/tests/server/test_recovery_waterfall_contract.py caos/tests/server/test_nan_guards.py caos/tests/server/test_covenants.py caos/tests/server/test_model_engine_v2.py -q`
- Financial-invariant baseline: **164 passed, 1 warning in 2.18s**.

### Tournament result

Anonymous bracket (the Arbiter received no role labels):

1. Speed (A) defeated Memory (B).
   - A removes the repeated per-module scan by building one findings index,
     whereas B's generator-heavy version saves allocations without improving
     the dominant `O(modules * findings)` roll-up.
   - A preserves concrete lists at API boundaries; B adds iterator lifetime and
     exhaustion risks around helper calls and persistence.
   - A's single retention delete reduces database round-trips while retaining
     the incumbent's module-specific replacement gate.
2. Speed (A) defeated Readability (B).
   - A is shorter without fragmenting the orchestrator into extra indirection.
   - A improves the actual hot paths: one layer partition, one findings index,
     and one retention delete.
   - B improves naming and factoring but leaves more intermediate collection
     construction and repeated work.
3. Speed (A) defeated Incumbent (B).
   - A keeps the exact async signature, caller-owned transaction, persistence
     order, and deterministic side effects.
   - Its time bound improves findings roll-up from `O(M * F)` to `O(M + F)` and
     reduces one database round-trip.
   - The extra dictionaries/lists are bounded by the existing module and finding
     sets and materially improve maintainability of the roll-up path.

**Winner: Snippet A (Speed)**, replacing
`caos/server/engine/runner.py:190-572`. The repository source remains unchanged;
the winning code is applied only at
`/tmp/caos-g1-speed-019f67d3/engine/runner.py` pending any later remediation
authorization.

### Orchestrator verification

- Scratch import proof: `engine.runner.__file__` resolved to
  `/tmp/caos-g1-speed-019f67d3/engine/runner.py`, not the repository copy.
- Focused + financial command:
  `PYTHONPATH=/tmp/caos-g1-speed-019f67d3 caos/server/.venv311/bin/python -m pytest caos/tests/server/test_runner_layers.py caos/tests/server/test_runner_fault_isolation.py caos/tests/server/test_retention.py caos/tests/server/test_async_runs.py caos/tests/server/test_budget.py caos/tests/server/test_specialized_modules.py caos/tests/server/test_engine.py caos/tests/server/test_recovery_waterfall_contract.py caos/tests/server/test_nan_guards.py caos/tests/server/test_covenants.py caos/tests/server/test_model_engine_v2.py -q`
- Result: **243 passed, 2 skipped, 1 warning in 6.25s**.
- Full server command:
  `PYTHONPATH=/tmp/caos-g1-speed-019f67d3 caos/server/.venv311/bin/python -m pytest caos/tests/server -q`
- Result in the restricted sandbox: **1,829 passed, 9 skipped, 7 failed in
  75.71s**; all seven failures were loopback socket `PermissionError` cases in
  `test_avscan.py`, not candidate assertions.
- Sandbox-control rerun:
  `caos/server/.venv311/bin/python -m pytest caos/tests/server/test_avscan.py -q`
  outside the restricted sandbox: **8 passed in 0.17s**.
- Caller re-check: `run_executor.py::execute_run_by_id` still awaits the same
  two-argument coroutine, emits the same terminal notification, commits after
  return, and retains the same exception/rollback boundary; its focused tests
  are included above.
- Waterfall spot-check: EV 150 against two pari-passu rank-1 claims of 100 and a
  rank-2 claim of 100 returned recoveries `75 / 75 / 0` and percentages
  `75% / 75% / 0%`, preserving pari-passu allocation and absolute priority.
- CP-5B side-effect audit: `_persist_cp5b` reduces `findings` to scalar counts in
  a new `runtime_output` dict before council findings are appended. The winning
  in-place `findings.extend(council)` therefore cannot mutate a retained CP-5B
  list reference.

Final replacement code is preserved as the anonymous winning artifact
`/tmp/g1_match1_A.py`; it is not applied to production source by this review.

## G2 — Model/workbook projections

### Target and impact set

Target region: `caos/server/model_engine_v2.py:774-1229`, the debt-instrument
opening, roll-forward, PIK, interest, fee, FX, state-propagation, and result
construction region inside `ModelEngineV2.calculate` (method lines 604-1416).
The whole 813-line method was read, but a wholesale rewrite is disqualified as
too broad to verify as one financial change.

- GitNexus resolves the exact method as
  `Method:caos/server/model_engine_v2.py:ModelEngineV2.calculate#2`.
- Method-downstream impact: MEDIUM, 14 dependencies (13 direct, 1 at depth 2)
  in Server: `_period_order_key`, `_shift_months`, `_decimal`, `_number`,
  `_safe_div`, `_canonical_hash`, `source_fingerprint`, and the nested
  `apply_node`, `input_value`, `input_is_overridden`, `debt_value`,
  `add_missing`, and `override_value`; `is_finite_number` is depth 2.
- GitNexus does not resolve the dynamic `ModelEngineV2().calculate` method call
  as an incoming edge. The actual public boundary is therefore mapped through
  `calculate_model` at lines 1419-1420 plus exhaustive text search.
- Public-boundary upstream impact: **CRITICAL**, 84 symbols: 46 direct, 36 at
  depth 2, and 2 at depth 3; 10 API/workbook processes in Server and Routes.
- Direct production callers include `model_v2_checkpoint_snapshot`,
  `render_model_workbook`, `preview_workbook`, `_create_or_update`,
  `get_model_v2`, `calculate_model_v2`, both override mutation paths,
  `replay_model_v2_event`, both checkpoint paths, `_with_import_authority`, and
  `export_model_workbook`. Exhaustive search also identifies all 14 production
  call sites in `routes/model_v2.py`, `routes/model_workbook.py`,
  `model_service.py`, and `model_workbook.py`.
- Affected GitNexus processes: `preview_model_workbook_import`,
  `commit_model_workbook_import`, `get_model_v2`,
  `mutate_model_v2_override`, `replay_model_v2_event`,
  `restore_model_v2_checkpoint`, `calculate_model_v2`,
  `create_model_v2_checkpoint`, `put_model_v2`, and
  `mutate_model_v2_overrides_batch`.

Contract: preserve `calculate(payload, *, evaluated_at=None) ->
ModelCalculation`, the pure/no-mutable-state behavior, exact output schema and
hash identity, node append order, gap/warning order, override precedence,
period/instrument ordering, and all debt/interest/FX calculations.

### G2 invariants

- Contiguous forecast/pro-forma periods inherit the prior effective closing;
  actual/LTM periods preserve sourced openings and expose discontinuities.
- Forecast closing solves the average-balance PIK circularity with
  `(base_close + pik_factor * opening / 2) / (1 - pik_factor / 2)` and must
  reject a negative base close or non-positive denominator.
- Derived override precedence remains closing, expected close, PIK interest,
  average balance, then formula close; an explicit null remains unavailable,
  never zero.
- Actual periods preserve sourced close, calculate expected close separately,
  and surface a residual beyond `_TOLERANCE` as both warning and gap.
- Fixed debt has no benchmark or margin interest; floating debt has no coupon;
  hybrid debt includes benchmark, margin, and coupon exactly once.
- Fees preserve `max(0, commitment - average) * commitment fee * months / 12
  + cash fees`; a non-zero fee with missing commitment is unavailable.
- Same-currency FX defaults to one; cross-currency FX is required. Cash interest
  and closing debt convert through the effective FX node and cannot publish a
  negative expense or debt balance.
- Prior-closing state and instrument results are updated in deterministic
  priority/instrument order. Output node formulas and overrides remain fully
  auditable.
- This path has no native yield solver or day-count basis. `period.months / 12`
  is the only interest annualization convention and must remain unchanged.

### Baseline verification

Command:
`caos/server/.venv311/bin/python -m pytest caos/tests/server/test_model_engine_v2.py caos/tests/server/test_model_workbook.py caos/tests/server/test_model_workbook_api.py caos/tests/server/test_model_v2_api.py caos/tests/server/test_model_v2_report_identity.py caos/tests/server/test_report_exports.py -q`

Baseline result: **169 passed, 7 warnings in 10.69s**.

### Tournament result

Pending anonymous bracket and orchestrator scratch verification.
