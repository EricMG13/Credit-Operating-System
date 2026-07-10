# Handoff — Intelligent Data Vault, post-reconciliation (2026-07-07)

> **Read this first in the next session.** It is the single source of truth for
> what shipped, what was reconciled, and what to build next. The plan doc
> (`QUERY_INTELLIGENCE_PLAN.md`) was partly reverted by parallel work and is
> out of sync with the shipped code — trust **this file** for current state.

## TL;DR

Phases 1–4 of the Intelligent Data Vault evolution are **shipped and
reconciled**. A parallel-work reversion wiped `queryanswer.py`, `retrieval.py`,
`database.py` (`PipelineRun`), `main.py` (autonomy route + executor), and the
test mocks; all were re-applied on 2026-07-07. The Phase-1 retrieval remainders
are all closed: cross-encoder re-rank (precision), 2-hop graph expansion
(measured, opt-in), and one-box unification (additive — Query bar hosts both
walk + metric-search lanes). The full server suite is green modulo pre-existing
/parallel-WIP flakes (1182 passed, 2 skipped, 3 pre-existing/parallel-WIP — see
"Current test state"). **No agent-owned Phase-1 retrieval remainder is open**;
the remaining follow-ons are gated on real-world signal or a separate IA
decision (see "What's next (after one-box unification)").

## What shipped (and is now reconciled)

### Phase 1 — Retrieval remainders
| Lane | File | Status |
| --- | --- | --- |
| Graph-expansion | `engine/graphexpansion.py` + `retrieval.py` (`expand_graph` param) | SHIPPED — 1-hop `QueryAcceptedLink` traversal, opt-in via `retrieve_corpus(expand_graph=True)`, wired in `queryanswer._generate` as `expand_graph=bool(issuer_ids)` |
| Metric-fact SQL | `engine/metricfactlane.py` | SHIPPED — topic-relevant raw `MetricFact` rows → `MetricFactEntry`s with closed `numbers` sets (value + period year), deduped against Metric Engine derivatives, wired in `_generate` step 4b (fault-isolated) |
| LLM re-rank | `engine/rerank.py` + `retrieval.py` (`rerank` param) + `config.py` (`RERANK_ENABLED`/`RERANK_MODEL_TIER`/`RERANK_WINDOW`) + `engine/presets.py` (`rerank_model()`) | SHIPPED 2026-07-07, **re-architected same-day to API-based** — one batched LLM call through the shared `engine/llm_client.create` seam (no local model download, per the no-downloads policy), on a model picked by the tier system (`RERANK_MODEL_TIER`, default `cheap`). Fault-isolated passthrough on any failure (setting off, no provider key, API error, malformed JSON, score-count mismatch → RRF-only). Wired after RRF fusion in `retrieve_corpus` (re-ranks top-`rerank_window`, keeps top-`k`); score clamped to [0,1] so MMR is not scale-dominated. Opt-out via `rerank=False`. Gated by `RERANK_ENABLED` (off by default). Tests: `test_rerank.py` (12 — gate, no-key passthrough, fault isolation, truncation, clamp, parsing, tier-model selection, UNTRUSTED wrapping, opt-out, wiring), `bench/test_rerank_precision.py` (3 — non-regression vs RRF, lift on engineered cases, seed-structural guard); `test_llm_safety.py` registers the new call site. `sentence-transformers` dependency removed. Red-team: RT-2026-07-07-08…12 (local-model era) + RT-2026-07-07-29 (API-rerank pivot). |

### Phase 2 — Validation stack
| Slice | File(s) | Status |
| --- | --- | --- |
| Metric Engine | `engine/metricengine.py` | SHIPPED — deterministic headline deltas, peer robust z-scores; `build_metric_facts(db, issuer_id, walk)` → `List[MetricFactEntry]` |
| Claim types | `engine/queryanswer.py`, `engine/queryinsights.py` | SHIPPED — `claim_type` (observation\|causal-hypothesis\|risk-flag) on `_Sentence`/cards; coerced, not gated |
| Entailment demote | `engine/entailment.py` | SHIPPED — `EntailmentClaim`, `check_entailment(claims)→dict[index,Verdict]`, `should_demote(v)`; fault-isolated; wired as post-`_validate` demote pass |
| Self-correction | `engine/queryanswer.py` `_generate` | SHIPPED — bounded (max 2 attempts), take-better, retry when `drop_rate>0.5`, feedback note from drop reasons |
| Golden eval | `engine/eval.py` + `tests/server/golden/test_golden_query_gates.py` | SHIPPED — `grounding_metrics(records)`, parametrized gate-semantics pinning |

### Phase 3 — Deterministic spine
| Slice | File(s) | Status |
| --- | --- | --- |
| Tickets | `engine/tickets.py` | SHIPPED — `AttentionTicket` dataclass, severity ranking, dedup/sort |
| Sentinel | `engine/sentinel.py` | SHIPPED — `scan(db, since)` → new-filing, metric-move, qa-finding tickets |
| Anomaly | `engine/anomaly.py` | SHIPPED — `detect(db)` → peer-outlier, robust-z, shift tickets |
| Analyst | `engine/analyst.py` | SHIPPED — `investigate(db, anomalies, max_per_run)` reusing `queryanswer._generate(tier=LIGHT)` |
| Reporter | `engine/reporter.py` | SHIPPED — `compose_draft_report`, `ratify`; draft envelope (unratified, export-gated) |
| Orchestrator | `engine/autonomy.py` + `routes/autonomy.py` | SHIPPED — `run_cycle`, async route (enqueue + serve-latest + poll) |
| Advisory locks | `engine/locks.py` | SHIPPED — `try_advisory_lock`/`release_advisory_lock`/`advisory_lock` ctx mgr; Postgres + SQLite fallback |
| Pipeline runs | `engine/pipeline.py` + `engine/pipeline_executor.py` + `database.py` (`PipelineRun`) + migration `0031` | SHIPPED — `persist_cycle`, `latest_prior`/`latest_draft`/`latest_running`, `enqueue_cycle`; `claim_next_job` (SKIP LOCKED), `execute_job`, `PipelineExecutor` (sweep-on-boot) |
| Route + lifespan | `main.py` | SHIPPED — `autonomy.router` included; `PipelineExecutor` start/stop in lifespan |

### Phase 4 — Provenance + health
| Slice | File(s) | Status |
| --- | --- | --- |
| Web-grounded provenance | `engine/provenance.py` | SHIPPED — `is_web_provenance`, `ratify_web`, `export_allowed`; wired into `reporter.is_exportable` |
| Dropped-claim-rate alarm | `engine/eval.py` (`dropped_claim_rate`) + health check | SHIPPED — the alarm that names "fix for a rising drop rate is better retrieval" |

## What was reconciled on 2026-07-07 (the reapply)

Parallel user work reverted six files to pre-Phase-2 state. All were re-applied:

1. **`caos/server/engine/queryanswer.py`** — full Phase-2/3/4 + SQL-lane wiring
   (Metric Engine step 4, graph-expansion `expand_graph` step 2, metric-fact SQL
   lane step 4b, claim_type, entailment demote, bounded self-correction, `tier`
   param). `_validate` takes `metric_facts` (3-arg), emits `fact_citations`,
   returns transient `drop_rate`/`drop_reasons`.
2. **`caos/server/retrieval.py`** — `expand_graph` param + `expand_issuer_set` call.
3. **`caos/server/database.py`** — `PipelineRun` model re-added (mirrors
   `ResearchJob`; matches migration 0031 so `alembic check` passes).
4. **`caos/server/main.py`** — `autonomy` router included + `PipelineExecutor`
   lifespan wiring. **Note:** `pipeline_executor.py` lives under `engine/`, not
   top-level like `research_executor.py` — import is
   `from engine.pipeline_executor import PipelineExecutor`.
5. **`caos/tests/server/test_query_answer.py`** — mock `expand_graph` kwarg +
   call-count assertions (self-correction doubles calls) + 7 re-added
   integration tests.
6. **`caos/tests/server/test_llm_safety.py`** — `engine/entailment.py` re-added
   to `_REVIEWED_LLM_CALL_SITES`.

Red-team: RT-2026-07-07-06 (queryanswer reapply) + RT-2026-07-07-07 (PipelineRun
+ route reconciliation) in `.agent-reviews/redteam.md`.

## Current test state

```
Server: 1182 passed, 2 skipped, 3 failed — all 3 pre-existing/parallel-WIP, not this phase:
  - test_api::test_search_by_name_case_insensitive — pre-existing flake (passes in isolation)
  - test_memochunks::test_chunk_memo_idempotent_on_re_upload — parallel WIP (untracked engine/memochunks.py)
  - test_vault_memo::test_upload_memo_vaults_autolinks_and_feeds_query_graph — parallel WIP (memo chunking)
2-hop phase's own cluster: 18/18 green (test_graphexpansion.py 12 + bench/test_graphexpansion_recall.py 6).
One-box unification phase (this phase, frontend-only): 4 new tests green
  (src/app/query/scan-metrics.test.tsx) + the 7 existing NlQuery tests still green.
  1 frontend failure is PARALLEL WIP, not this phase:
  - LiveCoverage.test.tsx > supports selection via click and keyboard (Enter/Space) —
    parallel WIP changed LiveCoverage.tsx from role="button"/aria-pressed to
    role="row"/aria-selected (grid semantics) but did NOT update the test's
    button-role assertions. Fails in isolation. Not touched by this phase.
```

The uncommitted-but-modified files (do NOT blanket `git add` — user has parallel
WIP): `database.py`, `engine/queryanswer.py`, `main.py`, `retrieval.py`,
`tests/server/test_llm_safety.py`, `tests/server/test_query_answer.py`,
`caos/frontend/src/components/command/LiveCoverage.tsx` (parallel-WIP grid refactor).
Re-rank phase adds (agent-owned, safe to stage explicitly):
`config.py`, `requirements.txt`, `engine/rerank.py`,
`tests/server/test_rerank.py`, `tests/server/bench/__init__.py`,
`tests/server/bench/conftest.py`, `tests/server/bench/seed_labels.py`,
`tests/server/bench/test_rerank_precision.py`,
`.agent-reviews/redteam.md`, `caos/docs/HANDOFF_NEXT_PHASE.md`.
2-hop measurement phase adds (agent-owned, safe to stage explicitly):
`engine/graphexpansion.py`, `tests/server/test_graphexpansion.py`,
`tests/server/bench/graphexpansion_seed.py`,
`tests/server/bench/test_graphexpansion_recall.py`,
`tests/server/bench/run_graphexpansion_measurement.py`,
`caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md`,
`.agent-reviews/redteam.md`, `caos/docs/HANDOFF_NEXT_PHASE.md`.
Plan-doc reconciliation phase adds (agent-owned, safe to stage explicitly):
`caos/docs/QUERY_INTELLIGENCE_PLAN.md` (§8 reconciled to shipped state + §7 item 5 memo note),
`caos/docs/HANDOFF_NEXT_PHASE.md`.
One-box unification phase adds (agent-owned, safe to stage explicitly):
`caos/frontend/src/components/command/NlQuery.tsx` (export QueryResultsModal + OpenCite type),
`caos/frontend/src/app/query/page.tsx` (Scan metrics button + modal + live region),
`caos/frontend/src/app/query/scan-metrics.test.tsx` (new),
`caos/docs/HANDOFF_NEXT_PHASE.md`.
(NOTE: `engine/memochunks.py` + `test_memochunks.py` + `test_vault_memo.py`
changes are PARALLEL WIP — do not stage. `LiveCoverage.tsx` is PARALLEL WIP — do not stage.)

## What's next (after one-box unification)

All five "Other deferred items" below are now **done, measured, or in-flight as
parallel WIP** — there is no remaining agent-owned Phase-1 retrieval remainder.
The genuinely-open follow-ons (none are blocked on this agent; all are gated on
real-world signal or a separate IA decision):

1. **2-hop graph expansion → real-data enable gate** — the synthetic harness
   (`GRAPH_EXPANSION_2HOP_MEASUREMENT.md`) showed narrow recall lift + 0.50
   dilution on the common 1-hop case. The actual enable gate is real-data
   measurement on production cross-issuer queries: extend
   `bench/graphexpansion_seed.py` `LABELS` with real (query, relevant chunk_id)
   pairs and re-run `run_graphexpansion_measurement.py`. Decision: flip
   `retrieve_corpus` to `hops=2` only if recall@K lifts materially AND dilution
   stays below threshold on real data.
2. **One-box auto-classifier follow-on** — the additive approach (explicit SCAN
   METRICS button) shipped; intent is never silently misrouted (RT-26). The
   documented follow-on is a deterministic keyword `intent_classify` + a
   `/api/query/dispatch` endpoint that auto-picks walk vs metric-search, gated
   on the keyword classifier's real-world accuracy. An LLM-intent-refinement
   upgrade is a further follow-on.
3. **Command Center `/nl` box deprecation** — RT-28 deferred this IA decision:
   now that the Query bar hosts the metric lane, whether to deprecate the
   Command Center `/nl` box (a PM-persona regression risk) is a separate
   product call, not an implementation task.

Parallel WIP still in-flight (do NOT stage or collide): analyst memos in
retrieval (#3) and per-analyst briefs / watchlists (#4) — see those entries for
the file lists.

## The re-rank phase — Cross-encoder re-rank (SHIPPED 2026-07-07)

### Why
The dropped-claim-rate health alarm (Phase 4) says "fix for a rising drop rate
is better retrieval." The two shipped Phase-1 lanes (graph-expansion,
metric-fact SQL) close the **recall** gaps. The **precision** gap — irrelevant
chunks outranking relevant ones in the RRF-fused pack — is the remaining half.
A cross-encoder re-rank on the top-K retrieved chunks before context packing is
the standard fix.

### What to build
1. **Reranker model decision** (RESOLVED — superseded by the no-downloads policy):
   - **Original options** were local `mxbai-rerank-large-v1` via `sentence-transformers`
     (no API cost, ~670MB, ~50ms/query CPU) vs hosted Cohere/Voyage rerank APIs.
   - **Shipped decision:** neither — the re-rank runs as one batched **LLM call
     through the existing API seam** (`engine/llm_client.create`) on a model picked
     by the tier system (`RERANK_MODEL_TIER`, default `cheap`). Policy: NO local
     model downloads; all LLM work goes through the configured API models. The
     query + top-`window` chunk texts go in one prompt; the LLM returns a JSON
     `{"scores":[...]}` of 0-1 relevance scores; we re-sort and keep top-`k`. One
     round-trip per query — the cheapest API rerank, no new dependency, no weight.

2. **`engine/rerank.py`** — `rerank(db, query, hits, k=20) → List[CorpusHit]`
   with the reranker model, fault-isolated (any failure → return hits
   unchanged). Lazy-load the model (first call) so keyless deploys don't crash.
   Cache the model instance at module level (like embeddings warmup).

3. **Wire into `retrieval.py`** — after RRF fusion, before `pack_context`:
   re-rank the top-`2K` hits, keep the top-`K`. The `retrieve_corpus` signature
   stays unchanged (re-rank is internal to the pipeline). Add a
   `rerank: bool = True` kwarg (opt-out for the cases where BM25-only is
   desired, e.g. the graph-expansion integration test).

4. **Benchmark harness** (the deferral reason) — `tests/server/bench/` with a
   small labeled set (query → relevant chunk_id) proving the re-rank lifts
   precision@K vs RRF-only. Without this, the re-rank is an unmeasured latency
   cost. Reuse the golden cases' hit sets as the seed labels.

5. **Tests** — `tests/server/test_rerank.py`: fault isolation (model load
   failure → passthrough), top-K truncation, `rerank=False` opt-out, the
   benchmark harness asserting precision@5 ≥ RRF precision@5 on the seed set.

6. **Red-team** — record in `.agent-reviews/redteam.md` per the CLAUDE.md gate:
   the reranker adds a model weight + a latency floor; the local-vs-hosted
   tradeoff; the cache-eviction story (long-running process, model stays
   resident).

### Key interfaces to respect
- `retrieve_corpus(db, query, k, issuer_ids, expand_graph)` → `List[CorpusHit]`
  (`caos/server/retrieval.py:279`). Re-rank slots in AFTER the RRF fusion,
  BEFORE the return — the caller (`queryanswer._generate`) sees re-ranked hits.
- `CorpusHit` is a `SimpleNamespace`-shaped hit: `chunk_id`, `text`,
  `issuer_id`, `doc`, `score`. The re-rank overwrites `score` with the
  cross-encoder score and re-sorts.
- `pack_context` (`engine/packer.py`) consumes the re-ranked list — it already
  respects the input order for MMR diversity, so a re-ranked input yields a
  re-ranked pack.
- The graph-expansion integration test
  (`test_retrieve_corpus_expand_graph_widens_to_neighbor_chunks`) uses BM25-only
  (no embeddings, `GEMINI_API_KEY` blanked) — ensure `rerank` also short-circuits
  when the model isn't loaded (keyless), or the test will need `rerank=False`.

### What NOT to do
- Don't re-rank the full retrieved set — only the top-`2K` (latency).
- Don't make re-rank a new retrieval lane — it's a post-fusion re-ordering of
  the existing RRF output, not a 4th fusion input.
- Don't add a new migration — no schema change.
- Don't touch `queryanswer._generate` — the re-rank is invisible to it (it
  calls `retrieve_corpus`, which now re-ranks internally).

## Phase-1 retrieval remainders (all done, measured, or in-flight as parallel WIP)

1. **Plan doc reconciliation** — `QUERY_INTELLIGENCE_PLAN.md` Part II (Phase
   1–4 tables) was reverted by parallel work. The shipped state lives in this
   handoff + the red-team log. Re-writing Part II is documentation debt, not
   blocked. **RECONCILED 2026-07-07** — §8 "Phase-1 retrieval remainders" now
   reflects all three shipped lanes (graph-expansion, metric-fact, cross-encoder
   re-rank) + the 2-hop measurement outcome, and §7 item 5 notes memo chunking
   is in-flight parallel WIP. RT range updated to RT-2026-07-07-01..21.
2. **2-hop graph expansion** — `graphexpansion.expand_issuer_set` caps at 1-hop
   (v1). 2-hop is a measured follow-on (risks diluting the pack with
   second-degree peers). Needs a recall-vs-precision measurement on real
   cross-issuer questions before enabling. **MEASURED 2026-07-07** — the n-hop
   traversal is implemented (`graph_neighbors` BFS, visited-set bounded) and
   opt-in via `hops>1`, but the `retrieve_corpus` production default stays
   `hops=1`. The synthetic contagion-chain measurement
   (`caos/docs/GRAPH_EXPANSION_2HOP_MEASUREMENT.md`) shows 2-hop lifts recall
   ONLY for genuinely-2-hop questions (0.00→1.00) while adding 0.50 dilution to
   the common 1-hop case (zero recall gain, irrelevant peer chunks enter the
   pack). **Decision: 2-hop stays opt-in, NOT the default** — the real-data
   measurement on production cross-issuer queries (the actual enable gate) is
   the open follow-on. Harness: `bench/test_graphexpansion_recall.py` +
   `bench/run_graphexpansion_measurement.py`; extend `LABELS` for real pairs.
   Red-team: RT-2026-07-07-17…21.
3. **Analyst memos in retrieval** — memos are vault-only today (not chunked
   into `document_chunks`), so Q2 answers won't cite them. The recorded
   follow-up: chunk memos at upload. Small, independent. **IN-FLIGHT as parallel
   WIP** — `engine/memochunks.py` (untracked) + `routes/ingestion.py` memo
   chunking wiring + `test_memochunks.py` / `test_vault_memo.py` are uncommitted
   in the working tree (not this agent's work). Do not stage or collide.
4. **Per-analyst briefs** — Phase-1 brief is book-level; per-analyst scoping
   (watchlists) is Phase-2 personalization. **IN-FLIGHT as parallel WIP** —
   `engine/analyst.py` + `engine/queryinsights.py` per-analyst keying +
   `WatchlistEditor.tsx` + `api.ts` watchlist endpoints + migration
   `0032_analyst_watchlist.py` + `test_query_watchlist.py` / `test_query_insights.py`
   are uncommitted in the working tree (not this agent's work). Red-team
   RT-2026-07-07-22…25 covers the scoping/empty-watchlist/cache-key decisions.
   Do not stage or collide.
5. **One-box unification** — merging Command-Center `/nl` into the Query bar.
   **DONE 2026-07-07 (additive approach)** — the Query bar now hosts BOTH lanes:
   walk-primary (Enter → `/route` + `/graph` + `/answer`, unchanged) AND a new
   explicit "SCAN METRICS" secondary button that calls `/api/query/nl` and opens
   the shared `QueryResultsModal` (exported from `NlQuery.tsx` and reused
   verbatim — same ranked table / evidence list / chart / caveats / citation
   chips as the Command Center `/nl` box). The citation chips call back into the
   Query page's existing `CitationViewer`, so one source viewer backs both lanes.
   The Command Center `/nl` box is KEPT (no regression for the PM persona —
   whether to deprecate it is a separate IA decision deferred to a follow-on).
   Intent is NEVER silently misrouted: the analyst picks the metric lane
   explicitly (button-only); Enter is always a walk. Auto-detection is a
   documented follow-on, not this phase. A `/nl` 422 (no metric match) surfaces
   as an in-modal alert with a backend detail, not a page-level crash. The scan
   is fault-isolated from the walk flow — it never touches graph/answer/route
   state. Tests: `src/app/query/scan-metrics.test.tsx` (4) — button calls `/nl`
   + opens modal with ranked table; Enter stays walk-primary (never `/nl`); `/nl`
   422 → in-modal alert; button disabled until text entered. The 7 existing
   `NlQuery.test.tsx` tests stay green (the export is purely additive). Red-team:
   RT-2026-07-07-26 (dispatch ambiguity → explicit button, no silent dispatch),
   RT-2026-07-07-27 (result-surface mismatch → reuse `QueryResultsModal`, no new
   canvas), RT-2026-07-07-28 (Command Center box kept, not removed). Vision-gap
   #2 closed.

## Quick-start commands for the next session

```bash
# Run the reconciled server suite (1182 passed, 2 skipped, 3 pre-existing/
# parallel-WIP flakes — see "Current test state"). Ignore the intelligent-vault
# suite (separate long-running harness).
cd "caos/server" && .venv311/bin/python -m pytest ../tests/server/ -q \
  --ignore=../tests/server/test_intelligent_vault.py

# Run the frontend suite (vitest) — 414 pass, 1 parallel-WIP failure
# (LiveCoverage grid-semantics refactor, not this agent's work).
cd "caos/frontend" && npx vitest run

# Run just the query-answer cluster (102 tests, the fastest signal)
cd "caos/server" && .venv311/bin/python -m pytest \
  ../tests/server/test_query_answer.py \
  ../tests/server/golden/test_golden_query_gates.py \
  ../tests/server/test_graphexpansion.py \
  ../tests/server/test_metricfactlane.py \
  ../tests/server/test_metricengine.py \
  ../tests/server/test_entailment.py \
  ../tests/server/test_llm_safety.py -q

# mypy on touched files (pre-existing CorpusHit/Hit variance is expected)
cd "caos/server" && .venv311/bin/python -m mypy engine/rerank.py \
  --no-error-summary --ignore-missing-imports
```
