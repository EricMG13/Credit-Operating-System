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
| H4 | A vault sync transaction MUST never expose a live chunk without its active-model vector. If embedding generation fails, the old live chunk set remains committed and the file is retried. | §10.5 |
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
| Call sites | The safety registry contains 15 reviewed generative files. Three generative paths still call provider APIs directly: synth advisor, deep-research streaming, and research-report streaming. Embeddings are a fourth provider bypass. | `caos/tests/server/test_llm_safety.py:144-187`; `caos/server/engine/synth.py:554,569`; `caos/server/deepresearch.py:268`; `caos/server/research_report.py:929`; `caos/server/engine/embeddings.py:28-55` |
| Gemini adapter | Gemini already converts Anthropic-shaped system/messages, normalizes responses, and supports only a forced single tool; dynamic/multi-tool input raises `GeminiUnsupported`. | `caos/server/engine/gemini.py:67-91,124-201,205-246` |
| OpenRouter adapter | OpenRouter already translates Anthropic-shaped messages/tools to OpenAI-compatible payloads and normalizes tool calls. It does not request or retain provider-reported cost. | `caos/server/engine/openrouter.py:37-134,136-173` |
| Model tiers | TEST/LITE/BALANCED/MAX map lanes to `cheap`, `fast`, `strong`, and `top`; configured defaults are DeepSeek Flash, DeepSeek Flash, DeepSeek Pro, and Claude Opus 4.8. | `caos/server/engine/presets.py:56-80,145-188`; `caos/server/config.py:82-127` |
| Current telemetry | `trace_llm` performs budget accrual, incorrect hard-coded cost calculation, structured logging, and an awaited DB commit on the caller coroutine. | `caos/server/engine/budget.py:81-109,112-181` |
| Telemetry table | `llm_call_records` exists with run/lane/model/hash/token/cost/status/latency fields. | `caos/server/database.py:1295-1313` |
| Vectors | Embeddings are keyed uniquely by `(model, chunk_hash)` in pgvector `vector(768)`; retrieval joins through chunk hash and filters by active model. | `caos/server/database.py:1344-1363`; `caos/server/engine/retrieval.py` vector-query branches |
| Embedding defect | With a Gemini key, an embedding failure falls back to deterministic mock vectors, which callers can persist under the configured live model id. | `caos/server/engine/embeddings.py:17-25,28-55,58-112` |
| Vault write/read lanes | CAOS writes generated notes and analyst memos. `sync_analyst_memos` scans files to rebuild links only; it does not re-chunk edited files. | `caos/server/vault_export.py:203-224,314-557`; `caos/server/engine/memochunks.py:69-141`; `caos/server/routes/ingestion.py:475-579` |
| Chunk recipe | Existing ingestion uses `chunk_text` with a 512-token target and 64-token overlap; chunk identity is SHA-256 of exact chunk text. | `caos/server/ingest.py:276-368`; `caos/server/engine/memochunks.py:111-123` |
| Citation FKs | Evidence and metric facts can point to `document_chunks.id`; deleting a cited chunk is unsafe. | `caos/server/database.py:513-526,579` |
| Deployment | `WEB_CONCURRENCY` may create multiple Uvicorn worker processes on Postgres; SQLite is explicitly limited to one. | `caos/server/run.py:6-15,26-44`; `caos/deploy/docker-compose.yml:69` |
| MCP | The repository contains a stdio FastMCP EDGAR server with three read tools and one write tool. | `caos/mcp/edgar/server.py:1-103`; `caos/mcp/edgar/pyproject.toml` |
| OKF | `PDF_INGESTION_OKF_BLUEPRINT.md` is a design blueprint; no `okf_*.py` implementation exists. Its future `Sources/` lane must therefore be treated as reserved, not current runtime behavior. | `caos/docs/PDF_INGESTION_OKF_BLUEPRINT.md`; repository file search on 2026-07-15 |

### 2.1 Critical prerequisite: replace the retired embedding model

`config.py` currently defaults to `text-embedding-004` and dimension 768
(`caos/server/config.py:126-127`). Google lists `text-embedding-004` as shut down
on 2026-01-14 and `gemini-embedding-001` as shut down on 2026-07-14; the replacement
is `gemini-embedding-2`. `gemini-embedding-2` defaults to 3072 dimensions, so the
adapter MUST request `output_dimensionality=768` to preserve the existing schema.
Its embedding space is incompatible with prior models, so all live hashes MUST be
backfilled under the new model id before it becomes the retrieval default.

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
  queue -> mask -> normalize usage -> calculate cost -> synthesize OTel spans
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

One additive migration, `0060_agentic_infra_memory_hub.py`, contains all schema
changes in §5 and §11. The migration directory’s current head is `0059` as of the
evidence date. The implementer MUST re-run `alembic heads`; if head changed, only
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
) -> Message: ...
```

`create` is a strict superset of the existing signature at
`engine/llm_client.py:204-212`. `betas` selects `client.beta.messages.create` and
exists only to absorb the direct synth advisor call at `engine/synth.py:554`.
If that call does not explicitly pass `fallback_model`, it MUST preserve its current
no-fallback behavior.

`stream_final` absorbs the direct stream calls at `deepresearch.py:268` and
`research_report.py:929`; it MUST preserve `get_final_message()`, adaptive-thinking
arguments, pause-turn continuation, and sticky fallback model behavior. It returns
`StreamResult(message, used_model, fallback)`. Both callers MUST rebind their local
`model = result.used_model` before a pause-turn or repair call; deep research currently
persists that rebound model across continuations (`deepresearch.py:263-331`) and the
report repair currently reuses it (`research_report.py:923-950,997-998`).

`embed` moves `client.aio.models.embed_content` from `engine/embeddings.py:44` into
`engine/gemini.py`; the gateway owns telemetry, while the adapter owns the Google
request shape.

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
(`deepresearch.py:329-331`; `research_report.py:991-996`) while preserving the
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
| OpenRouter | Reuse `_translate_messages` and `_translate_tools`; system becomes the leading system message. | `engine/openrouter.py:37-86` |

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
```

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
   (`research_report.py:940-950`).
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
    "env_names": ["CAOS_API_BASE", "CAOS_ANALYST_EMAIL", "CAOS_EDGE_SHARED_SECRET"],
    "lane_tools": {
      "research:legal": [
        "edgar_search",
        "edgar_issuer_filings",
        "edgar_list_exhibits"
      ]
    }
  }
}
```

The empty default exposes no tools. The router MUST:

1. Lazily open one stdio MCP session per configured server per worker and cache the
   `list_tools` result. A broken session gets one reconnect on the next call.
2. Qualify names as `<server>__<tool>`.
3. Intersect three sets before exposing a schema: tools returned by `list_tools`,
   `lane_tools[lane]`, and the caller’s `allowed_tools`. Absence at any layer denies.
4. Convert the discovered MCP schema to each provider’s native tool schema.
5. Execute only a tool name present in that exact exposed set.
6. Wrap every returned/error payload with `llm_safety.wrap_untrusted` before adding a
   model `tool_result`; web/filing text is untrusted input. The existing safety
   wrapper is in `engine/llm_safety.py` and OpenRouter already fail-closes malformed
   tool arguments at `engine/openrouter.py:102-117`.
7. Stop after five model tool rounds (constant, not a setting). If the limit is hit,
   return status `max_tool_turns` with the last model message; do not execute another
   tool.

Anthropic and OpenRouter dynamic tools are supported in v1. Gemini dynamic MCP tools
MUST raise `GeminiUnsupported` before a network call because its adapter currently
discards tool-result blocks and explicitly rejects non-forced/multi-tool requests
(`engine/gemini.py:79-91,205-246`). Forced structured-output tools continue through
plain `create` and are returned unexecuted.

The EDGAR server’s write-capable `edgar_fetch_and_vault` tool is excluded in v1
(`caos/mcp/edgar/server.py:84-99`). The implementation MUST also pass the existing
edge shared secret and make the EDGAR client send `X-Edge-Authorization`; direct
localhost API requests otherwise fail the deployed edge-proof middleware
(`caos/server/main.py:229-260`). The Docker image currently copies only the server
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

Keep all existing columns in `database.py:1295-1313`. `cost` is USD. Add:

| Column | SQLAlchemy type | Null | Meaning |
|---|---|---:|---|
| `interaction_id` | `String(36)`, unique/indexed | no | UUID assigned by gateway; stable correlation key |
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
    prompt_masked: Mapped[dict | None] = mapped_column(JSON)
    completion_masked: Mapped[dict | None] = mapped_column(JSON)
    execution_path_masked: Mapped[list | None] = mapped_column(JSON)
    masking_version: Mapped[str] = mapped_column(String(32), nullable=False)
    masked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    truncated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
```

Payload rows are one-to-one with records. A new setting
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
  option is deprecated and MUST NOT be added. Read `usage.cost`, cached tokens, and
  aggregate cache-write tokens. Compute uncached input as
  `max(prompt_tokens - cached_tokens - cache_write_tokens, 0)` and put aggregate
  writes in `cache_write_other_tokens` because no 5m/1h split is reported. The
  current adapter ignores all of these details at `engine/openrouter.py:128-132`.
- Gemini: `prompt_token_count` includes cached content, so retain the current
  subtraction in `engine/gemini.py:175-190`; candidates plus thoughts are output.

Missing fields are zero, never inferred. Provider-native usage objects are queued by
reference; no `NormalizedUsage` or `Decimal` is constructed before dequeue.

External usage-shape grounding:
[OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting).

### 6.2 Tier-to-model matrix

Rates are USD per million tokens and are versioned `2026-07-15`.

| Tier | Current configured primary | Primary input | Cache read | Cache write 5m | Cache write 1h | Output | Default runtime overload fallback |
|---|---|---:|---:|---:|---:|---:|---|
| `cheap` | `deepseek/deepseek-v4-flash` | 0.098 | 0.020 | — | — | 0.196 | none distinct: cheap is already Flash |
| `fast` | `deepseek/deepseek-v4-flash` | 0.098 | 0.020 | — | — | 0.196 | none distinct: cheap and fast currently share Flash |
| `strong` | `deepseek/deepseek-v4-pro` | 0.435 | 0.003625 | — | — | 0.870 | `deepseek/deepseek-v4-flash` |
| `top` | `claude-opus-4-8` | 5.000 | 0.500 | 6.250 | 10.000 | 25.000 | `claude-sonnet-4-6` |

Tier/model grounding: `caos/server/config.py:108-123` and
`caos/server/engine/presets.py:56-80,145-188`. OpenRouter prices are the
2026-07-15 values returned by its official model API; provider-reported `usage.cost`
is authoritative when present: [OpenRouter models API](https://openrouter.ai/api/v1/models).

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

1. Price each model step independently. If that step reports a non-negative dollar
   cost, use it; do not also matrix-price that step.
2. Otherwise resolve an exact id or declared version-prefix. For Gemini Pro, choose
   the 200k band from that step's input, not the aggregate interaction. For Sonnet 5,
   choose the date-effective row from that step's `started_ns`.
3. A nonzero token bucket with no applicable rate—including
   `cache_write_other_tokens`—makes the entire interaction `cost=NULL`; partial totals
   are forbidden. Unknown model has the same outcome and emits a rate-limited warning.
4. If every usage-bearing step is priced, sum step costs. Stamp `provider` if all
   steps used provider cost, `matrix` if all used the rate card, or `mixed` if both.
   Stamp `rate_card_version="2026-07-15"` whenever any step is matrix-priced.
5. Persist `float(cost_decimal)` in the existing Float `cost` column; tests compare at
   1e-9 USD tolerance. Changing the established column type is unnecessary scope.

This replaces the incorrect catch-all Sonnet pricing in
`engine/budget.py:135-146` and runs only in the background writer.

---

## 7. Financial-figure masking and OpenTelemetry

### 7.1 Masking contract

`engine/telemetry_mask.py` is a pure recursive transform:

```python
MASKING_VERSION = "financial-v1"

def mask_payload(value: Any) -> tuple[Any, int]: ...
```

It MUST preserve JSON shape and replace every matching string fragment with a
non-correlatable class token:

| Detection order | Examples | Replacement |
|---:|---|---|
| 1 | `$1,250.4m`, `EUR 40bn`, `(£12.5 million)` | `[MASKED_AMT]` |
| 2 | `1,250m`, `4.2 billion`, `750k` when a scale suffix exists | `[MASKED_AMT]` |
| 3 | `42.5%`, `(3.0)%` | `[MASKED_PCT]` |
| 4 | `5.7x`, `5.7×` | `[MASKED_MULT]` |
| 5 | `+125 bps`, `-75bp` | `[MASKED_BPS]` |
| 6 | bare comma-grouped or ≥7-digit number not protected below | `[MASKED_NUM]` |

The masker MUST first protect and restore ISO dates/times, `FY2026`-style fiscal
labels, page/section citations, UUIDs, SHA-256 hashes, model names, token counts in
telemetry metadata, and already-masked tokens. It MUST recurse through system blocks,
messages, completions, tool arguments, MCP results, and execution-path string values.
It MUST be idempotent: `mask(mask(x)) == mask(x)`.

Hashed placeholders are forbidden. A stable hash of a low-entropy amount is
dictionary-reversible and is not required by any use case. Prompt deduplication uses
the full-prompt SHA-256 in `llm_call_records.prompt_hash`, computed in the writer and
never exported as payload.

Exception messages are not mask inputs. The gateway captures only exception class
and numeric HTTP status, preventing a provider error that echoes a prompt from
crossing the queue.

### 7.2 Processing order

For each dequeued event, the writer MUST execute exactly:

1. Canonically JSON-encode the raw prompt envelope and compute `prompt_hash`.
2. Mask prompt, completion, and execution path.
3. Truncate each persisted side at 200,000 characters after masking.
4. Normalize usage and compute cost.
5. Create OTel spans/events from masked/truncated data.
6. Insert DB rows.
7. Drop all raw references and call `queue.task_done()`.

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
caos.interaction_id          = UUID
caos.lane                    = lane
caos.run_id                  = run id when present
caos.model_mode              = preset mode when present
caos.fallback                = bool
caos.cost.usd                = computed/provider cost when known
caos.cost.source             = provider | matrix
caos.rate_card_version       = version when matrix-priced
caos.masking_version         = financial-v1
```

Span events, only when `llm_log_payloads=True`:

- `caos.prompt.masked` with masked JSON truncated to 16,384 characters.
- `caos.completion.masked` with masked JSON truncated to 16,384 characters.
- `caos.execution_path.masked` with masked JSON truncated to 16,384 characters.

Because spans are synthesized in the background, they are root traces in v1. They
correlate to request/run state by `interaction_id` and `run_id`; capturing a live OTel
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
| Telemetry handoff | Metadata-only log + event construction + `put_nowait` | Hash, mask, truncate, cost, OTel, DB | Z1–Z4 |
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
- **Z3:** AST/registry test forbids `await`, DB session construction, logging-handler
  calls, masker, pricing, and OTel imports inside `enqueue_nowait`; grep asserts no
  provider caller awaits `budget.trace_llm` after migration.
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
| `Sources/**/*.md` | future `okf-source-note` | File projection | Reserved until OKF lands; sync projection only |
| `.obsidian/**`, `.trash/**`, hidden/temp, non-Markdown | — | — | Ignore |

Grounding: generated exports and analyst-memo behavior are in
`vault_export.py:158-224,314-557`. The existing memo upload writes a file and then
creates DB chunks (`routes/ingestion.py:475-579`), so file canonicality closes an
existing drift path rather than inventing a second corpus.

**Design choice for OKF:** a manually edited `Sources/` note MUST write
`Document.doc_type="okf-source-note"`, not mutate the original PDF-derived source
document. Original source chunks are evidence; a human projection is analyst
interpretation. `build_issuer_index` currently excludes only `analyst-memo`; extend
that exclusion to `{"analyst-memo", "okf-source-note"}`. Query corpus retrieval may
include both. Until OKF code exists, `Sources/` events log `reserved_family` and do no
DB writes.

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

@dataclass(frozen=True, slots=True)
class VaultEvent:
    rel_path: str
    observed_ns: int

_queue: asyncio.Queue[VaultEvent]
_reconcile_requested: bool
```

`awatch(vault_root, debounce=1600, step=50, recursive=True)` yields event sets. The
producer filters paths, converts to vault-relative POSIX form, rejects traversal, and
uses `put_nowait`. Event kind is deliberately ignored; the consumer re-stats the
path, so create/modify/delete/atomic replace share one path. A rename appears as
old-missing plus new-present and is resolved by hash (§10.3).

`watchfiles` 1.2 documents async watching, recursive operation, debouncing, and a
polling option: [watchfiles API](https://watchfiles.helpmanual.io/api/watch/).
Pin `watchfiles>=1.2,<2` directly even if currently transitive. Operators using
Docker Desktop/NFS MAY set its documented `WATCHFILES_FORCE_POLLING=true`.

On queue full, set `_reconcile_requested=True`, clear/drain fine-grained events, and
wake the consumer. Unlike telemetry, vault events are not dropped semantically; a
full reconcile re-derives state from disk and DB.

### 9.4 Consumer/coalescer

One serial consumer per elected leader:

1. Await one event.
2. Drain immediately available events into `latest_by_rel_path`.
3. Continue receiving until no event arrives for two seconds; replace prior entries
   for the same path.
4. If `_reconcile_requested`, run reconcile instead of the batch.
5. Process paths in lexical order. Each path uses `asyncio.to_thread` for stat/read
   and its own `AsyncSessionLocal`; it never reuses a request session.
6. Retry transient file/DB/provider errors at 2, 4, 8, 16, and 32 seconds. After five
   failures, log/quarantine in memory until the next event or startup reconcile.
7. After a memo batch, rebuild the current `AnalystLink` graph once by reusing
   `sync_analyst_memos` logic, with its full-scan trigger bypassed because the watcher
   already knows files changed (`vault_export.py:469-557`).

The watcher task restarts with capped 5–60 second backoff after an unexpected error
and sets `_reconcile_requested=True` before restarting.

### 9.5 Reconcile as durability backstop

Run once after leadership acquisition, and again after producer failure or overflow:

1. Walk only watched directories off-thread.
2. Compare file SHA-256 with `Document.source_sha256`; enqueue mismatches.
3. Adopt legacy memo documents by exact stem plus issuer link; if ambiguous, do not
   guess—log `identity_ambiguous` and quarantine.
4. Detect DB paths missing on disk and process them as deletes.
5. If the scan finds zero watched Markdown files while any synced documents exist,
   perform no deletion and emit `vault_mass_delete_guard`. This treats an unmounted
   volume as an outage, not an analyst command.

No durable queue is required: every job is deterministically reconstructable from
files plus database state.

---

## 10. Chunk diff and embedding refresh

### 10.1 Shared note parsing and chunk basis

Add one `split_note` helper in `vault_sync.py` that inverts the simple frontmatter
written by `vault_export._yaml_block` (`vault_export.py:45-54`). It returns
frontmatter plus body and tolerates a missing/temporarily incomplete delimiter.

The canonical chunk basis is `split_note(file_text).body.strip()`, including the H1
title. `upload_memo` MUST render/write the Markdown first and pass that same body to
`chunk_memo_into_corpus`; today it chunks the pre-render input while the file contains
frontmatter and an H1 (`vault_export.py:392-428`, `routes/ingestion.py:475-579`). This
one-time basis change may re-chunk legacy memos during first reconcile and MUST be
reported in migration notes.

Reuse `ingest.chunk_text` unchanged. Do not create a vault-specific chunker.

### 10.2 Path identity and concurrency

Add a partial unique index for synced documents:

```text
UNIQUE (doc_type, source_rel_path, issuer_id)
WHERE source_rel_path IS NOT NULL
```

A memo linked to N issuers continues to have N `Document` rows sharing chunk hashes,
as today (`engine/memochunks.py:69-141`). Upload and watcher code MUST call the same
`sync_file_projection` function. In Postgres that function takes
`pg_advisory_xact_lock(hashtext('vault:' || rel_path))`; SQLite uses a process-local
per-path `asyncio.Lock`. The unique index is the final race backstop.

`source_sha256` is SHA-256 of exact file bytes, not body text. It detects frontmatter,
link, and title edits as well as body edits.

### 10.3 Rename and delete

- New path with no identity: if exactly one missing old path has the same
  `source_sha256` and family, update `source_rel_path`/`file_name`; do not touch chunks
  or vectors.
- Zero or multiple hash matches: treat as independent add/delete; never guess.
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
5. Remaining live rows are removals. If referenced by `EvidenceItem` or `MetricFact`,
   set `superseded_at=now`; otherwise delete their lineage edges then rows, following
   the existing dependency order in `engine/memochunks.py:40-66`.
6. Update reused rows’ `seq`, document chunk count, file hash/path, sync timestamp,
   and origin.

Deque/multiset handling is mandatory because `document_chunks` has no
`(document_id, chunk_hash)` uniqueness and repeated paragraphs are valid
(`database.py:286-305`). A set diff is incorrect.

### 10.5 Embedding-before-commit protocol

To satisfy H4 without holding a DB transaction across a network call:

1. Compute the full diff in memory from a read snapshot.
2. Determine distinct new/resurrected live hashes lacking `(active_model, hash)`.
3. Outside a transaction, request vectors only for that missing set, in batches of
   100 (the current batch size in `engine/embeddings.py:83-108`).
4. If any live embedding call fails, commit nothing; requeue the file. With no API
   key, use effective model `mock-sha256-v1`, never the configured Google model id.
5. Open the write transaction, acquire the per-path advisory lock, re-read
   `source_sha256` and existing rows. If either changed, roll back and recompute.
6. Apply chunk/doc changes and insert vectors with
   `ON CONFLICT (model, chunk_hash) DO NOTHING` in the same transaction.
7. Commit once. Retrieval sees either the old complete generation or the new complete
   generation, never chunks without vectors.

Embedding rows are append-only because a hash may be shared by many documents. A
removed chunk does not authorize vector deletion. BM25 needs no refresh step because
`DocumentChunk.tsv` is a persisted computed column with GIN index
(`database.py:286-305`).

### 10.6 Retrieval rules

Add `DocumentChunk.superseded_at IS NULL` to every BM25/vector corpus query and to
`build_issuer_index`. Add an index on `(document_id, superseded_at)`. Direct
chunk-by-id/citation lookup MUST NOT add this predicate; cited historical text must
remain openable.

Extend engine index exclusion from `analyst-memo` to
`{"analyst-memo", "okf-source-note"}`. Query corpus may retrieve both.

### 10.7 Embedding-model migration

1. Change `embedding_model` default to `gemini-embedding-2`.
2. The Gemini adapter calls `embed_content` with
   `EmbedContentConfig(output_dimensionality=768)`.
3. Backfill every distinct live chunk hash under `gemini-embedding-2`; retain all old
   embedding rows.
4. Switch retrieval default only after a count check proves every live hash has the
   new-model row.
5. Live provider failure raises `EmbeddingUnavailable`; it MUST NOT return a mock.
6. Keyless development uses `model="mock-sha256-v1"`, provider `local`, origin
   `deterministic-test`, and retrieval resolves that effective model explicitly.

This corrects the silent mock-under-live-id defect in
`engine/embeddings.py:28-55` and keeps the existing 768-dimensional vector column.

---

## 11. Vector metadata tagging standard and schema additions

### 11.1 Additive document/chunk/vector fields

| Table | Field | Type | Required value |
|---|---|---|---|
| `documents` | `source_rel_path` | `String(1024)`, nullable/indexed | Vault-relative POSIX path |
| `documents` | `source_sha256` | `String(64)`, nullable | SHA-256 of exact file bytes |
| `documents` | `synced_at` | timezone datetime, nullable | Last successful convergence |
| `documents` | `sync_origin` | `String(24)`, nullable | `upload`, `vault-manual`, `okf-projection` |
| `document_chunks` | `superseded_at` | timezone datetime, nullable/indexed | NULL means live/retrievable |
| `document_chunk_embeddings` | `provider` | `String(16)`, nullable | `google` or `local`; nullable for legacy |
| `document_chunk_embeddings` | `origin` | `String(24)`, nullable | `live` or `deterministic-test`; nullable for legacy |

Do not add dimension metadata: `SafeVector(768)` already fixes it in schema
(`database.py:1352`). Do not add document metadata to the embedding row: one
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
index (`database.py:1344-1363`).

### 11.3 Migration `0060_agentic_infra_memory_hub.py`

The migration MUST, in order:

1. Add §5.2 columns and indexes to `llm_call_records` as nullable first; new writers
   supply required values. Do not backfill fictional providers for historical rows.
2. Create `llm_call_payloads` with one-to-one cascade FK.
3. Add document/chunk/vector fields from §11.1.
4. Create partial document identity unique index and chunk live-state index.
5. Leave old embedding rows intact.

Rollback drops only added indexes/columns/table. It MUST NOT delete corpus rows.

---

## 12. Lifecycle and deployment

FastAPI lifespan start order in each worker:

1. Initialize telemetry queue and, when configured, OTel provider/BatchSpanProcessor.
2. Start telemetry writer.
3. Attempt vault leader election; leader starts watcher/consumer and startup reconcile.
4. Start existing warmup/executors in their current order unless existing code
   requires them earlier; vault embedding work remains serial and background.

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
| `vault_sync_enabled` | `False` | Requires existing `vault_export_dir` |
| existing `embedding_model` | change to `gemini-embedding-2` | Active live vector space |

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

1. Apply migration telemetry portion and add queue/writer.
2. Replace `budget.trace_llm` DB/cost work with budget accrual plus `put_nowait`.
3. Add rate-card unit tests for every row, boundary date, Gemini 200k boundary,
   provider override, missing rate, and cache buckets.
4. Add masker golden/property tests including nested tool inputs/results,
   idempotence, date/hash preservation, and no raw numeric match in stored payloads.
5. Add Z1–Z4.

### Phase C — vault convergence

1. Apply provenance/vector schema additions.
2. Add leader, watcher queue, reconcile, shared upload/watcher sync function.
3. Backfill `gemini-embedding-2`, verify coverage, then change retrieval default.
4. Add Postgres integration tests for advisory locks, partial unique index, citation
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
| Add/remove issuer wikilink | Per-issuer Document set converges; shared hashes reuse vectors |
| Embedding outage | Old generation remains live; no partial commit |
| Queue overflow/watcher restart | Reconcile restores disk/DB equality |
| Multiple workers | Exactly one watcher leader; upload race remains idempotent |
| Empty/unmounted vault | Mass-delete guard performs no destructive write |

### Final invariants to assert

- For every watched file/issuer document, the ordered multiset of live chunk hashes
  equals `chunk_text(split_note(file).body)`.
- Every live chunk has exactly one active/effective-model embedding row.
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
| Prompt formatting | `llm_client.py`, `gemini.py`, `openrouter.py`, synth/stream callers | Provider shape preserved; forced tools not executed; only the specified shallow outer snapshot; no deep copy/serialization | **VERIFIED after correction** — fresh verifier initially failed the tuple shape, sticky stream model, broadened retries, and synchronous log. Root audit confirmed each against `openrouter.py:37-48`, `synth.py:545-578`, `deepresearch.py:263-331`, `research_report.py:923-1007`, and `llm_client.py:137-270`; §§4.1–4.5/H1/Z3 were corrected. |
| Cost calculation | `budget.py`, `config.py`, `presets.py`, official price pages | Tier mapping complete; cache bands/date bands/provider override/unknown model exact | **VERIFIED after correction** — fresh verifier initially failed fallback labelling, mixed-source aggregation, pre-enqueue normalization, unknown-TTL cache writes, and obsolete OpenRouter request syntax. Root audit confirmed the code distinctions at `presets.py:73-80,167-188`, `llm_client.py:168-173,235-270`, `budget.py:81-90`, `gemini.py:175-190`, and `openrouter.py:128-132`; §§4.3, 5.2, and 6.1–6.4 were corrected. |
| Masking | Telemetry schema/order plus mask rules | Nested coverage, protected tokens, idempotence, no raw payload persistence/export, background only | PENDING |
| Chunk diffing | `vault_export.py`, `memochunks.py`, `ingest.py`, citation FKs | Duplicate-safe, rename/delete/citation behavior exact, multi-worker race controlled, background only | PENDING |
| Embedding refresh | `embeddings.py`, embedding schema/retrieval, Google model docs | Retired model corrected, 768 explicit, missing-only, no mock/live collision, atomic visibility, background only | PENDING |

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
   keep all OTel SDK work off the request path; `interaction_id`/`run_id` correlate.
4. **Chunk refresh is surgical by hash, not by semantic paragraph.** The existing
   greedy chunker can shift downstream boundaries after an early edit. Reusing it is
   more important than creating an incompatible “smarter” chunker.
5. **OKF source sync is reserved, not implemented.** The projection contract prevents
   a future manual note from rewriting original evidence, but no runtime claim is made
   until OKF code exists.
6. **Historical mock vectors cannot be distinguished by current metadata.** Do not
   delete them speculatively. Backfilling every live hash under the new model and
   filtering retrieval by exact model makes them unreachable without destructive
   archaeology.
