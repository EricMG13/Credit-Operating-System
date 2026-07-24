# Deep Research vs. STORM — Architecture Comparison

Comparison of CAOS's Deep Research concept against Stanford OVAL's **STORM /
Co-STORM** (<https://github.com/stanford-oval/storm>), the reference open-source
"research a topic, generate a cited long-form report" system. The goal is to
locate CAOS on the design space, name what each does better, and rank what — if
anything — is worth porting.

## TL;DR

CAOS and STORM sit at opposite corners of the same design space. STORM is an
**open, general-purpose, multi-agent knowledge-curation pipeline** optimized for
*coverage and neutrality* — it writes Wikipedia. CAOS Deep Research is a
**managed, domain-specialized, single-call research agent** optimized for a
*defensible committee decision* — it writes a credit view. Neither is a better
version of the other; they are built for different jobs.

The single most valuable idea in STORM that CAOS does **not** have is
**perspective-guided question asking** — machine-*discovered* research angles
that surface the unknown-unknowns the analyst didn't think to ask for. CAOS
already leads STORM on adversarial verification (via the `deep-research` skill),
domain specialization, decision-oriented output, epistemic labeling, and
production hardening. Recommendation: port perspective discovery as an
*augmentation* to the analyst's brief; do **not** adopt STORM's pipeline,
neutrality, or self-hosted DSPy stack wholesale.

## Two deep-research concepts already live in this repo

Worth stating up front, because it changes the comparison: CAOS has **two**
distinct deep-research implementations, and they occupy different points relative
to STORM.

| | **CAOS product** (Deep Research page) | **CAOS `deep-research` skill** (Claude Code harness) | **STORM / Co-STORM** |
|---|---|---|---|
| Location | `caos/server/deepresearch.py`, `research/page.tsx` | `deep-research` skill → `Workflow` | `knowledge-storm` pip package |
| Shape | **One** orchestrated Claude call | **Multi-agent fan-out** | **Multi-agent, multi-stage** pipeline |
| Search loop | Anthropic-hosted server tool (`web_search_20260209`) | 5 parallel `WebSearch` agents | Self-hosted; pluggable retriever |
| Verification | None (inline QC flags only) | **3-vote adversarial** (2/3 refutes kills a claim) | None (curate + cite, no refute) |
| Output | Credit-intelligence report | Cited research report | Wikipedia-style article |
| Human-in-loop | No (brief is upfront steering) | No | **Co-STORM: yes** (mind map + steer) |

The **product feature** is the "current deep research concept" the analyst
actually uses. The **skill** is architecturally the closest thing in the repo to
STORM (fan-out over angles) and is the only one of the three with a fact-checking
gate. Both are referenced below where relevant.

## What each system is

**STORM** (Synthesis of Topic Outlines through Retrieval and Multi-perspective
Question Asking) — an LLM knowledge-curation system that writes Wikipedia-style
articles from scratch. Built on **DSPy**, model-agnostic via **LiteLLM**, with a
pluggable retriever (Bing, You, Serper, Brave, SearXNG, DuckDuckGo, Tavily,
Google, Azure AI Search, VectorRM). Two stages:

1. **Pre-writing / Knowledge Curation** — discover *perspectives* by examining
   similar existing articles, then run **simulated conversations** between a
   "Wikipedia writer" persona and a "topic expert" grounded in live search
   results. Multi-perspective question asking drives breadth; follow-ups drive
   depth. Collects a reference set.
2. **Writing** — generate a hierarchical **outline**, fill each section with
   citations from the reference set (**article generation**), then **polish**
   (lead paragraph, de-duplication).

Five LM roles (`conv_simulator_lm`, `question_asker_lm`, `outline_gen_lm`,
`article_gen_lm`, `article_polish_lm`) via `STORMWikiRunner`.

**Co-STORM** adds human-AI collaboration: a **moderator** agent that raises
thought-provoking questions from what's been discovered, multiple LLM **experts**,
a **warm-start** phase, a dynamic **mind map** that organizes findings into a
concept hierarchy, and a turn policy (`DiscourseManager`) that lets a human
observe or inject utterances mid-run (`warm_start()` → `step()` → `generate_report()`).

**CAOS Deep Research** (`deepresearch.py`) — an autonomous, multi-source web
research agent *through a credit lens*. The analyst fills a structured
`ResearchBrief` (subject, sector/issuer scope, persona, audience, decision,
timeframe, focus, exclusions, investigation criteria, source directives); a
**single** `claude-opus-4-8` call with the Anthropic-hosted `web_search` server
tool runs the search loop (Anthropic iterates internally, resuming on
`pause_turn` up to 4 continuations), streamed to survive long runs. Output is a
committee-ready Markdown credit report: executive summary, findings by criteria,
≥1 table, strategic recommendations, inline QC flags for conflicting/low-confidence
data, and primary-vs-secondary source labeling. `max`/`standard`/`lite` presets
trade cost for depth (model, thinking effort, 5–12 searches). Runs as a durable
background job (`ResearchJob` + polling), degrades to a canned demo report with no
API key, and guards against indirect prompt injection from retrieved pages.

## The core intellectual difference: who supplies the perspectives?

This is the crux. Both systems know that a good report needs **breadth of
angle** — the failure mode is a narrow report that misses what matters. They
solve it in opposite ways:

- **STORM discovers perspectives.** It reads comparable articles, infers the
  viewpoints a good treatment would cover, and asks questions from each. This is
  its headline contribution and it directly attacks *unknown-unknowns* — coverage
  the author never thought to seek.
- **CAOS is told the perspectives.** The analyst supplies them as the
  `criteria` list (defaulting to seven standing credit lenses: macro, structural
  drivers, risk focus, sector outlook, rating trends, valuation, sponsor/lender
  activity). Breadth is **human-curated and fixed per run**; the model's agency is
  in *how deeply* it searches each, not in *which angles exist*.

For a mature domain with a settled analytical framework — leveraged-finance
credit — the fixed-criteria approach is a **feature**: it guarantees every report
covers the committee's checklist and reads consistently. But it inherits the
analyst's blind spots. If the real story is a second-order angle nobody put in the
brief (a customer-concentration tail, a covenant quirk, a supplier's distress),
CAOS is structurally less likely to surface it than STORM. This is the gap most
worth closing — see recommendations.

## Mechanism-by-mechanism

| Dimension | STORM / Co-STORM | CAOS Deep Research |
|---|---|---|
| **Orchestration** | Explicit multi-stage DSPy pipeline; discrete modules | Single agentic call; Anthropic runs the search loop server-side |
| **Perspective breadth** | **Machine-discovered** from similar articles | **Human-supplied** via `criteria` (fixed per run) |
| **Depth mechanism** | Simulated writer↔expert conversation w/ follow-ups | Model's internal multi-search loop (capped 5–12) |
| **Retrieval** | Bring-your-own: 10+ pluggable retrievers | Anthropic-managed `web_search` server tool (no source control) |
| **Verification** | None — curates & cites, does not refute | Product: inline QC flags. Skill: **3-vote adversarial refute** |
| **Citations** | Tied to a curated reference set | Deduped `web_search_tool_result` URLs; primary/secondary labeled |
| **Output register** | Neutral, encyclopedic (Wikipedia) | **Opinionated, decision-oriented** (committee recommendation) |
| **Human-in-loop** | Co-STORM: mind map + mid-run steering | None — brief is upfront steering only |
| **Model coupling** | Any model via LiteLLM; 5–6 configured roles | Anthropic-only; presets tune one model |
| **Deployment** | Self-hosted library; you own keys, infra, cost | Managed single-container Databricks App |
| **Hardening** | Research artifact — minimal | Durable jobs, per-user isolation, rate limits, injection guard, degrade-to-demo |
| **License / openness** | Open source, inspectable, forkable | Proprietary app; opinionated + closed |

## Where CAOS already leads

1. **Adversarial verification.** The `deep-research` skill kills any claim that
   2 of 3 independent skeptics can refute. STORM curates and cites but has **no
   fact-checking gate** — a plausible-but-wrong retrieved claim flows straight
   into the article. For a domain where a wrong read costs money, a refutation
   pass is a real correctness edge. (The *product* feature lacks this today — it
   relies on inline QC flags; closing that is a secondary recommendation.)
2. **Decision-orientation.** STORM is deliberately neutral. CAOS deliberately
   ends on a **bottom-line credit conclusion + strategic recommendations**. For a
   PM/committee, the opinion *is* the product.
3. **Domain specialization.** The credit-lens system prompt, sector/issuer scope,
   and standing criteria produce a report shaped like the desk's own work — not a
   general encyclopedia entry an analyst must re-frame.
4. **Epistemic honesty in the output contract.** Mandatory QC flags for
   conflicting/low-confidence data and primary-vs-secondary source labeling are
   baked into the format. STORM's neutral prose doesn't foreground confidence.
5. **Production hardening.** Durable background jobs surviving dropped
   connections, per-user job isolation, rate limiting, indirect-prompt-injection
   guarding of retrieved pages, and degrade-to-demo. STORM is a research codebase;
   this is a shipped app.

## What's worth porting from STORM (ranked)

1. **Perspective discovery as brief augmentation** *(highest value)*. Before the
   run, generate candidate investigation angles from the subject — e.g. pull
   comparable issuers/sectors, prior-cycle analogues, capital-structure-specific
   risks — and present them to the analyst to **accept/reject/edit** alongside the
   default criteria. This keeps the human-curated framework (its strength) while
   importing STORM's unknown-unknown coverage (its strength), and it fits the
   "show your work" principle: the analyst sees, and owns, the angle set. Low
   architectural cost — it's a pre-flight LLM step that expands `criteria`, not a
   pipeline rewrite.
2. **Conversation-simulation depth per criterion.** STORM's writer↔expert dialogue
   digs deeper than a flat search loop because each answer spawns grounded
   follow-ups. CAOS's single-call product may under-explore a criterion, and the
   skill's fan-out is one-shot per angle. A short simulated "analyst ↔ desk
   specialist" Q&A loop per high-priority criterion would deepen coverage where it
   matters. Medium cost; watch token spend against the existing search caps.
3. **Co-STORM-style mid-run steering** *(for the analyst persona specifically)*.
   Fire-and-forget suits the PM scanning posture, but the deep-dive analyst would
   benefit from steering mid-run ("go deeper on the PIK amendments", "drop the
   macro section"). A mind-map view of discovered angles + an inject-utterance
   control maps STORM's collaborative model onto the analyst workflow. Highest
   cost (breaks the durable single-call job model); treat as exploratory.
4. **Retriever pluggability** *(optional).* STORM's bring-your-own-retriever design
   would let CAOS point at licensed data (rating-agency feeds, filings APIs)
   instead of only the Anthropic-managed web search. Valuable for source quality,
   but trades away the managed simplicity and injection-guard that the server tool
   provides — only worth it if primary-source access becomes a hard requirement.

## What to explicitly NOT port

- **STORM's Wikipedia neutrality.** CAOS's job is a *view*, not a balanced
  encyclopedia entry. Neutral register would be a regression for this user.
- **The self-hosted DSPy multi-stage pipeline as the app's default.** The managed
  single-call model gives durability, injection-guarding, degrade-to-demo, and
  single-container deployability that fit a Databricks App. A five-module
  self-hosted pipeline is more moving parts, more failure surface, and more ops
  for no analyst-visible gain. Keep the fan-out/verify variant confined to the
  offline `deep-research` skill where it already lives.
- **Model-agnostic LiteLLM abstraction.** CAOS is intentionally Anthropic-coupled
  (adaptive thinking, server-tool search, overload-aware fallback). Genericizing
  the model layer buys portability the product doesn't need.

## Bottom line

STORM validates the direction CAOS is already going and offers exactly one
high-leverage borrow: **machine-discovered perspectives** to cover the analyst's
blind spots, added as an *augmentation* to — not a replacement for — the
structured brief. On everything else that matters for a buy-side credit desk
(verification, decision-orientation, domain fit, epistemic labeling, production
hardening), CAOS is already ahead of the reference system. The right move is
**selective borrowing, not adoption**.
