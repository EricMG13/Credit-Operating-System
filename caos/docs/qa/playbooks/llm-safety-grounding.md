# LLM Safety & Grounding Audit — Re-runnable Playbook

> **You are a Sonnet audit agent.** Run this playbook against the current
> working tree on every PR that touches an LLM lane and before every deploy.
> Discover scope fresh each run (§2) — never trust this file's inventory over
> the code. Deliverable: one dated report (§5). You audit and report; you do
> not fix. Repo root: the directory containing `caos/`.

## 1. Objective

CAOS produces committee-grade credit conclusions with LLM assistance. Two
stakes:

- **Grounding.** Every number and claim in a payload, query answer, or memo
  must trace to a source an analyst can click. A hallucinated metric that
  reaches a committee memo is a firing offense. The defense is layered:
  deterministic numeric grounding → citation/lineage validation → entailment
  demotion → CP-5 gate → provenance export gate. Prove no layer has been
  bypassed, weakened, or forgotten on a **new** lane.
- **Cost & control.** LLM spend is bounded per run (`run_token_budget`), every
  client has a timeout, model choice rides an allowlisted tier table, and no
  lane hands the model an executable tool. Prove a PR cannot silently add an
  unbudgeted, untimed, tool-bearing, or arbitrary-model call site.

The prior baseline is `caos/docs/qa/REVIEW_MATRIX_BACKEND.md` §BE-4
(audited 2026-07-03, 2 LOW). Your job each run is the **delta**: new call
sites, changed gates, drifted invariants.

## 2. Scope discovery — run these fresh every audit

From repo root. Compare against `origin/main` (local `main` may be stale).

```bash
# All live LLM call sites (anything not routed through the seam is a finding):
grep -rn "llm_client\.create\|messages\.create\|messages\.stream" \
  caos/server --include="*.py" -l | grep -v ".venv"

# All lanes by name (new lane strings vs origin/main = new audit surface):
grep -rn 'lane="' caos/server --include="*.py" | grep -v ".venv" | grep -v tests

# Server-side tool declarations handed to any model. Expected: EXACTLY the two
# in §6 (deepresearch web_search + synth advisor). Any third line = finding.
grep -rnE '"type": ?"(web_search|advisor|code_execution|computer_use|text_editor|bash)[^"]*"' \
  caos/server --include="*.py" | grep -v ".venv"

# Raw json.loads on model output (must be loads_finite/first_json_* on any
# path where a number can reach a financial field):
grep -rn "json\.loads\|json\.JSONDecoder" caos/server/engine caos/server/nlquery.py \
  caos/server/scenario.py caos/server/deepresearch.py caos/server/research_report.py

# Safety-gate usage inventory (who wraps, who gates, who budgets):
grep -rn "wrap_untrusted\|UNTRUSTED_RULE\|safe_chunk_id\|loads_finite\|first_json" \
  caos/server --include="*.py" | grep -v ".venv" | grep -v tests
grep -rn "llm_allowed()" caos/server --include="*.py" | grep -v ".venv"

# What this PR changed in the LLM surface:
git diff origin/main --stat -- caos/server/engine/llm_client.py \
  caos/server/engine/llm_safety.py caos/server/engine/council.py \
  caos/server/engine/debate.py caos/server/engine/synth.py \
  caos/server/engine/entailment.py caos/server/engine/grounding.py \
  caos/server/engine/provenance.py caos/server/engine/lineage.py \
  caos/server/engine/budget.py caos/server/engine/presets.py \
  caos/server/engine/gemini.py caos/server/engine/openrouter.py \
  caos/server/engine/rerank.py caos/server/engine/metricengine.py \
  caos/server/engine/metricfactlane.py caos/server/engine/queryinsights.py \
  caos/server/engine/queryanswer.py caos/server/llm.py caos/server/nlquery.py \
  caos/server/scenario.py caos/server/deepresearch.py \
  caos/server/research_report.py caos/server/config.py
```

Any file in the first three greps that is not in the checklist below is a new
lane: audit it against **every** invariant in §3 before anything else.

## 3. Invariants to prove (coverage checklist)

For each: confirm the enforcement point exists in code, the named tests still
cover it, and no new call site sidesteps it. Cite `file:symbol` (re-derive line
numbers; do not trust stale ones).

**I-1 — No ungrounded fact enters the fact store.** `MetricFact` projection in
`engine/runner.py` (`execute_run`) writes facts only from QA-passed module
output; a Blocked/`qa_status`-failed module must not project (write-skip), and
`peers` re-filters on read (defense-in-depth). Numeric facts derive from
`engine/metrics.extract_facts` on engine-computed values — never from free
model prose. Tests: `test_metricfactlane.py`, `test_fact_collapse.py`,
`test_runner_fault_isolation.py`.

**I-2 — Every generated numeral is grounded in cited evidence.**
`engine/grounding.all_grounded` is the single numeric gate (fail-closed,
±0.05 / 1-dp slack only); consumed by `queryinsights`, `queryanswer`,
`metricengine`. A model numeral that round-matches no cited figure is DROPPED.
`llm_safety.safe_chunk_id` prevents citation forgery: a fabricated chunk id
resolves to a real hit with `exact=False` — never presented as "Directly
Sourced". `engine/lineage.validate_lineage` (CP-5B) raises CRITICAL on any
claim with no evidence item, MATERIAL on Untraced/Weak/Conflicting lineage.
Tests: `test_grounding.py`, `test_llm_safety.py`, `test_query_insights.py`,
`test_query_answer.py`, `test_evidence_resolution.py`, `test_engine.py`
(lineage findings inside full-run payloads).

**I-3 — Entailment gate on generated claims.** `engine/entailment.py`: batched
LIGHT-tier check on kept claims; below threshold (or `entails=False`) the
caller **demotes** `observation` → `causal-hypothesis` (never drops — the
deterministic gates already passed). Any failure returns `{}` → no demotions,
no lost content. Confidence clamped to [0,1]. Test: `test_entailment.py`.

**I-4 — Prompt-injection and output-forgery resistance.** All document→LLM
extraction flows through `llm_safety.extract_json` (single scaffold:
`UNTRUSTED_RULE` + `wrap_untrusted` delimiting + `safe_chunk_id`). Entailment
wraps untrusted evidence text; issuer chat's system prompt carries the
untrusted-data clause. A new extractor that builds its own prompt without the
wrap is a finding (that is exactly what the shared scaffold exists to prevent).
Injection blast radius must stay "wrong-but-in-range figure": output
schema-clamped + CP-5-gated, never tool execution. Test: `test_llm_safety.py`.

**I-5 — Non-finite gating on model-returned values.** Every parse of model
output that can reach a financial field uses `llm_safety.loads_finite` /
`first_json_value` (both reject `NaN`/`Infinity`/`-Infinity` fail-closed via
`_reject_non_finite`, raising `ValueError` so existing handlers catch). Plain
`json.loads` on a numeric model path = finding. Known accepted exception:
`nlquery.py` metric-filter/`_llm_translate` plain parses (BE-5 LOW — soft
empty-result, no numeric field reaches a divide; re-verify that claim still
holds). Tests: `test_llm_safety.py`, `test_synth_live.py`.

**I-6 — Per-lane fault isolation.** A model timeout/5xx/parse failure never
aborts a run; each lane keeps one of the three patterns (new lanes MUST too):
- **council** (`engine/council.py`): both fan-outs
  `gather(..., return_exceptions=True)` AND exception results filtered before
  use (the gather-then-index bug must stay absent).
- **debate** (`engine/debate.py`): `LiveDebater.narrate` try/except →
  deterministic `_prose`; `synthesize_debate` gather with
  `return_exceptions=True` (BE4-1 fixed post-audit — confirm it stayed fixed).
- **synth** (`engine/synth.py`): per-module Blocked gate + one-shot repair;
  `runner._attempt_synth` catches anything that escapes → per-module Blocked,
  run survives.
- **nlquery / scenario / queryoverlay**: try/except → deterministic
  keyword/demo mapper (`nlquery._demo_translate` etc.).
- **entailment**: any failure → `{}` (see I-3). **chat / deepresearch /
  research_report**: degrade to demo reply/report.
Tests: `test_council.py`, `test_debate.py`, `test_synth_live.py`,
`test_nlquery.py`, `test_runner_fault_isolation.py`, `test_deepresearch.py`,
`test_research_report.py`, `test_llm_chat.py`.

**I-7 — Timeout on every client.** `caos_llm_timeout_s` (default 120s,
`config.py`) reaches every constructor: Anthropic (`llm.py:_get_client`,
`llm_client.anthropic_client`), Gemini (`engine/gemini.py`, ms-scaled),
OpenRouter (`engine/openrouter.py`). A client built without it = finding.
Tests: `test_synth_live.py` (asserts lanes build with it), `test_gemini.py`,
`test_openrouter.py`, `test_llm_client.py`.

**I-8 — No executable tools, no model-directed writes.** The only server-side
tools in the entire codebase are the two in §6. Everything else passed as
`tools=` is a forced-JSON-schema for structured output. No
`code_execution`/`bash`/`computer_use`/`text_editor`/user-defined executable
tool anywhere (§2 grep). Model output never triggers a write except through
the schema-clamped payload path behind the CP-5 gate. Telemetry writes
authored by harness code (`budget.trace_llm` → `LLMCallRecord` row, log lines)
are NOT model-directed and are fine — do not flag them; DO flag any write
whose content or occurrence the model controls. `deepresearch` web results are
untrusted data; non-`http(s)` URLs dropped; `engine/provenance.export_allowed`
blocks web-grounded artifacts from committee export unless `web_ratified`.
Tests: `test_provenance.py`, `test_deepresearch.py`.

**I-9 — Keyless degrade + model-tier routing correctness.**
`engine/presets.py`: unknown mode normalizes to BALANCED; `model_for` falls
back via `_has_provider_key`/`_configured_fallback` so a slash-id never
reaches a keyless provider call; `resolved_query_model` allowlists
`X-Query-Model` against the configured tier universe (BE6-1 — arbitrary model
pinning must stay impossible); `reviewer_model` cross-provider degrade;
`rerank_model` coerces invalid tier to `cheap`. Keyless end-state: chat →
`_DEMO_REPLY`, deepresearch/research_report → `_demo_report()`,
entailment/queryoverlay → unavailable no-ops. Tests: `test_presets.py`,
`test_llm_chat.py`, `test_rerank.py`.

**I-10 — Budget cannot be bypassed.** `engine/budget.py`: `llm_allowed()`
consulted before each spend (council seats + peer round, debate narration,
synth, extractors); exhausted budget degrades to the deterministic path, never
errors. `record_usage` counts cached input tokens AND advisor sub-inference
iterations (a bypass here undercounts real spend). Every live call site either
routes through `llm_client.create` (which traces + bills via
`budget.trace_llm`) or calls `trace_llm` itself (streaming deepresearch,
advisor) — a call site doing neither is a finding. Fan-out stays bounded:
council seats sliced to `council_seats` (config, default 4, roster-capped) ×
≤2 rounds, debate exactly 2 advocates, deepresearch
`_MAX_CONTINUATIONS` × mode-capped searches. Overload fallback is single-shot
to a cheaper same-provider model only. Tests: `test_budget.py`,
`test_llm_client.py`, `test_council.py`.

## 4. Procedure

Offline by construction: `caos/tests/server/conftest.py` blanks
`ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` for the suite.
For any script you run outside pytest, clear them yourself
(`env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u OPENROUTER_API_KEY …`) — the
user's shell may have live keys, and this audit must never spend tokens.

Interpreter: `caos/server/.venv311/bin/python` (prod parity; the py3.9
`.venv` also works but may lag on newly added deps — never downgrade the
fastapi pin). From repo root:

```bash
PY="caos/server/.venv311/bin/python"

# 1. Full LLM-lane test sweep (targets from §3; all must pass):
$PY -m pytest -q \
  caos/tests/server/test_llm_safety.py caos/tests/server/test_grounding.py \
  caos/tests/server/test_entailment.py caos/tests/server/test_provenance.py \
  caos/tests/server/test_budget.py caos/tests/server/test_presets.py \
  caos/tests/server/test_llm_client.py caos/tests/server/test_llm_chat.py \
  caos/tests/server/test_council.py caos/tests/server/test_debate.py \
  caos/tests/server/test_synth_live.py caos/tests/server/test_deepresearch.py \
  caos/tests/server/test_research_report.py caos/tests/server/test_nlquery.py \
  caos/tests/server/test_gemini.py caos/tests/server/test_openrouter.py \
  caos/tests/server/test_rerank.py caos/tests/server/test_query_insights.py \
  caos/tests/server/test_query_answer.py caos/tests/server/test_metricfactlane.py \
  caos/tests/server/test_fact_collapse.py caos/tests/server/test_runner_fault_isolation.py \
  caos/tests/server/test_evidence_resolution.py caos/tests/server/test_engine.py

# 2. Pure-gate self-check (asserts fail-closed grounding examples):
$PY caos/server/engine/grounding.py

# 3. Full suite when the diff is broad (CI parity):
$PY -m pytest caos/tests/server -q
```

Then the manual pass, scoped by §2's diff:

1. For each **changed** file in the LLM surface, re-verify the §3 invariants
   it enforces by reading the code (not the docstrings).
2. For each **new** lane/call site, walk all ten invariants; a new lane
   missing any one is at minimum HIGH.
3. For each invariant whose test target failed, collected zero tests, or no
   longer exists: treat coverage itself as a finding.
4. Spot-check config drift: `git diff origin/main -- caos/server/config.py`
   for changed defaults on `advisor_enabled`, `run_token_budget`,
   `caos_llm_timeout_s`, `model_tier_*`.

## 5. Evidence & reporting

Write `caos/docs/qa/reports/llm-safety-grounding-YYYY-MM-DD.md` (create the
dir if absent) containing:

- **Verdict line first**: `PASS` / `FAIL` + one sentence.
- Scope table: files audited, new lanes found, diff base commit.
- Per-invariant row (I-1…I-10): HELD / DRIFTED / VIOLATED, enforcement point
  cited as `file:symbol`, test evidence (exact pytest node + result).
- Findings: severity (CRITICAL/HIGH/MED/LOW), file:symbol, concrete failure
  scenario, minimal fix sketch.

**Pass/fail gates.** FAIL (blocks merge/deploy): any VIOLATED invariant; any
CRITICAL/HIGH finding; any new lane missing budget, timeout, fault isolation,
or untrusted-wrap; any executable tool outside §6; the §4 sweep not green.
MED requires written adjudication in the report. LOW records, doesn't block.

**Adversarial verification is mandatory before reporting** a suspected
ungrounded or injectable path — plausible-sounding findings are routinely
inflated. For each candidate: construct the concrete attack (the malicious
chunk text, the fabricated chunk id, the NaN-bearing reply, the
budget-exceeding fan-out), trace it through the actual code path, and name the
first gate that stops it. Only report if no gate does — and quote the code
that fails. Downgrade anything a backstop catches (per-module Blocked, demote,
demo fallback) to the severity of the *residual* effect, and say which
backstop. Follow the same right-sizing discipline BE-4 used.

## 6. Accepted-risk register

Do not re-flag these; re-verify their guard conditions each run. If a guard
condition no longer holds, the acceptance is void — report at the stated
escalation severity. Add new entries only with user sign-off, recorded here.

| ID | Accepted risk | Guard conditions (re-verify) | Escalate if broken |
|---|---|---|---|
| AR-1 | `advisor_20260301` tool on the synth lane (`engine/synth.py`) — a model-consult (executor asks a stronger model mid-generation). Benign: no exec/FS/DB/network write; billed into the run budget via `usage.iterations`. | `advisor_enabled` defaults to **False** in `config.py`; tool type unchanged; advisor spend still accrued by `budget.record_usage`. | HIGH |
| AR-2 | `web_search_20260209` tool on the deep-research lane (`deepresearch.py`) — Anthropic's server-side read-only web search. Benign: read-only; results treated as untrusted data; run-less interactive lane. | `max_uses` still preset-capped and loop bounded by `_MAX_CONTINUATIONS`; non-`http(s)` URLs still dropped; web content still cannot reach committee export un-ratified (`provenance.export_allowed`). | HIGH |

Baseline LOWs carried from BE-4 (context, not blockers): BE4-2 deepresearch
double-overload propagates to `research_executor._mark_failed` (clean failed
job, not a crash); `nlquery.py` plain parses (see I-5). Re-verify their
backstops still exist when touching those files.
