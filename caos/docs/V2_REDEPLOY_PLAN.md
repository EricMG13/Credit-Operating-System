# CAOS v2 Redeploy & Redesign Plan — "Modular OS" Prompt Corpus

> **Source of truth reviewed:** `~/Documents/Modular OS` (v2.0, dated 2026-06-08) —
> 26 module folders + `KNOWLEDGE SOURCES/` governance layer, 434 files.
> **Target:** the implemented system in `caos/` (FastAPI backend + Next.js cockpit).
> **This document:** what changed, the gap vs. our build, a phased redeploy plan, and
> the faults/headwinds that must be resolved before (or during) implementation.

---

## 1. What v2 is (architecture in one screen)

v2 reorganises the previously-flat prompt files into a **governed modular OS**:

- **Per-module folders.** Each module = `CP-<ID>_ACTIVE_PROMPT.md` (the agent system prompt) + numbered `REF_CP-<ID>_*` decomposition files (one concern each) + `SCHEMA_REFERENCE.md` + `SYSTEM_REFERENCE.md`.
- **Shared governance layer** (`KNOWLEDGE SOURCES/`): `00_GOVERNANCE` (preamble, core system prompt, global instructions, source/QA/reasoning/render policies, limitation taxonomy), `01_TAXONOMY` (credit-implication, decision, evidence, status enums), `02_SCHEMA` (canonical envelopes + 22 per-module payload schemas under `MODULE_PAYLOADS/`), `03_ORCHESTRATION` (CP-X route graph/logic, orchestrator spec, routing index), `04_KNOWLEDGE` (calculation rulebook, evidence-trace guide, citation discipline, table standards), `05_QA` (system QA gates).
- **24 modules across L0–L7 + 3 infrastructure services:**
  - L0 `CP-0` SourceReadiness → **CP-X** PlannerRouter (orchestration).
  - L1 `CP-1/1A/1B/1C`; L2 `CP-2` + `CP-2B/2C/2D/2E/2F`; L3 `CP-3` + `CP-3B/3C/3D`; L4 `CP-4/4C`; L5 `CP-5B`→`CP-5`; L6 `CP-6A`→`CP-6E` (terminal).
  - **L7 (new):** `CP-SR` SectorReview, `CP-MON` CreditPulse (continuous monitoring). Bidirectional CP-SR↔CP-MON loop — the *only* sanctioned non-forward edge.
  - **Infra:** `CP-RENDER` (renders reports, no fabrication), `CP-EXTRACT` (sole parser of `.docx` JSON appendices → JSONL), `CP-DB` (stores from CP-EXTRACT only).
- **New cross-cutting layer:** `REF_CP-EMAIL_SourceRoutingMatrix.md` — email-derived intelligence routing (8 categories × 4 use-types Evidence/Context/Trigger/Routing-Signal, source tiers 1.5–3.0, staleness rules, per-module guardrails). Copied into every module folder.
- **Export contract (critical).** Every module emits a **single `.docx`** with human-readable sections + **Appendices A–E** carrying JSON blocks (`CP_MODULE_HANDOFF_JSON`, `CP_EVIDENCE_TRACE_JSON` + `CP_SOURCE_REGISTRY_JSON`, `CP_QA_VALIDATION_JSON`, `CP_EXPORT_MANIFEST_JSON`, `CP_GAPS_CONFLICTS_DOWNSTREAM_JSON`). CP-EXTRACT is the only authorised parser. This is a **document-centric** runtime designed for **Microsoft 365 Copilot**.
- **Canonical payload envelope** (`CP_MODULE_PAYLOAD_BASE.schema`): `module_id, module_name, owned_object, schema_family, runtime_output, evidence_trace, confidence{High|Medium|Low|Insufficient Information}, limitation_flags[], qa_status{Not Reviewed|Passed|Restricted|Blocked}, validation_warnings[], downstream_consumers[]`.
- **Governance primitives:** one-owner-per-object (CP-X enforces via `CP_ROUTING_INDEX`), limitation propagation, 8-lane QA (CP-5), render-time enum validation (`ic_action_bias`=8, `portfolio_posture`=6, `binding_constraint`=9+None, `credit_implication`=13 → invalid = VE-010).

---

## 2. Gap vs. what we built in `caos/`

| v2 element | In `caos/` today | Gap |
|---|---|---|
| 24 analytical modules | **11** implemented (CP-0,1,1A,1B,2,3,4,4C,5,5B,6E) | **13 missing**: CP-1C, 2B, 2C, 2D, 2E, 2F, 3B, 3C, 3D, 6A + **CP-SR, CP-MON** |
| Infra CP-RENDER / CP-EXTRACT / CP-DB | none (agents return JSON dicts; `AgentOutput` rows in Postgres) | Whole export/extract/DB boundary absent |
| Canonical payload envelope | `schemas/agent_outputs.py` (different shape) | Re-base onto `CP_MODULE_PAYLOAD_BASE` |
| One-owner-per-object + `CP_ROUTING_INDEX` | DAG is hand-wired in `agents/orchestration/dag.py` | No ownership registry / VE-009 enforcement |
| 8-lane QA + severity gates | `core/severity_engine.py` (2 universal rules) | Expand to 8 lanes; CP-5B trace + CP-5 gate |
| Render-time enum validation (VE-010) | none | Add at render boundary |
| Email intelligence layer (REF_CP-EMAIL) | MS Graph **file** webhook only (`ingestion/ms_graph.py`) | Extend to email ingest + classification + routing |
| CP-MON monitoring loop | none | New scheduled/event-driven service |
| CP-SR sector review | none | New flow + 7-section output |
| `.docx` + Appendix A–E export | none | New (see Decision D1) |
| Evidence Trace (Evidence→Risk Mechanic→Credit Implication) | **built** in cockpit (matches `CP_EVIDENCE_TRACE.schema`) | Reusable as-is |
| MS Graph webhook + JWT + RAG + DAG runner | built | Reusable backbone |

**Bottom line:** the v2 prompt corpus roughly **doubles the module count**, adds a **document-export runtime**, an **email-intelligence plane**, and a **continuous-monitoring service**. The `caos/` backbone (FastAPI, Postgres, MinIO, LangGraph DAG, MS Graph, the Evidence-Trace cockpit) is reusable; the agent mesh, schemas, and infra services need substantial expansion.

---

## 3. Key design decisions (resolve these first)

**D1 — Document-centric vs. JSON-native runtime.** v2 is written for M365 Copilot: modules produce `.docx`, CP-EXTRACT re-parses appendices. Our backend is JSON-native (agents already emit structured JSON). **Recommendation:** keep the runtime **JSON-native internally** (LLM emits the payload envelope as JSON, validated against JSON Schema), and treat `.docx`+appendices as a **render/delivery format generated from the JSON**, not the interchange format. This preserves the v2 contract for Copilot users while avoiding a lossy "emit docx → re-parse docx" round-trip server-side. CP-EXTRACT becomes the *Copilot-path* adapter; the API path skips it.

**D2 — Schema as single source of truth.** Execute the corpus's own `CP_JSON_SCHEMA_MIGRATION_GUIDE` (Phase 1 dual-format → Phase 2 JSON-as-source). Generate Pydantic models from the JSON Schemas (`datamodel-code-generator`) so `schemas/agent_outputs.py` is *derived*, not hand-maintained.

**D3 — Ownership registry drives the DAG.** Replace the hand-wired graph in `dag.py` with a data-driven DAG built from `CP_ROUTING_INDEX`/`CP-X_ROUTE_GRAPH` (nodes, edges, `owned_object`, gates). CP-X becomes a real planner that emits a `route_plan` the runner executes — not Python edges.

**D4 — Email plane is an extension of the existing MS Graph integration.** `ingestion/ms_graph.py` already does Graph auth + webhooks for files; extend it to mailbox messages, classify per `REF_CP-SR_G` (8 categories), and attach the `REF_CP-EMAIL` routing metadata. This is the lowest-friction high-value add.

**D5 — CP-MON is a service, not a DAG node.** It runs continuously (schedule + event-triggered), writes signals, and *triggers* CP-X. Maps cleanly to Redis + background workers/cron already present in the stack.

---

## 4. Phased implementation plan

### P0 — Governance & schema foundation (unblocks everything) — 🟡 STARTED 2026-06-08
Scaffolded in `backend/governance/` (all verified):
- ✅ `enums.py` — canonical + taxonomy enums ported from `01_TAXONOMY` / `00_GOVERNANCE` (incl. the render-validated enums: credit_implication=13, ic_action_bias=8, portfolio_posture=6).
- ✅ `payload_base.py` (Pydantic v2) + `schemas/CP_MODULE_PAYLOAD_BASE.schema.json` (Draft 2020-12, Migration Guide Phase 1) — canonical envelope with the F1-corrected `module_id` pattern.
- ✅ `module_registry.json` + `registry.py` — the registry-driven DAG (D3) encoding all 27 modules, typed edges (analytical/enrichment/trigger/loop), `owned_object` ownership, and execution order, with governance validators (VE-009 one-owner-per-object, acyclic analytical subgraph, order consistency, sanctioned-cycle allowlist).
- ✅ `tests/backend/test_module_registry.py` — 7 governance tests, green; derived execution order matches `MODULE_EXECUTION_ORDER_v2` exactly.

Remaining P0:
- Generate Pydantic models from the JSON Schemas (`datamodel-code-generator`) for the 24 per-module payloads; replace `schemas/agent_outputs.py` (Migration Guide Phase 2).
- Port `binding_constraint` (9 values + None) from the CP-6E refs to complete the render-enum set.
- Bulk-convert the remaining `02_SCHEMA/*` + `MODULE_PAYLOADS/*` `.txt` schemas to JSON Schema.

### P1 — Module mesh expansion (the missing agents) — 🟢 NEARLY DONE 2026-06-08 (10/12; all L0–L6 covered)
- ✅ **All 22 L0–L6 modules now have agents** (10 new on the canonical envelope: CP-1C, CP-2B, CP-2C, CP-2D, CP-2E, CP-2F, CP-3B, CP-3C, CP-3D, CP-6A; the 12 pre-existing remain on the legacy schema pending migration). Prompts load from the corpus via `governance/prompts.py`; typed payloads in `governance/payloads.py`; per-module JSON schemas in `governance/schemas/`.
- ✅ **Gates encoded in agents**: CP-2B conditional hard-stop (CP-1 ∧ CP-2 absent → Blocked); CP-3B input gate 1 (no CP-3 RV) + gate 2 (no seniority/subordination) → Blocked.
- ✅ `agents/registry_dispatch.py` — registry-driven dispatch (CP-X routing target). `test_agent_coverage.py` (6 tests) asserts implemented ∪ pending = all non-infra modules; PENDING is now **only CP-SR, CP-MON** (L7).
- Remaining: **CP-SR, CP-MON** (L7 services, P3); migrate the 12 legacy-schema agents onto the envelope.

### D3 — Registry-driven planner + runner (CP-X backbone) — ✅ IMPLEMENTED 2026-06-08
- **Planner** `agents/orchestration/registry_planner.py::build_route_plan` deterministically produces the route_plan from the registry: dependency-ordered `execution_sequence`, per-module Full Run / Ready with Limitations / Blocked, **longest-path parallel groups**, forward limitation propagation, and counts. Faithful CP-X semantics: **Blocked** only when a module's own sources aren't cleared; a missing/limited upstream **degrades downstream to "Ready with Limitations"** (module-specific hard-stops live in the agents). `test_registry_planner.py` — 7 tests.
- **Runner** `agents/orchestration/registry_runner.py::execute_plan` consumes the route_plan and executes level-by-level: each parallel group runs concurrently (`asyncio.gather`), **upstream outputs are threaded** to each agent, Blocked modules are skipped, failures are contained. `default_invoke` resolves the agent (`registry_dispatch`) + binds upstream/context kwargs; `run_pipeline` is the issuer-pipeline entry. The orchestration core is dependency-injected, so `test_registry_runner.py` (5 tests) proves it end-to-end with a fake invoke — every runnable module invoked once, every analytical edge's output threaded to its consumer (incl. CP-6A's many feeds), blocked modules excluded with descendants degrading. **This replaces the hand-wired graph in `dag.py`.**
- Migrate the 12 existing legacy-schema agents (CP-0…CP-6E) onto the canonical envelope.
- Rebuild `dag.py` from the registry (D3); add the explicit gates/hard-stops (CP-2B conditional stop, CP-3B input gates 1&2, CP-5 severity gate).

> **Drift caught & fixed during this slice** (the governance layer earning its keep): registry `owned_object`s realigned to the corpus `const` values (e.g. CP-0 `source_readiness_register`, CP-4C `covenant_capacity_calculation`, CP-5 `qa_result`, CP-2E `liquidity_cash_flow_bridge`); and the `CP-COMMON_PREAMBLE` CP-1 feeds corrected to drop CP-6A per Audit M-6 (CP-6A receives CP-1 only indirectly via CP-2).

### P2 — Export / Extract / DB boundary + QA — 🟢 DONE 2026-06-08
- ✅ **VE taxonomy + render validation** `governance/validation.py` — the 20 VE codes + severities; `validate_render_enums` enforces **VE-010** for `ic_action_bias`/`portfolio_posture`/`credit_implication` (binding_constraint pending CP-6E port).
- ✅ **8-lane CP-5 QA engine** `governance/qa_engine.py` — Schema / Cross-Module / Enum / Evidence-Trace lanes checked deterministically; the four LLM-judgment lanes accept agent-supplied findings; **severity gate** (CRITICAL→Blocked, MATERIAL→Restricted, else Passed) → `CP_QA_RESULT` with `qa_status` + `committee_status`. **CP-5B** `validate_lineage` flags orphan claims (VE-015) / weak lineage (VE-016).
- ✅ **Render/extract boundary** `governance/export.py` — assembles the **6 canonical appendix blocks**, validates the export manifest (all blocks present, `separate_artifacts` empty → VE-005), and **CP-EXTRACT** produces extraction envelopes (syntax-normalise only; sole input to CP-DB).
- ✅ **X7 cycle guard** `governance/loop_guard.py` — bounds the CP-SR↔CP-MON loop (MAX_ROUND_TRIPS=2, HARD_TIMEOUT=3, convergence <5%, termination reasons). **Closes F8.**
- ✅ **QA gate wired into the runner** — `execute_plan(..., qa=run_qa)` withholds a Blocked module's output from downstream (consumers degrade). `test_qa_export.py` (14) + the runner QA test prove it.
- Remaining: the `.docx` serialization adapter (needs `python-docx`) and CP-DB persistence wiring.

### P3 — Email intelligence + L7 (CP-MON, CP-SR) — 🟢 DONE 2026-06-08
- ✅ **Email routing layer** `governance/email_routing.py` — the 8 categories (tiers + staleness), the §5 standard routing-signal table (re-pointed to v2 modules), the §7 evidence guardrails (QA/legal/liquidity modules barred from email-as-evidence), a deterministic `classify_email`, and `allowed_uses`/`route_event`/`is_stale`. `test_email_routing.py` (9 tests) green — verifies the F2 fix operationally (CP-3 RV takes rating-action evidence; CP-5/5B/4/4C/2E never do).
- ✅ **CP-MON** (`agents/l7_sector_monitoring/cp_mon_credit_pulse.py`) + `Signal`/`AlertNotification` payloads + `AlertTier.from_score` bands. Includes `prepare_email_signals` (classify+annotate pre-pass). Downstream pinned to the F5 contract (CP-X, CP-SR, CP-1, CP-3D).
- ✅ **CP-SR** (`cp_sr_sector_review.py`) — 7-section output, 6 dimension scores, early-warning dashboard, 6-value `SectorCreditPosture`; consumes email + CP-MON alerts (CP-SR↔CP-MON loop).
- ✅ **Mailbox ingestion** in `ingestion/ms_graph.py` (`fetch_mailbox_messages` app-only `/users/{id}` path per F8, `ingest_email_intelligence` classifies via the email layer).
- ✅ **All 24 analytical+L7 modules now have agents** — `registry_dispatch.PENDING` is empty.
- Remaining for L7: `IssuerRegistry`/`WatchlistConfig` persistence + the actual CP-MON scheduler/service loop (the continuous, event-triggered runner).

### P4 — Frontend (extend the cockpit we already shipped)
- The Evidence-Trace panel + narrative + selection store already match `CP_EVIDENCE_TRACE.schema` — reuse directly for the new modules' material conclusions.
- Add **Sector** view (CP-SR 7-section + early-warning dashboard) and a **Monitoring** view (CP-MON watchlist heatmap, alert feed, rating-action log) — these map to the existing L0–L6 mesh + new L7.
- Surface `qa_status` (Blocked/Restricted/Passed) and `limitation_flags` per module in the cockpit (governance visibility).

### P5 — Validation & cutover
- Golden-file tests: run a known issuer through the full DAG; assert payloads validate against JSON Schema and appendices round-trip through CP-EXTRACT.
- Enum-conformance unit tests (the 4 render enums). Extend the Playwright/Vitest harness already in place.

---

## 5. Faults & headwinds (found during review — address before build)

**F1 — `module_id` regex rejects the two new modules (concrete bug). ✅ FIXED 2026-06-08.** `CP_MODULE_PAYLOAD_BASE.schema` pattern updated to `^CP-(0|[1-6][A-F]?|X|SR|MON|DB|RENDER|EXTRACT)$`; added `CP-SR__SectorReview__payload.schema.txt` and `CP-MON__CreditPulse__payload.schema.txt` to `02_SCHEMA/MODULE_PAYLOADS/` so the L7 modules are in the canonical registry.

**F2 — Two conflicting module taxonomies coexist (highest-risk). ✅ RESOLVED 2026-06-08 (owner ratified v2 Canonical).** All 24 `REF_CP-EMAIL_SourceRoutingMatrix.md` copies rewritten to v2.0 — every §4 section header + per-module rules + §5/§7/§10 re-pointed to the correct v2 module (CP-3 = RelativeValue, CP-3C = Sizing, CP-2E = Liquidity, CP-5 = QA, CP-5B = EvidenceTrace; added a liquidity routing signal). `CP-COMMON_PREAMBLE.md` module_manifest re-synced (v3.3) to v2 module_names with L7 + infra rows and `Feeds:TBD` resolved. Corpus scan confirms no residual legacy module identities. See `README/TAXONOMY_RECONCILIATION.md`.

**F3 — Unresolved renames (the corpus's own audit L-1). ✅ FIXED 2026-06-08.** `CP-SR_SectorReview_ActivePrompt.md → CP-SR_ACTIVE_PROMPT.md` and the CP-MON equivalent renamed; all 24 modules now follow `CP-<ID>_ACTIVE_PROMPT.md`. `CP_RENAME_MANIFEST` marked COMPLETED.

**F4 — Version drift in references.** `CP_RENAME_MANIFEST` and the modules reference cite `CP_ONBOARDING_DOCUMENTATION_v3.txt`, but the file present is `_v2.txt`. The common preamble manifest also lists `Feeds: TBD` for CP-2, CP-2D, CP-3, CP-4, CP-5, CP-6A (incomplete) and an L0–L6-only manifest (no L7). Treat cross-references as not-yet-consistent; build the DAG from `CP_ROUTING_INDEX`/route map, not the preamble manifest.

**F5 — CP-MON dependency declarations disagree. ✅ RESOLVED 2026-06-08.** Pinned the route-map edges as canonical `downstream_consumers` = CP-X, CP-SR, CP-1, CP-3D; reframed the broader CP-1B/2B/3/4/6A targets as *content-typed handoff packets routed via CP-X* (not direct orchestration edges); removed the backward `writes CP-0` edge (CP-MON maintains its own issuer/watchlist registry). Aligned across `CP-MON_ACTIVE_PROMPT`, `REF_CP-MON_J_ModuleHandoff`, and the CP-MON payload schema. The registry (`backend/governance/module_registry.json`) encodes only the sanctioned CP-SR↔CP-MON loop + CP-MON trigger edges, verified acyclic by the governance test.

**F6 — Document-centric runtime vs. service architecture (design tension).** The export contract and CP-EXTRACT/CP-RENDER boundary are written for an M365-Copilot, `.docx`-passing world. A server deployment that emits `.docx` only to immediately re-parse it (CP-EXTRACT) is lossy and slow. Resolve via D1 (JSON-native internally, `.docx` as render/delivery, CP-EXTRACT as Copilot-path adapter) — otherwise the architecture fights itself.

**F7 — Scale & cost.** A full new-credit run now fans out across ~22 LLM modules with CP-6A converging on **11 upstream feeds** and CP-2 on 4. Sequential LLM latency/cost is significant; the DAG must exploit the declared parallel sets (L1 base, L2 submodules, L3 branches) and cache upstream artifacts aggressively. The current `dag.py` already parallelises L1/L3 — extend that discipline.

**F8 — Bidirectional CP-SR↔CP-MON loop. ✅ RESOLVED 2026-06-08.** The corpus actually specifies bounds in QA gate X7 (MAX_ROUND_TRIPS=2, HARD_TIMEOUT=3, convergence <5%, 5 termination reasons); implemented in `governance/loop_guard.py::evaluate_cycle` with tests. The registry already encodes CP-SR↔CP-MON as the sole sanctioned cycle.

**F9 — Carry-over from the prior review (still open in `caos/`).** Per-issuer authorization is "shared desk" (acceptable) but document endpoints/anchors for true Evidence-Sync (F2/F6 of the cockpit blueprint) and the `pdfjs-dist` peer-dep are still open. The email plane and CP-MON will add MNPI-bearing content — revisit access control before exposing monitoring feeds.

---

## 6. Recommended sequencing (pragmatic)

1. **Reconcile taxonomy (F2) + fix schema regex/renames (F1, F3).** Cheap, unblocks correctness. *Owner decision required — which taxonomy is canonical?*
2. **P0 schema foundation** → generate Pydantic models; lock the envelope.
3. **P1 fill the 13 agents** behind a registry-driven DAG (start CP-1C, CP-2E, CP-2B, CP-3D — they unblock CP-6A).
4. **P3 email plane + CP-MON** (high real-time value; reuses MS Graph) in parallel with P1 once schemas are stable.
5. **P2 render/extract/DB + 8-lane QA**, then **P4 frontend** Sector/Monitoring views, then **P5 cutover**.

**Quick wins (days, not weeks):** fix F1/F3; reconcile F2; port the governance/taxonomy library (P0a); implement CP-1C and CP-2E (small, high-leverage). **Long poles:** the document-export boundary (D1/F6), CP-MON continuous service (F5/F8), and the full 24-node registry-driven DAG.
