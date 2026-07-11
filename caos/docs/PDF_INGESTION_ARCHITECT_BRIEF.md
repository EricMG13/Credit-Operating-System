# PDF-Ingestion Architecture — Execution Context for Fable 5

> **What this file is.** A self-contained context pack. You (Fable 5) are the
> **Lead Data Architect** of an inbound ingestion pipeline — you hold full
> authority over its module decomposition, its inter-module data contracts, the
> chunking/embedding strategy, and the **Open Knowledge Format (OKF)** schema.
> Read this whole file, then own the mission below. Everything you need — the
> systemic goal, the immutable data-law, the real file map of what already
> ships, the seams you must not cross, a proven output shape, and a self-check
> protocol — is here. You are not filling in a template; you are **deciding what
> this pipeline should be**. **Do not write the ingestion scripts.** Your
> deliverable is a rigid, granular Markdown architectural blueprint that
> **Opus 4.8** executes top-to-bottom.
>
> **Repo root:** `/Users/ericguei/Claude/Projects/Credit Operating System`
> **Server root:** `caos/server/` (FastAPI; modules import flat, e.g. `import ingest`)
> **Write your blueprint to:** `caos/docs/PDF_INGESTION_OKF_BLUEPRINT.md`

---

## 0. The Mission

**Outcome you own:** an incoming stream of *unstructured, long-form PDF credit
reports* (rating-agency reports, sponsor decks, offering memoranda, quarterly
lender updates) is transformed into a **structured, headless Obsidian knowledge
graph** in which every financial fact is mapped into the **Open Knowledge Format
(OKF)**, so that the multi-agent Credit Operating System can query it
**dynamically and with low retrieval latency**. Everything below serves that one
outcome.

"Headless Obsidian" means: the vault is a directory of Markdown files with YAML
frontmatter and `[[wikilinks]]` — a queryable knowledge graph — consumed
**programmatically** by CAOS agents and the RAG retrieval stack. No Obsidian
desktop app is in the loop at ingest time; the format is Obsidian-compatible so
an analyst *can* open it, but the primary reader is the machine.

Your job closes two gaps, and the blueprint must specify both:

1. **The inbound pipeline.** Today CAOS ingests PDFs into `document_chunks`
   (opaque text rows) and, separately, *exports* derived analysis to an Obsidian
   vault. There is **no inbound path that turns an external PDF into structured
   OKF knowledge**. Specify that pipeline end-to-end: extraction → structuring →
   OKF mapping → chunk/embed → write/index → retrieval-ready.
2. **The OKF specification itself.** OKF is **not yet codified anywhere in this
   repo** (verify: `grep -rin "OKF\|open knowledge format" .` returns nothing).
   You must **author the OKF frontmatter schema** as part of the blueprint, and
   reconcile it with the flat-scalar YAML frontmatter the codebase already emits
   (`vault_export.py::_yaml_block`, §3). OKF is your deliverable to define, not a
   pre-existing standard you can look up.

**Your design authority is full, inside five fixed boundaries** (§5). You decide
the module decomposition, the seam between extraction and write, the chunking
math, the embedding backend, and every field of the OKF schema. You do **not**
move these posts: no edits to existing UI components; no edits to the legacy
database schemas; no vault two-way sync; local-only embeddings on the vault path;
and no fabricated interface the rest of CAOS cannot actually call.

**Deliverable.** A single Markdown blueprint that Opus 4.8 executes top-to-bottom,
**grouped strictly by pipeline stage** (§6). Each stage names its new module
file paths, the strict typed data-schema that crosses its boundary, an explicit
imperative build instruction for Opus, and the low-latency-RAG payoff it serves.
§6 gives a proven item shape — a completeness floor, not a cage. As you go, run
the self-check in §7.

---

## 0.1 How to work — operating guide (written for how Fable 5 performs best)

Read this before you start; it is calibrated to how you specifically do your best
work.

- **Design first, then decompose. Don't wait for permission.** You have the goal,
  the constraints, and the map. When you have enough to decide the module seam or
  the chunk size, decide it and specify it — give a recommendation with its
  reasoning, not an exhaustive survey of options you won't pursue. Re-deriving
  what this file already establishes is wasted motion.
- **Start at the hardest decision, not the easiest.** The OKF schema and the
  extraction↔write seam are where the real design problem lives (a bad schema
  poisons every downstream query; a leaky seam couples a slow PDF parser to a
  transactional DB write). Decide those first and the rest of the pipeline
  follows the pattern you set.
- **Where the design space is wide, generate options first, then commit.** For
  chunking strategy and embedding backend the space is genuinely wide — lay out
  2–4 concrete directions (each: what it does, why it serves low-latency RAG, one
  line of rationale), pick one, and specify only that one in depth. Hand Opus a
  decision with its reasoning, not a menu.
- **Lead every writeup with the outcome.** The first sentence of any section, and
  of the final blueprint, answers "what should be built and why does retrieval
  latency / query fidelity improve." Supporting detail comes after. Write in full
  prose — Opus reads this cold with none of your context. (This brief uses
  compressed shorthand for density; that is a note-taking register, not a model
  for your deliverable.)
- **Ground every claim in evidence.** Before asserting a module exists, a table
  has a column, or a function has a signature, point to it — a `grep`/read result
  with the path. A path or a schema you did not verify is a defect, not a design.
- **State boundaries, then stay inside them.** Your remit is a *blueprint*, not
  code and not new infrastructure. Don't specify a paid embedding service on the
  vault path, don't alter a legacy table, and don't invent an endpoint the engine
  can't serve. "Full authority" is over *how the fixed system is extended*, not
  over the system.
- **Delegate verification to fresh-context sub-agents, and keep working while they
  run.** Your self-check (§7) is strongest when a separate agent that has *not*
  seen your reasoning audits each data-transformation step against the OKF schema
  and the latency goal — fresh eyes catch hallucinated paths and schema fields
  that self-review rationalizes. Fan these out at each checkpoint; don't block on
  the slowest.
- **Keep a working memory file.** As you specify stages, record decisions and
  their rationale in a short `caos/docs/.pdf-ingestion-notes.md`: which chunker
  you chose and why, which embedding backend, which OKF fields are required vs
  optional and why. It keeps the blueprint internally consistent across six
  stages and gives your checkpoints something to audit against.
- **De-prescription is deliberate.** This brief gives you the goal, the
  constraints, and the map — not a step list. Fill the gaps with judgment; that
  is the job.

---

## 1. Systemic goal, the consumers, and what "low-latency RAG" means

**CAOS — Credit Agent OS.** An institutional leveraged-finance credit-analysis
platform: a Next.js analyst UI over a FastAPI engine, whose analytical
methodology is a 27-module "Modular OS" prompt corpus. The engine is a
**multi-agent system** — modules (agents) consume retrieved evidence and emit
claims with citations that trace back to source chunks. **The OKF knowledge graph
you design is an evidence source those agents read from.**

**The consumers of your pipeline (who queries OKF):**
- **The retrieval stack** — `caos/server/retrieval.py`: BM25 (`Bm25Index`,
  Postgres `tsv` GIN) fused with pgvector cosine search via **Reciprocal Rank
  Fusion** (`rrf_fusion`), then re-ranked (`rerank_window`, see `config.py`)
  before context packing. `retrieve(db, issuer_id, query, k)` and
  `retrieve_corpus(...)` are the hot paths.
- **The engine modules** — they call retrieval to ground claims; a citation is
  "real" only when it carries a `document_chunk_id` back to a stored chunk
  (`engine/lineage.py` CP-5B; `EvidenceItem.document_chunk_id` in `database.py`).
- **The natural-language query lane** — `nlquery.py` (`Filter`/`IssuerFilter`:
  industry/country/metric + semantic), `routes/query.py`.

**"Low-latency RAG retrieval" means, concretely:** a chunk is retrievable the
moment it is written (no offline re-index step the agents must wait on); the
metadata an agent filters on (issuer, period, seniority, document type) lives in
a place a query can filter *before* it pays for a semantic scan; and the OKF
frontmatter gives clean, stable chunk boundaries so an embedding maps to one
coherent financial idea, not a paragraph that straddles two. Every design choice
in the blueprint should be justifiable against this sentence.

---

## 2. The OKF specification and the evaluation bar

**There is no OKF definition in this repo. You are authoring it.** The bar is
that OKF must be *simultaneously* (a) valid Obsidian — flat-scalar YAML
frontmatter + `[[wikilinks]]`, so the graph view and any local Obsidian plugin
work — and (b) a machine-queryable metadata layer the CAOS retrieval stack can
filter on before a semantic scan. Design to both at once.

**Reconcile with what the codebase already emits — do not reinvent it.**
`caos/server/vault_export.py` already writes Obsidian notes and is your
frontmatter reference:
- `_yaml_block(fields)` emits **flat scalar YAML only** — "a JSON-encoded string"
  is the escape hatch for anything nested. Your OKF frontmatter must obey this
  constraint (Obsidian's YAML parser is flat; nested maps break the graph view
  and Dataview-style queries).
- `render_issuer_hub` / `render_run_spoke` / `render_memo` establish the
  **hub-and-spoke** shape: an issuer hub note (`{vault}/Issuers/{Issuer}.md`)
  carries metadata + `[[Industry]]`/`[[Country]]`/`[[Peer]]` links; spoke notes
  carry the content. `autolink_issuers` wraps issuer mentions in `[[wikilinks]]`.
- `_redact` blanks raw-source keys (`raw_text`, `source_text`, `chunk_text`,
  `excerpt`, `transcript`, …) before writing, so document text can't leak into a
  file that might sync off-machine. **Your inbound OKF notes carry source text by
  design — resolve this tension explicitly** (§5): decide the redaction/exposure
  posture for inbound notes and state it.

**The evaluation dimensions your blueprint is judged on** (these are the axes your
§7 verifier subagents score each stage against):

| Dimension | What "good" means |
|---|---|
| **Schema completeness** | Every field an agent needs to filter/cite is present, typed, and sourced; no field an agent needs is missing. |
| **Retrieval latency** | Metadata filters resolve before semantic scan; chunk boundaries are clean; write path indexes on write, not offline. |
| **Lineage / traceability** | Every OKF chunk traces back to `document_id` + page/offset, so a citation is openable (mirrors `document_chunk_id`). |
| **Single source of truth** | The OKF vault does not silently become a second, drifting copy of canonical DB facts (§5). |
| **Local-embedding compliance** | The vault embedding path stays local (no non-public issuer text leaves the machine on the vault lane). |

There is no numeric baseline table to inherit — this is a greenfield pipeline.
The "baseline" is the existing surface in §3: what you reuse vs. what you add.

---

## 3. The existing ingestion surface (real paths — verify, then reuse or diverge)

> This is your baseline. Every path below was confirmed by read/grep on
> 2026-07-08. Reuse these contracts; do not duplicate them, and do not modify the
> ones §5 marks legacy.

### Intake & extraction (reuse the extraction, decide about the chunker)
- **`caos/server/ingest.py`** — the existing intake path. Content sniffing
  (`_PDF_MAGIC = b"%PDF-"`, OOXML, OLE magic); `extract_text(content, file_name)`;
  `store(content, file_name)` → vaults the raw file under `CAOS_STORAGE_DIR`;
  `chunk_text(text)` with **`CHUNK_CHARS = 2400`, `CHUNK_OVERLAP = 240`**; OCR
  fallback via out-of-process `ocrmypdf`; `NO_CHUNKS_WARNING` when a
  scanned/encrypted PDF yields zero chunks. AV scan via `clamd` INSTREAM
  (`avscan.py`) rejects a signature hit with 422.
- **`caos/server/routes/ingestion.py`** — batch intake endpoints (PDF + XLSX).
- **`caos/server/routes/edgar.py`** — fetches an SEC exhibit and runs it through
  the **same** `ingest.extract_text` / `ingest.store` / `ingest.chunk_text` path
  (`routes/edgar.py:196-201`). Any new pipeline should stay consistent with this
  shared extraction seam.

### Storage & vector layer (legacy — read, DO NOT ALTER, §5)
- **`caos/server/database.py`**:
  - `Document` (`documents` table) — the vaulted file record.
  - `DocumentChunk` (`document_chunks`): `id`, `document_id` (FK), `seq`, `text`,
    `chunk_hash`, `tsv` (Postgres `TSVECTOR`, GIN-indexed, `to_tsvector('english')`).
  - `DocumentChunkEmbedding` (`document_chunk_embeddings`): `chunk_hash`, `model`,
    `vector` (`SafeVector(768)`), unique `(model, chunk_hash)` index, **HNSW
    `vector_cosine_ops`** index for ANN search.
  - `EvidenceItem.document_chunk_id` — the join that makes a citation openable.
- **`caos/server/engine/embeddings.py`** — `get_embeddings(texts)` batches via
  **Gemini `text-embedding-004`** (`embedding_dim = 768`), with a deterministic
  `get_mock_embedding` fallback when no `gemini_api_key`. **⚠ This is a cloud/paid
  path.** `OBSIDIAN_DATABANK.md` mandates the *vault* embedding path stay **local
  (Ollama)** so non-public issuer text never leaves the analyst machine. Resolve
  this fork explicitly in the chunk/embed stage (§4.1, §5).

### Retrieval (the consumer — reuse its contract)
- **`caos/server/retrieval.py`** — `Bm25Index`, `rrf_fusion`, `python_vector_search`,
  `retrieve(db, issuer_id, query, k)`, `retrieve_corpus(...)`. Your write path must
  land chunks where *these* functions already read from, or the agents can't see
  your OKF corpus. Do not fork retrieval.

### The existing Obsidian export (the frontmatter reference — DERIVED, write-only)
- **`caos/server/vault_export.py`** — `_yaml_block`, `render_issuer_hub`,
  `render_run_spoke`, `render_memo`, `autolink_issuers`, `_redact`, `export_run`.
  Today the vault is a **derived, write-only mirror** of CAOS analysis (arrows
  point *out* of CAOS; `OBSIDIAN_DATABANK.md` §"Design"). Settings in `config.py`:
  `vault_export_dir` (empty = disabled), `vault_name`, `vault_export_auto`.
- **`caos/server/config.py`** — `caos_storage_dir` (raw-file vault root),
  `embedding_model`/`embedding_dim`, avscan + OCR toggles, the `vault_export_*`
  settings. Add new settings here; do not repurpose the legacy ones.

### What's missing (what you are specifying into existence)
There is **no** module that (a) turns an extracted PDF into *structured* financial
records, (b) maps those records into OKF frontmatter + body, (c) writes OKF notes
into a headless vault, and (d) indexes them for the existing retrieval stack. That
is the pipeline you design.

---

## 4. The three design decisions the blueprint must resolve

The prompt names three; treat each as a first-class section of the blueprint with
options-then-commitment.

### 4.1 Chunking & embedding strategy for long-form credit reports
Decide and justify against low-latency RAG: chunk sizing and overlap (reuse
`ingest.py`'s 2400/240, or diverge — and if you diverge, say why long-form credit
prose + financial tables demand it); boundary logic (section/heading-aware vs
fixed-window; how tables and figure captions are handled so an embedding maps to
one coherent fact); the embedding backend (the local-vs-Gemini fork from §3 —
pick, and state the compliance consequence); and where vectors live so
`retrieval.py` reads them without a fork. Address the scanned/encrypted-PDF
degradation path (`NO_CHUNKS_WARNING`) — an OKF note built on zero chunks must not
read as success.

### 4.2 OKF metadata schema & Obsidian frontmatter
Author the **exact** YAML frontmatter every generated note carries: every field,
its type, whether required, its source (which extraction field or engine value it
derives from), and its role in agent queries. Obey the flat-scalar constraint
(`_yaml_block`). Reconcile field-for-field with what `vault_export.py` already
emits so the two note families share one vocabulary. Show a **complete worked
example** OKF note (frontmatter + body + `[[links]]`). Specify the hub-and-spoke
placement (issuer hub vs per-document spoke) and the `[[wikilink]]` edges that
make the graph queryable (issuer, sector, geography, peers, document type).

### 4.3 Interface boundaries & routing between the PDF-extraction module and the DB-write module
Define the seam: what crosses it (the strict typed payload — §6), the
routing/dispatch logic (how a given PDF is classified and routed — rating report
vs offering memo vs holdings file → which structuring path), and the
failure/degradation behavior at the boundary (a slow or failing extraction must
not hold a DB transaction open; a partial extraction must degrade to a
well-formed but flagged OKF note, never a silent drop). Keep the extraction module
free of DB knowledge and the write module free of PDF knowledge — the payload is
the only contract between them.

---

## 5. Hard boundaries / negative constraints (immutable — every decision survives these)

1. **Do NOT modify existing UI components.** This is a backend/data pipeline. No
   file under `caos/frontend/` is touched by this blueprint.
2. **Do NOT modify the legacy database schemas.** `documents`, `document_chunks`,
   `document_chunk_embeddings`, and the evidence/run tables are fixed contracts
   the whole engine depends on. The pipeline is **additive** — it may *write* rows
   to `document_chunks`/`document_chunk_embeddings` through existing code paths,
   but it must not alter their columns, indexes, or a migration that changes them.
   New persistent state goes in new tables or new files, never a legacy alter.
3. **Do NOT write the ingestion scripts.** The blueprint is the deliverable.
   Include an explicit instruction block *to* Opus 4.8 on how to build them (§6),
   but write no implementation yourself.
4. **Vault embedding path stays local; no paid services on the vault lane.** The
   OKF vault may hold non-public issuer text; its embedding/retrieval path must be
   local (e.g. Ollama) per `OBSIDIAN_DATABANK.md`. No Pinecone/Neo4j/LangChain/
   hosted vector DB. (The engine's existing Gemini path is a separate, pre-existing
   lane — do not extend the vault onto it.)
5. **No two-way sync; no second source of truth.** The canonical financial facts
   live in the engine DB. The OKF vault is a derived/queryable projection —
   arrows point *into* the vault from ingestion, never back out to overwrite
   canonical state. State how your inbound design avoids the dual-source-of-truth
   problem `OBSIDIAN_DATABANK.md` deliberately avoided (e.g. the vault note keys to
   its `document_id` and is regenerable from source, not hand-edited).

---

## 6. Output specification — how to write `PDF_INGESTION_OKF_BLUEPRINT.md`

Produce ONE Markdown file, **grouped strictly by pipeline stage** so Opus builds
sequentially top-to-bottom. Use exactly these stage groups, in order:

```
# PDF → OKF Ingestion Pipeline — Architectural Blueprint (for Opus 4.8)

## Stage 0 — Module map & new file layout   (paths + responsibilities, one place)
## Stage 1 — Extraction        (PDF bytes → ExtractedDocument)
## Stage 2 — Structuring       (ExtractedDocument → StructuredReport)
## Stage 3 — OKF mapping        (StructuredReport → OKFNote)
## Stage 4 — Chunk & embed      (OKFNote → chunks + vectors)
## Stage 5 — Write & index      (chunks/vectors → DB + vault files, retrieval-ready)
## Stage 6 — Retrieval contract (how the existing stack reads OKF; what it must not fork)

## Appendix A — The OKF frontmatter specification (authoritative field table + worked example)
## Appendix B — Instruction to Opus 4.8 (how to build the scripts)
```

Within each stage, **every item follows this shape — adapt it to what the stage
needs; it's a completeness floor, not a rigid form:**

```markdown
### <Stage N> — <Short title>
- **Goal (1 sentence):** <the transformation this stage performs, concrete, no hedging>.
- **New module / interface:** `caos/server/<module>.py` → <the class/function, named — NOT a line number>; interfaces it imports (`ingest`, `retrieval`, `database`).
- **Input schema → Output schema:** the named pydantic/typed model in, the named model out (defined in full in the schema block below).
- **Boundary & routing:** what crosses the seam, how input is classified/routed, and the degradation path on partial/failed input.
- **Opus instruction (technical):** <exact, imperative build steps — the module to create, the functions and their signatures, which existing function to call (`ingest.extract_text`, `get_embeddings`, the retrieval write path), error/degradation handling, and the negative constraint it must respect>.
- **Low-latency-RAG payoff:** <one line — how this stage keeps retrieval fast/faithful; if you can't state one, the stage is mis-scoped>.
```

**Strict data-transfer schemas are mandatory.** For every seam, define the exact
typed payload as a fenced pydantic (or dataclass) block — **field name, type,
required/optional, and invariant** — e.g. `ExtractedDocument`, `StructuredReport`,
`OKFNote`, `OKFChunk`. These are the only contracts between modules; they must be
precise enough that Opus writes the model verbatim. Ground field types in the
real DB columns they mirror (`document_id: str`, `seq: int`, `chunk_hash: str`,
`vector: list[float]` dim 768) so the write stage lands cleanly.

**Appendix B (the instruction to Opus 4.8) is a required, self-contained block.**
It tells Opus how to build the scripts from the blueprint: the module build order,
which existing functions to reuse vs. write new, how to test each stage in
isolation (a fixture PDF → assert the `OKFNote` shape → assert a chunk is
retrievable), the venv/run conventions from `CLAUDE.md`, and the negative
constraints restated. Opus should be able to execute it without re-reading this
brief.

**Rules for the blueprint:**
- **Reuse before invent.** Call `ingest.extract_text`, `ingest.store`,
  `get_embeddings`, and the retrieval write path rather than reimplementing them.
  New settings extend `config.py`; new tables are additive; never a legacy alter.
- **No line numbers.** Name the function, class, or module.
- **Every stage ties to a payoff and a constraint.** A stage with no
  low-latency-RAG payoff, or that touches a §5 boundary, does not ship as written.
- **Reconcile OKF with `vault_export.py`** — flat-scalar YAML; shared vocabulary
  with the existing hub/spoke notes; state the inbound-note redaction posture.
- **Name the embedding backend explicitly** and its compliance consequence (§5.4).

---

## 7. Self-check protocol (verify each data-transformation step)

Verification is a tool in service of the outcome, not a gate you march through.
The rhythm the user asked for is **a fresh-context sub-agent check after each
major data-transformation step** — treat the six stages of §6 as the checkpoints.
Dispatch verifiers **asynchronously and keep specifying later stages while they
run**; **reconcile every REVISE before you declare the blueprint done (§8)** —
that reconciliation is the gate, not mid-stream progress. Record each verdict
inline in the blueprint (`> Checkpoint (Stage N): P pass, M revised — <what changed>`).

**At each checkpoint, dispatch a verification subagent** (general-purpose or
Explore) with this charge — do **not** self-approve:

> "Review the just-specified stage(s) of `caos/docs/PDF_INGESTION_OKF_BLUEPRINT.md`
> (`<stage names>`). For each item verify: (1) **every file path, class, and
> function it names actually exists** in `caos/server/` (or is clearly marked
> new) — flag any hallucinated path or wrong signature; (2) the **data-transfer
> schema is complete and internally consistent** — the output model of this stage
> is exactly the input model of the next, field types match the real DB columns
> they mirror, no field an agent needs to filter/cite is missing; (3) the stage
> **serves low-latency RAG** — metadata filters resolve before semantic scan,
> chunk boundaries are clean, the write path indexes on write and lands where
> `retrieval.py` reads; (4) the stage **respects the OKF frontmatter spec**
> (flat-scalar YAML, reconciled with `vault_export.py::_yaml_block`); (5) no item
> **violates a §5 boundary** (UI edit, legacy-schema alter, paid vault embedding,
> two-way sync). Return a table: item → PASS / REVISE (with the specific defect).
> Be adversarial; assume paths are hallucinated and schemas leak until proven."

**Anti-hallucination guardrails (apply continuously):**
- Before citing any module/class/function/table column, confirm it exists
  (`grep`/read). A path or signature you did not verify is a defect.
- Before adding an OKF field, name the agent query or citation it enables. No
  consumer → cut it.
- Do not claim a benchmark or latency number you did not measure; reason from the
  index structure (GIN/HNSW, write-on-ingest) and say so.
- Prefer *reusing existing lanes* (`ingest`, `get_embeddings`, `retrieval`) over
  standing up parallel infrastructure. Verify the lane exists before you spec
  around it.

---

## 8. Definition of done

- `caos/docs/PDF_INGESTION_OKF_BLUEPRINT.md` exists, grouped Stage 0→6 + Appendix
  A (OKF spec) + Appendix B (Opus instruction); every item carries the §6 fields
  that apply to it — gate on the *information* being present, not literal template
  conformance.
- Every stage names real, verified file paths / functions (or clearly-marked new
  ones), a complete typed input→output schema, and a low-latency-RAG payoff.
- The OKF frontmatter specification is authoritative and reconciled with
  `vault_export.py` (flat-scalar YAML; shared vocabulary; stated redaction
  posture); a complete worked-example note is included.
- No item modifies a UI component, alters a legacy DB schema, puts the vault
  embedding path on a paid service, or introduces two-way sync; every seam
  degrades gracefully rather than dropping data silently.
- Appendix B is executable by Opus **top-to-bottom without re-reading this brief**
  — module build order, functions to reuse, per-stage test, and constraints.
- Every checkpoint is recorded inline; every REVISE is reconciled.
```
