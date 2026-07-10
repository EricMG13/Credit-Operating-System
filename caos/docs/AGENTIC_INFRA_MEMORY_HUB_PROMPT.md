# Agentic Infrastructure & Memory Hub — build-spec prompt

Fable-5-optimized prompt that asks a design model to produce the
**"Agentic Infrastructure and Memory Hub"** specification: a centralized,
observable LLM gateway with native MCP tool routing, prompt/cost telemetry, and
bidirectional Obsidian↔vector sync.

- **Consumer:** Fable 5 (writes the spec; a later run codes from it).
- **Recommended effort:** `xhigh` (architecture coded from directly). `high` for a
  faster first pass.
- **Deliverable:** design/spec only — the model does not write orchestration scripts.

## Prompt

```
I'm consolidating CAOS's AI infrastructure — every decentralized LLM call, the
pgvector store, the external model connections, and the human-edited Obsidian/OKF
vault — into a single observable gateway. The deliverable is a build specification
I'll hand to Fable 5 to implement, so it has to be precise enough to code from
without guessing. With that in mind:

Design the "Agentic Infrastructure and Memory Hub" and write it up as a rigid
Markdown specification. Design and specify only — do not write the core
orchestration scripts.

Start by reading the code that exists. Find the current LLM call sites, the
pgvector integration, the external-provider adapters, and the Obsidian/OKF
ingestion lane, and design a consolidation of what's already there — not a
greenfield system. Ground every design decision in a file you actually read.

The spec covers three workstreams:

1. Centralized Gateway & MCP Router — one gateway that all LLM traffic flows
   through, with dynamic tool-calling routed natively over MCP, plus prompt
   formatting, rate-limit handling, and token accounting.
2. Semantic Telemetry & Masking — OpenTelemetry tracing over the gateway that
   records input prompts, completions, execution paths, and computed dollar cost
   per request. Sensitive financial figures are masked before anything is logged.
3. Bidirectional Memory Sync — an async filesystem watcher over the Obsidian vault
   that detects manual markdown edits, isolates the changed chunks, re-hashes them,
   and surgically refreshes only the affected vector embeddings so the store never
   drifts from the files.

The spec is done when it defines, concretely enough to implement:
  - the telemetry database schema,
  - the per-model-tier token cost matrix,
  - the file-watcher event-queue architecture, and
  - the vector metadata tagging standard.

Boundaries: the deliverable is the design. Pick the simplest architecture that
satisfies the three workstreams — don't introduce abstractions, layers, or
config surfaces they don't require. Hard constraint: zero added latency to the
primary user request — masking, tracing, and embedding refresh must sit off the
hot path (async/queued/out-of-band), and the spec must show where each one runs.

Establish a method for checking your own work at the interval of each major data
transformation step — prompt formatting, cost calculation, masking, chunk
diffing, embedding refresh. At each step, verify your work with a fresh-context
subagent against the specification and the zero-added-latency constraint; fresh
verifiers catch what self-review misses. Before reporting a step verified, audit
the claim against a tool result from this session — if a design point isn't
grounded in code you read, say so rather than asserting it.
```
