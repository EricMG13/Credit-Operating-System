# DECISIONS.md — Keep / Adapt / Discard

Companion to `architecture/ARCHITECTURE.md` and `audit/AUDIT-2026-07-28.md`. Two
tables: **A** — legacy CAOS components; **B** — all 36 `DEPLOY_B_COWORK_SKILLS`
entries. Checklist IDs cited by native number. Verdicts:

- **KEEP** — port near-verbatim **with tests**; golden-master parity applies where numeric (9.1).
- **ADAPT** — port the logic/semantics with a defined change (the change is stated in the row and, where behavioural, logged in `DEVIATIONS.md`).
- **DISCARD** — not carried; replaced by a platform primitive or deliberately dropped.

## Table A — Legacy CAOS components

### A.1 Deterministic engine (the crown-jewel assets)

| Component (evidence) | Verdict | Rationale / target |
|---|---|---|
| CP-5 gate — `engine/gate.py` + roll-up + CP-5D cascade | **KEEP** | Checklist 8.3, "a model never grades its own output"; fail-closed twice over (unknown status ranks worst; only explicit `Passed` reaches committee). Ports with `test_cp5_gate_honesty.py` in Phase 1 — fastest asset to validate. Renamed to canonical CP-5A identity (corpus alias register). |
| Numeric-safety kernel — `engine/periods.py` (`is_finite_number`, `safe_div/mul/add`, `latest_annual`, `sort_key`) | **KEEP** | Checklist 9.2; the repo's most-repeated bug class is dead only because of this kernel. Phase 1, with property tests. Becomes the **only** period/number kernel (audit F-7). |
| Module registry — `engine/registry.py` (`depends_on` vs `after`, import-time cycle validation, `session_bound`, feature flags) | **ADAPT** | Highest-value 290 LOC; comments encode ~15 audit findings — port them. Adapted: module IDs renamed to canonical corpus namespace via the alias register; DAG edges reconciled with corpus `ROUTE_GRAPH.md` v2.6 (differences logged in DEVIATIONS); single session-bound declaration point (audit §5.9). |
| Runner semantics — input gate, structural-Blocked persist, fact-projection stop, roll-up scope, CP-X plan persistence (`engine/runner.py`) | **ADAPT** | The *semantics* port as the orchestration contract; the *executor loop* is replaced by Workflows (6.3). Stop-on-Blocked becomes job-level halt + DB state check (ARCHITECTURE §6). |
| Module synthesizers — 21 implemented modules (`readiness.py`, `edgar_cp1.py`, `reported_cp1.py`, `adjusted.py`, `factpack.py`, `earnings.py`, `peers.py`, `coststructure.py`, `downside.py`, `catalysts.py`, `sponsor.py`, `liquidity.py`, `macro.py`, `relval.py`, `capstructure.py`, `portfoliofit.py`, `refinancing.py`, `legal.py`, `covenants.py`, `debate.py`, prompt bundles) | **KEEP** | The analytical IP. Port per module under canonical IDs with per-module parity fixtures (9.1). Inline divisions route through `safe_div` (audit §2 note); mypy --strict from day one (audit F-12). |
| Evidence chain + projection boundary — `Claim`/`EvidenceItem`/`DocumentChunk`/`MetricFact` models, `metrics._citation`, anti-fabrication suppress-sourced resolution | **KEEP** | Checklist 8.5 enforced by schema; ≤2 hops by construction. Phase 1 DDL + Phase 3 port with `test_evidence_resolution.py` semantics. |
| CP-5B lineage validator — `engine/lineage.py` | **KEEP** | Canonical CP-5 identity. Lane taxonomy (orphan→CRITICAL etc.) ports intact; locator-aware resolution upgrade is a logged post-parity deviation (legacy self-flagged limitation). |
| Budget — `engine/budget.py` (atomic reserve→record, cache-invariant, cumulative per run) | **KEEP** | Feeds 3.3 until AI Gateway budgets take over; then remains the per-run in-band ceiling (gateway limits are per-endpoint/principal, not per-run). |
| Presets tier map + specialised pickers — `engine/presets.py` | **ADAPT** | Tier→model map moves to bundle config referencing gateway endpoints (3.7); mode×lane table, cross-provider reviewer, allowlisted `X-Query-Model` logic port. |
| Provider seam — `engine/llm_client.py` + adapters | **ADAPT** | Checklist 3.1's own framing: "an adapter swap, not a rewrite". `create(lane=…)` interface, same-provider-fallback rule, degraded→MATERIAL finding port; backends become Gateway endpoints; `.name=="live"` string switch becomes an enum (audit F-6). |
| Fixture mode — `engine/fixtures.py`, `FixtureSynthesizer`, ATLF reference deal, demo-contamination guard | **KEEP** | Checklist 3.6; the fixture corpus is also the Phase-1 parity seed. Contamination guard (provenance + MATERIAL finding) ports with it (audit F-10). |
| CP-5C council — `engine/council.py` (cross-provider critic ensemble) | **KEEP** (flagged) | Legacy-only finding *producer* feeding the deterministic gate — consistent with 8.3 (it never grades its own drafts: `reviewer_model()` picks the opposite provider). No corpus equivalent; stays feature-flagged off by default. |
| Model Engine v2 — `model_engine_v2.py` (pure calculation authority; PIK/FX/roll-forward guards) | **ADAPT** | Ports as the CP-2G (ForwardCreditModel) implementation emitting a CP-2G-conformant payload (Table B). Its private period kernel is deleted in favour of the shared one (audit F-7) — behaviour-identical, parity-checked. |
| Model workbook round-trip — `model_workbook.py` (hash-verified export, identity binding, signed preview tokens) | **ADAPT** | Ports as the Model Builder workbook exporter under its own `CAOS_MODEL_WORKBOOK_V1` contract — corpus CP-MODEL is excluded (owner Q-001R: legacy Model Builder serves the same function). openpyxl stays the single workbook stack (frontend `exceljs` retired — audit §8.2). |
| Report exports — `report_exports.py` (frozen-payload-only XLSX/PDF renderers) | **ADAPT** | Ports as Report Studio's exporters over frozen `ReportVersion` payloads — corpus CP-SNAP is excluded (owner Q-001R: Report Builder/Report Studio serves the snapshot function). |
| Query lane — `querygraph.py`, `queryanswer.py`, `retrieval.py` (RRF fusion), `nlquery.py`, `rerank.py`, `entailment.py` | **ADAPT** | Ports onto Lakebase pgvector + silver chunk tables. Two mandatory changes: close the `nlquery`/`scenario` egress carve-outs at the seam (audit §8.1.2), and fix the three fail-open `_passes` branches (audit class C) — both logged. Scan caps become surfaced limitation flags (audit F-9/class H). |
| EDGAR client — `server/edgar.py` (stdlib-only, SSRF-hardened, throttled) + `engine/edgar_cp1.py` | **KEEP** | Moves into the ingestion job; the fair-access throttle becomes job-level config. |
| Deep-research lane — `deepresearch.py` + `research_report.py` | **ADAPT** | Adapted to the corpus CP-DR contract (plan approval, scope fields, coverage/stop-reason enums — enforced by `validate_handoff.py` CP-DR profile) and given an `allowed_domains` restriction via gateway guardrails (audit §8.1.3). |

### A.2 State, data, security

| Component | Verdict | Rationale / target |
|---|---|---|
| ~70-model `database.py` god-module | **DISCARD (shape)** | Entities survive; the monolith does not. Rebuild is schema-first DDL split by domain (`dbx/schemas/`), constraints in schema (audit F-3). |
| Alembic history (68 revisions) | **DISCARD (history)** | Fresh baseline DDL for Lakebase; discipline ports (single-head check, forward-only, never rename applied revisions). Migration classes per 9.5: analytical layer **re-derived**, so old revisions need not replay. |
| C3 CHECK-constraint discipline (`C3JsonObjectCheck`, string bounds, observation-key checks) | **KEEP** | Rare, valuable schema-level typed-payload enforcement — generalized to the new OLTP schema. |
| `news` signal DB kill-switch (`ck_watch_rules_signal_type` + downstream bans) | **KEEP** | Checklist 8.4 verbatim: disabled-by-constraint until approved. |
| `Run` reproducibility fields (`model_id`, `prompt_version`, `model_mode`, `input_corpus_sha256`, snapshot state, idempotency, partial-unique active-run index) | **KEEP** | Checklist 3.7 + 6.4; DB-enforced cross-replica invariants are the platform-state rule (audit F-8). |
| `ReportVersion` verify-on-read + `run_inputs` corpus digest | **KEEP** | Checklist 6.4; canonical-JSON double-sorted digest incl. authority-absence entries ports byte-identical (hash compatibility ⇒ parity across cutover). |
| `approval_state` machine (draft/ratified/published/rejected) + manifest approval + publish-time re-check | **KEEP** | Checklist 8.1; downstream Jobs gate on it (Databricks column verbatim). |
| `LLMCallRecord` + `LineageEdge` + `PipelineRun` event log | **KEEP** | 3.4 complement + 8.2; gateway inference tables layer on top, not instead. |
| pgvector embeddings (768, chunk-hash-keyed, HNSW) | **KEEP** | On Lakebase pgvector (6.2, D-DBX-001). Mock-vector contamination lesson: embedding rows carry provenance; fixture vectors never share a live model name (migration-0060 post-mortem). |
| Intake gates — `avscan.py` (fail-closed ClamAV), `xlsx_safety.py` (OOXML gate), `ingest.py` sniffing + `parse_bounded` killable-child sandbox + ceilings table | **KEEP** | Checklist 7.1/7.2/7.3 with exact ceiling values ported as config. Fix in port: PDF lane sniff-before-scan ordering normalized to scan-first (audit §D-finding). Scanner runs in the ingestion job (D-DBX-002). |
| `llm_safety.py` (`UNTRUSTED_RULE`, `wrap_untrusted`, `safe_chunk_id`, `loads_finite`, `extract_json` single seam) | **KEEP** | Checklist 3.5's app-side layer; the single-seam design is what makes injection hardening unforgettable. Delimiter-escape hardening added (audit §D-finding 7). |
| Boot guards — `_require_safe_deployment_configuration`, `is_deployed` asymmetry, `require_sane_environment`, credential-strength predicate | **KEEP** | Checklist 6.5; adapted to read the platform secret scope; posture computed once into a config object (audit F-6). |
| GDPR erase — `erase_analyst.py` + `erase_analyst_data` (delete-private / anonymize-shared, longest-first redaction) | **KEEP** | Checklist 4.7; becomes a governed job/notebook; adds Delta `DELETE`+`VACUUM`; full-table redaction scans get WHERE-scoped (audit §D-finding 8). |
| Tenancy — `tenancy.py` (404-not-403, run-access gates) | **ADAPT** | Maps onto UC grants/ABAC + workspace groups (2.2); the 501-under-tenancy aggregate lanes are finished, not ported as-is (audit §8.5). |
| Rate limiting — `rate_limit.py` two-tier + credential-lane throttles + constant-work login | **ADAPT** | App-side fixed-window ports for expensive lanes (7.4); model-lane limits move to AI Gateway (3.3); the SQLite shared store is replaced by Lakebase-backed counters (platform-state rule). |
| CSRF (`csrf.py`), security headers/CSP, `/docs` closure, request limits | **KEEP** | 7.4/7.5. CSP hash derivation re-derived for the Vite bundle (audit C §10.7). |
| Access-log sanitization + volume field (`access_log.py`) | **KEEP** | The good half of 4.6; lands in a durable store this time (UC audit logs + app log table for sensitive-domain reads — OPEN-QUESTIONS Q-011). |
| `run_sec_audit.py` route-coverage AST gate | **KEEP** | CI gate asserting every route carries identity/role deps — ports against the new app. |
| Secret log-hygiene test (`test_secret_log_hygiene.py`) | **KEEP** | Boots with sentinel secrets, fails on leak — ports as-is. |
| Vendored `vendor/sanitize.py` (BUSL-1.1, dead code) | **DISCARD** | Only non-OSI licence in tree, unwired (5.2). PII detection → UC classification + gateway guardrails (4.5/3.5). |

### A.3 Execution & deploy plumbing

| Component | Verdict | Rationale / target |
|---|---|---|
| Four executors + pollers + `executor_base.py` (~77 KB) | **DISCARD** | Checklist 6.3 verbatim; documented double-execution race (audit F-2). Semantics they carried (idempotency, cumulative budget, lease audit trail) survive in DB + Workflows. |
| oauth2-proxy + Caddy edge | **DISCARD** | Checklist 2.1: deleted, not re-implemented. Header-strip discipline is inherited by the platform edge. |
| Docker stack (8 services), `vault-init`, image digests, `build_release_manifest.py` | **DISCARD** | Checklist 5.5/6.1 → Asset Bundles + Terraform. Release-manifest hashing idea survives as bundle artifact hashing. |
| `backup.sh` / `backup_sync.sh` / rclone / `restore_drill.sh` | **DISCARD** | Checklist 4.3/6.6 → Lakebase managed backups + Delta; **the restore-drill habit ports** as a scheduled platform drill (rotation-after-verified-artifact lesson kept). |
| Obsidian `vault_export.py` | **DISCARD** | Checklist 4.3. Committee-ready sharing happens via governed Report Studio exports only. |
| MCP EDGAR wrapper (`caos/mcp/edgar`) | **DISCARD** | Forged-identity client (audit §8.1.6). If an MCP surface returns, it authenticates as a real principal (2.3). |
| Scheduled-monitoring "external scheduler" gap (`alert_triggers.py`, `alert_dispatch.dispatch_once`) | **ADAPT** | Half-built by design; becomes Workflows schedules calling the ported evaluation/dispatch functions (6.3) — the intent contract and lease semantics keep their tests. |

### A.4 Frontend

| Component | Verdict | Rationale / target |
|---|---|---|
| Next.js 16 app-router toolchain | **DISCARD** | D-LEG-001: Databricks Apps reference pattern is React/Vite; audit C found no hard blockers (no next/image, no route handlers, no RSC substance, no SSR fetching). |
| `api.ts` (1,643 LOC) + satellite hand-written clients (~60 path literals) | **DISCARD** | Checklist 5.6 → OpenAPI-generated client + CI drift gate. |
| Design system — `--caos-*` tokens, Panel (+`usePanelBody` overflow-aware focus), `.tabular` (1,051 uses), motion/reduced-motion CSS, paper mode (`--paper-*`, `.rd-*`) | **KEEP** | Checklist 9.3 + Design Context. Tokens collapse to one source (audit F-17); `.tabular` carried explicitly; paper tear-sheet system ports whole. |
| `nav.ts` 5-group/15-destination model | **KEEP** | Source of truth for the workbench IA; dead dynamic-route metadata dropped. |
| Surfaces (Deep-Dive, Model Builder, Report Studio, Query/Ask, Monitor, Command Center, Pipeline, + secondary) | **ADAPT** | Ported to Vite + generated client, tests-first on the worst-complexity clusters (audit F-13); fail-closed status mapping rule everywhere (`useLivePipeline` pattern). |
| Evidence Sync (32-LOC context + EvChip + `.caos-selected`) | **KEEP** | Checklist 8.5's UI half — keyboard-operable cross-pane source sync. |
| `a11y-axe.mjs` runner + bespoke layout audits, zoom-200 script | **KEEP** | Checklist 9.3 gate; route matrix + readiness contracts re-tuned to the new shell; layout audits port verbatim. |
| 29,182-LOC demo fixture monolith (`command/data.ts`, `market-data.json`) | **ADAPT** | Moves out of the bundle into the fixture-mode data layer (3.6) keyed by provenance (audit F-17/F-10). |
| Polling-only live state (no SSE/WS) | **ADAPT** | Keep short-poll pattern against Jobs run-state initially (parity of UX); platform push is a post-cutover option. |
| `.ds-shims/` design-sync harness | **DISCARD** | Next-specific; its inventory of the actually-used `next/*` surface guides the port, then retires. |

---

## Table B — All 36 `DEPLOY_B_COWORK_SKILLS` entries

**Owner instruction, as resolved (Q-001R, 2026-07-28):** *"Exclude modules with
similar functions within legacy application — only cp-snap and cp-model; legacy
Model Builder and Report Builder serve the same function."* So exactly **two** corpus
entries are excluded for function duplication (rows 33–34, DROP). Every other entry
is carried: its **contract** (payload schema, envelope fields, gates, filename rule)
is extracted into `dbx/contracts/`, and — per Q-007R, *"deploy B wins"* — its
`MODULE_RUNBOOK.md` is the **normative methodology source** for the module's LLM
synthesis lane (D-LEG-011), while deterministic numeric behaviour stays
golden-master parity-gated (9.1).

Verdict legend:
- **CONTRACT+LEGACY** — contract extracted; deterministic runtime = ported legacy engine component (parity-gated 9.1); LLM-lane methodology from the DEPLOY_B runbook (D-LEG-011).
- **CONTRACT+NEW** — contract extracted; no legacy equivalent — new engine module built to the corpus runbook (LLM lane via gateway; deterministic parts pure).
- **DROP** — not carried into the product runtime.

Legacy equivalence is resolved per the corpus alias register
(`skills/rbot-orchestrator/references/MODULE_ID_ALIASES.md`) — by legacy ID **plus**
module name / `owned_object`, never ID-only.

| # | Corpus entry (canonical ID) | Function | Legacy equivalent (legacy ID → file) | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | `cp-parse-data-preparation` (CP-PARSE) | Pack triage, adaptive parse, ZIP batching | CP-00 → `ingest.py` + intake gates + OCR lane | **CONTRACT+LEGACY** | `document_parse_manifest` payload + `PASS_THROUGH` semantics bind the ingestion Workflows job. |
| 2 | `cp-0-source-readiness` (CP-0) | Source inventory, authority/usability gate | CP-0A → `engine/readiness.py` | **CONTRACT+LEGACY** | `source_readiness_register`; Blocked here halts pathway (test B5 semantics). |
| 3 | `cp-x-planner-router` (CP-X) | Route plan, dependency validation — no execution | CP-0B → `engine/planner.py` + `registry.py` | **CONTRACT+LEGACY** | `route_plan` payload persisted as "show your work" (legacy `_persist_cpx` pattern). |
| 4 | `cp-1-canonical-data-foundation` (CP-1) | Canonical financials, calc registers, perimeters, definition conflicts | CP-1 → `edgar_cp1.py`/`reported_cp1.py`/`adjusted.py` | **CONTRACT+LEGACY** | Canon rules 4–7, 9 become typed payload fields (null≠zero, conflict rows, subsequent-event flags, perimeter split — EC-15/16/17). |
| 5 | `cp-1a-business-transaction-fact-pack` (CP-1A) | Transaction/ownership/cap-structure facts | CP-1A → `engine/factpack.py` | **CONTRACT+LEGACY** | |
| 6 | `cp-1b-earnings-delta` (CP-1B) | Period-on-period deltas off CP-1 values | CP-1B → `engine/earnings.py` | **CONTRACT+LEGACY** | Period-ordering kernel dependency (EC-04). |
| 7 | `cp-1c-peer-benchmark` (CP-1C) | Peer set + aligned-definition benchmarking | CP-1C → `engine/peers.py` | **CONTRACT+LEGACY** | |
| 8 | `cp-2-fundamental-credit-synthesizer` (CP-2) | Fundamental credit view synthesis | CP-2 → `engine/coststructure.py` + synth lane | **CONTRACT+LEGACY** | |
| 9 | `cp-2a-downside-pathway` (CP-2A) | Causal downside pathways, breakpoints | **CP-2B** → `engine/downside.py` | **CONTRACT+LEGACY** | ID skew case — parity maps by `owned_object=downside_pathway`. |
| 10 | `cp-2b-event-catalyst-register` (CP-2B) | Dated events/catalysts + monitoring windows | **CP-2C** → `engine/catalysts.py` | **CONTRACT+LEGACY** | |
| 11 | `cp-2c-governance-sponsor-score` (CP-2C) | Governance/sponsor/creditor-alignment score | **CP-2D** → `engine/sponsor.py` | **CONTRACT+LEGACY** | |
| 12 | `cp-2d-liquidity-cash-flow-bridge` (CP-2D) | Liquidity sources/uses, runway | **CP-2E** → `engine/liquidity.py` | **CONTRACT+LEGACY** | |
| 13 | `cp-2e-macro-fx-hedging-sensitivity` (CP-2E) | Macro/FX/rates/commodity sensitivity | **CP-2F** → `engine/macro.py` | **CONTRACT+LEGACY** | |
| 14 | `cp-2f-esg-sustainability-credit-risk` (CP-2F) | ESG → credit mechanisms | **CP-2G** → prompt bundle (feature-flagged off) | **CONTRACT+LEGACY** | Ports flagged-off; corpus runbook refreshes the prompt at a logged `prompt_version` bump. |
| 15 | `cp-2g-forward-credit-model` (CP-2G) | Auditable base/upside/downside forecasts | Model Engine v2 (`model_engine_v2.py`) — similar function | **CONTRACT+LEGACY** | Owner-instruction case: MEv2 becomes the CP-2G implementation emitting a CP-2G payload; no parallel skill. |
| 16 | `cp-2h-ratings-migration-trigger` (CP-2H) | Agency ratings, trigger headroom, migration pressure | none (legacy CP-2R unassigned) | **CONTRACT+NEW** | Phase 6; needs sourced agency evidence; never a shadow rating. |
| 17 | `cp-3-relative-value-security-selection` (CP-3) | Priced-instrument RV & selection | CP-3 → `engine/relval.py` | **CONTRACT+LEGACY** | |
| 18 | `cp-3a-recovery-instrument-preference` (CP-3A) | Waterfall, collateral, recovery ranking | **CP-3B** → `engine/capstructure.py` | **CONTRACT+LEGACY** | Waterfall edge cases EC-09/EC-10; consumes CP-4B map by reference (fixes corpus-order defect F-16 via DAG). |
| 19 | `cp-3b-portfolio-fit-position-sizing` (CP-3B) | Portfolio fit, concentration, sizing | **CP-3C** → `engine/portfoliofit.py` + `portfolio.py` | **CONTRACT+LEGACY** | |
| 20 | `cp-3c-refinancing-lme-risk` (CP-3C) | Maturity walls, LME, coercion pathways | **CP-3D** → `engine/refinancing.py` | **CONTRACT+LEGACY** | |
| 21 | `cp-3d-market-implied-credit-technicals` (CP-3D) | Timestamped pricing, curves, market-implied risk | none in engine (legacy CP-3E unassigned; market surfaces/data exist) | **CONTRACT+NEW** | Phase 6; consumes `market_snapshots`/`market_instruments` silver data. |
| 22 | `cp-4-legal-covenant-interpreter` (CP-4) | Provision-level covenant construction | CP-4 → `engine/legal.py` | **CONTRACT+LEGACY** | |
| 23 | `cp-4a-covenant-capacity-calculator` (CP-4A) | Numeric covenant capacity/headroom | **CP-4C** → `engine/covenants.py` | **CONTRACT+LEGACY** | Canon rule 9: absent inputs = `Not Calculable`, never inferred (EC-12). |
| 24 | `cp-4b-restricted-group-guarantee-map` (CP-4B) | Legal-entity claim graph, structural subordination | **CP-4D** → `specialized_modules.py` (feature-flagged) | **CONTRACT+LEGACY** | Corpus contract fills the spec-rich/implementation-thin gap (EC-15); DAG places it before CP-4A/CP-4C consumers. |
| 25 | `cp-4c-restructuring-fulcrum` (CP-4C) | Restructuring paths, fulcrum, class recoveries | none (legacy CP-4E unassigned) | **CONTRACT+NEW** | Phase 6; hard distress gate — `Not Applicable` without it. |
| 26 | `cp-5-evidence-trace-validator` (CP-5) | Claim→source lineage validation | **CP-5B** → `engine/lineage.py` | **CONTRACT+LEGACY** | |
| 27 | `cp-5a-research-integrity-qa` (CP-5A) | Final severity gate; sets `qa_status`; blocks committee use | **CP-5** → `engine/gate.py` (+ CP-5C council as optional finding producer) | **CONTRACT+LEGACY** | **The 8.3 asset.** Severity ladders already agree (CRITICAL/MATERIAL/MINOR). Corpus's extended vocabularies (23 defect categories, 9 clearance impacts, CP5-NNN ids, 11 sections/9 tables) extracted as contract enums for the *artifact*; gate logic itself ports unchanged for parity. |
| 28 | `cp-6-ic-debate-challenge` (CP-6) | Adversarial IC debate, action bias | **CP-6A** → `engine/debate.py` | **CONTRACT+LEGACY** | |
| 29 | `cp-6a-portfolio-debate-challenge` (CP-6A) | Portfolio posture challenge | **CP-6E** → `engine/debate.py` + `portfolio.py` | **CONTRACT+LEGACY** | |
| 30 | `cp-8-decision-ledger-post-mortem` (CP-8) | Decision rationale/dissent/outcome ledger | CP-7 alias → IC Book (`routes/decisions.py`, `routes/committee.py`, thesis/votes tables) — similar function | **CONTRACT+LEGACY** | Owner-instruction case: ledger stays the IC Book feature; CP-8 payload contract binds its export; post-mortem fields added to the IC Book schema (no separate skill). |
| 31 | `cp-dr-deep-research` (CP-DR) | Scoped research dossier: approved plan, iterative evidence, citations | `deepresearch.py` + research executors + Research surface — similar function | **CONTRACT+LEGACY** | Legacy lane adapted to the CP-DR envelope profile (scope_type/scope_key/plan-hash/coverage/stop-reason — enforced by `validate_handoff.py`); supersedes legacy CP-SR generation (Sector Review surface consumes CP-DR dossiers). |
| 32 | `cp-email-credit-intelligence-classifier` (CP-EMAIL) | Display-only intelligence digest over accessible mail/public sources | **none** — audit §8.4.1: no mail-sync code exists (CP-MON spec-only, retired) | **DROP** | **Owner decision Q-005R ("remove cp-email"):** no email-intelligence lane is built at all (D-LEG-006). The `ModuleId` enum keeps the value (corpus schema fidelity); the registry entry is permanently `implemented=False`. C3 watch-rules remain the alerting lane. |
| 33 | `cp-model-historical-credit-model-workbook` (CP-MODEL) | Terminal XLSX exporter from CP-1/CP-1B | `model_workbook.py` — same function (no CP-MODEL id in legacy) | **DROP** | **Owner decision Q-001R:** excluded for function duplication — the ported legacy Model Builder exporter (`CAOS_MODEL_WORKBOOK_V1`, hash-verified, identity-bound) serves this function under its own contract. Corpus workbook schemas stay in `corpus/` as reference only. |
| 34 | `cp-snap-qualitative-credit-snapshot-workbook` (CP-SNAP) | Terminal qualitative snapshot XLSX from CP-1A/1B/2/2B | `report_exports.py` + Report Studio — same function | **DROP** | **Owner decision Q-001R:** excluded for function duplication — Report Builder/Report Studio's frozen-payload exports serve the snapshot function. |
| 35 | `rbot-orchestrator` | Multi-module pathway planning/gating; stop-on-Blocked; limitation propagation; committee assurance | `engine/runner.py` + executors — similar function | **CONTRACT+LEGACY** | Orchestration semantics become typed contracts executed by Workflows (ARCHITECTURE §6): 8 pathways, `ROUTE_GRAPH` edges, Upstream Re-Anchor Gate, stop-on-Blocked, limitation propagation; Committee Assurance Mode maps to `approval_state` gates (8.1) + `validate_handoff.py` in CI. |
| 36 | `ai-assurance-auditor` (AI-AUDIT) | Audit/risk-tier M365 Copilot prompts/skills/agents | none — and out of platform scope (M365-Copilot-specific) | **DROP** | Not part of the CAOS product runtime on Databricks. Its rubric (tiering, E1–E4 evidence caps, nine-dimension scorecard, `Pending Human Decision`) is retained in `corpus/` as reference input to the Section-1 governance track (which is out of this spec's scope). |

**Cross-cutting notes for Table B**

1. **Prompt provenance (Q-007R: "deploy B wins" — D-LEG-011).** LLM-lane synthesis
   methodology and prompts source from each module's DEPLOY_B `MODULE_RUNBOOK.md`,
   stamped via `prompt_version` on every run (3.7). Deterministic numeric lanes
   remain golden-master parity-gated (9.1); narrative outputs may differ from legacy
   narratives by design.
2. **Envelope everywhere.** Every artifact-producing module (both carried verdicts)
   emits the canonical Markdown envelope (15 YAML fields, six H2s, filename rule)
   validated by the ported `validate_handoff.py` logic — Phase 1 contract, regardless
   of runtime disposition.
3. **The three CONTRACT+NEW modules** (CP-2H, CP-3D, CP-4C) are the only net-new
   analytical builds; all are Phase 6, after parity is locked, so they can never be
   confused with parity regressions.
