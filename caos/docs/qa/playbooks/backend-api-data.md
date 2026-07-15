# Audit the backend API, data layer, and reliability

## 1. Objective and stakes

You are a Sonnet 5 audit agent. Prove that the CAOS FastAPI and Postgres backend preserves API contracts, committed credit data, and terminal run state through invalid input, retries, migration, cancellation, worker death, and redeploy. Analysts ingest filings and persist models through this surface. A leaked internal error, partial transaction, duplicate ingest, dropped constraint, or stranded run can corrupt an investment-committee credit view.

Audit only. Do not refactor or fix findings. Use current code and test output as evidence, not prior reports. Produce one dated pass/fail report.

## 2. Scope discovery

Run discovery from the repository root on every audit. Treat every changed or newly discovered route, schema, migration, SQL site, owner stamp, and executor as in scope.

```bash
git diff --name-status origin/main...HEAD -- caos/server caos/tests/server
rg -n '@(router|app)\.(get|post|put|patch|delete)\(' caos/server/routes caos/server/main.py
rg -n 'include_router|exception_handler' caos/server/main.py
rg -n '^class .*\([^)]*BaseModel[^)]*\)' caos/server
rg -n 'Field\(|Query\(|Form\(|model_config|ConfigDict' caos/server/routes
```

```bash
rg --files caos/server/migrations/versions | sort
(cd caos/server && .venv311/bin/python -m alembic heads)
(cd caos/server && .venv311/bin/python -m alembic history)
rg -n 'class .*Executor|class .*Worker|CancelledError|Semaphore|lease_expires_at|with_for_update|_reap_orphans' \
  caos/server/*executor*.py caos/server/engine/pipeline_executor.py
```

```bash
rg -n 'text\(|exec_driver_sql|op\.execute|\.execute\(' caos/server --glob '*.py'
rg -n 'analyst_id|uploaded_by|created_by|updated_by|email' \
  caos/server/database.py caos/server/migrations/versions
rg -n 'str\((e|exc|err|error)\)|traceback|stack' caos/server/main.py caos/server/routes
```

Record the inventories in the report. Diff them against the last report only to find drift; never treat the last report as proof.

## 3. Coverage checklist

Prove each invariant. A claim without code evidence and a test or bounded repro is not a pass.

### API contracts and mass-assignment safety

- Every mutating JSON route validates an explicit Pydantic request model. Multipart fields have equivalent bounds.
- Unknown or privileged fields cannot set identifiers, ownership, role, status, provenance, lease, audit, or secret columns. ORM creates and updates use an explicit allowlist, never raw `**payload`, generic `setattr`, or client-selected column names.
- Every JSON response has an explicit, validated shape. ORM response models use deliberate field lists and cannot serialize password hashes, recovery hashes, tokens, edge secrets, worker metadata, or internal exception text.
- Negative tests prove over-posting and response-shape failures are rejected. Pydantic defaults do not weaken handler requirements.

### Input caps and pagination

- Every user-controlled string, collection, upload, workbook, query, fan-out, and external-call budget has a finite cap before expensive work begins.
- Every collection route bounds `limit` and applies the bound in SQL before materialization. Offset or cursor inputs are validated. Counts do not trigger an unbounded fetch.
- Uploads stop reading at the byte cap, reject empty or malformed bodies, cap concurrent parse work, and enforce archive, cell, extracted-text, and chunk limits. Antivirus failure follows the configured fail-closed policy.

### Error leakage

- The catch-all handler logs server context and returns a static 500 body. No stack, exception representation, SQL text, path, credential, provider payload, or `str(e)` reaches a client.
- The invariant includes indirect leakage through persisted `error`, progress, or status fields returned by later polling routes.
- A surfaced domain error is allowed only when its type and message are curated for clients. A broad `Exception` converted to `HTTPException`, JSON, or an API-visible database field is a failure.

### Query safety

- Every value derived from a request reaches SQL through SQLAlchemy expressions or bound parameters.
- Dynamic table, column, sort, direction, operator, and fragment choices come from fixed allowlists. No f-string, formatting, or concatenation can place user input into `text()`, `op.execute()`, or driver SQL.
- Raw SQL introduced by a migration is static or parameterized and preserves tenant and analyst scoping where applicable.

### Migration additivity and reversibility

- Alembic has one linear head. A fresh database upgrades to head, `alembic check` reports no model drift, and a disposable database completes `upgrade head -> downgrade base -> upgrade head`.
- Each new revision points to the prior head and has an executable downgrade. An intentionally irreversible data transform declares the recovery path and blocks deploy until that path is accepted.
- Production upgrades are additive: no silent `DROP`, `DELETE`, `TRUNCATE`, constraint weakening, destructive rewrite, or lossy backfill. Constraint and nullability changes preflight existing rows and fail with a useful error instead of deleting or coercing data.
- Migration startup is serialized on Postgres. The app does not serve traffic against a partial schema.

### Executor fault isolation

- Runs, research jobs, research reports, and pipeline jobs commit either a complete result or a terminal failure. A rollback cannot leave a partial credit view visible.
- `asyncio.CancelledError` has a distinct path that persists safe terminal state, clears leases, runs rollback cleanup, and re-raises cancellation. A last-resort failure path cannot raise and strand the row.
- The SQLite in-process path retains task references, caps concurrency, drains cancellation on shutdown, and sweeps provably orphaned non-terminal rows on boot.
- Each Postgres worker claims at most one eligible row with `FOR UPDATE SKIP LOCKED` and a SQL limit. Two workers cannot claim the same row.
- Live work renews its lease and cannot re-claim itself. Expired work below the attempt cap is re-claimable. Expired work at the cap is reaped to `failed`. Attempts and token spend do not reset across re-claims.
- Worker-loop exceptions are isolated to one tick and become observable after repeated failures. Concurrency caps are finite and do not hold database connections while waiting for capacity.

### Seed and ingest idempotency

- Running every seed function twice leaves the same logical rows, facts, chunks, and provenance after the first run. Existing analyst data is neither overwritten nor used as a table-wide skip condition.
- Retrying an ingest with its supported idempotency identity creates one logical import. If re-upload intentionally creates a version, the version is explicit and linked rather than an accidental duplicate.
- File storage and database writes behave as one logical transaction: database failure or cancellation removes uncommitted vault objects, and a committed row never points to missing bytes.
- PDF, workbook, memo, and market/model import lanes enforce byte and expansion caps before parse or persistence. Content hashes and analyst scope prevent cross-user deduplication.

### Retention and General Data Protection Regulation erasure

- Retention removes only data made obsolete by its policy. A run that emits no fact for one module cannot erase that module's last valid facts. Seed facts, current facts, other issuers, and other analysts remain intact.
- Both self-service erase and operator erase call the same data-layer primitive. The erase covers every table and stored artifact stamped with analyst ID, email, `uploaded_by`, `created_by`, or an equivalent owner field.
- Erasure checks both ID and email forms, including proxy-only email stamps. Private state is deleted; shared credit records are anonymized or pseudonymized without breaking referential integrity; bystander data is unchanged.
- Any new owner-stamped model or migration has matching erase coverage and a regression assertion. Erase is transactional and retry-safe.

### Postgres async claim and lease path

- Postgres-specific tests exercise the real `SKIP LOCKED`, claim, heartbeat, re-claim, attempt-cap, and reap paths for run, research, research-report, and pipeline workers.
- A green SQLite fallback is not evidence for this invariant. Any Postgres worker test reported as skipped fails the audit.

## 4. Procedure

Use `caos/server/.venv311/bin/python`. The test harness creates a throwaway SQLite database and vault, blanks model keys unless `CAOS_TEST_LIVE=1`, and enables `CAOS_TEST=1`. Run from the repository root with `CAOS_TEST_LIVE` unset.

```bash
caos/server/.venv311/bin/python -m pytest \
  caos/tests/server/test_api.py \
  caos/tests/server/test_migrations.py \
  caos/tests/server/test_async_runs.py \
  caos/tests/server/test_runner_fault_isolation.py \
  caos/tests/server/test_pipeline_executor.py \
  caos/tests/server/test_research_jobs.py \
  caos/tests/server/test_research_report.py \
  caos/tests/server/test_upload_robustness.py \
  caos/tests/server/test_upload_concurrency.py \
  caos/tests/server/test_ingest_markitdown.py \
  caos/tests/server/test_xlsx_safety.py \
  caos/tests/server/test_seed.py \
  caos/tests/server/test_retention.py \
  caos/tests/server/test_gdpr_erase.py \
  caos/tests/server/test_market_xlsx_commit.py \
  caos/tests/server/test_model_workbook_api.py -q
```

Run the full offline regression gate on every pull request and pre-deploy audit:

```bash
caos/server/.venv311/bin/python -m pytest \
  caos/tests/server caos/tests/stress caos/tests/cohort -q
```

Use a disposable pgvector Postgres 18 database for migration and worker evidence. Plain Postgres lacks the `vector` extension required by migration `0030`.

```bash
docker run --rm -d --name caos-backend-audit-pg -p 5433:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=caos_audit \
  pgvector/pgvector:pg18
until docker exec caos-backend-audit-pg pg_isready -U postgres -d caos_audit; do sleep 1; done
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/caos_audit
(cd caos/server && .venv311/bin/python -m alembic upgrade head)
(cd caos/server && .venv311/bin/python -m alembic check)
(cd caos/server && .venv311/bin/python -m alembic downgrade base)
(cd caos/server && .venv311/bin/python -m alembic upgrade head)
```

Run the Postgres-only worker leg against that database:

```bash
caos/server/.venv311/bin/python -m pytest \
  caos/tests/server/test_async_runs.py::test_two_workers_claim_one_run_once \
  caos/tests/server/test_async_runs.py::test_reaper_fails_exhausted_orphan \
  caos/tests/server/test_research_jobs.py::test_two_research_workers_claim_one_job_once \
  caos/tests/server/test_research_jobs.py::test_research_reaper_fails_exhausted_orphan \
  caos/tests/server/test_research_report.py::test_two_report_workers_claim_one_report_once \
  caos/tests/server/test_research_report.py::test_report_reaper_fails_exhausted_orphan \
  caos/tests/server/test_pipeline_executor.py -q -rs
docker rm -f caos-backend-audit-pg
unset DATABASE_URL
```

Inspect the summary. Any skip in this leg fails the audit even if pytest exits zero. If discovery finds another Postgres claim or lease implementation, add its exact test target before passing the audit.

## 5. Evidence and reporting

Write `caos/docs/qa/audits/backend-api-data-YYYY-MM-DD.md`. Include the date, branch, commit, interpreter, database image, exact commands, exit codes, pass/fail/skip counts, and `file:line` evidence.

The overall result is PASS only when every gate passes:

1. Discovery is complete, and every new route, schema, migration, SQL site, owner stamp, and executor maps to an invariant.
2. API validation, mass-assignment, caps, pagination, error masking, and SQL parameterization have no unverified gap.
3. The focused and full offline suites pass with no new skip or failure.
4. Alembic has one head, no model drift, an additive reviewed diff, and a successful disposable-Postgres round trip.
5. The Postgres worker leg passes with zero skips and covers every discovered Postgres claim and lease path.
6. Seed, ingest, retention, erasure, rollback, cancellation, orphan, re-claim, and reap behavior has direct test evidence.

For each finding, report severity, invariant, `file:line`, affected data, smallest repro, and suggested remediation. Do not edit code.

Adversarially verify every claimed data-loss, partial-write, double-execution, lease, orphan, migration, or erasure gap before reporting it as confirmed. First reproduce the failure, then try to refute it with transaction boundaries, constraints, cleanup hooks, dialect behavior, and a counter-test. Label any claim that survives only static review as UNVERIFIED. An unverified claim cannot set a HIGH or MEDIUM severity or pass/fail gate.

## 6. Accepted-risk register

Seed this register from `caos/docs/qa/REVIEW_MATRIX_BACKEND.md`. Do not re-flag an entry while its stated assumption holds. Reopen it when scope, deployment, trust, scale, data policy, or implementation changes. Do not add a new accepted risk without explicit owner approval.

| Accepted risk | Assumption that keeps it accepted |
|---|---|
| Single-team insecure direct object reference posture | One trusted team uses each deployment; cross-team tenancy is not enabled |
| Forwarded-for rate-key spoof | The edge proxy controls forwarded identity headers; the limiter remains a best-effort abuse control |
| Global login-bucket self-denial of service | Access is invite-gated and operated by one trusted team |
| Edge-secret trust | Only the edge reaches the app, injects the identity headers, and passes the boot-enforced shared-secret check |
| On-host backup | Pilot operations explicitly accept host-loss exposure; off-host recovery remains a deploy control |
| EDGAR in-process throttle | The app runs one process; replicas require a shared throttle |
| OCR unavailable when the optional OCR command is unset | The UI exposes zero-chunk warnings; production OCR requirements have not changed |
| PERF-2 bundle | Frontend bundle cost remains an accepted Phase 1 tradeoff and does not hide backend correctness risk |
| Demo and mock seams | They remain isolated to documented demo, test, or keyless paths and cannot overwrite live data |
