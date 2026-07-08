---
name: fable-5-prompter
description: Rewrite a user's raw prompt to follow Anthropic's official Claude Fable 5 prompting guidance — objectives over task-lists, right-sized effort, stated intent and boundaries, grounded progress claims, and no reasoning-extraction triggers. Prompts the user for missing detail when the request is too thin to rewrite well. Use when the user says "fable 5 prompter", "optimize this prompt for Fable 5", "make this a good Fable 5 prompt", "rewrite for Fable 5", or hands you a prompt to tune for claude-fable-5 / claude-mythos-5.
user-invokable: true
---

# fable-5-prompter

Turn a user's initial prompt into one that follows Anthropic's **Prompting Claude
Fable 5** guidance. Fable 5 (and Mythos 5) behaves differently from Opus 4.8:
stronger instruction following, much longer autonomous turns, effort as the
primary control, and new failure modes (fabricated progress, over-engineering,
`reasoning_extraction` refusals). A prompt written for older models often *under*performs
here — it over-constrains a model that no longer needs the rails.

The deliverable is a **rewritten prompt** the user can copy out, plus a one-line
**recommended effort** and a short note on **what was removed and why**.

## The core shift

Older-model prompting = enumerate every behavior, list every rule, ask the model
to show its work. Fable 5 prompting = **give objectives, not task lists**; steer
with one brief instruction instead of a rulebook; state the *intent* and the
*boundaries*; let the model reason internally. Prescriptive skill files and
rule-stacks written to keep weaker models on rails read as constraints that
*degrade* Fable 5's output. When rewriting, your instinct should be to **cut**,
not to add.

## Workflow

Work through these in order. Read `references/fable5-guidance.md` for the full
guidance and the verbatim instruction snippets you'll graft in.

### 1. Classify the prompt

Determine two axes — they decide which blocks the rewrite needs:

- **Task type:** one-shot task · coding/debugging · analysis/research · content
  generation · long-running or autonomous agent · multi-agent/orchestration.
- **Delivery mode:** synchronous (user is watching) vs. autonomous/async (user is
  away, agent runs for minutes–hours).

### 2. Check sufficiency — ask before you rewrite

A good Fable 5 prompt needs enough to give the model **objectives + intent +
boundaries**. If the raw prompt is missing the pieces below, use
`AskUserQuestion` to gather them *before* rewriting — do not invent them. Ask
only for what's actually missing (skip anything the prompt already makes clear):

- **Intent / why** — what larger goal this serves and who the output is for.
  Fable 5 performs better when it understands intent (see "Give the reason").
- **Deliverable & done-criteria** — what "finished" looks like; how the user will
  judge success.
- **Boundaries** — is this a *do it* or an *assess it and report* task? Anything
  off-limits, irreversible, or out of scope?
- **Effort / scope** — how hard/thorough vs. quick-and-interactive.
- **Mode** — will this run autonomously (user away) or interactively?

Keep it to one `AskUserQuestion` round with 2–4 focused questions. If the prompt
is already rich enough, skip straight to the rewrite and note what you inferred.

### 3. Strip the anti-patterns

Remove, don't keep (these actively hurt on Fable 5):

- **Reasoning-extraction triggers** — delete "show your reasoning step by step",
  "explain your thought process before answering", "echo/transcribe/print your
  chain of thought". These can trip the `reasoning_extraction` refusal category
  and cause fallbacks. If the user needs reasoning *visibility*, tell them to
  read structured `thinking` blocks or use a send-to-user tool instead — don't
  put it in the prompt.
- **Enumerated rule-stacks** — collapse long "always/never" lists into one brief
  objective. Brief instruction-following is strong; the list degrades output.
- **Redundant guardrails** — drop hand-holding the model no longer needs.
- **Micromanaged step-by-step task lists** — replace with the goal + success
  criteria and let it determine steps.

### 4. Rewrite using the Fable 5 template

Compose the new prompt from these blocks. Include a block only when the
classification calls for it — a quick synchronous task needs almost none of the
long-run scaffolding.

- **Lead with intent (always):**
  `I'm working on [larger task] for [who]. They need [what the output enables]. With that in mind: [the request].`
- **Objective, not task list (always):** state the goal and the done-criteria;
  omit step-by-step choreography unless order genuinely matters.
- **Boundaries (when there's a do/assess ambiguity or scope risk):** e.g. *"the
  deliverable is your assessment — report findings and stop; don't apply a fix
  until I ask."* Or the anti-over-engineering block: *"Don't add features,
  refactor, or introduce abstractions beyond what the task requires."*
- **Brevity / lead-with-outcome (when output would be read by a person):** graft
  the brevity snippet so the answer leads with the outcome, not a survey.
- **Grounded progress (long/autonomous runs):** *"Before reporting progress, audit
  each claim against a tool result from this session… state plainly, don't
  hedge."*
- **Checkpoint / pause rule (agentic):** *"Pause for me only when the work
  genuinely requires it — a destructive/irreversible action, a real scope change,
  or input only I can provide."*
- **Autonomy reminder (async, user away):** the "you are operating autonomously…
  don't end on a promise, do the work now with tool calls" block.
- **Advanced (multi-agent / very long tasks only):** subagent delegation, a
  memory-notes file, interval self-verification with fresh-context verifier
  subagents, a send-to-user tool for verbatim mid-run messages.

Pull the exact wording for each block from `references/fable5-guidance.md`.

### 5. Recommend an effort level

Effort is the primary intelligence/latency/cost control on Fable 5. State a
recommendation with one line of why:

- **`high`** — default for most real tasks.
- **`xhigh`** — the most capability-sensitive / hardest work.
- **`medium` / `low`** — routine work; still strong, often beats older models'
  top effort. Suggest lowering if the task finishes but runs longer than needed
  or the user wants a snappier, interactive feel.

### 6. Deliver

Present, in this order:
1. **The rewritten prompt** in a fenced block, ready to copy.
2. **Recommended effort** — one line.
3. **What changed** — a terse bullet list (what you cut and what you added), so
   the user learns the pattern. Lead with the outcome; don't narrate.

If you asked clarifying questions, weave the answers into the rewrite rather than
appending them.

## Guardrails for this skill

- Don't add scaffolding the task doesn't need. A one-shot question does not need a
  memory system, subagents, or an autonomy reminder. Match blocks to the
  classification.
- Preserve the user's actual intent and constraints — rewrite *how* it's asked,
  never silently change *what* is asked.
- This skill produces a prompt; it does not execute the task. Hand back the
  prompt and stop unless the user asks you to also run it.
