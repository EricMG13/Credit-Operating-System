# DEVIATIONS.md — Intentional Divergence Log

Single log of every **intentional** divergence in the Databricks rebuild from
(a) legacy CAOS behaviour (the golden master, checklist 9.1) or
(b) the checklist's Databricks-column mapping.

Rules of use:

1. **Legacy engine behaviour is the golden master.** Field-by-field numeric parity on
   the frozen corpus is the default; any behavioural difference that is *intended* gets
   a row here **before** the change lands. An unlogged parity break is a bug, full stop.
2. The implementation model MUST NOT invent deviations. If a spec forces a divergence
   that is not logged here, STOP and raise it in `OPEN-QUESTIONS.md` for review.
3. Every row cites the artifact that authorises it (spec section, checklist ID, or
   review sign-off) and the test that proves the new intended behaviour.
4. Migration-class decisions (checklist 9.5: migrate / current-only / re-derive / drop)
   that change what data survives cutover are also deviations — log them here.

Status values: `proposed` (awaiting review) · `approved` (may be implemented) ·
`implemented` (tests cite it) · `rejected`.

---

## D-LEG — Divergences from legacy CAOS behaviour

| ID | Area | Legacy behaviour | Rebuild behaviour | Rationale | Authorised by | Test / evidence | Status |
|----|------|------------------|-------------------|-----------|---------------|-----------------|--------|
| D-LEG-001 | Frontend framework | Next.js 16 app (app router) serving the workbench | React + Vite SPA, static build served by the FastAPI Databricks App | Checklist 6.1 fixes the Databricks Apps reference pattern (React/TypeScript/Vite/FastAPI); Next.js server runtime is unsupported plumbing on Apps. Design language, nav model, and a11y behaviour are preserved (9.3); only the delivery framework changes. | Checklist 6.1; ARCHITECTURE.md §3.5 | Frontend CI a11y + surface smoke tests (Phase 5) | approved |
| D-LEG-002 | Background execution | Four hand-rolled DB-polling executors + poller loop inside the API container | Databricks Workflows/Jobs run the CP-X DAG, intake, email-landing, and monitoring lanes; no in-process pollers | Checklist 6.3 (single governed job runtime). Execution *semantics* (stop-on-Blocked, retries, event log) are preserved as explicit orchestration contracts; only the runtime changes. | Checklist 6.3; ARCHITECTURE.md §4 | Orchestration integration tests (Phase 3) | approved |
| D-LEG-003 | Auth edge | Caddy → oauth2-proxy (Google Workspace OIDC) → FastAPI | Databricks Apps workspace SSO (enterprise IdP + SCIM); app-side chokepoint retained as defence-in-depth | Checklist 2.1 (P1 blocker): the custom auth edge is deleted, not re-implemented. Session/roles semantics preserved via workspace identity → role mapping. | Checklist 2.1, 2.2, 2.5 | App auth integration tests (Phase 2) | approved |
| D-LEG-004 | Model access | Direct `ANTHROPIC_/OPENROUTER_/GEMINI_API_KEY` clients per lane | All calls via Mosaic AI Gateway / Model Serving external-model endpoints through the existing provider seam; no vendor SDKs in the codebase | Checklist 3.1/3.2 (P1 blocker). Seam interface, tier→model map, fixture mode, `Run.model_id`+`prompt_version` fingerprint preserved. | Checklist 3.1, 3.2, 3.7 | Gateway seam contract tests (Phase 2) | approved |
| D-LEG-005 | Backups / export | `rclone` off-host backup service; Obsidian vault export | Governed storage only: Lakebase managed backups + Delta; no off-host sync, no personal-vault export path in the codebase | Checklist 4.3 (P1 blocker). The *capability* (durable backup, restore drill) is preserved via 6.6. | Checklist 4.3, 6.6 | Restore drill runbook + rehearsal (Phase 7) | approved |
| D-LEG-006 | Mail ingestion | **None** — audit found no live M365 Graph sync in code (corpus-methodology + outbound-send spec only; `audit/AUDIT-2026-07-28.md` §8.4.1) | Email lane built greenfield on governed Delta landing per the corpus CP-EMAIL contract (display-only digest); classification methodology from `REF_CP-EMAIL_SourceRoutingMatrix.md` + legacy `alert_sinks` intent contract preserved as its spec | Checklist 4.4 (P1 blocker) is satisfied by absence; building the lane governed-first avoids ever creating the uncontrolled path. Read-time sensitivity + audited reads (4.6) are **new construction** on UC ABAC + audit logs (legacy had neither — audit §8.4.2). | Checklist 4.4, 4.6 | Email-lane tests (Phase 6) | approved |
| D-LEG-007 | API client typing | 1,661-line hand-written `api.ts` mirror of the FastAPI surface | OpenAPI-generated TypeScript client with a CI drift gate; hand-written client deleted | Checklist 5.6. Behaviour-preserving; removes a documented drift bug class. | Checklist 5.6 | Contract-generation CI job + drift test (Phase 5) | approved |
| D-LEG-008 | Vector store | Self-hosted Postgres + pgvector | Lakebase (managed Postgres) with pgvector initially; optional later move to Databricks Vector Search logged as a separate proposed deviation when/if taken | Checklist 6.2 permits either; staying on pgvector minimises retrieval-behaviour drift during parity. | Checklist 6.2; ARCHITECTURE.md §5.3 | Retrieval parity spot-checks (Phase 4) | approved |
| D-LEG-009 | Artifact store | Container filesystem + Postgres blobs (legacy layout) | Unity Catalog Volumes for raw/derived documents and rendered artifacts; Lakebase keeps metadata + hashes | Checklist 6.1/6.2/6.4; hash discipline (`input_corpus_sha256`, `ReportVersion`) unchanged. | Checklist 6.4 | Immutability tests (Phase 1/5) | approved |

| D-LEG-010 | Stop-on-Blocked scope | Legacy runner blocks only *dependents* of a Blocked module (`_block_reason` input gate); independent branches continue | A `qa_status: Blocked` node halts the **whole pathway** (wrapper halt-check + `runs.halt_reason`), per the corpus rbot-orchestrator rule "does not route around a blocked gate even if a downstream node's other dependencies are satisfied" | DEPLOY_B is normative for orchestration semantics (OPEN-QUESTIONS Q-007); whole-pathway halt is stricter and fail-closed. Parity comparisons therefore run per-module on identical inputs, not whole-pathway traces, where this changes which modules execute. | Corpus README §5.4 / ROUTE_GRAPH; ARCHITECTURE §6.2 | Phase 3 orchestration test: Blocked-at-CP-0 ⇒ zero downstream module rows | approved |

## D-DBX — Divergences from the checklist's Databricks-column mapping

| ID | Checklist item | Mapped primitive | Rebuild choice | Rationale | Status |
|----|----------------|------------------|----------------|-----------|--------|
| D-DBX-001 | 6.2 (vectors) | "Lakebase pgvector **or** Databricks Vector Search" | Lakebase pgvector at cutover; Vector Search deferred to a post-cutover optimisation decision | Minimise behaviour drift while 9.1 parity is the gate; both options are inside the checklist's allowed set, so this is a sequencing choice, not a true deviation — logged for visibility. | approved |
| D-DBX-002 | 7.1 (malware scan) | "Scan on ingest before landing to a UC Volume" | ClamAV runs inside the ingestion Workflows job against a quarantine Volume prefix; the App's upload route only writes to quarantine and never serves unscanned bytes | Databricks Apps serverless runtime cannot host a resident `clamd`; the job-side scan preserves fail-closed semantics (6.5: upload lane refuses if the scan lane is unavailable). | approved |

## D-MIG — Migration-class decisions (checklist 9.5)

Per-domain migrate / current-only / re-derive / drop decisions are specified in
`roadmap/ROADMAP.md` §Migration classes. Log any *change* to those decisions here as a
new row with rationale.

| ID | Data domain | Class decided | Changed to | Rationale | Status |
|----|-------------|---------------|------------|-----------|--------|
| — | — | — | — | — | — |
