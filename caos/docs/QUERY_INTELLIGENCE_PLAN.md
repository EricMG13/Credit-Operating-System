# Query Intelligence Plan — proactive, grounded AI research inside Query

**Status: IMPLEMENTED (Q1 + Q2 + Q3 + layout redesign). 2026-07-04.**

Shipped in-tree on `feat/query-route-fast-lane`: `engine/grounding.py` (numeric
gate), `engine/queryinsights.py` (Q1 Desk Brief), `engine/queryanswer.py` (Q2),
migrations 0024/0025, `GET /api/query/insights` + `POST /api/query/answer`,
frontend `InsightFeed`/`AiAnswer` + Query layout redesign + Q3 ambient overlay.
925 backend tests pass (py3.9 + py3.11), tsc/eslint clean, `alembic check`
drift-free for the new tables, a11y 0 violations on `/query`, verified live
end-to-end on the qa3 stack (real `deepseek-v4-pro`/`flash` grounded output),
adversarially red-teamed (no shipping defect; one numeric-pool widening fixed).
See `.agent-reviews/redteam.md` RT-2026-07-04-09..11.

_Original plan (below) preserved as the design record._
Owns pre-deployment item **D2** ("RAG answer lane in Query — own plan at
pickup") and extends it with the proactive half the user asked for on
2026-07-04: *"Query is acting like a database plus cheap analytics platform.
Where is the AI-generated research and insights? Users should not have to
prompt each time. Allow the LLM to write within Query, but all of its analysis
must be grounded in the database and marked as AI-generated."*

---

## 1. Current state (reviewed 2026-07-04, branch `feat/query-route-fast-lane`)

What Query does today:

| Layer | What exists | LLM-written prose? |
| --- | --- | --- |
| 23 capability walks | `querygraph.py` builders → graph/table/scatter/lineage views | No — deterministic |
| Synthesis line | `lib/query/synthesis.ts` templates, leads every answer | No — deterministic |
| NL routing | `/api/query/route` — free text → ≤3 capability ids + reasons, keyword fallback | Reasons only (≤12 words) |
| Model overlay | `/api/query/overlay` — citation-gated proposed edges + 2–4 sentences commentary, **behind a button**, cached by `graph_hash`, purple, print-hidden | Yes — 2–4 sentences, opt-in |
| Analyst flywheel | ACCEPT/UNDO ratifies proposed issuer↔issuer links (`query_accepted_links`) | n/a |
| NL query | `/api/query/nl` (metric screens / semantic / hybrid) — surfaced on **Command Center**, not the Query page | No — deterministic executors |
| Daily digest | `/api/digest/daily` — WARF, CCC watch, stale coverage, QA counts | No — deterministic |
| Retrieval | BM25 over `document_chunks` (`retrieval.py`, 5k scan cap) | n/a |
| Deep research | `/api/research` background jobs — **web**-facing, per-analyst, surfaced outside Query | Yes — but not in Query, and web-grounded not vault-grounded |

The user's complaint is accurate: the only LLM-written analysis on the Query
surface is the overlay commentary — four sentences, hidden behind a button,
per-graph, print-hidden. Everything else is retrieval and deterministic
aggregation. Nothing is proactive; every interaction starts with the analyst
typing or clicking.

What is already *right* and must not regress:

- **Grounding discipline**: overlay edges are citation-gated (uncited → dropped,
  not drawn); routing is a closed-set classification; hallucinated ids filtered.
- **Fault isolation**: no LLM lane sits on the deterministic path; keyless
  deploys hide model affordances entirely (`availability.model_lane`).
- **Marking**: model content is `MODEL_HUE` purple, labeled, excluded from CSV,
  print-hidden.
- **No LLM lane has tools or writes** — the model returns data; server code
  validates and persists.

## 2. Gap analysis vs the ask

| User ask | Gap |
| --- | --- |
| "AI-generated research and insights" | No LLM-written, cited research anywhere in Query. (Vision-gap #1, plan item D2.) |
| "Users should not have to prompt each time" | Zero proactive surface. Query opens on an auto-run walk, not on anything the system *noticed*. Digest exists but is deterministic counts, not research, and lives off-surface. |
| "LLM writes within Query" | Overlay commentary is the only writing, opt-in and buried in the dock. |
| "Grounded in database" | Solved pattern exists (overlay citation gate + BM25) — needs generalizing, not inventing. |
| "Marked as AI-generated" | Solved pattern exists (MODEL_HUE + labels + export exclusion) — needs applying to new lanes. |

## 3. Approaches considered

1. **Minimal — auto-run the existing overlay on every graph.** One-day change.
   Rejected as the whole answer: commentary stays 2–4 sentences about one
   graph; nothing proactive, nothing book-level, no cited research. Kept as
   Phase Q3 polish.
2. **Recommended — three grounded lanes, phased (this plan).** (a) a proactive
   **Desk Brief** feed that greets the analyst with cited, AI-written insight
   cards generated from what changed in the book — no prompting; (b) a
   **grounded answer lane** (D2) that writes a cited paragraph for any typed
   question next to the deterministic result; (c) **ambient model commentary**
   (auto-overlay). Reuses the overlay machinery (retrieve → generate →
   validate-closed-set → persist → mark) three times. Each phase independently
   shippable.
3. **Maximal — agentic research service.** Scheduled per-issuer deep-research
   notes (web + vault), pgvector embeddings, multi-step agent loops. Rejected
   for Phase-1: query-time web fetch is a recorded policy decision
   (vision-gap #5, breaks the no-tools-on-LLM-lanes property), embeddings are
   an upgrade path already documented behind `retrieve_corpus`, and the spend
   is unbounded. Revisit post-transfer.

## 4. Recommended architecture

Three lanes, one shared discipline. Every lane follows the **overlay pattern**:

```
deterministic evidence pack (bounded reads, stable ids)
  → one LLM call (no tools, untrusted text wrapped, presets-tiered)
  → closed-set validator (unknown ids / uncited claims / unverifiable numbers DROPPED)
  → persisted artifact (model id + fingerprint + payload, cached)
  → rendered with AI-GENERATED marking (MODEL_HUE, chip, excluded from CSV/print)
```

### Q1 — Desk Brief (the proactive lane; the core of the ask)

**What the analyst sees:** Query opens with a "DESK BRIEF — AI-GENERATED"
panel above the answer canvas: 3–8 compact cards, each a headline + ≤2
sentences + evidence chips + an optional "OPEN WALK →" deep-link that runs the
relevant capability (with issuer/theme pre-filled). Cards read like a desk
morning note: *"Leverage at TransDigm moved +0.4x while coverage thinned; two
open QA findings touch the same module"* — every clause traceable.

**Generation trigger — no cron needed (Phase-1 single process):**
`GET /api/query/insights` returns the latest persisted brief instantly. If the
brief is stale (>24h) **and** the data fingerprint changed **and** the model
lane is available, a background regeneration starts (single-flight
`asyncio.Lock`, same pattern as create-run); the response carries
`refreshing: true` and the UI pulses. First visitor of the day pays one LLM
call; everyone else reads the cache. The endpoint stays cron-compatible for
Phase-2.

**Evidence pack (all existing deterministic reads, bounded):**
- digest payload (WARF, band, CCC watch, stale coverage, QA counts, 24h activity)
- per-issuer metric deltas: latest vs prior complete run on the canonical
  KPIs (leverage, interest coverage, EBITDA margin) from the metric-fact store
- open QA findings by severity (the `open-findings` walk's read)
- documents + analyst memos added in the window
- recently accepted analyst links
Each entry gets a stable id; chunk-shaped entries reuse the existing
`m:`/`c:`/`f:`/chunk id namespace so evidence chips resolve through the
existing `GET /api/query/chunk/{id}` viewer. Pack entries that aren't
chunk-resolvable (deltas, digest aggregates) carry their figures inline in the
pack and ground via the numeric gate below; their click-through is the card's
walk deep-link (a delta card links `metric-trend` for that issuer/metric, a
digest card links the relevant watch walk) so "one click from evidence" holds
for every card kind.

**Validator (fail-closed):**
- every card must cite ≥1 evidence id from the pack; unknown ids → card dropped
- **numeric grounding gate**: every numeral in card text must appear in the
  cited pack entries (formatting-tolerant: separators stripped, 1-dp rounding);
  unverifiable number → card dropped (same class as the CP-5 finding gates)
- `capability_id` deep-links filtered to the enabled registry (overlay pattern)
- all cards dropped → brief degrades to deterministic digest highlights,
  labeled as such — the panel never fabricates and never blocks the page

**Persistence:** `query_insights` (mig 0024): id, generated_at, model,
data_fingerprint, payload JSON, analyst_id NULL (book-level in Phase-1).
Fingerprint = hash over digest counts + latest-complete-run ids + doc/memo
counts — unchanged book ⇒ zero LLM spend on refresh.

**Fault isolation:** background task; exceptions logged, previous brief stays
served (deterministic-fallback pattern). Keyless deploy ⇒ panel hidden via the
existing `availability.model_lane` flag.

### Q2 — Grounded answers (item D2)

**What the analyst sees:** typing a question into the Query command bar still
routes to a walk (existing). Now the answer block renders, under the
deterministic synthesis line: an "AI ANSWER — model, timestamp" paragraph (≤5
sentences) with citation chips, written from retrieved vault chunks + the
walk's graph payload + matching metric facts. Deterministic sentence first —
the synthesis-first mandate holds; the AI paragraph is additive and marked.

**Endpoint:** `POST /api/query/answer {question, capability_id?, issuer_id?}`
→ retrieve (`retrieve_corpus`, k≈12) + slim graph + metric facts → one HEAVY
call → validator: each sentence-level claim must cite ≥1 valid chunk/node/fact
id (uncited sentences dropped); numeric gate as in Q1; empty result → pane
shows "model answer unavailable — deterministic result unaffected".
Persisted + cached in `query_answers` (mig 0025) keyed by
(normalized-question hash, data fingerprint) so repeat questions are free.
Rate limit: the existing `_QUERY_MAX_PER_MINUTE` bucket.

This also closes vision-gap #2 halfway: the Query box gains a real answer
without merging the Command-Center `/nl` box (deferred, §7).

### Q3 — Ambient commentary (polish)

- Auto-request the overlay when a graph renders and the lane is available:
  cached (`graph_hash`) → instant; uncached → one background call, silent skip
  on 429/failure. The button becomes show/hide + force-refresh.
- Promote overlay commentary out of the dock: render it under the AI answer
  slot with the same marking, so every graph carries model observations
  without a click.
- Feed → walk deep-links and suggested-walk chips unified under the answer
  header.

## 5. Cross-cutting rules (all three lanes)

- **Marking**: `MODEL_HUE` accent, "AI-GENERATED" chip, model id + timestamp
  visible. Excluded from CSV export and `QueryPrintSheet` (existing committee
  posture: AI text is unratified working material; the ratification path for
  durable artifacts remains the analyst flywheel). React text rendering only —
  no HTML injection surface.
- **Safety**: prompts built with `llm_safety` (`wrap_untrusted`,
  `UNTRUSTED_RULE`, `loads_finite`); untrusted = chunk/memo text; every new
  call site registered in `test_llm_safety._REVIEWED_LLM_CALL_SITES`; no tools,
  no writes from the model — server code persists validated payloads only.
- **Fault isolation**: every lane keeps one of the three recorded patterns
  (deterministic fallback here); a timeout/5xx can never abort or degrade the
  deterministic Query surface. 120s `caos_llm_timeout_s` inherited.
- **Model tiers**: through `presets` — brief + answer = HEAVY, routing stays
  LIGHT; TEST/LITE/BALANCED/MAX modes apply unchanged; tests mock the client
  exactly like `test_queryoverlay`.
- **Spend bounds**: brief ≤1 call/24h/book (fingerprint-gated, force is
  rate-limited); answer ≤1 call per novel question (cache); overlay unchanged
  (≤10/min). Keyless ⇒ zero calls, zero affordances.
- **Phase-1→2 boundary**: single-flight lock and rate limits assume one
  process (recorded boundary); Phase-2 multi-worker needs a DB advisory lock —
  noted, not built now.

## 6. Work plan

| Phase | Size | Backend | Frontend | Tests |
| --- | --- | --- | --- | --- |
| **Q1 Desk Brief** | L | mig 0024; `engine/queryinsights.py` (pack builder, prompt, validator, single-flight); `GET /api/query/insights` (+`force`) | `InsightFeed` panel on Query page (collapsible, evidence chips → chunk viewer, OPEN WALK deep-links, AI marking) | validator drops unknown-id/unverifiable-number cards; fingerprint cache = no second call; keyless hides panel; generation failure serves prior brief; call-site registration |
| **Q2 Grounded answers** | L | mig 0025; `engine/queryanswer.py`; `POST /api/query/answer` | AI-answer slot under the synthesis line in the answer header; citation chips | citation gate drops uncited sentences; numeric gate; cache; fallback pane; safety registration |
| **Q3 Ambient** | M | — | auto-overlay on render (cached-first, silent-skip), commentary promoted beside answer, walk chips | overlay auto-fire respects 429/absence; no keyless regression |

Sequencing: Q1 first — it answers the actual complaint (proactive, no
prompting). Q2 second (already committed as D2). Q3 last (one-day polish).
Each phase lands with the standard gates: pytest suites green (py3.9 + py3.11),
`tsc`/eslint clean, `alembic check`, migration round-trip, GitNexus impact on
touched symbols, red-team log updated.

**Exit gate for the epic:** Query opens with a cited, AI-written brief already
present (warm cache <1s); any typed question yields a cited AI answer beside
the deterministic result; every AI sentence is visibly marked and one click
from its evidence; keyless deploys render today's deterministic surface
pixel-identically; zero new LLM failure mode can abort a run or a page.

## 7. Deferred / open decisions (flagged, non-blocking)

1. **One-box unification** — merging Command-Center `/nl` (metric screens)
   into the Query bar. Deferred: separate IA decision, not needed for the ask.
2. **Print/committee posture for AI text** — this plan keeps AI content out of
   print/CSV (consistent with the 07-02 overlay decision). If the user wants
   briefs/answers *in* exhibits, add an explicit "include model commentary —
   AI-GENERATED" toggle later; the marking machinery already supports it.
3. **Per-analyst briefs** — Phase-1 brief is book-level (one per day for the
   desk). Per-analyst scoping (watchlists) is a Phase-2 personalization.
4. **pgvector embeddings** — documented upgrade behind `retrieve_corpus`
   (vision-gap #4); BM25 is sufficient at Phase-1 corpus scale.
5. **Analyst memos in retrieval** — memos are vault-only today (not chunked
   into `document_chunks`), so Q2 answers won't cite them until the recorded
   follow-up (chunk memos at upload) lands; small, independent item.
