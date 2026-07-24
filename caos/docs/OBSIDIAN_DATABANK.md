# Obsidian as an "Issuer Data Bank" — assessment + shipped slice

**Date:** 2026-06-21 · **Status:** v1 (manual export + opt-in auto) landed behind a flag.

## Verdict

The pitched concept — feed CAOS outputs into a Markdown knowledge graph and run
RAG over it — was assessed against what CAOS already ships. **Three of the
pitch's four "unique advantages" already exist in code**, so adopting Obsidian as
a *RAG backend* (the pitch's "Approach B") would replace working code with a
filesystem round-trip and new dependencies — a net negative. The pitch's heavier
stack (Pinecone, Neo4j GraphRAG, LangChain/LlamaIndex) also breaks the project's
**no-paid-services** rule and bolts infra onto a single-app deploy.

What is *genuinely* new and worth having is small: a **portable, human-readable
audit artifact** and an **issuer relationship graph** — both of which come from
one thing, *writing Markdown*. None of it needs a vector DB.

So the scope shipped is a **one-way Markdown exporter**, not a re-architecture.

## What CAOS already has (so Obsidian doesn't add it)

| Pitch's "unique advantage" | Already in CAOS | Where |
|---|---|---|
| Hybrid semantic + metadata filter | ✅ | `nlquery.py` (`Filter`/`IssuerFilter`, industry/country/metric + semantic) |
| Cross-issuer "portfolio" retrieval | ✅ | `retrieval.py` (`retrieve_corpus`, `retrieve_corpus_by_issuer`) |
| BM25 grounding over chunks | ✅ | `retrieval.py` (Okapi BM25; pgvector is the noted upgrade) |
| Citation → openable source | ✅ | `engine/lineage.py` CP-5B, `EvidenceItem.document_chunk_id` |
| Auditable claim→source lineage | ✅ | evidence model + CP-5 gate |
| Live SQL-ish portfolio dashboards | ◻️ own UI | Command Center / Pipeline |
| **Graph view of issuer cross-links** | ❌ | — (additive) |
| **Portable plaintext corpus / backup** | ❌ | DB + Report Studio only (additive) |

Note: the reference repo
([AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian),
MIT) is a single-user PKM Claude Code skill and is itself **BM25-first, no vector
DB** — same retrieval posture as CAOS.

## Design: the vault is a derived, write-only mirror

CAOS stays canonical. The vault is an **output target**, like the committee
report — arrows only ever point *out* of CAOS. The vault never feeds back, so
there is no second source of truth, nothing is removed, and it is fully
reversible (delete the folder).

```
Run completes ──> export_run(session, run_id, dir)  ──> {dir}/Issuers/{Issuer}.md   (hub: YAML + [[links]])
   (existing)            (vault_export.py)                {dir}/Runs/{Issuer - tag}.md (spoke: ## per module)
```

An analyst who wants in-vault RAG points a **local, free** Obsidian plugin (e.g.
Smart Connections) at the folder. CAOS keeps its own BM25/evidence stack.

## `Sources/` — the inbound OKF family (posture change)

The three families above (`credit-run`, `issuer`, `analyst-memo`) are **engine
output**. The OKF ingestion pipeline adds a fourth, `type: "source-document"`,
written only under `{VAULT_EXPORT_DIR}/Sources/` — a projection of an *inbound*
source PDF (rating report, offering memo, sponsor deck, lender update).

```
PDF uploaded ──> POST /api/okf/ingest ──> document_chunks   (canonical, retrievable on commit)
   (new)              (okf_ingest.py)  └─> {dir}/Sources/{Issuer - type - source - date}.md
```

**This is still one-way.** The note is *derived from the stored blob* and keyed to
its `document_id`; canonical facts stay in the engine DB and the note never feeds
back. Two-way sync remains never.

Two consequences worth stating plainly:

- **These notes contain extracted source text by design** — they *are* the
  document. That changes the posture from "the vault is safe to sync
  unconditionally" to "**the `Sources/` subtree holds source text and syncing it is
  a data-handling decision**". Every OKF note therefore declares
  `contains_source_text: true` in its frontmatter so sync tooling or a local-embed
  plugin can select or exclude the subtree deliberately. The outbound families keep
  `vault_export._redact` untouched — engine output still never carries raw source
  text off-machine.
- **`Sources/` is pruned from the analyst-memo scan.** `_scan_memo_files` skips it
  alongside `Runs/` and `Issuers/`, so an ingested document is never mistaken for
  analyst commentary and registered as an `AnalystLink`.

Vault-side embedding stays analyst-side and local (Smart Connections / Ollama) —
CAOS ships no embedder for the `Sources/` files. The machine-RAG corpus embeds on
the existing engine lane, which is a pre-existing path, not a new egress.

## What shipped

The spoke note stores the **full** agent output, not a preview: each module
(agent) is a `##` section carrying its complete `runtime_output` (scalars inline,
nested structures as a fenced JSON block — nothing truncated), its claims with
evidence-id citation pills, and a `## QA findings` section holding the CP-5
gate's output (severity, lane, description, remediation). The hub note links the
issuer's `[[Industry]]` and `[[Country]]` so Obsidian's Graph view clusters
issuers by sector and geography.

Raw source text is redacted on the way out: values under raw-content keys
(`raw_text`, `source_text`, `chunk_text`, `excerpt`, `transcript`, …) are blanked
recursively before a module's output is written, so a module that ever echoes a
document chunk into its output can't leak it into a vault file that might sync
off-machine. Analytical values are untouched.

| File | Change |
|---|---|
| `server/vault_export.py` | New. Pure renderers (`render_run_spoke`, `render_issuer_hub`) + DB orchestrator `export_run`. Stores full module output + QA findings; emits sector/geo graph links. `python vault_export.py` runs a self-check. |
| `server/config.py` | New settings `vault_export_dir` (empty = disabled) and `vault_export_auto`. |
| `server/routes/runs.py` | New `POST /api/runs/{run_id}/vault` (manual export; 503 if unconfigured). |
| `server/run_executor.py` | `_maybe_export_to_vault` — auto-export on finish iff `vault_export_auto` and run is *Committee Ready*. Best-effort; never fails a run. |
| `frontend/src/lib/api.ts` | `exportToVault(runId)`. |
| `frontend/src/components/reports/ExportToVaultButton.tsx` | New. Self-contained "Export to vault" button. |
| `frontend/src/components/reports/panels.tsx` | `ExportPanel` renders the button when given an optional `runId` (hidden in today's mock studio). |
| `tests/server/test_vault_export.py` | Render link-integrity + a DB round-trip through `export_run`. |

## Button vs. automatic — both, behind one flag

- **Manual button** (shipped, wired): `POST /api/runs/{id}/vault`. Not gated on
  Committee Ready — a draft exports with its qa/committee status stamped into the
  note frontmatter. This is the analyst-override path.
- **Automatic** (shipped, off by default): on run finish, if `vault_export_auto`
  is on *and* the run is Committee Ready, it exports itself. Drafts/failures
  don't pollute the audit vault.

## Enabling it

```bash
# .env / app resource
VAULT_EXPORT_DIR=/path/to/ObsidianVault   # empty (default) = feature off, route 503s
VAULT_EXPORT_AUTO=true                     # optional: also export Committee-Ready runs on finish
```

On the self-hosted stack, point `VAULT_EXPORT_DIR` at a durable volume mount
(same pattern as `CAOS_STORAGE_DIR`). The Report Studio runs on mock data today, so the UI button
mounts only once a page passes a live `runId` into `ExportPanel`; the
`POST .../vault` route and auto path work independently of the UI.

## Graph view & Smart Connections (analyst-side)

Both are Obsidian-side, not CAOS code — they consume the vault the exporter writes.

- **Graph view** (native Obsidian). Maps `[[wikilinks]]`. The exporter emits
  hub↔spoke links, each hub's `[[Industry]]`/`[[Country]]` links (**concentration**
  — every issuer in a sector/country shares a node), and a `## Related issuers`
  block of `[[Peer]]` links (**contagion** — issuer↔issuer peer edges). Peer names
  come from CP-1C (`engine/peers.py`), which now persists its peer set; the hub's
  `related_issuers` slot renders them. Sponsor edges still pending (no name in
  output — needs NER).
- **Smart Connections** (Obsidian community plugin, free, local). Embeds the
  vault for chat/semantic recall. The YAML frontmatter + `##`-per-module headers
  give it clean chunk boundaries. **Compliance:** keep embeddings local (Ollama)
  so non-public issuer text never leaves the analyst machine — matches
  no-paid-services. CAOS ships nothing for this.

## Deliberately skipped (add when asked)

- **Vector DB / Pinecone / Neo4j GraphRAG / LangChain** — redundant with the
  existing BM25 + evidence stack; violates no-paid-services. Skipped entirely.
- **Sponsor contagion edges** — peer edges are now wired (CP-1C emits its peer
  set → `related_issuers` → `[[Peer]]` links). Sponsor edges are not: CP-2D
  (`engine/sponsor.py`) stores governance red-flag *labels*, not the sponsor
  name, so the flagship "issuers exposed to `[[Apollo]]`" query needs sponsor NER
  first.
- **Two-way sync** — never. The vault is derived; bidirectional sync reintroduces
  the dual-source-of-truth problem the design avoids.
