# ROADMAP.md — Phased Rebuild (CAOS → Databricks)

Sequencing rules applied: the four **P1 blockers** (identity 2.1, model access 3.1,
data egress 4.2–4.4, hosting/repo 5.1+6.1) are retired at the earliest possible
phase; the **CP-5 deterministic gate** — the checklist's fastest-to-validate,
highest-consequence asset (8.3) — is validated in **Phase 1** before any platform
work can put it at risk. Checklist **Section 1 (Governance) is explicitly out of
scope here** — it runs as a parallel step-zero track; nothing below depends on its
artifacts except final production sign-off.

Phase dependency graph (strict execution order; org-side actions run in parallel):

```
P0 (seed) ──► P1 ──► P2 ──► P3 ──► P4 ──► P5 ──► P6 ──► P7
                      ▲
                      └── org-side (5.4 tollgates): parallel from day one
```

**P0 — Repo bootstrap (one-time, before Phase 1).** Create `{{NEW_REPO}}` (owner
decision Q-002R; name/org = Q-012, enterprise org recommended so 5.1 is satisfied at
creation) and seed it per `architecture/ARCHITECTURE.md` §3.1: spec set + `corpus/` +
`dbx/parity/corpus/` (frozen fixtures, recorded goldens, kernel vectors, registry
snapshot, `MANIFEST.sha256`, `SEED_SOURCE.txt`). After seeding, no phase needs the
legacy repository present.

A phase is **done** only when its spec's Done-When criteria are green
(`specs/phase-NN-*.md`; Phase 1 is fully specified, later phases follow
`specs/SPEC-TEMPLATE.md`). Rule for every phase: no spec, no build.

---

## Phase 1 — Core Foundation & Data Layer (CI-pure; no workspace needed)

**Objective.** Stand up the typed contracts, the pure engine kernel with the CP-5A
gate ported and proven, the schema DDL, the vendored-validator conformance suite, and
the golden-master parity harness over the frozen fixture corpus — all running in
plain CI with no cluster.

**Scope.** `dbx/` scaffold; `caos_contracts` (enums, envelope, payloads, filename,
markdown round-trip); `caos_engine` kernel (`guards`, `periods`, `registry` with
canonical IDs, `gate` = legacy `gate.py` ported, `lineage` port); Lakebase + Delta
DDL files; `parity/` harness + `alias_map` + frozen corpus freeze; `tools/`
conformance suite; `FixtureGatewayClient` stub. Full detail:
`specs/phase-01-foundation.md`.

**Out of scope.** Any Databricks deployment; any LLM call; module synthesizer ports
beyond the kernel; the FastAPI app; the frontend.

**Input dependencies.** P0 seeding complete: `corpus/DEPLOY_B_COWORK_SKILLS/`
(verified against `DEPLOY_B_PROFILE_MANIFEST.json` hashes) and `dbx/parity/corpus/`
(frozen fixtures + recorded goldens + kernel vectors + registry snapshot) present
with `MANIFEST.sha256` green; `audit/AUDIT-2026-07-28.md` EC table.

**Key contracts.** ARCHITECTURE §7.1–§7.3 (implemented this phase, verbatim).

**Verification (executable).**
- `uv run pytest dbx/tests -q -m "not platform"` — all green.
- Property tests (hypothesis): NaN/±inf never escape guards; guarded arithmetic
  returns None/finite, never raises (9.2, audit EC-01…EC-06).
- Gate honesty triple ported: pristine→Passed / injected-error→Restricted /
  dropped-evidence→Blocked (8.3).
- Validator differential: typed validator agrees with `tools/validate_handoff.py` on
  every conformance file (exit codes 0/2/3/4).
- Parity harness green on the frozen fixture corpus for the kernel surface
  (periods/guards/gate roll-up given legacy-recorded findings).
- DDL applies clean to a local Postgres 16+ container; schema round-trip test passes.

**Checklist IDs.** **8.3, 9.2** satisfied; foundations for 8.5 (chain DDL), 6.4
(hash types), 3.6 (fixture client), 3.7 (tier-map schema), 9.1 (harness).

---

## Phase 2 — Platform Spine (retires all four P1 blocker groups)

**Objective.** The governed skeleton exists end-to-end on Databricks: bundle-deployed
App shell behind workspace SSO with the ported chokepoint and role map; AI Gateway
endpoints with the `ServingGatewayClient` seam; Lakebase provisioned with the Phase-1
DDL; CI carrying SCA/SAST gates. After this phase, no personal-estate mechanism
remains in the target architecture.

**Scope.** `databricks.yml` bundle (targets dev/staging/prod) + `infra/` Terraform
(catalog `{{CATALOG}}`, schemas, volumes, SPNs, grants); Lakebase instance + DDL
migration runner; external-model endpoints `caos-heavy|light|extract|embed` with AI
Gateway config (payload logging → inference tables, per-endpoint rate limits);
`caos_gateway.ServingGatewayClient` passing the seam contract tests against a mock +
one platform smoke test; App shell (`caos_server`): health, identity resolution from
workspace SSO context, workspace-group→role map (fail-closed to `viewer`),
consolidated ASGI chokepoint, security headers/CSP skeleton, docs closed (7.5), boot
guards reading the secret scope (6.5); CI: uv/npm lockfiles + SCA licence gate
(BUSL exclusion assertion) + SAST + secret-log-hygiene test.

**Out of scope.** Engine modules on the platform; any workbench surface beyond a
signed-in shell page; intake; email.

**Input dependencies.** Phase 1 green; workspace provisioned via the Azure
onboarding pipeline (Cloud Readiness Questionnaire → architecture review → intake
form, region stated explicitly — ARCHITECTURE §9); **Q-013 residual values
supplied** (workspace URL, SCIM group names + SPs, Lakebase regional confirmation,
shared-endpoint inventory). 5.1 is already satisfied if `{{NEW_REPO}}` was created
in the enterprise org at P0 (Q-012).

**Key contracts.** ARCHITECTURE §7.4 (gateway), §8 (identity chain), §9 (config).
Stub: `resolve_role(groups: frozenset[str]) -> Role` (fail-closed), pinned by
`tests/platform/test_app_auth.py` and CI-pure unit tests with recorded headers.

**Verification (executable).**
- `databricks bundle validate` green for all targets; `bundle deploy -t dev` green.
- Platform smoke (`-m platform`): App responds 200 authenticated / 401+403 paths;
  chokepoint rejects forged identity headers; role map maps the four groups; gateway
  seam round-trips one call per lane against dev endpoints and writes
  `llm_call_records` + appears in inference tables (3.4).
- Boot-guard test matrix: missing secret / weak secret / demo-seed → refuse start.
- CI shows SCA (licence inventory incl. "no BUSL in dbx tree"), SAST, secret-hygiene
  jobs required-green.
- Negative egress test: `caos_gateway` refuses when egress flag off; grep-gate proves
  no vendor SDK import anywhere under `dbx/` (3.1).

**Checklist IDs.** **2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.4, 5.2, 5.3, 5.5, 6.1
(shell), 6.2, 6.5, 7.5** satisfied in the target; **4.3 satisfied by construction**
(no rclone/vault-export code exists in `dbx/`; physical decommission of the legacy
estate is P7); **5.1, 5.4 tracked** as org-side actions with acceptance recorded
here when done.

---

## Phase 3 — Engine Port & Orchestration (parity + the CP-X DAG)

**Objective.** All legacy-implemented analytical modules run under canonical IDs on
Databricks Workflows with the full wrapper protocol (halt-check, Upstream Re-Anchor
Gate, limitation propagation, stop-on-Blocked, deterministic CP-5→CP-5A tail), and
the golden-master parity suite is green field-by-field on the frozen corpus.

**Scope.** Port the 21 implemented modules + CP-X planner + CP-5/CP-5A tail + CP-5C
council (flagged) + Model Engine v2 as CP-2G + budget/presets/llm-safety;
`caos_orchestration` (task wrapper, pathway definitions for all 8 pathways, finalize
task, `pipeline_runs` event log); Workflows job definitions in the bundle; envelope
persist + `validate_handoff` enforcement at persist time; `Run` fingerprint
(`model_id`/`prompt_version`/`model_mode`) recorded from `tiers.yml`.

**Out of scope.** Live document intake (fixture corpus only); workbench surfaces;
the four CONTRACT+NEW modules (P6).

**Input dependencies.** Phase 2 green. The frozen parity corpus is final per
**Q-004R** (committed legacy fixture corpus: goldens + 28-issuer EDGAR facts + ATLF
reference deal; no additional owner packs) — parity closes on it.

**Key contracts.** ARCHITECTURE §6 (wrapper protocol), §7.3/§7.5. Legacy prompts
ported unchanged (DECISIONS Table B note 1).

**Verification (executable).**
- Parity: `uv run pytest dbx/tests/parity -q` — every module's payload numerically
  identical to legacy on the frozen corpus via the alias map (9.1; tolerance 1e-9
  relative; any intended difference has a DEVIATIONS row cited in the test).
- Orchestration integration (dev workspace): Pathway-3 (earnings) and Pathway-2
  (covenant) runs complete; **Blocked-at-CP-0 run halts the whole pathway** with
  `halt_reason` set and zero downstream module rows (corpus Test B5 semantics);
  limitation flags from a degraded CP-1 appear on every downstream consumer's
  envelope.
- Every persisted envelope passes `tools/validate_handoff.py` (exit 0 or 3 —
  never 2/4) — enforced in the wrapper and re-checked in CI.
- Budget: forced re-claim test proves cumulative per-run billing (legacy H-1).
- Run fingerprint recorded and echoed in run detail API.

**Checklist IDs.** **3.3, 3.6, 3.7, 6.3, 8.1 (job-level gating), 8.2, 9.1**
satisfied.

---

## Phase 4 — Intake, Evidence Chain & Retrieval

**Objective.** Real documents flow: quarantine upload → scan-first gates → bounded
parse → chunks/embeddings → retrieval; the evidence chain is live end-to-end on real
uploads, and classification + egress enforcement operate on the real corpus.

**Scope.** Upload route (streams to quarantine Volume); intake Workflows job
(ClamAV → magic-byte → OOXML gate → `parse_bounded` child sandbox → ceilings →
chunk → embed via `caos-embed` → promote to vault + `documents`/`document_chunks`
rows); EDGAR fetch job; retrieval port (BM25 tsvector + pgvector RRF; caps emit
limitation flags); data-classification inventory (4.1) recorded as UC tags; egress
predicate live on real content (4.2); structure-aware chunking **behind a flag,
default off** (parity first — audit F-9).

**Out of scope.** Email/vendor landing (P6); PII masking policies (P6); workbench
upload UI polish (P5 basic upload only).

**Input dependencies.** Phase 3 green (runs consume real chunks); ClamAV container
image approved for the job environment (D-DBX-002).

**Verification (executable).**
- Gate tests ported with exact ceilings (EICAR-class fixture → 422; scanner down →
  503 + upload lane refuses; spoofed extension → 400; macro workbook → refused;
  oversized/page/char/timeout ceilings enforced; per-issuer caps 409/413).
- Scan-first ordering asserted on **all** lanes incl. PDF (fixes audit finding).
- Evidence chain: an uploaded real PDF produces run output where every `MetricFact`
  resolves chunk + document in ≤2 FK hops (8.5 structural test).
- Retrieval parity spot-checks vs legacy BM25 behaviour on the frozen corpus.

**Checklist IDs.** **4.1, 4.2, 7.1, 7.2, 7.3, 8.5** satisfied.

---

## Phase 5 — Analyst Workbench (Vite port, contract-first)

**Objective.** The 15-destination workbench runs as the App's SPA with the preserved
design language, generated API types, ratification flows, and the a11y gate green.

**Scope.** Vite + React port (design tokens single-sourced; `.tabular`; Panel;
reduced-motion; paper mode); router shim for the 22 `next/navigation` consumers;
generated OpenAPI client + CI drift gate (5.6) with legacy interceptor semantics;
surfaces in complexity-first order: Pipeline, Deep-Dive, Model Builder, Report
Studio (immutable versions verify-on-read UI), Query/Ask, Monitor, Command Center,
then secondary; Evidence Sync; ratification UI (`draft→ratified→published`,
approval-gated publish — 8.1 end-to-end); app-lane rate limits (7.4); fixture-mode
provenance visible everywhere (F-10); a11y runner re-pointed (18-route matrix,
layout audits verbatim).

**Out of scope.** New-module UIs (P6); performance tuning beyond budget checks (P7).

**Input dependencies.** Phase 4 green (real data to render); design-token extraction
from legacy `globals.css` (mechanical, spec'd in the phase spec).

**Verification (executable).**
- `npm run build` + drift gate: regenerated client == committed client.
- Vitest suites ported for each surface (tests-first on Monitor/Pipeline/Upload —
  audit F-13); Playwright flows for the 6 core journeys against the dev App.
- `node dbx/frontend/scripts/a11y-axe.mjs` — zero violations, zero scan errors,
  zero layout failures on the route matrix (9.3).
- Publish without ratification → 409 surfaced in UI (8.1); unknown status renders
  attention-state, never success (closed-vocabulary UI test).

**Checklist IDs.** **5.6, 6.1 (complete), 6.4 (Report Studio live), 7.4, 8.1
(end-to-end), 9.3** satisfied.

---

## Phase 6 — Monitoring, Erasure & New Modules

*(Scope reduced by owner decisions 2026-07-28: CP-EMAIL removed entirely — Q-005R /
D-LEG-006; app-side sensitivity/PII enforcement not built — Q-011R / D-DBX-003;
CP-MODEL/CP-SNAP corpus binding dropped — Q-001R.)*

**Objective.** The monitoring lane runs on platform schedules with the `news`
kill-switch carried, GDPR erasure works across both stores, gateway guardrails are
tuned, and the three CONTRACT+NEW modules ship behind flags.

**Scope.** Monitoring lane on Workflows schedules (C3 watch-rule evaluation +
dispatch via the ported intent contract) with the `news` kill-switch DB constraint
carried (8.4); erase job spanning Lakebase + Delta with `VACUUM`, redaction sweeps
WHERE-scoped (4.7); AI Gateway guardrails tuned per endpoint (3.5); new modules
CP-2H, CP-3D, CP-4C (distress-gated), each with corpus-contract conformance +
fixture tests; CP-DR adaptation of the deep-research lane (plan-approval fields,
coverage/stop-reason enums, domain allowlist).

**Out of scope.** Any email-intelligence lane or mail landing (owner-removed;
reinstating requires a new reviewed spec through the data-governance workflow);
app-side sensitivity labels/masking/`read_audit` (owner-deferred).

**Input dependencies.** Phase 5 green.

**Verification (executable).**
- Monitoring: scheduled evaluation fires on the platform scheduler; `news` rules
  cannot be enabled (DB CHECK test); alert-state lattice + idempotent delivery
  intents pass ported tests (8.4).
- Erase drill: seeded analyst fully erased/anonymized across Lakebase + Delta;
  redaction sweep WHERE-scoped (audit fix) — row-count assertions (4.7).
- New modules: `validate_handoff.py` green on their envelopes; CP-4C returns
  `Not Applicable` without a sourced distress gate; CP-2H refuses shadow-rating
  output (contract test); CP-3D consumes timestamped market data only.
- CP-DR: envelope passes the validator's CP-DR profile (plan hash, coverage,
  stop-reason cross-rules); web search restricted to the configured domain
  allowlist.

**Checklist IDs.** **3.5, 4.7, 8.4** satisfied.

---

## Phase 7 — Hardening, Cutover & Decommission

**Objective.** Production posture proven: DR, load, rehearsed cutover with rollback,
documentation/training, support model — then legacy estate decommissioned.

**Scope.** Lakebase/Delta backup posture + **cold restore drill** (rotation-after-
verified-artifact lesson) (6.6); load/perf against realistic corpus sizes with the
legacy budgets as floors (issuer-probe p95 ≤ 500 ms; upload/report lanes bounded)
(9.4); cutover run-book rehearsed ≥2× incl. rollback, executing the migration
classes below (9.5); run-books, onboarding, responsible-use docs published in-
workspace (9.6); 24×7 support + exit strategy documented (`bundle destroy` teardown
verified in a scratch workspace) (6.7); final full parity run as the cutover gate
(9.1 re-asserted); decommission checklist: rclone remote destroyed, Obsidian export
deleted, personal OAuth client revoked, self-hosted stack retired, personal repo
scrubbed/archived (completes 4.3/5.1 physically — Q-006).

**Verification (executable).** Restore-from-cold drill succeeds and is timed;
`locust`-ported load suites meet budgets; two dated rehearsal records with rollback
exercised; parity green on cutover snapshot; decommission checklist signed.

**Checklist IDs.** **6.6, 6.7, 9.4, 9.5, 9.6** satisfied; 4.3/5.1 physically
completed.

---

## Migration classes (checklist 9.5) — decided per data domain

| Domain | Class | Note |
|---|---|---|
| Analytical layer: `module_outputs`, `claims`, `evidence_items`, `qa_findings`, `metric_facts`, gold marts | **Re-derive** | Re-run the engine on the frozen corpus + live documents; the diff against legacy **is** the parity test. |
| Raw documents (vault files) | **Migrate** | Copy to UC Volumes content-addressed; hashes verified. |
| `document_chunks`, embeddings | **Re-derive** | Re-chunk/re-embed via governed pipeline (embedding rows get provenance; mock-vector lesson). |
| Issuers, analysts/roles/teams, reporting profiles | **Migrate** | Records of record. |
| Runs history, `report_versions` (+hash verify on load), decisions/votes/committee, thesis versions, `source_manifests` | **Migrate** | Immutable records of record; `document_sha256`/`input_corpus_sha256` re-verified during load. |
| `lineage_edges`, `llm_call_records` | **Migrate** | Append-only audit trail. |
| Watch rules (+versions), alert events/states | **Migrate** | Governed monitoring state; `news` stays constraint-disabled. |
| Watch-rule evaluations, `pipeline_runs`, query overlays/insights/links, analysis contexts, in-flight research jobs | **Current-only** | Operational/derivable state; carry current snapshot only. |
| Obsidian vault mirror, rclone remote contents, SQLite rate-limit store, session state, legacy Alembic history | **Drop** | Destroyed at cutover (Q-006). |

Changes to any row above are logged in `DEVIATIONS.md` §D-MIG.

---

## Traceability matrix — every checklist item 2.1–9.6 → phase

| ID | Item (short) | Priority | Satisfied in | Supporting phases |
|----|---|---|---|---|
| 2.1 | Enterprise SSO replaces Google oauth2-proxy | P1-blocker | **P2** | — |
| 2.2 | RBAC/ABAC via UC + groups | P1 | **P2** | P5 (route coverage gate) |
| 2.3 | Service principals for system access | P1 | **P2** | P3 (job SPs live) |
| 2.4 | Session security & revocation | P2 | **P2** | — |
| 2.5 | Single edge chokepoint | P2 | **P2** | — |
| 3.1 | All model calls via gateway | P1-blocker | **P2** | P3 (all lanes live) |
| 3.2 | Central credentials | P1 | **P2** | — |
| 3.3 | Rate limits/budgets per lane | P2 | **P3** | P2 (endpoint limits) |
| 3.4 | Prompt/completion logging | P1 | **P2** | P3 (`LLMCallRecord`) |
| 3.5 | Guardrails on inputs/outputs | P2 | **P6** | P2 (initial config), P4 (injection hardening port) |
| 3.6 | Deterministic fixture fallback | P3 | **P3** | P1 (fixture client) |
| 3.7 | Tier→model map pinned; run records model id | P3 | **P3** | P1 (schema) |
| 4.1 | Classify data domains | P1 | **P4** | — |
| 4.2 | Only approved classes into prompts | P1-blocker | **P4** | P2 (seam predicate) |
| 4.3 | Remove uncontrolled egress | P1-blocker | **P2** (by construction) | P7 (physical decommission) |
| 4.4 | Governed external/mail ingestion | P1-blocker | **P2** (satisfied by total absence — no uncontrolled sync exists, and no mail lane is built at all; audit §8.4.1 + owner Q-005R) | any future lane = new reviewed spec |
| 4.5 | PII detection/tagging/masking | P2 | **N/A — owner-deferred** (Q-011R, D-DBX-003; UC-native controls only) | — |
| 4.6 | Read-time sensitivity + audited reads | P2 | **N/A — owner-deferred** (Q-011R, D-DBX-003; audit §8.4.2: legacy had neither) | — |
| 4.7 | Erasure capability | P2 | **P6** | — |
| 5.1 | Enterprise source control | P1-blocker | **P0** (`{{NEW_REPO}}` created in the enterprise org — Q-002R/Q-012) | P7 (legacy personal repo scrubbed) |
| 5.2 | SCA every build | P1 | **P2** | — |
| 5.3 | SAST gate | P1 | **P2** | — |
| 5.4 | Enterprise SDLC/tollgates | P1 | **P2** (org action tracked) | — |
| 5.5 | IaC, no drift | P2 | **P2** | — |
| 5.6 | Contract-first API types + drift check | P3 | **P5** | — |
| 6.1 | Sanctioned hosting (Databricks App) | P1-blocker | **P2** (shell) | **P5** (complete) |
| 6.2 | Managed data store (+vector) | P1 | **P2** | — |
| 6.3 | Single governed job runtime | P2 | **P3** | — |
| 6.4 | Immutable/reproducible artifacts | P2 | **P5** | P1 (hash types/DDL) |
| 6.5 | Fail-closed boot | P2 | **P2** | — |
| 6.6 | Backup/DR to enterprise targets | P2 | **P7** | — |
| 6.7 | Support model & exit strategy | P3 | **P7** | — |
| 7.1 | Malware scan on uploads | P1 | **P4** | P2 (boot guard wiring) |
| 7.2 | Magic-byte sniff; OOXML gate | P2 | **P4** | — |
| 7.3 | Bounded parsing ceilings | P2 | **P4** | — |
| 7.4 | Headers/CSP/rate limits | P2 | **P5** | P2 (headers/CSP skeleton) |
| 7.5 | API docs closed in deployed envs | P3 | **P2** | — |
| 8.1 | Non-bypassable human ratification | P1 | **P3** (job gating) | **P5** (UI end-to-end) |
| 8.2 | Agentic observability/traceability | P2 | **P3** | — |
| 8.3 | Deterministic QA gate ported with tests | P1 | **P1** | P3 (in-DAG) |
| 8.4 | Non-approved lanes disabled | P3 | **P6** | P1 (DDL kill-switch) |
| 8.5 | Evidence chain end-to-end | P2 | **P4** | P1 (schema) |
| 9.1 | Golden-master parity | P1 | **P3** | P1 (harness), P7 (cutover gate) |
| 9.2 | Numeric-safety property tests | P2 | **P1** | — |
| 9.3 | Accessibility conformance | P3 | **P5** | — |
| 9.4 | Load/perf test | P3 | **P7** | — |
| 9.5 | Cutover run-book + migration classes | P2 | **P7** | classes decided above |
| 9.6 | Training & docs | P3 | **P7** | — |
