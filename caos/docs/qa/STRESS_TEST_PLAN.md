# CAOS Stress Test Plan

**Goal:** overload every surface — the 5 concepts, the API, the CP-X engine, the
external lanes, and the deploy/auth layer — catalogue what breaks, and rank the
patches. This is a *break-it-on-purpose* plan, not a perf-tuning plan: we want
the failure modes, not the p99.

Drafted 2026-06-26 from a full code-surface map. Every "suspected weak point"
below is a real finding from the map with a file pointer; the tests exist to
**confirm and reproduce** them (and surface unknowns), so each one becomes a
patchable ticket.

---

## 0. How to run this safely

The whole point is to push the app into failure, so do it on the **isolated QA
stack**, never the user's live `:8000` / `caos.db`.

| Knob | Use | Why |
|------|-----|-----|
| Backend | `:8010`, `.venv311`, `caos_qa.db` | isolated; resettable; prod-parity deps |
| Frontend | `:3010` (`qa-frontend` preview config) | leaves user's `:3000` alone |
| `SESSION_SECRET` | **fixed** value | else every backend restart force-logs-everyone-out mid-test |
| Anthropic | **mock server** (§4), not the real key | don't burn tokens/$ ; lets us inject 429/529/hang deterministically |
| EDGAR | mock / Toxiproxy, **not** live SEC | real SEC blocks abusive UA; we only need *our* behaviour under latency/error |
| DB | snapshot `caos_qa.db` before destructive runs | the GDPR-delete and queue tests mutate/erase rows |
| HMR | `preview_stop` + `preview_start qa-frontend` if the dev bundle wedges | rapid edits wedge `:3010` globally (known) |

**Tooling — all free/OSS** (honours the no-paid-services constraint):

- **locust** (`pip install locust`) — HTTP load & concurrency, Python so it matches the stack. Primary driver.
- **oha** / **hey** — one-line blasts at a single endpoint for quick checks.
- **Toxiproxy** (Shopify, OSS) — sit between app↔Postgres and app↔{EDGAR,Anthropic} to inject latency, slow-close, and connection drops.
- **Mock Anthropic** — ~30-line FastAPI app returning canned / 429 / 529 / sleep(∞); point `ANTHROPIC_BASE_URL` at it.
- **Playwright + CDP trace** — already in the repo; drive the 5 concepts with seeded huge datasets, capture long-tasks + JS heap.
- **seed script** — stuff `caos_qa.db` with N issuers / fat runs / many evidence items for the render tests.

Severity rubric: **CRIT** = whole app down for all users · **HIGH** = subsystem DoS, money, or data loss · **MED** = one session degraded but recovers · **LOW** = cosmetic or needs extreme input.

---

## 1. Backend API — load & abuse (`S-API-*`)

| ID | Target / how to overload | Suspected weak point | Expected break | Sev |
|----|--------------------------|----------------------|----------------|-----|
| S-API-01 | `POST /api/runs/{id}/report` — hammer 100 rps, one valid run | **no rate limit**; re-assembles all modules+claims+evidence into Markdown each call (`routes/runs.py`) | CPU spike, event-loop stall, slow for everyone | HIGH |
| S-API-02 | `DELETE /api/auth/profile` — loop on a seeded analyst with many runs/docs | **no rate limit**; multi-table DML (delete ResearchJobs, anonymise Runs+Documents, delete Analyst) (`routes/auth.py`) | long write txn, lock contention, possible partial-erase under concurrency | HIGH |
| S-API-03 | `GET /api/runs/{id}/modules/{mid}` — fan out across a run with 20 modules × many claims | **no rate limit**, N+1 (module → claims → evidence as separate queries) (`routes/runs.py`) | query amplification, pool pressure | MED |
| S-API-04 | `GET /api/runs?limit=1000` — repeat with thousands of seeded runs | **no rate limit**, order_by created_at, no detail eager-load | slow list, memory churn | MED |
| S-API-05 | `POST /api/chat/issuer` — max payload (60k chars total, 32 msgs) × rate-limit ceiling (10/min) | LLM call with **no explicit Anthropic timeout** (httpx default ~10min) | a hung upstream holds the handler; stacked calls eat the event loop | HIGH |
| S-API-06 | `POST /api/query/nl` & `POST /api/scenario/nl` — 500-char inputs at 20/min | LLM plan/translate, **no explicit timeout** | same hang-holds-handler as S-API-05 | HIGH |
| S-API-07 | `POST /api/ingestion/upload/document` — a 250 MB PDF, and a *pathological* PDF (deep nesting / decompression bomb) | 250 MB cap exists, but **no timeout on pypdf parse** (off-thread; saturates the bounded threadpool) | threadpool slots exhausted → async handlers starve | HIGH |
| S-API-08 | Rate-limit evasion — spray `X-Forwarded-Email` / `X-Forwarded-For` to mint unique limiter keys | in-memory limiter, **4096-key hard ceiling, evicts oldest** (`rate_limit.py`) | legit users' windows evicted; per-IP login cap bypassed (global 30/min becomes the only wall) | HIGH |
| S-API-09 | `GET /api/issuers/?limit=2000&q=` — repeat with many seeded issuers + 1-char substring | `ilike` substring scan, limit 2000 | slow scan, no index on search | MED |
| S-API-10 | Slowloris-style: open many connections, trickle bodies | single uvicorn worker, **no `limit_concurrency`** | connection table fills, app unresponsive | MED |

---

## 2. The 5 concepts — frontend render & memory (`S-UI-*`)

**Headline finding: zero virtualization anywhere.** Every list/grid `.map()`s the
full array. So all of these are "feed it a big dataset and watch the main thread
die." Drive with Playwright after seeding the QA DB.

| ID | Concept / target | Suspected weak point | Expected break | Sev |
|----|------------------|----------------------|----------------|-----|
| S-UI-01 | **Command Center** — seed 500+ issuers | `PortfolioTable` renders every row, 16-col grid + sparklines, no windowing (`command/views.tsx`) | multi-second render, scroll jank, tab freeze | HIGH |
| S-UI-02 | **Command Center** — run the sim 30+ min | `AlertFeed` + `sim.events` grow unbounded (`Math.floor(tick/5)+2`/tick), never pruned | linear memory growth → tab OOM | HIGH |
| S-UI-03 | **Pipeline** — long sim, watch `EventLog` | events array never truncated (`pipeline/views.tsx`) | DOM thrash each tick, leak | HIGH |
| S-UI-04 | **Deep-Dive** — open a run with 20 modules × 50+ evidence each | `useLiveRun` fires **20 parallel module fetches on mount** + indexes all `liveEvidence` unbounded | thundering-herd on backend per page-open; heavy client index | HIGH |
| S-UI-05 | **Deep-Dive** — IssuerChat 100+ turns | history in `localStorage`, no prune; `caosChatContext()` serialises *all* module outputs (~100KB) per message | localStorage quota blown, slow sends | MED |
| S-UI-06 | **Model Builder** — quarters toggle, scrub assumptions fast | 40×12 `Sheet` grid, no virtual scroll; every cell edit / driver scrub rebuilds + re-highlights whole grid, **no debounce** (`model/ModelSheet.tsx`) | input lag, dropped frames | MED |
| S-UI-07 | **Model Builder** — spam cell overrides | `overrides` dict persisted to localStorage on every keystroke | localStorage write storms, quota risk | MED |
| S-UI-08 | **Report Studio** — many sections + edits | `ReportDoc` renders all sections, portaled + CSS-zoom; edits per-path in localStorage | slow render/print, quota | LOW |
| S-UI-09 | **Any concept** — kill the session mid-fetch (revoke cookie) | **no 401 interceptor**; RequireAuth only gates on mount | request rejects, user stuck on `Loading…` forever | HIGH |
| S-UI-10 | **Command Center** — NL query result with 50+ issuers / 100+ excerpts | results `.map()` full arrays inside a fixed-height box, no pagination (`command/NlQuery.tsx`) | heavy render on result | LOW |

---

## 3. Engine / CP-X orchestrator (`S-ENG-*`)

Point the engine at the **mock Anthropic** so we can inject failure for free.
One full live run ≈ **10–23 LLM calls**, 0–1 EDGAR fetch, ~9 retrievals; concurrency is
**2 runs × 4 synth = up to 8 concurrent Anthropic calls**.

| ID | Target / how to overload | Suspected weak point | Expected break | Sev |
|----|--------------------------|----------------------|----------------|-----|
| S-ENG-01 | Submit runs faster than 2 drain (e.g. 50 in a burst) | run queue has **no backpressure, no per-user cap** (only `caos_run_concurrency=2`) | queue grows unbounded → memory + indefinite wait | CRIT |
| S-ENG-02 | Mock Anthropic returns sustained 429/529 | **one-shot fallback to Sonnet, no exponential backoff** (`llm_client.py`) | modules silently gate; run "completes" degraded with no loud signal | HIGH |
| S-ENG-03 | Mock Anthropic `sleep(∞)` on one call | **no explicit SDK timeout** | run holds a slot for ~10min (httpx default); with 2 slots, throughput → 0 | HIGH |
| S-ENG-04 | CP-1 on a mega-filer (Walmart-class XBRL, 1–5 MB facts JSON) | parse is one `asyncio.to_thread` with **no timeout**, loads whole JSON to RAM (`edgar_cp1.py`) | threadpool slot blocked, memory spike | HIGH |
| S-ENG-05 | Seed an issuer with 10k+ chunks, run it | BM25 index scored **9× per run** (one per retrieving module), O(chunks × modules) | retrieval latency balloons, run slows | MED |
| S-ENG-06 | Drive a run to the 120k token budget early (huge grounding) | late modules hit `llm_allowed()=False` and **gate silently** (`budget.py`) | run finishes with missing modules, no obvious error | MED |
| S-ENG-07 | Kill the worker mid-run (SIGKILL) | **no checkpoint**; full re-run from CP-0 on re-claim; orphan stuck up to lease×attempts = **~30 min** | wasted recompute; long stuck "running" | MED |
| S-ENG-08 | Two concurrent `POST /runs` same issuer | dedup via **per-process `_CREATE_RUN_LOCK`** only (not a DB constraint) | fine single-process; **double-run if ever multi-replica** | LOW |

---

## 4. External dependency failure injection (`S-EXT-*`)

Use Toxiproxy + the mock servers. This is where "what breaks when the outside
world misbehaves" lives — the most under-tested area.

| ID | Inject | Against | Expected break | Sev |
|----|--------|---------|----------------|-----|
| S-EXT-01 | latency 30s+ then slow-close | Anthropic | confirms S-ENG-03 / S-API-05 hang; measure how long a slot/handler is held | HIGH |
| S-EXT-02 | 429 / 529 storm | Anthropic | confirms S-ENG-02 silent-gate; check the run is *marked* degraded, not "ok" | HIGH |
| S-EXT-03 | latency + connection reset | EDGAR | EDGAR has **no retry/backoff** (`edgar.py`); CP-1 should degrade to LLM/reported — verify it does, not crash | MED |
| S-EXT-04 | EDGAR returns 25 MB+ exhibit | `vault-exhibit` | 25 MB cap exists, but **no timeout on the text-extraction subprocess** | MED |
| S-EXT-05 | Postgres: latency + drop connections mid-txn | DB | pool is default 5+10; verify graceful 503 vs. cascade failure; check the GDPR-delete txn doesn't half-commit | HIGH |
| S-EXT-06 | ClamAV: refuse connection / timeout | upload lane | should **fail-closed → 503** (by design); confirm it doesn't crash-loop or swallow | MED |

---

## 5. Infra / auth / deploy (`S-INFRA-*`)

| ID | Target / how to overload | Suspected weak point | Expected break | Sev |
|----|--------------------------|----------------------|----------------|-----|
| S-INFRA-01 | One CPU-heavy request (S-API-07 / S-ENG-04) + concurrent reads | **single uvicorn worker, single event loop** | any sync/threadpool stall freezes *all* users | CRIT |
| S-INFRA-02 | Ramp concurrent HTTP to hundreds | **no `limit_concurrency`**, Postgres pool ~15, `max_connections` 100 | pool exhaustion → request pile-up → app 2 GB mem limit → OOM kill | HIGH |
| S-INFRA-03 | Login flood from rotating IPs | per-IP 10/min is **spoofable off-proxy**; real wall is global **30/min** | either legit lockout (global cap) or bypass (key-spray, see S-API-08) | MED |
| S-INFRA-04 | Sustained upload load | app mem 2 GB, parse off-thread but bounded pool | OOM under enough concurrent large parses | MED |
| S-INFRA-05 | Fill the run queue (S-ENG-01) then restart app | SQLite InProcessExecutor sweeps orphans on boot; Postgres re-claims | verify no run lost / double-executed across restart | MED |
| S-INFRA-06 | Concurrent logout same analyst | token_version **lost-update race** (`auth.py`) | small window: one extra valid session survives revoke | LOW |

---

## 6. Cross-cutting input abuse / fuzz (`S-FUZZ-*`)

| ID | Vector | Expected | Sev |
|----|--------|----------|-----|
| S-FUZZ-01 | Oversized / boundary inputs on every Pydantic field (1 over each `max_length`, empty, unicode, null bytes) | clean 422, no 500 | MED |
| S-FUZZ-02 | Malformed magic bytes (PDF that isn't, XLSX zip-bomb) | rejected at sniff, not parsed | MED |
| S-FUZZ-03 | Attacker-controlled `exhibit_url` on `vault-exhibit` (SSRF: internal IPs, `file://`, redirects) | must be blocked / allow-listed to SEC | HIGH |
| S-FUZZ-04 | Injection-style NL query / scenario / chat text (prompt-injection, huge repetition) | bounded, no tool/write escalation (known property: no LLM lane has tools) | MED |
| S-FUZZ-05 | Unicode / path-traversal in upload filename | sanitised to `[A-Za-z0-9._-]` — confirm | LOW |

---

## 7. Patch backlog — what the map already says will break

Ranked. These don't strictly need a test run to start fixing; the tests confirm
+ regression-guard them.

**CRIT**
1. **Single worker / single event loop** — any sync or threadpool-saturating work freezes every user. *Fix:* multiple uvicorn workers, hard threadpool caps + timeouts on parse, move heavy CPU off the request path. (S-INFRA-01, S-API-07, S-ENG-04)
2. **Unbounded run queue, no backpressure / per-user cap** — submission can outrun the 2-wide executor forever. *Fix:* cap queue depth, reject/429 when full, per-analyst inflight cap. (S-ENG-01)

**HIGH**
3. **No explicit Anthropic timeout** anywhere (chat, nlquery, scenario, deepresearch, engine synth) — a hung upstream holds a slot/handler ~10 min. *Fix:* set `timeout=` on the SDK client / per-call. (S-API-05/06, S-ENG-03)
4. **No exponential backoff on 429/529** — one-shot fallback, then silent module gate. *Fix:* bounded retry w/ jitter; mark run *degraded* loudly. (S-ENG-02)
5. **Zero frontend virtualization** — every table/grid/feed renders the full array; long sims + big datasets freeze or OOM the tab. *Fix:* windowing (`react-window`/`@tanstack/virtual`) on PortfolioTable, Sheet, EventLog, AlertFeed, evidence; cap+prune the unbounded `sim.events`/alerts/chat. (S-UI-01..05)
6. **Expensive endpoints with no rate limit** — `report`, `DELETE profile`, `modules/{id}`. *Fix:* add limits; eager-load to kill the N+1. (S-API-01/02/03)
7. **Rate limiter key-sprayable + 4096 ceiling** — evict legit windows, bypass per-IP login. *Fix:* limit on a trusted key, not client-supplied headers; cap header trust to the edge. (S-API-08, S-INFRA-03)
8. **No 401 interceptor on the client** — session loss mid-fetch = permanent `Loading…`. *Fix:* axios response interceptor → re-auth / surface error. (S-UI-09)
9. **No timeout on EDGAR-XBRL parse / pypdf / extraction subprocess** — mega-filer or pathological file blocks a threadpool slot. *Fix:* wrap each in a timeout. (S-ENG-04, S-API-07, S-EXT-04)
10. **`vault-exhibit` SSRF surface** — attacker-supplied URL fetched server-side. *Fix:* allow-list SEC hosts, block internal/redirect/`file://`. (S-FUZZ-03)

**MED**
11. Silent token-budget gate — surface "ran out of budget, N modules skipped". (S-ENG-06)
12. Orphaned run stuck ~30 min on worker death — shorter lease or active health-check. (S-ENG-07)
13. DB pool default 5+10 with single worker — size it deliberately + graceful 503 on exhaustion. (S-INFRA-02, S-EXT-05)
14. Deep-Dive 20-fetch thundering herd on mount — batch into one endpoint or stagger. (S-UI-04)
15. localStorage unbounded (chat/overrides/edits) — prune + quota-guard writes. (S-UI-05/07)

**LOW**
16. token_version logout race (S-INFRA-06) · per-process-only run dedup if ever multi-replica (S-ENG-08) · filename sanitisation confirm (S-FUZZ-05).

---

## 8. Execution order & exit criteria

1. **Seed** the QA DB (issuers, fat runs, evidence) + stand up mock Anthropic + Toxiproxy.
2. **§4 external-dep** first — cheapest signal, most under-tested, no real-token cost.
3. **§3 engine** queue + budget + worker-kill.
4. **§1 API** load + abuse.
5. **§2 UI** render/memory via Playwright.
6. **§5 infra** concurrency ramp until OOM / pool exhaustion (the destructive finale).
7. **§6 fuzz** alongside everything.

**Exit:** every CRIT/HIGH in §7 either reproduced-and-ticketed or proven-not-a-problem. Each confirmed break → a patch ticket with the file pointer above + the repro recipe.

---

## 9. Harness — not built yet

This is the plan only. The runnable harness (locust file, mock-Anthropic app,
Toxiproxy config, seed script, Playwright render-trace specs) is the next step —
say the word and I'll scaffold it under `caos/tests/stress/`, lazy version first
(locust + mock + seed cover ~80% of the above).
