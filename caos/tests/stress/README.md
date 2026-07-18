# CAOS Stress Harness

The runnable harness for
[qa/STRESS_TEST_PLAN.md](../../docs/qa/STRESS_TEST_PLAN.md). It covers
**load** (Locust), provider **fault injection** (mock Anthropic/OpenRouter),
malware-scanner behavior (fake clamd), and synthetic data seeding. Target-host
database/network fault injection, real ClamAV contention, and Playwright
render/heap traces remain manual L25 work.

## Pieces

| File | What |
|------|------|
| `mock_anthropic.py` | Fake Anthropic Messages API. Injects 429 / 529 / hang. JSON + SSE. No tokens. |
| `seed_stress.py` | Bulk issuers + a few fat runs into the QA DB via the live API. |
| `locustfile.py` | Hammers the expensive endpoints (report, modules N+1, runs/issuers list, NL). |
| `requirements.txt` | `locust` + `httpx` — stress-only, **not** in CI. |
| `test_mock_anthropic.py` | Pytest check that the mock stays wire-valid. |

## Run it safely

**Never against the user's live `:8000` / `caos.db`.** Use the isolated QA stack
(per [STRESS_TEST_PLAN §0](../../docs/qa/STRESS_TEST_PLAN.md)):

| Knob | Value |
|------|-------|
| Backend | `:8010`, `.venv311`, `caos_qa.db` |
| `SESSION_SECRET` | **fixed** value (else every restart logs everyone out mid-test) |
| `ANTHROPIC_API_KEY` | **unset** for offline load; set to `test` only when pointing at the mock |
| Auth | local-dev identity is auto-granted off-proxy — no headers needed |

```bash
pip install -r caos/tests/stress/requirements.txt
```

### 1. Load (no LLM)
```bash
# QA server on :8010 with ANTHROPIC_API_KEY unset, then:
BASE_URL=http://127.0.0.1:8010 python caos/tests/stress/seed_stress.py --issuers 30 --runs 5
locust -f caos/tests/stress/locustfile.py --host http://127.0.0.1:8010
```

`seed_stress.py` uses the public issuer-create route and therefore respects the
per-principal create rate guard. It must print and assert the count you intend to
test; a request for 300 may admit only 30 in one window. For a 300-issuer scale
profile, use `caos/scripts/seed_qa_scale.py` against the isolated QA database or
pace/partition the API seed deliberately. Never infer the dataset size from the
CLI argument.

### 2. Fault injection (LLM lanes)
```bash
# terminal A — the mock (flip MOCK_MODE to ok | 429 | 529 | hang):
MOCK_MODE=hang uvicorn mock_anthropic:app --port 8099 --app-dir caos/tests/stress
# terminal B — QA server pointed at it. Point BOTH provider base URLs at the
# mock — the default hybrid model routes LIGHT/fast-tier lanes (incl. chat)
# through OpenRouter, not Anthropic, so ANTHROPIC_BASE_URL alone misses them
# (PERF_AUDIT_2026-07-10 Finding 2):
ANTHROPIC_BASE_URL=http://127.0.0.1:8099 ANTHROPIC_API_KEY=test \
OPENROUTER_BASE_URL=http://127.0.0.1:8099 OPENROUTER_API_KEY=test  <start QA server on :8010>
# then drive a run and watch: does a slot hang ~forever (no timeout)? does a
# 429 storm mark the run *degraded* loudly, or silently gate? (S-ENG-02/03)
```

## What to look for

Current controls are bounded, so focus on whether degradation stays explicit and
safe: queue depth and rejections (20 global / three per analyst), per-worker run
and upload caps, DB-pool pressure, memory, 5xx, cross-principal isolation, retry
duplication, and provider timeout/429/529 recovery. `WEB_CONCURRENCY=2` requires
Postgres and permits up to four analytical runs across the two process-local
two-run executors.

**Release exit:** produce the L25 artifact for the immutable candidate and target
configuration; historical CRIT/HIGH rows in the stress plan are hypotheses until
reconciled against current code and reproduced.
