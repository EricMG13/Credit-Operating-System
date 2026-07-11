# Backend Audit Playbook — API Surface, Data Layer, Reliability

Goal-prompt for a Sonnet agent. Re-run on every PR touching `caos/server/` and before every deploy.
You audit; you do not refactor. Report findings, fix nothing unless instructed.

## 1. Objective and stakes

Prove that the CAOS backend (`caos/server/`: FastAPI + SQLAlchemy async + Alembic, SQLite dev / Postgres prod) still holds its API, data, and reliability invariants. Analysts drive runs, ingest filings, and persist models through this API; a dropped constraint, a non-reversible migration, or a run that dies mid-flight silently corrupts a credit view that goes in front of an investment committee. Your output is a dated pass/fail report with adversarially-verified findings — not a vibe check.

## 2. Scope discovery — run fresh every audit

The surface moves; never audit from a stale list. Enumerate first:

```bash
# Route inventory (method + path per router; prefixes in main.py include_router block)
grep -rn "@router\.\(get\|post\|put\|patch\|delete\)" caos/server/routes/*.py
grep -n "include_router" caos/server/main.py

# Request/response models
grep -rn "class .*(BaseModel)" caos/server/routes/*.py caos/server/*.py

# Migration chain (must be linear, one head)
ls caos/server/migrations/versions/

# Executors (all four + the pipeline executor)
ls caos/server/*executor*.py caos/server/engine/pipeline_executor.py

# Raw-SQL surfaces to re-check for parameterization
grep -rln "text(" caos/server/*.py caos/server/routes/*.py
```

Diff this inventory against the previous audit report; every new route, model, migration, or `text()` site enters scope.

## 3. Coverage checklist — invariants to prove

Each item is an invariant, not a step. PASS = evidence it holds; FAIL = a repro.

**Schema validation & mass assignment**
- Every mutating route takes an explicit Pydantic body model; no route constructs or updates an ORM row from raw request dict/`**payload`/`setattr` loops.
- ORM-backed responses go through `response_model` with `from_attributes` models; no credential/secret column (e.g. `Analyst` password/token fields) is serializable by any response model.

**Input caps & pagination**
- Every string input carries `max_length`; every list endpoint's `limit` is bounded (`Query(..., ge=, le=)` — e.g. `routes/edgar.py` `le=50`). Flag any unbounded user-controlled fan-out.
- Uploads are size-capped *while streaming* (`ingest.py` raises 413 before buffering past `max_upload_mb`) and rate-limited (`routes/ingestion.py` `_UPLOAD_MAX_PER_MINUTE`). Empty and malformed PDF/XLSX bodies are rejected 400.

**Error-handler leakage**
- The catch-all handler (`main.py` `log_unhandled`) returns a static `{"detail": "Internal Server Error"}`; the exception with request context goes to logs only.
- No route surfaces `str(e)`/stack of a *generic* exception to the client: `grep -rn "str(e" caos/server/routes/*.py caos/server/main.py`. Typed domain errors are the allowed exception (`EdgarError → HTTPException(502, str(exc))` is deliberate — curated upstream-fetch messages, not internals). Anything caught as bare `Exception` and echoed is a finding.

**Parameterized queries**
- All `text()` sites (discovery list above) use bound parameters; no f-string/`.format`/concat of user input into SQL. `nlquery.py` translators emit parameterized queries over `metric_facts` by design — verify that holds for any new translator.

**Migrations: additivity & reversibility**
- Exactly one Alembic head; `alembic check` clean against models; `upgrade head → downgrade base → upgrade head` round-trips. All three are enforced by `caos/tests/server/test_migrations.py` — it must pass, and any new migration must extend the chain, not fork it.
- New migrations are additive: no `DROP TABLE`/`DELETE`/`TRUNCATE` of user data (0027's nullability reconciliation is the historical exception, already adjudicated). Read the diff of any new `versions/*.py` directly.

**Executor fault isolation**
- `run_executor.py`: `CancelledError` handled as `BaseException`, distinct from failure; last-resort mark-failed so no run is left `running` forever; SQLite/in-process boot orphan sweep exists (that path has no reaper).
- Postgres `QueueWorker`: claim via `FOR UPDATE SKIP LOCKED`; lease window with re-claim while `attempts < MAX`; attempts-exhausted orphans reaped to `failed`. State machine: `queued →claim→ running →execute→ complete/failed`; `running & lease<now` re-claims or reaps.
- Concurrency capped: `caos_run_concurrency` semaphore on runs; `caos_research_concurrency` on both research executors. Research executors are in-process semaphore-only (no lease) — accepted at current scale, their docstrings name the QueueWorker upgrade path; flag only if replicas > 1 is on the table.

**Seed & ingest idempotency**
- `seed.py` is re-runnable: insert-if-missing by id, per-issuer skip guard for metrics, provenance-scoped replace. Running it twice produces zero duplicate rows.
- Ingest re-upload of the same file must not corrupt or duplicate issuer state.

**Retention & GDPR erase**
- Retention: a new run supersedes the issuer's older run-derived `metric_facts` (store bounded as runs scale); seed facts untouched (`test_retention.py`).
- Erase: self-service `DELETE /api/auth/profile` and operator CLI `python -m erase_analyst <email>` both route through `database.erase_analyst_data`. It must scrub **both** analyst-id and email stamps, including the proxy-stamped fallback (rows stamped with email when no profile row exists); private Deep Research jobs deleted; shared runs/documents anonymized (de-linked), not deleted. Any table added since the last audit that stamps `analyst_id` or email must be covered by the erase — grep new migrations for such columns and cross-check.

**Async worker claim/lease on Postgres**
- The claim/re-claim/reap tests actually *run* against Postgres (they skip on SQLite via `requires_pg` in `test_async_runs.py`). A green suite where the PG leg silently skipped is a FAIL of the audit itself.

## 4. Procedure

Interpreter: `caos/server/.venv311/bin/python` (prod-parity py3.11, fastapi 0.138 — never downgrade the pin). `caos/server/.venv/bin/python` (py3.9) is the floor check. `caos/tests/server/conftest.py` auto-provisions a throwaway SQLite DB + vault dir and force-blanks LLM keys (offline by default; `CAOS_TEST_LIVE=1` opts out) — no manual test-DB setup for the SQLite leg.

```bash
# Full offline suite (mirrors CI; 2026-07-03 baseline: 870 passed on the server
# dir alone, low-single-digit skips — stress/cohort add more)
caos/server/.venv311/bin/python -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q

# Targeted legs for this playbook's invariants
caos/server/.venv311/bin/python -m pytest \
  caos/tests/server/test_migrations.py \
  caos/tests/server/test_async_runs.py \
  caos/tests/server/test_runner_fault_isolation.py \
  caos/tests/server/test_locks.py \
  caos/tests/server/test_pipeline_executor.py \
  caos/tests/server/test_gdpr_erase.py \
  caos/tests/server/test_retention.py \
  caos/tests/server/test_seed.py \
  caos/tests/server/test_ingest_markitdown.py \
  caos/tests/server/test_avscan.py \
  caos/tests/server/test_rate_limit.py \
  caos/tests/server/test_api.py \
  caos/tests/server/test_security_headers.py \
  caos/tests/server/test_token_revocation.py -q

# Postgres-only worker leg (CI runs this against pgvector/pgvector:pg18 — plain
# postgres:18 lacks the `vector` extension migration 0030 requires, and setup fails)
docker run --rm -d --name caos-audit-pg -p 5433:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg18
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/postgres \
  caos/server/.venv311/bin/python -m pytest \
  caos/tests/server/test_async_runs.py -k "worker or reaper or claim" -q -rs
docker stop caos-audit-pg
# -rs: confirm the requires_pg tests RAN — "skipped" here fails the audit.

# Static gates (ruff is in the venv, not on PATH)
caos/server/.venv311/bin/python -m ruff check caos/server caos/tests
cd caos/server && .venv311/bin/python -m mypy   # engine gate (mypy.ini files=engine)
```

Gotchas: the suite shares ONE process-global SQLite DB — no per-test wipe; if you add a repro test, seed per-entity-idempotent with non-colliding names or the conftest issuer-baseline guard will bite you. Run pytest from the repo root.

## 5. Evidence and reporting

Write `caos/docs/qa/audits/backend-api-data-YYYY-MM-DD.md`:

- **Header**: date, branch, commit, interpreter, baseline counts.
- **Gate table** — all must PASS to pass the audit:
  1. Full offline suite green (no new failures vs baseline).
  2. `test_migrations.py` green (single head, `alembic check`, round-trip).
  3. Postgres worker leg green **and not skipped**.
  4. Leakage grep: no new bare-`Exception` `str(e)` sites vs previous report.
  5. Raw-SQL grep: no new unparameterized `text()` site.
  6. Every new route/model/migration from §2 discovery mapped to a §3 invariant.
- **Findings**: severity (HIGH/MED/LOW), `file:line`, invariant broken, repro, suggested fix. 
- **Adversarial verification**: any finding claiming data loss or a fault-isolation hole must be refute-first verified before it enters the report — write the failing repro (test or script) and try to prove the finding *wrong* first. Historical rate of severity inflation in agent findings is high; an unverified HIGH is reported as UNVERIFIED, never as HIGH.
- Cross-check candidate findings against `caos/docs/qa/REVIEW_MATRIX_BACKEND.md` before writing them up — most "discoveries" are already adjudicated there.

## 6. Accepted-risk register — never re-flag

Seeded from REVIEW_MATRIX_BACKEND.md "Adjudicated-accepted register" plus executor notes. Re-flag only if the *scale assumption* behind one changes (multi-replica deploy, external users, paid tier):

| Risk | Why accepted |
|---|---|
| Single-team IDOR (issuers/runs not owner-scoped) | One trusted team per deployment; roles-lite is the E2 authz posture |
| Edge-secret-trust (app trusts Caddy-injected header) | Defense-in-depth at the edge; constant-time guard, boot fail-closed |
| On-host backup | Pilot posture; off-host is a deploy-phase item, not app code |
| XFF rate-key spoof / global login-bucket self-DoS | Limiter is per-process best-effort behind the edge proxy |
| Limiter + advisory locks assume ONE process | Deploy runs a single app container; revisit at replicas > 1 (BE8-1) |
| Research executors in-process, no lease | Semaphore-capped; QueueWorker upgrade path documented in-module |
| EDGAR in-process throttle | Single-process deploy; same scale assumption as above |
| `EdgarError → 502 str(exc)` | Curated domain-error messages, deliberately surfaced to analysts |
| Register 409 confirms email existence | Throttled, invite-code-gated; accepted UX tradeoff |
| No-OCR (scanned PDFs → 0 chunks) | markitdown text-layer only; OCR is a backlog item |
| Demo/mock seams, PERF-2 bundle size | By design for Phase-1 |
