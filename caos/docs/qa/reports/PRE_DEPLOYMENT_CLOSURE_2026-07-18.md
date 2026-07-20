# CAOS — Final Pre-Deployment Closure Audit

> **Superseded for current status:** this is the immutable historical record of
> the 2026-07-18 snapshot. The operative verdict, current counts, and PD-01…10
> ledger are in
> [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](PRE_DEPLOYMENT_UPDATE_2026-07-20.md).

**Audit date:** 2026-07-18  
**Code observed:** `codex/112@040f298e44b0` plus pre-existing and concurrent
uncommitted frontend WIP; the worktree changed during the audit  
**Decision:** **NO-GO for an immutable release candidate today**  
**Scope:** routed UI, API/platform services, feature/control wiring, code reachability,
audit loops, 15-user throughput, persistence, vault, backup, and security posture.

The commands below are diagnostic snapshots taken during a moving worktree, not one
internally consistent candidate. This report is the consolidated evidence source for
[PRE_DEPLOYMENT_PLAN.md](../../PRE_DEPLOYMENT_PLAN.md),
[AUDIT.md](../../AUDIT.md), [SECURITY.md](../../SECURITY.md),
[PRE_DEPLOYMENT_QA_LOOPS.md](../../PRE_DEPLOYMENT_QA_LOOPS.md), and the companion
[application surface matrix](../APPLICATION_SURFACE_MATRIX_2026-07-18.csv).

## 1. Executive answer

The application is broad, buildable, and well tested, but it is **not yet valid to
say that every feature and button is wired, every application surface is represented
by the plan, or every record is durably and securely stored in the vault**.

The tested snapshots pass lint, strict TypeScript, production build, 1,438 frontend
tests, the effective 2,412-test server suite, rendered axe across all 18 page
endpoints at two viewports, and a fresh 15-user load smoke with zero failures.
However, the current three-browser E2E inventory has 15 failures and one flaky test;
the 355-row feature tracker omits newer routed concepts; 16 frontend files are
reachability candidates; only six route error boundaries exist for 18 page
endpoints; several live/reference integration seams remain explicit in code; and
off-host encryption/recovery evidence is not available from this checkout.

The correct deployment posture is therefore: **finish the blocker ledger below,
freeze a clean candidate, then rerun the release gates against those exact bytes and
the target Postgres/vault/edge configuration.**

## 2. Evidence run on 2026-07-18

| Area | Result | What it proves | Limitation |
|---|---|---|---|
| Frontend lint | PASS | `eslint src` clean | Static only |
| TypeScript | PASS | `tsc --noEmit` clean | Static only |
| Frontend unit/component | **1,438 passed / 234 files** | Broad logic/component regression coverage | Does not prove real navigation or persistence |
| Production build | PASS, **18 page endpoints** generated | Current WIP compiles as a static production export | Candidate is dirty and not immutable |
| Server suite | **2,405 passed / 15 skipped** in sandbox; the seven socket-denied AV cases passed on an unrestricted rerun, yielding an effective **2,412 passed / 15 skipped** | Server, stress-helper, cohort, tenancy, persistence, engine, upload, and security regressions | Skips and target Postgres/container lanes remain CI/host evidence |
| Rendered accessibility | **36 route/viewport scans**, 0 axe nodes, scan errors, layout failures, or clipped controls | All 18 page endpoints render at 1440×900 and 390×844 without automated WCAG A/AA findings | Offline/static API-unavailable states; not a substitute for workflow E2E or manual screen-reader review |
| Browser E2E | **125 passed / 15 failed / 1 flaky**, Chromium + Firefox + WebKit | Many real workflows and keyboard interactions are wired | Five repeated contracts remain red; see §5 |
| Native button source screen | **290 production `<button>` nodes; 0 unproven candidates** | Every native button has a handler, submit/action contract, spread contract, or explicit disabled/unavailable state | Syntax is not proof that the intended server mutation or navigation succeeds |
| Current-tree 15-user smoke | **2,913 requests, 0 failures**, p50 4 ms, p95 7 ms, p99 11 ms | Read/report/query mix is stable on isolated one-worker SQLite with 30 issuers | Not production capacity: fixture LLMs, no external dependencies, no upload/run burst, non-target DB |
| Production-like 15-user baseline | **2,584 requests, 0 failures**, p50 27 ms, p95 89 ms, p99 130 ms | Postgres 18 + two uvicorn workers handled the mixed expensive-endpoint profile | Dated 2026-07-12; repeat on immutable RC and target host |
| Backend dead-code scan | Vulture clean after excluding virtualenvs/data/static | No reportable unused Python definitions in application code | Reflection/dynamic routes always require review |
| Frontend reachability | 249 production files; 232 reached from framework roots; **16 candidates** after removing the `global-error.tsx` framework false positive | Identifies likely test-only/superseded modules | Framework/dynamic-import aware owner review required before deletion |
| Secret scan | Current diff clean; archive findings were six adjudicated documentation/config false positives | No confirmed committed credential found | Does not prove runtime secret handling or target-host hygiene |
| GitNexus | Index refreshed: 22,682 nodes, 40,965 edges, 300 flows; 137 API routes mapped; cycle check clean | Broad code/flow inventory | Cross-language consumers and PDG/taint layer were unavailable; an empty taint result was not credited |

## 3. Is the entire application mapped?

**It is now mapped at release-gate level, but the historical feature tracker alone
did not map it.** The production build exposes 18 page endpoints:

| Domain | Page endpoints |
|---|---|
| Coverage desk | `/command`, `/monitor`, `/pipeline`, `/portfolios` |
| Issuer and evidence | `/issuers`, `/issuers/profile`, `/upload`, `/deepdive` |
| Research and relative value | `/research`, `/query`, `/sector`, `/sector-rv`, `/sponsors` |
| Model, decision, output | `/model`, `/decisions`, `/reports` |
| Administration/entry | `/settings`, `/` |

The non-page application is also in scope: 137 FastAPI routes across 33 route
modules; authentication/edge enforcement; Postgres/Alembic; document and market
workbook vaulting; run, research, report and autonomy executors; notification and
alert state; ClamAV; provider/EDGAR egress; Caddy/oauth2-proxy; backup, off-host
sync, and restore.

`FEATURE_TRACKER.csv` still has 355/355 historical Pass rows, but its 14 concepts
do not give dedicated coverage to Portfolio Lab, Decisions/IC Book, Sponsors, and
several newer analysis-context and RV workflows. Most rows were last executed on
2026-07-02. It is therefore a useful acceptance archive, not a current whole-app
release manifest. L23 closes this by reconciling tracker rows to the companion
surface matrix, routes, nav, API contracts, E2E specs, and unavailable states.

## 4. What exists in code but was not adequately covered by the plan?

1. **Newer routed concepts:** Portfolio Lab, Decisions/IC Book, Sponsors, and the
   current Sector RV workbench are not represented as first-class concepts in the
   355-row tracker.
2. **Segment recovery:** only root, Command, Deep-Dive, Model, Query, and Reports
   have `error.tsx`; 12 page endpoints rely on broader recovery.
3. **Browser-transient work product:** unsaved chat, report/model/research UI state
   and preferences exist outside the server durability boundary.
4. **Target-store security:** the plan named vault/backup controls but did not state
   plainly that application-level encryption at rest is not enforced for the host
   volume or Postgres; this is a target-host control.
5. **Static-to-live seams:** code still discloses that CP-RENDER is not an
   issuer-specific module path, CP-0/CP-5B rails can be unavailable, and some
   Monitor/email/market/reference paths remain sample, manual-import, or enterprise
   activation seams.
6. **QA flag scoping:** `FlagToQa` uses the ATLF reference issuer for its current
   list/create contract and needs an explicit live-issuer disposition.
7. **Whole-tree code health:** CI's changed-only Fallow gate does not replace a
   framework-aware full reachability disposition at release time.
8. **Seed-harness drift:** the current API-driven stress seeder attempted 300 issuer
   creates but the live rate guard admitted 30; nightly claims of 300 must use the
   bulk QA seeder or wait/rate-partition explicitly and assert the resulting count.

## 5. Are all features and buttons wired?

**No—not yet proven.** The static screen is strong: all 290 native production
buttons expose an action, submit, spread, or honest unavailable/disabled contract.
Unit tests and 125 browser journeys also pass. The release gate is nevertheless red
because five contracts fail consistently across browsers:

| Contract | Observed result | Closure required |
|---|---|---|
| Command “Open top change” | Navigates to Deep-Dive context; test expects a `dataset=changes` handoff and ranked-changes workbench | Decide the intended interface, update implementation or contract test, and pass all browsers |
| Registration and wrong invite code | Create button remains unavailable under the new three-recovery-word requirement; old E2E fill contract never submits | Reconcile the recovery-word UX with fixtures and prove valid/invalid registration |
| Model Engine v2 override persistence | “Preview pending” does not produce the expected calculate response in the isolated inventory | Seed the required workflow fixture or fix the control/API seam; prove preview, commit, reload |
| Research empty state | “No report yet” contract no longer renders | Re-specify or restore the explicit empty state and pass E2E |
| Research scope toggle | One WebKit first attempt failed to retain issuer selection, then passed on retry | Remove flake and rerun without retries |

Dedicated route-level Playwright coverage is also absent for `/portfolios`,
`/decisions`, `/sector`, `/sector-rv`, and `/sponsors`; rendered axe and unit/static
coverage are not equivalent to mutation/navigation journeys. L27 owns the control,
handoff, persistence, failure, and recovery proof.

## 6. Dead-code assessment

The backend Vulture pass is clean. The frontend dependency walk found these 16
production-unreachable candidates after framework roots and `global-error.tsx` were
accounted for:

```text
src/components/command/ActionableDislocations.tsx
src/components/command/SectorRV.tsx
src/components/issuers/ProfileSectionNav.tsx
src/components/query/LaneRouter.tsx
src/components/shared/EvidenceInspector.tsx
src/components/shared/FlashOnChange.tsx
src/components/shared/RecoveryState.tsx
src/lib/citations.ts
src/lib/command/coverage.ts
src/lib/command/dislocations.ts
src/lib/command/stats.ts
src/lib/query/format.ts
src/lib/query/intent-router.ts
src/lib/query/questions.ts
src/lib/query/report.ts
src/lib/use-resize-observer.ts
```

The old `SectorRV`/`ActionableDislocations` stack appears superseded by
`RVScreenerWorkbench`; several other paths are test-only. They are **candidates,
not authorized deletions**. L24 requires each owner to mark `remove`, `restore to a
runtime root`, or `retained test/support seam`, then pass lint, typecheck, unit,
build, and relevant browser tests. A fresh whole-tree Fallow run could not be
installed in the restricted environment and remains a candidate-host release check.

## 7. Do the audit frameworks and loops cover all areas?

The existing L1–L22 system covers CI, review, engine correctness, E2E, a11y,
stress, performance, dependencies, security, local restore, external monitoring,
and off-host backup. It did **not** make five release questions mechanically
answerable. The loop document now adds:

- **L23 — Application surface parity:** routes + nav + API + tracker + E2E + owner.
- **L24 — Whole-tree reachability/dead code:** full scan and owner disposition.
- **L25 — Candidate concurrency/throughput:** 15-user and heavy-lane target-host run.
- **L26 — Record storage, isolation and recoverability:** store matrix, encryption,
  browser durability, backup pair, remote-only restore.
- **L27 — Control wiring and recovery:** handler screen plus browser journeys,
  persistence, failure states, and route boundary coverage.

These rows are not green merely because they have been documented. Each requires a
dated artifact tied to the immutable release candidate and is consumed by H0/H1/H2.

## 8. What happens with 15 active users?

The measured mixed browse/report/query workload succeeds at 15 users on both the
fresh local profile and the dated Postgres/two-worker profile. The result does **not**
mean 15 simultaneous heavy analytical jobs complete immediately:

- `WEB_CONCURRENCY` supports one or two processes and refuses more than two.
- Each Postgres worker executes at most two analytical runs; a two-worker deploy can
  therefore execute up to four at once. Global queued/running runs are capped at 20,
  and each analyst is capped at three; excess submissions are rejected rather than
  allowed to grow without bound.
- Each executing run can fan out four synthesis calls, so provider capacity and cost
  become the constraint before ordinary read traffic.
- Uploads are capped at one whole-file parse per process; a two-worker deploy can
  admit two concurrently and queues later uploads on the process semaphore.
- Research and report/export concurrency are also bounded per process. Fifteen users
  who submit heavy work together will see queueing and longer completion times even
  while directory, status, and result reads remain responsive.
- In-process rate limits are process-local, so the effective aggregate allowance can
  scale with worker count; the edge and target monitoring must be calibrated to the
  deployed process topology.

L25 must repeat the test with 15 authenticated principals, target-size data, two
workers/Postgres, target vault, real queue settings, large upload contention, and
mocked slow/429/529 provider faults. Acceptance: zero 5xx/data-isolation failures,
p95 read/API within the agreed budget, bounded queues/memory, and a documented
degradation curve for heavy work.

## 9. Is all data safely and securely stored in the vault?

**No. The vault is intentionally only one part of the persistence model.**

| Record class | Canonical location | Durable today? | Required security/closure |
|---|---|---|---|
| Original uploaded documents and committed source workbooks | Document vault volume | Yes when the volume is durable | Malware scan, path/format guards, host-volume encryption, access control, backup |
| Issuer/document metadata, extracted chunks and lineage | Postgres | Yes | TLS, DB credentials, least privilege, encryption-at-rest proof, backup |
| Runs, module outputs, claims/evidence, facts, QA, alerts, decisions, models, reports, research jobs | Postgres | Yes when explicitly saved | Analyst/team authorization, retention/legal hold, DB backup and restore |
| Signed session | Secure cookie plus analyst record in Postgres | Session-durable | Secret rotation, Secure/HttpOnly/SameSite, revocation |
| UI preferences and unsaved drafts/chat/layout state | Browser local/session storage | **No server durability guarantee** | Principal-bound clearing exists; authoritative work must be saved server-side; avoid sensitive unsaved state or define encrypted managed-browser policy |
| Access/application logs | Host/container logging path | Operationally durable only if configured | Retention, restricted access, redaction, external collection/alerting |
| Backups | Local backup artifacts plus optional rclone remote | Mechanism exists; target proof missing | Encrypt, least-privilege remote, freshness/failure alert, paired DB+vault restore |
| Optional provider payloads | External LLM/EDGAR/market/email services | Outside CAOS custody | Document egress defaults off; DPA/residency/retention and entitlement approval required before activation |

The backup design correctly pairs Postgres dumps with vault archives, but this audit
cannot verify that the deployment target has an encrypted off-host destination,
fresh successful sync, tested alert delivery, or a remote-only recovery point. The
application also does not itself encrypt the Postgres files or Docker vault volume;
that proof belongs to the target host/storage layer. G8/G9 and L22/L26 therefore
remain non-waivable blockers.

## 10. Final blocker ledger

| ID | Blocker | Exit evidence | Owner/gate |
|---|---|---|---|
| PD-01 | Dirty mutable candidate | Clean `origin/main`-based RC; commit, image digest, schema head, config/flag fingerprint, SBOM/scan, evidence manifest | H0 / release owner |
| PD-02 | 15 failed + 1 flaky browser contracts | All three browsers green without retries for the five red contracts | H2 / L8 / L27 |
| PD-03 | Tracker/surface mismatch and uncovered route journeys | L23 matrix has owner, current acceptance rows, API and E2E evidence for every surface | H2 / L15 / L23 |
| PD-04 | 16 dead-code candidates | Owner disposition and green compiler/build/tests after any removal | Phase A / L24 |
| PD-05 | 12 page endpoints lack deliberate segment recovery evidence | Boundary/equivalence decision and failure-preservation E2E | H2 / L27 |
| PD-06 | Reference/manual/enterprise seams remain | C3 email/Monitor seam, C5 market activation, C13 promise-to-runtime map, FlagToQa issuer scope explicitly closed or labelled unavailable | C3/C5/C13 |
| PD-07 | Candidate-scale capacity not rerun on target | L25 target Postgres/two-worker 15-user + heavy-lane/fault artifact | G3/H1 / L25 |
| PD-08 | Encryption, governance and off-host recovery unproven | L26 store/control matrix; G8 remote-only restore; G9 host encryption/access evidence; retention/legal-hold/vendor policy | E8/G8/G9/H3 / L22/L26 |
| PD-09 | Final audit evidence is not tied to released bytes | One archived H0/H1/H2 bundle, including current full-tree code-health and security results | H0/H1/H2 |

Deployment may proceed only when PD-01…PD-09 are closed with evidence or, where the
master plan permits it, an exact enterprise-equivalent control and named approver.
PD-01, PD-02, PD-03, PD-06, PD-07, and PD-08 are non-waivable because they define
artifact identity, actual product behavior, stated product scope, live integration,
capacity, and recoverability.
