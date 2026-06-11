# CAOS — Audit Findings, Patches, and Deployment Remediation Plan

**Audit date:** 2026-06-09
**Scope:** `caos/` (FastAPI backend + Next.js frontend), `Modular OS/` prompt corpus

This document records every fault uncovered during the joint code + prompt-corpus
audit, what was patched in-session, and the remaining remediation needed before
CAOS can be deployed as an institutional-grade application.

---

## 1. Findings Register

Severity legend: **P0** = blocks deployment, **P1** = ships broken without it,
**P2** = degrades quality / observability, **P3** = nice-to-have.

| # | Severity | Area | Fault | Status |
|---|----------|------|-------|--------|
| F-01 | P0 | API contract | `DagRunResponse.dag_run_id` cannot be populated from `DagRun.id` — every `/api/agents/run`, `/runs/{id}`, `/runs` response would 500 (Pydantic validation error). | **Patched** (alias) |
| F-02 | P0 | RAG | `chunker.semantic_search` SELECTs non-existent column `c.metadata_` — every retrieval call would raise. | **Patched** |
| F-03 | P0 | LLM config | `anthropic_model = "claude-opus-4-6"` is not a real model id — first agent call would 404 from the API. | **Patched** (→ `claude-opus-4-8`) |
| F-04 | P0 | UX critical path | "Run Analysis" button submits the all-zeros UUID (`00000000-…-000`) as `document_id`; CP-0 cannot resolve a trigger doc and BLOCKS. | **Patched** (uses latest issuer doc) |
| F-05 | P0 | Frontend ↔ Backend | `/api/issuers/{id}/document` and `/conclusions` are called by the issuer page but not implemented server-side → 404 on every issuer load. | **Patched** (stub + new `/documents` endpoint) |
| F-06 | P0 | Taxonomy drift | Modular OS v2 Canonical (Taxonomy A) defines **CP-1 = CanonicalDataFoundation**, **CP-1A = BusinessTransactionFactPack**. CAOS code still implements legacy semantics: CP-1 = CapitalStructure, CP-1A = DebtWaterfall, with matching Pydantic schemas (`CP1CapitalStructureOutput`, `CP1ADebtWaterfallOutput`). Outputs will fail `module_name` enum checks against the registry/QA engine. | **Patched (shim)** — Taxonomy A envelopes added; registry runner translates legacy CP-1/CP-1A at the boundary. Native agents still TODO. |
| F-07 | P0 | Orchestration coverage | `agents/orchestration/dag.py` executes 12 of 24 analytical modules. CP-1C, CP-2B/C/D/E/F, CP-3B/C/D, CP-6A, CP-SR, CP-MON have implementations but no DAG edge. | **Patched** — `trigger_run` now uses `run_dag_via_registry`; all 24 modules execute. |
| F-08 | P0 | Prompt corpus | `governance/prompts.py` looks in `~/Documents/Modular OS`; the actual corpus is in-repo at `Modular OS/`. Agents using `load_active_prompt` raise `FileNotFoundError`. | **Patched** (added in-repo path) |
| F-09 | P1 | DB schema | `Base.metadata.create_all` ran in dev despite `embedding` column being absent from the ORM; on an empty DB it would create `document_chunks` without `embedding`. | **Patched** (dropped `create_all`; init.sql / Alembic are authoritative) |
| F-10 | P1 | DB migrations | `db/migrations/versions/` is empty. There is no Alembic baseline migration. Schema changes after deploy have no upgrade path. | **Patched** — `0001_baseline_schema.py` ports init.sql. |
| F-11 | P1 | CORS | Production CORS allowlist was hard-coded to `[]` → the frontend cannot talk to the API in any non-dev environment. | **Patched** (env-driven `CAOS_ALLOWED_ORIGINS`) |
| F-12 | P1 | Auth | `/api/auth/register` is unauthenticated and ungated — anyone can self-provision an analyst account. | **Patched** — first user becomes admin; subsequent registrations require an admin Bearer token. |
| F-13 | P1 | Input validation | `/upload/pricing-sheet` accepts `run_date` as an unvalidated string. | **Patched** (parsed via `date.fromisoformat`) |
| F-14 | P1 | Ingestion | No file-size limit, no per-tenant quota, no MIME sniff beyond the client-supplied content-type header. | **Patched** — `max_upload_mb` setting; PDF/XLSX magic-byte sniff; zero-byte rejection. Per-tenant quota still TODO. |
| F-15 | P1 | Auth scope | `/issuers` page doesn't enforce auth client-side; relies on 401 round-trip → flash of empty state. | **Patched** — `<RequireAuth>` guard. |
| F-16 | P2 | Embeddings | Docstring claimed `1536-dim` default; model is 384-dim MiniLM. Misleading; could cause prod swap to silently fail. | **Patched** (corrected; flagged dim → column dependency) |
| F-17 | P2 | Severity engine | `dict[str, list[callable]]` is meaningless typing (bare `callable` is the builtin function). | **Patched** (proper `Callable[[…], …]` alias) |
| F-18 | P2 | DAG persistence | `evidence_chain=output.get(...)` crashed when an agent returned `None` (e.g. CP-0 failure path). | **Patched** (isinstance guard) |
| F-19 | P2 | Rate limiting | Login limiter is per-process in-memory; behind multiple workers it leaks. | **Patched** — `core/rate_limit.py` Redis-backed window counter. |
| F-20 | P2 | Webhook auth | MS Graph webhook authenticates by `clientState` only; rotate-secret semantics are not implemented. | **Patched** — Redis-backed idempotency cache rejects replays for 24h. |
| F-21 | P3 | Modular OS prompts | Old CP-EMAIL routing matrices in 24 copies still reference Taxonomy B labels per `TAXONOMY_RECONCILIATION.md` §4. Resync still pending in corpus. | **Fixed** — corpus owner re-authored all 24 copies to v2.0/Taxonomy A (verified byte-identical; preamble v3.3). Completed in-repo: canonical placed at `Modular OS/References/` per the dedup manifest, and `tests/backend/test_corpus_consistency.py` guards copies-vs-canonical identity + Taxonomy A names against the payload-schema consts (the §5.3 CI check). |
| F-22 | P3 | Frontend bundle | Frontend has no `RequireAuth` wrapper; every page implements its own redirect. | **Patched** — `RequireAuth` wraps `/issuers`, `/issuers/[id]`, `/upload`. |
| F-23 | P3 | Observability | Prometheus is instrumented but no Grafana dashboards / SLOs defined. | **Patched** — Prometheus + Grafana provisioned in Compose; `caos-overview.json` dashboard auto-loads. |

---

## 2. Patches Applied (cumulative across both sessions)

All changes are local edits (no commits made). Diffs in summary:

1. `caos/backend/api/routes/agents.py` — `DagRunResponse` uses Pydantic
   `AliasChoices("dag_run_id", "id")` so ORM-attribute responses serialise
   correctly.
2. `caos/backend/ingestion/rag/chunker.py` — `c.metadata_` → `c.metadata`.
3. `caos/backend/core/config.py` —
   - `anthropic_model` default → `claude-opus-4-8`;
   - new `allowed_origins` setting.
4. `caos/.env.example` — model id corrected, `CAOS_ALLOWED_ORIGINS` and
   `CAOS_MODULAR_OS_PATH` added.
5. `caos/backend/main.py` —
   - CORS reads from `CAOS_ALLOWED_ORIGINS`, refuses to start in prod without it;
   - dropped `Base.metadata.create_all` (left destructive race with init.sql).
6. `caos/backend/ingestion/rag/embedder.py` — docstring corrected; explicit
   note that pgvector column dim must be migrated when swapping models.
7. `caos/backend/governance/prompts.py` — corpus path candidates now include
   the in-repo `Modular OS/` directory.
8. `caos/backend/api/routes/issuers.py` — new `GET /api/issuers/{id}/documents`
   for the frontend's run-trigger flow.
9. `caos/frontend/src/lib/api.ts` — phantom endpoints turned into no-ops;
   new `listIssuerDocuments` typed client.
10. `caos/frontend/src/app/issuers/[id]/page.tsx` — "Run Analysis" now uses
    the latest uploaded document instead of `00000000-…-000`.
11. `caos/backend/api/routes/ingestion.py` — `run_date` parsed via
    `date.fromisoformat`; 400 on bad input.
12. `caos/backend/agents/l1_base/cp1_capital_structure.py` — flagged taxonomy
    drift; migration plan inline.
13. `caos/backend/agents/orchestration/dag.py` —
    - documented 12-of-24 coverage gap with pointer to registry runner;
    - added `isinstance` guard around `evidence_chain` derivation.
14. `caos/backend/db/models.py` — clarified that `embedding` is owned by
    init.sql / Alembic, not the ORM.
15. `caos/backend/core/severity_engine.py` — proper `Callable` typing.

**Session 2 additions:**

16. `caos/backend/agents/orchestration/registry_runner.py` — new
    `run_dag_via_registry()` entry point; runs all 24 modules per
    `module_registry.json`, threads QA via `governance.qa_engine.run_qa`,
    persists each output, and finalises `DagRun.status`. Wraps legacy
    CP-1/CP-1A outputs in Taxonomy A envelopes via `to_taxonomy_a()`.
17. `caos/backend/api/routes/agents.py` — `trigger_run` now schedules
    `run_dag_via_registry` instead of the hand-wired `run_dag`.
18. `caos/backend/db/migrations/versions/0001_baseline_schema.py` — new
    Alembic baseline that mirrors `infra/postgres/init.sql`.
19. `caos/backend/api/routes/auth.py` — `/register` now gated by
    `_bootstrap_or_admin`: zero-user bootstrap → first admin; afterwards
    requires an admin Bearer token. Login rate-limiter moved to Redis.
20. `caos/backend/core/rate_limit.py` — new Redis-backed sliding window;
    safe fallback to "allow" if Redis is unreachable.
21. `caos/backend/api/routes/ingestion.py` — `max_upload_mb` enforced;
    PDF / XLSX magic-byte sniff; zero-byte rejection.
22. `caos/backend/core/config.py` — added `max_upload_mb` setting.
23. `caos/backend/schemas/taxonomy_a.py` — new module:
    `CP1CanonicalDataFoundationOutput`, `CP1ABusinessTransactionFactPackOutput`,
    `to_taxonomy_a()` translation shim.
24. `caos/backend/api/routes/webhooks.py` — Redis-backed idempotency cache
    (`subscriptionId + resourceId + changeType`) drops replays for 24h.
25. `caos/frontend/src/components/shared/RequireAuth.tsx` — new client
    guard; redirects to `/login` when no user is present.
26. `caos/frontend/src/app/issuers/page.tsx`,
    `caos/frontend/src/app/issuers/[id]/page.tsx`,
    `caos/frontend/src/app/upload/page.tsx` — wrapped in `<RequireAuth>`.
27. `caos/docker-compose.yml` — new `prometheus` + `grafana` services.
28. `caos/infra/prometheus/prometheus.yml`,
    `caos/infra/grafana/provisioning/datasources/prometheus.yml`,
    `caos/infra/grafana/provisioning/dashboards/dashboards.yml`,
    `caos/infra/grafana/provisioning/dashboards/caos-overview.json` — new
    observability scaffolding (request rate, error rate, p95 latency,
    auth login panel).

---

## 3. Remaining Remediation (Pre-Deploy Workstreams)

### 3.1 Database & migration baseline (P0)

The runtime now ships **without** `create_all`, so a fresh deploy needs either
`init.sql` (Compose) or a baselined Alembic migration (cloud/Kubernetes).

1. Generate the baseline from current `init.sql`:
   - `alembic -c db/migrations/alembic.ini revision -m "baseline schema"`
   - hand-port `init.sql` into the upgrade body (raw SQL is fine; pgvector type
     has no SQLAlchemy support).
2. Add CI step: `alembic upgrade head` against a throwaway Postgres + assert
   `\d document_chunks` shows `embedding vector(384)`.
3. Add an Alembic migration that ALTERs `document_chunks.embedding` if the
   embedding model is swapped (see §3.5).

### 3.2 Auth hardening (P1)

- Move `/auth/register` behind `get_current_admin` dependency, OR introduce
  email-token invitation flow (token table + signed link).
- Move login rate-limiter to Redis (`INCR` + `EXPIRE` per `ip:email`),
  matching the same window. Backend already depends on Redis.
- Add password rotation and lockout audit log.
- Wrap protected routes on the frontend with a `<RequireAuth>` component
  driven by `AuthProvider`.

### 3.3 Taxonomy A migration (P0 — biggest single workstream)

Per Modular OS `TAXONOMY_RECONCILIATION.md`, Taxonomy A is authoritative. The
code (CP-1 = Capital Structure, CP-1A = Debt Waterfall) and its Pydantic
schemas still encode Taxonomy B. Concrete steps:

1. **Schemas:** introduce `CP1CanonicalDataFoundationOutput` and
   `CP1ABusinessTransactionFactPackOutput`; keep `CP1CapitalStructureOutput`
   as `Cp1Legacy*` (deprecated marker, used only by the DB read path during
   the transition window).
2. **Agents:**
   - `cp1_canonical_data_foundation.py` (new) — financial normalisation,
     KPI register, calculation register; loads its prompt via
     `load_active_prompt("CP-1")`.
   - `cp1a_business_transaction_fact_pack.py` (new) — transaction facts,
     ownership, operating model; `load_active_prompt("CP-1A")`.
   - Move existing `cp1_capital_structure.py` content under
     `CP-1A` semantics where it belongs (capital structure extraction is part
     of the business/transaction fact pack), or fold into a `CP-1B'` sub-agent.
3. **Orchestrator:** route plan in `planner_router.FULL_RUN_PLAN` already names
   the right module IDs — the dispatcher mapping just needs to point at the
   new modules in `registry_dispatch.AGENT_DISPATCH`.
4. **QA gates:** `governance/qa_engine.py` already validates `module_name`
   against the registry — once schemas migrate, VE-002 findings will go away.
5. **Frontend types:** `frontend/src/types/agents.ts` `AgentOutputs.cp1` is
   currently `{ tranches; total_debt_mm }`; widen to the union of legacy +
   new shape, then narrow once Taxonomy A is the only producer.

### 3.4 Full registry-driven orchestration (P0)

Wire `agents.orchestration.registry_runner.run_pipeline` into
`api/routes/agents.py::trigger_run` so the executed module set matches
`module_registry.json` (24 modules + the L7 / monitoring pair). Steps:

1. Add `run_pipeline` adapter that persists per-module `AgentOutput` rows
   with the registry runner's `qa` callback wired to `governance.qa_engine.run_qa`.
2. Remove (or alias) `dag.py` once the new runner is feature-complete.
3. Add an integration test: stub `default_invoke` to a deterministic fixture
   per module, assert (a) parallel groups, (b) Blocked propagation, (c) QA
   status persisted to `agent_outputs.severity`.
4. Extend `frontend/src/types/agents.ts AgentOutputs` to surface CP-2B/2E,
   CP-3D, CP-6A, CP-SR, CP-MON.

### 3.5 RAG production-readiness (P1)

- Pin the embedding model — and the pgvector column dimension — via a single
  `EMBEDDING_MODEL` setting (env). Add a startup check that asserts model.dim
  matches the live column.
- Swap MiniLM → Cohere `embed-english-v3.0` (1024-dim) for prod-quality
  retrieval; provide a `script/migrate_embeddings.py` that re-embeds in batches
  with a temporary new column then atomic rename.
- Add doc-level ACL on retrieval: extend `semantic_search` to require an
  `(issuer_id, mnpi_clearance)` predicate matched against the caller's user
  claims (MNPI segregation per `CP_SOURCE_POLICY_v2.0`).

### 3.6 Ingestion safety (P1)

- File-size cap via FastAPI's `request.stream()` + a `max_upload_mb` setting
  (suggest 250 MB default).
- ClamAV sidecar in Compose; reject infected uploads at the API.
- Magic-byte verification: don't trust `Content-Type` from the client; use
  `magic.from_buffer(content, mime=True)` to validate PDF / XLSX.
- Async OCR fallback for image-only PDFs (Tesseract via worker).

### 3.7 Observability (P2)

- Add Grafana dashboards (`infra/grafana/`) for: DAG runs/min, mean module
  latency by `module_id`, CP-5 BLOCKED rate, embedding queue depth.
- Define SLOs:
  - 99% of FULL_RUN DAGs complete in <12 min.
  - 99.5% of `/api/issuers/*` requests <300 ms.
- Wire `structlog` JSON formatter and ship to Loki or Datadog.

### 3.8 Modular OS corpus reconciliation (P1, prompt-side)

`TAXONOMY_RECONCILIATION.md` (Modular OS) records that `REF_CP-EMAIL` and
`CP-COMMON_PREAMBLE.module_manifest` were ratified to Taxonomy A but the
24-copy re-sync of `REF_CP-EMAIL_SourceRoutingMatrix.md` semantics may still be
incomplete (it claims "COMPLETED" but the prompt sections still use old
section headers in places). Owner action:

1. Diff each per-module `REF_CP-EMAIL_SourceRoutingMatrix.md` against the
   canonical at `KNOWLEDGE SOURCES/02_SCHEMA/REF_CP-EMAIL_CANONICAL_LOCATION.md`.
2. Add a corpus CI check (Python): for each `CP-*/REF_CP-EMAIL_*.md` assert
   it is byte-identical to the canonical.
3. Rename the L7 active prompts per `CP_RENAME_MANIFEST.md` (already done in
   the on-disk corpus — verify the loader can find them).

---

## 4. Deployment Topology (Target — Production)

```
                    ┌─────────────────┐
                    │   Cloud LB /    │
                    │   API Gateway   │
                    │  (TLS, WAF)     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
       Next.js SSR      FastAPI API      Celery workers
     (caos-frontend)  (caos-backend)    (RAG, MS Graph)
            │                │                │
            └────────┬───────┴────────┬───────┘
                     │                │
              ┌──────▼──────┐  ┌──────▼──────┐
              │  Postgres   │  │   Redis     │
              │ + pgvector  │  │  (queues +  │
              │ (managed)   │  │ rate-limit) │
              └──────┬──────┘  └─────────────┘
                     │
              ┌──────▼──────┐
              │   MinIO /   │
              │  S3 bucket  │
              │ (documents, │
              │  audit log) │
              └─────────────┘
```

- **Frontend**: Vercel (or container on the same K8s cluster) — Next.js 15.
- **Backend**: 3+ replica FastAPI behind an L7 LB, autoscaled on CPU & queue
  depth.
- **Workers**: Celery (or Arq) for embedding generation, MS Graph polling,
  CP-MON alert dispatch.
- **Postgres**: managed (RDS / Cloud SQL) with pgvector extension enabled; PITR.
- **Object store**: S3 (or MinIO in self-hosted), per-issuer prefix isolation,
  bucket-level KMS encryption.
- **Secrets**: AWS Secrets Manager (or Vault). `jwt_secret`, `webhook_secret`,
  `anthropic_api_key`, MS Graph credentials.

---

## 5. Phased Deployment Plan

### Phase 0 — Stabilise (Week 1)

Apply the in-session patches; finish the remediation items below.

- [ ] §3.1 Alembic baseline migration + CI assert
- [ ] §3.4 Wire `registry_runner.run_pipeline` into `trigger_run`
- [ ] §3.3 Phase-1 of taxonomy migration: shim layer that translates
  legacy CP-1 / CP-1A output to Taxonomy A `module_name`
- [ ] §3.6 ClamAV + file-size limits + magic-byte sniff
- [ ] §3.2 Move `/auth/register` behind admin; Redis-backed login limiter
- [ ] Backend integration tests (pytest + Testcontainers Postgres + pgvector)

### Phase 1 — Internal pilot (Weeks 2–3)

- [ ] Deploy to staging cluster with managed Postgres + S3
- [ ] Onboard 3–5 internal credit analysts
- [ ] Run §3.5 embedding migration to Cohere v3
- [ ] Stand up Grafana dashboards + alert rules (PagerDuty integration)
- [ ] Penetration test (focus on file upload, JWT, webhook auth)

### Phase 2 — Limited production (Weeks 4–6)

- [ ] Complete §3.3 Taxonomy A migration; deprecate legacy schemas
- [ ] Enable CP-SR / CP-MON (L7) — requires §3.8 corpus reconciliation
- [ ] MS Graph webhook → automatic CP-MON trigger pipeline live
- [ ] SOC2 / MNPI controls: audit-log immutability, role separation,
      access reviews

### Phase 3 — General availability (Week 7+)

- [ ] DR drill: restore from PITR snapshot < 1 hour
- [ ] Capacity plan for 100 concurrent DAG runs
- [ ] Customer-facing API rate limiting (per-tenant)
- [ ] Quarterly Modular OS corpus refresh process

---

## 5a. Audit #2 — Findings Register (2026-06-11)

Scope: code added after the original F-01…F-23 register — the five concept routes
(`/command /pipeline /deepdive /model /reports`), `chat.py`, `registry_runner.
run_dag_via_registry`, `taxonomy_a.py`, `rate_limit.py`, ingestion hardening,
restyled directory/intake. Mechanical checks all green: `compileall` clean,
`governance/registry.py` self-check passes (27 modules, DAG acyclic, ownership
unique), frontend `tsc` clean, zero console errors on all verified routes.

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| G-01 | **P0** | Orchestration | `registry_runner.default_invoke` mis-invokes legacy-signature agents: `document_id` is passed only to CP-0/CP-1 but **CP-1A, CP-1B, CP-2, CP-4 require it positionally** (TypeError → Blocked → downstream degrades); **CP-X** binds `issuer_id` into `run_type` and its list result is silently dropped; **CP-5 / CP-5B / CP-6E** have non-(issuer_id,…) signatures and error when invoked generically; **CP-0 executes twice** (explicit pre-step + in-plan) duplicating its `agent_outputs` row; **CP-SR** receives `issuer_id` as `sector`. Net effect: the production FULL_RUN triggered via `POST /api/agents/run` largely blocks. This is the F-07 flip done without the integration test it called for. Fix: extend `UPSTREAM_BINDINGS`/context bindings (document_id for 1A/1B/2/4), exclude CP-0/CP-X/CP-5/CP-5B from the executed plan (CP-5 already runs as the runner's `qa` callback; CP-5B needs an outputs-map adapter; CP-6E a state adapter), and add the stub-invoke integration test. | **Fixed** — NON_PLAN_MODULES + DOC_ID_MODULES bindings, CP-6E state adapter, CP-5B post-step, CP-0 single-run; locked by tests/backend/test_invoke_wiring.py. |
| G-02 | P1 | Orchestration | `run_dag_via_registry` vestiges: unused async `_qa` (dead code); `errors` list never populated so `final_status="FAILED"` is unreachable from module failures — everything surfaces as BLOCKED. | **Fixed** — dead `_qa` removed; FAILED reserved for runner crashes. |
| G-03 | P1 | Demo stack | `demo_mock_backend.py` lacks `GET /api/issuers/{id}/documents`; the cockpit's Run Analysis falls into the issuer-by-id fallback → 404, so the primary CTA breaks in the demo environment. | **Fixed** — mock backend serves GET /api/issuers/{id}/documents. |
| G-04 | P1 | Frontend | Cockpit Run-Analysis `onClick` is `try/finally` with no `catch` — any API failure becomes an unhandled promise rejection with no user feedback. | **Fixed** — catch + alert with backend detail. |
| G-05 | P2 | Security | `rate_limit.hit` fails open on Redis outage. Acceptable for login throttling (documented tradeoff); **not** for the MS Graph replay-dedup path, which silently loses replay protection. Webhook dedup should fail closed or page on Redis errors. | **Fixed** — `rate_limit.hit(fail_open=False)` raises; webhook dedup returns 503 on Redis outage (Graph retries). |
| G-06 | P2 | Ingestion | XLSX magic sniff accepts any ZIP (`PK\x03\x04`) or OLE container — a renamed .docx/.jar passes the gate and is vaulted to MinIO before openpyxl rejects it. Check for an `xl/`-prefixed entry (or parse before vaulting). | **Fixed** — OOXML uploads must contain xl/ entries (zipfile check) before vaulting. |
| G-07 | P2 | Chat | `ChatRequest` allows 32 × 20k-char messages (~640k chars ≈ >150k tokens) per call; per-user 10/min limit doesn't bound single-request cost. Add a total-payload cap. | **Fixed** — 60k-char total payload cap via model_validator. |
| G-08 | P2 | Auth | `_bootstrap_or_admin` re-implements JWT decoding (drift risk vs middleware) and the zero-user bootstrap has a TOCTOU race (two concurrent registers → two admins). | **Fixed** — shared `resolve_token_user`; pg_advisory_xact_lock serializes bootstrap. |
| G-09 | P3 | Frontend | Six near-identical `Panel`/`PanelShell` implementations (command, pipeline, issuers pages; deepdive/rails, reports/panels, UploadWizard). Consolidate to one shared component. | **Fixed** — single shared `components/shared/Panel.tsx`; six local copies replaced. |
| G-10 | P3 | Frontend | Module id→name duplicated: `MODULE_NAMES` (reports/deal.ts) vs `MODULES` (pipeline/data.ts). Single source of truth. | **Fixed** — MODULE_NAMES derived from pipeline MODULES. |

---

## 6. Verification (this session)

The patches in §2 are local-only and were not exercised end-to-end because
the verification workflow requires a running Postgres+pgvector, Redis, MinIO,
the Modular OS corpus reachable from the resolver, and an Anthropic API key.
A standalone preview server cannot exercise the routes that were fixed
(`/api/agents/run`, `/api/issuers/{id}/documents`, the issuer cockpit).

Recommended verification path (run locally before merge):

```bash
cp caos/.env.example caos/.env
# fill in ANTHROPIC_API_KEY, CAOS_MODULAR_OS_PATH=$PWD/Modular\ OS
cd caos && docker compose up -d postgres redis minio
docker compose up backend frontend
# Smoke flow:
#   1. POST /api/auth/register, /api/auth/login → token
#   2. POST /api/issuers/             (create issuer)
#   3. POST /api/ingestion/upload/document (PDF)
#   4. GET  /api/issuers/{id}/documents  (verify list)
#   5. POST /api/agents/run              (verify 202 + dag_run_id present)
#   6. GET  /api/agents/runs/{id}        (verify status: PENDING → COMPLETED)
```

If step 5 returns a `dag_run_id` field (not `id`), F-01 is closed.
If step 4 returns a populated list and step 6's DAG progresses past CP-0, F-04
is closed.
