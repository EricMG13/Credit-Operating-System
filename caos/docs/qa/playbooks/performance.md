# CAOS Performance Audit Playbook

Goal-prompt for the auditing agent (Sonnet). Re-run pre-deploy and nightly.
**Measure and report — never optimize or edit product code.** Findings become
tickets; the only files you write are the report and (on accepted shifts) the
baseline (§5). All paths relative to the repo root; server commands use
`caos/server/.venv311/bin/python` (never downgrade the fastapi pin).

## 1. Objective

Hold the latency and cost envelope. Analysts run dense multi-window sessions
that dispatch engine runs (CP-X DAG), LLM lanes, and retrieval; a p95
regression on the hot read endpoints degrades every desk session, and a query
or LLM-default regression (unbounded scan, silent flip of a default-off lane)
blows the deploy budget. Your job: measure current numbers, compare against
the stored baseline, apply the gates in §3, adversarially verify any breach
(§5), and ship one dated report.

## 2. Scope discovery — run fresh every audit

The stack drifts; enumerate before measuring, and diff each list against the
previous report so new suites/endpoints/knobs enter coverage automatically.

```bash
ls caos/tests/perf caos/tests/stress caos/tests/server/bench      # current suites
git log --oneline -8 -- caos/tests/perf caos/tests/stress caos/tests/server/bench

# Endpoint census (QA server only — prod sets openapi_url=None, this 404s there):
curl -s http://127.0.0.1:8010/openapi.json | python3 -c \
  "import json,sys; print('\n'.join(sorted(json.load(sys.stdin)['paths'])))"
# Offline fallback:
grep -rn "@router\.\(get\|post\|put\|delete\)" caos/server/routes --include="*.py" | wc -l

# Perf-relevant knobs — any changed default is a finding until explained:
grep -nE "caos_run_concurrency|caos_run_queue_limit|caos_run_per_analyst_limit|caos_llm_timeout_s|synth_concurrency|caos_research_concurrency|rerank_enabled|rerank_window|council_enabled|debate_enabled|advisor_enabled" caos/server/config.py

# Rate-limit census:
grep -rn "_MAX_PER_MINUTE\|rate_limit\.hit" caos/server/routes --include="*.py"
```

## 3. Coverage checklist — budgets to hold

Each line is a threshold, not a step. FAIL only after §5 noise verification.

**API endpoint latency** ([smoke.py](../../../tests/perf/smoke.py)) — nearest-rank
percentile: `rank = max(1, ceil(pct/100 · N))`; `--selftest` pins the math and
must pass first.
- `/api/health`: p95 < 500 ms at n=200, concurrency=20, errors = 0 (script defaults).
- Hot reads (`GET /api/runs?limit=100`, `GET /api/issuers/?limit=200`,
  `GET /api/runs/{id}/modules/CP-1`): p95 < 500 ms, same load, errors = 0.
- `POST /runs/{id}/report` (the heavy re-assembly) and other POSTs: no fixed
  budget — read latency from locust's stats table and gate vs baseline.

**Scenario benchmark** (`caos/tests/perf/test_scenario_benchmark.py`) — 1,100
translate+validate cycles complete < 100 ms total, offline. Binary gate;
report measured headroom, WARN when headroom < 2×.

**Graph expansion** (`caos/tests/server/bench/`, 9 tests) —
- recall@K monotonic non-decreasing in hops;
- 2-hop recall lift real (2-hop-relevant chunk: 0.00 at 1-hop → 1.00 at 2-hop);
- hop bound exact (2-hop never reaches the 3-hop chunk);
- unlinked control (Epsilon) never surfaces at hops 0–5 — a leak is a
  scope-correctness FAIL, not a perf number;
- dilution grows with hops (the cost side of expansion).
Production default is 1-hop; a default flip to 2-hop must cite the real-data
gate in [GRAPH_EXPANSION_2HOP_MEASUREMENT.md](../../GRAPH_EXPANSION_2HOP_MEASUREMENT.md).

**Rerank precision** (same bench dir) — rerank precision@K ≥ RRF-only on every
labeled query AND ≥ 1 strict lift (zero lifts = wiring is a passthrough
regression). `rerank_window` stays 20 (the latency/token bound);
`rerank_enabled` default stays False.

**Concurrency caps & load** — hold the configured backpressure:
`caos_run_concurrency=2`, `caos_run_queue_limit=20` (submission #21 is
*rejected*, not queued), `caos_run_per_analyst_limit=3`,
`caos_research_concurrency=2` (semaphore), `synth_concurrency=4` per run
(peak provider calls ≈ run_concurrency × synth_concurrency = 8). Under locust
(§4C): no 5xx on the four expensive endpoints; NL-lane 429s are the 20/min
limiter working and count as success.

**LLM-lane timeout adherence** — `caos_llm_timeout_s=120` is set at client
construction (`caos/server/llm.py`); under `MOCK_MODE=hang` a lane must free
its slot at ~120 s, never pin; under `MOCK_MODE=429`/`529` the run completes
*degraded loudly* (fault isolation: Blocked gate / return_exceptions /
deterministic fallback), never aborts.

**Data layer — N+1 and unbounded queries** — lenses from
[REVIEW_MATRIX_PERF.md](../REVIEW_MATRIX_PERF.md):
- every list query on Issuer/Run/Chunk/Document/Portfolio carries `.limit()`;
- no per-row awaited query inside a loop — batch with `.in_()`;
- no synchronous filesystem/CPU-heavy work on the event loop in GET handlers.
Sweep routes changed since the last audit
(`git diff --name-only <last-audit-sha> -- caos/server/routes` + read each for
the three lenses). Re-verify the matrix findings' status each run (as of
2026-07-10: `portfolio.py` capped at `.limit(2000)`; `portfolios.py` batched
via `.in_()`; `sync_analyst_memos` still runs on GET capabilities/graph —
mtime-gated, watch its cost as the vault grows).

**Frontend bundle & render** — `cd caos/frontend && npm run build`
(`next build --webpack`, static export to `out/`). Record First Load JS per
route; gate: no route grows > 10% or > 25 kB vs baseline without a named
cause. `turbopackFileSystemCacheForDev: false` must remain in
`next.config.js` (dev crash guard). Issuers register keeps native windowing
(`content-visibility:auto` on the register rows) so painted rows ≈ viewport,
not the full ~4,500-node table.

**Regression gates vs baseline** — baseline lives at
`caos/docs/qa/perf/BASELINE.md` (create on first audit from that run's
numbers, tagged with host + DB engine + commit). Latency regression = the
median of 3 re-runs is worse than baseline by > 20% **or** > 100 ms,
whichever is larger. Pytest/bench gates are binary. Bundle gate above.

## 4. Procedure — exact invocations

Order: CI-safe first, then live QA stack, then fault injection. **Never
load-test the user's live `:8000` / `caos.db`; never seed or locust a
production host** — prod gets the read-only `/api/health` smoke only.

```bash
# A. CI-safe (no server, deterministic — this is what nightly CI can run)
python3 caos/tests/perf/smoke.py --selftest                     # percentile-math gate
cd caos/server
.venv311/bin/python -m pytest ../tests/perf -q                  # scenario benchmark < 100 ms
.venv311/bin/python -m pytest ../tests/server/bench -q          # graph-expansion + rerank gates (9)
.venv311/bin/python -m pytest ../tests/stress/test_mock_anthropic.py -q   # fault mock stays wire-valid
# The pytest suites above are DB-isolated (conftest points DATABASE_URL at a tmp
# caos_tests.db). The standalone runner below is NOT — it commits synthetic
# issuers with no cleanup. ALWAYS point it at a scratch DB, never the live caos.db:
DATABASE_URL="sqlite+aiosqlite:////tmp/caos_bench.db" \
  .venv311/bin/python ../tests/server/bench/run_graphexpansion_measurement.py  # recall/dilution table
cd ../frontend && npm run build                                 # capture the First Load JS route table

# B. Live latency — isolated QA stack ONLY (:8010, .venv311, caos_qa.db,
#    FIXED SESSION_SECRET, ANTHROPIC_API_KEY unset)
python3 caos/tests/perf/smoke.py --url http://127.0.0.1:8010/api/health
python3 caos/tests/perf/smoke.py --url "http://127.0.0.1:8010/api/runs?limit=100" --p95-ms 500
python3 caos/tests/perf/smoke.py --url "http://127.0.0.1:8010/api/issuers/?limit=200" --p95-ms 500
# Module-detail read needs a real run id — discover one first:
RUN_ID=$(curl -s "http://127.0.0.1:8010/api/runs?limit=1" | python3 -c "import json,sys; b=json.load(sys.stdin); print((b[0] if isinstance(b,list) else b['items'][0])['id'])")
python3 caos/tests/perf/smoke.py --url "http://127.0.0.1:8010/api/runs/$RUN_ID/modules/CP-1" --p95-ms 500
# Pre-deploy, against the deployed host (read-only):
python3 caos/tests/perf/smoke.py --url https://<deploy-host>/api/health

# C. Load (QA stack only; pip install -r caos/tests/stress/requirements.txt)
BASE_URL=http://127.0.0.1:8010 python3 caos/tests/stress/seed_stress.py --issuers 300 --runs 5
locust -f caos/tests/stress/locustfile.py --host http://127.0.0.1:8010 --headless -u 20 -r 5 -t 60s

# D. Fault injection — LLM timeout adherence (terminal A: the mock)
MOCK_MODE=hang uvicorn mock_anthropic:app --port 8099 --app-dir caos/tests/stress
# terminal B: QA server with ANTHROPIC_BASE_URL=http://127.0.0.1:8099 ANTHROPIC_API_KEY=test,
# drive one run; slot must free at ~120 s. Repeat MOCK_MODE=429 → degraded-loudly, run completes.
```

Keep smoke's n/concurrency/timeout at defaults across audits or the numbers
stop being comparable. smoke is GET-only — POST latency comes from locust.

## 5. Evidence & reporting

Write `caos/docs/qa/perf/PERF_AUDIT_YYYY-MM-DD.md`: environment (host, DB
engine, commit sha, model mode), then one table per §3 area — current vs
baseline vs threshold, verdict PASS/WARN/FAIL — plus the locust stats table,
the graph-expansion recall/dilution table, and the bundle route table.

**Adversarial verification before any FAIL.** A p95 of n=200 is one noisy
order statistic. A regression is real only if all hold:
- re-run 3×, compare **medians** — the median re-run still breaches;
- quiet host (no parallel builds/tests), first run against a cold server discarded;
- identical n/concurrency/timeout to baseline;
- same DB engine as baseline — SQLite (QA) vs Postgres (prod) numbers are
  never comparable.
Then localize: `git log` since the last audit over the owning module, name the
suspect commit in the report.

Baseline updates only for intentional accepted shifts, each entry with cause +
date. Never silently rebase the baseline over a FAIL.

## 6. Accepted-risk register

Known-accepted — verify still-scoped, do not re-flag:

| Risk | Why accepted |
|---|---|
| Rate limiter, run-executor locks, semaphores are per-process | Single-replica Phase-1 deploy; invalid on scale-out (`ponytail:` comments name the ceiling) |
| Overall bundle size | By-design (goal audit 2026-07-01); only per-route deltas are gated |
| smoke.py is a stdlib nearest-rank rig, not load characterization | Single-process pilot gate; swap for k6/locust at scale-out |
| NL-lane 429s under load | The 20/min limiter working as designed |
| rerank / council / peer-round / cross-model / debate / advisor default-off | Latency + token cost are opt-in; only a *default flip* is a finding |
| Graph-expansion numbers are synthetic (RT-2026-07-07-17) | Directional; 2-hop production enable stays gated on real-data labels |
| `turbopackFileSystemCacheForDev: false` → slower cold dev starts | Crash guard (41–58 GB cache growth, write storms) |
| `sync_analyst_memos` full vault rescan on mtime change inside GET | mtime-gated no-op in the common case; revisit when the vault is large |
| SQLite (dev/QA) vs Postgres (prod) latency skew | Baselines tagged with DB engine; compare like-for-like only |
