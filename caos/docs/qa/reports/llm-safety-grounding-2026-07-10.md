# LLM Safety & Grounding Audit — 2026-07-10

**PASS.** All ten invariants HELD; one MED coverage-gap finding (I-9) is
adjudicated below, not a live exploit. Zero CRITICAL/HIGH. Test sweep green.

## Scope

- **Diff base:** `origin/main` @ `6603568e`.
- **Files audited:** full LLM/fact surface named in the playbook §2/§3 — 23
  files — plus, on independent agent discovery beyond the fixed checklist:
  `engine/metrics.py`, `engine/peers.py` (both carry the I-1 predicate-dedup
  change but aren't named in the playbook's §2 file list — see Meta-finding
  below), `main.py` (`set_model_mode` dependency wiring), `research_executor.py`,
  `executor_base.py` (new shared task-lifecycle base, orthogonal to LLM safety).
- **New lanes found:** none. Lane-string grep and tool-declaration grep both
  match the playbook's known inventory exactly (13 lanes, 2 tool declarations:
  `advisor_20260301`, `web_search_20260209`).
- **Delta vs origin/main (8 files, all in-scope):** `engine/debate.py`,
  `deepresearch.py`, `engine/synth.py`, `engine/metricengine.py`,
  `engine/metricfactlane.py`, `engine/queryinsights.py`, `engine/metrics.py`,
  `engine/peers.py`. Everything else in the LLM surface — `config.py`,
  `llm.py`, `llm_client.py`, `llm_safety.py`, `grounding.py`, `entailment.py`,
  `provenance.py`, `lineage.py`, `budget.py`, `presets.py`, `gemini.py`,
  `openrouter.py`, `council.py`, `queryanswer.py`, `queryoverlay.py`,
  `rerank.py`, `covenants.py`, `adjusted.py`, `nlquery.py`, `scenario.py`,
  `research_report.py` — is byte-identical to `origin/main`.
- **The delta is exactly the two BE-4 (2026-07-03) LOW fixes landing**
  (BE4-1 debate fault isolation, BE4-2 deepresearch double-overload
  degradation) **plus a fact-store guard dedup that closes a real, previously
  undetected I-1/I-2 gap** in `queryinsights._delta_entries` (see I-1/I-2 below).

## Test sweep

`caos/server/.venv311/bin/python -m pytest` — offline, `ANTHROPIC_API_KEY` /
`GEMINI_API_KEY` / `OPENROUTER_API_KEY` unset (via `conftest.py`):

```
342 passed, 1 warning in 7.55s
```

All 23 playbook-named test targets green (`test_llm_safety` 7,
`test_grounding` 6, `test_entailment` 11, `test_provenance` 11, `test_budget`
7, `test_presets` 12, `test_llm_client` 5, `test_llm_chat` 4, `test_council`
18, `test_debate` 8, `test_synth_live` 30, `test_deepresearch` 11,
`test_research_report` 56, `test_nlquery` 29, `test_gemini` 15,
`test_openrouter` 8, `test_rerank` 13, `test_query_insights` 8,
`test_query_answer` 9, `test_metricfactlane` 28, `test_fact_collapse` 11,
`test_runner_fault_isolation` 1, `test_evidence_resolution` 3, `test_engine`
31). `engine/grounding.py` pure-gate self-check: `grounding demo OK`.

## Per-invariant results

| ID | Verdict | Enforcement (current disk state) | Findings |
|---|---|---|---|
| I-1 Fact-store grounding | **HELD** | `engine/metrics.headline_fact_predicates` (new shared helper: `headline.is_(True)`, `metric_key.in_(keys)`, `qa_status != "Blocked"`), spread into all 4 readers — `peers._peer_facts`, `metricengine._headline_facts_by_issuer`/`_peer_values` (×2), `metricfactlane._raw_facts`, `queryinsights._delta_entries`. Write-side gate `runner.execute_run` (byte-identical) unchanged. | 0 |
| I-2 Numeric grounding + lineage | **HELD** | `engine/grounding.all_grounded` (unchanged, fail-closed), `queryinsights._validate`/`queryanswer._validate` (unchanged numeral-emission boundary), `llm_safety.safe_chunk_id`, `lineage.validate_lineage` (both unchanged, all callers unchanged). | 0 |
| I-3 Entailment demotion | **HELD** | `engine/entailment.check_entailment`/`should_demote` (byte-identical); sole caller `queryanswer._apply_entailment_demotions` also unchanged, double fault-isolated. | 0 |
| I-4 Injection/forgery resistance | **HELD** | `llm_safety.UNTRUSTED_RULE`/`wrap_untrusted`/`safe_chunk_id`/`extract_json`; all 9 named prompt-constructing modules (`covenants`, `adjusted`, `synth`, `queryanswer`, `queryinsights`, `queryoverlay`, `debate`, `rerank`, `entailment`) confirmed wrapping untrusted content; `council.py` (unchanged) carries an equivalent inline clause instead of the shared import — noted, not a gap. | 0 |
| I-5 Non-finite gating | **HELD** | `llm_safety.loads_finite`/`first_json_value` gate synth's live JSON-parse path; `scenario.py`/`nlquery.py` accepted exceptions re-verified against current code (both still compensated — `math.isfinite` guard / no numeric field reaches a divide). `synth._parse_payload` (dead legacy path) deletion confirmed zero remaining callers. | 0 — see coverage note below |
| I-6 Fault isolation | **HELD** | BE4-1 fix present and correct in `debate.synthesize_debate` (`return_exceptions=True` + per-side `isinstance(Exception)` → `_prose` fallback, traced against a bull-only-raise scenario). BE4-2 fix present and correct in `deepresearch.run_deep_research` (second-overload guard degrades to demo or truncated report; the one legitimately-uncaught case re-raises to `research_executor._run_research`'s unchanged last-resort handler → clean failed job). Both ship new, targeted tests. | 0 |
| I-7 Timeouts | **HELD** | `caos_llm_timeout_s` reaches every constructor (`llm._get_client`, `llm_client.anthropic_client`, `gemini.get_client`, `openrouter.call`), all 5 files byte-identical to origin/main. Two additional constructor sites found beyond the playbook's named 5 (`nlquery.py` ×2, `scenario.py` ×1) — both also pass the timeout correctly. | 0 |
| I-8 No tools/no writes | **HELD** | Exactly 2 server-tool declarations repo-wide (`advisor_20260301`, `web_search_20260209`) — confirmed via full-repo grep excluding vendored SDK. `deepresearch.py`'s diff is scoped strictly to the retry branch; tool declaration and URL-scheme guard untouched. `synth._parse_payload` deletion is dead-code removal, no live caller. | 0 |
| I-9 Keyless degrade + routing | **HELD** (1 finding) | `presets.normalize`/`model_for`/`_has_provider_key`/`_configured_fallback`/`resolved_query_model`/`_allowed_query_models`/`reviewer_model`/`rerank_model` all byte-identical to origin/main and behave as documented. | **1 MED** (below) |
| I-10 Budget unbypassable | **HELD** | `budget.llm_allowed`/`record_usage`/`trace_llm` unchanged; every live call site (`council`, `debate`, `synth`, `covenants`, `adjusted`, `entailment`, `rerank`, `queryanswer`, `queryinsights`, `queryoverlay`, `nlquery`, `scenario`, `research_report`, `llm`, `deepresearch`) routes through `llm_client.create` or calls `trace_llm` directly. New deepresearch double-overload exit paths correctly skip billing an iteration that produced no response, without double- or under-counting prior traced turns. Fan-out bounds unchanged (council seats × ≤2 rounds, debate exactly 2, `_MAX_CONTINUATIONS`=4). | 0 |

## Findings

### F-1 — MED — `caos/server/engine/presets.py:resolved_query_model` / `_allowed_query_models`

**Description:** The BE6-1 allowlist that blocks arbitrary `X-Query-Model`
pinning has zero direct test coverage anywhere in the repo. Grepped
`caos/tests/server` for `x-query-model`, `X-Query-Model`, `query_model`,
`resolved_query_model`, `_allowed_query_models` — no hits in any file,
including `test_presets.py`, `test_llm_chat.py`, `test_rerank.py`.
`test_rerank.py` stubs `rerank_model()` out entirely (`monkeypatch.setattr`)
rather than exercising the real invalid-tier-coercion branch.

**Failure scenario:** A future edit to `resolved_query_model()` (e.g. "let
power users pin a specific model") removes or weakens the
`if model not in _allowed_query_models(s): return model_for(LIGHT)` check. An
analyst sends `X-Query-Model: <any-id-the-deploy-key-can-reach>` on a
Query-lane request; `nlquery.py:251,318` passes that id straight to the live
client, bypassing the mode-tier cost/security gate. No test in any suite file
fails, so CI stays green on a real regression of a named security control.

**Adversarial verification (mandatory per §5):** A second agent tried to
refute this by (a) confirming the gate itself is currently correct — verified,
no live exploit today (residual severity against present code: NONE); (b)
searching for a downstream backstop that would independently catch a
regression — read `llm_client.create`/`_create_gemini`/`_create_openrouter` in
full: all three route purely on model-id string shape with no re-validation,
so a regression here has an unobstructed path to a live provider call; (c)
confirming the header reaches this code unconditionally —
`main.py:132-141`'s `set_model_mode` is a global FastAPI dependency on every
`/api` request, no allowlisting at the header/route layer. **Verdict: NOT
refuted.** The finding is specifically about absent regression protection for
a real, currently-correct, security-relevant gate — verified true.

**Fix sketch:** Add to `test_presets.py`: (a) an allowed model with a live key
passes through unchanged; (b) a model outside `_allowed_query_models()` falls
back to `model_for(LIGHT)`; (c) an allowed model with a missing provider key
also falls back. Add a direct `rerank_model()` test for an invalid
`RERANK_MODEL_TIER` coercing to `cheap`, rather than only exercising it via a
monkeypatched stand-in.

**Adjudication (playbook §5 — MED requires written adjudication):** Accepted
as open, non-blocking. No live exploit exists against current code; this is a
regression-protection gap, not a present vulnerability. Recommend closing
before the next lane touches `presets.py` routing logic, but it does not gate
this PR/deploy.

### Coverage note (not a finding) — I-5 residual gaps

Two test gaps were surfaced but judged non-blocking on inspection of the
actual code, not escalated to findings:
- `openrouter.py:109`'s `json.loads(func.get("arguments", "{}"))` (tool-call
  arguments, not free model prose) has no direct NaN/Infinity-literal test.
  `engine/synth.py:539-545` carries an explicit comment establishing the
  compensating design: any downstream consumer of this data round-trips
  through `loads_finite` before reaching a financial field. No test proves the
  round-trip end-to-end.
- `test_synth_live.py` has no test constructing a tool-call `input` dict with
  a NaN/Infinity value to directly exercise `_payload_data_from_resp`'s
  `loads_finite(json.dumps(data))` round-trip.
Neither reaches a financial field ungated today; both are test-coverage
hardening opportunities, not defects.

## Meta-finding — playbook §2 scope-discovery gap (not a code finding)

`engine/metrics.py` and `engine/peers.py` — both part of this run's actual
delta and directly relevant to I-1 — are **not** in the playbook's §2 file
checklist (the checklist lists the four *readers* affected but not the shared
predicate module or `peers.py` itself), and neither calls
`llm_client.create`/`messages.create` directly, so they don't surface via the
§2 call-site grep either. This run only caught them because the orchestrator
manually diffed the full `caos/server/engine/` tree rather than only the
checklist. **Recommend**: the playbook's next revision should add a
repo-wide `git diff origin/main --stat -- caos/server` scan (not scoped to a
fixed file list) as a first-pass net, with the fixed checklist retained for
the deep per-invariant reads. Filed as observation only — does not affect
this run's PASS verdict since the actual files were in fact audited.

## Accepted-risk register — reaffirmed

| ID | Guard condition | Status this run |
|---|---|---|
| AR-1 `advisor_20260301` | `advisor_enabled` defaults False in `config.py` (unchanged); advisor spend still accrued via `usage.iterations` in `budget.record_usage` (unchanged). | **Holds.** |
| AR-2 `web_search_20260209` | `max_uses` preset-capped, loop bounded by `_MAX_CONTINUATIONS`=4 (unchanged); non-`http(s)` URLs still dropped; `provenance.export_allowed` still blocks un-ratified web artifacts from export (unchanged). | **Holds.** |

BE4-1 and BE4-2 baseline LOWs are no longer open — both fixed and verified in
this run (I-6). `nlquery.py` plain-parse LOW (I-5) re-verified, still holds
under current code.

## Gate outcome

Per playbook §5: no VIOLATED invariant, no CRITICAL/HIGH finding, no new lane
missing budget/timeout/fault-isolation/untrusted-wrap, no executable tool
outside §6, sweep green → **PASS**. F-1 (MED) recorded and adjudicated as
open/non-blocking per the above.
