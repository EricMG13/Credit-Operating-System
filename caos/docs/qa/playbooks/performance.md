# CAOS Performance and Scalability Audit

## 1. Objective

You are the Sonnet 5 performance-audit agent. Re-run this goal pre-deploy and
nightly. **Measure and report; do not optimize or edit product code.** Analysts
run dense, multi-window sessions while engine, retrieval, and LLM pipelines
compete for CPU, database connections, provider slots, tokens, and browser main
thread time. Hold the latency and cost envelope before a slow read, unbounded
query, fan-out change, or bundle increase degrades the desk or deploy budget.

Produce one dated report. The only permitted repo writes are that report and an
explicitly approved baseline addition or accepted shift. Treat unavailable
coverage as `INCOMPLETE`, never as `PASS`. Run destructive seeds and load only
against an isolated QA database; never load-test production or the user's live
`:8000` / `caos.db`.

## 2. Scope discovery

Run from the repository root on every audit. Diff the census against the prior
report so new suites, routes, model lanes, and knobs enter scope automatically.

```bash
git rev-parse HEAD
rg --files caos/tests/perf caos/tests/stress caos/tests/server/bench | sort
rg -n "^(def test_|async def test_|class .*\(HttpUser\)|[[:space:]]*@task)" caos/tests/perf caos/tests/stress caos/tests/server/bench
rg -n "@router\.(get|post|put|patch|delete)" caos/server/routes --glob '*.py'
rg -n "self\.client\.(get|post|put|patch|delete)" caos/tests/stress/locustfile.py
rg --files caos/frontend/src/app | rg '/page\.tsx$' | sort

# QA/dev only: deployed production normally disables OpenAPI.
PERF_BASE_URL=http://127.0.0.1:8010
curl -fsS "$PERF_BASE_URL/openapi.json" | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin)["paths"])))'

# Performance and cost controls; any default drift requires a finding or named acceptance.
rg -n "caos_(run_concurrency|run_queue_limit|run_per_analyst_limit|research_concurrency|llm_timeout_s)|synth_concurrency|rerank_(enabled|window)|council_enabled|debate_enabled|advisor_enabled" caos/server/config.py
rg -n "AsyncAnthropic|AsyncClient\(timeout|HttpOptions\(timeout|max_retries" caos/server --glob '*.py'
rg -n "WEB_CONCURRENCY|pool_size|max_overflow|Semaphore|SKIP LOCKED" caos/server caos/deploy --glob '*.py' --glob '*.yml' --glob '*.yaml' --glob '*.env*'
rg -n "_MAX_PER_MINUTE|rate_limit\.hit" caos/server/routes --glob '*.py'

# Data-layer census: candidates still require direct review; grep is not proof.
rg -n "select\(|\.limit\(|\.offset\(|\.scalars\(\)\.all\(\)" caos/server/routes caos/server --glob '*.py'
rg -n -U "for [^\n]+:\n(?:[ \t].*\n){0,12}[ \t].*await (db\.(execute|get)|_[A-Za-z0-9_]+\(db)" caos/server --glob '*.py'

rg -n "^## |^\|" caos/docs/qa/perf/BASELINE.md caos/docs/qa/perf/PERF_AUDIT_*.md caos/docs/qa/perf/E1_STRESS_*.md
```

## 3. Coverage checklist — budgets and gates

Apply the fixed gate and the compatible-baseline gate. A fixed-budget breach
fails even when the baseline also breached. For relative latency metrics, fail
when the median of three valid current runs exceeds the baseline by more than
`max(20% of baseline, 100 ms)`. Never compare different DB engines, worker
counts, seeds, model modes, hardware classes, request counts, or concurrency.

- **API latency:** `smoke.py` uses nearest-rank percentiles:
  `rank = max(1, ceil(pct / 100 * N))`, sample `rank - 1`. Its `--selftest`
  must pass. At `n=200`, concurrency `20`, timeout `10s`, errors must be `0`
  and p95 must hold below `500 ms` for `GET /api/health`,
  `GET /api/runs?limit=100`, `GET /api/issuers/?limit=200`, and
  `GET /api/runs/{id}/modules/CP-1`. Heavy POSTs, including
  `POST /runs/{id}/report`, have no invented absolute budget: gate p50/p95/p99
  against the like-for-like Locust baseline.

- **Scenario benchmark:** all 1,100 `_demo_translate` + `validate_scenario`
  cycles complete in `<100 ms` total. The pytest assertion is binary; report
  elapsed time and `WARN` when headroom falls below `2x` (`>=50 ms`).

- **Graph expansion:** at `K=8`, recall@K is monotonic non-decreasing with
  hops; the genuinely two-hop label lifts `0.00 -> 1.00` from one to two hops;
  two hops never reaches the three-hop label; unlinked Epsilon never appears at
  hops `0,1,2,3,5`; and two-hop dilution exceeds one-hop dilution on the
  one-hop label. Record recall, precision, dilution, surfaced count, and median
  wall time from three scratch-DB runs. Wall time uses the relative latency gate
  above. The synthetic harness is a wiring gate; production stays one-hop until
  real labeled questions satisfy the decision gate in
  `caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md`.

- **Rerank:** on every labeled query, reranked precision@K is at least RRF-only
  precision@K, with at least one strict lift. Zero strict lifts means the lane is
  a latency-cost passthrough and fails. `rerank_window=20` and
  `rerank_enabled=False` remain the token/latency defaults unless an accepted
  change names its new quality and cost evidence.

- **Concurrency and load:** the canonical QA profile is `20` users, ramp
  `5/s`, `60s`; the stored Postgres two-worker profile is `15` users, ramp
  `3/s`, `60s`. Each must have `0` unexpected failures and `0` 5xx. The
  Locust harness deliberately accepts report `409` and NL `429`; all other
  non-2xx responses fail. Endpoint and aggregate p50/p95/p99 obey the relative
  latency gate. `caos_run_concurrency=2` is **per worker process**, so the
  maximum active engine runs is `2 x WEB_CONCURRENCY`; with
  `synth_concurrency=4`, peak synth provider calls are approximately
  `8 x WEB_CONCURRENCY`. `caos_run_queue_limit=20` is the global admission
  ceiling (next submission `503`), `caos_run_per_analyst_limit=3` rejects the
  fourth active/queued analyst run with `429`, and
  `caos_research_concurrency=2` is also per worker. SQLite must reject
  `WEB_CONCURRENCY>1`; Postgres workers must claim with `FOR UPDATE SKIP LOCKED`.

- **Data layer:** zero new N+1 patterns; zero unbounded materializations of
  high-cardinality `Issuer`, `Run`, `Document`, `DocumentChunk`, portfolio, or
  evidence rows; zero synchronous filesystem or CPU-heavy work on the event
  loop. List reads carry an explicit API and SQL cap, per-row data is batch
  fetched with `.in_()` or a join, and doubled fixture cardinality must not
  cause superlinear query-count growth. Re-verify the prior portfolio fixes:
  coverage issuer cap `2,000`, portfolio list cap `200`, issuer match cap
  `5,000`, and batched positions/constraints. Treat
  `sync_analyst_memos` as the scoped accepted risk in section 6, not a blanket
  exemption for new GET-time work.

- **LLM lanes and cost:** `caos_llm_timeout_s=120` bounds Anthropic,
  OpenRouter, and Gemini. Every `AsyncAnthropic(...)` constructor carries both
  `timeout=caos_llm_timeout_s` and `max_retries=0`; OpenRouter passes the same
  timeout to `httpx.AsyncClient`; Gemini converts it to milliseconds. Under
  `MOCK_MODE=hang`, Anthropic and OpenRouter calls release their slot in
  `120-125s`; `>125s` fails. `429`/`529` completes degraded-loudly, never aborts
  the whole run, and obeys the relative latency gate against the bounded-backoff
  baseline. Offline load makes **zero real provider calls**. For the same seed,
  model mode, and model IDs, `tokens_used` and provider-call count may not grow
  by `>20%` without an accepted quality/cost rationale. Rerank, council,
  peer-round, debate, and advisor remain default-off; a silent default flip is a
  cost regression.

- **Frontend bundle and render/hydration:** `npm run build` and
  `npm run analyze` complete with `output: "export"`; Next 16's normal build is
  Turbopack and webpack is fallback-only. No route grows by `>10%` **or**
  `>25 kB` versus its stored bundle baseline, and no shared/vendor chunk crosses
  either gate. On cold Chromium loads of `/command`, `/issuers`, `/query`,
  `/model`, `/reports`, and every changed route, record navigation DCL/load,
  CDP `TaskDuration`, `ScriptDuration`, `LayoutDuration`, and long-task count /
  total. Each median-of-three metric obeys the relative latency gate; no route
  gains a new `>50 ms` long task without attribution. The issuer register keeps
  `[content-visibility:auto]` and `[contain-intrinsic-size:auto_32px]` so
  off-screen rows do not impose full layout/paint cost.

- **Baseline discipline:** use `caos/docs/qa/perf/BASELINE.md` and, only for
  the matching Postgres/two-worker profile,
  `caos/docs/qa/perf/E1_STRESS_2026-07-12.md`. Binary pytest/quality gates do
  not average away. A metric absent from the baseline is `INCOMPLETE`; capture a
  candidate value in the report and add it to the baseline only after a clean,
  reproducible run. Never silently rebase over a failure.

## 4. Procedure — exact invocations

Use `caos/server/.venv311/bin/python`; do not change the FastAPI pin. CI runs
only deterministic/offline commands. Live latency and load require the isolated
QA stack. Production receives the read-only health smoke only.

```bash
# A. CI/nightly: no live server or provider traffic.
python3 caos/tests/perf/smoke.py --selftest
(
  cd caos/server
  .venv311/bin/python -m pytest ../tests/perf -q --durations=0
  .venv311/bin/python -m pytest ../tests/server/bench -q --durations=0
  .venv311/bin/python -m pytest ../tests/stress/test_mock_anthropic.py -q
  .venv311/bin/python -m pytest ../tests/server/test_async_runs.py ../tests/server/test_research_jobs.py ../tests/server/test_run_launcher.py -q

  # Graph quality table plus wall time; every repetition gets a fresh scratch DB.
  BENCH_TMP=$(mktemp -d /tmp/caos-graph-bench.XXXXXX)
  for i in 1 2 3; do
    DATABASE_URL="sqlite+aiosqlite:///$BENCH_TMP/run-$i.db" /usr/bin/time -p \
      .venv311/bin/python ../tests/server/bench/run_graphexpansion_measurement.py
  done
)

(
  cd caos/frontend
  npm run build
  npm run analyze
  du -sk out/*
  find out/_next/static/chunks -name '*.js' -exec wc -c {} + | sort -n | tail -20
)
```

Start the isolated QA stack in two terminals. The backend uses a fresh scratch
DB and blanks every provider-key alias. The fixed session secret keeps the
measurement session stable.

```bash
# Terminal A: backend
cd caos/server
QA_TMP=$(mktemp -d /tmp/caos-perf-qa.XXXXXX)
PORT=8010 DATABASE_URL="sqlite+aiosqlite:///$QA_TMP/caos.db" \
SESSION_SECRET=caos-performance-qa-fixed-session-secret \
ANTHROPIC_API_KEY= OPENROUTER_API_KEY= GEMINI_API_KEY= GOOGLE_API_KEY= \
.venv311/bin/python run.py

# Terminal B: frontend
cd caos/frontend
NEXT_DIST_DIR=.next-perf NEXT_PUBLIC_API_URL=http://127.0.0.1:8010 \
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Seed before latency/render measurements. Use a temporary copy because
`seed_stress.py` otherwise overwrites the tracked manifest.

```bash
PERF_BASE_URL=http://127.0.0.1:8010
cp caos/tests/stress/seed_stress.py /tmp/caos-seed-stress.py
BASE_URL="$PERF_BASE_URL" caos/server/.venv311/bin/python /tmp/caos-seed-stress.py --issuers 300 --runs 5

python3 caos/tests/perf/smoke.py --url "$PERF_BASE_URL/api/health" --n 200 --concurrency 20 --p95-ms 500 --timeout 10
python3 caos/tests/perf/smoke.py --url "$PERF_BASE_URL/api/runs?limit=100" --n 200 --concurrency 20 --p95-ms 500 --timeout 10
python3 caos/tests/perf/smoke.py --url "$PERF_BASE_URL/api/issuers/?limit=200" --n 200 --concurrency 20 --p95-ms 500 --timeout 10
RUN_ID=$(curl -fsS "$PERF_BASE_URL/api/runs?limit=1" | python3 -c 'import json,sys; b=json.load(sys.stdin); print((b if isinstance(b,list) else b["items"])[0]["id"])')
python3 caos/tests/perf/smoke.py --url "$PERF_BASE_URL/api/runs/$RUN_ID/modules/CP-1" --n 200 --concurrency 20 --p95-ms 500 --timeout 10

caos/server/.venv311/bin/locust -f caos/tests/stress/locustfile.py --host "$PERF_BASE_URL" --headless -u 20 -r 5 -t 60s
```

Measure cold render/hydration proxies on the seeded QA stack. The script opens
a fresh browser context per route/sample.

```bash
cd caos/frontend
BASE_URL=http://127.0.0.1:3010 ROUTES=/command,/issuers,/query,/model,/reports node <<'NODE'
const { chromium } = require("@playwright/test");
(async () => {
  const base = process.env.BASE_URL.replace(/\/$/, "");
  const routes = process.env.ROUTES.split(",");
  const browser = await chromium.launch({ headless: true });
  for (const route of routes) for (let sample = 1; sample <= 3; sample++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      globalThis.__caosLongTasks = [];
      new PerformanceObserver(list => globalThis.__caosLongTasks.push(
        ...list.getEntries().map(e => e.duration)
      )).observe({ type: "longtask", buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const lt = globalThis.__caosLongTasks || [];
      return { dclMs: n.domContentLoadedEventEnd, loadMs: n.loadEventEnd,
        longTasks: lt.length, longTaskMs: lt.reduce((a, b) => a + b, 0) };
    });
    const raw = await cdp.send("Performance.getMetrics");
    const m = Object.fromEntries(raw.metrics.map(x => [x.name, x.value]));
    console.log(JSON.stringify({ route, sample, ...nav,
      taskMs: (m.TaskDuration || 0) * 1000,
      scriptMs: (m.ScriptDuration || 0) * 1000,
      layoutMs: (m.LayoutDuration || 0) * 1000 }));
    await context.close();
  }
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
NODE
```

```bash
# Production/pre-deploy deployment: public, read-only health only. Never Locust.
PERF_BASE_URL=https://caos.example
python3 caos/tests/perf/smoke.py --url "$PERF_BASE_URL/api/health" --n 200 --concurrency 20 --p95-ms 500 --timeout 10
```

Fault injection uses two terminals and the isolated QA DB. Restart the mock for
each of `hang`, `429`, and `529`. Point both active provider paths at it and keep
Gemini blank. Run once with the default DeepSeek fast tier (OpenRouter), then
restart terminal B with the shown Claude override (Anthropic).

```bash
# Terminal A
MOCK_MODE=hang caos/server/.venv311/bin/uvicorn mock_anthropic:app --port 8099 --app-dir caos/tests/stress

# Terminal B: omit MODEL_TIER_FAST for the default OpenRouter path; add it for Anthropic.
cd caos/server
PORT=8010 DATABASE_URL=sqlite+aiosqlite:////tmp/caos_perf_fault.db \
ANTHROPIC_BASE_URL=http://127.0.0.1:8099 ANTHROPIC_API_KEY=test \
OPENROUTER_BASE_URL=http://127.0.0.1:8099 OPENROUTER_API_KEY=test \
GEMINI_API_KEY= GOOGLE_API_KEY= MODEL_TIER_FAST=claude-haiku-4-5-20251001 \
.venv311/bin/python run.py

# Driver
curl -sS -o /tmp/caos-llm-fault-response.json -w 'status=%{http_code} total=%{time_total}\n' \
  http://127.0.0.1:8010/api/chat/issuer -X POST \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"what is the leverage"}]}' \
  --max-time 135
```

Finally, inspect every data-layer candidate changed since the previous report's
commit. Confirm SQL caps and batch shape directly; do not declare N+1 safety
from grep alone.

```bash
PREVIOUS_AUDIT_SHA=abc1234
git diff --name-only "${PREVIOUS_AUDIT_SHA}..HEAD" -- caos/server caos/frontend caos/tests/perf caos/tests/stress caos/tests/server/bench
git diff "${PREVIOUS_AUDIT_SHA}..HEAD" -- caos/server/database.py caos/server/routes caos/server/retrieval.py caos/server/run_executor.py caos/server/research_executor.py caos/server/research_report_executor.py
```

## 5. Evidence and reporting

Write `caos/docs/qa/perf/PERF_AUDIT_YYYY-MM-DD.md` with:

- commit SHA; host/CPU/RAM/OS; Python, Node, Next, browser, and dependency lock
  versions; DB engine and cardinalities; worker count; model mode/IDs; keys
  blank/mock/live; seed; request count; concurrency; warm/cold status;
- one table per section 3 area: metric, current p50/p95/p99 or count, compatible
  baseline, fixed/relative threshold, delta, `PASS|WARN|FAIL|INCOMPLETE`;
- raw smoke summaries, pytest timings, graph recall/precision/dilution table,
  rerank results, Locust stats, run/provider concurrency calculation, token and
  provider-call counts, bundle/chunk sizes, and render/hydration JSON medians;
- every new endpoint/suite/knob discovered, every accepted-risk scope check,
  and a suspected owning commit for each verified regression.

Adversarially verify before calling noise a regression or a regression noise:

1. Discard the first cold-server sample, quiet the host, and repeat the failed
   measurement three times unchanged; use the median run, not pooled requests.
2. Match hardware class, DB engine/cardinality, worker count, seed, model mode,
   browser, `n`, concurrency, and timeout. Otherwise report `INCOMPLETE` and do
   not compute a verdict against that baseline.
3. Confirm response status and semantic body: auth redirects, empty DBs, cached
   fallbacks, accepted `409`, and accepted NL `429` can make fast numbers false.
4. Separate provider variance from CAOS overhead with the mock; separate graph
   quality gates from process-start/seed time; compare bundle bytes with the
   same method used by the baseline.
5. Re-run the nearest owning test alone, then the complete relevant suite. Use
   `git log <previous-audit-sha>..HEAD -- <owner>` to identify the likely change.

Do not fix findings. Report severity, reproduction, measured impact, and owner.
Update the baseline only for a reproducible new metric or an explicitly accepted
intentional shift, with date, cause, environment, and approver. Never overwrite
historical values.

## 6. Accepted-risk register

Verify each item remains within its stated scope; do not re-file it unless the
scope or deployment posture changed.

| Accepted risk | Scope and boundary |
|---|---|
| `smoke.py` is a stdlib nearest-rank rig | Single-process sanity gate, not load characterization; Locust owns concurrency evidence. |
| No absolute total-bundle cap | Current baseline is per route/shared chunk and `du` is block-rounded; deltas are gated. Migrate measurement deliberately, never mix byte methods. |
| Synthetic graph labels | Directional wiring only; production two-hop enablement still requires real labeled cross-issuer questions. |
| Expensive LLM lanes default-off | Rerank/council/peer-round/debate/advisor latency and tokens are opt-in; a default flip is not accepted. |
| `turbopackFileSystemCacheForDev=false` | Slower cold dev starts are accepted to prevent the observed unbounded cache/write storm. |
| `sync_analyst_memos` runs from Query GETs | Filesystem parse is thread-offloaded and mtime/cooldown gated, but a changed vault still scans all issuers and rewrites `AnalystLink`; watch latency as vault/coverage grows. |
| Some admission and rate-limit state is per process | Run/research/report execution is Postgres `SKIP LOCKED` safe, but rate limits and the create-run lock remain process-local. Reassess on worker/replica growth; calculate caps with `WEB_CONCURRENCY`. |
| SQLite and Postgres performance differ | Compare like-for-like only; multi-worker SQLite is forbidden. |
| Gemini is outside `mock_anthropic.py` | Timeout is statically bounded, but nightly hang/429/529 replay covers Anthropic and OpenRouter only. If Gemini becomes a default lane, missing fault injection becomes `FAIL`, not accepted. |
| Browser numbers are hydration proxies | CDP task/script/layout and long-task metrics are accepted until CAOS emits a dedicated hydration mark; keep browser/build/route state identical. |
| Existing load is a smoke profile, not calibrated `2x pilot` | The stored 15-user/two-worker and 20-user QA runs are valid only at those profiles. Until an owner sets pilot concurrency, claim no `2x` capacity result. |
