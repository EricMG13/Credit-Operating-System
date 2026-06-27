# Phase-2 Scope — Command Center & Monitor (Bucket C of the mock→engine epic)

**Date:** 2026-06-27. **Status:** scoping only (no code). Companion to
[AUDIT.md](AUDIT.md) (A-1, Bucket C) and the mock→engine map.

The per-issuer analytical surfaces (Deep-Dive, Pipeline, Model Builder) are wired
or wire-ready off the live CP-X run. The two surfaces with **no engine backing**
are the **Command Center portfolio board** and the **Monitor** (CP-MON email/alert
feed). Both are cross-issuer / continuous-monitoring concerns that the per-issuer,
on-demand run pipeline doesn't produce today. This doc scopes what each needs,
splitting **buildable-in-isolation** from **external-feed-bound** (the gating
distinction for Phase-2 planning).

## A. Command Center — portfolio posture board

**Today (pure mock):** [command/page.tsx](../frontend/src/app/command/page.tsx) →
`PortfolioTable` ([views.tsx](../frontend/src/components/command/views.tsx)) reads
the seeded `PORTFOLIO` rows ([lib/command/data.ts](../frontend/src/lib/command/data.ts)).
Row shape: `code, name, sector, rating, inst, px, margin/dm/dd (spreads), lev,
cov, m2e, posture, conv, qa, alerts, watch, spark`. The page already labels itself
"Sample portfolio — not live."

**Reusable today (per-issuer → aggregate):**
- Runs are persisted per issuer; `metric_facts` ([database.py](../server/database.py),
  written at [runner.py](../server/engine/runner.py) post-run) holds headline KPIs
  (net_leverage, interest_coverage, revenue, adj_ebitda) **with citations**.
- NL query ([nlquery.py](../server/nlquery.py)) already scans `metric_facts`
  **across issuers** and ranks — the cross-issuer aggregation primitive exists.
- `run.qa_status` / `committee_status` per run; `Issuer.industry` for sector.
- CP-3 RV recommendation + CP-2B fragility are derivable per latest run.

**Gap list:**
| Gap | Build? | Effort | Note |
|---|---|---|---|
| `GET /api/portfolio` — latest-run rollup across issuers (metrics + qa + posture) | **Buildable** | ~2–3 d | one latest-run-per-issuer query + `metric_facts` join |
| Portfolio sleeve membership (issuers are a flat list) | **Buildable** | ~Med (schema) | new `PortfolioMembership` or `Issuer.sleeve_id` |
| Posture / conviction (analyst-owned; no module emits it) | **Buildable** | ~Med | heuristic from CP-3 RV band, or a small analyst-annotation table |
| QA status / leverage / coverage / sector | **Buildable** | ~1 d | already in `metric_facts` / run / issuer |
| **Live market spreads (DM, Δ d/d, price, M2E)** | **External feed** | weeks | Bloomberg/Refinitiv/LPC pricing — the "not live" fields |

**Verdict:** a **"live but incomplete"** board is buildable in ~1 week off
existing runs + `metric_facts` (leverage/coverage/qa/posture-heuristic). The
spread columns (DM/Δ/M2E) are **external-feed-bound** and the real Phase-2 cost.

## B. Monitor — CP-MON email-intel / alert feed

**Today (pure mock):** [monitor/page.tsx](../frontend/src/app/monitor/page.tsx)
runs an **offline sim** (`useSimRun`); `EmailIntel` + `AlertFeed`
([views.tsx](../frontend/src/components/command/views.tsx)) read seeded `EMAILS`
/ `ALERTS` (data.ts). Email shape: `t, src, subj, issuer, signal, mat, sev,
route, dedup, from/to/body`. Alert shape: `sev, issuer, code, text, route`.

**Reusable today:** the analytical run already emits *per-run findings* that are
alert-shaped — CP-1B `monitoring_finding` (declining revenue/EBITDA,
[earnings.py](../server/engine/earnings.py)) and CP-1C `peer_outlier_finding`
([peers.py](../server/engine/peers.py)). These are deterministic run outputs, not
a continuous feed, but they **promote cleanly to alerts**.

**Gap list:**
| Gap | Build? | Effort | Note |
|---|---|---|---|
| `Alert` table + `GET /api/alerts` + resolve endpoint | **Buildable** | ~1–2 d | straight CRUD + dedup (~100 LOC) |
| Promote CP-1B / CP-1C findings → Alert rows | **Buildable** | ~1–2 d | reuse existing finding machinery |
| Watch loop (scheduled re-run / threshold-crossing → alert) | **Buildable (skeleton)** | ~3–4 d | new scheduler; needs a trigger source to be useful |
| Email/news classifier (body → issuer/signal/materiality/route) | **Buildable** | ~2–3 d | LLM lane (Claude) + rule fallback |
| **Inbound email webhook / news API** | **External feed** | weeks | mail gateway + news vendor (Refinitiv/Bloomberg) + entity resolver |
| **Real-time pricing → trigger re-runs** | **External feed** | weeks | same pricing dependency as §A |

**Verdict:** a **finding-driven** alert feed is buildable in isolation (~1 week):
`Alert` table + endpoint + promoting CP-1B/CP-1C findings + a metric-threshold
watch loop over `metric_facts`. The **inbound email/news stream** (the mock's
headline feature) is **external-feed-bound** (vendor + IT) and out of scope for a
pure backend build.

## Recommended Phase-2 sequencing
1. **Portfolio board v1** (buildable, ~1 wk) — `GET /api/portfolio` off latest
   runs + `metric_facts`; ship "live but incomplete," keep the "not live" label on
   the spread columns only.
2. **Alert backbone** (buildable, ~1 wk) — `Alert` table + endpoint + promote
   CP-1B/CP-1C findings; wire `AlertFeed` to it; metric-threshold watch loop.
3. **External feeds** (vendor-gated) — pricing (fills DM/Δ/M2E + price-trigger
   re-runs) and email/news ingestion (fills the inbound intel stream). These are
   procurement + integration projects, not engine work — align with the S-4
   multi-user / entitled-data gate (see AUDIT S-4).

**One-line read:** ~2 weeks of buildable backend gets both surfaces *partly* live
off existing runs/findings; the headline mock features (live spreads, inbound
email/news) are **external-data-feed projects**, correctly Phase-2.
