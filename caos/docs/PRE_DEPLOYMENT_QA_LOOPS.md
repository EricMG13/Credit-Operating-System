# CAOS — Pre-Deployment QA Loops & Playbook Scheduling

> **Purpose:** this document owns **mechanism** — how each "tested regularly"
> claim in [PRE_DEPLOYMENT_PLAN.md](PRE_DEPLOYMENT_PLAN.md) is actually
> enforced. The master plan owns **status** (what's done/open) and cites loop
> IDs (`L1`–`L22`) defined here; it never restates a cadence word without a
> loop ID pointing here. If you're picking up a phase item and its exit gate
> says "loop doc L6," this is where you find out exactly what that means and
> whether it exists yet.

**Historical grounding: 2026-07-11 against `origin/main@313ebac`.** Ground truth that
session: `.github/workflows/ci.yml` triggers on `push: branches: [main]` and
`pull_request` only — **no `schedule:`, no `workflow_dispatch:` anywhere in
the repo's workflow files.** Two pytest markers referenced by the prior
version of the master plan (`golden_e2e`, `corpus_run`) **do not exist** —
`git grep -n "golden_e2e|corpus_run" caos/tests .github caos/server` returns
zero hits. This document is written from that ground truth, not from the
prior plan's aspirational cadence table.

> **2026-07-13 mechanism delta:** `.github/workflows/nightly.yml` now exists
> with both `schedule:` and `workflow_dispatch:` and runs the `golden_e2e`
> marker. `deploy/restore_drill.sh` also exists. Those two loops are updated
> below; other status/count claims from the 2026-07-11 grounding still require
> live re-verification. The master plan's coverage review adds L21/L22 for
> independent availability/host alerting and backup freshness/off-host recovery.

> **2026-07-15 mechanism delta:** **L5 has 4 consecutive green scheduled
> cycles** (2026-07-12 → 2026-07-15, verified via the Actions API) — the
> ≥2-cycle contract is met; L5 is citable at phase exits from today. L1 is
> green on the `origin/main` tip (`0b00b21a`). Runner-tier caveat added from
> the Phase-7 release record: sandboxed controller environments deny the **7
> ClamAV loopback tests** (`PermissionError`) — they pass in CI and on
> unrestricted hosts (this session: 1821/9 with all 7 passing); a sandboxed
> run reporting 1808/9 + 7 errors is an environment gate, not a regression.
> `corpus_run` (L6) remains a work item — the marker still does not exist.

---

## 1. The "tested regularly" contract

- A claim in the master plan that something is "tested regularly" must name
  a loop ID from §2 below.
- **Scheduled loops** (mechanism class `WORK-ITEM` once landed, or any `LIVE`
  loop with a cron) must show **≥2 consecutive green cycles** before a phase
  exit may cite them as satisfied.
- **`MANUAL` loops** must produce a dated artifact (a report file under
  `caos/docs/qa/`) at their named trigger (a phase exit, a specific event).
  No artifact, no credit — "we usually run this" is not evidence.
- **`HANDOVER` loops** are calendar cadences ("quarterly") that only make
  sense with a live production system and an operational owner — they are
  explicitly deferred to the post-transfer support model (master plan H3),
  not run during this program. Do not claim a `HANDOVER` loop's cadence as
  satisfied before transfer.
- No cadence word (nightly/weekly/monthly/quarterly) may appear in the
  master plan without resolving to a row below. If you find one that
  doesn't, that's a doc-drift bug — fix the master plan, not this one.

## 2. Mechanism classes

| Class | Meaning |
|---|---|
| **LIVE** | Exists today, verified this session — cite the exact `ci.yml` job/step. |
| **WORK-ITEM** | Does not exist yet. The owning master-plan item (e.g. `B1`) must create it; the anchor below is where it lands, almost always `.github/workflows/nightly.yml` (new file, §5) or an addition to the existing per-PR `ci.yml`. |
| **MANUAL** | A named skill/playbook run at a named trigger (a phase exit, a specific event) — no scheduler, a human or agent session runs it and files the dated artifact. |
| **HANDOVER** | A calendar cadence that only makes sense post-transfer with a live operational owner; named in the H3 support model, not run during this program. |

## 3. Recurring loops L1–L22

| ID | Loop | Mechanism (class) | Cadence | Notes |
|---|---|---|---|---|
| **L1** | CI gate | **LIVE** — `ci.yml`, 9 jobs (frontend lint/tsc/vitest/build; server matrix py3.11+py3.14 w/ pgvector service running ruff/C901-changed/vulture/engine-mypy/pytest server+stress+cohort/perf --selftest/PG worker tests; lock-sync; e2e; image build; shellcheck+compose config; fallow changed-only; corpus-consistency script; security pip-audit/bandit/npm-audit/gitleaks) | per PR + push to `main` | The backbone loop; everything else layers on top. |
| **L2** | Code review | **MANUAL**-convention | per PR | `/code-review` on every PR; `adversarial-reviewer` skill on engine/LLM-lane diffs specifically (it exists — see shortlist doc). |
| **L3** | Blast radius | **MANUAL**-convention (CLAUDE.md-mandated) | per change | GitNexus `impact` before edit, `detect_changes` before commit. Non-negotiable per repo CLAUDE.md. |
| **L4** | Golden-master drift | **LIVE** — runs inside the normal `pytest caos/tests/server` collection in the CI server job (`caos/tests/server/golden/test_golden_cp1.py`) | per PR + push | No separate marker or schedule needed — it's just part of the suite. The word "nightly" from the prior plan version is dropped here: there is no nightly run of anything today: see L5/L6 for what a real nightly mechanism requires. |
| **L5** | Golden E2E (full-chain, both lanes) | **LIVE** — `.github/workflows/nightly.yml` has scheduled + on-demand triggers and runs `pytest -m golden_e2e` with external model keys blanked | nightly + on demand | Require two consecutive green scheduled cycles before citing it at a phase exit. |
| **L6** | Corpus breadth run | **WORK-ITEM** — owned by master-plan **B5**. Requires: (a) capture fixtures (currently 0 captured against a 61-issuer MANIFEST), (b) register a `corpus_run` marker, (c) full run in `nightly.yml` + a 6-issuer smoke subset added to the existing per-PR server job | nightly (full) + per-PR (smoke subset), once landed | Same "does not run at all today" caveat as L5. |
| **L7** | Concept-link suite (same-number-everywhere) | **WORK-ITEM** — owned by master-plan **C6**. Add the new Playwright spec to the existing per-PR `e2e` job in `ci.yml` (stronger than a nightly-only run — per-PR catches regressions before merge); also include in `nightly.yml`'s full sweep | per PR (+ nightly full via H2) | Spec doesn't exist yet — see C6. |
| **L8** | E2E (Playwright page specs) | **LIVE** — `ci.yml` `e2e` job: static export → `run.py` (SQLite, demo-fallback LLM) → `playwright install chromium` → `npm run test:e2e` (9 specs, `global-setup.ts` auth) | per PR | Full sweep also re-runs inside H2's `workflow_dispatch`. |
| **L9** | Mock regression (prod build greps clean of known mock imports) | **WORK-ITEM** — owned by master-plan **C1/C4**. Add a grep step to the `ci.yml` `frontend` job checking for `ALERTS`/`SIM_PLAN`/`simAlertsToday` etc. in app routes once `MOCK_LEDGER.md` names the exact import list to forbid | per PR, once landed | Grep list depends on C1's inventory output — can't be written before C1 runs. |
| **L10** | Ingestion robustness matrix | **LIVE-partial** — existing D3 tests (0-chunk warning, upload concurrency) already run inside the per-PR server job; completes (same job, no new wiring needed) once D3's full adversarial matrix lands | per PR | |
| **L11** | Accessibility (axe) | **MANUAL** — `design-a11y-ux` playbook (§3 below), `caos/frontend/scripts/a11y-axe.mjs` (real axe, never the regex scanner) against the isolated QA stack | per UI-touching phase exit (primarily C) + H1 | The prior plan's "+ monthly" is dropped — no actor/mechanism runs a monthly a11y sweep; if the owner wants one, it needs a named trigger, which currently doesn't exist. |
| **L12** | Stress / fault injection | **WORK-ITEM** (weekly smoke) — owned by master-plan **E1**. A time-boxed, offline (mock-Anthropic fault injection) smoke profile added to `nightly.yml` with a weekly `schedule:`. **MANUAL** (full harness) — the existing `caos/tests/stress/` locust run at phase exits E/G/H, run by hand until L12's weekly smoke exists | weekly (once landed) + phase exits (manual) | The harness has never been run at all as of this grounding — E1 closes that first. |
| **L13** | Perf smoke | **LIVE** — `ci.yml` server job runs `smoke.py --selftest` and the two `caos/tests/server/bench` dirs (rerank/graph-expansion gates) per PR. Full latency/load/fault-injection legs (performance playbook §4 B/C/D) are **MANUAL** at phase exits, needing the isolated QA stack | per PR (selftest, live) + per phase exit (full, manual) + per deploy (LAUNCH_PHASE1 §5 runbook step) | |
| **L14** | Dependency triage | External mechanism (dependabot opens PRs on its own schedule) + **MANUAL** gate rule: "no dependabot PR open >14 days at any phase exit without a recorded decision" | dependabot-driven + phase-exit check | 12 open as of this grounding (master-plan A5) — the rule isn't met today. |
| **L15** | Tracker sweep | **MANUAL** — walk `FEATURE_TRACKER.csv` + `AUDIT.md` against code | per phase exit | Pattern established in A7/A7b. |
| **L16** | Confidence audit | **MANUAL practice** (not a skill — `confidence-review` does not exist as an installed skill; this is a fresh-context audit thread using `/code-review high` + `adversarial-reviewer` + independent verifier agents, the pattern behind `caos/docs/qa/reports/confidence-audit-2026-07-11.md`) | per phase exit | The prior plan's "+ monthly" is dropped for the same reason as L11 — no monthly actor exists. |
| **L17** | Goal audit | **MANUAL** — code-grounded whole-system audit (the pattern behind `AUDIT.md`'s reconciliation passes) | per phase exit | |
| **L18** | Security review | **LIVE** (per-PR subset) — `ci.yml` `security` job: `pip-audit==2.7.3`, `bandit==1.7.10`, `npm audit --audit-level=high`, `gitleaks v8.18.4`. **MANUAL** (full `/security-review`) at E exit + H1. `security-review.yml` (the Claude-powered PR review workflow) is **dormant** without a `CLAUDE_API_KEY` secret configured — confirm whether it's wired before relying on it. **HANDOVER**: quarterly cadence deferred to the H3 support model, post-transfer only | per PR (live subset) + E exit/H1 (manual) + quarterly (post-transfer) | |
| **L19** | Restore drill | **MANUAL** scripted — `deploy/restore_drill.sh`, run at G exit + H1. **HANDOVER**: quarterly cadence deferred to H3, post-transfer only | G exit + H1 (manual) + quarterly (post-transfer) | Script existence is proven; G8 separately requires a restore from the configured off-host copy at realistic volume. |
| **L20** | Gap-log triage | **MANUAL**, named owner (the analyst cohort session) | weekly, **during Phase F only** | The one legitimate calendar-style loop in this program — it's bounded to F's duration and has a real weekly actor (the beta cohort), unlike the dropped "monthly"/"quarterly" claims elsewhere. F's exit gate requires dated triage notes. |
| **L21** | Independent availability and host alerting | **WORK-ITEM** — owned by master-plan **G7**. External ingress/liveness + certificate/DNS and management-plane container/DB/queue/resource probes; notification path must not depend on CAOS | continuous once configured; failure-injection at G/H exits | Store sanitized monitor configuration, alert-delivery evidence, thresholds, owner, and acknowledgement/escalation test in the H3 package. |
| **L22** | Backup freshness and off-host recovery | **WORK-ITEM** — owned by master-plan **G8**. Observe local backup success, off-host sync success/age, retention, and failure delivery; pair with L19 restore | each backup cycle; remote-only restore at G/H exits | An optional hook or local artifact is not a green loop. The configured target must alert when stale and the H gate must restore after local-copy loss. |

## 4. Runner infrastructure tiers

Every `MANUAL` and `WORK-ITEM` loop needs one of these environments. Sessions
picking up a loop should check which tier they have before attempting it —
this container (as of this grounding) has **no Docker daemon**, so the
Docker-dependent tiers degrade to "attempt, and if it fails, cite the last
dated artifact and mark the claim environment-limited," per the plan's own
grounding doctrine.

| Tier | What it needs | Playbooks/loops that need it |
|---|---|---|
| venv-only, offline | `caos/server/.venv311` built from hashed `requirements.lock` + `requirements-dev.txt`; conftest force-blanks `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/`OPENROUTER_API_KEY` | `engine-correctness`, `llm-safety-grounding`, `code-health-methodology` playbooks; L4, L15, L16, L17 |
| venv + Docker-pg leg | Above, plus a running `pgvector/pgvector:pg18` container for the Postgres-only worker/reaper/claim tests (2 tests skip without it — confirmed this session) | `backend-api-data` playbook; the CI `server` job's Postgres step |
| QA stack (isolated ports :8010/:3010) + Playwright | Built frontend static export + `run.py` server + Chromium (present at `/opt/pw-browsers` in this container) | `performance` playbook legs B/C/D, `design-a11y-ux` playbook, `frontend-functional` playbook's e2e leg |
| Static export + server | `npm run build` (static export) + `run.py` serving it | `ci.yml`'s `e2e` job (L8); H2's full sweep |

## 5. Nightly automation — live shell, incremental jobs

**`.github/workflows/nightly.yml` now exists** with both `schedule:` and
`workflow_dispatch:` triggers. The `golden_e2e` job is live. Add the remaining
jobs only with the master-plan item that creates its prerequisite:

- `pytest -m golden_e2e` (owned by **B1**) — full-chain golden test, both
  lanes, all 3 issuers.
- `pytest -m corpus_run` (owned by **B5**) — full breadth-corpus run, once
  fixtures are captured; shard if the runtime cap (~5 min target) is blown.
- Full concept-link + e2e sweep (owned by **C6**), in addition to the
  per-PR subset that already runs.
- Weekly-cadence stress smoke profile (owned by **E1**), time-boxed,
  offline mock-Anthropic fault injection — not the full locust harness,
  which stays manual at phase exits.

**H2 reuses this same `workflow_dispatch:` trigger** for its "one CI
dispatch, results archived" full regression sweep at the pre-deployment
gate — no second workflow file needed.

Do not add jobs speculatively ahead of their owning items — each job lands
with the master-plan item that makes it meaningful (a scheduled
run of a test that doesn't exist yet is not useful). The file may be created
incrementally, one job per landed item, rather than all at once.

---

## 6. Playbook → home / cadence / gate mapping

All 9 playbooks live at `caos/docs/qa/playbooks/` and are confirmed present.
Each was last run 2026-07-10 (one day behind the `6bf73a1` grounding SHA;
re-check freshness against whatever HEAD you're executing against). Every
playbook is report-only (audit, never fix) and carries its own §6
accepted-risk register and a mandatory adversarial "refute-first"
verification step before any FAIL.

| Playbook | Home (master-plan item) | Cadence | Consuming gate | Mechanism / runner tier | Artifact path |
|---|---|---|---|---|---|
| `engine-correctness.md` | Phase B (B1/B2/B4/B5 operationalize its invariants A–H) | At B exit; re-run at C/E/H exits if `caos/server/engine/` changed | B exit | MANUAL, venv-only offline. Automated subsets: golden drift per-PR (L4), full-chain nightly once landed (L5/L6) | `caos/docs/qa/ENGINE_CORRECTNESS_<date>.md` |
| `llm-safety-grounding.md` | Phase C (C3-seam's new autonomy-driven alert surface) + E5 | At C exit and E exit; per-PR for any new LLM-lane diff | C exit, E exit | MANUAL, venv-only offline | `caos/docs/qa/reports/llm-safety-grounding-<date>.md` |
| `code-health-methodology.md` | Phase A (hygiene baseline) | Automated changed-only leg per-PR (`fallow dead-code`/`dupes --changed-since`, part of L1's CI gate — LIVE); full manual sweep per phase exit | Every phase exit: no new CRIT vs. the `fallow-baseline.json` baseline | LIVE (per-PR changed-only) + MANUAL (full sweep) | `caos/docs/qa/playbooks/reports/code-health-<date>.md` |
| `backend-api-data.md` | Phase E (E1/E3) | At E exit; Postgres-leg re-run at H1 on the prod-parity host | E exit, H1 | MANUAL, venv + Docker-pg leg (this container: 2 tests skip without Docker — degrade and note it) | `caos/docs/qa/audits/backend-api-data-<date>.md` |
| `frontend-functional.md` | Phase C (C2/C4/C6, Monitor inbox once C3-seam lands) | At C exit; mid-F (beta feedback informs it); full sweep at H2 | C exit, H2 | MANUAL; automated e2e subset per-PR is LIVE (L8) | `caos/docs/qa/reports/frontend-functional-<date>.md` |
| `design-a11y-ux.md` | Phase C exit criterion ("axe clean on changed routes") | Per UI-touching phase exit (primarily C, revisited in F) + H1 | C exit, H1 | MANUAL, QA stack :8010/:3010 + `a11y-axe.mjs` — never the regex scanner (memory: false positives) | `caos/docs/qa/reports/design-a11y-ux-<date>.md` + axe JSON |
| `performance.md` | Phase G (G3 load characterization) | Legs B/C/D (live latency, load, fault injection) at G exit + H1; automated subsets: `--selftest` per-PR (LIVE, L13), full smoke per deploy (LAUNCH_PHASE1 §5) | G exit, H1 | MANUAL for B/C/D (QA stack), LIVE for selftest | `caos/docs/qa/perf/PERF_AUDIT_<date>.md` |
| `security-infra.md` | Phase E (E5) | At E exit + H1; automated subset per-PR (L18 LIVE: pip-audit/bandit/npm-audit/gitleaks) | E exit, H1 | MANUAL + LIVE subset. Note: `security-review.yml` is dormant without a `CLAUDE_API_KEY` secret — confirm before assuming it runs | `caos/docs/qa/audits/security-infra-<date>.md` |
| `integration-seams.md` | Phase C — **the mandatory pickup input for both C3-seam and C5's implementation plans** — plus C exit and H4 | At C3-seam/C5 plan pickup; C exit; H4 activation-package review | C exit, H4 | MANUAL, run via `.claude/workflows/caos-review-sweep.js` with `args: {plan: 'seam'}` | `caos/docs/qa/REVIEW_MATRIX_SEAMS.md` |

Every row above appears twice in the doc set on purpose: once here
(mechanism), once as a named line inside its owning phase's exit gate in the
master plan. That satisfies the requirement that each playbook have a
concrete home, cadence, and gate — not a vague reference.
