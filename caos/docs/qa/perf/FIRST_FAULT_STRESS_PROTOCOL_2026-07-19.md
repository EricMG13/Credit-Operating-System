# CAOS First-Fault Stress Protocol — 2026-07-19

## Objective

Run progressively heavier offline load against the current CAOS working tree
until the first unexpected application fault occurs. Reproduce that fault,
preserve the evidence, and stop. This is fault discovery, not capacity
certification and not a release verdict.

## Scope and target

- Target: a new CAOS process on `127.0.0.1:8011`.
- Data: a fresh SQLite database and vault under a unique `/tmp` directory.
- Providers: Anthropic, OpenRouter, Gemini, and Google keys blank; no live EDGAR
  stress and no production traffic.
- Existing listeners on `:8000` and `:8010` are out of scope and must not be
  stopped, seeded, or queried.
- Tested code: the current dirty working tree on branch `codex/112`. A finding
  is current-tree evidence until it is repeated on an immutable candidate.
- Product source is read-only for this goal. Only this protocol, the critic
  record, and a dated evidence report may be written.

## Failure oracle

The first reproducible occurrence of any item below is a fault:

1. Process crash, unhandled server exception, corrupted response, or state
   integrity mismatch.
2. Unexpected HTTP status. Endpoint-specific designed controls remain valid:
   `POST /api/query/nl` may return `429`; report generation may return `409`;
   documented queue/admission limits may return `429` or `503` with an honest
   rejection body.
3. Connection error or client timeout while the server is otherwise expected
   to be serving.
4. Fixed read-budget breach: any of the canonical read smokes returns an error
   or p95 reaches/exceeds 500 ms at 200 requests and concurrency 20.
5. Load-run unexpected failure rate above 0%, any 5xx, or failure to recover to
   a successful health check within 30 seconds after the load stage.

A single noisy client observation is provisional. Re-run the smallest failing
stage once. A deterministic server traceback is independently sufficient.

## Staged ramp

| Stage | Driver | Load | Pass condition |
|---|---|---|---|
| 0 — boot | `GET /api/health` | one request | 2xx; migrations and startup complete |
| 1 — seed | copied `seed_stress.py` | 30 issuers, 5 runs | requested counts created; runs reach terminal state |
| 2 — read gate | `smoke.py` | 200 requests, concurrency 20, each canonical read | zero errors; p95 < 500 ms |
| 3 — mixed baseline | Locust | 20 users, ramp 5/s, 60 s | zero unexpected failures and zero 5xx |
| 4 — concurrency ramp | Locust | 40, 80, 160 users; ramp 10/s; 60 s each | same oracle; health recovers after each stage |
| 5 — saturation | Locust | double users until the first fault or 640 users | stop immediately on the first oracle violation |

Canonical reads are health, runs list (`limit=100`), issuers list
(`limit=200`), and one seeded CP-1 module detail. Locust exercises runs and
issuer lists, CP-1 module detail, report assembly, and the fixture NL lane.

## Evidence to preserve

- Git commit/branch and dirty-tree status.
- Scratch target paths and sanitized environment facts (never secret values).
- Exact driver command, seed cardinality, user/ramp/duration, request totals,
  endpoint p50/p95/p99, unexpected status counts, and 5xx counts.
- Server log around the first fault and a post-stage health result.
- Minimal reproduction result and fault classification: availability,
  correctness/integrity, latency-budget, or controlled backpressure.

## Stop and report

After reproducing the first fault, do not tune or patch the product. Write one
dated report under this directory listing the fault, severity, affected route,
load level, expected behavior, observed behavior, evidence, and the next
confirmation required. If the ramp reaches 640 users without a fault, expand
to provider fault injection or browser memory stress in a new protocol revision;
do not silently declare unlimited capacity.
