# Performance Baseline

> **2026-07-20 capacity addendum:** retain the SQLite numbers below as the
> original workstation baseline. The current Postgres/two-worker first-fault
> record is
> [FIRST_FAULT_STRESS_REPORT_2026-07-19.md](FIRST_FAULT_STRESS_REPORT_2026-07-19.md):
> a reproduced 320-user latency fault followed by three zero-failure 300-user
> passes after bounded-pool/raw-ASGI remediation. It is not a silent rebase and
> does not close the target-image L25 gate.

First-audit baseline (2026-07-10). Update only for intentional accepted shifts —
each entry dated with cause. Never silently rebase over a FAIL.

**Environment:** macOS (Darwin 25.5.0) laptop, QA stack `:8010`, `.venv311`
(py3.11, fastapi 0.138), **SQLite** `caos_qa.db` (~572 issuers, multiple
complete runs — not Postgres; not comparable to prod numbers). Commit
`a4db0962`.

## API latency (smoke.py, n=200, concurrency=20)

| Endpoint | p50 | p95 | Budget | Verdict |
|---|---|---|---|---|
| `GET /api/health` | 30ms | 107ms | <500ms | PASS |
| `GET /api/runs?limit=100` | 111ms | 180ms | <500ms | PASS |
| `GET /api/issuers/?limit=200` | 220ms | 489ms | <500ms | PASS (11ms headroom) |
| `GET /api/runs/{id}/modules/CP-1` | 37ms | 72ms | <500ms | PASS |

## Load (locust, 20 users, ramp 5/s, 60s, QA stack)

3,786 requests, **0 failures / 0 5xx**. Aggregated p50=6ms, p95=22ms, p99=48ms.

| Endpoint | reqs | p50 | p95 | max |
|---|---|---|---|---|
| GET /issuers | 1,144 | 8ms | 25ms | 81ms |
| GET /runs | 1,131 | 5ms | 19ms | 69ms |
| GET /runs/{id}/modules/{m} | 717 | 4ms | 22ms | 63ms |
| POST /query/nl | 373 | 3ms | 18ms | 49ms |
| POST /runs/{id}/report | 401 | 5ms | 21ms | 75ms |

NL-lane 429s confirmed firing correctly (20/min limiter, keyed per analyst) —
counted as success per locustfile design.

## Scenario benchmark & bench suites

- `test_scenario_benchmark.py`: 1,100 translate+validate cycles, binary gate
  (<100ms) — PASS, exact elapsed not printed by the test.
- Graph-expansion + rerank bench: 9/9 tests PASS.
- Graph-expansion measurement (synthetic contagion seed, K=8): recall lift
  0.00→1.00 at 2-hop for the genuinely-2-hop query; hop bound exact (3-hop
  query stays 0.00 through hops 0-2, reaches 1.00 only at hop 3); Epsilon
  (unlinked control) never surfaced hops 0-5. Matches
  [GRAPH_EXPANSION_2HOP_MEASUREMENT.md](../../GRAPH_EXPANSION_2HOP_MEASUREMENT.md)
  exactly.

## Frontend bundle (`npm run build`, static export, du -sh per route dir)

| Route | Size |
|---|---|
| command | 20K |
| sector | 20K |
| upload | 32K |
| issuers | 36K |
| research | 36K |
| settings | 36K |
| deepdive | 40K |
| pipeline | 40K |
| reports | 44K |
| sector-rv | 52K |
| model | 132K |
| query | 132K |

Shared chunks: framework 192K, main 192K, largest vendor chunk (`4052.*.js`) 896K.
`du -sh` block-rounded (4K minimum) — treat as directional, not byte-exact;
switch to an exact-byte diff (`stat`/manifest) if the 10%/25kB gate needs
tighter precision than block rounding allows.

## LLM-lane timeout adherence

See `PERF_AUDIT_2026-07-10.md` §LLM lanes — mechanism verified correct on
both provider paths; harness coverage gap noted as a finding.

## 2026-07-18 current-tree 15-user diagnostic

**Environment:** dirty `codex/112@040f298e44b0` working tree; isolated temporary
SQLite database/vault; one uvicorn worker; fixture/keyless LLM behavior; 30 issuers
admitted by the public create-route rate guard; five completed offline runs. This is
a current-code smoke, not a replacement for the target Postgres baseline.

**Locust:** 15 users, ramp 5/s, 60 seconds, mixed issuer/run/module/report/NL profile.

| Metric | Result |
|---|---|
| Requests | **2,913** |
| Failures | **0 (0.00%)** |
| Aggregate p50 / p95 / p99 | **4 ms / 7 ms / 11 ms** |
| Maximum | 80 ms |
| Throughput | 48.74 requests/s |

The existing 2026-07-12 Postgres 18/two-worker result remains the production-like
comparison: 2,584 requests, zero failures, p50/p95/p99 27/89/130 ms. L25 requires
that profile to be rerun on the immutable image and target host with 15 distinct
principals, heavy-job/upload contention, queue/pool/memory observation, and provider
fault injection. Do not infer 15 simultaneous live runs or large uploads from the
mixed read/report smoke.
