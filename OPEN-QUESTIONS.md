# OPEN-QUESTIONS.md — Assumptions & Ambiguities Requiring Owner Input

Protocol: the implementation model MUST NOT resolve these unilaterally. Each entry
states the question, the working assumption currently baked into the specs (if any),
and what changes if the owner answers differently. New questions are appended by
anyone (spec author or implementation model) the moment an ambiguity is found;
implementation on an affected item stops until the entry is answered. Answered
entries move to §Resolved with the decision and date.

Status: `OPEN` · `RESOLVED(date)`.

---

## Q-012 — New-repo name, org, and creation timing — OPEN

**Context.** Q-002 resolved: the rebuild lives in a **new repository** (owner
decision, 2026-07-28), seeded per `architecture/ARCHITECTURE.md` §3.1.

**Question.** (a) Repository name and owning organisation. (b) Created directly in
the enterprise Git org (recommended — creating it under the personal account would
recreate the exact 5.1 blocker this transfer removes), or interim-personal with a
planned org transfer?

**Working assumption.** Specs use the placeholder `{{NEW_REPO}}`. Until the new repo
exists and is seeded, the spec set lives on branch
`claude/caos-databricks-audit-spec-lv17xq` of the legacy repo and Phase 1 does not
start. Seeding is mechanical and fully scripted (ARCHITECTURE §3.1); no spec content
depends on the final name.

## Q-013 — Workspace concrete values (residual of Q-003) — OPEN

**Context.** Q-003 resolved with the owner's onboarding guidance (2026-07-28):
platform is **Azure Databricks** (workspace URLs of the form
`https://adb-<workspace-id>.<n>.azuredatabricks.net`); workspace creation runs Cloud
Readiness Questionnaire → architecture review → intake form, with the **region
requirement stated explicitly** (gated by Claude/Gemini serving + Agent Framework
availability); model endpoints are created post-workspace (External Model endpoints
per tier behind the AI Gateway; ask Platform Engineering about shared pay-per-token
endpoints before creating new ones); catalogs are requested as
`caos_dev` / `caos_uat` / `caos_prod`; IdP groups come from the Identity Admin's
SCIM-synced set; Lakebase regional availability must be confirmed with Platform
Engineering.

**Question (what Phase 2 still needs, verbatim values).** (a) the provisioned
workspace URL(s); (b) the four SCIM group names mapping to
`analyst / viewer / qa / admin` + the service-principal identifiers; (c) Lakebase
confirmation for the region — **if unavailable**, a `DEVIATIONS.md` D-DBX row must
select the alternative OLTP store (candidate: Azure Database for PostgreSQL Flexible
Server + pgvector, UC-external) before Phase 2 deploys; (d) whether shared
pay-per-token endpoints exist to reuse for any tier.

**Working assumption.** Placeholders `{{WORKSPACE_HOST}}`, `{{GROUP_*}}` remain in
`dbx/config/environments.md`; catalog names are fixed as above and no longer
placeholders. Phase 1 is unaffected (CI-pure).

---

## Resolved

All eleven original questions were answered by the owner on **2026-07-28**. The
decisions below are binding; the spec set has been updated to match (see
`DEVIATIONS.md` D-LEG-006/011, D-DBX-003, and the revised
`architecture/DECISIONS.md` Table B, `roadmap/ROADMAP.md`, and
`specs/phase-01-foundation.md`).

| ID | Question | Decision (owner, 2026-07-28) | Propagated to |
|----|----------|------------------------------|---------------|
| Q-001 | Scope of "exclude modules with similar functions within legacy application" | **Exclusion applies to `cp-model` and `cp-snap` only** — legacy Model Builder and Report Builder (Report Studio) serve the same function. All other corpus entries are carried per DECISIONS Table B; the two workbook exporters are dropped from the rebuild runtime (legacy exporters keep their own `CAOS_MODEL_WORKBOOK_V1`-family contracts). | DECISIONS Table A (model_workbook, report_exports rows) + Table B rows 33–34, legend, notes |
| Q-002 | Where the enterprise repo lives | **Create a new repository for the new application** (not in-repo `dbx/`). Parity switches from in-process legacy import to **recorded goldens** seeded from the legacy repo. Residual: Q-012 (name/org). | ARCHITECTURE §3/§3.1/§10; phase-01 §3/§5/§6.8; CLAUDE.md zones |
| Q-003 | Workspace facts | Resolved as **process + platform facts** (Azure Databricks; onboarding pipeline; per-env catalogs `caos_dev`/`caos_uat`/`caos_prod`; endpoints created post-workspace behind AI Gateway; SCIM groups from Identity Admin; Lakebase to be confirmed). Residual concrete values: Q-013. | ARCHITECTURE §9; ROADMAP P2 inputs |
| Q-004 | Frozen parity corpus | **Spec author chooses:** the committed legacy fixture corpus exactly — `caos/tests/server/golden/**` (incl. VSAT/VMO2 goldens), `caos/tests/server/corpus/**` (28-issuer EDGAR fact fixtures), and the ATLF reference-deal fixtures from `caos/server/engine/fixtures.py` — hash-frozen at seeding. No additional owner packs are required; tolerance 1e-9 relative after exact-equality, enums/None exact. | phase-01 §6.8; ROADMAP P3 inputs |
| Q-005 | Vendor mail approval path | **Remove CP-EMAIL** — no email-intelligence lane is built at all (no mail landing tables, no digest). Checklist 4.4 is satisfied by total absence; any future lane restarts through the data-governance workflow as a new spec. | DECISIONS Table B row 32 (DROP); ROADMAP P6 + matrix 4.4; ARCHITECTURE §5.2; DEVIATIONS D-LEG-006 |
| Q-006 | Decommission list at cutover | **Approved** as listed (rclone remote, Obsidian vault, self-hosted Postgres, personal Google OAuth client). | ROADMAP P7 (unchanged) |
| Q-007 | DEPLOY_B vs `Modular OS/` precedence | **DEPLOY_B wins.** Contracts, orchestration semantics, and LLM-lane methodology source from DEPLOY_B runbooks (prompt refresh is the default, stamped via `prompt_version`); deterministic numeric lanes remain golden-master parity-gated per checklist 9.1. | DEVIATIONS D-LEG-011; DECISIONS Table B note 1 |
| Q-008 | Phase-1 dependencies | **Approved** as listed (`pydantic`; dev-only `pytest`, `hypothesis`, `ruff`, `mypy`, `psycopg[binary]`; `uv` tooling). | phase-01 §6.1 (unchanged) |
| Q-009 | File-count discrepancy vs checklist 5.3 | **Understood** — informational; measured tree governs SAST/SCA scope. | none needed |
| Q-010 | Day-count conventions | **Spec author's recommendation adopted:** flat `months/12` annualization is pinned in parity and formally accepted; no day-count work unless the owner opts in later (would be a logged deviation). | audit EC-18 (unchanged) |
| Q-011 | Sensitivity model for 4.5/4.6 | **Ignore** — no app-side sensitivity labels, ABAC masking design, or `read_audit` table is built. UC-native platform controls (UC audit logs, workspace perms) are the only layer. Checklist 4.5/4.6 recorded as owner-deferred. | DEVIATIONS D-DBX-003; ROADMAP P6 + matrix 4.5/4.6; ARCHITECTURE §5.1/§8 |
