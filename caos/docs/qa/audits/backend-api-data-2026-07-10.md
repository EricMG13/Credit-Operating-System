# Backend Audit Report — API Surface, Data Layer, Reliability

**Date:** 2026-07-10
**Branch:** feat/command-center-layout-and-sector-rv-cleanup
**Commit:** 004521c0
**Interpreter:** caos/server/.venv311 (py3.11, fastapi 0.138)
**Playbook:** [caos/docs/qa/playbooks/backend-api-data.md](../playbooks/backend-api-data.md)

## Scope discovery (this run)

| Item | Count |
|---|---|
| Routes (`@router.get/post/put/patch/delete`) | 78 |
| Pydantic BaseModel classes in routes/server | 82 |
| Migrations | 33 (head: 0033_issuer_research_report) |
| Executors | 5 (run_executor, research_executor, research_report_executor, executor_base, pipeline_executor) |
| `text()` SQL sites | 7 files (database.py, deepresearch.py, ingest.py, vault_export.py, routes/edgar.py, routes/health.py, routes/ingestion.py) |

No prior report existed to diff against — this is the first run under this playbook. Baseline established here.

## Gate table

| # | Gate | Result |
|---|---|---|
| 1 | Full offline suite (`caos/tests/server caos/tests/stress caos/tests/cohort`) | **PASS** — 1303 passed, 2 skipped, 53.6s |
| 2 | `test_migrations.py` (single head, `alembic check`, roundtrip) | **PASS** — 3 passed |
| 3 | Postgres worker leg, not skipped | **PASS** — 2 passed, 0 skipped (see note below) |
| 4 | Leakage grep: no new bare-`Exception` `str(e)` sites | **PASS** — only the 4 accepted `EdgarError→502` sites; 1 false-positive (`sponsors.py:140`, a dict-comprehension var named `e`, not an exception) |
| 5 | Raw-SQL grep: no new unparameterized `text()` site | **PASS** — all 7 files use bound params or static literals (`text("SELECT 1")`, `text("SELECT pg_advisory_lock(:k)")`) |
| 6 | Every new route/model/migration mapped to an invariant | **PASS** — no migration since 0033 introduces a new analyst_id/email-stamped table requiring erase coverage |
| static | `ruff check caos/server caos/tests` | **PASS** — clean |
| static | `mypy` engine gate | **PASS** — 67 source files, clean |

**Note on gate 3:** the playbook as originally written specified `docker run ... postgres:18`, matching what a stale grep of `.github/workflows/ci.yml` showed at authoring time. Re-running against that image failed at schema setup (`CREATE EXTENSION IF NOT EXISTS vector` → `FeatureNotSupportedError`) — CI had since moved to `pgvector/pgvector:pg18` (plain postgres lacks the extension migration 0030 needs). **Playbook corrected in place** to reference `pgvector/pgvector:pg18`; rerun against the corrected image passed clean. This is exactly the kind of drift §2 discovery exists to catch — logging it here rather than silently patching.

## Invariant-by-invariant verification

- **Mass assignment** — grepped for `**payload`/`setattr(...payload)`/dict-items loops onto ORM rows: zero hits. All mutating routes take explicit Pydantic bodies.
- **Secret exposure via response_model** — `MeResponse` (routes/auth.py:70) carries `id/email/full_name/role/is_active/source` only; no password/token/hash field reachable through any `from_attributes` response model.
- **Input caps & pagination** — 10 `Query(..., ge=/le=)` bounds across routes (e.g. edgar search `le=50`). Upload path streams-and-caps before buffering (`ingest.py:57-58`, 413 before OOM), rate-limited 20/min (`routes/ingestion.py:44`).
- **Error-handler leakage** — catch-all (`main.py` `log_unhandled`) returns static `{"detail": "Internal Server Error"}`; only `routes/edgar.py`'s 4 `EdgarError→502 str(exc)` sites surface exception text, which is the accepted curated-message design.
- **Parameterized queries** — every `text()` call uses bound params (`:k`) or a static literal; no string interpolation of user input into SQL anywhere in scope.
- **Migration additivity/reversibility** — zero `DROP TABLE`/`DELETE FROM`/`TRUNCATE` across all 33 migration files; `test_migrations.py` proves single head + `alembic check` clean + upgrade→downgrade→upgrade roundtrip.
- **Executor fault isolation** — read `run_executor.py` directly: `CancelledError` caught as `BaseException` before the generic `except Exception`, re-raised after marking failed (run_executor.py:38-46); `QueueWorker` state machine (`FOR UPDATE SKIP LOCKED` claim, lease-based re-claim, attempts-exhausted reap) matches the playbook's documented diagram exactly.
- **Idempotent seed** — `seed_demo_data` (seed.py:45) is a per-issuer get-or-insert-or-backfill guard, not a table-emptiness check; safe to rerun.
- **Retention** — `test_run_facts_pruned_to_latest_run` (test_retention.py) proves a second run prunes the first run's `metric_facts` while seed-provenance rows survive untouched.
- **GDPR erase** — `test_erase_deletes_private_anonymizes_shared_spares_others` and `test_erase_by_email_resolves_id_then_erases` (test_gdpr_erase.py) both prove `erase_analyst_data` scrubs analyst_id (runs) and email (documents) stamps, deletes private research jobs + profile, leaves bystanders untouched. CLI path (email→id resolution) separately verified.
- **Async worker claim/lease on Postgres** — `test_two_workers_claim_one_run_once` (exactly one of two concurrent `_claim_one()` calls wins the row) and `test_reaper_fails_exhausted_orphan` (an attempts-exhausted, lease-expired run reaps to `failed`) both pass against a real Postgres instance, not mocked.

## Findings

None. No HIGH/MED/LOW findings this run — all 12 invariants hold as documented. One playbook drift found and fixed (see gate-3 note above); not a product defect, a doc-currency issue in the playbook itself.

## Adversarial verification

No data-loss or fault-isolation finding was raised this run, so the mandatory refute-first pass has nothing to apply against. Recorded per §5 for completeness: none skipped, none downgraded.

## Cross-check vs REVIEW_MATRIX_BACKEND.md

No new finding contradicts or duplicates an existing matrix row. BE9-2 (stress/cohort not collected in CI) remains fixed per this run's suite invocation including both dirs. BE8-1 (pool/concurrency coupling, single-process assumption) unchanged — still accepted, see register below.

## Accepted-risk register (unchanged this run)

Single-team IDOR · edge-secret-trust · on-host backup · XFF rate-key spoof / global login-bucket self-DoS · limiter+locks assume ONE process · research executors in-process no lease · EDGAR in-process throttle · `EdgarError→502 str(exc)` · register-409 confirms email existence · no-OCR · demo/mock seams + PERF-2 bundle size. Full rationale in the playbook §6; none re-flagged.
