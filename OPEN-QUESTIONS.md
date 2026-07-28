# OPEN-QUESTIONS.md — Assumptions & Ambiguities Requiring Owner Input

Protocol: the implementation model MUST NOT resolve these unilaterally. Each entry
states the question, the working assumption currently baked into the specs (if any),
and what changes if the owner answers differently. New questions are appended by
anyone (spec author or implementation model) the moment an ambiguity is found;
implementation on an affected item stops until the entry is answered. Answered
entries move to §Resolved with the decision and date.

Status: `OPEN` · `RESOLVED(date)`.

---

## Q-001 — Interpretation of "Exclude modules with similar functions within legacy application" — OPEN

**Context.** Owner instruction delivered with the corpus upload (2026-07-28): *"Review
attachment before re-tuning initial prompt. Exclude modules with similar functions
within legacy application."*

**Working assumption (baked into `architecture/DECISIONS.md` table B).** Where a
DEPLOY_B corpus entry's function is already implemented by a legacy CAOS application
component that the rebuild ports (deterministic engine module, ingestion pipeline,
orchestrator, email lane, QA gate, workbook export), the corpus entry is **excluded as
a separate runtime skill**. Its *contract* (payload schema, gates, envelope fields) is
still extracted into `dbx/contracts/` — the rebuilt application component must satisfy
it — but no parallel prompt-driven skill implementation is built, so no function is
implemented twice. Corpus entries with **no** legacy equivalent (e.g. CP-2H, CP-4C,
CP-8, ai-assurance-auditor) are carried per their DECISIONS.md row.

**If the intended reading differs** (e.g. "drop overlapping corpus modules entirely,
contracts included" or "exclude the *legacy* implementation and prefer the corpus
skill"), DECISIONS.md table B and the Phase 3/6 scopes change; flag before Phase 3.

## Q-002 — Where the enterprise repo will live (checklist 5.1) — OPEN

**Question.** Which enterprise Git organisation/URL will host the repo, and when is
the personal repo (`EricMG13/Credit-Operating-System`) scrubbed or archived?

**Working assumption.** The rebuild proceeds in this repository under `dbx/` (so the
golden-master parity harness can import the legacy engine in-process); the whole repo
migrates to the enterprise org as a single 5.1 action, tracked in ROADMAP Phase 2 as
an org-side dependency. The vendored methodology corpus (`corpus/`) and `Modular OS/`
migrate with it. No spec depends on the final org URL.

## Q-003 — Databricks workspace facts needed before Phase 2 — OPEN

**Question.** (a) Workspace URL(s) and region; (b) confirmation that Claude and
Gemini external-model endpoints (Mosaic AI Gateway) are available in that region per
the checklist's onboarding note; (c) the Unity Catalog catalog/schema names granted to
this use case; (d) the enterprise IdP group names to map to `analyst / viewer / qa /
admin`; (e) whether Lakebase is enabled in the workspace tier.

**Working assumption.** Specs use placeholder identifiers `{{WORKSPACE_HOST}}`,
`{{CATALOG}}` (default `caos`), schemas `oltp` / `bronze` / `silver` / `gold`, and
group placeholders `{{GROUP_ANALYST}}` etc., all defined once in
`dbx/config/environments.md`. Phase 2 cannot deploy until real values are supplied;
Phase 1 is unaffected (CI-pure).

## Q-004 — Frozen parity corpus selection (checklist 9.1) — OPEN

**Question.** Which issuers form the frozen golden-master corpus? The audit found the
legacy fixture/demo corpus is the only committed corpus. Proposed: the committed
fixture issuers plus 2–3 real anonymised issuer packs chosen by the owner (one
covenant-heavy, one with a finance-subsidiary perimeter split, one distressed/LME).

**Working assumption.** Phase 1 freezes the committed legacy fixture corpus
(hash-manifested) as `dbx/parity/corpus/`; owner-selected real packs are added before
Phase 3 sign-off. Parity thresholds: numeric fields exact to 1e-9 relative tolerance
unless a field is documented as non-deterministic (none known in the deterministic
lanes).

## Q-005 — Vendor mail data approval path (checklist 4.4) — OPEN

**Question.** Which vendor/mail sources are approved by the data-governance workflow
for landing as Delta tables, and under which licence terms? The legacy live M365
Graph sync is removed; Phase 6's email lane needs at least one approved source (or
sanctioned sanitised samples) to be useful.

**Working assumption.** The audit (`audit/AUDIT-2026-07-28.md` §8.4.1) found **no
legacy mail-sync or `CreditFact` code** — the lane is greenfield. Phase 6 builds
against sanitised sample data shaped by the corpus CP-EMAIL classification
methodology (`REF_CP-EMAIL_SourceRoutingMatrix.md` tiers/classes) and the legacy
`alert_sinks.EmailSink` intent contract; enabling a real source is a config +
approval action, not a code change.

## Q-006 — Disposition of legacy off-estate artefacts at cutover — OPEN

**Question.** Confirm the decommission list: rclone remote contents, Obsidian vault
export, the self-hosted Postgres instance, and the personal Google OAuth client are
all destroyed/rotated at cutover (checklist 9.5 rollback still possible until then).

**Working assumption.** ROADMAP Phase 7 includes a decommission checklist; nothing in
the rebuild reads from or writes to those targets from Phase 1 onward.

## Q-007 — `Modular OS/` (27-module legacy prompt corpus) vs `DEPLOY_B_COWORK_SKILLS` (36-entry corpus) — OPEN

**Question.** The task designates DEPLOY_B as normative for the rebuilt engine's
contracts. The legacy app's prompts derive from `Modular OS/`. Where the two corpora
disagree on module semantics (e.g. retired CP-MON vs new CP-EMAIL; CP-SR superseded by
CP-DR), the specs follow DEPLOY_B and log the divergence in DEVIATIONS.md when it
changes engine behaviour vs legacy. Confirm DEPLOY_B precedence is intended even where
it breaks numeric parity with a legacy module (expected only in LLM-lane prompts, not
deterministic lanes).

**Working assumption.** DEPLOY_B wins for contracts and orchestration semantics;
legacy wins for deterministic numeric behaviour (checklist 9.1) unless a DEVIATIONS.md
row says otherwise.

## Q-008 — New dependencies proposed by Phase 1 — OPEN

Per the handoff rules, new dependencies are logged here before use. Phase 1 proposes
(exact list in `specs/phase-01-foundation.md` §6.1): `pydantic>=2,<3` (typed
contracts, MIT); dev-only: `pytest` (MIT), `hypothesis` (MPL-2.0 — file-level
copyleft only, standard for property testing, never shipped), `ruff` (MIT), `mypy`
(MIT), `psycopg[binary]` (LGPL-3.0 **with linking exception** — dev-only, used solely
by schema tests against the CI Postgres container; not a runtime dependency). Tooling:
`uv` (Apache-2.0/MIT, not a package dependency). Approve or substitute before Phase 1
implementation; if LGPL-with-exception dev tooling is nonetheless disallowed by
policy, substitute `pg8000` (BSD) — the schema tests use plain DB-API only.

## Q-009 — File-count discrepancy vs checklist §5.3 — OPEN (informational)

Checklist 5.3 cites "476 Python files + 618 TS/TSX files". Measured on 2026-07-28 at
commit `341d14b`: 547 Python / 556 TS+TSX (excluding `node_modules`, `.venv*`,
`.git`). Treated as a point-in-time drift of the checklist snapshot, not a blocker;
SAST/SCA scopes in Phase 2 use the measured tree, not the quoted counts.

## Q-010 — Day-count conventions (audit EC-18) — OPEN

**Question.** Legacy interest/coverage/PIK math uses flat `months/12` annualization;
no day-count convention (30/360, ACT/360, ACT/365) exists anywhere (audit §3 F-15).
Parity (9.1) requires the rebuild to reproduce the flat behaviour. Does the owner
want real day-count support added post-parity (a logged deviation with its own test
suite), or is flat annualization formally accepted for this tool's purpose?

**Working assumption.** Flat annualization is pinned in the parity corpus and
documented as accepted; no day-count work is scheduled unless the owner opts in.

## Q-011 — Sensitivity model for 4.5/4.6 (new construction) — OPEN

**Question.** The audit (§8.4.2) found no legacy sensitivity labels or durable read
audit. The rebuild builds these on UC. Confirm the label taxonomy (proposed:
`public / internal / confidential / restricted` per checklist 4.1) and which domains
get read-time app-side enforcement in addition to UC ABAC (proposed: email/fact
tables and any vendor-licensed data; issuer filings remain `internal`).

**Working assumption.** Phase 6 implements the four-label taxonomy, ABAC masking on
email/fact tables, UC audit logs as the read trail, plus app-side read checks with a
durable `read_audit` table only for the email/fact domain (highest sensitivity).

---

## Resolved

*(none yet)*
