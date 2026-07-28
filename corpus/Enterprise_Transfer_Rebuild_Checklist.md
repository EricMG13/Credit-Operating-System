# Enterprise Transfer / Rebuild — Requirements Checklist

**Application:** CAOS (Credit Agent OS) — an institutional leveraged-finance credit-analysis platform (multi-agent CP-X engine + analyst workbench: Deep-Dive, Model Builder, Report Studio, Query, Monitoring).

**Purpose:** Move CAOS from a personal / off-estate build (self-hosted container, direct LLM keys, Google OIDC, personal repo) into a governed enterprise environment. Each requirement carries **application relevance** (what in CAOS it touches) and a **Databricks deployment** mapping (how it is satisfied on the Databricks Data Intelligence Platform: Apps, Lakebase, Unity Catalog, Mosaic AI Model Serving / AI Gateway, Workflows, Asset Bundles).

**Priority key:** `P1` = blocker / step zero (mandatory before any deployment) · `P2` = pre-scale · `P3` = carry-forward / hardening.
**Status values:** Not started · In progress · Blocked · Complete · N/A

---

## 1 · Governance & Approval (Step Zero)

- [ ] **1.1 Register the use case in the central AI/use-case inventory with a named owner** — `P1`
  - *Acceptance:* Inventory entry created; owner and business sponsor recorded.
  - *CAOS relevance:* CAOS is an unregistered personal tool whose outputs feed portfolio decisions — it must become a named, owned use case.
  - *Databricks:* Register the app and its serving endpoints as governed objects; surface lineage and ownership in the platform governance hub.

- [ ] **1.2 Complete an AI risk rating / classification** — `P1`
  - *Acceptance:* Risk tier assigned; high-tier treatment expected (outputs inform investment decisions).
  - *CAOS relevance:* Agentic outputs → committee memos → position sizing places CAOS in the highest risk tier.
  - *Databricks:* Tag the serving endpoints and catalogs by risk tier; apply AI Gateway guardrails proportional to tier.

- [ ] **1.3 Produce Phase-1 governance artifacts** — `P1`
  - *Acceptance:* Task-to-method map, non-AI comparison, expected-risk & failure-rate doc, data-classification inventory, decommission plan.
  - *CAOS relevance:* Map each CP module (CP-0…CP-6E) to its method; justify LLM synthesis vs deterministic lanes; document CP-5 gate failure modes.
  - *Databricks:* Capture artifacts in a governed workspace repo; use catalog metadata to evidence the data-classification inventory.

- [ ] **1.4 Obtain model-risk and AI-oversight review sign-off** — `P1`
  - *Acceptance:* Documented review by model-risk and AI-governance functions before production.
  - *CAOS relevance:* The cash-flow model, downside pathways and relative-value conclusions are model-risk-relevant.
  - *Databricks:* Use MLflow run/version tracking and endpoint logs as review evidence.

- [ ] **1.5 Define human-in-the-loop / accountability model** — `P1`
  - *Acceptance:* Named human accountable for every AI-assisted output; sign-off points documented.
  - *CAOS relevance:* Analyst ratification (`approval_state`) and IC votes are the accountability points.
  - *Databricks:* Enforce ratification state in Lakebase; gate downstream jobs on it.

---

## 2 · Identity, Access & Authentication

- [ ] **2.1 Replace non-enterprise IdP with the sanctioned enterprise SSO** — `P1 — blocker`
  - *Acceptance:* Auth via enterprise SSO/OIDC; no third-party/consumer IdP in the path.
  - *CAOS relevance:* Removes the Google Workspace `oauth2-proxy` edge.
  - *Databricks:* Databricks Apps inherit **workspace SSO (enterprise IdP + SCIM)** natively — the custom auth edge is deleted, not re-implemented.

- [ ] **2.2 Enforce role-based / attribute-based access control** — `P1`
  - *Acceptance:* analyst / viewer / QA / admin roles mapped to enterprise groups; least-privilege verified.
  - *CAOS relevance:* CAOS's `role ∈ {analyst, viewer, qa, admin}` and team-scoped ownership gates.
  - *Databricks:* Map roles to **Unity Catalog grants + ABAC**; app authorises against workspace identity.

- [ ] **2.3 Use managed service principals for system-to-system access** — `P1`
  - *Acceptance:* No embedded user credentials; SPNs scoped to required API scopes.
  - *CAOS relevance:* Background executors and EDGAR/model calls run as jobs, not as a user.
  - *Databricks:* Run Workflows/Jobs and app compute under **service principals** with scoped tokens.

- [ ] **2.4 Session security and revocation** — `P2`
  - *Acceptance:* Signed sessions with a revocation epoch; logout invalidates outstanding tokens.
  - *CAOS relevance:* CAOS already ships HMAC sessions + `token_version` — carry forward.
  - *Databricks:* Platform-issued OAuth tokens on `/api` routes; app trusts the workspace session.

- [ ] **2.5 Single edge-authorization chokepoint on all non-health endpoints** — `P2`
  - *Acceptance:* Edge credential verified at one middleware point; per-route bypass impossible.
  - *CAOS relevance:* CAOS's `X-Edge-Authorization` middleware chokepoint.
  - *Databricks:* Apps enforce bearer-token auth on `/api/*`; keep the app-side chokepoint as defence-in-depth.

---

## 3 · Model / LLM Access

- [ ] **3.1 Route ALL model calls through the governed model gateway** — `P1 — blocker`
  - *Acceptance:* No direct vendor API keys in code/config; provider seam points at the enterprise gateway.
  - *CAOS relevance:* Removes direct `ANTHROPIC_/OPENROUTER_/GEMINI_API_KEY` usage across heavy/light/extract lanes.
  - *Databricks:* Point CAOS's Anthropic-shaped provider seam at **Mosaic AI Model Serving**; use **External Models** for Claude/Gemini. An adapter swap, not a rewrite.

- [ ] **3.2 Centralised credential management for external models** — `P1`
  - *Acceptance:* Keys stored once in the platform secret store; never exposed to users or source.
  - *CAOS relevance:* Eliminates keys in `.env` / deploy config.
  - *Databricks:* **Unity AI Gateway** stores provider credentials once; endpoints reference them.

- [ ] **3.3 Rate limits, budgets and quotas per caller/lane** — `P2`
  - *Acceptance:* Token/credit governance active; per-run budget enforced; overspend alerts configured.
  - *CAOS relevance:* Replaces CAOS's hand-rolled per-run token budget.
  - *Databricks:* AI Gateway **rate limits + budgets** per endpoint/principal.

- [ ] **3.4 Prompt/completion logging to the approved environment** — `P1`
  - *Acceptance:* All prompts, completions, metadata and safety logs captured centrally.
  - *CAOS relevance:* Complements CAOS's `LLMCallRecord` audit table.
  - *Databricks:* AI Gateway **inference tables / payload logging** to Unity Catalog.

- [ ] **3.5 Guardrails on model inputs/outputs (PII, safety, injection)** — `P2`
  - *Acceptance:* Gateway guardrails enabled; indirect prompt-injection hardening on every document→model extractor.
  - *CAOS relevance:* CAOS already wraps every extractor with injection hardening — keep and layer gateway guardrails on top.
  - *Databricks:* AI Gateway **safety guardrails + PII detection** at the proxy.

- [ ] **3.6 Deterministic fallback preserved for offline/no-key operation** — `P3`
  - *Acceptance:* Product still runs on deterministic fixtures with no model keys.
  - *CAOS relevance:* CAOS's fixture mode + canned demo replies — policy-neutral, keep.
  - *Databricks:* Fixtures run on job compute; no serving endpoint required for demo mode.

- [ ] **3.7 Pin tier→model map per version; record model id on each run** — `P3`
  - *Acceptance:* Model ids in config only; run row records model id + prompt version.
  - *CAOS relevance:* CAOS's `Run.model_id` / `prompt_version` fingerprint.
  - *Databricks:* Endpoint config holds the tier→model map; MLflow versions the mapping.

---

## 4 · Data Governance, Classification & Egress

- [ ] **4.1 Classify all data domains handled by the app** — `P1`
  - *Acceptance:* Public / internal / confidential / restricted labels assigned; inventory maintained.
  - *CAOS relevance:* Issuer filings, credit agreements, vendor mail, holdings sheets each differ in sensitivity.
  - *Databricks:* **Unity Catalog Data Classification** auto-discovers and tags sensitive columns.

- [ ] **4.2 Permit only approved data classifications into prompts / retrieval** — `P1 — blocker`
  - *Acceptance:* Restricted/sensitive data blocked or masked before any model call; egress flag off until sign-off.
  - *CAOS relevance:* Gates `CAOS_DOCUMENT_EGRESS_ENABLED` — issuer docs must not leave uncontrolled.
  - *Databricks:* Model calls terminate **inside** the AI Gateway boundary; ABAC masking applied pre-prompt.

- [ ] **4.3 Remove uncontrolled data-egress paths** — `P1 — blocker`
  - *Acceptance:* No off-host backup sync or personal-vault export; all egress terminates on-estate.
  - *CAOS relevance:* Removes `rclone` off-host backup and the Obsidian vault export.
  - *Databricks:* Persistence on **Lakebase / Delta**; backups to governed storage — no external sync.

- [ ] **4.4 Route external-content / mail ingestion through the data-governance workflow** — `P1 — blocker`
  - *Acceptance:* Live mailbox ingestion replaced with sanitised samples OR approved via data-gov workflow; vendor licence terms respected.
  - *CAOS relevance:* CAOS's read-only M365 email-intelligence lane and `CreditFact` extractor.
  - *Databricks:* Land approved vendor data as governed **Delta tables**; keep the extraction IP, drop uncontrolled Graph sync.

- [ ] **4.5 Automated PII detection, tagging and masking at query time** — `P2`
  - *Acceptance:* Sensitive columns tagged; attribute-based masking policies enforced.
  - *CAOS relevance:* Email archive holds colleagues' names / internal traffic.
  - *Databricks:* **UC agentic Data Classification + ABAC** masking on the email/fact tables.

- [ ] **4.6 Read-time sensitivity enforcement and audited reads retained** — `P2`
  - *Acceptance:* Post-delivery labels still block content at read time; archive reads are audited.
  - *CAOS relevance:* CAOS enforces sensitivity at read time and audits reads as well as writes — a strength.
  - *Databricks:* Complement with **UC audit logs + column lineage**; both layers coexist.

- [ ] **4.7 Data-subject / erasure capability** — `P2`
  - *Acceptance:* Operator process to erase a subject on request; retention policy documented.
  - *CAOS relevance:* CAOS's GDPR erase CLI keyed on analyst email.
  - *Databricks:* Delta `DELETE` + `VACUUM` on governed tables; documented retention.

---

## 5 · Source Control, Build & CI/CD

- [ ] **5.1 Migrate code to the enterprise source-control organisation** — `P1 — blocker`
  - *Acceptance:* Repo under enterprise org with SSO; personal/off-estate repo scrubbed or deleted.
  - *CAOS relevance:* Removes the personal public-ish repo hosting proprietary methodology.
  - *Databricks:* **Databricks Repos** linked to the enterprise Git org; deploy via **Asset Bundles (DABs)**.

- [ ] **5.2 Software-composition analysis on every build** — `P1`
  - *Acceptance:* Dependency/licence scanning gate passing.
  - *CAOS relevance:* Python (FastAPI/SQLAlchemy) + JS (React/Vite) dependency trees.
  - *Databricks:* SCA step in the DABs CI/CD pipeline before workspace deploy.

- [ ] **5.3 Static application security testing gate** — `P1`
  - *Acceptance:* SAST integrated; no unresolved high/critical findings at release.
  - *CAOS relevance:* 476 Python files + 618 TS/TSX files to scan.
  - *Databricks:* SAST in CI; block bundle deploy on high/critical.

- [ ] **5.4 Follow the enterprise SDLC / tollgate process** — `P1`
  - *Acceptance:* App on the approved-applications register; tollgates completed.
  - *CAOS relevance:* Formalises CAOS as a supported application.
  - *Databricks:* Workspace/catalog creation via approved intake; app registered.

- [ ] **5.5 Infrastructure-as-code provisioning (no manual drift)** — `P2`
  - *Acceptance:* All infra provisioned via IaC; environments reproducible.
  - *CAOS relevance:* Replaces the 7-service Docker Compose stack.
  - *Databricks:* **Asset Bundles + Terraform** define app, endpoints, jobs, catalogs as one versioned unit.

- [ ] **5.6 Contract-first API types with CI drift check** — `P3`
  - *Acceptance:* Types generated from the API schema; CI fails on stale client.
  - *CAOS relevance:* Retires the 1,661-line hand-written `api.ts`.
  - *Databricks:* Generation step runs in the bundle CI; drift check gates deploy.

---

## 6 · Hosting, Infrastructure & Runtime

- [ ] **6.1 Host on sanctioned enterprise infrastructure / approved reference architecture** — `P1 — blocker`
  - *Acceptance:* Off-estate container retired; app runs on approved platform.
  - *CAOS relevance:* Removes the self-managed single container.
  - *Databricks:* Deploy the FastAPI + static React build as a **Databricks App (serverless)** — the reference pattern is React/TypeScript/Vite/FastAPI.

- [ ] **6.2 Managed data store replacing self-managed database** — `P1`
  - *Acceptance:* Governed managed store (with vector capability) provisioned; migration validated.
  - *CAOS relevance:* Replaces self-hosted Postgres + pgvector.
  - *Databricks:* **Lakebase (managed Postgres)** for OLTP state + **UC synced tables**; vectors on Lakebase pgvector or **Databricks Vector Search**.

- [ ] **6.3 Single governed background-job runtime** — `P2`
  - *Acceptance:* Bespoke executors/pollers replaced by the platform job service; retries & recovery native.
  - *CAOS relevance:* Deletes the four hand-rolled executors + poller (~75 KB).
  - *Databricks:* **Databricks Workflows / Jobs (Lakeflow)** run the CP-X DAG and monitoring on schedule/trigger.

- [ ] **6.4 Immutability & reproducibility of published artifacts** — `P2`
  - *Acceptance:* Report versions hash-verified and bound to a frozen input corpus; reproducible from stored hashes.
  - *CAOS relevance:* CAOS's immutable `ReportVersion` + `input_corpus_sha256`.
  - *Databricks:* **Delta Lake** medallion + time-travel gives native immutability/versioning atop the hash discipline.

- [ ] **6.5 Fail-closed boot under unsafe configuration** — `P2`
  - *Acceptance:* App refuses to start on weak secrets, demo seed enabled, missing malware scan, or unsanctioned routes.
  - *CAOS relevance:* CAOS's existing production boot guards.
  - *Databricks:* App startup checks read secrets from the platform secret scope; fail closed if absent.

- [ ] **6.6 Backup and disaster-recovery to enterprise targets** — `P2`
  - *Acceptance:* Backups to approved storage; documented restore drill succeeds from cold.
  - *CAOS relevance:* Replaces `rclone` backup service.
  - *Databricks:* Delta table backups + Lakebase managed backups; rehearse restore.

- [ ] **6.7 Defined 24x7 support model and exit strategy** — `P3`
  - *Acceptance:* Run-book, on-call ownership and decommission/exit plan documented.
  - *CAOS relevance:* Operational ownership for a decision-grade tool.
  - *Databricks:* Document workspace/app ownership, on-call, and teardown via bundle destroy.

---

## 7 · Security Controls (carry forward / harden)

- [ ] **7.1 Malware scanning on all uploads (required in production)** — `P1`
  - *Acceptance:* Every upload scanned; boot fails closed if scanner unreachable.
  - *CAOS relevance:* CAOS's ClamAV gate on document/XLSX intake.
  - *Databricks:* Scan on ingest before landing to a Unity Catalog **Volume**; quarantine on failure.

- [ ] **7.2 Content-type sniffing by magic bytes; fail-closed OOXML gate** — `P2`
  - *Acceptance:* Extension spoofing rejected; active-content in workbooks refused.
  - *CAOS relevance:* CAOS's magic-byte sniff + OOXML active-content gate.
  - *Databricks:* Enforce in the ingestion job before writing to Volumes/Delta.

- [ ] **7.3 Bounded parsing / resource ceilings** — `P2`
  - *Acceptance:* Max size, pages, chars, timeout, per-issuer counts enforced.
  - *CAOS relevance:* CAOS's parse ceilings and per-issuer chunk caps.
  - *Databricks:* Ceilings enforced in the parsing job; cluster resource limits as backstop.

- [ ] **7.4 Security headers, CSP, rate limits on expensive lanes** — `P2`
  - *Acceptance:* CSP without unsafe-inline; fixed-window rate limits on credential-sensitive/expensive endpoints.
  - *CAOS relevance:* CAOS's CSP + per-caller rate limits (report drafts, decisions).
  - *Databricks:* App serves headers; AI Gateway adds model-lane rate limits.

- [ ] **7.5 Interactive API docs closed in deployed environments** — `P3`
  - *Acceptance:* Docs/openapi endpoints disabled outside dev.
  - *CAOS relevance:* CAOS already closes `/docs` in deployed contexts.
  - *Databricks:* Keep disabled in the app config for the deployed workspace.

---

## 8 · Autonomy, Monitoring & Human Oversight

- [ ] **8.1 Non-bypassable human ratification before autonomous output informs a decision** — `P1`
  - *Acceptance:* Approval-state gate enforced; no auto-published decision-grade output.
  - *CAOS relevance:* CAOS's `approval_state ∈ {draft, ratified, published}` and analyst ratification.
  - *Databricks:* Downstream Jobs gate on a ratified flag in Lakebase; unratified output cannot progress.

- [ ] **8.2 Observability & traceability for agentic workflows** — `P2`
  - *Acceptance:* Run lineage, evaluation logs and monitoring metrics available.
  - *CAOS relevance:* CAOS's lineage ledger + orchestrator event log.
  - *Databricks:* **MLflow tracing + UC lineage + job run history** provide end-to-end traceability.

- [ ] **8.3 Deterministic QA gate preserved (a model never grades its own output)** — `P1`
  - *Acceptance:* CP-5 severity gate + fail-closed roll-up ported with tests.
  - *CAOS relevance:* The single highest-consequence rule in CAOS.
  - *Databricks:* Runs as a pure step inside the CP-X job; no serving call needed — fastest to validate.

- [ ] **8.4 Disable non-approved signal/feature lanes** — `P3`
  - *Acceptance:* Higher-risk lanes (e.g., news) remain disabled by constraint until approved.
  - *CAOS relevance:* CAOS's `news` signal type disabled by DB CHECK.
  - *Databricks:* Feature flags in app/job config default off; enable per approval.

- [ ] **8.5 Evidence chain traceable end to end** — `P2`
  - *Acceptance:* Every number reaches its source chunk in ≤2 interactions; claim→evidence→chunk→document enforced by schema.
  - *CAOS relevance:* CAOS's structural evidence chain.
  - *Databricks:* Enforced in the Delta/Lakebase schema; UC lineage reinforces provenance.

---

## 9 · Validation, Parity & Cutover

- [ ] **9.1 Golden-master parity run (old vs new engine)** — `P1`
  - *Acceptance:* Same issuer/corpus diffed field-by-field; numeric parity confirmed.
  - *CAOS relevance:* Guards against silent numeric drift during the port.
  - *Databricks:* Run both engines as Jobs against a frozen corpus; diff outputs in a notebook.

- [ ] **9.2 Property & regression tests for numeric-safety guards** — `P2`
  - *Acceptance:* NaN/±inf never slip guards; guarded arithmetic returns None or finite — never raises.
  - *CAOS relevance:* CAOS's recurring numeric-safety bug class (`bool(NaN) is True`).
  - *Databricks:* Property tests run in CI on the pure engine package (no cluster needed).

- [ ] **9.3 Accessibility conformance (keyboard-complete; colour never sole signal)** — `P3`
  - *Acceptance:* Automated a11y checks clean on primary surfaces.
  - *CAOS relevance:* CAOS's WCAG 2.1 AA / colourblind-safe design language.
  - *Databricks:* a11y checks in the frontend CI stage of the bundle pipeline.

- [ ] **9.4 Load / performance test on realistic corpus sizes** — `P3`
  - *Acceptance:* Targets met; no memory-pressure failures.
  - *CAOS relevance:* Large credit agreements + multi-issuer coverage.
  - *Databricks:* Scale test job compute and serving endpoints; monitor via system tables.

- [ ] **9.5 Cutover run-book rehearsed; rollback path defined** — `P2`
  - *Acceptance:* Rehearsed ≥ twice; data-migration classes (migrate / current-only / re-derive / drop) agreed.
  - *CAOS relevance:* CAOS's rebuild-plan migration classification.
  - *Databricks:* Re-derive analytical layer by re-running the engine on the frozen corpus (turns migration into a parity test); records-of-record migrated to Delta.

- [ ] **9.6 User training & documentation delivered** — `P3`
  - *Acceptance:* Onboarding, run-books and responsible-use guidance published.
  - *CAOS relevance:* Analysts/PMs/QA personas need surface-specific guidance.
  - *Databricks:* Publish docs alongside the app; link from the workspace.

---

## Legend & How to Use

| Priority | Meaning |
|---|---|
| **P1 — blocker / step zero** | Must be resolved before any deployment. Covers governance registration and the four hard blockers: identity, model access, data egress, hosting/repo. |
| **P2 — pre-scale** | Resolve before scaling beyond pilot or enabling the autonomous layer. |
| **P3 — carry-forward** | Compliant asset or quality item; port with tests / deliver during hardening. |

**Sequencing.** Section 1 (governance) is *step zero* and runs in parallel with everything. Sections 2–6 are the enabling rebuild. Sections 7–9 harden and validate before cutover.

**Guiding principle — asset vs plumbing.** The deterministic engine, evidence chain, QA gate and security posture are **assets**: port them near-verbatim with their tests. Every **blocker** is a *delivery-mechanism* change — where models are called, who authenticates, where data lives, where code is hosted. On Databricks, the blockers largely dissolve into platform primitives (Apps for hosting, workspace SSO for identity, Mosaic AI Gateway for model access, Unity Catalog for data governance), which is why it is the lowest-friction target for the rebuild.

**Databricks onboarding note.** Provisioning runs through a cloud-readiness questionnaire, an architecture-review approval, and a workspace/catalog request. Design **Unity Catalog-native from day one** (new workspaces are UC-only). Confirm foundation-model and agent-framework availability in your deployment region before committing the agentic layer.
