# Handoff — Intelligent Data Vault, post-reconciliation (2026-07-07)

> **Read this first in the next session.** It is the single source of truth for
> what shipped, what was reconciled, and what to build next. The plan doc
> (`QUERY_INTELLIGENCE_PLAN.md`) was partly reverted by parallel work and is
> out of sync with the shipped code — trust **this file** for current state.

## TL;DR

Phases 1–4 of the Intelligent Data Vault evolution are **shipped and
reconciled**. A parallel-work reversion wiped `queryanswer.py`, `retrieval.py`,
`database.py` (`PipelineRun`), `main.py` (autonomy route + executor), and the
test mocks; all were re-applied on 2026-07-07 and the full suite is green
(1153 passed, 2 skipped, 1 pre-existing cross-test contamination that passes
in isolation). **The next phase is the Cross-encoder re-rank** — the deferred
Phase-1 remainder and the precision side of the dropped-claim-rate alarm.

## What shipped (and is now reconciled)

### Phase 1 — Retrieval remainders
| Lane | File | Status |
| --- | --- | --- |
| Graph-expansion | `engine/graphexpansion.py` + `retrieval.py` (`expand_graph` param) | SHIPPED — 1-hop `QueryAcceptedLink` traversal, opt-in via `retrieve_corpus(expand_graph=True)`, wired in `queryanswer._generate` as `expand_graph=bool(issuer_ids)` |
| Metric-fact SQL | `engine/metricfactlane.py` | SHIPPED — topic-relevant raw `MetricFact` rows → `MetricFactEntry`s with closed `numbers` sets (value + period year), deduped against Metric Engine derivatives, wired in `_generate` step 4b (fault-isolated) |
| Cross-encoder re-rank | `engine/rerank.py` + `retrieval.py` (`rerank` param) + `config.py` (`RERANK_ENABLED`/`RERANK_MODEL`/`RERANK_WINDOW`) | SHIPPED 2026-07-07 — local `mxbai-rerank-large-v1` via `sentence-transformers`, lazy-loaded + module-cached, fault-isolated passthrough (any load/inference failure → RRF-only). Wired after RRF fusion in `retrieve_corpus` (re-ranks top-`rerank_window`, keeps top-`k`); sigmoid-normalized score so MMR is not scale-dominated. Opt-out via `rerank=False`. Gated by `RERANK_ENABLED` (off by default → keyless/CI never load the 670MB weight). Tests: `test_rerank.py` (14 — gate, fault isolation, truncation, normalization, opt-out, wiring), `bench/test_rerank_precision.py` (3 — non-regression vs RRF, lift on engineered cases, seed-structural guard). `sentence-transformers>=3.3,<5` added to `requirements.txt`. Red-team: RT-2026-07-07-08…12. |

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
1182 passed, 2 skipped, 3 failed — all 3 pre-existing/parallel-WIP, not this phase:
  - test_api::test_search_by_name_case_insensitive — pre-existing flake (passes in isolation)
  - test_memochunks::test_chunk_memo_idempotent_on_re_upload — parallel WIP (untracked engine/memochunks.py)
  - test_vault_memo::test_upload_memo_vaults_autolinks_and_feeds_query_graph — parallel WIP (memo chunking)
2-hop phase's own cluster: 18/18 green (test_graphexpansion.py 12 + bench/test_graphexpansion_recall.py 6).
```

The uncommitted-but-modified files (do NOT blanket `git add` — user has parallel
WIP): `database.py`, `engine/queryanswer.py`, `main.py`, `retrieval.py`,
`tests/server/test_llm_safety.py`, `tests/server/test_query_answer.py`.
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
(NOTE: `engine/memochunks.py` + `test_memochunks.py` + `test_vault_memo.py`
changes are PARALLEL WIP — do not stage.)

## What's next (after re-rank)

The Cross-encoder re-rank phase (the deferred Phase-1 remainder + the precision
side of the dropped-claim-rate alarm) SHIPPED 2026-07-07. The remaining items
are the "Other deferred items" list below — plan-doc reconciliation is the
lowest-effort, 2-hop graph expansion is the next measured recall follow-on.

## The re-rank phase — Cross-encoder re-rank (SHIPPED 2026-07-07)

### Why
The dropped-claim-rate health alarm (Phase 4) says "fix for a rising drop rate
is better retrieval." The two shipped Phase-1 lanes (graph-expansion,
metric-fact SQL) close the **recall** gaps. The **precision** gap — irrelevant
chunks outranking relevant ones in the RRF-fused pack — is the remaining half.
A cross-encoder re-rank on the top-K retrieved chunks before context packing is
the standard fix.

### What to build
1. **Reranker model decision** (blocked — needs user sign-off):
   - **Local:** `mixedbread-ai/mxbai-rerank-large-v1` via `sentence-transformers`
     (no API cost, no latency ceiling hit, runs in the same process as
     embeddings). ~670MB model, ~50ms/query on CPU for top-20.
   - **Hosted:** Cohere `rerank-english-v3.0` or Voyage `rerank-2` (API cost,
     network latency, but no model weight to ship).
   - **Recommendation:** local `mxbai-rerank` — consistent with the codebase's
     "self-hosted, no external API for the core loop" posture (matches the
     pgvector/embeddings decision).

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

## Other deferred items (lower priority, for after re-rank)

1. **Plan doc reconciliation** — `QUERY_INTELLIGENCE_PLAN.md` Part II (Phase
   1–4 tables) was reverted by parallel work. The shipped state lives in this
   handoff + the red-team log. Re-writing Part II is documentation debt, not
   blocked.
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
   follow-up: chunk memos at upload. Small, independent.
4. **Per-analyst briefs** — Phase-1 brief is book-level; per-analyst scoping
   (watchlists) is Phase-2 personalization.
5. **One-box unification** — merging Command-Center `/nl` into the Query bar.
   Separate IA decision.

## Quick-start commands for the next session

```bash
# Run the reconciled suite (should be 1153 passed, 1 pre-existing flake)
cd "caos/server" && .venv311/bin/python -m pytest ../tests/server/ -q \
  --ignore=../tests/server/test_intelligent_vault.py

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
