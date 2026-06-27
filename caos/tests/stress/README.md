# CAOS Stress Harness

The lazy-first runnable harness for [qa/STRESS_TEST_PLAN.md](../../docs/qa/STRESS_TEST_PLAN.md)
(§9 "not built yet" — this is it). Covers ~80%: **load** (locust), **fault
injection** (mock-Anthropic), and **fat data** (seed). Toxiproxy + Playwright
render-traces are the remaining 20% — add when you need them.

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
BASE_URL=http://127.0.0.1:8010 python caos/tests/stress/seed_stress.py --issuers 300 --runs 5
locust -f caos/tests/stress/locustfile.py --host http://127.0.0.1:8010
```

### 2. Fault injection (LLM lanes)
```bash
# terminal A — the mock (flip MOCK_MODE to ok | 429 | 529 | hang):
MOCK_MODE=hang uvicorn mock_anthropic:app --port 8099 --app-dir caos/tests/stress
# terminal B — QA server pointed at it:
ANTHROPIC_BASE_URL=http://127.0.0.1:8099 ANTHROPIC_API_KEY=test  <start QA server on :8010>
# then drive a run and watch: does a slot hang ~forever (no timeout)? does a
# 429 storm mark the run *degraded* loudly, or silently gate? (S-ENG-02/03)
```

## What to look for

The CRIT/HIGH from STRESS_TEST_PLAN §7 — confirm or disprove each, ticket with a
repro:

- **CRIT** single worker freezes all users · unbounded run queue (no backpressure).
- **HIGH** no Anthropic timeout (→ `hang` mode holds a slot) · no 429 backoff (→ `429` mode silent-gates) · expensive endpoints with no rate limit · zero frontend virtualization.

**Exit:** every CRIT/HIGH reproduced-and-ticketed or proven-not-a-problem.
