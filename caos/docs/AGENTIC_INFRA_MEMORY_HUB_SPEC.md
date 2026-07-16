# Agentic Infrastructure and Memory Hub — Build Specification

**Status:** design-only implementation contract  
**Target implementer:** Opus 4.8  
**Evidence date:** 2026-07-15  
**Normative terms:** **MUST**, **MUST NOT**, **SHOULD**, and **MAY** have their RFC 2119 meanings.

This document consolidates existing CAOS infrastructure. It does not authorize a
second inference service, a second vector store, or a second document corpus. Code
blocks are target interfaces or pseudocode; they are not implementation scripts.

Every claim about current behavior cites a repository file read during the design
session. A choice that is not already present in code is labelled **Design choice**.
External prices and library behavior cite the provider documentation and MUST be
rechecked when implementation begins.

---

## 1. Scope, non-goals, and hard invariants

### 1.1 In scope

1. Route every generative and embedding provider call through
   `caos/server/engine/llm_client.py`.
2. Add opt-in native model tool calling whose tool discovery and execution use MCP.
3. Produce masked semantic telemetry, token accounting, dollar cost, and
   OpenTelemetry traces outside the primary request path.
4. Watch the human-edited Obsidian vault, converge changed Markdown chunks with the
   existing `documents`, `document_chunks`, and `document_chunk_embeddings` tables,
   and refresh only missing embeddings.

### 1.2 Out of scope

- No standalone gateway service, broker, workflow engine, scheduler, or durable sync
  job table.
- No provider-selection policy beyond the existing model-tier and same-provider
  fallback rules.
- No new vector database or metadata blob on every embedding row.
- No general two-way sync for generated `Runs/` or `Issuers/` notes.
- No write-capable MCP tool in the first release.
- No core orchestration scripts in this deliverable.

### 1.3 Hard invariants

| ID | Invariant | Enforced by |
|---|---|---|
| H1 | Relative to the current implementation, a successful non-tool LLM request MUST add no awaited I/O, blocking call, semaphore wait, deep copy/serialization, mask pass, hash pass, cost calculation, DB write, logger-handler call, or OTel SDK call. One shallow outer-container snapshot is allowed only to preserve the exact prompt for the queued event; Z4 requires the complete post-provider tail to be no slower than the current hash-plus-DB tail. | §4.5, §8, tests Z1–Z4 |
| H2 | Masking, trace construction/export, cost calculation, and embedding refresh MUST execute only after a non-blocking in-memory handoff. | §5, §7, §10 |
| H3 | The gateway MUST preserve the current provider-native request shape. It MUST NOT rewrite prompt text, roles, cache-control blocks, or forced structured-output tools. | §4.2–§4.4 |
| H4 | A vault sync transaction MUST never expose a live chunk without its active-model vector **when the document is vector-eligible**. If live egress is disabled, the explicit expected state is BM25-only. If an eligible embedding generation fails, the old live chunk set remains committed and the file is retried. | §10.5 |
| H5 | A cited chunk MUST never be deleted. It is shadowed from retrieval and remains addressable by id. | §10.4, §10.6 |
| H6 | Generated vault families remain CAOS-canonical; human-authored families are file-canonical. | §9.1 |
| H7 | Unknown model pricing MUST produce `cost = NULL`, never an invented default. | §6.4 |

**Meaning of “zero added latency.”** H1 is the measurable acceptance definition. The provider
network call and prompt conversion required by that provider remain on the hot path.
Fallback sleep occurs only after a failed/overloaded attempt. MCP execution occurs
only when a caller explicitly selects `create_with_tools`; it is part of that lane’s
requested work, not telemetry overhead.

---

## 2. Current-state evidence map

| Area | Current fact | Grounding read this session |
|---|---|---|
| Gateway | `llm_client.create` already routes Anthropic, Gemini, and OpenRouter and applies same-provider fallback. It also hashes prompts and awaits `budget.trace_llm`. | `caos/server/engine/llm_client.py:79-90,93-107,110-276` |
| Call sites | The safety registry contains 15 reviewed generative files. Three generative paths still call provider APIs directly: synth advisor, deep-research streaming, and research-report streaming. Embeddings are a fourth provider bypass. | `caos/tests/server/test_llm_safety.py:144-187`; `caos/server/engine/synth.py:550`; `caos/server/deepresearch.py:268`; `caos/server/research_report.py:951`; `caos/server/engine/embeddings.py:28-64` |
| Gemini adapter | Gemini already converts Anthropic-shaped system/messages, normalizes responses, and supports only a forced single tool; dynamic/multi-tool input raises `GeminiUnsupported`. | `caos/server/engine/gemini.py:67-91,124-201,205-246` |
| OpenRouter adapter | OpenRouter translates simple Anthropic-shaped text messages/tools and normalizes returned tool calls, but it drops returned tool-call ids and flattens non-text history, so it cannot execute a second tool round. Parallel current work already retains a validated `usage.cost`. | `caos/server/engine/openrouter.py:15-29,37-86,88-144` |
| Model tiers | TEST/LITE/BALANCED/MAX map lanes to `cheap`, `fast`, `strong`, and `top`; configured defaults are DeepSeek Flash, DeepSeek Flash, DeepSeek Pro, and Claude Opus 4.8. | `caos/server/engine/presets.py:56-80,145-188`; `caos/server/config.py:117-127` |
| Current telemetry | `trace_llm` performs budget accrual, incorrect hard-coded cost calculation, structured logging, and an awaited DB commit on the caller coroutine. | `caos/server/engine/budget.py:81-109,112-181` |
| Telemetry table | `llm_call_records` exists with run/lane/model/hash/token/cost/status/latency fields. | `caos/server/database.py:1340-1358` |
| Vectors | Embeddings are keyed uniquely by `(model, chunk_hash)` in pgvector `vector(768)`; retrieval joins through chunk hash and filters by active model. | `caos/server/database.py:1389-1408`; `caos/server/retrieval.py:192-288,328-466,489-590` |
| Embedding policy | Current code defaults to `gemini-embedding-2` at 768 dimensions and fails closed on missing egress consent/key, provider failure, or malformed vectors; it never persists mock vectors under a live id. It still sends multiple Content objects in one request even though Embedding 2 aggregates them, unconditionally excludes analyst memos, uses plain inserts, and bypasses the gateway. | `caos/server/config.py:129-136`; `caos/server/engine/embeddings.py:28-74,77-139,142-206` |
| Vault write/read lanes | CAOS writes generated notes and analyst memos. `sync_analyst_memos` scans files to rebuild links only; it does not re-chunk edited files. | `caos/server/vault_export.py:203-224,314-568`; `caos/server/engine/memochunks.py:72-147`; `caos/server/routes/ingestion.py:525-625` |
| Chunk recipe | Existing ingestion uses `chunk_text` with a 512-token target and 64-token overlap; chunk identity is SHA-256 of exact chunk text. | `caos/server/ingest.py:276-368`; `caos/server/engine/memochunks.py:98-132` |
| Citation FKs | Evidence and metric facts can point to `document_chunks.id`; deleting a cited chunk is unsafe. | `caos/server/database.py:552-604` |
| Deployment | `WEB_CONCURRENCY` may create multiple Uvicorn worker processes on Postgres; SQLite is explicitly limited to one. | `caos/server/run.py:6-15,26-44`; `caos/deploy/docker-compose.yml:69` |
| MCP | The repository contains a stdio FastMCP EDGAR server with three read tools and one write tool. | `caos/mcp/edgar/server.py:1-103`; `caos/mcp/edgar/pyproject.toml` |
| OKF | `PDF_INGESTION_OKF_BLUEPRINT.md` is a design blueprint; no `okf_*.py` implementation exists, so `Sources/` is not current runtime behavior. This specification can only ground a manual-edit lane in that documented file/frontmatter contract. | `caos/docs/PDF_INGESTION_OKF_BLUEPRINT.md:42-56,725-751`; repository file search on 2026-07-15 |

The exact current generative registry is
`engine/{llm_client,llm_safety,council,debate,synth,queryoverlay,queryinsights,queryanswer,rerank,entailment}.py`
plus `llm.py`, `nlquery.py`, `scenario.py`, `deepresearch.py`, and
`research_report.py`; `tests/server/test_llm_safety.py:160-187` enforces that set.
Of these, synth advisor and the two streaming files are the direct Anthropic
bypasses identified above. The separate embedding call and its query/background
consumers are in `engine/embeddings.py` and `retrieval.py`. Phase A extends that
registry so any future raw provider call outside `llm_client.py`, `gemini.py`, or
`openrouter.py` fails CI.

### 2.1 Critical prerequisite: complete the partial embedding-model migration

Parallel current work has already changed the code default to `gemini-embedding-2`,
kept dimension 768, and requested `output_dimensionality=768`
(`caos/server/config.py:129-136`; `caos/server/engine/embeddings.py:48-59`). That is
only a partial migration: Google lists `text-embedding-004` and
`gemini-embedding-001` as shut down, and Embedding 2 aggregates multiple inputs into
one vector. The current single-call/multiple-Content implementation at
`engine/embeddings.py:48-67` is therefore not the required one-vector-per-text
contract. Its space is also incompatible with prior models, so any egress-enabled
installation MUST prove all live hashes are backfilled under the new model before
serving new-model vector retrieval. Egress-disabled installations remain BM25-only.

External grounding: [Gemini embeddings documentation](https://ai.google.dev/gemini-api/docs/embeddings),
[Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations?hl=en).

---

## 3. Target topology

```text
HOT PATH
caller
  -> engine/llm_client.py
       -> existing model-tier resolution
       -> provider adapter / native Anthropic call
       -> provider network
       -> budget.record_usage (existing ContextVar arithmetic)
       -> telemetry_queue.put_nowait(event with owned prompt envelope)
  <- response

BACKGROUND TASK A: telemetry writer (per Uvicorn worker)
  queue -> bounded payload + usage normalization -> mask payload -> calculate cost
        -> synthesize OTel spans
        -> batch INSERT llm_call_records + llm_call_payloads -> OTLP batch exporter

BACKGROUND TASK B: vault leader (exactly one process)
  watchfiles -> bounded event queue -> quiet-window coalescer -> file/chunk diff
             -> generate only missing vectors -> atomic DB convergence

OPT-IN TOOL PATH
  llm_client.create_with_tools -> provider-native tool request
                               -> mcp_router -> allowed MCP server tool
                               -> wrapped tool_result -> next model turn
```

**Design choice:** keep the gateway in-process and retain the existing module name.
The current call graph already converges on `engine/llm_client.py`; a network gateway
would add a second failure boundary and request latency without satisfying any stated
requirement.

Only these modules are added:

| Module | Purpose |
|---|---|
| `caos/server/engine/telemetry.py` | Event types, bounded queue, background mask/cost/DB/OTel writer |
| `caos/server/engine/telemetry_mask.py` | Pure financial-figure masker |
| `caos/server/engine/llm_pricing.py` | Versioned in-code rate card and cost function |
| `caos/server/engine/mcp_router.py` | One MCP registry/session manager and default-deny dispatch |
| `caos/server/vault_sync.py` | Leader election, watcher queue, reconcile, chunk/vector convergence |

One additive migration, `0063_agentic_infra_memory_hub.py`, contains all schema
changes in §5 and §11. The migration directory’s current workspace head is `0062`
(`0062_sector_review_version.py`, down-revision `0061`) as of the evidence date. The
implementer MUST re-run `alembic heads`; if head changed, only
the revision number/down-revision changes—this schema contract does not.

---

## 4. Workstream 1 — centralized gateway and MCP router

### 4.1 Public gateway contract

`engine/llm_client.py` remains the only lane-facing provider seam.

```python
async def create(
    client,
    *,
    lane: str,
    model: str | None = None,
    fallback_model: str | None = None,
    effort: str | None = None,
    betas: list[str] | None = None,
    **kwargs,
) -> Message: ...

async def stream_final(
    client,
    *,
    lane: str,
    model: str,
    fallback_model: str | None = None,
    effort: str | None = None,
    **kwargs,
) -> StreamResult: ...  # {message, used_model, fallback}

async def embed(
    texts: list[str],
    *,
    lane: str = "embedding",
) -> EmbeddingBatch: ...

async def create_with_tools(
    client,
    *,
    lane: str,
    allowed_tools: list[str],
    model: str | None = None,
    fallback_model: str | None = None,
    effort: str | None = None,
    **kwargs,
) -> ToolRunResult: ...

@dataclass(frozen=True, slots=True)
class ToolCall:
    id: str
    qualified_name: str
    arguments: dict[str, Any]

@dataclass(frozen=True, slots=True)
class ToolRunResult:
    message: Message
    status: Literal["completed", "max_tool_turns"]
    used_model: str
    fallback: bool
```

`create` is a strict superset of the existing signature at
`engine/llm_client.py:204-212`. `betas` selects `client.beta.messages.create` and
exists only to absorb the direct synth advisor call at `engine/synth.py:550-562`.
If that call does not explicitly pass `fallback_model`, it MUST preserve its current
no-fallback behavior.

`stream_final` absorbs the direct stream calls at `deepresearch.py:268` and
`research_report.py:951`; it MUST preserve `get_final_message()`, adaptive-thinking
arguments, pause-turn continuation, and sticky fallback model behavior. It returns
`StreamResult(message, used_model, fallback)`. Both callers MUST rebind their local
`model = result.used_model` before a pause-turn or repair call; deep research currently
persists that rebound model across continuations (`deepresearch.py:263-331`) and the
report repair currently reuses it (`research_report.py:950-972,1019-1026`).

`embed` moves `client.aio.models.embed_content` from `engine/embeddings.py:48` into
`engine/gemini.py`; the gateway owns telemetry, while the adapter owns the Google
request shape. `EmbeddingBatch` contains `vectors`, actual `model`,
`provider="google"`, `origin="live"`, and raw usage for background telemetry; it is
returned only after the adapter's cardinality/dimension/finite validation in §10.7.

### 4.2 Canonical prompt envelope and formatting

The gateway input contract is the Anthropic-shaped object already used by all
callers:

```python
@dataclass(slots=True)
class PromptEnvelope:
    system: str | list[dict] | None
    messages: list[dict]
    tools: list[dict]
    tool_choice: dict | None
    max_tokens: int | None
```

The gateway MUST pass these original containers to the provider adapter unchanged.
Immediately before that call, it takes a shallow snapshot of only the outer
`system`/`messages`/`tools` lists for the eventual queue event. This protects against
the top-level `messages.append(...)` performed after a stream turn
(`deepresearch.py:329-331`; `research_report.py:991-1018`) while preserving the
provider-native list shape. Nested dicts/blocks are immutable-by-contract after the
call begins; callers MUST create replacement objects rather than mutate them. No deep
copy, JSON encoding, string rendering, or second provider formatting is permitted on
the hot path. The shallow snapshot is the only allowed prompt-capture work and is
covered by Z4's no-slower-than-current gate.

Provider formatting rules are fixed:

| Provider | Formatting rule | Grounding |
|---|---|---|
| Anthropic | Pass `system`, `messages`, `tools`, and `tool_choice` unchanged. Preserve cache-control blocks. | Current pass-through in `engine/llm_client.py:204-276` |
| Gemini | Reuse `_system_text`, `_to_contents`, and `_thinking_config`; assistant maps to `model`. No new prompt template. | `engine/gemini.py:67-121` |
| OpenRouter | Retain `_translate_tools` and the leading system message, but replace the lossy non-text branch in `_translate_messages` with the exact assistant-tool/user-result mapping in §4.6. | `engine/openrouter.py:37-86` |

**Design choice:** prompt formatting is provider-adapter work, not a configurable
template layer. There is no user requirement for prompt version management, and the
existing adapters already define the required translations.

### 4.3 Internal execution record

One public gateway invocation produces one `LLMCallEvent`, including a multi-turn MCP
interaction. An internal `_execute_attempt` performs one provider attempt and appends
an immutable step:

```python
@dataclass(frozen=True, slots=True)
class ExecutionStep:
    ordinal: int
    kind: Literal["model", "mcp_tool"]
    provider: str
    model_or_tool: str
    started_ns: int
    ended_ns: int
    fallback: bool
    usage_raw: Any | None
    provider_cost_usd_raw: Any | None
    stop_reason: str | None
    status: Literal["success", "failed"]
    error_class: str | None
    http_status: int | None
    input_raw: Any | None       # MCP args, or model-turn delta when applicable
    output_raw: Any | None      # MCP result, tool call, or intermediate model content

@dataclass(frozen=True, slots=True)
class LLMCallEvent:
    llm_call_id: str            # UUID; becomes LLMCallRecord.id
    lane: str
    run_id: str | None
    model_mode: str | None
    requested_model: str
    prompt_raw: PromptSnapshot  # shallow outer-container snapshot from §4.2
    completion_raw: Any | None
    steps: tuple[ExecutionStep, ...]
    started_ns: int
    ended_ns: int
    status: Literal["success", "failed"]
```

For an MCP step, set `provider="mcp:<server>"` and `model_or_tool` to the qualified
`<server>__<tool>` name. Discovery/list calls are router lifecycle work, not model
execution steps; an actual tool call, success or error, is one step.

`create_with_tools` MUST call `_execute_attempt` directly; it MUST NOT call public
`create`, or it would emit one record per turn rather than one complete execution
path. Standard `create`, `stream_final`, and `embed` produce one logical event with
one or more provider attempts (primary plus fallback/retries).

### 4.4 Rate-limit and fallback policy

Preserve the existing success path: one primary attempt. Only exceptions classified
by the existing provider classifiers are retryable:

- Anthropic/httpx: 429, 502, 503, 529
  (`engine/llm_client.py:62-76`).
- Gemini: 429/500/503 or `RESOURCE_EXHAUSTED`/`UNAVAILABLE`
  (`engine/gemini.py:249-261`).
- OpenRouter: 429/502/503/529 (`engine/openrouter.py:175-179`).

On a retryable primary failure, preserve each current lane's retry cardinality:

1. Select the existing same-provider fallback; never hand a provider a foreign model
   id (`engine/llm_client.py:118-125,168-173,261-270`).
2. Anthropic plain `create`: the fallback gets its initial attempt plus up to three
   retries. If `Retry-After` is present, wait `min(parsed_seconds, 8)`; otherwise use
   the existing 1, 2, 4 second schedule with ±10% jitter
   (`engine/llm_client.py:242-270`).
3. Gemini/OpenRouter plain `create`: one primary plus one fallback attempt, with no
   retry loop (`engine/llm_client.py:137-150,183-193`).
4. `stream_final`: one primary plus one fallback attempt. A fallback overload is
   re-raised so deep research can preserve its current partial-result/demo degradation
   (`deepresearch.py:282-311`); research report preserves its current raise behavior
   (`research_report.py:963-972`).
5. Embedding refresh is already background work and MAY use the 1, 2, 4 second retry
   schedule before requeuing the file; it cannot affect a primary request.
6. Set the active `RunBudget.degraded` flag on fallback, preserving current behavior
   (`engine/llm_client.py:151-156,194-199,271-274`).
7. Non-retryable failures re-raise immediately.

No new concurrency semaphore is allowed. A semaphore can delay a healthy request and
would violate H1. Provider admission control is a later capacity concern, not a
requirement of this consolidation.

### 4.5 Non-blocking telemetry handoff

After the final response/error, the gateway performs only:

1. Existing `budget.record_usage(response)` ContextVar arithmetic.
2. Construct an `LLMCallEvent` from the shallow outer-container snapshot and steps.
3. `telemetry.enqueue_nowait(event)`.

`enqueue_nowait` MUST use `asyncio.Queue.put_nowait`. Queue full MUST increment an
in-memory drop counter; it MUST NOT call a logging handler, await, retry, serialize,
or write a fallback file. The background writer periodically emits the drop counter
and the fixed-field `caos.llm` record. This explicitly trades lossless telemetry for
H1. All existing success-path `await budget.trace_llm(...)` calls in
`llm_client.py`, `synth.py`, `deepresearch.py`, and `research_report.py` MUST be
removed; `budget.record_usage` remains synchronous and `trace_llm` becomes a
compatibility wrapper around the non-blocking enqueue only if a temporary migration
requires it.

### 4.6 MCP router

Only one new setting is permitted:

```python
mcp_servers_json: str = ""
```

Schema:

```json
{
  "edgar": {
    "command": "python",
    "args": ["/app/mcp/edgar/server.py"],
    "env_names": ["CAOS_API_BASE", "CAOS_ANALYST_EMAIL", "EDGE_PROXY_SECRET"],
    "lane_tools": {
      "research:legal": [
        "edgar__edgar_search",
        "edgar__edgar_issuer_filings",
        "edgar__edgar_list_exhibits"
      ]
    }
  }
}
```

The empty default exposes no tools. The router MUST:

1. Lazily open one stdio MCP session per configured server per worker and cache the
   `list_tools` result. A broken session gets one reconnect on the next call.
2. Qualify each unqualified `list_tools` result as `<server>__<tool>` immediately.
   `lane_tools` and caller `allowed_tools` MUST already use qualified names; qualified
   names are the sole internal/external router identity.
3. Intersect the three qualified sets before exposing a schema: qualified discovered
   tools, `lane_tools[lane]`, and caller `allowed_tools`. Absence at any layer denies.
4. Convert the discovered MCP schema to each provider’s native tool schema.
5. Execute only a tool name present in that exact exposed set.
6. Wrap every returned/error payload with `llm_safety.wrap_untrusted` before adding a
   model `tool_result`; web/filing text is untrusted input. The existing safety
   wrapper is in `engine/llm_safety.py` and OpenRouter already fail-closes malformed
   tool arguments at `engine/openrouter.py:102-117`.
7. Stop after five model tool rounds (constant, not a setting). If the limit is hit,
   return status `max_tool_turns` with the last model message; do not execute another
   tool.

The executable round-trip contract is exact:

1. A provider adapter converts every returned native call into
   `ToolCall(id=<provider id>, qualified_name=<exposed name>, arguments=<finite JSON
   object>)`. Missing/blank ids or malformed/non-object arguments fail that model
   attempt; the router MUST NOT invent an id. Anthropic preserves each
   `tool_use.id/name/input`. OpenRouter `_ToolUseBlock` MUST retain `tc["id"]` in
   addition to name/input.
2. The router dispatches only the canonical qualified name and appends the assistant
   message plus one wrapped result per call. A tool execution error becomes a
   wrapped error `tool_result` for that same id and may be shown to the model; it is
   not silently retried and is recorded as a failed MCP execution step.
   Normalize `CallToolResult` to canonical JSON
   `{"ok":<not isError>,"content":<structuredContent or ordered text contents>}`
   and then call `wrap_untrusted` on that JSON string. V1 accepts MCP
   `structuredContent` and `TextContent`; image/resource content produces the fixed
   wrapped error `unsupported_mcp_content` rather than invented binary rendering. A
   dispatch exception becomes
   `{"ok":false,"error_class":"<validated class name>"}`; never include
   `str(exc)`, `repr(exc)`, or a traceback.
3. Anthropic receives its native assistant `tool_use` blocks followed by a user
   message containing matching `tool_result.tool_use_id` blocks.
4. OpenRouter `_translate_messages` converts an Anthropic-shaped assistant content
   list into one OpenAI assistant message whose `content` contains joined text and
   whose `tool_calls` contains
   `{id,type:"function",function:{name,arguments}}`; `arguments` is canonical JSON.
   Each Anthropic-shaped user `tool_result` block becomes a separate OpenAI
   `{role:"tool",tool_call_id:<id>,content:<wrapped result text>}` message. It MUST
   NOT flatten or discard either block family.
5. A model response without tool calls returns
   `ToolRunResult(status="completed", message=..., used_model=..., fallback=...)`.
   After the fifth response that requests tools, return the last response as
   `status="max_tool_turns"` without executing those calls. Terminal provider
   errors still raise under §4.4; they are not represented as a successful result.

Golden tests MUST execute a two-round tool exchange through both Anthropic and
OpenRouter and assert id preservation, argument equality, wrapped-result placement,
the second provider request body, terminal status, model stickiness, and the
five-round cap. Gemini MUST fail before any provider or MCP network call.

Anthropic and OpenRouter dynamic tools are supported in v1. Gemini dynamic MCP tools
MUST raise `GeminiUnsupported` before a network call because its adapter currently
discards tool-result blocks and explicitly rejects non-forced/multi-tool requests
(`engine/gemini.py:79-91,205-246`). Forced structured-output tools continue through
plain `create` and are returned unexecuted.

The EDGAR server’s write-capable `edgar_fetch_and_vault` tool is excluded in v1
(`caos/mcp/edgar/server.py:84-99`). The implementation MUST also pass the existing
`EDGE_PROXY_SECRET` environment value into the child and change
`caos/mcp/edgar/server.py` so `_headers()` sends it as `X-Edge-Authorization` in
addition to the optional analyst email. The secret value MUST NOT enter tool output,
telemetry payloads, or logs. Direct localhost API requests otherwise fail the
deployed edge-proof middleware (`caos/server/main.py:299-315`; `config.py:50-55`).
The Docker image currently copies only the server
tree, so shipping EDGAR MCP also requires copying `caos/mcp/edgar/` and adding its
declared `mcp` dependency.

No existing lane is enabled for `create_with_tools` by this specification. The router
ships dark until a separately reviewed caller supplies `allowed_tools` and config
supplies the same lane/tool pair.

---

## 5. Workstream 2 — semantic telemetry schema and queue

### 5.1 Event queue

`engine/telemetry.py` owns one bounded queue per Uvicorn worker:

```python
TELEMETRY_QUEUE_MAX = 4096
TELEMETRY_BATCH_MAX = 32
TELEMETRY_BATCH_WAIT_MS = 100
PAYLOAD_MAX_CHARS = 200_000
OTEL_EVENT_MAX_CHARS = 16_384

_queue: asyncio.Queue[LLMCallEvent]

def enqueue_nowait(event: LLMCallEvent) -> None: ...
async def writer_loop() -> None: ...
async def flush_for_tests() -> None: ...
async def drain_and_stop(timeout_s: float = 5.0) -> None: ...
```

The writer drains at most 32 events or waits at most 100 ms, then processes each
event independently before one batch transaction. A poison event is logged by id and
discarded; it MUST NOT terminate the loop or roll back unrelated valid events.

### 5.2 `llm_call_records` columns

Keep all existing columns in `database.py:1340-1358`. `cost` is USD. Add:

| Column | SQLAlchemy type | Null | Meaning |
|---|---|---:|---|
| `provider` | `String(16)` | no | final provider: `anthropic`, `gemini`, `openrouter`, `google` |
| `requested_model` | `String(128)` | no | model before fallback |
| `model_mode` | `String(16)` | yes | current preset mode |
| `fallback` | `Boolean` | no | any model fallback occurred |
| `cache_read_tokens` | `Integer` | yes | disjoint cache-read input tokens |
| `cache_write_5m_tokens` | `Integer` | yes | disjoint five-minute cache writes |
| `cache_write_1h_tokens` | `Integer` | yes | disjoint one-hour cache writes |
| `cache_write_other_tokens` | `Integer` | yes | cache writes whose TTL cannot be proven |
| `cost_source` | `String(16)` | yes | `provider`, `matrix`, `mixed`, or NULL |
| `rate_card_version` | `String(10)` | yes | `2026-07-15` when matrix-priced |
| `stop_reason` | `String(32)` | yes | final normalized stop reason |
| `step_count` | `Integer` | no | execution-path length |
| `trace_id` | `String(32)`, indexed | yes | background-created OTel trace id |
| `span_id` | `String(16)` | yes | background-created root span id |

Existing `model` stores the final actual model. Existing `prompt_tokens` stores total
processed input (`uncached + cache reads + both cache writes`), matching the current
budget semantics at `engine/budget.py:81-90`. Existing `completion_tokens` stores the
sum across billed model steps. Existing `error` stores only exception class plus HTTP
status, never `str(exc)`.

### 5.3 New `llm_call_payloads` table

```python
class LLMCallPayload(Base):
    __tablename__ = "llm_call_payloads"

    llm_call_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("llm_call_records.id", ondelete="CASCADE"),
        primary_key=True,
    )
    prompt_masked: Mapped[str | None] = mapped_column(Text)
    completion_masked: Mapped[str | None] = mapped_column(Text)
    execution_path_masked: Mapped[str | None] = mapped_column(Text)
    masking_version: Mapped[str] = mapped_column(String(32), nullable=False)
    masked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    truncated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
```

Each payload text field contains canonical JSON, not arbitrary prose. Payload rows are
one-to-one with records. A new setting
`llm_log_payloads: bool = True` is the kill switch: false retains aggregate records
and OTel metadata but omits payload rows and OTel prompt/completion events.

### 5.4 Logical-record semantics

- One `create`, `stream_final`, or `embed` invocation = one record.
- One `create_with_tools` invocation = one record containing every model attempt and
  MCP call in `execution_path_masked`.
- Token and cost totals include every step whose provider reports usage, including a
  billed failed/fallback attempt.
- The final actual provider/model populate the top-level record. Per-step models are
  retained in the path.
- A terminal failure still creates a record with `status="failed"` and a sanitized
  error descriptor.

---

## 6. Per-model-tier token cost matrix

### 6.1 Normalized usage contract

```python
@dataclass(frozen=True, slots=True)
class NormalizedUsage:
    input_uncached_tokens: int
    output_tokens: int
    cache_read_tokens: int = 0
    cache_write_5m_tokens: int = 0
    cache_write_1h_tokens: int = 0
    cache_write_other_tokens: int = 0
    provider_cost_usd: Decimal | None = None
    server_tool_counts: Mapping[str, int] = field(default_factory=dict)
```

The six token buckets are disjoint and are constructed only in the background writer:

- Anthropic: `input_tokens` is uncached input;
  `cache_read_input_tokens` is cache read. Prefer nested
  `cache_creation.ephemeral_5m_input_tokens` and
  `cache_creation.ephemeral_1h_input_tokens`; if only aggregate
  `cache_creation_input_tokens` exists, put it in `cache_write_other_tokens` rather
  than guessing a TTL. The current budget already treats input/cache fields as
  separate processed-token buckets (`engine/budget.py:81-90`).
- OpenRouter: usage is returned automatically; the former `usage.include` request
  option is deprecated and MUST NOT be added. Parallel current code already reads a
  finite, non-negative `usage.cost` (`engine/openrouter.py:130-144`); preserve it as
  the only provider-exact cost for that routed request. Also read cached tokens and
  aggregate cache-write tokens. Compute uncached input as
  `max(prompt_tokens - cached_tokens - cache_write_tokens, 0)` and put aggregate
  writes in `cache_write_other_tokens` because no 5m/1h split is reported. The
  current adapter ignores all of these details at `engine/openrouter.py:128-132`.
- Gemini: `prompt_token_count` includes cached content, so retain the current
  subtraction in `engine/gemini.py:175-190`; candidates plus thoughts are output.
- Gemini embedding: a normal `EmbedContentResponse` has no input-token usage field.
  After producing the masked in-memory copy but before dropping raw references, the
  telemetry writer calls `models.count_tokens(model="gemini-embedding-2",
  contents=<the exact one-text Content>)` for each embedding step and uses returned
  `total_tokens` as uncached input. This metering call is never awaited by the query
  or embedding caller and produces no nested telemetry record. If exact counting
  fails, that step's cost is NULL; character-count heuristics are forbidden.
  Grounding: [Gemini countTokens API](https://ai.google.dev/api/tokens) and
  [EmbedContent response](https://ai.google.dev/api/embeddings).

Anthropic advisor responses require iteration expansion. When `usage.iterations` is
present, ignore top-level usage for telemetry token/cost aggregation and create one
pricing step per iteration: `type="message"` uses the executor model;
`type="advisor_message"` uses the iteration's own `model`. This avoids both omission
and double counting; the current hot-path budget already recognizes advisor entries
at `engine/budget.py:93-109`. Top-level usage is used only when iterations are absent.
The background writer also emits one synthetic execution-path child and one OTel
child span per iteration; no iteration parsing occurs before dequeue.

Normalize `usage.server_tool_use.web_search_requests` into
`server_tool_counts["anthropic.web_search"]`. Other unknown server-tool counters are
recorded in the execution path but make total cost NULL until a rate exists.

Missing fields are zero, never inferred. Provider-native usage objects are queued by
reference; no `NormalizedUsage` or `Decimal` is constructed before dequeue.

External usage-shape grounding:
[OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting),
[Anthropic advisor usage](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool).

### 6.2 Tier-to-model matrix

Rates are USD per million tokens and are versioned `2026-07-15`.

| Tier | Current configured primary | Primary input | Cache read | Cache write 5m | Cache write 1h | Output | Default runtime overload fallback |
|---|---|---:|---:|---:|---:|---:|---|
| `cheap` | `deepseek/deepseek-v4-flash` | 0.098 | 0.020 | — | — | 0.196 | none distinct: cheap is already Flash |
| `fast` | `deepseek/deepseek-v4-flash` | 0.098 | 0.020 | — | — | 0.196 | none distinct: cheap and fast currently share Flash |
| `strong` | `deepseek/deepseek-v4-pro` | 0.435 | 0.003625 | — | — | 0.870 | `deepseek/deepseek-v4-flash` |
| `top` | `claude-opus-4-8` | 5.000 | 0.500 | 6.250 | 10.000 | 25.000 | `claude-sonnet-4-6` |

Tier/model grounding: `caos/server/config.py:117-127` and
`caos/server/engine/presets.py:56-80,145-188`. The DeepSeek figures are a dated
operator reference and satisfy the requested per-tier matrix; they are **not** a
per-request fallback for an OpenRouter-routed call because OpenRouter may choose a
provider with a different price. Provider-reported `usage.cost` is authoritative:
[OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting).

Do not confuse runtime overload fallback with preset key degradation.
`presets._ANTHROPIC_FALLBACK` maps cheap→Haiku, fast/strong→Sonnet, and top→Opus
when an Anthropic key is available (`engine/presets.py:73-80,167-188`). If the
selected provider key is absent and Anthropic is also absent, `_configured_fallback`
scans configured tiers for the first provider with a key. The gateway runtime path is
different: OpenRouter defaults to the configured cheap tier and Anthropic defaults to
`synth_executor_model` (`engine/llm_client.py:168-173,235-270`).

### 6.3 Supplemental configured-provider rates

| Model/rule | Input | Cache read | Cache write 5m | Cache write 1h | Output |
|---|---:|---:|---:|---:|---:|
| `claude-opus-4-8` | 5.00 | 0.50 | 6.25 | 10.00 | 25.00 |
| `claude-sonnet-4-6` | 3.00 | 0.30 | 3.75 | 6.00 | 15.00 |
| `claude-haiku-4-5*` | 1.00 | 0.10 | 1.25 | 2.00 | 5.00 |
| `claude-sonnet-5*` through 2026-08-31 | 2.00 | 0.20 | 2.50 | 4.00 | 10.00 |
| `claude-sonnet-5*` from 2026-09-01 | 3.00 | 0.30 | 3.75 | 6.00 | 15.00 |
| `gemini-2.5-pro`, input ≤200k | 1.25 | 0.125 | — | — | 10.00 |
| `gemini-2.5-pro`, input >200k | 2.50 | 0.250 | — | — | 15.00 |
| `gemini-2.5-flash` | 0.30 | 0.03 | — | — | 2.50 |
| `gemini-2.5-flash-lite` | 0.10 | 0.01 | — | — | 0.40 |
| `gemini-embedding-2` text input | 0.20 | — | — | — | 0.00 |

External grounding: [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing),
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing?authuser=2).

Non-token request adder, rate-card version `2026-07-15`:

| Counter | Unit rate |
|---|---:|
| `anthropic.web_search` | $0.01 per search request ($10 per 1,000) |

Grounding: [Anthropic web-search pricing](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).

### 6.4 Cost algorithm

`engine/llm_pricing.py` MUST use `Decimal` values constructed from strings:

```text
step_matrix_cost = (
    input_uncached_tokens * input_rate
  + cache_read_tokens * cache_read_rate
  + cache_write_5m_tokens * cache_write_5m_rate
  + cache_write_1h_tokens * cache_write_1h_rate
  + output_tokens * output_rate
) / 1_000_000
```

Rules, in order:

1. Price each model step independently. If that step reports a finite, non-negative
   dollar cost, use it; do not also matrix-price that step.
2. If an OpenRouter model step has nonzero usage but no provider-reported cost, its
   cost and the complete interaction cost are NULL. The DeepSeek tier figures in
   §6.2 MUST NOT be used. A future exact fallback is permitted only when the response
   identifies the actual upstream provider and the versioned rate card contains that
   exact `(openrouter upstream provider, model)` pair; v1 contains no such rows.
3. For non-OpenRouter steps, otherwise resolve an exact id or declared
   version-prefix. For Gemini Pro, choose
   the 200k band from that step's input, not the aggregate interaction. For Sonnet 5,
   choose the date-effective row from that step's `started_ns`.
4. A nonzero token bucket with no applicable rate—including
   `cache_write_other_tokens`—makes the entire interaction `cost=NULL`; partial totals
   are forbidden. Unknown model has the same outcome and emits a rate-limited warning.
5. Add every known server-tool count × its unit rate. A nonzero unknown counter makes
   the total NULL under the same no-partial-cost rule.
6. If every usage-bearing step/tool is priced, sum step and tool costs. A priced
   server-tool fee is a rate-card contribution. Stamp `provider` only when every
   contribution is provider-reported, `matrix` only when every contribution uses the
   rate card, or `mixed` when both sources contribute. Stamp
   `rate_card_version="2026-07-15"` whenever any model step or server tool is
   matrix-priced.
7. Persist `float(cost_decimal)` in the existing Float `cost` column; tests compare at
   1e-9 USD tolerance. Changing the established column type is unnecessary scope.

This replaces the incorrect catch-all Sonnet pricing in
`engine/budget.py:135-146` and runs only in the background writer.

---

## 7. Financial-figure masking and OpenTelemetry

### 7.0 Background JSON normalization

`engine/telemetry.py` MUST normalize provider/SDK objects before the pure masker. No
new abstraction or module is needed:

```python
JSON_NORMALIZE_MAX_DEPTH = 64
JSON_NORMALIZE_MAX_NODES = 100_000
_NON_FINITE_NUMBER = object()  # private intermediate; masker consumes it

def to_json_value(value: Any) -> NormalizedJSONValue: ...
```

This function runs only after dequeue and has this closed type contract:

- preserve `None`, booleans, strings, and finite integer/float primitives; convert a
  non-finite float to `_NON_FINITE_NUMBER`, which the masker replaces with
  `[MASKED_NUM]` before any encoding;
- convert `Decimal` to its non-exponent canonical decimal string, and
  `date`/`datetime`/`UUID` to canonical ISO/string forms;
- recurse through `Mapping` keys/values and `list`/`tuple`; keys may be existing
  strings or the preceding JSON-safe scalar types and are converted by explicit
  type rules, never by a general `str(obj)` fallback;
- for Pydantic objects, recurse through `model_dump(mode="python")`; for dataclasses,
  recurse through declared fields; for the repository's simple provider DTOs,
  recurse through public, non-callable entries of `vars(obj)` only;
- never call a property, arbitrary iterator, `str`, or `repr` on an unsupported
  object.

Track active container/object identities for cycle detection, current depth, and a
single node counter. A cycle, an unsupported value/key, depth >64, or node count
>100,000 poisons only that telemetry event. The writer first drops every raw
reference, then emits a fixed-field event containing only `llm_call_id` and reason
enum (`unsupported_type`, `cycle`, `depth`, or `nodes`); it MUST NOT stringify the
offending object or terminate/roll back the rest of the batch.

### 7.1 Masking contract

`engine/telemetry_mask.py` is a pure recursive transform:

```python
MASKING_VERSION = "financial-v1"

def mask_payload(value: Any) -> tuple[Any, int]: ...
```

It MUST preserve JSON shape and replace every non-boolean numeric leaf and every
numeric string fragment with a non-correlatable class token. Integer/float/Decimal
leaves become `[MASKED_NUM]`; non-finite floats do too. Booleans are preserved.

| Detection order | Examples | Replacement |
|---:|---|---|
| 1 | `$1,250.4m`, `EUR 40bn`, `(£12.5 million)` | `[MASKED_AMT]` |
| 2 | `1,250m`, `4.2 billion`, `750k` when a scale suffix exists | `[MASKED_AMT]` |
| 3 | `42.5%`, `(3.0)%` | `[MASKED_PCT]` |
| 4 | `5.7x`, `5.7×` | `[MASKED_MULT]` |
| 5 | `+125 bps`, `-75bp` | `[MASKED_BPS]` |
| 6 | every remaining numeric lexeme, including small/bare figures such as `EBITDA 125` | `[MASKED_NUM]` |

Classification is deterministic. Use the exact numeric core
`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`; allow one leading `+`/`-` or balanced
parentheses around either the numeric core or the complete classified expression.
Currency prefixes are
`$`, `£`, `€`, `¥`, `USD`, `US$`, `EUR`, `GBP`, `JPY`, `CHF`, `CAD`, `AUD`, `CNY`,
or `RMB`. Scale suffixes are `k`, `m`, `mm`, `b`, `bn`, `thousand`, `million`, or
`billion`; suffix words are case-insensitive. Percentage suffixes are `%`,
`percent`, or `per cent`; multiple suffixes are `x` or `×`; basis-point suffixes are
`bp`, `bps`, `basis point`, or `basis points`. Permit whitespace between components
and consume the maximal complete expression, but require the match not to begin or
end inside an ASCII alphanumeric word. A currency expression may omit scale; a
scale-only amount requires a scale suffix. Protected spans below are removed before
classification, and the general numeric pass guarantees privacy even when a class
suffix is unfamiliar.

Protection is exact, not heuristic. Gateway-owned metadata (`model`, provider, lane,
run/call ids, timestamps, token counts) is never passed to `mask_payload`; it is
copied from trusted event fields into the aggregate record/span. **No key/path inside
prompt, completion, tool argument, tool result, or MCP content exempts its value from
masking.** A malicious payload such as `{"model":{"ebitda":125}}` therefore masks
125.

Within payload free text:
- Temporarily replace non-overlapping spans matching these grammars
  with indexed sentinels: existing mask token
  `\[MASKED_(?:AMT|PCT|MULT|BPS|NUM)\]`; UUID
  `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}`;
  SHA-256 `\b[0-9a-fA-F]{64}\b`; ISO date/time
  `\b\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?\b`; fiscal label
  `\bFY\d{2,4}\b`; SEC accession `\b\d{10}-\d{2}-\d{6}\b`; and page/section
  citation `\b(?:p(?:age)?\.?\s*|section\s+)\d+(?:\.\d+)*\b|§\s*\d+(?:\.\d+)*`.
- Run class-specific patterns in table order, then replace every remaining numeric
  lexeme matching `[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?` with
  `[MASKED_NUM]`, then restore sentinels by index.

Identifiers in unstructured prose that are not covered by an exact grammar may be
over-masked; false-positive masking is safer than leaking a financial figure. The
masker MUST recurse through system blocks, messages, completions, every
`ExecutionStep.input_raw`/`output_raw`, tool arguments, and MCP results. It MUST be
idempotent: `mask(mask(x)) == mask(x)`. Apply the same free-text rules to arbitrary
payload object keys; a key such as `"Revenue $125m"` is not a safe exemption. When
two masked keys collide, preserve both entries by appending `__DUP_` plus a
bijective-alphabetic insertion-order suffix (`A`…`Z`, `AA`…), advancing until unique.
Those suffixes contain no figures and remain stable on a second mask pass. Only the
trusted gateway metadata fields excluded from `mask_payload` retain original keys.
Stringify non-string mapping keys before masking so the stored result is valid JSON.

Hashed placeholders are forbidden. A stable hash of a low-entropy amount is
dictionary-reversible and is not required by any use case. Prompt deduplication uses
SHA-256 of canonical **masked** prompt JSON, computed in the writer. Different raw
amounts that collapse to the same masked prompt intentionally share a hash.

Exception messages are not mask inputs. The gateway captures only exception class
and numeric HTTP status, preventing a provider error that echoes a prompt from
crossing the queue. Every provider exception log in migrated callers—including the
current `logger.exception` at `research_report.py:1022`—MUST become a fixed-field
background log without `str(exc)`, `repr(exc)`, traceback, or `exc_info`. OTel spans
MUST be started with `record_exception=False`; code MUST NOT call
`Span.record_exception`.

### 7.2 Processing order

For each dequeued event, the writer MUST execute exactly:

1. Normalize the prompt/completion/execution payload tree through `to_json_value` and
   normalize each provider usage object independently into trusted
   `NormalizedUsage`. No log/export/DB operation occurs. Provider usage is
   operational metadata and is not passed to the masker. If its raw normalized copy
   is retained inside the semantic execution-path JSON, that copy is payload and is
   masked like every other payload value.
2. Mask the normalized semantic payload tree, including numeric leaves.
3. Only for an embedding step whose provider supplied no token usage, call the exact
   background `count_tokens` rule in §6.1 using the still-held raw one-text Content
   and complete that step's trusted `NormalizedUsage`.
4. Drop every raw and unmasked normalized reference. No logger, DB, disk, OTel, or
   exporter operation may occur before this point. A normalization/count failure
   retains only its fixed reason enum; count failure makes cost NULL but does not
   poison an otherwise valid payload event.
5. Canonically JSON-encode the masked prompt and compute `prompt_hash` from it.
6. Canonically JSON-encode each masked side. If encoded UTF-8 exceeds 200,000 bytes,
   store canonical JSON for
   `{"_truncated":true,"utf8_prefix":"<largest code-point-aligned prefix fitting the budget after wrapper encoding>"}`.
   This keeps every Text field valid JSON and sets row `truncated=True`.
7. Compute cost from trusted normalized usage.
8. Create OTel spans/events from masked/truncated data.
9. Insert DB rows and call `queue.task_done()`.

No raw prompt/completion is written to logs, DB, disk spill, or OTel at any point.

### 7.3 Background-only OpenTelemetry

The request path MUST NOT call the OTel SDK. The writer creates an after-the-fact
root span `caos.llm.interaction` with explicit `start_time`/`end_time` from the event,
plus one child span per `ExecutionStep`. This is supported by the Python OTel API’s
explicit start/end timestamps. `BatchSpanProcessor` exports asynchronously.

External grounding: [OTel Python trace API](https://opentelemetry-python.readthedocs.io/en/stable/api/trace.html),
[OTel BatchSpanProcessor](https://opentelemetry-python.readthedocs.io/en/stable/sdk/trace.export.html).

Initialize the provider/processor inside the FastAPI lifespan in each worker, after
the worker process exists. The batch processor is not pre-fork safe:
[OTel fork-process guidance](https://opentelemetry-python.readthedocs.io/en/stable/examples/fork-process-model/README.html).

Root span attributes:

```text
gen_ai.operation.name        = chat | embeddings
gen_ai.provider.name         = anthropic | gcp.gemini | openrouter
gen_ai.request.model         = requested_model
gen_ai.response.model        = final model
gen_ai.usage.input_tokens    = summed total input
gen_ai.usage.output_tokens   = summed output
caos.llm_call_id             = LLMCallRecord.id / event UUID
caos.lane                    = lane
caos.run_id                  = run id when present
caos.model_mode              = preset mode when present
caos.fallback                = bool
caos.cost.usd                = computed/provider cost when known
caos.cost.source             = provider | matrix | mixed
caos.rate_card_version       = version when matrix-priced
caos.masking_version         = financial-v1
```

Span events, only when `llm_log_payloads=True`, use only the already-masked canonical
JSON strings from §7.2:

- `caos.prompt.masked` with masked JSON truncated to 16,384 characters.
- `caos.completion.masked` with masked JSON truncated to 16,384 characters.
- `caos.execution_path.masked` with masked JSON truncated to 16,384 characters.

Because spans are synthesized in the background, they are root traces in v1. They
correlate to request/run state by `llm_call_id` and `run_id`; capturing a live OTel
parent on the request path is explicitly rejected by H1.

Only one new OTel setting is permitted:

```python
otel_exporter_otlp_endpoint: str = ""  # empty: DB telemetry only, no exporter
```

---

## 8. Zero-added-latency placement audit

| Transformation | Hot path work | Background work | Acceptance proof |
|---|---|---|---|
| Prompt formatting | Provider-required conversion plus one shallow outer-list snapshot; no nested copy/serialization | None | Golden adapter payload tests; Z4 proves the whole tail is no slower than current |
| Token budget | Existing ContextVar integer additions | Token normalization and dollar calculation | Existing budget tests unchanged |
| Telemetry handoff | Shallow snapshot + event construction + `put_nowait`; no log handler | Mask, masked hash, valid-JSON truncation, cost, log, OTel, DB | Z1–Z4 |
| Masking | None | Recursive masker | Masking golden/property tests |
| OTel | None | Span creation, child spans, exporter | OTel SDK monkeypatch fails if called before dequeue |
| File detection | None | `awatch` and queue | Request handlers do not import/start watcher work |
| Chunk diff | None | Vault consumer | Diff unit/property tests |
| Embedding refresh | None | Vault consumer before atomic commit | Failed embed leaves prior live generation unchanged |

Required latency tests:

- **Z1:** monkeypatch `AsyncSessionLocal`, masker, pricing, and OTel tracer to raise;
  a fake successful `llm_client.create` still returns and leaves one queued event.
- **Z2:** fill the telemetry queue; a fake successful call still returns, increments
  the drop counter, and performs no await after the provider response.
- **Z3:** instrument the complete post-provider call graph, not only
  `enqueue_nowait`. Before the telemetry consumer's `queue.get()` returns that exact
  event, DB session construction, logger handlers, masker, pricing, and every OTel
  `get_tracer`/`start_span`/`add_event`/`end` method MUST remain uncalled. Grep also
  asserts no provider caller awaits `budget.trace_llm` after migration.
- **Z4:** benchmark the post-provider tail with a stalled writer; p95 MUST be ≤ the
  current tail and <1 ms on the same CI runner. The result is a regression guard, not
  a cross-machine performance promise.

---

## 9. Workstream 3 — canonicality and watcher architecture

### 9.1 Canonical families

| Vault path | File type | Canonical side | Watch action |
|---|---|---|---|
| `Runs/**/*.md` | `credit-run` | CAOS | Ignore; exporter remains one-way |
| `Issuers/**/*.md` | `issuer` | CAOS | Ignore; exporter remains one-way |
| `Analyst-Memos/**/*.md` | `analyst-memo` | File | Sync links, chunks, and vectors |
| `Sources/**/*.md` | `okf-source-note` | File-edited projection; original source remains CAOS-canonical | Sync separate projection chunks and vectors |
| `.obsidian/**`, `.trash/**`, hidden/temp, non-Markdown | — | — | Ignore |

Grounding: generated exports and analyst-memo behavior are in
`vault_export.py:158-224,314-568`. The existing memo upload writes a file and then
creates DB chunks (`routes/ingestion.py:525-625`), so file canonicality closes an
existing drift path rather than inventing a second corpus.

**Design choice for OKF:** the existing OKF blueprint makes `Sources/` a generated,
one-way projection and requires `document_id` in its frontmatter
(`PDF_INGESTION_OKF_BLUEPRINT.md:42-46,725-751`). This specification supersedes only
the handling of a human edit: it MUST create/update a separate
`Document.doc_type="okf-source-note"`; it MUST NOT mutate the original
PDF-derived Document or chunks. Original source chunks remain evidence; the edited
file is analyst interpretation. This is the smallest safe bidirectional contract.
`build_issuer_index` currently excludes only `analyst-memo`; extend that exclusion to
`{"analyst-memo", "okf-source-note"}`. Query corpus retrieval may include both.

### 9.2 Multi-worker leader election

Only one worker may watch/reconcile a vault. `run.py` explicitly supports multiple
Postgres workers (`caos/server/run.py:6-15,37-44`). The lifespan MUST:

1. Open a dedicated Postgres connection.
2. Call `pg_try_advisory_lock(hashtext('caos.vault_sync.v1'))`.
3. Start watcher/consumer/reconcile only if true, holding that connection for the
   leader lifetime.
4. Followers retry election every 30 seconds after a leader connection closes.
5. On SQLite, `WEB_CONCURRENCY` is already forced to one; use one process-local task
   without SQL advisory locks.

This follows the repository’s existing session-advisory-lock precedent documented in
`run.py:10-13`. It adds no service or durable coordinator.

### 9.3 File-event queue

Use `watchfiles.awatch` and one bounded FIFO:

```python
VAULT_QUEUE_MAX = 2048
WATCH_DEBOUNCE_MS = 1600
WATCH_STEP_MS = 50
QUIET_WINDOW_S = 2.0
RECONCILE_INTERVAL_S = 300

@dataclass(frozen=True, slots=True)
class VaultEvent:
    rel_path: str
    observed_ns: int

_queue: asyncio.Queue[VaultEvent]
_reconcile_requested: bool
_control_wake: asyncio.Event
```

`awatch(vault_root, debounce=1600, step=50, recursive=True)` yields event sets. The
producer filters paths, converts to vault-relative POSIX form, rejects traversal, and
uses `put_nowait`. It ignores symlinks and any resolved path outside the resolved
vault root. Event kind is deliberately ignored; the consumer re-stats the
path, so create/modify/delete/atomic replace share one path. A rename appears as
old-missing plus new-present and is resolved by hash (§10.3).

`watchfiles` 1.2 documents async watching, recursive operation, debouncing, and a
polling option: [watchfiles API](https://watchfiles.helpmanual.io/api/watch/).
Pin `watchfiles>=1.2,<2` directly even if currently transitive. Operators using
Docker Desktop/NFS MAY set its documented `WATCHFILES_FORCE_POLLING=true`.

On queue full, set `_reconcile_requested=True`, clear/drain fine-grained events, and
set `_control_wake`. The consumer waits on **either** `queue.get()` or
`_control_wake.wait()` with `asyncio.wait(FIRST_COMPLETED)`, so overflow can wake an
empty blocked consumer; it cancels and awaits the losing wait task before the next
loop. Reconcile returns its dirty path batch directly to the
consumer; it MUST NOT re-enqueue into the same bounded queue. Clear `_control_wake`
immediately before scanning and repeat reconcile if it is set again during the scan.
Unlike telemetry, vault events are not dropped semantically; a full reconcile
re-derives state from disk and DB.

### 9.4 Consumer/coalescer

One serial watcher consumer per elected leader:

1. Await one event.
2. Drain immediately available events into `latest_by_rel_path`.
3. Continue receiving until no event arrives for two seconds; replace prior entries
   for the same path.
4. If `_reconcile_requested`, run reconcile instead of the batch.
5. Partition the batch by a fresh off-thread stat: process all present paths first,
   then all missing paths. Sort lexically within each group. This lets an atomic
   rename adopt the new path before the old-path delete is considered. Each path uses
   `asyncio.to_thread` for stat/read and its own `AsyncSessionLocal`; it never reuses
   a request session.
6. Retry transient file/DB/provider errors at 2, 4, 8, 16, and 32 seconds. After five
   failures, emit a fixed-field failure record and leave file/DB state unchanged.
   The next five-minute reconcile (§9.5) retries it; no new filesystem event or
   process restart is required.
7. Reuse only `sync_analyst_memos`' Markdown-link parser, not its current global
   delete/reinsert algorithm (`vault_export.py:476-568`). Inside each valid memo
   projection transaction, converge `AnalystLink` rows scoped by
   `(analyst_id, source_rel_path)`: upsert the desired issuer links and delete only
   that file owner's stale links. A missing-file transaction deletes links for that
   resolved projection owner/path; a quarantined identity performs no link mutation.
   Store both the legacy note stem and exact vault-relative path (§11.1); current code
   stores only a stem and Query hardcodes `Analyst-Memos/{stem}`
   (`database.py:1238-1247`; `engine/querygraph.py:1515-1532`).

The watcher task restarts with capped 5–60 second backoff after an unexpected error
and sets `_reconcile_requested=True` before restarting.

The upload route uses the same convergence function but does not wait for the elected
watcher: after `write_memo` returns, it schedules
`sync_file_projection(rel_path, owner_hint=caller.id)` in FastAPI `BackgroundTasks`
with its own DB sessions. `owner_hint` is an in-memory trusted hint for only this
targeted task; the durable recovery path resolves the rendered `uploaded_by` email
under §10.2. The HTTP response changes its message from a synchronous chunk count to
`retrieval sync queued`. Remove the current inline link scan/chunk creation at
`routes/ingestion.py:587-618`; vector work already runs after response there, and all
new chunk/vector work remains after response. The
per-path Postgres lock makes this targeted background task idempotent with a watcher
event from another worker. This targeted task is best-effort acceleration, not the
durability boundary. Startup/periodic reconcile runs whenever `vault_export_dir` is
configured, so a process crash after the response reconstructs the omitted task from
file and DB state.

### 9.5 Reconcile as durability backstop

Run once after leadership acquisition whenever `vault_export_dir` is configured;
run again every 300 seconds while that leader holds the lock, and immediately after
producer failure or overflow. The consumer
waits on queue/control activity or the next monotonic reconcile deadline, whichever
comes first:

1. Walk only watched directories off-thread without following symlinks; accept only
   regular Markdown files whose resolved path remains under the resolved vault root.
2. Compare file SHA-256 with `Document.source_sha256`; return mismatches directly as
   the present-path batch and converge them immediately. Do not enqueue into the
   bounded event queue, which could still be full.
3. Adopt legacy memo document **projections** (all rows for one family/path) by exact
   stem plus issuer set; if ambiguous, do not
   guess—log `identity_ambiguous` and quarantine.
4. Detect DB paths missing on disk. Return present paths before missing paths, each
   group sorted lexically, so rename adoption precedes deletion in reconcile too.
5. If the scan finds zero watched Markdown files while any synced documents exist,
   perform no deletion and emit `vault_mass_delete_guard`. This treats an unmounted
   volume as an outage, not an analyst command.

No durable queue is required: every job is deterministically reconstructable from
files plus database state, and the bounded five-minute retry delay closes transient
outages without a job table.

---

## 10. Chunk diff and embedding refresh

### 10.1 Shared note parsing and chunk basis

Add one `split_note` helper in `vault_sync.py` that inverts the simple frontmatter
written by `vault_export._yaml_block` (`vault_export.py:45-54`). It returns
frontmatter plus body and tolerates a missing/temporarily incomplete delimiter.

The canonical chunk basis is `split_note(file_text).body.strip()`, including the H1
title. `upload_memo` MUST render/write the Markdown first and pass that same body to
`chunk_memo_into_corpus`; today it chunks the pre-render input while the file contains
frontmatter and an H1 (`vault_export.py:400-428`, `routes/ingestion.py:579-618`). This
one-time basis change may re-chunk legacy memos during first reconcile and MUST be
reported in migration notes.

Reuse `ingest.chunk_text` unchanged. Do not create a vault-specific chunker.

### 10.2 Path identity and concurrency

Add a partial unique index for synced documents:

```text
UNIQUE (doc_type, source_rel_path, issuer_id)
WHERE source_rel_path IS NOT NULL
```

A memo projection is the complete set of `Document` rows sharing
`(doc_type, source_rel_path)`; its identity includes an issuer-id set, not one row. A
memo linked to N issuers continues to have N rows sharing chunk hashes, as today
(`engine/memochunks.py:72-147`). Upload and watcher code MUST call the same
`sync_file_projection` function. New rows MUST populate existing non-null fields:
`file_name=Path(rel_path).stem`, `storage_key="memo:" + rel_path`, `doc_type`, and
`chunk_count`; `uploaded_by` copies frontmatter. On an existing projection whose
frontmatter omits it, retain the stored label. This field is audit text only;
ownership is the `analyst_id` contract below.

Ownership is mandatory and never inferred as institutionally shared:

1. The upload-target task supplies `owner_hint=caller.id`; validate that analyst
   exists, and set every new memo projection `Document.analyst_id` and corresponding
   `AnalystLink.analyst_id` to it.
2. For an existing manual-file projection, retain its single existing non-null
   `analyst_id` across edits and renames; changing `uploaded_by` cannot transfer
   ownership. Multiple or NULL/mixed existing owners quarantine the whole projection
   until repaired.
3. For a new file without an owner hint, require frontmatter `uploaded_by` and resolve
   it case-insensitively to exactly one `Analyst.email` (the current table has a
   unique email index at `database.py:244-261`). Missing, unmatched, or ambiguous
   identity quarantines the event with **no** `Document`, chunk, or `AnalystLink`
   mutation. Never create a NULL-owned memo Document.
4. `sync_analyst_memos` writes the resolved owner onto each link. Add a required
   keyword `analyst_id` to `querygraph.build_graph`, pass `caller.id` from both Query
   graph entry points, and thread it through `_provenance` to `_analyst_memos`; that
   query filters `AnalystLink.analyst_id == analyst_id`. This closes the current
   unscoped select at `querygraph.py:1489-1512` and applies equally to the direct
   graph endpoint and `AnalysisQueryRun` graph lane in `routes/query.py`. Legacy NULL
   links are hidden until migration/backfill resolves them; they are not shared.

Resolve issuer wikilinks with the same current issuer name/ticker map built by
`vault_export.py:527-531`, then sort and deduplicate the desired issuer-id set. In one
projection transaction: for each desired issuer, reuse a retained projection
Document if one exists (including one whose chunks were all shadowed), otherwise add
one, then converge it to the complete live chunk multiset; for each non-desired
stored issuer, converge its Document to an empty live set through the
citation-aware shadow/delete diff. A note whose desired issuer set becomes empty
removes/shadows all projection Documents and converges that file's `AnalystLink` set
to empty while leaving the file intact. This makes remove→re-add resurrect safely
under the partial unique index and
defines the issuer-set behavior instead of treating one arbitrary row as projection
identity.

For `Sources/`, require flat frontmatter `type="source-document"`, a UUID
`document_id`, and `contains_source_text=true`, matching the existing OKF contract at
`PDF_INGESTION_OKF_BLUEPRINT.md:725-751`. Resolve that id to the original Document and
copy both its `issuer_id` and `analyst_id`; a NULL owner is retained only because the
original source itself is institutionally shared. Missing/malformed fields, an unknown document, or an original
without an issuer quarantines the event with no corpus mutation. Create exactly one
separate projection Document with `doc_type="okf-source-note"`,
`source_kind="analyst-projection"`, `storage_key="okf-note:" + rel_path`. Give its
chunks the normal `chunking` parent edge to `doc:{projection_document_id}`, and add
one Document-level `LineageEdge(artifact_id="doc:{projection_document_id}",
parent_id="doc:{original_document_id}", transform="okf-manual-projection",
transform_version="1.0")`, preserving the existing `doc:` parent convention at
`routes/edgar.py:231`. File deletion or rename affects only this projection, never
the original evidence Document.

In Postgres the function takes
`pg_advisory_xact_lock(hashtext('vault:' || rel_path))`; SQLite uses a process-local
per-path `asyncio.Lock`. For a rename, acquire both old and new path locks in lexical
order before revalidation, preventing an old-path delete from racing the new-path
adoption. The unique index is the final race backstop.

`source_sha256` is SHA-256 of exact file bytes, not body text. It detects frontmatter,
link, and title edits as well as body edits.

### 10.3 Rename and delete

- New path with no identity: group missing rows into projections by
  `(family, old_source_rel_path)`. If exactly one projection has the same
  `source_sha256` and issuer-id set, lock old/new paths and update every row's
  `source_rel_path`/`file_name` plus the resolved owner's `AnalystLink.source_rel_path`
  and `source_note`; do not touch chunks or vectors.
- Zero or multiple projection matches: treat as independent add/delete; never guess.
- Missing file: remove uncited chunks and shadow cited chunks. Preserve the Document
  row while any shadowed chunk remains so citation metadata resolves.

### 10.4 Duplicate-safe chunk diff

For each target document:

1. `new_chunks = chunk_text(body)` and `new_hashes = sha256(exact_text)`.
2. Load live and superseded rows ordered by `seq`.
3. Build `dict[hash, deque[row]]` for live rows and another for superseded rows.
4. Walk `(seq, text, hash)` in new order:
   - pop/reuse one live row of that hash;
   - else pop/resurrect one superseded row, clearing `superseded_at`;
   - else stage a new row.
5. Remaining live rows are removals. A row is cited when referenced by
   `EvidenceItem`, `MetricFact`, **or** a `LineageEdge.parent_id="chunk:{id}"`.
   Cited rows get `superseded_at=now`; never delete citation-parent lineage. Uncited
   rows delete only their own artifact lineage then the row, following the dependency
   order in `engine/memochunks.py:55-68`.
6. Update reused rows’ `seq`, document chunk count, file hash/path, sync timestamp,
   and origin.

Deque/multiset handling is mandatory because `document_chunks` has no
`(document_id, chunk_hash)` uniqueness and repeated paragraphs are valid
(`database.py:309-328`). A set diff is incorrect.

### 10.5 Watched-projection embedding-before-commit protocol

To satisfy H4 without holding a DB transaction across a network call:

1. Read file bytes and the complete projection in a short-lived read session. Compute
   the full diff and a projection fingerprint over sorted
   `(document_id, issuer_id, chunk_id, seq, chunk_hash, superseded_at)` tuples, then
   close that session before any provider call.
2. Determine every distinct target live hash lacking `(active_model, hash)`, not only
   newly changed hashes. In a healthy corpus this reduces to changed hashes; the wider
   check repairs a pre-existing gap without a separate path.
3. Outside a transaction, request vectors only for that missing set. Split local
   scheduling into groups of 100 (the current grouping size in
   `engine/embeddings.py:93-119`), but make one Gemini `embed_content` request per
   text as required by §10.7.
4. Determine vector eligibility from **both** existing
   `caos_document_egress_enabled` and provider-key availability. If ineligible, commit
   the chunk diff as BM25-only and request no vectors. If eligible and any embedding
   call fails or is malformed, commit nothing and requeue the file. Mock vectors stay
   unit-test-only and are never persisted.
5. Open a fresh write session/transaction, acquire the per-path advisory lock, re-read
   current file bytes off-thread, and re-read the complete DB projection. If the file
   SHA-256 or projection fingerprint differs from step 1, roll back and recompute.
6. Apply chunk/doc changes and insert the already validated vectors through the
   shared `insert_embeddings` helper with
   `ON CONFLICT (model, chunk_hash) DO NOTHING` in the same transaction. This helper
   performs no provider or missing-row query while the transaction is open.
7. Commit once. For vector-eligible documents, retrieval sees either the old complete
   generation or the new complete generation, never live chunks without vectors.

Embedding rows are append-only because a hash may be shared by many documents. A
removed chunk does not authorize vector deletion. BM25 needs no refresh step because
`DocumentChunk.tsv` is a persisted computed column with GIN index
(`database.py:309-328`).

### 10.6 Retrieval rules

Add `DocumentChunk.superseded_at IS NULL` to every BM25/vector corpus query and to
`build_issuer_index`. Add an index on `(document_id, superseded_at)`. Direct
chunk-by-id/citation lookup MUST NOT add this predicate; cited historical text must
remain openable.

SQLite's unscoped BM25 cache version currently uses total document/chunk counts plus
`max(Document.uploaded_at)` (`retrieval.py:103-124,362-388`), none of which changes
when a chunk is shadowed/resurrected. Change the version to include live chunk count
and `max(Document.synced_at)`, and call a small `invalidate_corpus_cache()` after every
successful sync commit. SQLite is single-process; Postgres uses DB-side FTS and needs
no cross-worker cache signal.

Extend engine index exclusion from `analyst-memo` to
`{"analyst-memo", "okf-source-note"}`. Query corpus may retrieve both.

### 10.7 Embedding adapter and writer contract

`gemini-embedding-2` differs from the retired embedding models: multiple input parts
are aggregated into one result. Therefore `engine/gemini.py` MUST make exactly one
`embed_content` API request per text, with exactly one Google `types.Content`
containing one text `Part` and
`EmbedContentConfig(output_dimensionality=768)`. A local scheduling group contains at
most 100 texts and runs at most four requests concurrently via a code-constant
`asyncio.Semaphore(4)`; this work is background-only. Each response MUST contain
exactly one vector of length 768 whose components are all finite. Any request or
validation failure discards all in-memory vectors for the complete caller operation,
so the caller stages zero rows; cancel and await unfinished sibling tasks before
raising. Live failure raises `EmbeddingUnavailable` with only
exception class/status retained for telemetry; it never returns a mock.

This one-request-per-text requirement is grounded in the replacement model behavior
documented by [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings).

Three small shared operations are mandatory for vault sync, ordinary document/EDGAR
upload, and startup/backfill:

```python
async def find_missing_embeddings(
    db: AsyncSession, hashes: Collection[str], *, model: str
) -> set[str]: ...

async def generate_embeddings(
    hash_to_text: Mapping[str, str], *, model: str
) -> dict[str, list[float]]: ...

async def insert_embeddings(
    db: AsyncSession,
    hash_to_vector: Mapping[str, Sequence[float]],
    *,
    model: str,
) -> int: ...
```

`find_missing_embeddings` is read-only and runs before any provider call.
`generate_embeddings` deduplicates hashes, applies the one-request-per-text adapter
contract above, and has no DB session. `insert_embeddings` validates again, makes no
network request or missing-row query, and uses dialect-specific conflict-ignore:
Postgres `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_nothing(...)` and
SQLite's corresponding dialect insert. Each inserted row has a new UUID,
`provider="google"`, `origin="live"`, the explicit model, and one shared UTC
`created_at` for the insert batch. Plain generic `insert` is forbidden for this
table. The vault lane closes its read session, generates, opens a fresh write
transaction, revalidates file/projection state, and inserts inside that transaction.
This replaces current plain inserts in `engine/embeddings.py:135,201` without ever
holding a DB session across provider I/O.

`warmup_embeddings_task` composes those three operations, takes an explicit target
model, and acquires a dedicated
Postgres session advisory lock `hashtext('caos.embedding.warmup.v1')`; only the lock
holder runs. This corrects the current every-worker startup at `main.py:163-174`.

The shared helpers make all embedding writers safe and duplicate-tolerant, but the
atomic generation protocol in §10.5 applies only to watched file projections.
Ordinary document and EDGAR upload retain their current response contract: they
commit live chunks, make them BM25-visible, and schedule embeddings afterward
(`routes/ingestion.py:220-241`; `routes/edgar.py:225-241`). Such a chunk can be
temporarily vector-invisible until the background insert succeeds. This workstream
does not add a pending-document state or claim upload-time atomicity. The maintenance
readiness gate in §10.9 is stricter because all corpus writers are stopped and it
proves complete active-corpus coverage before vector service resumes.

### 10.8 Egress policy and query failure

The existing `caos_document_egress_enabled=False` gate is authoritative
(`config.py:131-133`). No API key alone authorizes document text to leave CAOS.

**Design choice, security-visible:** when that existing flag is explicitly true,
`analyst-memo` and future `okf-source-note` projections become vector-eligible; when
false, they remain synchronized and searchable by BM25 only. This removes the current
unconditional memo exclusion at `engine/embeddings.py:83,158` only under explicit
egress consent. No new egress setting is added.

Refresh/backfill callers propagate `EmbeddingUnavailable` so H4 can roll back/retry.
Query-time retrieval first computes BM25, then attempts the query vector only when
egress is enabled and a key exists; it catches `EmbeddingUnavailable` and returns the
BM25 results. This preserves the current empty-vector BM25 degradation at
`retrieval.py:236-247,414-425,545-556` without silently creating mock vectors.

### 10.9 Incompatible-space backfill and cutover

One setting currently controls writes and reads, so the simplest race-free rollout is
a maintenance cutover, not dual-write infrastructure:

1. Record the deployed `EMBEDDING_MODEL` value and run the coverage query below. The
   repository default is already `gemini-embedding-2` (`config.py:129-136`), but a
   deployed environment may still pin the retired model.
2. If `caos_document_egress_enabled=False`, keep the current new-model default and
   remain explicitly BM25-only. Skip steps 3–6; before any later false→true egress
   change, perform them in a maintenance window first.
3. With document egress explicitly enabled, deploy the corrected adapter/shared
   writer. An installation still reading an old model MUST temporarily keep its
   explicit old-model environment override until step 5. An installation already
   reading `gemini-embedding-2` MUST enter maintenance immediately and MUST NOT serve
   vector retrieval until step 4 proves complete coverage.
4. Stop all app/corpus-writer workers, invoke the warmup/backfill function with
   explicit target `gemini-embedding-2`, retain old rows, then prove coverage with set
   difference—not counts. First fail readiness if any active live row still has no
   hash (migration §11.3 is required to make this empty):

   ```sql
   SELECT dc.id
   FROM document_chunks dc
   JOIN documents d ON d.id = dc.document_id
   WHERE d.status = 'active'
     AND dc.superseded_at IS NULL
     AND dc.chunk_hash IS NULL
   LIMIT 1;
   ```

   Only after that returns no row, run:

   ```sql
   SELECT DISTINCT dc.chunk_hash
   FROM document_chunks dc
   JOIN documents d ON d.id = dc.document_id
   WHERE d.status = 'active' AND dc.superseded_at IS NULL
   EXCEPT
   SELECT e.chunk_hash
   FROM document_chunk_embeddings e
   WHERE e.model = 'gemini-embedding-2';
   ```

   Run this query only with document egress enabled. The result MUST be empty for all
   live chunks, which are then vector-eligible under the global egress consent.
5. Remove any old-model override (or set
   `EMBEDDING_MODEL=gemini-embedding-2`) and restart workers.
6. Run the same EXCEPT query after restart. Any row aborts readiness and reruns the
   backfill before serving vector retrieval. When egress is disabled, readiness
   asserts BM25-only mode and does not run a vector-coverage gate.

When egress is enabled, no corpus writer runs from the start of step 4 through the
restart in step 5. That eliminates the concurrent-insert race without a second
read/write-model setting or temporary dual-write layer.

Because old incompatible vectors remain in the table, add a partial Postgres HNSW
index for the active space:

```sql
CREATE INDEX ix_chunk_embeddings_gemini_embedding_2_vector
ON document_chunk_embeddings USING hnsw (vector vector_cosine_ops)
WHERE model = 'gemini-embedding-2';
```

Retain the existing global index in this additive migration so old-model reads do not
lose their index before the maintenance cutover. Run `EXPLAIN` and a recall fixture
after cutover to prove new-model queries choose the partial index; a global
mixed-model approximate index can under-recall after filter application, as described
in [pgvector filtering guidance](https://github.com/pgvector/pgvector#filtering). Dropping the
legacy global index is a later cleanup only after no supported read pins an old model,
not part of this build.

---

## 11. Vector metadata tagging standard and schema additions

### 11.1 Additive document/chunk/vector fields

| Table | Field | Type | Required value |
|---|---|---|---|
| `documents` | `source_rel_path` | `String(1024)`, nullable/indexed | Vault-relative POSIX path |
| `documents` | `source_sha256` | `String(64)`, nullable | SHA-256 of exact file bytes |
| `documents` | `synced_at` | timezone datetime, nullable | Last successful convergence |
| `documents` | `sync_origin` | `String(24)`, nullable | `upload`, `vault-manual`, `okf-projection` |
| `document_chunks` | existing `chunk_hash` | `String(64)`, change to non-null after backfill | SHA-256 of exact UTF-8 chunk text |
| `document_chunks` | `superseded_at` | timezone datetime, nullable/indexed | NULL means live/retrievable |
| `document_chunk_embeddings` | `provider` | `String(16)`, nullable | `google`; nullable for legacy |
| `document_chunk_embeddings` | `origin` | `String(24)`, nullable | `live`; nullable for legacy; mocks are never persisted |
| `analyst_links` | `source_rel_path` | `String(1024)`, nullable/indexed | Exact vault-relative path; legacy rows may be NULL |
| `analyst_links` | `analyst_id` | `String(36)`, nullable FK/indexed | Resolved memo owner; NULL only for unresolved legacy rows and never query-visible |

Do not add dimension metadata: `SafeVector(768)` already fixes it in schema
(`database.py:1397`). Do not add document metadata to the embedding row: one
`chunk_hash` can belong to many documents.

### 11.2 Canonical retrieval tag object

Any API/log/export that represents a vector hit MUST use these exact keys, assembled
by joining embedding → chunk → document:

```json
{
  "embedding_id": "uuid",
  "embedding_model": "gemini-embedding-2",
  "embedding_provider": "google",
  "embedding_origin": "live",
  "embedding_dim": 768,
  "chunk_id": "uuid",
  "chunk_hash": "64-char sha256",
  "chunk_seq": 0,
  "chunk_prov": "native|ocr|null",
  "document_id": "uuid",
  "document_type": "analyst-memo|okf-source-note|...",
  "document_source_kind": "existing source_kind or null",
  "source_rel_path": "Analyst-Memos/name.md|null",
  "issuer_id": "uuid|null",
  "is_live": true
}
```

`is_live` is derived from `superseded_at IS NULL`; it is never independently stored.
The standard preserves the existing `(model, chunk_hash)` identity and HNSW cosine
index (`database.py:1389-1408`).

### 11.3 Migration `0063_agentic_infra_memory_hub.py`

Set `revision="0063"` and `down_revision="0062"` for the current tree. Recheck
`alembic heads` immediately before implementation as required by §3.

The migration MUST, in order:

1. Add §5.2 columns and indexes to `llm_call_records` as nullable first; new writers
   supply required values. Do not backfill fictional providers for historical rows.
2. Create `llm_call_payloads` with one-to-one cascade FK.
3. Add document/chunk/vector fields from §11.1. In Python batches of 1,000, backfill
   **every** NULL `document_chunks.chunk_hash` as
   `sha256(row.text.encode("utf-8")).hexdigest()` so the migration is cross-dialect;
   then assert zero NULL hashes remain and make the column non-null before continuing.
   Do not limit this repair to currently live rows. Downgrade restores nullability but
   does not erase the repaired values.
4. Add `analyst_links.source_rel_path` and `analyst_links.analyst_id`. Backfill the
   path as `Analyst-Memos/{source_note}.md`. For each link, resolve analyst-memo
   Documents at that path (legacy stem match only during migration); set owner only
   when they yield exactly one distinct non-null `Document.analyst_id`. Leave all
   unresolved/ambiguous links NULL and therefore hidden. Change Query's Obsidian link
   builder to use the exact path and require caller-scoped ownership as in §10.2.
5. Create the partial document identity unique index and chunk live-state index.
   `LineageEdge.parent_id` is already indexed in the current model
   (`database.py:1361-1386`); do not create a duplicate. On Postgres, add the
   `gemini-embedding-2` partial HNSW index from §10.9 and retain the existing global
   index through cutover; leave SQLite unchanged.
6. Backfill citation-parent `LineageEdge` rows for every chunk id persisted in
   `query_accepted_links.chunk_ids`, `query_overlays.payload`,
   `query_insights.payload`, `query_answers.payload`, and `alert_events.evidence`.
   Reuse one recursive `extract_chunk_ids` helper that accepts only UUID strings
   found under an exact `chunk_id` key or inside an exact `chunk_ids` list, then
   intersects them with existing `DocumentChunk.id` values. Update each writer to call one
   `record_citation_edges(artifact_id, chunk_ids)` helper; a registry test MUST fail
   when a persisted `chunk_ids` writer omits it. `engine/queryanswer.py:440-454`
   already demonstrates the parent edge shape. Artifact ids are exactly
   `query-accepted-link:{id}`, `query-overlay:{id}`, `query-insight:{id}`,
   `query-answer:{id}`, or `alert-event:{id}`; parent is `chunk:{chunk_id}`;
   `transform="citation"`, `transform_version="1.0"`. Set the existing
   `v2_idempotency_key` to
   `sha256("citation-v1|" + artifact_id + "|" + parent_id)` and rely on the existing
   unique constraint (`database.py:1361-1386`). Existing legacy citation-shaped rows,
   including Query Answer's current lineage, still count as cited; the backfill adds
   the canonical keyed edge if it is absent.
7. Add one shared runtime primitive:

   ```python
   async def lock_cited_chunks(
       db: AsyncSession, chunk_ids: Collection[str]
   ) -> tuple[str, ...]: ...
   ```

   It validates UUIDs, sorts/deduplicates them, acquires one transaction-scoped
   `pg_advisory_xact_lock(hashtext('chunk-citation:' || chunk_id))` per id in that
   order, and returns the tuple. SQLite takes the corresponding process-local locks
   in the same order and releases them after commit/rollback; its deployment is
   already single-process.

   Every citation family MUST call this primitive **before its first citation
   write** and keep the write in that same transaction:

   - JSON/artifact writers: extract ids, lock, then insert/update the artifact and
     canonical `LineageEdge` rows; never expose the JSON row first.
   - `runner._persist_output`: collect all non-null
     `EvidenceItem.document_chunk_id` values for the module, lock them once, then add
     the EvidenceItems (`runner.py:675-706`).
   - The CP-1/CP-2 MetricFact persistence in `execute_run`: collect the union of
     non-null fact `document_chunk_id` values, lock once before adding any such
     MetricFact (`runner.py:548-569`).
   - Any other writer that sets `EvidenceItem.document_chunk_id` or
     `MetricFact.document_chunk_id`, including seed/fixture utilities, must use the
     helper. A source-registry test fails when a writer bypasses it.

   Watcher deletion/shadowing takes the same locks for all candidate removed chunk
   ids, then rechecks `EvidenceItem`, `MetricFact`, and
   `LineageEdge.parent_id="chunk:{id}"` before mutation in the same transaction. A
   cited row is shadowed, not deleted. Citation state need not enter the projection
   fingerprint because the locked recheck is authoritative. Postgres race tests MUST
   cover JSON/lineage, EvidenceItem, and MetricFact writers independently.
8. Leave old embedding rows intact.

Rollback drops only added indexes/columns/table. It MUST NOT delete corpus rows.

---

## 12. Lifecycle and deployment

FastAPI lifespan start order in each worker:

1. Initialize telemetry queue and, when configured, OTel provider/BatchSpanProcessor.
2. Start telemetry writer.
3. If `vault_export_dir` is configured, attempt vault leader election. The leader
   starts the `awatch` producer and reconcile consumer, runs startup reconcile, and
   repeats reconcile every 300 seconds.
4. Start existing executors in their current order. Start embedding warmup only after
   it acquires its dedicated advisory lock from §10.7; non-holders skip it. Vault
   embedding work remains serial and background.

Shutdown order:

1. Stop watcher producer; finish the current sync transaction, then stop consumer.
2. Release vault advisory lock/connection.
3. Stop existing executors in current order.
4. Drain telemetry for at most five seconds, then shut down OTel processor/exporter.

Minimal settings delta:

| Setting | Default | Purpose |
|---|---|---|
| `mcp_servers_json` | `""` | One MCP registry/allowlist surface |
| `llm_log_payloads` | `True` | Disable semantic payload persistence/export |
| `otel_exporter_otlp_endpoint` | `""` | Empty means DB telemetry only |
| existing `embedding_model` | keep current `gemini-embedding-2` | Active live vector space |

All queue sizes, batch sizes, quiet windows, retry counts, and MCP turn cap in this
specification are code constants, not configuration. This is deliberate: no operator
requirement needs another config surface.

Deployment deltas:

- Mount the Obsidian vault read/write at `VAULT_EXPORT_DIR`; existing exporters need
  writes even though the watcher only reads.
- Add `watchfiles>=1.2,<2` directly to server requirements.
- Add OTel API/SDK and the OTLP exporter matching the chosen endpoint protocol.
- If EDGAR MCP is configured, copy `caos/mcp/edgar/` into the image and add its `mcp`
  dependency.
- Never log `mcp_servers_json`; it names environment variables, not secret values.

---

## 13. Implementation sequence and acceptance tests

### Phase A — gateway without behavior drift

1. Introduce owned `PromptEnvelope` and internal step recording.
2. Move synth advisor and both streams through the gateway.
3. Move embedding provider call to the gateway/Gemini adapter.
4. Extend the provider-call registry:
   - raw Anthropic create/stream only in `engine/llm_client.py`;
   - raw Gemini generate/embed only in `engine/gemini.py`;
   - raw OpenRouter HTTP completion only in `engine/openrouter.py`.
5. Run existing gateway, synth, deep-research, report, budget, and LLM-safety tests.

### Phase B — telemetry, pricing, masking

1. Apply the one complete additive migration from §11.3, then add queue/writer.
2. Replace `budget.trace_llm` DB/cost work with budget accrual plus `put_nowait`.
3. Add rate-card unit tests for every row, boundary date, Gemini 200k boundary,
   provider override, missing rate, cache buckets, advisor-iteration expansion
   without double counting, Anthropic web-search fees, unknown server tools, exact
   background embedding token counts, count failure→NULL, OpenRouter
   provider-cost authority, and OpenRouter missing-cost→NULL even for a DeepSeek tier
   model.
4. Add masker golden/property tests including nested tool inputs/results,
   numeric object keys, post-mask key collisions, idempotence, and date/hash
   preservation. For the numeric-leak property, strip only
   the exact protected identifier/date/citation spans enumerated in §7.1 from the
   masked value, then assert no raw numeric lexeme remains; protected spans are not
   expected to lose their own digits. Exercise `to_json_value` with actual Anthropic
   SDK messages/content blocks, the repository's Gemini/OpenRouter response DTOs,
   dataclasses/Pydantic models, cycles, unsupported objects, and both size limits;
   assert a poison object cannot invoke `str`, `repr`, or a property.
5. Add Z1–Z4.

### Phase C — vault convergence

1. Add leader, watcher queue, reconcile, shared upload/watcher sync function against
   the already-applied additive schema.
2. Use the conditional maintenance cutover in §10.9: when egress is enabled, stop writers, backfill
   `gemini-embedding-2`, prove EXCEPT coverage, confirm the retrieval default, restart, and
   prove coverage again; when egress is disabled, assert BM25-only mode.
3. Add Postgres integration tests for advisory locks, partial unique index, citation
   shadowing, embedding-before-commit, and `ON CONFLICT` races.

Required vault test matrix:

| Case | Required assertion |
|---|---|
| Upload then self-watch | Same file hash; zero chunk/vector churn |
| Append paragraph | Only missing hashes receive embedding requests |
| Edit early paragraph | Correct chunk multiset even if greedy boundaries shift |
| Duplicate paragraph add/remove | Deque diff preserves exact multiplicity |
| Rename unchanged file | Path changes; zero chunk/vector churn |
| Delete uncited | Chunks removed; shared vectors retained |
| Delete cited | Chunks shadowed and citation still resolves |
| Citation insert races delete | Shared sorted chunk lock makes delete recheck and shadow |
| Add/remove issuer wikilink | Per-issuer Document set converges; shared hashes reuse vectors |
| Edit valid `Sources/` note | Only `okf-source-note` projection changes; original Document/chunks stay byte-identical |
| Invalid `Sources/` identity | Event quarantined; neither original nor projection corpus mutates |
| Embedding outage | Old generation remains live; no partial commit |
| Gemini embedding group | Exactly one request/text, max four in flight, any failure persists zero vectors for the operation |
| Queue overflow/watcher restart | Reconcile restores disk/DB equality |
| Five transient failures then recovery | Next ≤300-second reconcile converges without a new file event or restart |
| Multiple workers | Exactly one watcher leader; upload race remains idempotent |
| Crash after memo response before targeted task | Startup or ≤300-second leader reconcile converges the written file |
| Analyst A/B memo isolation | Both Document and AnalystLink reads remain owner-scoped; NULL legacy links are hidden |
| New manual memo with missing/unmatched owner | Quarantined with no Document/chunk/link mutation |
| OKF private/shared source | Projection copies the original Document owner exactly |
| Legacy NULL chunk hash | Migration hashes exact UTF-8 text; pre-EXCEPT NULL assertion is empty |
| Direct citation writer races delete | EvidenceItem and MetricFact families each lock, recheck, and force shadowing |
| Ordinary upload before embedding task | BM25-visible/vector-invisible transient is acknowledged and later converges |
| Empty/unmounted vault | Mass-delete guard performs no destructive write |

### Final invariants to assert

- For every watched file/issuer document, the ordered multiset of live chunk hashes
  equals `chunk_text(split_note(file).body)`.
- Every vector-eligible live chunk committed by a successful watched-projection sync
  has an active-model embedding row in the same commit; shared hashes still map to
  one `(model, chunk_hash)` row. At maintenance readiness, §10.9 separately proves
  this for the complete active corpus. Ordinary document/EDGAR uploads may be
  briefly BM25-only under the existing post-commit background behavior.
- No sync operation deletes an embedding row.
- No generated `Runs/` or `Issuers/` event changes corpus state.
- No cited chunk id becomes unresolved.
- No raw financial figure reaches telemetry DB or OTel.
- No instrumentation operation is awaited on a successful primary request.

---

## 14. Transformation verification protocol

Each transformation is reviewed immediately after its section is drafted by a new
subagent with no conversation history. A verifier receives only this specification,
the named source files, and this checklist:

1. Confirm every current-state claim against a tool read from this session.
2. Identify contradictions with existing call/DB/file contracts.
3. Test the transformation with representative and boundary examples.
4. Reject any masking, telemetry, OTel, chunking, or embedding work that can run on
   the primary request path.
5. Return PASS only when all high-impact findings are resolved in this document.

| Transformation | Source evidence required | Pass criteria | Session result |
|---|---|---|---|
| Prompt formatting | `llm_client.py`, `gemini.py`, `openrouter.py`, synth/stream callers | Provider shape preserved; forced tools not executed; only the specified shallow outer snapshot; no deep copy/serialization | **VERIFIED after correction** — fresh verifier initially failed the tuple shape, sticky stream model, broadened retries, and synchronous log. Root audit confirmed each against `openrouter.py:37-48`, `synth.py:530-578`, `deepresearch.py:263-331`, `research_report.py:950-1026`, and `llm_client.py:137-270`; §§4.1–4.5/H1/Z3 were corrected. |
| Cost calculation | `budget.py`, `config.py`, `presets.py`, official price pages | Tier mapping complete; cache bands/date bands/provider override/unknown model exact | **VERIFIED after correction** — fresh verifier initially failed fallback labelling, mixed-source aggregation, pre-enqueue normalization, unknown-TTL cache writes, and obsolete OpenRouter request syntax. Root audit confirmed the code distinctions at `presets.py:73-80,167-188`, `llm_client.py:168-173,235-270`, `budget.py:81-90`, `gemini.py:175-190`, and `openrouter.py:128-132`; §§4.3, 5.2, and 6.1–6.4 were corrected. |
| Masking | Telemetry schema/order plus mask rules | Nested coverage, protected tokens, idempotence, no raw payload persistence/export, background only | **VERIFIED after correction** — fresh verifier initially failed numeric JSON leaves, identifier grammars, raw prompt hashing, JSON truncation, exception tracebacks, and full-call-graph hot-path enforcement. Root audit confirmed current raw hashing/DB tracing at `llm_client.py:93-107` and `budget.py:112-181`, plus `logger.exception` at `research_report.py:1022`; §§4.3, 5.3, 7.1–7.3, and Z3 were corrected. |
| Chunk diffing | `vault_export.py`, `memochunks.py`, `ingest.py`, citation FKs | Duplicate-safe, rename/delete/citation behavior exact, multi-worker race controlled, background only | **VERIFIED after correction** — fresh verifier initially failed multi-issuer rename identity, nested memo links, overflow wakeup, post-embedding revalidation, JSON-held citations, SQLite cache invalidation, and migration numbering. Root audit confirmed projection rows at `memochunks.py:98-141`, stem-only links at `vault_export.py:445-568`/`database.py:1238-1247`/`engine/querygraph.py:1515-1532`, citation stores at `database.py:1217-1337` plus `engine/queryanswer.py:440-454`, cache version at `retrieval.py:103-124,362-388`, and live `0061_context_revision.py`; §§9.3–10.6 and 11.1/11.3 were corrected. |
| Embedding refresh | `embeddings.py`, embedding schema/retrieval, Google model docs | Retired model corrected, 768 explicit, missing-only, no mock/live collision, atomic visibility, background only | **VERIFIED after correction** — fresh verifier initially failed cutover concurrency, Gemini batch validation, query-vs-refresh failure semantics, conflict handling across all writers, document-egress policy, and mixed-model HNSW recall. Root audit confirmed the parallel current default/768 change plus still-invalid multi-Content request at `config.py:129-136` and `embeddings.py:28-74`, memo exclusion/plain inserts at `embeddings.py:83,135,158,201`, every-worker warmup at `main.py:163-174`, BM25 query degradation at `retrieval.py:236-247,414-425,545-556`, and the global HNSW at `database.py:1389-1408`; §§2.1, 10.5, and 10.7–10.9 plus migration/lifecycle tests were corrected. |

A final root audit MUST compare each verifier claim to the actual source/tool output;
agent agreement alone is not evidence. The completed handoff updates this table with
the fresh verifier verdict and any incorporated correction.

---

## 15. Known limits and explicit risk decisions

1. **Telemetry queue loss is possible.** This is accepted to satisfy H1. There is no
   synchronous occurrence floor: the writer emits metadata-only `caos.llm` records,
   while queue-depth/drop counters make lost events observable.
2. **Masked telemetry still contains issuer names and strategy prose.** The payload
   kill switch exists; authorization/retention for telemetry readers must follow the
   same database boundary as source documents. A retention policy is not requested
   and is not invented here.
3. **Background root spans do not inherit HTTP trace parents.** This is accepted to
   keep all OTel SDK work off the request path; `llm_call_id`/`run_id` correlate.
4. **Chunk refresh is surgical by hash, not by semantic paragraph.** The existing
   greedy chunker can shift downstream boundaries after an early edit. Reusing it is
   more important than creating an incompatible “smarter” chunker.
5. **OKF runtime modules do not yet exist.** The watcher implements only the generic
   `Sources/` manual-projection contract in §§9.1/10.2; it does not implement the PDF
   extraction/structuring pipeline described by the separate OKF blueprint. A manual
   edit can never rewrite original source evidence.
6. **Analyst memo vectors require explicit egress consent.** This is intentionally not
   inferred from the presence of a Gemini key. With the existing document-egress flag
   off, vault edits converge text/chunks and BM25 only; H4's vector requirement is
   inapplicable rather than silently violated.
