# CAOS LLM Safety & Grounding Audit — Sonnet 5 Goal Prompt

## 1. Objective

You are Sonnet 5 auditing CAOS's AI/LLM lanes. Run this goal against the
current tree on every LLM-affecting PR and before deploy. Audit and report;
do not fix code.

Prove that no LLM-assisted claim or number can become a fact, answer, research
artifact, or committee output unless an analyst can click through to its
source or to a deterministic derivation from sourced inputs. A hallucinated
metric in an IC memo is a release blocker. Also prove that a model cannot
execute tools, direct writes, escape its tier, hang a request, or spend past an
applicable cap.

Treat `caos/docs/qa/REVIEW_MATRIX_BACKEND.md` §BE-4 as historical context, not
current evidence. Discover scope and re-prove every invariant below from code
and tests on each run.

## 2. Scope discovery

Run from the repository root. Compare with `origin/main`; local `main` may be
stale.

```bash
BASE=$(git merge-base HEAD origin/main)

# LLM/provider calls. Any direct call outside the shared seam is audit-critical.
rg -n -g '*.py' \
  'llm_client\.create\(|messages\.(create|stream)\(|beta\.messages\.create\(|generate_content\(|gemini\.call\(|openrouter\.call\(' \
  caos/server

# Model clients, timeouts, lane names, routing, and spend controls.
rg -n -g '*.py' \
  'AsyncAnthropic|AsyncClient\(|HttpOptions|timeout|lane=|model_for\(|reviewer_model\(|resolved_query_model\(|llm_allowed\(|trace_llm\(|record_usage\(' \
  caos/server

# Prompts and structured-output contracts. Read every hit that handles untrusted
# document, web, user, payload, or upstream text.
rg -n -g '*.py' \
  'SYSTEM_PROMPT|_SYSTEM\b|system\s*=|prompt\s*=|UNTRUSTED_RULE|wrap_untrusted|load_prompt_bundle|ACTIVE_PROMPT|_PAYLOAD_TOOL|_REPORT_TOOL|tool_choice' \
  caos/server
rg --files 'Modular OS' | rg 'ACTIVE_PROMPT|manifest|preamble|reference'

# Safety, grounding, entailment, provenance, lineage, and fact-store gates.
rg -n -g '*.py' \
  'safe_chunk_id|loads_finite|first_json|is_finite_number|all_grounded|check_entailment|source_gate|runtime_evidence_ids|validate_lineage|qa_status_from|export_allowed|MetricFact\(' \
  caos/server

# Server tools exposed to a model. Expected server-tool types are exactly the
# two accepted entries in §6; JSON-schema output tools are not executable tools.
rg -n -g '*.py' \
  '"type"\s*:\s*"(advisor_|web_search_|code_execution|computer_use|text_editor|bash)' \
  caos/server

# Candidate write/exec sinks in model lanes. Separate application-controlled
# validation/persistence and telemetry from writes whose occurrence or target
# the model can choose.
rg -n -g '*.py' \
  'session\.(add|execute|commit)|write_text|write_bytes|subprocess|os\.system|eval\(|exec\(' \
  caos/server/engine caos/server/deepresearch*.py caos/server/research_report.py \
  caos/server/llm.py caos/server/nlquery.py

# PR delta across the known surface. Add every newly discovered file.
git diff "$BASE"..HEAD -- \
  caos/server/engine/llm_client.py caos/server/engine/llm_safety.py \
  caos/server/engine/council.py caos/server/engine/debate.py \
  caos/server/engine/synth.py caos/server/engine/grounding.py \
  caos/server/engine/entailment.py caos/server/engine/provenance.py \
  caos/server/engine/lineage.py caos/server/engine/budget.py \
  caos/server/engine/presets.py caos/server/engine/gemini.py \
  caos/server/engine/openrouter.py caos/server/engine/queryanswer.py \
  caos/server/engine/queryinsights.py caos/server/engine/metricfactlane.py \
  caos/server/engine/metrics.py caos/server/engine/runner.py \
  caos/server/deepresearch*.py caos/server/research_report.py \
  caos/server/llm.py caos/server/nlquery.py caos/server/config.py
```

Inventory each call as: lane, prompt source, untrusted inputs, provider/model
tier, timeout, token/tool cap, budget check, parser/schema, grounding gate,
failure fallback, and persistence/export sink. A new lane must satisfy every
applicable invariant below.

## 3. Invariants and coverage checklist

For each invariant, cite current `file:symbol` enforcement and exact test
evidence. Docstrings are clues, not proof.

**I-1 — No ungrounded number enters the fact store.** Trace every numeric field
from model response through parse, range/finite checks, claim/evidence binding,
`runner.execute_run`, `metrics.extract_facts`/`extract_cost_facts`, and every
`MetricFact` reader. Each stored raw value needs a real claim → evidence →
document-chunk path; each derived value needs a deterministic formula and
sourced operands. Null citation IDs, fabricated chunk IDs, Blocked facts, or
free-prose numbers entering peer/query/reporter inputs fail this invariant.
Read-side QA/provenance filtering must remain defense-in-depth, not the only
guard.

**I-2 — Module synthesis fails closed on sources.** For `synth.LiveSynthesizer`
and every specialized module, prove: retrieved text is untrusted; source gates
run before synthesis where required; output is schema-constrained; every
model-returned `evidence_id` belongs to the retrieved allowlist; every numeric
field is source-grounded or deterministically derived; non-grounded fields are
dropped, null, or gate the module; `_resolve_evidence`, `validate_lineage`, and
the deterministic CP-5 gate run before fact projection or committee use. Do not
mistake the CP-1 revenue/EBITDA headline check for universal numeric coverage:
enumerate all model-returned numeric fields and prove each path.

**I-3 — Generated factual prose is grounded and entailment-labeled.** In Query,
Analyst/Reporter, and any new synthesis surface, every kept sentence must cite a
real chunk/fact ID and every numeral must pass `all_grounded` against only that
cited evidence. `queryanswer._apply_entailment_demotions` and
`entailment.check_entailment` must demote unsupported observations to explicit
hypotheses; an entailment outage must not discard deterministically grounded
content. For module synth output, prove an equivalent semantic gate before a
claim is presented as fact; optional council review is additive and cannot
replace deterministic grounding/lineage.

**I-4 — Prompt injection and output forgery cannot cross a trust boundary.** All
document, web, user, retrieved, and model-derived upstream text is data, never
instructions. Verify `UNTRUSTED_RULE`/`wrap_untrusted` or an equivalent guard,
closed output schemas, `safe_chunk_id`/runtime evidence allowlists, severity
clamping, URL-scheme filtering, and no model-selected export status. Test direct
and indirect injection, delimiter escape, fake system/tool messages, forged
chunk/fact IDs, forged JSON fields, and malicious web content. No model may
declare itself committee-ready.

**I-5 — Non-finite model values fail closed.** Every numeric response path,
including forced-tool arguments and text JSON fallback, rejects `NaN`,
`Infinity`, `-Infinity`, and overflow such as `1e999` with `loads_finite` or an
equivalent recursive check. Re-check `is_finite_number` at projection and before
every multiply/divide; zero denominators degrade to `None`/Blocked. Plain
`json.loads`, `float()`, or Pydantic acceptance on a model-to-money path is a
finding unless a later mandatory boundary demonstrably rejects the value.

**I-6 — Each lane is fault-isolated.** Verify council fan-outs use
`return_exceptions=True` and filter exception objects; debate keeps deterministic
`_prose`; synth/runner converts failures to the module's Blocked state; entailment
returns no demotions; nlquery/query overlays use deterministic fallbacks;
deep-research and report jobs degrade or fail cleanly without stranding work.
One lane's timeout, overload, malformed reply, or empty output must not abort
siblings or erase last-known-good facts.

**I-7 — Every provider call has a bounded timeout.** Prove
`caos_llm_timeout_s` reaches Anthropic request and streaming clients, Gemini
`HttpOptions` in milliseconds, and OpenRouter `httpx.AsyncClient`. Retries and
fallbacks must have a bounded total wall time; SDK defaults or stacked hidden
retries do not count as a deliberate bound.

**I-8 — Models receive no state-changing tools and direct no writes.** The only
accepted server-tools are §6. Forced JSON-schema output tools are allowed only
when they cannot execute code, access files/DB/network, or choose a write target.
Application code may persist a validated payload/research result and may write
telemetry (`LLMCallRecord`); the model may not choose whether, where, or how a
state-changing write occurs. Any shell, code execution, browser/computer,
editor, arbitrary HTTP, or user-defined executable tool is a deploy blocker.

**I-9 — Keyless degradation and tier routing are deterministic.** Prove the
mode → tier → model → provider chain uses the single provider classifier;
unknown modes/tier pins cannot select arbitrary models; provider-key absence
degrades to a configured available provider or a deterministic fixture/demo;
reviewer cross-provider routing never sends a model ID to the wrong SDK. Cover
TEST/LITE/BALANCED/MAX, LIGHT/EXTRACT/HEAVY, explicit allowlisted query pins,
fallbacks, and all-keys-unset behavior.

**I-10 — Cost caps cannot be bypassed.** Every run-scoped call, repair, retry,
advisor iteration, council/debate fan-out, and fallback must reserve/check budget
before spend and record all processed tokens, including cache and nested advisor
usage. Concurrent lanes must not all pass a stale remaining-budget check and
overshoot a hard cap. Rehydrated/retried runs retain prior spend. Run-less lanes
must have explicit hard bounds: output tokens, continuations, searches/tool
uses, retries, and concurrency. Every live call routes through
`llm_client.create` or explicitly calls `budget.trace_llm`; neither tracing nor
provider fallback may bypass the enforcement cap.

## 4. Procedure

Use the designated server environment. The suite is offline only when
`CAOS_TEST_LIVE` is unset; `conftest.py` then blanks all provider keys. Make that
explicit so the audit cannot spend real tokens.

```bash
PY=caos/server/.venv311/bin/python
offline() {
  env -u CAOS_TEST_LIVE -u ANTHROPIC_API_KEY -u GEMINI_API_KEY \
    -u OPENROUTER_API_KEY "$@"
}

# Core LLM safety, routing, grounding, fault, timeout, and cost targets.
offline "$PY" -m pytest -q \
  caos/tests/server/test_llm_safety.py \
  caos/tests/server/test_llm_client.py \
  caos/tests/server/test_model_tier_routing.py \
  caos/tests/server/test_presets.py \
  caos/tests/server/test_gemini.py \
  caos/tests/server/test_openrouter.py \
  caos/tests/server/test_council.py \
  caos/tests/server/test_debate.py \
  caos/tests/server/test_synth_live.py \
  caos/tests/server/test_specialized_modules.py \
  caos/tests/server/test_grounding.py \
  caos/tests/server/test_cp1_grounding.py \
  caos/tests/server/test_entailment.py \
  caos/tests/server/test_provenance.py \
  caos/tests/server/test_budget.py \
  caos/tests/server/test_deepresearch.py \
  caos/tests/server/test_research_report.py \
  caos/tests/server/test_llm_chat.py

# Fact-store, CP-5, and end-to-end lineage targets.
offline "$PY" -m pytest -q \
  caos/tests/server/test_metricfactlane.py \
  caos/tests/server/test_cp5_gate_honesty.py \
  caos/tests/server/test_evidence_resolution.py \
  caos/tests/server/test_runner_fault_isolation.py \
  caos/tests/server/test_phase1b_lineage.py \
  caos/tests/server/test_lineage_v2.py \
  caos/tests/server/golden/test_golden_e2e.py

# Broad LLM-surface PR or pre-deploy only.
offline "$PY" -m pytest caos/tests/server -q
```

After tests, manually trace every changed/new lane from input to sink using the
inventory in §2. A missing test, zero collected tests, or a renamed target is a
coverage failure, not a skip. Do not run live-provider tests or adversarial
prompts against real keys without separate written authorization.

## 5. Evidence and reporting

Write `caos/docs/qa/reports/llm-safety-grounding-YYYY-MM-DD.md` with:

- Verdict first: `PASS` or `FAIL`, one sentence.
- Commit, merge base, keys-unset proof, files/call sites/prompts inventoried,
  and newly discovered lanes.
- I-1 through I-10 as `HELD`, `DRIFTED`, or `VIOLATED`, with current
  `file:symbol`, exact pytest target/result, and residual risk.
- Findings ordered CRITICAL/HIGH/MED/LOW: attack/failure path, first missing or
  failed gate, reachable sink, evidence, and smallest remediation.
- The §6 register with every guard condition re-verified.

`FAIL` blocks merge/deploy for any violated invariant; any CRITICAL/HIGH; any
ungrounded value reaching `MetricFact`, answer, report, or committee output; any
new untimed/unbudgeted/unwrapped lane; any executable tool outside §6; any
model-directed write; or a non-green required target. MED requires written risk
acceptance. LOW records non-blocking hardening only.

Adversarially verify every suspected ungrounded or injectable path before
reporting it. Use the smallest offline fake: malicious source text, forged
chunk/fact ID, forged tool output, `NaN`/`1e999`, timeout/double-overload, or
concurrent budget exhaustion. Trace it to the first gate that stops it. If a
backstop prevents the claimed sink, report only the residual effect and
right-size severity; if no gate stops it, preserve the reproducer and mark the
invariant violated.

## 6. Accepted-risk register

Do not re-flag these while every guard holds. Acceptance is void if a guard
drifts; then report at least HIGH. These entries do not exempt outputs from
grounding, timeout, cost, or persistence gates.

| ID | Accepted server-tool | Guard conditions to re-prove each run |
|---|---|---|
| AR-1 | `advisor_20260301` in `engine/synth.py`: executor-to-advisor model consultation. | `advisor_enabled` defaults false; no code/FS/DB/arbitrary-network capability; payload output remains schema-forced; advisor tokens in `usage.iterations` count against the same run cap. |
| AR-2 | `web_search_20260209` in `deepresearch.py`: Anthropic read-only server-side web search. | Search `max_uses`, continuations, output tokens, retries, and timeout remain bounded; retrieved content stays untrusted; only `http(s)` source URLs survive; no model-directed write or unratified committee export path exists. |
