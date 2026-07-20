# CAOS First-Fault Stress Report — 2026-07-19

## Verdict

**FAULT REPRODUCED; FIX VERIFIED IN THE WORKTREE.** The single-worker SQLite QA
topology preserved HTTP correctness through 320 mixed users, but ordinary read
latency collapsed at the 320-user saturation stage. The canonical issuer-list
probe exceeded its 500 ms p95 budget twice: **4,000 ms** on discovery and
**1,981 ms** on reproduction.

This is current-tree saturation evidence, not a production capacity promise.
A subsequent Postgres/two-worker confirmation with distinct principals also
crossed the gate at 320 users, although it reduced the probe p95 to 720 ms. A
three-run, instrumented Postgres/two-worker diagnostic then failed the same gate
at 300 users in all three repetitions, with issuer-probe p95 values of 810,
959, and 891 ms (**median 891 ms**).

The applied remediation combines an explicit bounded Postgres pool envelope
with consolidation of four function-style FastAPI policy middleware layers into
one raw ASGI layer. On the same isolated Postgres/two-worker/300-user target,
all three uninstrumented verification repetitions passed: issuer-probe p95 was
**33, 129, and 147 ms**, with zero probe or Locust failures.

## Remediation and verification

The first remedy under test was an explicit Postgres pool of 20 persistent plus
five overflow connections per worker (50 maximum across the supported two
workers). It improved the original median issuer p95 but did not close the
fault: one 300-user run completed 41,377 requests with zero failures and 560 ms
aggregate p95, while the independent issuer oracle still measured **690 ms
p95**. Disabling access-log output, omitting forwarded-email lookup, and
disabling `pool_pre_ping` independently left the oracle above budget. This
falsified pool size, identity resolution, and connection pre-ping as sufficient
root causes.

A cProfile run then concentrated cumulative time in Starlette
`BaseHTTPMiddleware` task/memory-stream machinery. An upper-bound diagnostic
that removed only the four function-style layers raised throughput to 1,335
requests/s and reduced the issuer oracle to 150 ms p95. The product fix therefore
consolidates security headers/cache policy, CSRF, edge-origin proof, and access
telemetry into one raw ASGI layer. It preserves the established policy order,
mutates only `http.response.start` headers, forwards body chunks without
buffering, and logs once after each completed API response. The bounded pool
configuration remains as supporting capacity headroom and is inert for SQLite
and `CAOS_TEST`.

The release oracle used the real application, synchronous access logging,
tracked Locust mix, 15-second ramp, and an independent 200-request/concurrency-20
issuer probe after all 300 users spawned:

| Repetition | Locust requests | HTTP failures | Aggregate p95 | Issuer probe p50 / p95 | Probe errors | Outcome |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 51,105 | 0 | 46 ms | 13 / **33 ms** | 0 | Pass |
| 2 | 49,770 | 0 | 120 ms | 23 / **129 ms** | 0 | Pass |
| 3 | 51,109 | 0 | 35 ms | 24 / **147 ms** | 0 | Pass |

All 3/3 repetitions clear the fixed 500 ms service-preservation gate. Relative
to the pre-fix three-run median of 891 ms, the post-fix median issuer p95 is
129 ms (an 85.5% reduction). `FF-STRESS-001` is therefore **resolved on this
tested topology**; this remains host- and workload-specific evidence rather
than a general production capacity guarantee.

## Discovery target

| Item | Value |
|---|---|
| Commit at server boot | `2228a7386e79ee58546fe0895ce893b8cbcd3ea7` |
| Branch | `codex/112` |
| Worktree | Dirty; pre-existing parallel work plus the dated protocol/report |
| Server | FastAPI 0.138 / uvicorn, one worker, `127.0.0.1:8011` |
| Database | Fresh isolated SQLite under `/tmp/caos-first-fault.UbhGvg/` |
| Data | 30 synthetic issuers; five complete fixture-backed runs |
| Providers | Anthropic, OpenRouter, Gemini, and Google keys blank |
| Existing services | `:8000` and `:8010` left untouched |

The server booted after commit `2228a738` was created at 06:49:04 local time.
All discovery application requests used the process started immediately after
that commit; the Postgres confirmation and fix verification targets are
described in their corresponding sections.

## Ramp results

The fixed read gate passed before mixed load:

| Read | Requests / concurrency | Errors | p95 |
|---|---:|---:|---:|
| Health | 200 / 20 | 0 | 56 ms |
| Runs (`limit=100`) | 200 / 20 | 0 | 88 ms |
| Issuers (`limit=200`) | 200 / 20 | 0 | 169 ms |
| CP-1 module detail | 200 / 20 | 0 | 156 ms |

| Mixed users | Requests | Unexpected failures | Aggregate p95 | Outcome |
|---:|---:|---:|---:|---|
| 20 | 3,817 | 0 | 9 ms | Pass |
| 40 | 7,035 | 0 | 140 ms | Pass |
| 80 | 14,352 | 0 | 86 ms | Pass |
| 160 | 20,564 | 0 | 250 ms | Pass |
| 320 — discovery | 12,774 | 0 | 3,600 ms | **Fault** |
| 320 — reproduction | 19,125 | 0 | 1,400 ms | **Fault reproduced** |

The two 320-user runs had different achieved throughput (approximately 208 and
317 requests/s) but independently crossed the fixed read budget.

## Fault list

### FF-STRESS-001 — Read-path latency collapse by 300 mixed users

- **Class:** availability / latency-budget fault.
- **Severity:** **MEDIUM, saturation-scoped**. The fault reproduces on the
  Postgres/two-worker topology, but 160 users pass and 320 is far above the
  canonical 20-user profile. It would be HIGH only for a deployment committed
  to serving 320 simultaneous active analysts within the 500 ms read budget.
- **Affected paths:** `GET /api/issuers/?limit=200`, `GET /api/runs?limit=100`,
  and `GET /api/runs/{id}/modules/CP-1`.
- **Expected:** a simultaneous 200-request, concurrency-20 issuer-list probe
  remains below 500 ms p95.
- **Observed — discovery:** probe p50 **1,650 ms**, p95 **4,000 ms**, zero
  errors. In the surrounding load, issuer/run/module p95 values were
  3,700/3,700/3,800 ms and maxima were 9,494/8,677/9,182 ms.
- **Observed — reproduction:** probe p50 **1,017 ms**, p95 **1,981 ms**, zero
  errors. In the surrounding load, all three read paths had p95 **1,600 ms**;
  the issuer maximum was 4,336 ms.
- **Server corroboration:** access telemetry contained successful read requests
  taking 1,859 ms and many taking roughly 400–585 ms during reproduction. No
  crash or 5xx was required for the analyst-facing service-level fault.
- **Recovery:** health returned 200 in 2.486 ms after discovery and 2.401 ms
  after reproduction, well inside the 30-second recovery gate.
- **Boundary:** 160 users passed immediately before the fault with zero failures
  and read-path p95 values no higher than 280 ms.
- **300-user reproduction:** three fresh per-repetition shared principals
  produced 43,069, 38,969, and 38,782 Locust requests with zero HTTP failures.
  Aggregate p95 was 620, 670, and 670 ms; the simultaneous issuer probe was
  810, 959, and 891 ms p95. All three crossed the 500 ms gate.
- **Dominant measured delay:** temporary per-worker instrumentation measured
  pool-acquisition p95 at 294–674 ms, while SQL execution p95 stayed at 10–12 ms
  and event-loop scheduling lag p95 stayed at 38–42 ms. Pool acquisition is
  therefore the dominant measured wait at 300 users; the private hook includes
  both pool queue wait and connection creation, so this identifies the layer,
  not yet the precise pool-state transition or optimal fix.

## Postgres/two-worker confirmation

The required production-shaped confirmation used a fresh `pgvector/pgvector:pg18`
database, two uvicorn workers, durable queue executors, 30 issuers, five complete
runs, offline providers, and one unique `X-Forwarded-User` principal per Locust
user. Cross-analyst run sharing was explicitly enabled on this isolated
single-desk target so every synthetic analyst could read the seeded run.

| Stage | Requests | Unexpected failures | Aggregate p95 | Concurrent issuer probe | Outcome |
|---:|---:|---:|---:|---:|---|
| Baseline reads | 200 per path | 0 | n/a | 144 ms p95 | Pass |
| 160 users | 21,909 | 0 | 260 ms | 280 ms p95 | Pass |
| 320 users | 34,102 | 0 | 420 ms | **720 ms p95** | **Fault confirmed** |

At 320 users the load driver achieved approximately 569 requests/s. Its own
issuer-list p95 was 420 ms, but adding the independent normal-user probe pushed
that probe to p50 128 ms / p95 720 ms. This is the protocol's intended
service-preservation check: aggregate HTTP success did not prevent an ordinary
analyst read from breaching budget. Health recovered with HTTP 200 in 63.930 ms.

## Saturation-knee diagnostic

A fresh Postgres/two-worker target then measured 200, 240, and 280 users using
fresh principal namespaces at every stage. Each stage included the same issuer
oracle plus external snapshots of worker CPU/RSS, `pg_stat_activity`, and
established localhost connections. The health probe is an event-loop/service
proxy; Postgres wait states do not expose SQLAlchemy checkout wait, and `lsof`
counts both ends of localhost connections rather than an application queue.

| Users | Requests | Failures | Aggregate p95 | Issuer probe p95 | Health p95 | Worker CPU | Worker RSS | DB snapshot | TCP rows | Outcome |
|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|
| 200 | 25,455 | 0 | 340 ms | 387 ms | 120 ms | 66.4% / 74.4% | 178,608 / 177,552 KiB | 31 sessions; 3 active; 17 idle-in-transaction | 441 | Pass |
| 240 | 26,907 | 0 | 410 ms | 325 ms | 113 ms | 79.1% / 78.7% | 181,472 / 181,200 KiB | 31 sessions; 6 active; 11 idle-in-transaction | 521 | Pass |
| 280 | 32,640 | 0 | 340 ms | 228 ms | 278 ms | 97.0% / 92.2% | 183,248 / 181,840 KiB | 22 sessions; 4 active; 8 idle-in-transaction | 561 | Pass |
| 320 | 34,102 | 0 | 420 ms | **720 ms** | not sampled | not sampled | not sampled | not sampled | not sampled | **Fault** |

The measured service-preservation knee is therefore **greater than 280 and at
most 320 simultaneous users** on this host. Latencies are non-monotonic across
single samples, so the lower p95 at 280 is run variance, not evidence that more
users improve performance. The clearest pressure signal is both workers nearing
one fully utilized core at 280 users. The pool had opened its full documented
30 application connections in the 200/240 snapshots, including many sessions
temporarily idle in transaction, but reads still passed and the 280 snapshot
used fewer connections; this does not prove pool checkout is the dominant wait.
Post-stage health recovered with HTTP 200 in 14.253 ms.

## Repeated 300-user in-process diagnostic

The follow-up used another fresh `pgvector/pgvector:pg18` database, two uvicorn
workers, the same 30-issuer/five-run fixture, offline providers, distinct
per-repetition identity namespaces, and a 15-second ramp to 300 users. All users
within a repetition shared its `X-Forwarded-Email`; although the scratch driver
also varied `X-Forwarded-User`, email has precedence in CAOS identity resolution.
This preserves the canonical shared-principal rate-limit behavior rather than
simulating 300 independent analysts. A temporary ASGI wrapper outside the
product tree recorded request duration and 50 ms event-loop scheduler drift. It
also timed SQLAlchemy's private pool `_do_get` method and SQL execution
callbacks. Counters were reset with `SIGUSR1` before each repetition.

| Repetition | Locust requests | HTTP failures | Aggregate p95 | Issuer probe p50 / p95 | Loop lag p95, workers | Pool acquire p95, workers | SQL execution p95, workers | Request p95, workers |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43,069 | 0 | 620 ms | 182 / **810 ms** | 38 / 38 ms | 669 / 294 ms | 10 / 10 ms | 758 / 377 ms |
| 2 | 38,969 | 0 | 670 ms | 310 / **959 ms** | 38 / 40 ms | 674 / 458 ms | 12 / 12 ms | 776 / 560 ms |
| 3 | 38,782 | 0 | 670 ms | 304 / **891 ms** | 42 / 39 ms | 632 / 524 ms | 12 / 12 ms | 728 / 622 ms |

The median issuer-probe p95 is **891 ms**, and all 3/3 repetitions fail the
fixed 500 ms service-preservation gate without a 5xx or client error. This
narrows the measured knee to **greater than 280 and at most 300 users on the
instrumented target**. The wrapper adds small timing/locking overhead, so the
production-shaped, uninstrumented boundary remains conservatively stated as
greater than 280 and at most 320 until the 300-user control is repeated without
the wrapper.

The wait decomposition changes the leading diagnosis. At 300 users, SQL itself
is not consuming the missing hundreds of milliseconds: its p95 is at most
12.129 ms. Event-loop lag is material but also too small to explain the read
breach alone. Pool acquisition tracks end-to-end request duration and dominates
the tail on both workers in every repetition, with up to 2,483 ms acquisition
max and 2,683 ms request max. This is direct evidence of application-side
connection-pool contention/queuing, subject to the private-hook limitation,
rather than a slow-query bottleneck. Post-load health recovered with zero
errors at p50 7 ms / p95 31 ms (20 requests, concurrency five).

An invalid preflight was excluded before these repetitions: the scratch client
initially expected a `run_id` field and two obsolete endpoint shapes. A
one-user/canonical-endpoint validation then completed 33 requests with zero
failures before counters were reset for repetition 1. No invalid-preflight data
appears in the table.

## Minimal reproduction

With the isolated server seeded as described in the protocol:

```bash
caos/server/.venv311/bin/locust \
  -f /tmp/caos-first-fault.UbhGvg/locust_controlled.py \
  --host http://127.0.0.1:8011 --headless \
  -u 320 -r 20 -t 60s --stop-timeout 10 --only-summary
```

After all 320 users spawn, run:

```bash
caos/server/.venv311/bin/python caos/tests/perf/smoke.py \
  --url 'http://127.0.0.1:8011/api/issuers/?limit=200' \
  --n 200 --concurrency 20 --p95-ms 500 --timeout 10
```

The probe exited 1 on both attempts because p95 exceeded 500 ms.

## Protocol correction discovered en route

The repository's tracked `caos/tests/stress/locustfile.py` is stale relative to
the current report-route contract. It treats `POST /runs/{id}/report` 429 as a
failure even though the route deliberately enforces 12 attempts/minute per
caller, and all local users share the `local-dev` principal. The uncorrected
20-user run therefore reported 336 of 348 report requests as failures. A
scratch-only driver accepted the documented 429 so it would not be confused
with an application fault. The tracked harness now accepts the documented
200/409/429 report outcomes while preserving all other failure accounting.

## Follow-up disposition

The required uninstrumented three-run control and CPU profile are complete; the
results appear in **Remediation and verification** above. No worker-limit
increase was made. Any future capacity claim beyond this 300-user workload must
repeat the protocol on the deployment host and observe Postgres connection
headroom across every application replica.
