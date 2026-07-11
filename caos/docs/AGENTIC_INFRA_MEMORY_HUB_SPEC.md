# Agentic Infrastructure & Memory Hub — Build Specification

**Status:** design-complete, ready to implement. **Consumer:** Fable 5 (or
equivalent) coding directly from this document — no orchestration code is
included here; every code block below is a **target shape to implement**, not
a snippet already in the repo. **Author's stance:** this is a *consolidation*
of code that already exists in `caos/server/`, not a greenfield design. Every
decision below carries a `Grounding:` line citing the file:line it is built
on; a decision with no such citation is marked **`FLAG: ungrounded`** and must
not be treated as verified fact.

**Scope boundary:** design and interfaces only. Concrete rate figures in §6
were fetched from public pricing pages this session (dated per figure) — an
implementer must re-verify them against the provider's current pricing page
before wiring real billing, because these numbers drift.

## 0.1 Relationship to existing docs

- **Amends** `caos/docs/OBSIDIAN_DATABANK.md` — that document's closing
  statement ("Two-way sync — never; the vault is derived") is superseded by
  §9.1 below. The amendment is narrow: only the two *file-canonical* families
  (`analyst-memo`, future `source-document`) gain a read path; `credit-run` and
  `issuer` stay exactly as documented (CAOS-canonical, one-way, ignored by the
  new watcher).
- **Extends** `caos/docs/PDF_INGESTION_OKF_BLUEPRINT.md` — that blueprint's
  Stage 4–6 "must not fork" mandate (embedding model, `(model, chunk_hash)`
  key, chunk recipe) is the same mandate §10.3 restates for the sync lane; the
  two documents must never diverge on that point. §13 resolves a migration
  **number collision**: this spec claims `0034`/`0035`; the OKF blueprint's
  reserved `0034_okf_notes.py` renumbers to `0036` if these two build in the
  order given here (spec-writer's call — the two work orders have not yet been
  sequenced against each other).
- **Corrects** two defects discovered while grounding this spec, both
  pre-existing and unrelated to the three workstreams, both worth fixing in
  the same PR because the touched files overlap:
  1. `engine/budget.py:127-138` prices every non-Anthropic, non-Gemini-1.x
     model at Sonnet rates (see §6.1 for the exact bug).
  2. **Critical, found during pricing research (§6.2), not part of the
     original ask:** `config.py:105` defaults `embedding_model` to
     `"text-embedding-004"`, which Google retired **2026-01-14**. If
     `GEMINI_API_KEY` has been set in any deployed environment since that
     date, every live embedding call has been failing and — per the exact
     defect this spec's §9.8 fixes — silently persisting **mock vectors under
     the label `text-embedding-004`** into `document_chunk_embeddings`,
     indistinguishable from real ones under the current schema. **Action
     required before implementing anything else:** check whether
     `GEMINI_API_KEY` was set in production after 2026-01-14; if so, the
     vector corpus needs an audit (§9.8 also names the query). This is flagged
     here for visibility — fixing the corpus is out of scope for this spec.

---

## 1. Current-State Inventory (condensed)

Full call-site table, provider adapters, and defect list were produced by
codebase inventory this session; the load-bearing facts are restated inline
at each design decision below rather than duplicated here. Three structural
facts anchor the whole design:

| Fact | Grounding |
|---|---|
| One seam already exists and 14 of 15 reviewed LLM call sites already route through it | `engine/llm_client.py` (full file); `caos/tests/server/test_llm_safety.py:152-187` (`_REVIEWED_LLM_CALL_SITES`) |
| Four call sites bypass the seam: synth advisor (no M-2 fallback), two `.stream()` lanes, and embeddings (no trace at all, plus a live-failure defect) | `engine/synth.py:405-417`; `deepresearch.py:257-282`; `research_report.py:918-996`; `engine/embeddings.py:28-55` |
| A telemetry table (`llm_call_records`) and a cost-accrual function (`budget.trace_llm`) already exist, but the DB write is on the hot path and the cost table is wrong for the deployed default (DeepSeek/OpenRouter hybrid) | `database.py:678-696`; `engine/budget.py:112-173` |
| The Obsidian vault has a write lane already (`vault_export.py`) and one read lane (`sync_analyst_memos`, link-only); there is no watcher and no re-chunk-on-edit path | `vault_export.py` (whole file); `routes/ingestion.py:258-347` |
| Single-process deploy (no workers=, no scheduler, no `asyncio.Queue` precedent) | `run.py:17`; `caos/deploy/Dockerfile:70`; `main.py:122` (the one `asyncio.create_task` precedent) |
| No OpenTelemetry today; explicit "no external APM, by design" comment | `main.py:271-275` |

---

## 2. WS1 — Centralized Gateway

### 2.1 Target architecture

**`engine/llm_client.py` keeps its name and becomes the gateway.** Grounding:
14 files already `import` it by that name (registry test, §14.1); renaming is
pure churn for zero benefit. No new service, no new process — the gateway is
a Python module in the same FastAPI app.

| Module | Status | Role |
|---|---|---|
| `engine/llm_client.py` | **changed** | Gateway: `create`, `stream_final` (new), `create_with_tools` (new), `embed` (new). Routing, M-2 fallback, per-provider semaphores, unified retry. |
| `engine/budget.py` | **changed** | `trace_llm` slims to an O(1) enqueue (§4). |
| `engine/telemetry.py` | **new** | Bounded queue, `LLMCallEvent`, background writer, OTel init (§4–8). |
| `engine/telemetry_mask.py` | **new** | Masking (§7). |
| `engine/llm_pricing.py` | **new** | Cost matrix (§6). |
| `engine/mcp_router.py` | **new** | MCP client registry + tool loop (§3). |
| `engine/gemini.py` | **changed** | Gains `embed(texts, model)` — the raw `embed_content` call moves here from `embeddings.py:44` so every direct provider call lives in an adapter, none in a lane file. |
| `engine/embeddings.py` | **changed** | Delegates to `llm_client.embed`; live-failure defect fixed (§9.8). |
| `engine/synth.py`, `deepresearch.py`, `research_report.py` | **changed** | Bypass call sites route through the gateway (§2.3). |
| `database.py` + `migrations/versions/0034_llm_telemetry.py` | **new/changed** | Schema (§5). |
| `vault_sync.py` | **new** | Watcher + sync consumer (§9). |
| `migrations/versions/0035_vault_sync_provenance.py` | **new** | Schema (§10). |
| `caos/tests/server/test_llm_safety.py` | **changed** | Registry pattern + companion "gateway is total" test (§14.1). |

### Hot path / background boundary (the whole point of WS2, drawn once, referenced everywhere)

```
────────────────────────── HOT PATH (request or run-task coroutine) ──────────────────────────
 lane (synth, chat, council, extract, deepresearch, vault-sync re-embed, …)
   │  presets.model_for / effort_for   (existing, unchanged)
   ▼
 engine/llm_client.py            ← the ONLY file allowed to call a provider SDK's messages/embed API
   │ 1. OTel span open  — O(1); no-op tracer object when OTLP endpoint is unset (default, §8.4)
   │ 2. per-provider asyncio.Semaphore.acquire()   — backpressure, not telemetry (§2.4)
   │ 3. provider call (anthropic / gemini / openrouter adapter)
   │      └ M-2 fallback + unified backoff on overload (§2.4)
   │ 4. semaphore release; span close (status + token attrs)
   ▼
 budget.trace_llm(resp_or_None, lane, model, ms, fallback, status, error=None)
   │   O(1): ContextVar budget math (unchanged) + fixed-field `caos.llm` log line (unchanged)
   │       + uuid4() → resp.llm_call_id + telemetry.enqueue(event)      ← queue.put_nowait, never awaits
   ▼ return resp to caller — nothing below this line is awaited by the request/run
═══════════════════════════ boundary: put_nowait is the only crossing ════════════════════════
 BACKGROUND (one asyncio.Task, started in main.py lifespan, same event loop)
 engine/telemetry.py writer_loop:
   dequeue → sha256(prompt) [moved off hot path] → mask payloads (§7) → cost (§6, provider-reported
   preferred) → INSERT llm_call_records + llm_call_payloads (batched ≤32/commit)
 OTel BatchSpanProcessor (only when OTLP endpoint configured): its own daemon thread, not this loop
────────────────────────────────────────────────────────────────────────────────────────────────
```

**Net effect on hot-path latency: negative.** Two pieces of work move OFF the
hot path that are on it today — the `sha256(prompt)` (currently computed
inline at `llm_client.py:103-109`, `:151-157`, `:234-240`) and the **awaited**
`AsyncSessionLocal()` commit (currently `budget.py:152-166`, blocking every
single LLM call on a DB round-trip). The only additions are a `uuid4()` call,
a dataclass construction, and a non-blocking queue push. §12 is the full
per-step audit table; this diagram is the shape every later section refers
back to.

### 2.2 Gateway API

All four entry points live in `engine/llm_client.py`.

```python
async def create(
    client,                                # anthropic.AsyncAnthropic — caller-supplied, unchanged
    *,
    lane: str,
    model: Optional[str] = None,
    fallback_model: Optional[str] = None,
    effort: Optional[str] = None,
    betas: Optional[list[str]] = None,     # NEW: routes to client.beta.messages.create(betas=...)
    **kwargs,                              # system, messages, max_tokens, tools, tool_choice — pass-through
) -> Message
```
Signature is a **strict superset** of today's `create` (`llm_client.py:166-186`)
— the golden invariant: all 14 existing call sites in the registry (§14.1)
compile and behave identically with zero edits. `betas=` is new and additive;
omitted, behavior is byte-identical to today. When `betas` is set, no
fallback is attempted unless the caller also passes `fallback_model`
explicitly — this preserves the synth advisor's documented no-fallback
contract (`synth.py:415-417`).

```python
async def stream_final(
    client, *,
    lane: str,
    model: str,
    fallback_model: Optional[str] = None,  # default settings.synth_executor_model
    effort: Optional[str] = None,
    **kwargs,                              # max_tokens, thinking, output_config, system, tools, messages
) -> Message
```
Consolidates the two hand-rolled stream lanes (`deepresearch.py:259-282`,
`research_report.py:918-996`) — both today do exactly one
`client.messages.stream(...) as s: await s.get_final_message()` turn with a
manual overload-then-fallback branch. `stream_final` does that one turn,
inside it applies the same M-2 fallback + trace as `create`, and attaches two
attributes the two callers already read by a different name today:
`resp.caos_used_model: str` and `resp.caos_fallback: bool` (precedent for
attaching attributes to a response object: `resp.llm_call_id`,
`budget.py:169` — grep-confirmed zero readers exist yet, so this is a safe,
unused-until-now pattern to extend). Anthropic-only in v1 — a gemini/openrouter
model id raises `ValueError` (neither bypass lane ever runs on those
providers today).

```python
async def create_with_tools(
    client, *,
    lane: str,
    model: Optional[str] = None,
    fallback_model: Optional[str] = None,
    effort: Optional[str] = None,
    extra_tools: Optional[list[dict]] = None,   # structured-output tools — returned, NEVER executed
    max_tool_turns: Optional[int] = None,       # default settings.mcp_max_tool_turns
    **kwargs,
) -> Message
```
The MCP tool-execution loop (§3). **Deliberately a separate entry point, not
a branch inside `create`.** Reason: `create`'s existing `tools=` caller —
synth's forced payload tool (`tools=[tool], tool_choice={"type":"tool",...}`,
`synth.py:427-428`) — depends on receiving the `tool_use` block back
**unexecuted**: `_payload_data_from_resp` reads `block.input` straight off
that block (`synth.py:508-551`); nothing loops it back as a `tool_result`. A
loop inside `create` would try to "execute" `emit_module_payload` and break
this contract. (Verified: `queryoverlay.py` was considered as a second
example but does **not** pass `tools=` at all — its own module docstring
states "no tools and no writes" — so it is cited here only as confirmation
that today's `tools=` usage is narrow, not as a second dependent caller.)
Every existing lane stays on `create`; `create_with_tools` is a new,
opt-in surface with zero current callers (§3.5 states this explicitly).

```python
async def embed(texts: list[str], *, lane: str = "embed") -> list[list[float]]
```
Calls `engine.gemini.embed(texts, settings.embedding_model)` — the raw
`client.aio.models.embed_content` call moves out of `embeddings.py:44` into
the Gemini adapter, so every direct provider SDK call in the codebase lives in
an adapter file, never in a lane file (mirrors the existing pattern for
`gemini.call` / `openrouter.call`). Emits one telemetry event per call
(lane `"embed"`, model = the actual embedding model id). Raises on a live
failure — **no silent mock fallback at this layer**; the mock/live branch
stays in `get_embeddings` (§9.8), which is the caller.

### 2.3 Call-site migration table

| File:line | Today | Change |
|---|---|---|
| `llm.py:74`, `nlquery.py:248,315`, `scenario.py:169`, `engine/council.py:141,196`, `engine/debate.py:309`, `engine/queryanswer.py:352`, `engine/queryinsights.py:431`, `engine/queryoverlay.py:91,274`, `engine/rerank.py:79`, `engine/entailment.py:142`, `engine/llm_safety.py:131`, `engine/synth.py:420` | `llm_client.create(...)` | **No change.** Signature is a superset — this is the golden invariant the registry test (§14.1) proves mechanically. |
| `engine/synth.py:405-417` | direct `client.beta.messages.create(betas=[_ADVISOR_BETA], tools=[advisor, tool], tool_choice="any")`; direct `trace_llm` at `:417` | `llm_client.create(self._get_client(), lane=f"synth:{module_id}:advisor", model=s.synth_executor_model, betas=[_ADVISOR_BETA], max_tokens=_MAX_TOKENS, system=system_blocks, tools=[advisor, tool], tool_choice={"type":"any"}, messages=messages)`. Delete the direct `trace_llm` call — the gateway traces now. No `fallback_model` passed → no-fallback behavior preserved verbatim. |
| `deepresearch.py:257-282` | local `_final_message` helper + manual overload check + direct `trace_llm` | `msg = await llm_client.stream_final(client, lane="deepresearch", model=model, fallback_model=fb_model, max_tokens=_MAX_TOKENS, thinking={"type":"adaptive"}, output_config={"effort": preset["effort"]}, system=SYSTEM_PROMPT, tools=tools, messages=messages)`; then `model = msg.caos_used_model` (the sticky-degrade assignment the loop already does, unchanged in shape). `web_search_20260209` stays a server-side tool passed through verbatim — it is not MCP, it doesn't touch `create_with_tools`. |
| `research_report.py:918-942`, repair turn `:996` | same shape | Same replacement, `lane="research_report"`. |
| `engine/embeddings.py:28-55` | direct `client.aio.models.embed_content`; on live failure, silently returns mock vectors that `:95-108` then **persists under the real model name** (the defect) | `get_embeddings` keeps its signature (4 callers: `retrieval.py:206,360,480`, `queryanswer.py:271` — untouched). Internally it now routes the live path through `llm_client.embed`, and the failure semantics change per §9.8 (raise, don't silently mock, when a key is configured). |
| `engine/budget.py:112-173` | `trace_llm` computes cost + commits a DB row synchronously | New body, §4.2. Signature extends compatibly: `async def trace_llm(resp, *, lane, model, ms=None, fallback=False, status="success", error=None)`. The `prompt_hash` parameter is **removed** — the hash is now computed in the writer from the raw prompt captured in the event, not passed in by the caller (this is what moves the sha256 off the hot path). `resp=None` is now valid — a terminal failure (no response object at all) can still be traced with `status="failed"`. |
| `main.py:114-129` | lifespan | After the four existing executor `.start()` calls: `telemetry.init_otel(settings)`; `telemetry.start()` (same `asyncio.create_task` idiom as `run_warmup`, `main.py:122`). Shutdown order in §13.3. |
| `caos/tests/server/test_llm_safety.py:152-187` | registry | §14.1. |

**Failed-call semantics (new).** Today a terminal failure (fallback
exhausted, or a non-overload error) raises with **no row written**
(`budget.py:162` hardcodes `status="success"`). After this change, the
gateway's `except` path calls `budget.trace_llm(None, lane=lane, model=model,
status="failed", error=str(exc)[:2000])` before re-raising — closing that gap
without changing the raise-to-caller contract any lane depends on.

### 2.4 Rate limiting & unified retry

Today's picture is reactive-only: M-2 fallback + backoff-on-fallback-only
(`llm_client.py:204-230`), a `asyncio.Semaphore(synth_concurrency=4)` around
synth (`engine/runner.py:216`, config default `config.py:193`), and an
HTTP-endpoint-only fixed-window limiter (`rate_limit.py`, explicitly
documented as per-process, `rate_limit.py:4-9`) that never touches LLM calls.

**New, additive, in the gateway only:**

- Lazy per-provider `asyncio.Semaphore` (module dict `_SEMS[provider]`,
  loop-bind-safe lazy-init — same pattern already used at
  `research_executor.py:39-46`), acquired around each provider **network
  attempt** only (released before any backoff sleep, so a waiting retry never
  starves other lanes; never held across the trace/enqueue call).
- Config: `llm_max_concurrency_anthropic/gemini/openrouter: int = 8` each
  (`0` = unlimited). 8 is chosen to sit **above** today's grounded peak —
  `caos_run_concurrency=2 × synth_concurrency=4 = 8` concurrent synth calls
  (the product the config's own comment at `config.py:192` documents) — so the
  limiter is inert under current settings and only flattens a future
  pathological burst.
- Unified retry helper `_retrying(fn, classify)` replacing three divergent
  behaviors today (Anthropic: 1 primary attempt → 3 exp-backoff retries on
  fallback only, `:204-218`; Gemini/OpenRouter: 1 primary → 1 fallback
  attempt, no retry). New: primary stays 1 attempt (preserves M-2's
  fast-degrade contract); fallback gets up to `llm_fallback_max_retries: int =
  3` with backoff `min(llm_retry_cap_s, llm_retry_base_s * 2**attempt) ± 10%
  jitter` (`llm_retry_base_s=1.0`, `llm_retry_cap_s=8.0` — the constants
  already hardcoded at `llm_client.py:204`, now config-exposed). Per-provider
  overload classifiers (`is_overloaded`, `gemini.is_overloaded`,
  `openrouter.is_overloaded`) are unchanged. **Flagged behavior change:**
  Gemini/OpenRouter fallbacks go from 1-attempt to 3-attempt — strictly more
  resilient under the same classification, not a new failure mode.

---

## 3. WS1 — MCP Router

**User decision (locked):** plumbing ships; every existing lane ships with
tools **OFF**; read-only tools only in v1. This preserves the pre-prod
security posture's documented property, "no LLM lane has agentic tools or
writes," by default (see the security-implementation-spec cross-reference in
§0.1).

### 3.1 Registry config

Two JSON-in-env blobs — matches the existing pydantic-settings surface
(`config.py`) and the edgar MCP server's own env-configuration precedent
(`caos/mcp/edgar/server.py:15-18`). A TOML file was considered and rejected:
it needs a mounted-file path and a second config surface for one small object.

```python
# config.py — new settings
mcp_servers: str = ""          # JSON: {"<name>": {"command": str, "args": [str], "env": {str:str}, "tools": [str]}}
mcp_lane_allowlist: str = ""   # JSON: {"<lane>": ["<server>__<tool>", ...]}
mcp_max_tool_turns: int = 5
```

`engine/mcp_router.py`:

```python
def configured() -> bool
def tools_for_lane(lane: str) -> list[dict]              # Anthropic-shaped tool defs; names "<server>__<tool>"
async def call_tool(name: str, args: dict) -> tuple[str, bool]   # (result_text, is_error)
class MCPToolContext:                                     # AsyncExitStack over the servers one lane needs
    async def __aenter__(self) / __aexit__(self, ...)      # opened per create_with_tools() call, closed at loop end
```

- New pip dependency: the official `mcp` package (needs Python ≥3.10; image
  runs `python:3.14-slim`, `caos/deploy/Dockerfile:21` — compatible). stdio
  transport (`mcp.client.stdio`), matching the edgar server's own stdio entry
  point (`caos/mcp/edgar/server.py:103`).
- **No persistent session lifecycle.** A `create_with_tools` call opens an
  `AsyncExitStack` over the servers its lane's allowlist references, and
  closes it when the loop ends. No reconnect logic, no locks — tool lanes are
  opt-in and none are hot, so subprocess-spawn latency per call is acceptable.
- Tool naming: `edgar__edgar_search` (double underscore — dots fall outside
  Anthropic's tool-name character set).

### 3.2 Tool loop (inside `create_with_tools` only)

1. Resolve `tools_for_lane(lane) + (extra_tools or [])`.
2. Call `create(...)`.
3. While `stop_reason == "tool_use"` and `turns < max_tool_turns`: for each
   `tool_use` block —
   - if the name resolves in the MCP registry: execute via `call_tool`, wrap
     the result in `llm_safety.wrap_untrusted` (the content is untrusted
     web/EDGAR-derived text — precedent `llm_safety.py:79`), append as a
     `tool_result` block;
   - if the name is one of `extra_tools` (a structured-output tool): **stop
     the loop and return the message as-is** — this is a terminal payload
     emission, not something to feed back into another turn.
4. On hitting `max_tool_turns`: return the last message unmodified (no error
   raised — the caller decides what an unfinished tool loop means for its
   lane).

Every turn inside the loop is an ordinary `create()` call, so every turn is
individually traced, costed, semaphore-bounded, and fallback-covered for
free — nothing new to build for that.

### 3.3 Allowlist enforcement — double, default-deny

1. **Server-level:** a server's `tools` list in `MCP_SERVERS` is the entire
   executable universe for that server. A tool the server exposes but the
   config omits is invisible to the router — it is never in `tools_for_lane`
   for any lane.
2. **Lane-level:** `MCP_LANE_ALLOWLIST` maps `lane → [qualified names]`. A
   lane absent from the map gets **zero** tools. **Default `""` → every
   existing lane stays exactly as tool-free as it is today** — this is the
   mechanism that satisfies the user's locked decision.

### 3.4 Edgar plug-in (read-only v1)

```json
{"edgar": {
  "command": "python", "args": ["/app/mcp/edgar/server.py"],
  "env": {"CAOS_API_BASE": "http://127.0.0.1:8000", "CAOS_ANALYST_EMAIL": "..."},
  "tools": ["edgar_search", "edgar_issuer_filings", "edgar_list_exhibits"]
}}
```
`edgar_fetch_and_vault` is **excluded by default** — it writes to the vault
(`caos/mcp/edgar/server.py:84-99`), and v1 tools are read-only by policy.

**FLAG: deploy-side gap.** The app image today copies only the server tree.
Shipping the edgar MCP server in-container requires (a) copying
`caos/mcp/edgar/` into the image, (b) adding the `mcp` package plus that
server's own `httpx` dependency to the app's `requirements.txt` (today a
separate `pyproject.toml`, `caos/mcp/edgar/pyproject.toml:7`). This is a
required Dockerfile edit, not optional — call it out in the PR that
implements §3.

### 3.5 Safety statement

**No v1 lane calls `create_with_tools`.** The registry test in §14.1 asserts
this mechanically: any file that starts calling it must appear in a
reviewed-call-site set, exactly like the existing LLM-safety registry. The
first real consumer (a hypothetical CP-4 legal-sourcing lane) is explicitly
future work — this spec ships the seam with every default off.

---

## 4. WS2 — Telemetry Architecture

### 4.1 `engine/telemetry.py`

```python
@dataclass
class LLMCallEvent:
    lane: str
    model: str
    provider: str                    # anthropic | gemini | openrouter — from llm_client._provider()
    model_mode: str                  # presets.current_mode() at call time
    run_id: Optional[str]
    system: Any                      # raw ref, not copied — masked only in the writer
    messages: tuple                  # shallow tuple() of the message list, taken at enqueue time
    completion: Any                  # resp.content or None on failure
    usage: Any                       # resp.usage or None
    provider_cost_usd: Optional[float]
    fallback: bool
    status: str                      # "success" | "failed"
    error: Optional[str]
    ms: Optional[float]
    llm_call_id: str                 # uuid4, set on resp before enqueue
    trace_id: Optional[str]          # OTel hex, None if OTel is off
    span_id: Optional[str]

_queue: asyncio.Queue[LLMCallEvent]  # bounded, maxsize=1000
_dropped: int                        # counter, logged periodically if > 0

def enqueue(event: LLMCallEvent) -> None:
    try:
        _queue.put_nowait(event)
    except asyncio.QueueFull:
        globals()["_dropped"] += 1
        # rate-limited WARNING every N drops, never per-drop (avoid log storm)

async def writer_loop() -> None: ...      # single consumer, started once in main.py lifespan
def start() -> None: ...                  # asyncio.create_task(writer_loop())
async def drain_and_stop(timeout_s: float = 5.0) -> None: ...
async def flush_for_tests() -> None: ...  # await _queue.join(); writer calls task_done() per event
def init_otel(settings) -> None: ...      # §8
```

**Why a bounded queue is safe here and doesn't need to be lossless:** every
call already writes the synchronous `caos.llm` JSON log line
(`budget.py:140-150`, unchanged) independent of the queue — that line is the
floor, always present, grep-able, and unaffected by anything in this section.
The queue only feeds the *richer* record (cost, masked payload, OTel
correlation). A dropped event under sustained overflow loses enrichment, not
the fact that the call happened. Depth 1000 against a realistic concurrent
call count (≤ ~10, per §2.4's semaphore defaults) makes overflow practically
unreachable in normal operation; it exists as a safety valve, not a
steady-state path.

Writer loop shape: dequeue → `telemetry_mask.mask_payload` on system/messages/
completion (§7) → `sha256({system, messages})` computed here (moved off hot
path, replacing the three duplicated inline computations at
`llm_client.py:103-109`/`151-157`/`234-240`) → `llm_pricing.compute_cost`
(§6, provider-reported preferred) → one `AsyncSessionLocal()`, insert
`LLMCallRecord` + `LLMCallPayload`, commit — batched, up to 32 events per
transaction, to bound worst-case commit latency under burst without adding a
second queue.

### 4.3 Lifecycle wiring

`main.py` lifespan, **after** the four existing executor `.start()` calls
(`main.py:100-113`, unchanged) and before `run_warmup`'s task spawn:

```python
telemetry.init_otel(get_settings())
telemetry.start()
```

Shutdown order (§13.3 states the full merged sequence): watcher/consumer stop
first (§9 — abandon in-flight, reconcile re-derives on next boot) → the four
existing executor `.stop()` calls, **unchanged order** → `await
telemetry.drain_and_stop(5.0)` **last**, so every trace enqueued by the
executors' own final work has a chance to flush before the process exits.

---

## 5. WS2 — Telemetry DB Schema

Migration `caos/server/migrations/versions/0034_llm_telemetry.py`,
`revision = "0034"`, `down_revision = "0033"` (chain: `0033_issuer_research_
report.py` is the current head — confirmed by directory listing this
session). Every change here is additive and portable (no
`if op.get_bind().dialect.name == "postgresql"` split needed — that idiom in
this codebase is reserved for FTS/vector DDL, `0029`/`0030`, not for plain
nullable columns).

### 5.1 `llm_call_records` — new columns

Existing columns (`database.py:678-696`) are untouched: `id`, `run_id`,
`lane`, `model`, `prompt_hash`, `prompt_tokens`, `completion_tokens`, `cost`,
`status`, `kept_count`, `dropped_count`, `latency_ms`, `error`, `created_at`.
`status`/`error` already exist in the model but are unused by `trace_llm`
today (`status` hardcoded `"success"` at `budget.py:162`); §2.3's failed-call
change is what makes them load-bearing.

```python
op.add_column("llm_call_records", sa.Column("provider", sa.String(16), nullable=True))
op.add_column("llm_call_records", sa.Column("model_mode", sa.String(16), nullable=True))
op.add_column("llm_call_records", sa.Column("cache_read_tokens", sa.Integer(), nullable=True))
op.add_column("llm_call_records", sa.Column("cache_write_tokens", sa.Integer(), nullable=True))
op.add_column("llm_call_records", sa.Column("cost_source", sa.String(16), nullable=True))  # "provider" | "matrix" | NULL
op.add_column("llm_call_records", sa.Column("trace_id", sa.String(32), nullable=True))      # OTel hex; NULL when OTel off
op.add_column("llm_call_records", sa.Column("span_id", sa.String(16), nullable=True))
```

`kept_count`/`dropped_count` are untouched (already written by
`engine/eval.py:63-64,108-109` for a different purpose — the CP-5 finding
retention count, not an LLM-record concept this spec touches).

### 5.2 New table: `llm_call_payloads`

Payloads are large (up to hundreds of KB per side) → a separate table, so a
query over `llm_call_records` (cost dashboards, run audits) never drags
payload bytes along. Soft-ref, no FK — matches the audit-table precedent
already in this codebase (`LineageEdge` string ids, `database.py:699-709`;
`AnalystQaFlag`, "so the flag survives its subject"). Style: `String(36)`
uuid PK via the house `_uuid()` helper, `DateTime(timezone=True)` via
`_utcnow()`, portable `JSON` column (not `JSONB` — matches every existing
JSON column in `database.py`).

```python
class LLMCallPayload(Base):
    __tablename__ = "llm_call_payloads"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    llm_call_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)  # soft ref → llm_call_records.id
    system_masked: Mapped[Optional[str]] = mapped_column(Text)
    messages_masked: Mapped[Optional[dict]] = mapped_column(JSON)      # [{role, content:[{type, text|name|input}]}]
    completion_masked: Mapped[Optional[dict]] = mapped_column(JSON)    # normalized resp.content blocks
    masking_version: Mapped[str] = mapped_column(String(16), nullable=False)
    masked_count: Mapped[Optional[int]] = mapped_column(Integer)       # substitutions made — masker efficacy signal
    truncated: Mapped[bool] = mapped_column(Boolean, default=False)    # llm_payload_max_chars cap applied
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
```

Config: `llm_log_payloads: bool = True` (kill switch — set `False` to stop
persisting payloads entirely, keeping only the `llm_call_records` row);
`llm_payload_max_chars: int = 200_000` (per side; excess truncated,
`truncated=True` stamped).

**Deliberately out of scope:** retention/purge policy for
`llm_call_payloads`. Flagged as an open item in §15, not designed here.

---

## 6. WS2 — Cost Matrix

### 6.1 Data structure

`engine/llm_pricing.py` — **a module-level dict, not `if`/`elif` chains and
not a DB-seeded table.** A DB table was considered and rejected: it adds a
migration, a seed script, and a read on the hot writer path for a value that
changes as often as every other hardcoded config default in this codebase
(see `config.py`'s own model-id constants, which are plain Python literals).

```python
@dataclass(frozen=True)
class ModelRates:
    input_per_mtok: float
    output_per_mtok: float
    cache_read_per_mtok: Optional[float] = None    # None → falls back to input rate (no discount known)
    cache_write_per_mtok: Optional[float] = None   # None → falls back to input rate

def resolve_rates(model: str) -> Optional[ModelRates]:
    """Longest-prefix match over RATES keys. Returns None for an unrecognized
    model — NEVER a default/guessed rate. This is what closes the defect in
    §6.4 below."""

def compute_cost(model: str, usage, provider_cost: Optional[float]) -> tuple[Optional[float], Optional[str]]:
    """Returns (usd, "provider") when provider_cost is not None.
    Else (usd, "matrix") from resolve_rates(model), reading the four usage
    fields (input/output/cache_read/cache_write) separately.
    Else (None, None) for an unknown model."""
```

### 6.2 Rate table (fetched this session — verify before wiring real billing)

**Anthropic figures** are from the `claude-api` skill's cached pricing table
(cache-dated 2026-06-24, the skill's own stated cache date). **Non-Anthropic
figures were fetched live via WebSearch this session (dated inline)** — these
providers move faster and are not covered by any skill; the rates below are
this session's best evidence, not an authoritative feed, and **must be
re-verified against each provider's live pricing page before this matrix
drives real invoicing.**

Cache rates for Anthropic models are derived from the documented cache
economics (5-minute-TTL default: writes at 1.25× input, reads at 0.1× input —
`shared/prompt-caching.md` in the `claude-api` skill), not independently
fetched per model — this derivation is marked so an implementer knows it's a
formula, not a quoted figure.

```python
RATES: dict[str, ModelRates] = {
    # Anthropic — claude-api skill cache, dated 2026-06-24. $ per million tokens.
    "claude-opus-4-8":   ModelRates(5.00, 25.00, 0.50, 6.25),
    "claude-sonnet-4-6": ModelRates(3.00, 15.00, 0.30, 3.75),
    "claude-sonnet-5":   ModelRates(3.00, 15.00, 0.30, 3.75),   # intro $2/$10 through 2026-08-31 — NOT modeled; flat rate used
    "claude-haiku-4-5":  ModelRates(1.00, 5.00, 0.10, 1.25),

    # OpenRouter — WebSearch, this session (2026-07-08). The OpenRouter adapter
    # hardcodes cache_read_input_tokens=0 (engine/openrouter.py:29) — cache
    # rates are moot for these two rows; provider-reported cost (§6.3) should
    # be preferred here whenever available, since third-party OpenRouter
    # pricing is the least stable input in this table.
    "deepseek/deepseek-v4-flash": ModelRates(0.09, 0.18),
    "deepseek/deepseek-v4-pro":   ModelRates(0.435, 0.87),
    "z-ai/glm-5.2":               ModelRates(0.93, 3.00),   # OpenRouter's own rate varies $0.93-3.00 in / $3.00-10.25 out across 25+ hosts on this route — this is the lowest observed, NOT a guarantee; prefer provider-reported cost

    # Gemini — WebSearch, this session (2026-07-08). Cache economics not
    # fetched (Gemini context caching has its own discount structure that
    # was not confirmed this session) — cache_read/cache_write are left None,
    # which means compute_cost falls back to the INPUT rate (no discount
    # applied) rather than guessing a number. FLAG: confirm Gemini cache
    # pricing before this matters materially (council_reviewer_model_gemini
    # and any gemini-tier lane are the only current callers).
    "gemini-2.5-pro":        ModelRates(1.00, 10.00),
    "gemini-2.5-flash":      ModelRates(0.30, 2.50),
    "gemini-2.5-flash-lite": ModelRates(0.10, 0.40),

    # Embeddings. text-embedding-004 is RETIRED (Google, 2026-01-14 — see
    # §0.1's critical-defect flag). gemini-embedding-001 is the current
    # replacement ($0.15/1M input; WebSearch, this session), 768/1536/3072-dim
    # via MRL — 768 matches config.embedding_dim unchanged. This spec does
    # NOT change config.embedding_model (out of scope — design/spec only) but
    # the rate table includes both so cost computes correctly the moment an
    # operator repoints the setting.
    "text-embedding-004":   ModelRates(0.0, 0.0),   # retired; historical rows only, was free-tier
    "gemini-embedding-001": ModelRates(0.15, 0.0),
}
```

Keyless mock embeddings (`get_mock_embedding`, `embeddings.py:17-25`) **never
reach the gateway** — `get_embeddings`'s keyless branch returns directly
without calling `llm_client.embed` (§9.8 states this explicitly), so no
`llm_call_records` row is ever written for a mock vector. This is correct: no
API cost was incurred, so no cost row should exist. The cost matrix therefore
needs no `"mock"` entry.

### 6.3 Provider-reported override path

`engine/openrouter.py`'s request payload (built at `:142-151`) gains
`"usage": {"include": true}`; `_normalize_response` (`:89`) reads
`data["usage"]["cost"]` into a new `_Usage.provider_cost_usd: Optional[float]`
field (`None` on every other path — Anthropic and Gemini SDKs report no
dollar figure). The gateway copies `getattr(usage, "provider_cost_usd", None)`
onto the `LLMCallEvent`; the writer prefers it over the matrix whenever it is
not `None`, stamping `cost_source="provider"`.

### 6.4 Where it computes, and the defect it replaces

**Writer task only** (§4.1) — the event carries the `usage` object reference
and `provider_cost`; `compute_cost` runs in the background, never on the hot
path. This replaces the existing hardcoded if/elif at `budget.py:127-138`,
which matches only `"sonnet"`/`"haiku"`/`"gemini-1.5|2.0"` substrings and
falls through to **Sonnet rates for everything else** — meaning every
DeepSeek call (the deployed default hybrid's cheap/fast/strong tiers),
`claude-opus-4-8`, and every `gemini-2.5-*` call has been silently mispriced
in `llm_call_records.cost` since those tiers were introduced. `resolve_rates`
returning `None` for a truly unrecognized model — instead of a guessed
default — is what makes this defect class structurally impossible to
reintroduce: a new model with no rate table entry shows `cost=NULL,
cost_source=NULL`, an honest gap, not a wrong number.

---

## 7. WS2 — Masking Spec

`engine/telemetry_mask.py`. Runs **only inside the writer task** (§4.1), on
the telemetry copies — never on the live request/response objects, which are
already back with the caller by the time the writer runs. There is nothing
payload-bearing on the hot path to mask today: the synchronous `caos.llm` log
line (`budget.py:140-150`) carries token counts and ids only, and this spec
does not change that.

```python
MASKING_VERSION = "1"
def mask_text(text: str) -> tuple[str, int]      # (masked, substitution_count)
def mask_payload(obj: Any) -> tuple[Any, int]    # recursive dict/list/str walk — shape precedent: vault_export._redact (vault_export.py:74-81)
```

One compiled regex alternation, named groups, `re.IGNORECASE`, single O(n)
pass. Group 0 matches an **already-masked placeholder** first, so re-masking
already-masked text (a payload that got masked twice for any reason) is a
no-op rather than double-encoding.

| # | Class | Regex sketch | Example → masked |
|---|---|---|---|
| 0 | `SKIP` | `⟨[A-Z]+:[0-9a-f]{8}⟩` | passthrough (idempotence) |
| 1 | `AMT` currency | `(?:USD\|EUR\|GBP\|CHF\|JPY\|CAD\|AUD\|[$€£¥])\s?\d[\d.,' ]*(?:\s?(?:million\|billion\|thousand\|trillion\|mrd\.?\|mio\.?\|mm\|bn\|k\|m\|b\|t))?` | `$12.3M` → `⟨AMT:3fa2c19b⟩`; `EUR 1,2 Mrd` → `⟨AMT:9c01d4e2⟩` |
| 2 | `AMT` bare scaled | `\b\d+(?:[.,]\d+)?\s?(?:mm\|bn\|mio\.?\|mrd\.?\|million\|billion\|thousand\|trillion)\b` | `4.2 billion` → `⟨AMT:71bc0f55⟩` |
| 3 | `MULT` leverage | `\b\d+(?:[.,]\d+)?\s?x\b` | `4.25x` → `⟨MULT:c2a41e08⟩` |
| 4 | `BPS` | `\b\d+(?:[.,]\d+)?\s?(?:bps\|bp\|basis\s+points?)\b` | `350bps` → `⟨BPS:5e77a1d0⟩` |
| 5 | `PCT` | `\b\d+(?:[.,]\d+)?\s?(?:%\|percent\b\|per\s+cent\b)` | `42%` → `⟨PCT:e01b7f3a⟩` |
| 6 | `NUM` large bare | `\b\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?\b\|\b\d{7,}\b` | `1,234,567.89` → `⟨NUM:0d4c9a12⟩` (years, CP module codes, small counts survive) |

- **Placeholder format:** `⟨CLASS:h8⟩` where `h8 =
  sha256(match.lower().replace-collapsed-whitespace).hexdigest()[:8]`,
  unsalted — the same underlying figure produces the same placeholder across
  every record, so masked payload rows stay joinable/dedupable without
  reconstructing the value.
- `masking_version` is stamped on every `LLMCallPayload` row; **bump the
  constant on any regex change** so historical rows are auditable against the
  version that produced them.
- Applied to: `system` text, every text block in `messages`, every text
  block and every `tool_use.input` value in the completion.
  `prompt_hash` (§4.1) is computed over the **raw**, unmasked prompt — masking
  must never change the dedup key.

---

## 8. WS2 — OTel Integration

- **New deps** (`requirements.txt`): `opentelemetry-api`,
  `opentelemetry-sdk`, `opentelemetry-exporter-otlp-proto-http` — all
  Apache-2.0, satisfying the no-paid-services rule; the SDK and exporter
  packages are imported lazily, only inside `init_otel`, only when an OTLP
  endpoint is actually configured.
- **Reconciling `main.py:271-275`** ("no external APM, by design — monitoring
  surface is `docker compose logs app`"): the gate is
  `otel_exporter_otlp_endpoint: str = ""` plus `otel_service_name: str =
  "caos"`. Empty (the default) → `init_otel` never constructs a
  `TracerProvider`; `trace.get_tracer("caos.gateway")` then returns the
  `opentelemetry-api` package's no-op tracer (span open/close become a
  handful of no-op calls); `trace_id`/`span_id` stay `NULL` on every row. **The
  default telemetry sink remains exactly what it is today plus the new DB
  table** — Postgres (`llm_call_records`/`llm_call_payloads`) and the
  `caos.llm` log line. Setting the endpoint installs a `TracerProvider` with
  a `BatchSpanProcessor(OTLPSpanExporter(endpoint))` — export runs on the
  processor's own daemon thread, never the request event loop.
- **Manual spans at the gateway only — no `opentelemetry-instrumentation-
  fastapi`.** That instrumentation is a separate dependency and would
  interleave with the three hand-rolled middlewares already in `main.py`
  (`security_headers`, `edge_origin_guard`, `access_log`,
  `main.py:200-268`) for no requirement this spec has — request-level
  correlation already exists via the `run_id`/`lane` ContextVars
  (`budget.py:48-57`).
- **Span model:** `caos.run {run_id}` — a parent span opened in the run
  executor at the same point `budget.set_run_id`/`set_budget` are installed;
  OTel's context propagation is `contextvars`-based, so every gateway span
  nests under it automatically, including across the runner's background
  task. `chat {request_model}` / `embeddings {model}` — one span per gateway
  call, wrapping semaphore-wait + provider call + fallback.
- **Attributes:** `gen_ai.operation.name` (`"chat"`/`"embeddings"`),
  `gen_ai.provider.name` (`"anthropic"`/`"gcp.gemini"`/`"openrouter"`),
  `gen_ai.request.model`, `gen_ai.response.model` (post-fallback model
  actually used), `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`;
  `error.type` + span status `ERROR` on a failed call; custom
  `caos.lane`, `caos.run_id`, `caos.model_mode`, `caos.fallback`,
  `caos.llm_call_id`. **Prompt/completion text never touches a span** —
  masked payloads live only in Postgres, so an OTLP collector can never
  receive unmasked financial figures even if misconfigured.
- **Span ↔ DB row correlation:** at enqueue time, the gateway copies
  `format_trace_id`/`format_span_id` of the current span context onto the
  `LLMCallEvent` → the `trace_id`/`span_id` columns (§5.1); the span itself
  carries `caos.llm_call_id`, closing the loop in the other direction.
  Dollar cost lives only on the DB row (computed after the span has already
  closed).

---

## 9. WS3 — Bidirectional Memory Sync

### 9.1 Canonicality rule (the amendment to OBSIDIAN_DATABANK.md)

| Family (`type:` frontmatter) | Vault dir | Canonical side | Watched? | Why |
|---|---|---|---|---|
| `credit-run` | `Runs/` | **CAOS** | no | Rendered from DB rows, overwritten in place on every export (`vault_export.py:203-224`) |
| `issuer` | `Issuers/` | **CAOS** | no | Same exporter (`vault_export.py:158-200`) |
| `analyst-memo` | `Analyst-Memos/` | **FILE** | **yes** | Analyst-authored; `write_memo` deliberately never overwrites an existing note, because there is no canonical DB row that would make an overwrite safe (`vault_export.py:412-416`) — the file *is* the source, and today's chunk copy silently drifts from it on any hand-edit |
| `source-document` (future OKF) | `Sources/` | **FILE** | yes (no-op until OKF ships) | Blueprint's own stated design: the note carries `contains_source_text: true`, i.e. is the human-relevant artifact |
| anything else | anywhere else | — | no (link-scan only, unchanged) | `sync_analyst_memos` already walks every non-`Runs/`/`Issuers/` dir for `[[wikilinks]]`; that behavior is untouched |

**Loop prevention is structural, not a suppression list.** Two facts:

1. The sync consumer described below **never writes vault files** — it only
   writes DB rows. CAOS→vault writes stay exactly where they are today
   (`write_run_to_vault`, `write_memo`), both targeting either an ignored
   directory or a directory the consumer also watches but converges on
   trivially (next point).
2. A CAOS-authored write **into** a watched directory (`write_memo` on
   upload) does fire the watcher, but resolves to a **content-hash no-op**:
   the consumer recomputes the file's body hash, finds it equals the
   `Document.source_sha256` the upload just stamped, and the multiset diff
   (§9.6) comes back empty. This is idempotence, not a special case — no
   registry of "my own writes" is needed.

### 9.2 Watcher architecture — the deliverable

**Decision: `watchfiles.awatch`, not stdlib mtime polling.**

- **Zero image delta.** `watchfiles==1.2.0` is already pinned in
  `requirements.lock` as a transitive dependency of `uvicorn[standard]`.
  Promoting it to a direct dependency in `requirements.txt` changes nothing
  about what ships in the built image.
- **Async-native.** `awatch` is an async generator — it drops straight into
  the `asyncio.create_task` lifespan idiom already used at `main.py:122`. A
  hand-rolled poller would need its own sleep loop plus a per-file mtime
  cache duplicating what `sync_analyst_memos` already does
  (`vault_export.py:431-434,515`).
- **Fits Obsidian's write pattern.** Obsidian autosaves arrive as bursts
  (temp-write + rename, or rapid in-place saves). `watchfiles`'s underlying
  Rust-notify layer debounces a burst into one yielded batch, so a
  temp+rename sequence collapses to one dirty mark on the real filename after
  the scope filter drops the temp name. An mtime poller risks reading the
  file **mid-rename** (target momentarily absent → a false delete).
- **The polling path is subsumed, not discarded.** `awatch(...,
  force_polling=...)` — or env `WATCHFILES_FORCE_POLLING=true` — switches the
  identical API to stat-polling for mounts that don't forward inotify (macOS
  bind mounts, some NFS configurations, Docker Desktop VirtioFS). One code
  path, both transports; the compose delta in §11 documents when to flip it.
- **FLAG: ungrounded** — exact `awatch` defaults (debounce window, step
  interval) are library documentation, not something read from this repo
  this session; confirm against the pinned `watchfiles==1.2.0` at
  implementation time.

**Invocation** (one task):

```python
async for changes in watchfiles.awatch(
    vault_root,                 # settings.vault_export_dir
    watch_filter=_eligible,     # below
    stop_event=self._stop,      # shutdown, §13.3
):
    for change, abspath in changes:   # the Change kind is deliberately IGNORED — see below
        self._mark_dirty(rel_path_of(abspath))
```

**Scope filter `_eligible(change, path) -> bool`** (all must hold):
suffix `== ".md"`; the first vault-relative path segment is in
`{"Analyst-Memos", "Sources"}` (an **allowlist**, deliberately tighter than
`sync_analyst_memos`'s denylist of `Runs`/`Issuers` — corpus sync governs only
the two file-canonical families; every other directory keeps today's
link-only behavior unchanged); no path component starts with `.` (covers
`.obsidian/`, `.trash/`, any hidden temp file).

**Event kind is never trusted.** `Change.added`/`modified`/`deleted` all map
to the same "this path is dirty" mark; a rename surfaces as
`deleted(old)+added(new)`, resolved at consume time (§9.7) by re-stat-ing the
file, not by trusting the reported kind — this collapses create / modify /
rename-target / atomic-replace into one code path and is immune to a stale
kind surviving the coalescing window.

**Supervision:** the watcher task wraps `awatch` in a `while not stopped`
loop; on an unexpected exception it logs, backs off (5s → 60s cap), restarts,
and sets `_reconcile_requested = True` (repairs whatever the outage window
might have missed).

### 9.3 Event queue — the deliverable

```python
@dataclass
class SyncEvent:
    rel_path: str          # vault-relative POSIX path — the coalescing key
    first_seen: float       # time.monotonic() at first dirty mark
    last_seen: float        # bumped on every re-mark; basis for the quiet period
    attempts: int = 0
    not_before: float = 0.0  # monotonic backoff gate

_pending: dict[str, SyncEvent]     # the dict IS the coalesced queue — no separate FIFO needed
_wake: asyncio.Event
```

Structure decision: a `dict` + `asyncio.Event`, **not** a raw `asyncio.Queue`.
Coalescing-by-path is a hard requirement (autosave bursts must not fire N
syncs); a FIFO queue would need a dedup map bolted on regardless, so the dict
*is* that map. Single event loop, single process (`run.py:17` — one uvicorn
worker) means no cross-thread lock is needed on `_pending`.

`_mark_dirty(rel_path)`: upsert into `_pending` (bump `last_seen`);
`_wake.set()`.

**Bound & overflow:** `_MAX_PENDING = 4096`. On overflow: clear `_pending`,
set `_reconcile_requested = True`. Degrades to a full reconcile pass —
strictly more work, never lost work; there is no drop-event failure mode in
this design (contrast with the telemetry queue in §4, where a drop is
acceptable because a floor log line survives it — there is no equivalent
floor here, so this path never drops).

**Consumer loop** (one `asyncio.Task`):
1. `await _wake.wait()`; clear the event.
2. Snapshot events where `now - last_seen >= debounce` (config
   `vault_sync_debounce_seconds`, default `2.0` — long enough to span an
   Obsidian save burst, short enough to feel live) **and** `now >=
   not_before`.
3. Process due events **sequentially** — free per-path serialization (no two
   syncs of the same doc-set interleave), and keeps embedding calls from
   stampeding the Gemini quota.
4. Each event opens its **own** `AsyncSessionLocal()` — the house background
   idiom (`routes/ingestion.py:297-302,338-343`), never the request session.
5. If items remain not-yet-due, `asyncio.sleep(min-remaining)` then recheck;
   else back to `_wake.wait()`.
6. After any batch touching `Analyst-Memos/`, call
   `vault_export.sync_analyst_memos(session)` once so the wikilink graph
   refreshes without waiting for the next Query-page read (reuses its own
   cooldown and lock, `vault_export.py:434-435` — safe to call
   opportunistically).

**Failure retry & quarantine:** per-event `try/except` — the loop never dies
on one bad file. Retryable (DB error, `EmbeddingUnavailable` from §9.8,
transient `OSError`): re-insert with `attempts += 1`, `not_before = now +
min(2**attempts * 2, 300)`. After `attempts >= 5`: move to a `_quarantine:
dict[rel_path, reason]`, log `ERROR`, stop retrying — released on the next
watcher event for that path or the next startup reconcile. Parse errors
(undecodable bytes, unrecoverable content) quarantine immediately. Files over
`settings.max_upload_mb` (`config.py:175`, same cap the upload path already
enforces) quarantine with reason `too_large`.

### 9.4 Startup reconcile — the durability backstop

`async def reconcile_vault(session_factory, vault_root) -> ReconcileStats`,
scheduled via `asyncio.create_task` in the lifespan, sequenced **after**
`run_warmup` (so the two never compete for the embedder concurrently). Also
re-run on watcher-crash-restart and on queue overflow.

1. Walk `Analyst-Memos/` + `Sources/` (off-thread, mirroring
   `_scan_memo_files`, `vault_export.py:438-454`).
2. Per file: `split_note` (§9.6) → `body_sha256`; compare to
   `Document.source_sha256`; mismatch → `_mark_dirty(rel_path)`.
3. **Legacy adoption:** a doc-set matched only by the stem fallback (§9.7)
   gets `source_rel_path`/`source_sha256` stamped for the first time — this
   is the one-time, bounded re-chunk described in §9.6's basis-convergence
   note.
4. **Orphan detection with a mass-delete guard:** `Document` rows in the
   watched families whose `source_rel_path` no longer resolves on disk are
   candidates for removal (§9.6 step 7's evidence-aware rule) — **unless**
   the walk found **zero** `.md` files under the watched dirs while the DB
   holds more than zero synced doc-sets, in which case: log `ERROR`, take
   **no destructive action**. An unmounted or empty volume must never be
   allowed to look like "the analyst deleted everything."

**Why no durable job table.** `PipelineRun` + SKIP-LOCKED claiming exists for
work that must not silently vanish if the process dies mid-job. A sync job
is fully re-derivable from `(disk state, DB state)` — the reconcile pass
above makes the in-memory `_pending` dict effectively lossless without a
second persistence layer to keep consistent with the first.

### 9.5 Chunk-diff algorithm

**9.5.1 Frontmatter/body extraction.** No new PyYAML dependency:

```python
def split_note(md: str) -> tuple[dict[str, Any], str]:
    """Inverse of vault_export._yaml_block (vault_export.py:45-54). If the text
    starts with '---\\n', the frontmatter is everything up to the next line
    that is exactly '---'; each line splits on the first ': ', values
    json.loads() with a raw-string fallback (matches _yaml_block's own
    json.dumps(v) writing convention). Body = everything after the closing
    delimiter, leading blank lines stripped. No opening delimiter found →
    frontmatter={}, body=the whole text (tolerates a file mid-edit)."""

def body_sha256(body: str) -> str:
    """sha256(body.strip().encode('utf-8')).hexdigest() — stripped, because
    ingest.chunk_text strips first too (ingest.py:222), keeping the hash
    stable exactly where chunking is."""
```

**9.5.2 Body basis — the upload/file parity decision.** The canonical corpus
text of a file-canonical note is `split_note(raw).body`: frontmatter
stripped, **H1 title line kept**. The upload lane is changed to converge on
the same basis: in `upload_memo`, after `md =
vault_export.render_memo(...)` (`routes/ingestion.py:308-312`), pass
`split_note(md)[1]` — not the raw pre-render `text` — into
`chunk_memo_into_corpus`. One extraction function, two callers; new uploads
and file-edits produce byte-identical chunks from day one.

Why not strip the H1 to match today's upload-time chunks exactly: the H1 is
editable note body — stripping it would silently exclude title edits from
the corpus, and would require a second extraction dialect. **Cost of
convergence, stated precisely:** pre-existing memos were chunked from the
pre-frontmatter `text` (no H1 prefix); their *first* reconcile pass (§9.4
step 3) re-chunks each legacy memo once, because `chunk_text`'s greedy
packing (`ingest.py:280-311`) can shift every block boundary once an H1 line
is prepended. This is a one-time, bounded, background cost — new uploads
incur none of it.

For future `source-document` notes: the note body is **not** chunk-identical
to the OKF blueprint's Stage-4 chunks by design (page anchors live only in
the note, per that blueprint). Rule: an untouched Sources/ note is a no-op
via `source_sha256` (stamped at OKF ingest time); the **first manual edit**
supersedes the OKF chunk set with file-derived chunks through the same diff
below — the file becomes canonical from the moment a human touches it.

**9.5.3 Per-document diff.**

```python
async def _sync_doc(db, doc: Document, chunks: list[str]) -> DiffStats:
```

Given the target `Document` and `chunks = chunk_text(body)` (`ingest.py:221-
313`, reused verbatim — never forked, per the OKF blueprint's own must-not-
fork mandate, §10.3):

1. `new_hashes = [sha256(c.encode()).hexdigest() for c in chunks]` — the
   house recipe (`routes/ingestion.py:119`, `engine/memochunks.py:119`).
2. Load existing rows: `select(DocumentChunk).where(document_id == doc.id)`.
3. Compare as **multisets** (`collections.Counter`) — `DocumentChunk` has no
   `(document_id, chunk_hash)` uniqueness (`database.py:207-222`), and a file
   can legitimately repeat a paragraph, so a set comparison would silently
   collapse a real duplicate.
4. **Equal** → update any drifted `seq`, stamp provenance (§10), return. This
   is also the self-write-suppression path from §9.1.
5. **`to_add`:** Core `insert(DocumentChunk)` dicts with `id`, `document_id`,
   `seq`, `text`, and **explicit `chunk_hash`** — required because the
   `before_insert` recompute listener (`database.py:979-990`) fires only on an
   ORM unit-of-work flush, never on a Core `insert()` — plus one `LineageEdge`
   per chunk (`transform="vault-sync"`, house shape
   `routes/ingestion.py:127-135`).
6. **Resurrection:** a hash in `to_add` matching a **superseded** row of this
   same doc (§9.7's `superseded_at`, not yet described — see below) clears
   `superseded_at` instead of inserting fresh — keeps a cited chunk's id
   stable across a revert-then-redo edit.
7. **`to_remove` — evidence-aware:** query `_cited_chunk_ids` = union of
   `EvidenceItem.document_chunk_id` (`database.py:406-408`) and
   `MetricFact.document_chunk_id` (`database.py:459-461`) hits for the
   removed hashes' row ids. Cited → set `superseded_at = now()` (row kept,
   citation stays openable, no FK can ever raise). Uncited → hard delete in
   the house dependency order (`LineageEdge` by `chunk:{id}` → the
   `DocumentChunk` row — verbatim order from
   `memochunks._delete_prior_memo_docs`, `engine/memochunks.py:56-65`).
   Postgres enforces the FK on a cited-and-deleted row; SQLite CI does not
   (no `PRAGMA foreign_keys`) — the supersede test **must** assert Postgres
   semantics (§14.3).
8. Renumber kept rows' `seq` to file order; `doc.chunk_count = len(chunks)`
   (matches upload-path parity, `engine/memochunks.py:108`).
9. Stamp `doc.source_rel_path`, `doc.source_sha256`, `doc.synced_at`,
   `doc.sync_origin = "vault-sync"` (§10).
10. `await embed_chunks_for_document(session, doc.id)` — its existing
    only-missing semantics (`embeddings.py:74-83`) make the refresh surgical
    *by construction*: unchanged hashes embed nothing. **Embedding rows are
    never deleted** — keyed `(model, chunk_hash)`, shared across documents,
    reused on re-chunk (`memochunks.py:44-45`; dedup logic
    `embeddings.py:131-142`; this is also the blueprint's Stage-6 mandate).
    BM25 needs no step at all: `tsv` is a persisted `Computed` column, GIN
    indexed on `INSERT` (`database.py:217-221`, migration `0029`).

**Multi-issuer memos.** A memo maps to N `Document` rows, one per linked
issuer, sharing chunk text/hashes (`memochunks.py:101-135`). `sync_note`
runs the per-doc diff above once per existing doc-row, then reconciles the
issuer *set* itself: current wikilinks in the body resolve to issuer ids
(name/ticker map, pattern from `vault_export.py:518-522`); a newly linked
issuer gets a full chunk insert (near-zero embedding cost — the hashes are
already embedded via the shared-hash join); an unlinked issuer's `Document`
goes through the same evidence-aware removal as step 7. A memo edited down to
zero links removes all its docs (matches upload-path behavior for zero-link
memos, `memochunks.py:89-91`).

### 9.6 Consumer entry points

```python
async def sync_note(db, vault_root: Path, rel_path: str) -> SyncResult   # file exists
async def sync_note_removed(db, rel_path: str) -> SyncResult             # file missing
```
`sync_note`: read file (`asyncio.to_thread`, size-capped) → `split_note` →
resolve identity (§9.7) → per-doc `_sync_doc` + issuer-set reconcile.
`sync_note_removed`: resolve the doc-set → evidence-aware removal (the
whole-set version of §9.5 step 7 — cited anywhere → shadow every chunk of
that doc and keep the `Document` row so a citation's `file_name` still
resolves).

### 9.7 Identity resolution & rename

| Family | Primary key | Fallback | No match | Rename |
|---|---|---|---|---|
| `analyst-memo` | `Document.source_rel_path == rel_path` (new col, §10) | Legacy: `Document.file_name == Path(rel_path).stem` — **exact** today, because upload chunks under `path.stem` (`routes/ingestion.py:329` passes `path.stem` into `chunk_memo_into_corpus` → `Document.file_name`, `memochunks.py:105-107`); on a legacy match, stamp `source_rel_path` (the adoption step, §9.4.3) | A hand-created memo file is legitimate intake: parse wikilinks → resolve issuer ids → create the doc-set via §9.5's machinery; `uploaded_by` from frontmatter if present (`render_memo` writes it, `vault_export.py:402-408`), else `None` | Content-hash match (below) |
| `source-document` | Frontmatter `document_id → Document.id` (blueprint App A: a required key) | `source_rel_path` match | **Quarantine** — `Sources/` is machine-written only; a hand-made note there with no `document_id` is ambiguous and never guessed | `document_id` travels in the file body; a rename just restamps `source_rel_path` |

**Rename, exact mechanics (memos).** A rename arrives as `deleted(old) +
added(new)` — typically one coalesced batch. The consumer processes
**upserts before deletes** within a batch; for an added path resolving to no
doc-set, check: does an existing doc-set have `source_sha256 ==
body_sha256(new file)` **and** a `source_rel_path` that is currently missing
on disk (or is in this same batch's pending deletes)? Yes → **rename**:
`UPDATE` that doc-set's `source_rel_path` + `file_name = new stem`; zero
re-chunk, zero re-embed, every citation stays intact. If content also changed
in the same window, the hash match fails and the pair degrades safely to
delete-old (evidence-aware) + create-new — new chunks re-embed only what
hash-differs from before. `render_memo` gains **no new frontmatter field** for
this — content-hash rename detection removes the need for a stamped memo id
(the current field set — `type`, `memo_type`, `uploaded_by`, `source_file`,
`date`, `vault_export.py:392-409` — is unchanged by this spec).

### 9.8 Embedding-failure defect fix

`engine/embeddings.py:52-55` today: a **live** Gemini call failure returns
mock vectors that `embed_chunks_for_document` (`:95-108`) then persists
**under the real model name** — this both mixes fabricated vectors into a
real corpus and poisons the only-missing check (`:74-83`), which will never
re-attempt that chunk once a hash exists for the active model.

**Fix:** in `get_embeddings`, when `settings.gemini_api_key` is set and the
live call raises, raise a new `EmbeddingUnavailable(RuntimeError)` instead of
falling back to the mock. **Keyless dev/test keeps today's mock-under-real-
model behavior unchanged** — that path has no key to fail with, and is a
deliberate, harmless dev affordance, not the defect. Callers:
`embed_chunks_for_document` lets the exception propagate after committing any
already-successful batches; the WS3 consumer (§9.3) treats it as retryable;
`run_warmup` already wraps its call in `try/except` (`main.py:114-120`) and
naturally retries at the next boot via its own reconciler
(`embeddings.py:115-171`); the two upload-lane `BackgroundTask` callers
(`routes/ingestion.py:297-302,338-343`) get a logged failure instead of a
silently-persisted mock — the intended, visible behavior change.

**Audit query for the pre-existing corruption risk (§0.1):** any
`document_chunk_embeddings` row with `model = 'text-embedding-004'` created
after 2026-01-14 (the retirement date) in a deployment where
`GEMINI_API_KEY` was set is unverifiable-but-suspect under the *current*
schema, because nothing distinguishes a mock vector from a real one once
written. This spec's fix prevents new occurrences; it cannot retroactively
distinguish old rows — that is a data-audit task, out of scope here, flagged
for the operator.

### 9.9 Retrieval shadow predicate

`superseded_at IS NULL` is added to the chunk-fetch predicates in
`retrieval.py` — the fetches and vector joins at `:220,240` (`retrieve`,
`:167`), `:376,397` (`retrieve_corpus`, `:288`), `:497`
(`retrieve_corpus_by_issuer`, `:426`), and the doc-type filter in
`build_issuer_index` (`:268-273`). **One shared predicate helper, applied at
all six sites; the chunk-open-by-id route must NOT apply it** — a citation
must still resolve even after its source chunk is shadowed. This is the one
deliberate change to a hot-path query: a `NULL` check on an already-indexed
column inside a scan that already filters and joins — no new query, no new
join, negligible cost. Without it, a superseded chunk's text would stay
retrievable — exactly the drift this workstream exists to close.

---

## 10. WS3 — Vector Metadata Tagging Standard

**Rule:** descriptive metadata lives on `Document`; positional metadata on
`DocumentChunk`; the embedding row stays metadata-free, keyed
`(model, chunk_hash)`, reached from metadata **only via join**
(`DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash AND model ==
active`). §10.3 states what must never fork.

| Home | Field | Type / key | Written by | Grounding |
|---|---|---|---|---|
| `DocumentChunk` | `id` | PK, `String(36)` | all writers | `database.py:207-214` |
| | `document_id` | FK `documents.id`, indexed | writers | `:215` |
| | `seq` | int, file order; renumbered on sync | writers / WS3 diff | `:216` |
| | `text` | Text | writers | `:216` |
| | `chunk_hash` | `String(64)` = sha256(text), indexed; **explicit on Core inserts** | writers | `:217`; `routes/ingestion.py:119`; `memochunks.py:119` |
| | `tsv` | `TSVECTOR` Computed persisted + GIN | Postgres | `:218-221`, mig 0029 |
| | **`superseded_at`** *(this spec adds)* | `DateTime(tz)` NULL; NULL = live | WS3 diff only | §9.5/§9.9 |
| `Document` | `issuer_id` | FK, indexed | writers | `database.py:197` |
| | `doc_type` | `String(64)` — family discriminator (`analyst-memo` excluded from `build_issuer_index`, `retrieval.py:268-273`) | writers | `:198` |
| | `file_name`, `storage_key`, `fiscal_period`, `chunk_count`, `uploaded_by`, `uploaded_at`, `run_mode` | unchanged | writers | `:199-206` |
| | **`source_rel_path`** *(adds)* | `String(1024)` NULL — identity key, §9.7 | upload lane + WS3 | new |
| | **`source_sha256`** *(adds)* | `String(64)` NULL — no-op/self-write/rename detector | upload lane + WS3 | new |
| | **`synced_at`** *(adds)* | `DateTime(tz)` NULL | WS3 | new |
| | **`sync_origin`** *(adds)* | `String(16)` NULL: `"upload"` \| `"vault-sync"` (reserved `"okf-ingest"`) | upload lane + WS3 | new |
| `DocumentChunkEmbedding` | `chunk_hash`, `model`, `vector SafeVector(768)`, `created_at`; UNIQUE `(model, chunk_hash)`; HNSW cosine | **unchanged; rows never deleted** | `embed_chunks_for_document` only | `database.py:712-731`, mig 0030; `memochunks.py:44-45` |

All additions are nullable, additive, soft-ref (no new foreign keys — the
same precedent already set by `DocumentChunkEmbedding`, `LineageEdge`,
`AnalystQaFlag`). **Migration `0035_vault_sync_provenance.py`,
`down_revision = "0034"`** — chains after §5's telemetry migration (see §0.1
for the 0034 numbering reconciliation with the unlanded OKF blueprint).
Upload-lane change: `upload_memo`/`chunk_memo_into_corpus` stamp
`source_rel_path = "Analyst-Memos/{file.name}"`, `source_sha256`,
`sync_origin = "upload"` at creation time.

### 10.3 Must-not-fork list (restates the OKF blueprint's own mandate, verbatim scope)

The embedding model (`text-embedding-004`, or its live replacement — see the
§0.1 flag), the `(model, chunk_hash)` unique key, the `chunk_hash =
sha256(text)` recipe, and the `document_chunks`/`document_chunk_embeddings`
schemas. Reuse `embed_chunks_for_document` and `chunk_text` as-is; this spec
introduces **no** second embedder, second vector table, or parallel
retriever.

---

## 11. Deploy & Config Delta

### 11.1 `caos/deploy/docker-compose.yml`

Stock compose mounts only `vault-data:/vault` (= `CAOS_STORAGE_DIR`, the
document blob store — a **different** vault from the Obsidian one).
`VAULT_EXPORT_DIR` is unset anywhere in compose today, so this workstream is
inert in the stock stack until an operator opts in.

- `app` service: add a named volume `obsidian-vault:/obsidian-vault`
  (**rw** — `read_only: true` on the app's rootfs governs the *image*
  filesystem, not mounted volumes; the existing exporters already need write
  access here, the watcher only needs read) + env `VAULT_EXPORT_DIR:
  /obsidian-vault` + `VAULT_SYNC_ENABLED: "true"`. `tmpfs /tmp` and
  `cap_drop: ALL` are unaffected — `watchfiles`' inotify path needs no
  Linux capability.
- Named volume on a Linux host → inotify works natively. If an operator
  instead bind-mounts a host directory (the realistic desktop-Obsidian case
  on macOS/Windows Docker Desktop, or NFS): set `WATCHFILES_FORCE_POLLING:
  "true"` on the app service — document this as a compose comment. **FLAG:**
  event forwarding across Docker Desktop's VirtioFS is environment-dependent
  and was not tested this session; §9.4's startup reconcile is the
  correctness backstop regardless of which transport is active.
- Optional: mount `obsidian-vault:/obsidian-vault:ro` into the `backup`
  service and extend its tar step to cover it alongside `/vault`.

### 11.2 `caos/deploy/Dockerfile` (only if §3's edgar MCP server ships)

Copy `caos/mcp/edgar/` into the image; add the `mcp` package (and that
server's own `httpx` dependency, currently declared in a separate
`pyproject.toml`) to the app's `requirements.txt`. Not required if the MCP
router ships with zero configured servers.

### 11.3 New settings (all additive; existing settings untouched)

| Setting | Default | Section |
|---|---|---|
| `llm_max_concurrency_anthropic` | `8` | §2.4 |
| `llm_max_concurrency_gemini` | `8` | §2.4 |
| `llm_max_concurrency_openrouter` | `8` | §2.4 |
| `llm_fallback_max_retries` | `3` | §2.4 |
| `llm_retry_base_s` | `1.0` | §2.4 |
| `llm_retry_cap_s` | `8.0` | §2.4 |
| `mcp_servers` | `""` | §3.1 |
| `mcp_lane_allowlist` | `""` | §3.1 |
| `mcp_max_tool_turns` | `5` | §3.1 |
| `llm_log_payloads` | `True` | §5.2 |
| `llm_payload_max_chars` | `200000` | §5.2 |
| `otel_exporter_otlp_endpoint` | `""` | §8 |
| `otel_service_name` | `"caos"` | §8 |
| `vault_sync_enabled` | `False` | §9; effective-enabled requires `vault_export_dir` also set, same "empty = disabled" pattern as `config.py:242-248` |
| `vault_sync_debounce_seconds` | `2.0` | §9.3 |

---

## 12. Zero-Added-Latency Placement Map (merged, all three workstreams)

| Step | Runs where | Why the hot path is unaffected |
|---|---|---|
| OTel span open/close + attrs | hot path | O(1); no-op tracer when endpoint unset (default) |
| Per-provider semaphore acquire/release | hot path | O(1) uncontended; default 8 ≥ today's peak (2×4) so it never binds under current config |
| `record_usage` budget accrual | hot path (pre-existing, unchanged) | ContextVar reads + int adds — must stay hot, it gates live `llm_allowed()` semantics |
| `caos.llm` log line | hot path (pre-existing, unchanged) | Fixed small fields, no payload text |
| `uuid4()` → `resp.llm_call_id` | hot path (new) | O(1) |
| `LLMCallEvent` construct | hot path (new) | O(1)-class — shallow refs to `system`/completion, `tuple(messages)`; safe because no caller mutates a message dict in place after appending it (deepresearch appends new messages, never edits old ones) |
| `telemetry.enqueue` | hot path (new) | `queue.put_nowait` — never blocks; overflow drops + counts |
| `sha256(prompt)` | **moved to writer** | Removed from hot path (was inline at 3 call sites) |
| Cost computation | **writer** | Replaces hot-path if/elif |
| Masking | **writer** | New work, background-only |
| `LLMCallRecord`/`LLMCallPayload` INSERT + commit | **writer** | Removed from hot path (was an awaited commit per call); batched ≤32/commit |
| OTLP export | OTel's own daemon thread | Out-of-band, opt-in |
| MCP tool execution | `create_with_tools` only | Zero existing lanes call it (default-empty allowlist) |
| File watcher event → coalesce | background asyncio task | Kernel-driven, idle `await` |
| Chunk re-diff + re-chunk | background consumer task, own DB session | File I/O via `asyncio.to_thread` |
| Re-embed | background consumer → `embed_chunks_for_document` | Already a background-only function today |
| Startup reconcile | `asyncio.create_task` in lifespan | Serves no request |
| Upload-lane basis change (`split_note` on already-rendered string) | in-request, `upload_memo` | No I/O added — operates on a string already in memory |
| Retrieval `superseded_at IS NULL` | in-request query | NULL check on an already-indexed column inside an already-filtered scan; no new query or join |

**Net claim:** the primary request path *loses* two pieces of existing work
(the inline sha256, the awaited DB commit) and *gains* only O(1) bookkeeping.
§14.4 states the exact tests that prove this rather than assert it.

---

## 13. Rollout & Migration Sequencing

1. `0034_llm_telemetry.py` (down_revision `"0033"`) — §5.
2. `0035_vault_sync_provenance.py` (down_revision `"0034"`) — §10.
3. The unlanded `PDF_INGESTION_OKF_BLUEPRINT.md` reserves its own `0034` —
   whichever of these two workstreams lands second in wall-clock time
   renumbers to keep the chain linear; this spec does not resolve *which*
   ships first, only that the collision must be checked at merge time.
4. Legacy memo re-chunk (§9.5.2) happens automatically, once per file, at
   the first startup reconcile after `vault_sync_enabled=True` — no separate
   backfill script.
5. Lifespan start order: telemetry writer → vault watcher + consumer →
   `run_warmup` → vault startup reconcile (sequenced after warmup so the two
   never compete for the embedder concurrently, §9.4). Shutdown: watcher +
   consumer stop first (abandon `_pending`, reconcile re-derives next boot)
   → the four existing executors' `.stop()` calls, unchanged order →
   `telemetry.drain_and_stop(5.0)` last, so the executors' own final traces
   have a chance to flush.
6. Vault-sync re-embeds route through `llm_client.embed` → land in
   `llm_call_records` under `lane="embed"` — sync cost is visible in the same
   ledger as every other LLM spend from day one, no separate accounting path.

---

## 14. Test Plan

### 14.1 Registry test evolution

`caos/tests/server/test_llm_safety.py:152-187` pattern becomes:
```python
pat = re.compile(r"\.(?:beta\.)?messages\.(?:create|stream)\(|\bllm_client\.(?:create|stream_final|create_with_tools)\(")
```
Expected set stays the **same 15 files** — synth/deepresearch/research_report
now match via the gateway calls instead of raw provider calls; no file enters
or leaves the set. **New companion test**
`test_raw_provider_calls_only_in_gateway`: the raw pattern
`\.(?:beta\.)?messages\.(?:create|stream)\(` must match exactly
`{"engine/llm_client.py"}`; the raw Gemini pattern
`aio\.models\.(?:generate_content|embed_content)\(` must match exactly
`{"engine/gemini.py"}` — the mechanical proof that the gateway is total, not
just conventionally used.

### 14.2 Golden invariants (existing behavior unchanged)

`test_llm_client.py` (fallback control flow against a fake client) and
`test_budget.py` pass with **zero changes to their call shapes** — `create`'s
new signature is a strict superset. One addition to
`test_intelligent_vault.py:105` (selects `LLMCallRecord` by `run_id`):
`await telemetry.flush_for_tests()` before the select.

### 14.3 WS3 test hooks (`caos/tests/server/test_vault_sync.py`)

1. Round-trip parity: upload memo → `split_note(written file)` → `chunk_text`
   multiset equals DB chunk hashes.
2. Self-write no-op: `sync_note` on the just-uploaded path → zero row
   changes.
3. Surgical edit: append a paragraph → only new hashes inserted; pre-existing
   `(model, chunk_hash)` rows untouched and reused.
4. Evidence-aware delete: cite a chunk via `EvidenceItem.document_chunk_id`,
   delete the file → shadowed, not deleted; uncited siblings hard-deleted in
   FK order — **assert under Postgres**, not SQLite (SQLite CI cannot
   exercise the FK).
5. Rename: unchanged body, new filename → `source_rel_path`/`file_name`
   repointed, zero chunk/embedding churn.
6. Legacy adoption: a pre-existing memo doc (no `source_rel_path`) plus its
   file → reconcile stamps provenance via stem match.
7. Live-failure never persists mock: `gemini_api_key` set + embed raises →
   no `DocumentChunkEmbedding` row lands; keyless → mock rows still land
   (unchanged dev affordance).
8. Gate off: `vault_export_dir=""` or `vault_sync_enabled=False` → no
   watcher/consumer tasks start.
9. Ignore rules: events under `Runs/`, `Issuers/`, `.obsidian/`, `.trash/`,
   non-`.md` never enter `_pending`.
10. Coalescing + quiet period: N rapid events on one path → one `sync_note`
    call after the quiet period; overflow → `_reconcile_requested` set,
    `_pending` cleared.
11. Mass-delete guard: empty watched dirs + populated DB → zero destructive
    writes, `ERROR` logged.
12. Issuer-set reconcile: edit a memo to add/remove a `[[wikilink]]` → the
    per-issuer `Document` set updates evidence-aware; a memo edited to zero
    links removes its whole doc-set.
13. Invariant property test: after any generated edit sequence reaches
    quiescence, `I1` (§14.5) holds.

### 14.4 Zero-added-latency proof (not assertion)

(a) Structural: monkeypatch `database.AsyncSessionLocal` to raise;
`llm_client.create` against a fake client must still succeed and the event
must sit in `telemetry`'s queue — no DB touch reachable from the hot path.
(b) Drop-path: fill the queue, call `trace_llm`, assert immediate return +
incremented drop counter. (c) Micro-benchmark, marked slow: `trace_llm` p95 <
1ms with the writer stalled, versus the current implementation's awaited
commit — a regression guard, not a one-time check.

### 14.5 Invariants (I1–I6, verifier-assertable)

- **I1 (no drift):** for every `.md` under `Analyst-Memos/` (and `Sources/`
  once OKF lands): `Counter(sha256(c) for c in chunk_text(split_note(read(f)).
  body))` equals `Counter(chunk_hash of live DocumentChunk rows for f's
  doc-set)`, per issuer copy.
- **I2 (vectors present, never fake):** for every live `chunk_hash` h, exactly
  one `DocumentChunkEmbedding(model=active, chunk_hash=h)` row exists, and
  when `gemini_api_key` is set it is never a mock vector.
- **I3 (CAOS-canonical untouched):** no sync-originated write ever targets a
  `Document` backing `Runs/`/`Issuers/` content; those directories never
  enter `_pending`.
- **I4 (citations never dangle):** every `EvidenceItem`/`MetricFact
  .document_chunk_id` resolves to an existing row, forever — the shadow rule,
  Postgres-FK-enforced.
- **I5 (embeddings append-only):** no sync operation ever deletes a
  `document_chunk_embeddings` row.
- **I6 (hot path):** §12's table holds — no new `await` in any request
  handler.

---

## 15. Risks & Accepted Limitations

Merged and deduplicated from both design passes; ranked most-impactful first.
Seed for the `.agent-reviews/redteam.md` entry.

1. **`llm_call_payloads` is a new sensitive-data store.** Masking hides
   figures, not issuer names or strategy narrative. Mitigations:
   `llm_log_payloads` kill switch; payloads never leave Postgres (not on
   spans, not in logs, not in the vault export — `vault_export.py` renders
   run outputs, never telemetry); `masking_version` supports a future
   re-masking pass; retention policy explicitly deferred (§5.2) and tracked
   here as an open item.
2. **Queue drop or writer death understates the ledger.** Mitigated by the
   independent `caos.llm` log-line floor (§4.1); drop counter asserted zero
   in normal-load tests; the writer wraps each event in `try/except` so one
   poison event can't kill the loop; `drain_and_stop` flushes on shutdown;
   queue depth (1000) versus realistic concurrency (≤~10) makes overflow
   effectively unreachable outside a deliberate stress test.
3. **Consolidating the two stream lanes could silently drift their
   behavior** (adaptive-thinking pass-through, `pause_turn` continuation,
   sticky-degrade). Mitigation: `stream_final` passes `**kwargs` verbatim;
   `caos_used_model` preserves the stickiness both lanes already implement;
   §14.2 requires a golden test replaying each lane's exact call sequence
   pre/post migration.
4. **MCP misconfiguration could reintroduce agentic tools/writes on an
   existing lane.** Mitigated by the default-deny double allowlist (§3.3),
   the write-capable `edgar_fetch_and_vault` tool excluded from the default
   config, `wrap_untrusted` on every tool result, and the registry test
   (§14.1 pattern) making any `create_with_tools` caller a reviewed,
   diff-visible event — the same mechanism that already governs the 15
   existing LLM call sites.
5. **Unsalted 8-hex placeholders are dictionary-reversible for low-entropy
   figures** (`$1.0bn` hashes to the same 8 hex chars every time). Accepted:
   the telemetry DB shares its trust boundary with the raw source documents
   already in Postgres — masking defends the *export/log/OTLP* surfaces,
   which never carry payloads under this design. An optional future
   `MASK_SALT` (costs cross-record joinability) is the named upgrade path if
   payloads ever cross that boundary.
6. **Missed filesystem events on real deployments** (bind mounts, Docker
   Desktop, NFS) — inotify forwarding is environment-dependent (§11.1's
   flag). Mitigated structurally: the watcher is a latency optimization, not
   the sole correctness mechanism — reconcile-on-startup/-crash/-overflow
   (§9.4) is what actually guarantees convergence. A missed event persists
   only until the next reconcile trigger.
7. **The "surgical" embedding refresh is hash-level, not token-level.**
   `chunk_text`'s greedy packing means an edit near the top of a large file
   can shift every downstream chunk boundary, re-embedding most of the file
   for what was semantically a one-line change; a bulk find-replace across
   many memos could spike embedding-API spend. Mitigated by: honest statement
   here (no false "always cheap" claim); the serial single-consumer +
   batch-100 embed call + backoff naturally rate-limits; per-file event
   scope bounds the blast radius of any one edit.
8. **Legacy memo identity is fragile before adoption.** A memo renamed on
   disk *before* this spec ships resolves by stem only; if that stem no
   longer matches, the reconcile's orphan pass could create a duplicate
   doc-set rather than adopting the existing one. Mitigated: the orphan pass
   content-matches (chunk-multiset equality) against unresolved files before
   creating anything new — worst case is a shadowed duplicate, never data
   loss.
9. **The mock-embedding fix (§9.8) changes behavior on paths outside WS3** —
   the upload lanes and `run_warmup` now see a raised exception on live
   failure instead of a silent (wrong) success. This is the intended fix, but
   it must be called out as a behavior change in the PR, not buried in a
   vault-sync-only changelog entry, because it affects every embedding
   caller, not just the new sync lane.
10. **Migration-number collision with the unlanded OKF blueprint** (§13
    item 3) is a sequencing decision, not a technical one — flagging it here
    ensures it isn't silently resolved by whichever PR merges first without
    the other author noticing.
