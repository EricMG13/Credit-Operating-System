# Tier-1 Engine Plan — Runs, Evidence, and the QA Gate

**Status:** Steps 1–8 landed (full slice + UI adapter + export gate + Alembic) · **Date:** 2026-06-13
**Scope owner:** CAOS backend

> **Build status (2026-06-13).** All eight steps are implemented and verified on
> SQLite against the seeded ATLF deal.
>
> - **Steps 1–6 (engine spine):** persistence ([database.py]), BM25 retrieval
>   ([retrieval.py]), the engine package ([server/engine/]: schemas, gate,
>   lineage, fixtures, synth, runner), and the run API ([routes/runs.py]).
>   `POST /api/runs` completes and gates to **Restricted** (2 MATERIAL findings),
>   reproducing the seeded "CONDITIONAL / pack HELD" outcome; CP-1 evidence
>   resolves to ingested chunks.
> - **Step 7 (UI adapter):** [frontend/src/lib/engine/] — `adapt.ts` maps a
>   canonical payload to the existing `{kpis, sections}` renderer; `useLiveRun`
>   loads the latest complete run; `ModuleView` gained an optional `liveOut` prop
>   with static fallback. Verified in-browser: the deep-dive CP-1 tab renders
>   live adapted output (Net leverage KPI, normalized-financials table, an
>   "Evidence-traced claims" section with E-xx chips) with a ● LIVE badge, no
>   console errors. The offline sim demo is unchanged when no run/backend exists.
> - **Step 8 (export gate):** `POST /api/runs/{id}/report` ([engine/report.py])
>   refuses with 409 unless the run is Committee Ready — the ATLF (Restricted)
>   run is refused with its blocking findings.
> - **Alembic (was deferred):** now added — async env.py wired to settings +
>   `Base.metadata`, baseline (0001) + engine (0002) migrations. `init_db` runs
>   `upgrade head` on boot and stamps a pre-Alembic database first (verified:
>   legacy DB adopted in place, data intact). SQLite stays the dev default;
>   Lakebase just points `DATABASE_URL` at Postgres.
>
> 40 server pytest + 41 frontend vitest pass; frontend lint/tsc/build green.
> Next: more analytical modules (CP-1A…CP-6E), CP-X DAG executor, CP-MON,
> email intake; background run execution + per-run token budgeting before
> opening the runner to all modules.
**Goal:** Convert CAOS from a UI mock of the Modular OS methodology into a system
that *executes* modules, *persists* their outputs, *grounds* them in uploaded
documents, and *gates* them on evidence — the minimum that makes the output
institutionally defensible.

---

## 1. Why this slice first

> **Status (as of the shipped engine):** this plan is historical — the engine now
> wires **19 implemented modules** in the default plan (+ flagged CP-2G/CP-4D, + 2 spec-only) per [`server/engine/registry.py`](../server/engine/registry.py),
> not the "27" / "CP-0 → CP-1 → CP-2 slice" framing below. The "27" counts the
> broader `Modular OS/` corpus, not what executes. Numbers in this doc are kept as
> originally written.

The methodology (`Modular OS/`) is fully specified; the app renders 27 modules of
output but the backend executes none of them. The deep-dive output the UI shows
today is hand-written TypeScript — the files even say so:

> `// ATLF demo data — replace with live module outputs when CP backend persistence lands.`
> — [module-outputs.ts](../frontend/src/lib/deepdive/module-outputs.ts), [module-steps.ts](../frontend/src/lib/deepdive/module-steps.ts)

This plan delivers the **spine** the rest of the roadmap (CP-X DAG executor,
CP-MON monitoring, email intake, portfolio/sector aggregation) hangs off. It
deliberately does **not** try to bring all 27 modules live at once.

### In scope
1. A persistence layer for **runs, module outputs, evidence, and QA findings**, mapped 1:1 to the canonical methodology schemas.
2. A **module runner** that assembles inputs → retrieves evidence from the issuer's documents → calls Claude with the module's Active Prompt → parses, schema-validates, and persists the result.
3. **Retrieval grounding** over the `document_chunks` we already store (today nothing queries them).
4. The **CP-5B lineage check** and the **CP-5 QA severity gate**, enforced in code as a real `Blocked / Restricted / Passed` decision that the Report Studio respects.
5. A **vertical slice** proving it end-to-end for one issuer: `CP-0 → CP-1 → CP-5B → CP-5`.

### Explicitly out of scope (later tiers)
- The full CP-X DAG executor (we hard-code the slice's order; CP-X comes next).
- Bringing all 24 analytical modules live (the runner is generic; only the slice's prompts are wired and validated first).
- CP-MON scheduling, email intake, vector search, portfolio aggregation.
- Auth changes (platform-managed identity stays as-is).

### Non-negotiable principle
**The gate is deterministic, not LLM-decided.** The model produces *findings*
(with severities); a pure function computes `qa_status` and `committee_status`
from them. The LLM never gets to declare itself "Committee Ready."

---

## 2. The data model is given, not invented

The methodology already defines the contracts in
`Modular OS/KNOWLEDGE SOURCES/02_SCHEMA/`. We map them to SQLAlchemy tables. No
new conceptual model is required — this is the single biggest de-risker.

| Methodology schema | Becomes table(s) | Key fields |
|---|---|---|
| `CP_SHARED_ARTIFACT_ENVELOPE` (19-field envelope) | `runs` + envelope columns on `module_outputs` | run_id, parent_run_id, issuer_id, analyst_id, analysis_date, period_end_date, schema_version |
| `CP_MODULE_PAYLOAD_BASE` | `module_outputs` | module_id, module_name, owned_object, schema_family, `runtime_output` (JSON), confidence, qa_status, limitation_flags, downstream_consumers |
| `CP_EVIDENCE_TRACE` | `claims` + `evidence_items` | claim_id, claim_text; evidence_id, extraction_type (13-enum), source_locator, lineage_class (8-enum), confidence |
| `CP_QA_RESULT` | `qa_results` + `qa_findings` | qa_status, committee_status, finding severity (CRITICAL/MATERIAL/MINOR), affected_claim_id, required_remediation |
| `CP_VALIDATION_RESULT` | columns on `module_outputs` | validation_status, validation_errors, validation_warnings |

### Tables (additive to the existing `Issuer` / `Document` / `DocumentChunk`)

```
runs
  id (uuid, pk)              run_id in the envelope
  issuer_id (fk issuers)
  parent_run_id (fk runs, nullable)   re-runs / refreshes
  status            queued | running | complete | failed
  analyst_id        forwarded identity (X-Forwarded-Email)
  as_of_date        date the source pack represents
  model_id          e.g. claude-opus-4-8   (reproducibility)
  prompt_version    methodology version pin (e.g. v2.0)
  created_at, completed_at

module_outputs                one row per module per run
  id (uuid, pk)
  run_id (fk runs, index)
  module_id         CP-(0|[1-6][A-F]?|X|SR|MON|...) — regex-checked
  module_name, owned_object, schema_family
  runtime_output    JSON  (the module-specific payload body)
  confidence        High | Medium | Low | Insufficient Information
  qa_status         Not Reviewed | Passed | Restricted | Blocked
  committee_status  Committee Ready | Draft Only | ... | Blocked
  validation_status Passed | Restricted | Blocked | Not Executed
  limitation_flags  JSON array
  downstream_consumers JSON array
  created_at
  UNIQUE(run_id, module_id)

claims
  id (uuid, pk)
  module_output_id (fk, index)
  claim_id          stable within the output (e.g. C-07)
  claim_text

evidence_items
  id (uuid, pk)
  claim_id (fk claims, index)
  evidence_id       E-xx  (matches the UI's existing citation ids)
  extraction_type   sourced_fact | quoted_text | table_value | ... (13 enum)
  lineage_class     Directly Sourced | Calculated | ... | Untraced (8 enum)
  source_locator    human-readable trace
  document_chunk_id (fk document_chunks, nullable)  ← the retrieval link
  confidence

qa_findings
  id (uuid, pk)
  run_id (fk runs, index)
  finding_id
  severity          CRITICAL | MATERIAL | MINOR
  lane              1..8  (the eight CP-5 audit lanes)
  description
  affected_claim_id (nullable)
  required_remediation
```

**`evidence_items.document_chunk_id` is the join that makes citations real** —
it points an `E-xx` at the actual chunk it came from, enabling true
click-to-source in the Evidence Trace panel (the blueprint's "positional anchors"
dependency, §2).

### Migrations
Today schema is `create_all` + ad-hoc `ALTER TABLE` in
[`_apply_additive_migrations`](../server/database.py). Before runs/evidence become
real assets, adopt **Alembic**. First Alembic revision = baseline of the current
three tables + everything above. This is also the durability hardening item from
the Tier-3 list, pulled forward because the data now matters.

---

## 3. The module runner

A single generic function; the slice wires three module prompts through it.

```
run_module(run, module_id) ->
  1. INPUT GATE    Check upstream module_outputs this module requires are
                   present and not Blocked (per SYSTEM_ROUTE_MAP_v2 edges +
                   hard stops, e.g. CP-2B conditional stop, CP-3B input gates).
                   Fail closed → record Blocked, skip the model call.
  2. RETRIEVE      Pull the issuer's document_chunks relevant to this module's
                   information needs (see §4). Pass as grounded context.
  3. CALL          Claude (claude-opus-4-8) with the module's Active Prompt
                   (Modular OS/CP-*/CP-*_ACTIVE_PROMPT.md) as system, the
                   retrieved chunks + upstream payloads as context. Request the
                   payload as JSON matching the module's payload schema.
  4. PARSE+VALIDATE  Parse JSON; validate against
                   02_SCHEMA/MODULE_PAYLOADS/CP-*__payload.schema. Validation
                   failure → validation_status, recorded, not silently dropped.
  5. PERSIST       Write module_outputs + claims + evidence_items, linking each
                   evidence_id to its source document_chunk_id where resolvable.
```

Inputs (the Active Prompts) already exist on disk — the runner *reads the
methodology files at runtime*, so the prompt library stays the single source of
truth and we don't fork it into code.

### Reproducibility (cheap to add now, expensive to retrofit)
Every run records `model_id`, `prompt_version`, and the set of source document
versions/as-of dates it saw. A committee memo can then be reconstructed exactly —
table stakes for credit audit.

---

## 4. Retrieval grounding

We already chunk documents into `document_chunks` ([ingest.py](../server/ingest.py))
but **nothing ever queries them** — chat is grounded only on context the client
passes in ([llm.py](../server/llm.py)).

- **Phase 1 (this slice):** keyword / BM25 retrieval over `document_chunks`,
  scoped to the run's issuer, with the module's information needs as the query.
  No new infra; ships immediately; makes "Never invent figures" enforceable.
- **Phase 2 (later):** embeddings + Databricks Vector Search; same interface, so
  the runner doesn't change.

The retrieved chunk ids flow into `evidence_items.document_chunk_id`, closing the
loop from claim → evidence → source.

---

## 5. The QA gate (deterministic)

Two steps, both backed by methodology REF files, the second a pure function.

**CP-5B EvidenceTraceValidator** — validate claim→source lineage; flag orphan
claims (claims with no evidence item) and `Untraced` / `Weak Lineage`
classifications. Emits findings.

**CP-5 ResearchIntegrityQA severity gate** — per `SYSTEM_ROUTE_MAP_v2.md`:

```
def qa_status_from(findings):
    if any(f.severity == "CRITICAL"  for f in findings): return "Blocked"
    if any(f.severity == "MATERIAL"  for f in findings): return "Restricted"
    return "Passed"                       # only MINOR or none

def committee_status_from(qa_status, confidence):
    if qa_status == "Blocked":                      return "Blocked"
    if qa_status == "Restricted":                   return "Restricted"
    if confidence == "Insufficient Information":    return "Insufficient Information"
    return "Committee Ready"
```

**Enforcement point:** Report Studio export checks `committee_status`. A run
containing any module that is `Blocked` cannot produce a "committee-ready" report —
the export is refused with the blocking findings surfaced. This is the single
behavior that distinguishes CAOS from a generic LLM wrapper.

---

## 6. API surface & frontend contract

New routes (additive; existing routes untouched):

```
POST /api/runs                  {issuer_id, as_of_date}         -> {run_id, status}
GET  /api/runs/{run_id}                                          -> run + per-module status
GET  /api/runs/{run_id}/modules/{module_id}                      -> full payload + evidence
GET  /api/runs/{run_id}/qa                                       -> findings + gate result
POST /api/runs/{run_id}/report  (refused if any module Blocked)  -> committee report
```

**Serving the existing UI with minimal rework.** The deep-dive renderer consumes
`ModuleOutput { kpis[], sections[] }` + `MODULE_STEPS` + `E-xx` citations +
inline `[[cite:n]]` markers ([module-outputs.ts](../frontend/src/lib/deepdive/module-outputs.ts),
[citations.ts](../frontend/src/lib/citations.ts)). Rather than rewrite the UI, add a
**thin adapter** (`runtime_output` → `{kpis, sections}`) so the live payload drops
into today's renderer. The seeded constants become the adapter's test fixtures —
they already encode the expected shape, so they validate the adapter for free.
The `ok | warning | gap` severities map to MINOR / MATERIAL+confidence / CRITICAL.

---

## 7. Build order (vertical slice first)

| # | Step | Proves |
|---|---|---|
| 1 | Alembic baseline + the §2 tables | Persistence exists |
| 2 | `POST /api/runs` + `runs` lifecycle (queued→complete) | A run is a real object |
| 3 | BM25 retrieval over `document_chunks` | Modules see real documents |
| 4 | Runner + **CP-0** (source readiness) wired end-to-end | Input gate + parse + persist path works |
| 5 | **CP-1** (canonical financials) through the runner | A substantive analytical payload persists with evidence |
| 6 | **CP-5B** lineage check → **CP-5** gate (deterministic) | The differentiator: a real Blocked/Restricted/Passed |
| 7 | Deep-dive adapter so the live CP-0/CP-1 payloads render in the existing UI | The mock seam is removed for the slice |
| 8 | Report export refusal on Blocked | The gate has teeth |

After the slice lands, adding modules CP-1A…CP-6E is mostly: write/validate the
adapter mapping + confirm the payload schema — the engine, gate, and persistence
don't change.

---

## 8. Risks & decisions to lock before coding

1. **Durability target for the slice.** Recommend defaulting `DATABASE_URL` to
   Lakebase (Postgres) now and treating SQLite as dev-only, since runs/evidence
   are real assets. Alternative: ship the slice on SQLite, migrate before Tier-2.
   *Decision needed.*
2. **Frontend contract.** Recommend the thin adapter (keep the UI, fixtures from
   the seeded data) over migrating the UI to the canonical envelope now. Lower
   risk; revisit when more modules are live. *Recommended default; confirm.*
3. **Payload schema strictness.** The `MODULE_PAYLOADS/*.schema.txt` files are
   partly prose-style, not all strict JSON Schema. We'll need to firm up the
   slice's three (CP-0, CP-1, CP-5/5B) into validatable JSON Schema. Small,
   contained.
4. **LLM cost.** A full run fans out to ~20 model calls. The slice is 4 calls, so
   fine now, but add per-run token budgeting + caching before opening the runner
   to all modules (Tier-3 item, flagged here so it isn't forgotten).

## 9. Open questions for sign-off
- Lakebase now, or SQLite-for-the-slice? (Risk 1)
- One reference issuer to target for the slice — reuse the seeded "ATLF" deal, or a real document pack you can share?
- Is the existing `react-markdown` allow-list (blueprint §6) the rendering path we keep for live narrative, or revisit?
