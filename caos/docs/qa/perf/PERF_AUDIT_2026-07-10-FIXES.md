# Performance Audit — Fixes — 2026-07-10

Follow-up to [PERF_AUDIT_2026-07-10.md](PERF_AUDIT_2026-07-10.md). All 3
findings fixed same day, on user request (scope change from the playbook's
default measure-and-report mode). Full server test suite (1,302 tests) run
clean after all changes; each fix additionally re-verified live against a
running QA stack, not just by test/code inspection.

## Finding 1 (HIGH) — LLM per-call timeout ceiling

**Fix:** added `max_retries=0` alongside the existing `timeout=caos_llm_timeout_s`
at all 5 `AsyncAnthropic(...)` construction sites:
[llm.py:60](../../../server/llm.py:60),
[engine/llm_client.py:34](../../../server/engine/llm_client.py:34),
[nlquery.py:240](../../../server/nlquery.py:240),
[nlquery.py:307](../../../server/nlquery.py:307),
[scenario.py:166](../../../server/scenario.py:166). The app's own
`is_overloaded`-gated fallback/retry in `engine/llm_client.py` is now the
single retry policy on top of a hung/errored SDK call, instead of stacking
with the SDK's own default.

**Re-verified live** (fresh mock + QA server, `MOCK_MODE=hang`,
`MODEL_TIER_FAST=claude-haiku-4-5-20251001` to force the Anthropic path): two
independent runs, **121.2s and 120.3s** (both `POST /api/chat/issuer` → 502,
matching `caos_llm_timeout_s=120` almost exactly) — down from 209.1s
pre-fix. No `anthropic._base_client:Retrying...` log lines this time (single
attempt, as intended).

Full server suite: 1,302 passed, 2 skipped, no regressions from the config
change to all 5 client constructors.

**Disclosed tradeoff:** confirmed via SDK source
(`anthropic._base_client.SyncAPIClient._should_retry_exception`) that the
SDK's default `max_retries=2` covered both `APITimeoutError` (the hang case)
*and* `APIConnectionError` (a one-off connection reset / DNS hiccup — a
genuinely transient blip, not a sustained failure). `max_retries=0` removes
free retries for both classes uniformly; CAOS's own `is_overloaded`-gated
fallback in `engine/llm_client.py` only recognizes HTTP-status-based errors
(429/502/503/529), not raw connection exceptions, so it does not backfill
this gap. Net effect: a rare one-off connection blip now surfaces as an
immediate 502 (chat/nlquery/scenario all degrade gracefully — no data
corruption, no silent wrong answer) instead of being silently absorbed by an
SDK-level retry. Judged acceptable — the finding's own evidence was a
*sustained* failure where every retry re-pays the full 120s, and the
original code comment's stated intent was already "timeout is a hard
ceiling"; this fix makes the code match that stated intent. Flagging here so
a future reader doesn't mistake the occasional "try again" 502 on a genuine
blip for a new bug.

## Finding 2 (MED) — mock-harness OpenRouter coverage gap

**Fix:**
- Added `openrouter_base_url: str = "https://openrouter.ai/api/v1"` to
  [config.py](../../../server/config.py) (env `OPENROUTER_BASE_URL`, mirrors
  how the Anthropic SDK reads `ANTHROPIC_BASE_URL` natively).
- [engine/openrouter.py](../../../server/engine/openrouter.py) now builds its
  request URL from `s.openrouter_base_url` instead of a hardcoded string.
- Added `POST /chat/completions` to
  [mock_anthropic.py](../../../tests/stress/mock_anthropic.py) — OpenAI
  chat-completions response shape, sharing the same `MOCK_MODE`
  (ok/429/529/hang) dispatch as the existing `/v1/messages` route.
- Updated the mock's docstring and
  [README.md](../../../tests/stress/README.md) to point both
  `ANTHROPIC_BASE_URL` and `OPENROUTER_BASE_URL` at the mock — the original
  "every lane hits this" claim is now actually true for the two active
  default-hybrid providers (Gemini lanes remain explicitly out of scope,
  noted in the docstring).
- Added 2 tests to `test_mock_anthropic.py` (ok-shape, 429-mode) for the new
  route — 5/5 pass.

**Re-verified live end-to-end**, no model-tier override (default hybrid
routing): `POST /api/chat/issuer` against a QA server with
`OPENROUTER_BASE_URL` pointed at the mock (`MOCK_MODE=ok`) returned
`{"reply":"Mock response. Not real analysis."}` in **56.4ms** — the mock's
literal canned string, not a real DeepSeek response (the pre-fix behavior was
a genuine 15.3s DeepSeek reply, confirming the mock was bypassed entirely
before this fix).

## Finding 3 (MED, cost) — offline-load key leak

**Fix:** `qa-backend`'s entry in [launch.json](../../../../.claude/launch.json)
now also blanks `OPENROUTER_API_KEY` and `GEMINI_API_KEY` (previously only
`ANTHROPIC_API_KEY`).

**Re-verified:** live hit against `GET /api/query/insights?force=true` on the
now-fixed `qa-backend` config served a stale cached row rather than
regenerating — confirmed by code read, not just this one observation:
`engine/queryinsights.available()` → `presets.can_run_model(...)` →
[`_has_provider_key`](../../../server/engine/presets.py:154), which checks
`s.openrouter_api_key` for any `deepseek/`-or-slash-containing model
(the HEAVY-tier default). With all 3 keys blank, `available()` is
structurally `False`, so `should_regen` in `queryinsights.insights()` can
never be `True` — no code path exists that would fire a real call, not
merely "didn't happen to fire this run."

## Verification summary

| Finding | Pre-fix | Post-fix | Method |
|---|---|---|---|
| 1 — timeout ceiling | 209.1s | 121.2s, 120.3s (2 runs) | Live hang-mode replay |
| 2 — mock coverage | Real 15.3s DeepSeek reply (mock bypassed) | Mock's canned text, 56.4ms | Live default-routing replay |
| 3 — cost leak | Real billed call fired mid-load-test | Structurally impossible (code-level gate) | Live replay + source read |

Not touched: the `sync_analyst_memos` mtime-cooldown pattern, N+1 fixes, and
bundle sizes — all confirmed clean in the original audit, no fix needed.

Playbook §7 updated to FIXED for all 3; the procedure text in §3/§4 updated
to reflect the corrected default setup so future audits don't reproduce
these gaps by following stale instructions.
