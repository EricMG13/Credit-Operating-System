# Performance Audit — 2026-07-10

Executed [caos/docs/qa/playbooks/performance.md](../playbooks/performance.md)
end to end (§4A–D). First audit — no prior baseline; this run establishes
[BASELINE.md](BASELINE.md). Environment: macOS laptop, QA stack `:8010`,
`.venv311` (py3.11, fastapi 0.138), SQLite `caos_qa.db` (~572 issuers,
multiple complete runs). Commit `a4db0962`.

## Summary

| Area | Verdict |
|---|---|
| API latency (§4B) | PASS (4/4; issuers-list at 98% of budget) |
| Scenario benchmark + bench suites (§4A) | PASS (10/10) |
| Graph expansion / rerank | PASS — matches documented measurement exactly |
| Load / concurrency (§4C) | PASS (0 errors/5xx, 3,786 reqs, rate limiter fires correctly) |
| LLM-lane timeout adherence (§4D) | **FAIL** — see Finding 1 |
| Fault-injection harness scope | **FAIL** (doc drift) — see Finding 2 |
| Offline-load isolation | **FAIL** (cost leak) — see Finding 3 |
| N+1 / unbounded queries | PASS — both REVIEW_MATRIX_PERF highs already fixed |
| Frontend bundle | Baseline captured, no prior to compare |

## §4A — CI-safe suites

- `smoke.py --selftest`: PASS.
- `pytest caos/tests/perf`: 1 passed (scenario benchmark, <100ms gate).
- `pytest caos/tests/server/bench`: 9 passed (graph-expansion + rerank).
- `pytest caos/tests/stress/test_mock_anthropic.py`: 3 passed.
- Graph-expansion measurement runner (scratch `DATABASE_URL`): recall/dilution
  table reproduced exactly against
  [GRAPH_EXPANSION_2HOP_MEASUREMENT.md](../../GRAPH_EXPANSION_2HOP_MEASUREMENT.md)
  — recall lift 0.00→1.00 at 2-hop for the genuinely-2-hop query, hop bound
  exact, Epsilon control never leaked hops 0–5.
- `npm run build`: succeeds, 17 static routes, First Load JS table captured
  in BASELINE.md.

## §4B — Live latency (see BASELINE.md for full table)

All 4 endpoints PASS. **Watch item:** `GET /api/issuers/?limit=200` p95=489ms
against a 500ms budget — 11ms headroom on ~572 seeded issuers. Not a FAIL, but
re-run before drawing a trend conclusion (single n=200 sample); if this
migrates toward Postgres/prod scale (thousands of issuers per the
REVIEW_MATRIX_PERF `/api/portfolio` unbounded-query note), re-measure with a
realistic issuer count before trusting this margin.

## §4C — Load (60s, 20 users, ramp 5/s)

3,786 requests, 0 failures, 0 5xx. Full table in BASELINE.md. Rate limiter
verified firing via server log (`POST /api/query/nl` → 429 "Too Many
Requests", not silently gated) — confirms the 20/min NL limiter works under
concurrent load, not just in isolation.

**Operational note:** the QA server process died unexpectedly between the
load-test run and the next latency check (health-check failed, port not
listening, no crash trace captured — the harness-managed preview process was
gone before logs could be pulled). Restarted cleanly with no further
recurrence across the rest of the audit. Not attributed to a specific cause —
flag if it recurs on a future run.

## §4D — Fault injection — 3 confirmed findings

### Finding 1 (HIGH) — LLM per-call timeout is ~1.7–3x its documented ceiling

`caos_llm_timeout_s=120` is set as the `timeout=` kwarg at every
`anthropic.AsyncAnthropic(...)` construction site
([llm.py:60](../../../server/llm.py:60),
[engine/llm_client.py:36](../../../server/engine/llm_client.py:36),
[nlquery.py:240,307](../../../server/nlquery.py:240),
[scenario.py:166](../../../server/scenario.py:166) — 5 sites, identical
pattern). The comment at
[config.py:74-81](../../../server/config.py:74) states this bounds "a stuck
inference" to ~120s. **It does not.** None of the 5 sites passes
`max_retries=`, so the Anthropic SDK's own default (`max_retries=2`,
confirmed via `anthropic==0.111.0` — 1 initial attempt + 2 SDK-level retries)
applies on top of the per-attempt timeout.

**Measured:** driving the chat lane (`POST /api/chat/issuer`) against
`mock_anthropic.py` in `MOCK_MODE=hang` produced two internal SDK retry log
lines (`anthropic._base_client:Retrying request...`) before the app finally
surfaced a 502, at **`dur_ms=209131`** (209.1s) — not a permanent hang (it
does resolve, cleanly, to a 502 with a client-facing message — graceful
degradation holds), but 1.74x the single-attempt budget the config comment
promises, and up to ~3x (360s) is possible depending on where in the
attempt the SDK's timeout fires.

**Blast radius:** every Anthropic-routed lane (chat, nlquery x2, scenario,
and — via `engine/llm_client.anthropic_client()` — synth/council/debate/
extractors) shares this construction pattern, so this is systemic, not
isolated to chat. During a real sustained Anthropic-side outage or network
partition, a request can pin an analyst-facing slot (and, for engine lanes,
a `caos_run_concurrency`/`synth_concurrency` slot) for up to 3x the intended
worst case — directly the "expensive... pipelines... latency regressions...
degrade the desk experience" risk this playbook exists to catch.

**Contrast — overload (429/529) handling is correct and fast:** the same
chat lane against `MOCK_MODE=429` resolved in 14.5s via the *app-level*
`is_overloaded`-gated fallback+retry in `engine/llm_client.py` (primary model
→ fallback model → bounded exponential backoff, max 3 attempts, 8s cap) —
working exactly as documented (M-2). The gap is specific to **silent
hangs**, which bypass the app-level overload-aware path and fall through to
the SDK's own retry-on-timeout, which CAOS's config does not control.

Not fixed (measure-and-report scope). Recommend: pass `max_retries=0` (or a
low explicit value) alongside `timeout=caos_llm_timeout_s` at all 5
construction sites, so the configured timeout is the actual ceiling, and let
CAOS's own app-level fallback (which already exists and already works)
handle retry policy in one place instead of two.

### Finding 2 (MEDIUM) — fault-injection harness has an undocumented scope gap

`caos/tests/stress/mock_anthropic.py`'s docstring claims "every lane (engine
synth, chat, nlquery, scenario, deepresearch) hits this instead of the real
API." **False under the current default model mode.** `ask_issuer`'s LIGHT
tier resolves to `model_tier_fast = "deepseek/deepseek-v4-flash"`
([config.py:101](../../../server/config.py:101)), and
`engine/llm_client._provider()` routes any model id containing `/` or
starting with `deepseek`/`openrouter` to `_create_openrouter()`
([engine/llm_client.py:63](../../../server/engine/llm_client.py:63)) — a
separate `httpx.AsyncClient` that never touches `ANTHROPIC_BASE_URL`.
Confirmed by direct measurement: the first hang-mode attempt (no model
override) returned a **real, coherent 15.3s DeepSeek response** instead of
hitting the mock at all.

Good news found in the same investigation: `engine/openrouter.py:160`
independently sets `httpx.AsyncClient(timeout=s.caos_llm_timeout_s)` — the
timeout *mechanism* is present and consistent on the OpenRouter path too. But
it is not exercised by the documented stress workflow, so a future
regression on that path (e.g., someone drops the explicit timeout during a
refactor) would go undetected by `mock_anthropic.py`-based testing. This
drifted in when the model-mode hybrid (DeepSeek-default via OpenRouter)
shipped after the mock harness was authored Anthropic-only.

To get a true reading on the Anthropic path in this audit, `MODEL_TIER_FAST`
was overridden to `claude-haiku-4-5-20251001` for the test process only (env
var, no product-code change) — see §4D above. Playbook §4 updated with this
caveat.

### Finding 3 (MEDIUM, cost) — "offline load" isn't offline under the default hybrid

During §4C's load test (`ANTHROPIC_API_KEY` unset per the playbook's own
"offline load" instruction), server logs recorded one **real, billed**
`lane=query-insights` LLM call (DeepSeek via OpenRouter, 17.3s,
input_tokens=1429/output_tokens=467) — not triggered by `locustfile.py`
(which never calls `/api/query/insights`) or by the preview seed tab (which
only loads `/issuers`); trigger unidentified but the mechanism is clear:
`qa-backend`'s `launch.json` config blanks `ANTHROPIC_API_KEY` only —
`OPENROUTER_API_KEY` and `GEMINI_API_KEY` stay live from `.env`, and the
default hybrid routes most lanes through OpenRouter regardless. Playbook §4
updated to require blanking all three keys for a genuinely offline load run.

## Data layer — N+1 / unbounded queries

Re-verified both REVIEW_MATRIX_PERF highs against current code — **both
already fixed**, no regression:
- `routes/portfolio.py:76` — `select(Issuer).limit(2000)` (capped).
- `routes/portfolios.py:97-103` — batched via `.in_(pids)` (no per-row loop).

`sync_analyst_memos` (the MED finding, vault_export.py:469) confirmed still
present but properly guarded: `asyncio.to_thread`-offloaded scan with an
explicit `_scan_cooldown_seconds` gate (vault_export.py:482-499) — not a
regression, matches the accepted-risk register entry.

## Frontend bundle

Baseline captured (BASELINE.md) — no prior run to diff against. Largest
routes: `/model` and `/query` at 132K each (du block-rounded). Largest
shared vendor chunk 896K (`4052.*.js`) — worth identifying its contents on
the next audit if it grows further; out of scope to investigate here
(measure-and-report).

## Adversarial verification applied

- Finding 1: re-derived from `dur_ms` in the structured access log (not just
  wall-clock observation), cross-checked against SDK's documented default
  `max_retries=2` via direct introspection (not assumed from memory), and
  confirmed the pattern is identical at all 5 call sites (not cherry-picked).
- Finding 2: confirmed by two independent signals — the response content
  itself (coherent DeepSeek prose vs. the mock's fixed canned string) and
  static trace of `_provider()`'s routing logic.
- Finding 3: confirmed the LLM call did not originate from any traffic this
  audit generated (grepped locustfile.py and the preceding access log) before
  concluding it was a live-key leak rather than test-harness noise.
- Issuers-list 489ms/500ms: flagged as a watch item, not escalated to FAIL —
  single n=200 sample, no re-run performed to confirm it's a stable margin
  rather than noise (matches §5's own noise-verification standard: don't
  fail on inline evidence).

## Accepted for this run, not re-flagged

- QA-server mid-audit restart (§4C note) — no evidence pointing at product
  code; not escalated without a root cause.
- Frontend bundle has no prior baseline to gate against — informational only.
