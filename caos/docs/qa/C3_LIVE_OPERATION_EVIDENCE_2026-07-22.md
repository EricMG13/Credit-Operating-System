# C3 live-operation evidence — 2026-07-22 (frozen candidate, local target-shaped)

Closes the locally-executable PD-06 C3 legs left open by
[C3_MONITOR_ALERT_CANDIDATE_EVIDENCE_2026-07-21.md](C3_MONITOR_ALERT_CANDIDATE_EVIDENCE_2026-07-21.md):
live-PostgreSQL migration/lease behavior, an actually operated external
scheduler and dispatcher over an observation window, and a controlled flag
enablement → observation → flag-off rollback. Target-host legs it does **not**
close are listed at the end.

## Candidate identity and topology

- Code: working tree == `origin/main` == frozen candidate `cda106dc`
  (`git diff origin/main -- caos/server caos/frontend` empty; the only local
  commit is the L23/L24 documentation commit).
- Server: `run.py`, **ENVIRONMENT=production**, **WEB_CONCURRENCY=2** (two
  uvicorn worker processes), port 8020, `.venv311`.
- Database: fresh PostgreSQL in `pgvector/pgvector:pg18@sha256:12a379b4…`
  (the digest pinned by the release manifest), port 55433.
- Malware scanner: `clamav/clamav:1.5@sha256:7f5389cc…` (manifest digest),
  TCP 3310, repo `clamd.conf`, forced `linux/amd64` under emulation (host is
  arm64; the pinned digest publishes amd64 only — recorded as a host
  limitation, not a deviation in image identity).
- Model keys blanked → deterministic demo-fallback LLM lanes.
- Every production fail-closed guard fired before a weak configuration was
  accepted (dev-mode refusal of production secrets; weak `EDGE_PROXY_SECRET`
  refused; weak `ANALYST_SIGNUP_CODE` refused; missing `CLAMAV_HOST` refused).
  Startup succeeded only with the full deployed posture.
- Flag: `CAOS_ALERT_RULES_V1_ENABLED=true` for the window; explicitly flipped
  off for the rollback leg.

## Leg 1 — migrations and drift on live PostgreSQL

- `alembic upgrade head` from an empty database ran the full chain through
  `0066 → 0067 → 0068` cleanly; `alembic current` reports **0068 (head)**.
- `alembic check` reports "No new upgrade operations detected" (the known
  benign `document_chunks.tsv` computed-default warning only).

## Leg 2 — multi-worker lease behavior on live PostgreSQL

With `DATABASE_URL=postgresql+asyncpg://…55433/caos_h0`:

- C3 suites `test_alert_dispatch.py` + `test_alert_rules_activation.py`:
  **93 passed**.
- CI-parity Postgres selection `test_async_runs.py -k "worker or reaper or
  claim"`: **3 passed** (SKIP LOCKED claim/reaper on real Postgres);
  `test_secret_log_hygiene.py`: **1 passed**.
- Wider PG sweep across the five `requires_pg` files: 139 passed; 7 failures
  were all test-harness environment effects, verified to root cause and **not
  product defects**:
  - `test_locks.py` SQLite-branch unit tests pass `db=None` by construction
    and are unmarked for PG (`engine/locks.py` takes the Postgres branch and
    dereferences the session) — a latent test-marking gap, post-freeze
    observation only.
  - `test_research_jobs.py::test_research_figures_are_context_bound_and_source_backed`
    seeds `metric_facts` without its parent `runs` row; SQLite tolerates it
    (FK enforcement off), PostgreSQL rejects it. Test-seeding gap; the
    product path always creates the run first.
  - Two reaper tests are sensitive to residue when unrelated suites share the
    database; on a fresh database the CI-parity selection is fully green
    (matches the shared-DB conftest discipline).

## Leg 3 — externally operated scheduler + dispatcher over an observation window

Topology per the frozen contract: **no in-process timer or dispatch hook** —
an external cron-equivalent loop invoked, each cycle:

1. `python -m reconcile_alert_rules --limit 100 [--cursor …]` (bounded page,
   cursor file retained on terminal pages), and
2. an operator dispatcher process draining `dispatch_once` with the
   production sink descriptors (`in_app/monitor-inbox`, `email/owner-email-route`).

Window: **18 external cycles** across 2026-07-22T14:04:43Z → 14:20:53Z
(12-cycle window + 6-cycle extension), against live analyst-driven state
created over HTTP through the edge-authorized API (registered analyst,
issuer, two watch rules, two completed engine runs).

Observed, all recorded in `window.log` and the database:

- **Honest non-match**: rule 1 (`eq critical`) evaluated the first completed
  run → outcome `ignored`; no alert.
- **Replay determinism**: a rule created *after* a run completed is not
  retroactively evaluated against that run on replay (observation identity is
  bound at completion). A fresh run completed after rule 2 existed.
- **Materialization**: run 2's completion produced observations for both
  rules; rule 2 (`present`) **matched** → exactly one `AlertEvent`
  (`kind=qa_change`, categorical observation `qa_status=Restricted` — the
  honest offline-run gate state), with full evidence + authority chain
  (observation_key, source_identity `run:<id>:qa_gate`, watch_rule_id,
  rule_version) readable through the analyst API (`GET /api/alerts/events`).
- **Dispatch, exactly-once**: two delivery intents (in_app + email render
  intent, no transport I/O) were claimed and finished by the external
  dispatcher across two cycles; final state `rendered_intent`,
  `attempt_count=1` each.
- **Operator-crash safety (incidental but real)**: the operator process
  crashed *after* the dispatch transactions committed (a logging bug in the
  operator script, not the product). Subsequent cycles drained nothing and
  attempt counts stayed at 1 — a crashing external operator did not duplicate
  or lose delivery.
- **Idempotent replay**: ~15 further replays of the terminal page kept
  `alert_events=1`, `watch_rule_evaluations=3`, intents unchanged.
  `observations` in each cycle's page report stayed constant with zero
  failures; the cursor was correctly retained on `next_cursor=null`.
- **Durable create idempotency (0068)**: watch-rule creation required and
  honored the `Idempotency-Key` header.

## Leg 4 — controlled flag enablement and flag-off rollback

With the same stack restarted `CAOS_ALERT_RULES_V1_ENABLED=false`:

- Every `/api/watch-rules` route is masked → **404** before validation.
- `python -m reconcile_alert_rules` refuses with **exit code 2**
  ("alert rules are disabled; reconciliation was not run").
- `dispatch_once` returns `None` under a disabled flag (covered by the
  activation suite above).
- Schema `0068` and all materialized rows are retained; the persisted-alert
  compatibility reader (`GET /api/alerts/events`) still serves the alert —
  rollback loses no analyst-visible history.

## Boundaries — what this does NOT close

- Production-flag enablement/observation/rollback **on the target host**, and
  target edge/authz/storage parity (PD-07/PD-08 hosts own these).
- Enterprise email transport acceptance/rejection/retry (H4 activation
  package; EmailSink remains render-only by design).
- RT-2026-07-22-823 scale residual: target-volume evidence, server-windowed
  alert history, batched decision context.
- The nightly L5 lane on the frozen commit (fires on schedule).

Post-freeze harness observations (no code changed; candidates for the next
tranche): mark `test_locks.py` SQLite-branch tests to skip under a PG DSN;
seed the parent run in `test_research_jobs.py` figure test; both recorded
above with root cause.
