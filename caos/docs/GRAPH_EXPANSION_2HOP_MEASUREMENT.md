# 2-hop Graph Expansion — Measurement & Decision

**Date:** 2026-07-07
**Phase:** Intelligent Data Vault, Phase-1 remainder (graph-expansion follow-on)
**Status:** MEASURED — 2-hop stays opt-in, NOT the production default (pending real-data measurement)

This is the measured follow-on `HANDOFF_NEXT_PHASE.md` gates 2-hop enablement
on: *"a recall-vs-precision measurement on real cross-issuer questions before
enabling."* The synthetic measurement below is DIRECTIONAL — it proves the
wiring and quantifies the recall-vs-dilution tradeoff on a controlled
contagion-chain seed. The production enable decision is gated on a real-data
measurement on production cross-issuer queries (recorded below as the open
follow-on).

## What was measured

A synthetic contagion chain: **Acme—Beta—Delta—Gamma** (ratified
`QueryAcceptedLink` edges), plus **Epsilon** as an unlinked control (its chunk
mentions every query term — a greedy distractor that must never surface when
scoped to the chain). Three labeled queries, each with a relevant chunk at a
different hop distance from the scoped issuer (Acme):

| query | relevant chunk | min hops from Acme |
|---|---|---|
| `sponsor shared agreement` | Beta | 1 |
| `contagion sponsor chain exposure` | Delta | 2 |
| `sector overlap sponsor chain` | Gamma | 3 |

Each query is scoped to Acme and run at hops 0 (no expansion), 1 (today's
production default), 2 (the proposed follow-on), and 3 (bound check). BM25-only,
no rerank, no embeddings — the measurement isolates the GRAPH-EXPANSION effect
(widening the issuer set). K=8.

Reproduce: `cd caos/server && CAOS_TEST=1 DATABASE_URL="sqlite+aiosqlite:////tmp/caos_measure.db" .venv311/bin/python ../tests/server/bench/run_graphexpansion_measurement.py`

## Numbers

```
query                                      min_hop | hops  recall@K  prec@K  dilution  #surf
---------------------------------------------------------------------------------------------
sponsor shared agreement                         1 |    0      0.00    0.00     0.00      0
sponsor shared agreement                         1 |    1      1.00    0.12     0.00      1
sponsor shared agreement                         1 |    2      1.00    0.12     0.50      2
sponsor shared agreement                         1 |    3      1.00    0.12     0.67      3

contagion sponsor chain exposure                 2 |    0      0.00    0.00     0.00      0
contagion sponsor chain exposure                 2 |    1      0.00    0.00     1.00      1
contagion sponsor chain exposure                 2 |    2      1.00    0.12     0.50      2
contagion sponsor chain exposure                 2 |    3      1.00    0.12     0.67      3

sector overlap sponsor chain                     3 |    0      0.00    0.00     0.00      0
sector overlap sponsor chain                     3 |    1      0.00    0.00     1.00      1
sector overlap sponsor chain                     3 |    2      0.00    0.00     1.00      2
sector overlap sponsor chain                     3 |    3      1.00    0.12     0.67      3

Epsilon (unlinked control) never surfaced at hops 0..5 — scope held.
```

### Metric definitions (pinned in `bench/graphexpansion_seed.py`)

- **recall@K** = |surfaced ∩ relevant| / |relevant| — the recall lift graph expansion provides.
- **dilution** = |irrelevant surfaced| / |surfaced| — the direct cost of widening (the 2-hop risk).
- **precision@K** = |relevant in top-K| / K — dominated here by |relevant|=1 vs K=8 (caps at 0.12 even at perfect recall), so it is NOT the load-bearing signal on this seed; recall@K and dilution are.

## Findings

1. **recall@K is monotonic non-decreasing in hops** — widening the scope can only add candidate chunks, never remove them. (Pinned by `test_graphexpansion_recall_monotonic_in_hops`.) The n-hop BFS is correct.

2. **The 2-hop recall lift is real but NARROW.** Only the genuinely-2-hop query (`contagion sponsor chain exposure`, relevant=Delta) lifts recall at hops=2 (0.00 → 1.00). The 1-hop-relevant query (`sponsor shared agreement`) gains ZERO recall from 2-hop — it was already 1.00 at hops=1. **2-hop adds recall only for questions whose evidence lives in a 2nd-degree peer.**

3. **2-hop adds DILUTION to the common 1-hop case.** For `sponsor shared agreement`, going 1→2 doubles the surfaced set (1→2 hits) with an irrelevant peer chunk (Delta matches "sponsor" but isn't relevant to Q1): dilution 0.00 → 0.50. Going 1→3 triples it: dilution 0.67. **This is the exact "diluting the pack with loosely-related peers" risk the handoff names — measurable and real.**

4. **1-hop is PURE NOISE for a 2-hop question.** `contagion sponsor chain exposure` at hops=1 surfaces Beta (matches "sponsor chain") but Beta is irrelevant — recall 0.00, dilution 1.00. The 1-hop pack is worse than no expansion here. 2-hop fixes it (recall 1.00, dilution 0.50).

5. **The hop bound holds exactly.** `sector overlap sponsor chain` (relevant=Gamma, 3-hop) recall stays 0.00 at hops=0,1,2 and only reaches 1.00 at hops=3. (Pinned by `test_two_hop_bound_does_not_reach_three_hop`.) 2-hop does not silently become unbounded.

6. **The scope holds.** Epsilon (unlinked, but its chunk mentions every query term) never surfaced at any hop count 0..5. (Pinned by `test_unlinked_issuer_never_surfaces`.) Graph expansion travels ONLY ratified edges — no unratified-peer leakage.

## Decision

**Do NOT enable 2-hop as the `retrieve_corpus` production default.** Keep
`expand_issuer_set` (and therefore `retrieve_corpus(expand_graph=True)`) at
`hops=1`. Rationale, from the numbers:

- The **common** scoped cross-issuer question is 1-hop-relevant (the analyst
  scoped to Acme asking about Acme's direct exposure). 2-hop adds **zero recall
  and 0.50 dilution** to that case — a strict regression on the pack quality
  the re-rank phase just spent precision buying.
- 2-hop's recall win is confined to **genuinely-2-hop questions** (contagion via
  a 2nd-degree peer). The synthetic seed can't tell us how often real production
  scoped queries are 2-hop-relevant — that frequency is the actual gate.
- Enabling 2-hop blindly would dilute the common case to chase the rare case.

**Instead, expose 2-hop as an explicit opt-in** for contagion-style deep
traversal, gated on a real-data measurement:

1. **Now (this phase):** `graph_neighbors` / `expand_issuer_set` support `hops>1`
   (implemented, pinned by `test_graph_neighbors_two_hop_traverses_chain` and
   `test_graph_neighbors_two_hop_handles_cycle_without_loop`). The production
   default stays `hops=1` (pinned by `test_expand_issuer_set_default_stays_one_hop`).
   The measurement harness (`bench/test_graphexpansion_recall.py`) and runner
   (`bench/run_graphexpansion_measurement.py`) are reusable — extending
   `LABELS` with production-labeled cross-issuer pairs and re-running is a
   one-place change.
2. **Next (the real gate):** collect a labeled set of production cross-issuer
   queries (from query logs + analyst feedback on missed evidence) and measure
   the 1-hop-relevant vs 2-hop-relevant frequency. If 2-hop-relevant queries are
   a material fraction AND the 1-hop dilution cost on the common case is
   acceptable, wire `hops=2` into `retrieve_corpus` behind an opt-in flag
   (e.g. `expand_graph="deep"`) — NOT as the default.
3. **Conditional alternative:** a recall-insufficiency gate — only expand to
   2-hop when the 1-hop pack yields < K relevant chunks (a cheap post-retrieval
   signal). This chases the recall win only when 1-hop is insufficient, avoiding
   dilution on the common case. Not implemented; recorded as an option.

## Red-team

Recorded in `.agent-reviews/redteam.md` as **RT-2026-07-07-17** through
**RT-2026-07-07-21** — synthetic-seed limitation, accidental-wiring prevention,
cycle safety, metric ambiguity, and the v1-cap test-gate preservation. All
Resolved.

## Open follow-on

The **real-data measurement on production cross-issuer queries** is the actual
production enable gate. Until that measurement exists and shows 2-hop-relevant
queries are a material fraction, 2-hop stays opt-in (`hops=2` via
`expand_issuer_set` directly) and the `retrieve_corpus` default stays 1-hop.
