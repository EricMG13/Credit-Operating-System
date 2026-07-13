# CAOS — Pre-Deployment Program Plan

> **Latest status:** the **2026-07-13 authoritative reconciliation** below is
> the release ledger. It supersedes the retained 2026-07-11/12 snapshots.

> **For agentic workers:** this is the **master program plan** (current state
> → enterprise transfer). It tracks **status** only — status verdicts,
> checkboxes, exit gates. Every "tested regularly" / cadence claim resolves to
> a loop ID (`L1`–`L20`) defined in
> [PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md), which owns
> **mechanism** — do not restate cadences here without a loop ID; if a claim
> needs a new automation, the loop doc names the work item. Tooling/skills
> live in [PRE_DEPLOYMENT_SKILLS_SHORTLIST.md](PRE_DEPLOYMENT_SKILLS_SHORTLIST.md).
> The four remaining L-sized items (**B5**, **C3-seam**, **C5**, **E2**) each
> get a detailed implementation plan written **at pickup time** (plan-mode →
> `docs/superpowers/plans/`, following the existing convention in this repo —
> see `docs/superpowers/plans/2026-07-06-command-center-refinement.md` for the
> pattern); do not implement them directly from this document. S/M items may
> be executed directly. Checkboxes (`- [ ]`) are the tracking surface.

**Goal:** take CAOS from the latest reconciled state below to
**pre-deployment**: the final stage before
transfer to enterprise, where the **only** outstanding items are
(1) connecting the Monitor concept's alert seam to the enterprise email
client, and (2) activating the Bloomberg market-data connector (built in
Phase C, §5-C5) with enterprise entitlements (live credentials + parallel-run
reconciliation). Everything else: functional, live, and re-tested on a
defined, mechanism-backed cadence.

**Architecture of the plan:** eight gated phases (A–H). Each phase has work
items with file anchors, a verify command, and a hard **exit gate**
(verifiable, not aspirational); §10 points to the loop doc that keeps
everything live re-verified after its phase lands. Supersedes the phase
ordering in [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md) where they
conflict (DEVELOPMENT_PHASES "Phase 5 market-data cutover" happens *after*
transfer — it is outstanding item #2 by design).

## Historical trunk state — 2026-07-11 (superseded)

Grounded 2026-07-11 by direct code inspection (`git grep`/`git show`/`git
ls-tree`), a live offline test run, and GitHub API queries — not inherited
from any prior version of this document. Branch fast-forwarded to
`origin/main` **`313ebac`** (fresh commits landed mid-session; the load-bearing
zero-hit greps below were re-run against this SHA, not the earlier `6bf73a1`
this session started grounding against — see the discrepancy note after the
table).

| Check | Result |
|---|---|
| Server suite, offline, this session | **1393 passed / 2 skipped**, 65.7s — `env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u OPENROUTER_API_KEY caos/server/.venv311/bin/python -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q` (venv built fresh this session from hashed `requirements.lock`). Both skips are the 2 Postgres-only worker/reaper/claim tests (no Docker daemon in this container — see `backend-api-data.md` in the loop doc for the Postgres leg). |
| `AUDIT.md` cited count (2026-07-11, prior commit) | 1378 pytest / 2 skipped (server dir only; this session's run adds `stress`+`cohort`, matching CI's job selection, hence the higher count) |
| CI on `origin/main` tip | **Not green since `ee37030` (#148, 2026-07-11T02:42Z).** Three subsequent pushes (`6bf73a1`, `ccb29f1`, `10c7a25`) show `cancelled` (superseded by rapid re-pushes); the current tip `313ebac`'s run was `in_progress` at last check. Re-check before treating "CI green" as a phase-exit fact. |
| Open PRs | **17** — **12 dependabot** (#85, #88, #133–#142; A5), 4 drafts (#118, #124, #127, #144), 1 non-draft feature (#150). #147 merged 2026-07-11. 0 open issues. |

**Mid-session drift note:** grounding began against `origin/main@6bf73a1`;
before this document was written, `origin/main` advanced to `313ebac` (13
commits: tenancy mechanism, CP-0 Source-Gaps board, security-audit fixes —
see §15). Every load-bearing zero-hit claim below (`AlertSink`/`EmailSink`,
Bloomberg/market-data, `golden_e2e`/`corpus_run` markers, `FEATURE_TRACKER.csv`
counts, corpus MANIFEST) was **re-verified against `313ebac`** before writing
this document; none flipped. One net-new fact from the drift: migration
`0037_team_tenancy` added an optional, config-gated (`CAOS_TENANCY_ENABLED`,
default off) cross-**team** isolation mechanism (`caos/server/tenancy.py`) —
this is orthogonal to **E2**'s roles-lite decision (within-team analyst/
admin/read-only roles); E2 remains open (no `role` column exists).

### 2026-07-12 update — working branch `feat/design-rebuild-p1`, not `main`

**This session is grounded on an unmerged feature branch, not `origin/main`.**
Everything above (and the exec-notes threaded through §§3–9 below) describes
`origin/main`; this block is the delta.

| Check | Result |
|---|---|
| `origin/main` tip | Advanced to **`14cb9c53`** (from `313ebac`) — merged #165 (D4 stamp) and #167 (C1/E4/E6 stamp). Those items' `[ ]`/exec-note state below is current as of `14cb9c53`. |
| Working branch | `feat/design-rebuild-p1`, **15 commits ahead of `origin/main`, 0 behind**, not yet pushed/PR'd. A P1-WP/P2-WP work-package initiative (shell unification, nav registry, breakpoints, role views, provenance-chip grammar, ⌘K palette, a11y sweep, Command governance panel, Monitor live alert inbox, Reports export trigger) — **not reconciled into the A–H phase-letter structure yet**; do that at the next full grounding. Plus substantial **uncommitted** WIP on top (`database.py`, `main.py`, `config.py`, `research_executor.py`, `research_report_executor.py`, `routes/issuers.py` modified; new migrations in flight) — this tree is being edited in parallel by the user right now; treat file-level specifics as a snapshot, not a fact to build on. |
| Dependabot, live re-check | **2 open** (#139 vitest 3→4, #140 @vitest/coverage-v8 3→4) — not 12. A5's same-day exec-note already explains the drop (9 of 12 merged 2026-07-11); this just confirms the live count today. |
| Server suite, this branch + WIP | **22 failed / 1070 passed / 2 skipped / 319 errors**, 146.5s (`.venv311`, `caos/tests/server`, offline). **Not a deploy-ready baseline** — do not cite the `origin/main` 1393/2 number for this branch. The error volume (319) is consistent with a fixture/conftest-level break from the in-flight core-file WIP, not 319 independent test bugs; root-causing it is out of scope for this doc update and the tree is a moving target. Re-run clean once the WIP settles. |
| C3-seam, concrete local delta | On **this branch only**: `monitor/page.tsx` now imports a live `AlertInbox` component (`components/monitor/AlertInbox.tsx`) driven by `useAutonomyDraft` (`lib/engine/useAutonomyDraft.ts`) + `draftToAlertRows`, and migration `0038_alert_states` (table `alert_states`: `alert_key`/`state`/`assignee`/`note`/`analyst_id`) landed — real progress beyond `origin/main`'s "confirmed entirely absent." **But:** `monitor/page.tsx` still also imports `simAlertsToday`/`CRITICAL_ALERTS` (mock) and `AlertFeed`/`EmailIntel` (mock) alongside the live inbox — a hybrid state, not yet a clean live/labeled-sample split. The `AlertSink`/`EmailSink`/`InAppSink` **interface abstraction itself is still zero-hit** (`git grep -in "alertsink\|emailsink\|inappsink"` empty), even on this branch — the P2-WP work built a direct alert-inbox path, not the seam interface C3-seam specifies. Reconcile which approach wins at C3-seam pickup. |
| Local branch/worktree hygiene | Materially worse than any prior count in this document — **104 local branches** as of this check (A6 already flags this as a moving, machine-local number not to hard-code; re-verify at pickup, do not carry today's number forward either). |

### 2026-07-13 authoritative reconciliation — current code and unwired controls

**This block supersedes every earlier “today/current” count in this document.**
Older grounding remains below as program history and acceptance-test context;
do not use it for a release decision. Status was re-derived from the current
checkout, `origin/main`, the feature tracker, route/component source, tests,
GitHub Actions, and open PRs. “Present in the working tree” is deliberately
not treated as “merged on main.”

| Check | Latest result |
|---|---|
| `origin/main` | **`a930defa`**. The latest main CI run, [29195679256](https://github.com/EricMG13/Credit-Operating-System/actions/runs/29195679256), is **red on E2E only**: Research did not render the expected `● LIVE` provenance branch, and Settings did not render the server-backed Workspace heading. The other frontend, server, Docker, security, lock, taxonomy, and deploy-lint jobs passed. Main is therefore **not deployable** until those two assertions pass on a new main-tip run. |
| Current checkout | `codex/111@29b4fa6e`, **2 commits ahead / 0 behind** `origin/main`; the two committed deltas add decision/thesis/scenario work and capture the residual workspace update. **186 modified/untracked paths** remain in the shared worktree, including this reconciliation. This is implementation evidence, not a releasable artifact. |
| Current-checkout verification | Most recent full local sweep in this session: frontend **673/673**, server **1457 passed / 7 skipped**, TypeScript, lint, and production build green; axe **0 serious/critical across 15 routes**; responsive contract **75/75**; Impeccable **36/40**; adversarial review CLEAN. These results prove the checkout tested, but they do not override red main CI or the dirty-tree release gate. |
| Feature tracker | `caos/docs/qa/FEATURE_TRACKER.csv`: **355/355 `Pass`**, 0 `Pending Verification`. Tracker completion is UI/contract evidence only; it does not upgrade reference/demo data to live. |
| Open PRs | **8** at reconciliation: #169, #184, #187–#192. C7, C8, and C9 have green candidate/stamp PRs, but remain open and are not counted as merged capability. Re-check the [open PR list](https://github.com/EricMG13/Credit-Operating-System/pulls) at A5/H1. |
| Control scan | **317 production JSX controls** inspected by static scan plus source review: 294 `<button>`, 15 `<select>`, and 8 `role="button"` occurrences (tests excluded). There are **0 literal dead raw buttons** (no empty click handler, `undefined` click handler, or `href="#"` action). The only permanently disabled control family is the three Settings per-lane model selectors, explicitly labeled “Not yet applied.” Other disabled controls are prerequisite/state gates and are not defects by themselves. |

#### Control classification

| Class | Meaning | Deployment treatment |
|---|---|---|
| **Wired** | Reaches the intended real API/state transition or performs an honest local utility such as view/layout/export. | No remediation row. |
| **State-gated** | Disabled until a documented prerequisite exists: selection, input, completed run, actionable evidence, or committee readiness. | Keep; test the enabled and disabled paths. Do not call it dead. |
| **Local/reference-only** | The control works, but only changes browser state, replays fixtures, exports a lesser format, or consumes reference/demo data. | Remediate or keep explicitly labeled; cannot satisfy a live phase gate. |
| **Backend-unwired** | UI exists but the production mutation/source/engine seam does not, or the named action is only a focus/navigation proxy. | Open blocker with an owner and exit test. |

#### Unwired and partial user-facing controls — exhaustive current register

| ID | Surface / control | What happens now | Missing production behavior | Class / owner |
|---|---|---|---|---|
| UW-01 | Issuers batch actions | Run pipeline, add to watchlist, and CSV export are real. Assign owner, refresh, and delete are deliberately not rendered because they have no backing semantics (`batchActions.ts:1-5`; `issuers/page.tsx:264-266`). | Add owned server mutations, audit rows, per-item results, and tests before exposing any of the three omitted actions. | Backend-unwired · C2/E3 |
| UW-02 | Sponsors — **Review selected sponsor** | The primary button only focuses `#sponsor-record`; it does not create a review, ratification, assignment, or finding (`sponsors/page.tsx:113-122`). | Persist a sponsor review/finding or rename the control to an honest navigation label. | Backend-unwired · C4 |
| UW-03 | Sponsors — monitoring thresholds | The panel states sponsor thresholds are not stored and only links to Monitor (`sponsors/page.tsx:240-243`). | Sponsor-scoped watch-rule create/edit flow with evidence and owner. | Backend-unwired · C3-seam |
| UW-04 | Command — Sample Sleeve and replay controls | “Sample — not live,” static sleeve size/DM, and `useSharedDayRun` replay remain beside live coverage and Watchtower (`command/page.tsx:13-16,188-205,220-226,275-286`). | Replace sample positions/stats with persisted portfolio data or an empty state; server-backed event chronology if replay remains. | Local/reference-only · C2 |
| UW-05 | Pipeline — run modes / SimControls | The DAG can display a real run, but mode changes, play/pause, clocks, event timing, and seeded driver/QA metadata use `useSimRun`/fixture plans. They do not create, cancel, or replay a server run. | Bind controls to immutable server run events, or confine them to a clearly separate reference workspace. | Local/reference-only · C4 |
| UW-06 | Deep-Dive — bespoke tabs and evidence rails | Live module output is real; CP-0/CP-5B rails, committee output, charts/steps, and bespoke debate/recovery/covenant views remain hidden or reference-only for real issuers (`rails.tsx:18-32`; `tabs.tsx:419-424`). | Live adapters for the retained panes and evidence interactions, preserving current desktop behavior. | Backend-unwired · C4 |
| UW-07 | Model — scenario preset / natural-language Apply and Reset | Buttons recalculate a local `active` scenario lens in `ScenarioPanel`; they do not write worksheet overrides, the mutable model, or a checkpoint (`ScenarioPanel.tsx:410-435`). | Explicit apply-to-model transaction with preview, undo, provenance, persistence, and checkpoint linkage. | Local-only · A-1/C4 |
| UW-08 | Model — **Export model** | Downloads dependency-free CSV despite the committee-pack/XLSX concept (`components/model/export.ts:1-7`; `model/page.tsx:673-679`). | True `.xlsx` workbook with assumptions, scenarios, overrides, run/checkpoint/as-of stamps, and a round-trip test. | Partial · C9 |
| UW-09 | Report Studio — publish/export for a real issuer | Draft/version APIs and reference-paper editing work, but a real issuer has no report object: the page states CP-RENDER is not wired, so publish/PDF remain unavailable (`reports/page.tsx:435-439,474-480,604-606`). | CP-RENDER or an equivalent live composition adapter producing issuer-specific pages from the selected run/model checkpoint/findings. | Backend-unwired · C4 / CP-RENDER |
| UW-10 | Monitor — **Critical alerts** filter | The red count is the static `CRITICAL_ALERTS` fixture and filters the seeded replay rail, not the durable live inbox (`monitor/page.tsx:17-21,83-100,146-159`). | Derive the count/filter from persisted live `AlertEvent` rows and one shared query state. | Reference-only · C3-seam |
| UW-11 | Monitor — Replay controls and Email Intelligence | Ack/assign/resolve on the live Alert Inbox are wired. The clock, EOD email tape, source-email modal, and `EmailIntel` filters remain seeded simulation; no email transport/outbox backs them. | Watch-rule/event source pipeline plus `AlertSink`, live `InAppSink`, and a rendered-intent `EmailSink` stub before enterprise transport. | Reference/backend-unwired · C3-seam |
| UW-12 | Settings — custom model routing selects | Three per-lane selects are permanently disabled with no-op `onChange`; copy says the values are not applied (`settings/page.tsx:463-482`). | Run-lane override contract, validation, persistence, execution routing, and cost/authority audit. | Explicitly backend-unwired · new E7 |
| UW-13 | Settings — Outlook connection | Settings persist/display `outlook_connected` and approved senders, but there is no connect/disconnect, credential, OAuth/test-connection, or transport action (`settings/page.tsx:551-591`). | Enterprise email adapter/control plane; do not let a stored Boolean imply a verified connection. | Backend-unwired · C3-seam/H4 |
| UW-14 | Settings — View: Analyst / PM / QA | The selector persists composition only. It is not authorization and cannot create admin/read-only users. | Server-enforced roles-lite, role assignment, route matrix, audit visibility, and UI suppression matching policy. | Backend-unwired policy · E2 |
| UW-15 | Issuer Profile — Market · price & DM | The panel is an explicit “Feed pending” placeholder with no loan mark/DM series (`ProfileContent.tsx:754-763`). | Consume the normalized live/manual market snapshot store with source/as-of/freshness. | Backend-unwired · C5 |
| UW-16 | Research — **Run example research** | With no model provider, the normal run persists and returns a clearly labeled canned demo report (`research/page.tsx:3-7,395-470`; `routes/research.py:3-6`). | A configured grounded-research provider for live output; keep the example lane reference-only. | Capability-gated/reference · D2/E4 |
| UW-17 | RV — **Run screen / Review top candidate / Ratify candidate** | Versioned screens persist, but the only snapshot is a bundled `REFERENCE` JSON import. Every row is forced screen-only/unavailable because live origin, downside, recovery, portfolio mapping, and risk-budget gates are missing; ratification is consequently unreachable (`routes/rv.py:85-103,291-367,434-453`). | Live/manual immutable snapshot ingestion, recovery/downside adapters, exact portfolio mapping, and risk-budget calculation. | Reference-only / backend-unwired · C5 |
| UW-18 | RV — **Monitor threshold** | The button pins a finding with source surface `monitor-threshold`; it does not create a durable watch rule or alert event. | Create/edit a threshold, owner, severity, evidence link, and next-evaluation state. | Misleading partial action · C3-seam |
| UW-19 | Sector Review — **Request refresh** | Creates a versioned review from persisted signals/reference synthesis, but CP-SR is still spec-only and the route does not run the complete analytical engine as an asynchronous job. | Real queued/running/partial/ready CP-SR execution with immutable prior published version and complete source-backed dimensions. | Partial/backend-unwired · CP-SR / X5 |
| UW-20 | Sector Review — **Ratify updates / Publish review** | Mutations are wired and correctly gated, but reference/partial drafts cannot become a production published review. | Live source-backed CP-SR artifact satisfying every publication dependency. The buttons themselves should remain gated. | State-gated by missing engine · CP-SR / X5 |
| UW-21 | Query — grounded lane | Metric and graph lanes are deterministic and wired. The grounded lane degrades to `partial` with preserved question/alternatives when the model provider is unavailable. | Production model-provider configuration and a green live-provenance E2E; no UI rewrite required. | Capability-gated · main-CI blocker |
| UW-22 | Global ASK, Upload, live Alert Inbox, model save/checkpoints, issuer creation, and worklist filters | No dead action found in the current scan; their buttons either call real APIs/local utilities or are valid prerequisite gates. | Keep regression coverage; do not create fake “wire button” work for these controls. | Wired / state-gated |
| UW-23 | Upload — **Run mode** choices and queued-run label | The chosen mode is written to each source manifest, but `createRun` does not receive it; every queued run takes the full CP-X route even while the UI says the selected mode was queued (`UploadWizard.tsx:156,201`; `steps.tsx:479-494`). | Either pass a validated route template into run planning and stamp the resolved plan, or relabel/remove the selector so it is honest document metadata rather than execution control. | Misleading partial action · new C12 |
| UW-24 | Issuers — sample sleeve fallback | When live coverage is empty, the directory injects `DEMO_UNIVERSE` and says it is a sample sleeve. The labeling is honest, but the live worklist is not an actual observed-empty state (`issuers/page.tsx:334,400`; `lib/issuers.ts:7`). | Separate the reference workspace from the live directory, or show a true empty worklist with an explicit action to open sample data. | Reference-only · C2 |

#### Unwired platform capabilities without a single button

| ID | Capability gap | Current evidence | Plan owner / exit |
|---|---|---|---|
| UF-01 | Four spec-only engine modules | `CP-SR`, `CP-MON`, `CP-RENDER`, and `CP-EXTRACT` are `implemented=False` and never execute (`engine/registry.py:198-215`). | X5/C3/C4; implement or explicitly remove from the pre-deployment promise. |
| UF-02 | Alert sink and watch-rule architecture | Durable alert events and ack/assign/resolve exist in the current worktree, but `AlertSink`, `InAppSink`, `EmailSink`, scheduled watch rules, deduplicated event generation, and an outbox are absent. | C3-seam; rule → event → inbox → sink E2E, with email intent recorded. |
| UF-03 | Production market-data provider chain | Normalized snapshot/instrument tables and RV adapters exist in WIP, but no `MarketDataProvider`, `BloombergProvider`, `ManualQuoteProvider`, import/refresh endpoint, or Settings connection/test UI exists. | C5; fixture-backed provider plus manual fallback and one shared store. |
| UF-04 | Complete live Sector Review engine | The V2 dossier contract exists, but it is reference/signal synthesis rather than CP-SR compute; display-version allocation also lacks a dedicated unique DB column under concurrent refresh. | X5 plus accepted red-team follow-up; async job and uniqueness constraint. |
| UF-05 | Live Report renderer | Draft/version persistence exists; CP-RENDER and issuer-specific report composition do not. | C4/CP-RENDER; real issuer → report version → PDF/IC journey. |
| UF-06 | Live Deep-Dive rail/read-model adapters | Real module center views exist; several retained evidence, QA, output-register, and committee panes are reference-only. | C4; parity matrix must pass before fixture path retirement. |
| UF-07 | Persisted model scenario application | Scenario calculations and network readout exist; an applied scenario is not a saved override/checkpoint artifact. | A-1; apply/undo/save/reopen E2E. |
| UF-08 | Roles-lite authorization | `role_view` is presentation; there is no analyst/admin/read-only policy dependency or admin assignment plane. | E2; deny-by-default mutation matrix. |
| UF-09 | Firm-wide append-only audit log | `audit_log`/audit helper are absent from current checkout and `origin/main`; candidate PR #169 is open. | E3; all shared mutations write actor/before/after rows. |
| UF-10 | Breadth corpus | The 61-name MANIFEST exists; captured fixtures and `corpus_run` marker remain absent. | B5; scoped fixture count must equal manifest scope. |
| UF-11 | Full concept-link decision journey | Individual E2Es exist, but no one test proves issuer → upload → pipeline → Deep-Dive → model checkpoint → finding → report with identical artifact identity and numbers. | C6; one backend-connected Playwright/API journey. |
| UF-12 | Head-to-head Query walk | Not present on current checkout/main; green candidate/stamp PRs #187/#188 remain open. | C7; merge only after main CI parity. |
| UF-13 | IC Decision Record on main | Implemented in the two-commit local branch (`0044_decisions`, `/api/decisions`, Decision Room) but not in `origin/main`; green candidate/stamp PRs #191/#192 remain open. | C8; merge, migrate, rerun server/frontend/E2E on main. |
| UF-14 | Committee `.xlsx` export | Current code exports CSV; green candidate/stamp PRs #189/#190 remain open. | C9; merge plus openpyxl round-trip and same-number test. |
| UF-15 | Research/report multi-worker execution | `WEB_CONCURRENCY` and stress evidence landed, but research/report executors remain in-process and are not safely coordinated across workers. | E1; durable claim/lease/reaper or documented single-worker boundary. |
| UF-16 | Graph expansion production retrieval | `engine/graphexpansion.py` is a measurement harness and explicitly is not wired into `retrieve_corpus`. | Expansion backlog; wire only after quality/latency gate. |
| UF-17 | Vault peer/sponsor edges | `vault_export.py` still describes peer/sponsor edges as a stub because CP-1C persists counts rather than identities. | X2/X6 dependency; persist evidence-backed entity identities first. |
| UF-18 | Analyst disable/delete operator path | Auth comments record that disabling an analyst needs an operator/RBAC path that does not exist. | E2/H3; admin-only lifecycle with audit and data-retention semantics. |

#### Latest phase-status delta

| Status | Items | Evidence / remaining condition |
|---|---|---|
| **Delivered on `origin/main`** | A1, A7b, B1, B4, C1, D1, D3, E4, E6, G1, G4 | Tests/artifacts exist on `origin/main`. Checkboxes below are closed in this reconciliation. |
| **Delivered locally, not on `origin/main`** | C8 | Current branch has decision tables/routes/UI/tests; PRs #191/#192 remain open. Item stays open until merged and green on main. |
| **Partial** | C2, C3-seam, C4, C5, D4, E1, E5 | Each has real shipped progress but still fails its written exit condition; the UW/UF rows above name the residual. |
| **Open** | A5, A6, B2, B5, C6, C7, C9-C12, E2, E3, E7, F1-F5, G2, G3, H1-H5, X backlog | No status promotion from an open PR, a fixture, a schema alone, or a local-only test. |

**Immediate release order:** (1) fix the two red main E2Es and obtain a green
main-tip run; (2) reduce/decide the eight open PRs and merge only green,
non-overlapping candidates; (3) stabilize the 186-path worktree into reviewable
commits; (4) resolve every local/reference/backend-unwired row in UW-01–UW-24
or explicitly descope it from the pre-deployment promise (UW-22 remains the
wired regression baseline); (5) execute H1/H2 on the resulting immutable build.

---

## 0. Definitions — read first

| Term | Meaning here |
|------|--------------|
| **Pre-deployment** | Final stage before enterprise transfer. All exit gates A–H passed. Only the two named items outstanding: EmailSink adapter + Bloomberg activation. |
| **Live** | Renders real engine/DB output with provenance. A labeled sample ("Sample — not live") is *not* live; an explicit "no data" empty state *is* acceptable. |
| **Functional** | Works end-to-end through the real path (UI → API → engine → DB), not through a simulation hook. |
| **Tested regularly** | Covered by a named loop ID in [PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md); scheduled loops (mechanism class `WORK-ITEM`/`LIVE` with a cron) must show ≥2 consecutive green cycles before the claim counts at a phase exit. A cadence word with no loop ID is not a claim this plan makes. |
| **Seam / stub** | A code interface where a future integration plugs in. The seam itself is built and tested against a fake now; only the external connection is deferred. |
| **CRIT/HIGH/MED/LOW** | Dual severity rubric from DEVELOPMENT_PHASES §Conventions. CRIT+HIGH block phase exit; MED+LOW are tracked. |

### The two allowed-outstanding items — precise boundaries

**#1 Monitor → enterprise email.** Everything up to the send must be live:
watch rules, event generation, alert persistence, in-app alert inbox. The
boundary is an `AlertSink` interface with two implementations: `InAppSink`
(live, tested) and `EmailSink` (stub that logs + records intent; spec written
for SMTP and MS Graph so enterprise IT picks one). Outstanding = implementing/
pointing `EmailSink` at the enterprise mail system.
**State 2026-07-11:** none of this exists yet. `git grep -in
"alertsink|emailsink|inappsink|watch_rule"` over `caos/server` and
`caos/frontend/src` returns zero hits (S4 ledger Ev-1). The Monitor autonomy
*engine* (Sentinel→Anomaly→Analyst→Reporter DAG) is committed and tested
(`test_autonomy.py`), but the seam that turns its output into persisted,
inbox-visible alerts does not exist — `monitor/page.tsx` still renders a
labeled simulation (`monitor/page.tsx:14,64-67` "Illustrative sample — not
live"). **C3-seam (§5) builds this whole boundary**; only the email-transport
half of `EmailSink` is meant to stay outstanding at the gate.
**State 2026-07-12 (branch `feat/design-rebuild-p1` only, unmerged):** a live
`AlertInbox` + `useAutonomyDraft` + `alert_states` table landed (P2-WP-3) —
see the 2026-07-12 update block above. The `AlertSink`/`EmailSink` interface
itself is still zero-hit even here; reconcile at C3-seam pickup.

**#2 Market data → Bloomberg.** Product decision 2026-07-03: the Bloomberg
connector is **built in-plan** (C5), not left as a stub — persisted quote
store feeding **all RV analysis app-wide**, Sector RV **refresh button**,
Settings **login/API requirements** section, `BloombergProvider` implemented
and tested offline against recorded response fixtures, with
`ManualQuoteProvider` (analyst-entered / CSV) as the always-available
fallback. Outstanding at pre-deployment is only what requires the enterprise:
entitlements + credentials (transport per their licensing — BLPAPI Server
API/B-PIPE or HAPI REST; the Desktop API needs a running Terminal and does not
suit a server app), the first live connection, and the parallel-run
reconciliation before cutover (DEVELOPMENT_PHASES Phase 5). DM remains the
canonical spread metric (loans-only decision).
**State 2026-07-11:** entirely absent — zero code hits for `bloomberg`,
`blpapi`, `market_quotes`, `MarketDataProvider`, `ManualQuoteProvider` in
`caos/server` (S4 ledger Ev-2); no market-data migration across all 37
migrations 0001–0037; Bloomberg exists only as a name inside seeded frontend
fixture data (`lib/command/rvdata.ts`, `market-data.json`). **C5 (§5) builds
the entire layer**; only enterprise entitlements/credentials/parallel-run stay
outstanding at the gate.

---

## 1. Historical 2026-07-11 baseline — superseded

Verified 2026-07-11 against `origin/main@313ebac` by direct code inspection
and a live test run this session. Every row below is a re-derived fact, not
inherited from a prior grounding. **This section is retained for program
history only. Use the 2026-07-13 authoritative reconciliation above for every
current status or release decision.**

### Working and tested in the 2026-07-11 snapshot

| Area | Evidence |
|------|----------|
| Engine: 19 implemented modules (+4 spec-only, honestly routed "Not Implemented") emit real output via governed CP-X DAG | `caos/server/engine/`, `registry.py:152-170`; **1393 pass / 2 skip** this session (`caos/tests/server caos/tests/stress caos/tests/cohort`) |
| Model tiers (TEST/LITE/BALANCED/MAX) + OpenRouter/DeepSeek provider, default hybrid DeepSeek-v4 degrading to Anthropic w/o key | `caos/server/llm_client.py` and siblings |
| EDGAR CP-1 (US XBRL) + reported-disclosure lane (non-US/IFRS) | `edgar_cp1.py`, `reported_cp1.py`; VSAT/FUN/VMO2 goldens |
| Golden-master drift alarm in CI | `caos/tests/server/golden/test_golden_cp1.py` — runs inside the normal `pytest caos/tests/server` collection (no separate marker) |
| CP-5 QA gate + finding gates incl. the new `cp1_completeness_finding` (confident-but-empty foundation → MATERIAL/Restricted) | `engine/metrics.py` (landed in the `313ebac` drift window, commit `6a4f265`) |
| **RAG answer lane in Query — DONE, committed and wired end-to-end** (retrieval-grounded, chunk citations, entailment demotion) | `engine/queryanswer.py`, `entailment.py`, `provenance.py`, `memochunks.py`; `routes/query.py:223 POST /answer`; frontend `query/page.tsx` imports `queryAnswer`, `components/query/AiAnswer.tsx` |
| Monitor autonomy engine (Sentinel→Anomaly→Analyst→Reporter DAG) committed and tested | `engine/{autonomy,sentinel,anomaly,reporter}.py`, `engine/pipeline_executor.py`, `routes/autonomy.py`, `caos/tests/server/test_autonomy.py` |
| Command Center: live-aware `IssuerStrip` (resolves against live rows first, SAMPLE-tags the fallback) + live CP-0 Source-Gaps board | `command/page.tsx` (`usePortfolio`, `liveSelected`, `LiveCoverage`), `views.test.tsx` ("IssuerStrip live/seeded seam"); Source-Gaps board `_portfolio_gaps` + `lib/command/gaps.ts` (commit `62a04a5`) |
| Deep-Dive, Pipeline, Model Builder, Report Studio, Issuer Profile wired to live runs | `caos/frontend/src/app/*` |
| Auth: Caddy → oauth2-proxy → edge-secret fail-closed → in-app analyst profiles; fails closed in every shipped-artifact config | LAUNCH_PHASE1 §5 W1; confirmed by direct read of 4 boot guards in `main.py:47-87` |
| Optional multi-team tenancy mechanism (config-gated, default off) | `tenancy.py`, migration `0037_team_tenancy`, `test_tenancy.py` — orthogonal to E2 roles-lite (see trunk-state note) |
| LLM fault isolation (timeout/5xx never aborts a run; no LLM lane has tools/writes) | per-module Blocked gate / council `return_exceptions` / deterministic fallback |
| Deploy stack: single container + Postgres + vault volume + daily backups **+ opt-in off-host sync hook** | `caos/deploy/backup.sh:56-58` (`BACKUP_SYNC_CMD`), `.env.example` |
| Migration discipline: single head, `alembic check`, full up/downgrade round-trip tested on both py legs | `caos/tests/server/test_migrations.py` |
| Stress harness built (mock-Anthropic 429/529/hang, locust) | `caos/tests/stress/` — **never run at scale this program** (E1) |
| E2E (Playwright, storageState auth), a11y (axe), perf smoke (p95 gate) | `caos/tests/frontend/e2e/` (10 specs), `caos/frontend/scripts/a11y-axe.mjs`, `caos/tests/perf/smoke.py` |
| Feature tracker: 355 rows, 346 `Pass` / 9 `Pending Verification` (all Command "Sector Review" — CP-SR is `implemented=False` by design, not a defect) | `caos/docs/qa/FEATURE_TRACKER.csv` |
| `AUDIT.md` reconciled against the shipped tree, deploy-ready, no P0/P1 open | `caos/docs/AUDIT.md` (only S-4 row-authz [by-design, →Phase-2] and A-1 mock→engine epic tracked open) |
| All 9 QA playbooks present with procedure/invariants/risk-register/artifact path | `caos/docs/qa/playbooks/*.md` — see [PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md) §3 for the home/cadence/gate mapping |
| Pilot deployed on internal host from `main` | 2026-07-02, PR #93 merged |

### Gaps in the 2026-07-11 snapshot

| Gap | Evidence | Phase |
|-----|----------|-------|
| **`AlertSink`/`EmailSink`/`InAppSink` seam, watch-rule model, alert persistence, alert inbox — entirely absent on `origin/main`.** Monitor frontend still a labeled simulation there. Autonomy *engine* is committed but nothing turns its output into a persisted, actionable alert. *(A live `AlertInbox` UI now exists on the unmerged `feat/design-rebuild-p1` branch — see the 2026-07-12 update block above; the `AlertSink` interface itself is still unbuilt even there.)* | Zero hits (S4 Ev-1); `monitor/page.tsx:14-18,64-67` | C (C3-seam) |
| **Market-data layer — entirely absent.** No quote store, no `MarketDataProvider`/`BloombergProvider`/`ManualQuoteProvider`, no Sector RV refresh button, no Settings section. Bloomberg exists only as a name in seeded frontend fixtures. | Zero hits (S4 Ev-2); 37 migrations, none market-data | C (C5) |
| No `MOCK_LEDGER.md` mock-inventory deliverable | absent from tree | C (C1) |
| Command Center labeled sample sleeve board retained (though live-aware IssuerStrip + Source-Gaps board landed) | `command/page.tsx` "Sample portfolio — not live" | C (C2) |
| No querygraph node-count regression test (cap exists in code, zero test references it) | `querygraph.py:866 _GATE_NODE_CAP=300`; grep of `test_querygraph*.py` returns zero refs (S4 Ev-11) | A (A1) |
| No `golden_e2e` full-chain test, no `corpus_run` marker/CI — both absent | S4 Ev-3; goldens run inside normal pytest collection (CP-1-lane drift only, not upload→DAG→CP-5) | B (B1, B5) |
| 33/61-issuer breadth corpus: **selection delivered (MANIFEST now titled "61 Issuers"), zero fixtures captured** | `caos/tests/server/corpus/MANIFEST.md` — only file in the directory (S4 Ev-5) | B (B5) |
| No committee-pack `.xlsx` export — current export is a documented CSV stub | `components/model/export.ts:39-45` (S4 Ev-7) | C (C9) |
| No IC Decision Record, no head-to-head comparison walk, no concept-link (same-number-everywhere) suite | grep clean across `questions.ts`/`views.ts`/`synthesis.ts`, `caos/tests/frontend/e2e/` | C (C6/C7/C8) |
| Roles-lite (E2) not built — no `role` column, no `CAOS_ADMIN_EMAILS`, no role dependency. (The `team_id`/tenancy mechanism that landed 2026-07-10 is a *different*, orthogonal axis — cross-team isolation, not within-team roles.) | `database.py` has `team_id` columns only (S4 Ev-12) | E (E2) |
| No `audit_log` table, no SBOM, no DR runbook, no scripted restore drill (drill = shell *comments* in `backup.sh`) | grep clean; `backup.sh:13-19` | E, G |
| Unmerged: `feat/covenant-frontend` (1 orphan commit `3605c99`, frontend pages for the covenant register — the backend adapter, routes, and Query walks already shipped independently) | `git ls-remote --heads origin` | A (A3) |
| **12** open dependabot PRs (plan previously under-tracked this at 2) + 4 draft feature/infra PRs + 1 non-draft feature PR (#147 merged) *(re-verified 2026-07-12: down to 2 open — #139, #140 — the rest merged same-day per A5)* | GitHub MCP query, 2026-07-11 | A (A5) |
| 9 unmerged orphan branches (no open PR) + 18 remote branches merged & prunable | `git ls-remote --heads origin`, cross-checked via `git merge-base` | A (A6) |
| 8 dangling skill symlinks in `.claude/skills/` (targets removed by the 2026-07-08 skills audit) | S4 Ev-10 | A (A6b, new) |
| CI has not gone green on `main` since `ee37030` (#148); no `schedule:`/`workflow_dispatch:` trigger exists anywhere in `ci.yml` | S4 Ev-4 | — (tracked per-phase; automation work items in the loop doc) |
| Stress harness built but never run at pilot-plausible concurrency; no multi-worker deploy config | `caos/deploy/` grep clean for `--workers`/`WEB_CONCURRENCY` | E (E1) |

---

## 2. Phase overview

| Phase | Name | One-line | Size | Depends on |
|-------|------|----------|------|-----------|
| A | Trunk consolidation | merge/triage everything open, close known findings, reconcile trackers | ~3–5 days | — |
| B | Engine certification completion | both lanes clean on 3 goldens + captured breadth corpus, headless | ~2–3 wk | A |
| C | All concepts live | kill the mock: Monitor seam, market data, Command board, remaining seams | ~3–5 wk | B |
| D | Ingestion breadth | OCR provenance/golden, upload robustness matrix (RAG lane already done) | ~1 wk | B (∥ C) |
| E | Enterprise hardening | roles-lite, audit trail, secrets runbook, stress run, SBOM | ~2–3 wk | C |
| F | Beta — build the dictionary | 3–5 analysts, real coverage, gap log | ~3–4 wk cal. | C, D (∥ E) |
| G | Ops readiness | drills, alerting loop, load, DR, loops locked | ~1–2 wk | E |
| H | Pre-deployment gate + handover | full gate on prod-parity, transfer package | ~1 wk | all |

Sizes are planning aids, re-estimated at each phase exit (§13). D shrank
materially this grounding (D2 RAG lane is done); A shrank (A0's five P0
blockers from the 07-08 grounding are resolved — §15). C remains the largest
phase: it now carries both L-sized outstanding-item seams (C3-seam, C5) in
full, not just their remainders.

---

## 3. Phase A — Trunk consolidation & known-debt closure

**Objective:** one trunk, zero known open findings, trackers telling the
truth, tooling roots clean.

- [x] **A1 (S) — DONE on main.** `test_querygraph.py:167-257` constructs an
  over-cap finding history, pins `_GATE_NODE_CAP == 300`, and asserts the
  deterministic severity/newest slice contains exactly 300 nodes. Keep the
  cap test in the normal server suite.
- [x] **A2 (S)** ~~Merge `feat/query-route-fast-lane` → `main`~~ **DONE**
  (merged via PR #99).
- [x] **A3 (M)** **DONE 2026-07-11** — landed as PR #160 (merge 67017f01): full rebase of `3605c99` + 3 fixes, obsolete manual-rating fields dropped, profile/digest mounts rebuilt against current layouts (parallel partial #162 closed superseded). Residual: delete `feat/covenant-frontend` (A6 list). `feat/covenant-frontend` orphan commit `3605c99` (frontend
  pages: `/sponsors`, dominoes, register rows, digest panel). The **backend**
  half already shipped independently (`routes/sponsors.py`, `routes/digest.py`,
  `covenant-register`/`sponsor-graph` Query walks registered in
  `questions.ts`/`synthesis.ts`) — confirm on rebase whether the frontend
  commit still applies cleanly or needs a rebuild against current
  `components/command`. **Verify:** `git log --oneline main..
  origin/feat/covenant-frontend` shows the 1 commit; after merge, `npm run
  build` + the relevant e2e spec pass. **Exit:** `/sponsors` route renders
  live data; branch deleted post-merge.
- [x] **A4 (S)** ~~Land PR #95 (Sector RV DM/YTM plausibility guard)~~
  **DONE/superseded** — `origin/main` carries the `credibleDm` guard.
- [ ] **A5 (M) — live PR triage.** Eight PRs were open at the 2026-07-13
  reconciliation: #169, #184, and #187–#192. #187/#188 (C7), #189/#190
  (C9), and #191/#192 (C8) report green candidate/stamp checks but are still
  open; #169 has a server-test failure; #184 has cancelled checks. Record a
  merge/close/defer decision for each, resolve overlap between candidate and
  stamp PRs, then require a fresh green main-tip run after every accepted
  merge. **Verify:** refresh the GitHub open-PR list and checks at pickup.
  **Exit:** no PR older than 14 days lacks a decision, no duplicate candidate
  remains open, and accepted work is green on `origin/main` (L14).
- [ ] **A6 (S) — remote branch hygiene.** The 2026-07-11 classification found
  18 merged branches and 9 orphan branches; that count is historical and must
  not be reused as current evidence. Refresh remote refs, classify every head
  against `origin/main`, and delete only owner-approved merged/superseded
  heads. **Verify:** `git ls-remote --heads origin` plus
  `git merge-base --is-ancestor <branch> origin/main` per branch. **Exit:** 0
  merged-and-stale remote branches remain; every orphan has a disposition.
  Machine-local branch/worktree counts are diagnostic only, never a release
  metric.
- [x] **A6b (S) — new.** **DONE 2026-07-11** — all 8 dangling links removed (verify command returns empty); `outstanding` skill now cites `.venv311` + the ~1393/2 baseline. (Local `.claude/skills` is untracked, so there is nothing to merge.) Skills-root hygiene: 8 dangling symlinks in
  `.claude/skills/` whose `.agents/skills/` targets were removed by the
  2026-07-08 skills audit (`error-model-validation-architect`,
  `openrouter-typescript-sdk`, `implement-feature`, `critique`,
  `codebase-audit`, `compose-ui-test-server`, `distill`,
  `security-best-practices` — S4 Ev-10). PR #124 already restores
  `security-best-practices`; decide per-symlink: restore the target or remove
  the dangling link. Also refresh the `outstanding` project skill
  (`.claude/skills/outstanding/SKILL.md`), which still cites the retired
  py3.9 `.venv` and a "~317 pass" baseline. **Verify:** `find .claude/skills
  -maxdepth 1 -type l -exec sh -c 'test -e "$1" || echo DANGLING: $1' _ {} \;`
  returns empty. **Exit:** zero dangling links; `outstanding` skill cites
  `.venv311` and a current pass count.
- [x] **A7 (S)** ~~Refresh `AUDIT.md`'s stale header~~ **DONE** — already
  reconciled 2026-07-11 (independently of this plan): "Server: 1378 pytest ✓ /
  2 skipped," deploy-ready, no P0/P1. (Superseded by this session's own
  1393/2 run, which adds the `stress`+`cohort` dirs AUDIT.md's `server`-only
  count doesn't include.)
- [x] **A7b (S) — DONE on main.** All nine formerly-pending Sector Review
  rows were adjudicated against shipped behavior. `FEATURE_TRACKER.csv` is
  now **355/355 `Pass`**, 0 `Pending Verification`; CP-SR production compute
  remains separately and honestly tracked under UF-01/UW-19 rather than
  hidden in the UI tracker.

**Exit gate:** `main` is the only release branch (post A3/A6/A6b) · 0 open
non-dependabot PRs without a recorded decision · dependabot backlog ≤14 days
old (A5/L14) · CI green on `main` tip (**not true as of 2026-07-13: two E2E
failures**) · server suite green on the designated server venv (latest local:
1457 pass / 7 skip; latest main CI server job green) · `FEATURE_TRACKER.csv`
has 0 unresolved `Pending Verification` rows ·
0 dangling skill symlinks.

**Loops:** L1 (CI gate), L2 (code review), L3 (blast radius), L14 (dependency
triage), L15 (tracker sweep) — see the loop doc.

---

## 4. Phase B — Engine certification completion

**Objective:** the credit math is provably correct on real third-party
filings at the API layer, both lanes, before any UI work sits on top of it.
*(= DEVELOPMENT_PHASES Phase 1 remainder — 0/5 boxes checked there as of this
grounding, including the #25/#26/#27 engine-fault closure boxes.)*

- [x] **B1 (M) — DONE on main.** `golden/test_golden_e2e.py` covers VSAT,
  FUN, and VMO2 across keyless EDGAR/reported and keyed mock-LLM paths,
  including run-wide evidence resolution and CP-5. The `golden_e2e` marker is
  registered in `pytest.ini` and selected by `.github/workflows/nightly.yml`.
- [ ] **B2 (M)** *(Exec 2026-07-11: the no-dangling-citation floor landed inside PR #163 — `_assert_provenance_resolves_run_wide` sweeps every claim across every produced module on all 4 golden runs. Residual for B2 proper: lineage-class-aware sweep beyond chunk-existence.)* Provenance chain audit, golden-run-wide: for every claim in
  a golden run, assert `claim → evidence → chunk` resolves with no dangling
  citation ids, across the whole run rather than per-module (today's coverage
  is per-module/per-run: `test_engine.py:350`, `test_evidence_resolution.py`,
  `test_edgar_cp1.py:314` — real but not a golden-run-wide sweep). **Verify:**
  new test asserts zero dangling ids across a full golden run's claim set.
  **Exit:** test lands, green on all 3 goldens.
- [x] **B3 (S)** ~~`is_finite_number` sweep~~ **DONE.** Dedicated
  `test_nan_guards.py` plus corroborating coverage across ~11 files
  (`test_engine_math_degrade_guards.py`, `test_periods_safe_div.py`,
  `test_adjusted_guards.py`, `test_metricfactlane.py`, `test_liquidity.py`,
  `test_metricengine.py`, `test_recovery_waterfall_contract.py`,
  `test_audit_p0_fixes.py`, others). No further action required; keep as a
  standing invariant (CLAUDE.md engine-conventions).
- [x] **B4 (S) — DONE on main.** `test_cp5_gate_honesty.py` proves a pristine
  golden remains clean, an injected implausible leverage fact becomes
  MATERIAL/Restricted, and missing evidence becomes CRITICAL/Blocked.
- [ ] **B5 (L — own implementation plan at pickup)** Breadth corpus capture.
  **Selection delivered** — `caos/tests/server/corpus/MANIFEST.md` now names
  **61 issuers** (the original 30-name analyst cohort + 3 foreign
  reported-lane names from 2026-07-03, +28 from a second analyst list added
  2026-07-04 — see the MANIFEST's own "Batch 2" section). **Zero fixtures
  captured; no `corpus_run` marker; no CI wiring** (S4 Ev-3, Ev-5 — the
  directory contains only `MANIFEST.md`). Work: (a) **owner decision** — run
  the full 61-issuer set or re-scope to a 33-name subset for initial capture
  (the runtime-cap/shard rule below contains CI cost either way, so this is a
  scope call, not a blocker); (b) one live SEC/doc fetch per issuer, trimmed
  + frozen offline (same `_capture.py` pattern as the goldens); (c) register
  a `corpus_run` pytest marker; (d) assertions per issuer (property, not
  value): full 19-module DAG completes both lanes without exception · CP-5
  gate fires honestly · every claim's evidence chain resolves ·
  `is_finite_number` holds on all CP-1 divides · DM (where computed) lands in
  a plausible band · no surface returns a mock number tagged `prov=run`;
  (e) **promotion rule**: any corpus issuer exposing a new bug class gets
  hand-verified once and promoted into the frozen golden set. **Runtime cap:**
  parallelize, target <~5 min wall for the full run; shard nightly vs. a
  6-issuer per-PR smoke subset if it bloats. **Verify:** `pytest -m
  corpus_run -q` green; MANIFEST count matches captured-fixture count.
  **Exit:** ≥1 fixture captured per issuer in scope, `corpus_run` green,
  nightly wiring live (loop doc L6 work item).

**Exit gate:** both lanes clean on all 3 goldens (exact, `B1`) **and** all
in-scope corpus issuers (property, `B5`) · provenance test green (`B2`) · CP-5
honesty test green (`B4`) · `is_finite_number` invariant holds (`B3`, done) ·
0 CRIT/HIGH correctness faults open · `golden_e2e` + `corpus_run` markers run
in CI (loop doc L5/L6) · corpus MANIFEST + fixtures committed.

**Loops:** L4 (golden-master drift, already live per-PR), L5 (golden E2E —
work item), L6 (corpus breadth — work item).

---

## 5. Phase C — All concepts live (kill the mock)

**Objective:** every surface renders live engine/DB output or an explicit
empty state. Monitor gets a real alert seam. Market data gets a real
connector. **Largest phase — carries both L-sized outstanding-item builds in
full.** C3-seam and C5 each get their own implementation plan at pickup.

- [x] **C1 (S) — DONE on main.** `caos/docs/qa/MOCK_LEDGER.md` classifies
  every discovered seed source and user-facing consumer: 0 silent mocks,
  all remaining fixture use visibly labeled, with the burndown owned by
  C2/C3-seam/C4/C5. Re-run the ledger at the C exit gate.
- [ ] **C2 (M)** Command Center: replace the remaining labeled sample sleeve
  board (`command/page.tsx` "Sample portfolio — not live") with the real
  registry; empty registry → designed empty state. **Partially done already**
  — the live-aware `IssuerStrip` (resolves live rows first, SAMPLE-tags the
  fallback, `views.test.tsx` "IssuerStrip live/seeded seam") and the live
  CP-0 Source-Gaps board (`_portfolio_gaps`, commit `62a04a5`) landed this
  grounding window. Remainder: the sample sleeve table itself, and the
  "what changed" strip driven by run-delta facts. Board carries threshold
  filters + saved views (screener fold-in, expansion 4.7); maturity-wall
  panel (CP-3D refinancing rollup, expansion 4.4). **Verify:** `grep -n
  "Sample" caos/frontend/src/app/command/page.tsx` returns 0 (or only an
  explicit empty-state string). **Exit:** no unlabeled/labeled-sample data on
  the board in a prod build.
  *(2026-07-12, unmerged `feat/design-rebuild-p1` only: a "ranked-changes
  opener + combined governance panel" landed (commit `bc696b72`, P2-WP-2) —
  not yet independently verified against this item's `grep "Sample"` check;
  re-verify at C2 pickup rather than assuming it closes the item.)*
- [ ] **C3-seam (L — own implementation plan at pickup)** Monitor alert seam.
  **Latest:** the autonomy engine and the live ack/assign/resolve inbox are
  present; the current WIP also adds durable `AlertEvent` records. The
  production rule/evaluation/sink architecture is still absent, and the
  critical counter, replay rail, and email intelligence remain fixture-backed
  (UW-03/UW-10/UW-11/UW-13/UW-18; UF-02). Remaining work:
  - **Watch-rule model** (DB, alembic migration): rule = issuer/portfolio
    scope × signal type × threshold. Signal sources exist already: run
    completions, QA-gate flips, covenant findings (register), new-EDGAR-filing
    polls, DM moves (via C5, once it lands — include an out-of-bounds jump
    rule vs. trailing band), CP-1B monitoring + CP-1C peer-outlier findings.
    Schema reserves a `news` signal-type enum value (no producer yet) so a
    future news feed plugs in without a migration.
  - **Event generator**: evaluates rules on run completion + scheduled EDGAR
    poll; persists alerts (dedup on rule+issuer+fact).
  - **Alert inbox UI cleanup**: keep the live ack/assign/resolve path, derive
    every count/filter from persisted events, and retire or isolate
    `AlertFeed`/`simAlertsToday`/`EMAIL_TILES`; retain keyboard operation and
    provenance click-through.
  - **`AlertSink` seam**: `InAppSink` (live) + `EmailSink` (stub — logs,
    records "would have sent," renders the subject/body so the enterprise
    adapter is a transport swap only). Spec doc for SMTP + MS Graph variants.
    **This `EmailSink` stub is allowed-outstanding-item #1** — everything
    else in this bullet list must be live.
  - Kill the `EmailIntel` mock or rebuild it on `EmailSink`'s outbox records.
  - Surface "next expected filing" per issuer off the EDGAR poll (expansion
    4.9); the daily digest becomes an `AlertSink` consumer.
  **Verify:** `pytest caos/tests/server/test_autonomy.py
  caos/tests/server/test_alerts.py` (new) green; `grep -in
  "alertsink|emailsink" caos/server caos/frontend/src` returns hits (not
  zero). **Exit:** rule → event → inbox → `InAppSink` round-trips end-to-end
  from a golden-issuer run; `EmailSink` stub records intent with rendered
  subject/body; Monitor frontend has zero "Illustrative sample" markers left.
  The 2026-07-12 branch note above is historical; the 2026-07-13 UW/UF
  register is the source of truth for what remains.
- [ ] **C4 (M)** Deep-Dive / Report Studio residual seeded panels (from the
  C1 ledger): each → live adapter or explicit "no data / degraded" state. No
  unlabeled seed survives in a production build. **Verify:** C1's
  `MOCK_LEDGER.md` shows 0 open silent-mock rows in these surfaces. **Exit:**
  same.
- [ ] **C5 (L — own implementation plan at pickup)** Market data: quote
  store + Bloomberg connector. **Latest:** the current WIP contains normalized
  immutable snapshot/instrument tables and RV screen adapters, but only a
  bundled `REFERENCE` JSON snapshot. No production provider chain, manual
  import/refresh path, credential/status control plane, live recovery/downside
  inputs, exact portfolio mapping, or risk-budget adapter exists (UW-15,
  UW-17; UF-03). This is **allowed-outstanding-item #2**'s remaining build
  phase — only enterprise credentials/entitlements and parallel-run
  reconciliation should remain after it lands:
  - **Persisted quote store** (`market_quotes` migration): issuer/tranche →
    DM, price, as-of, source tag. The single source for all RV analysis
    app-wide — Sector RV table, Deep-Dive RV, CP-3 peer percentiles, Command
    Center marks, Query RV walks all read this store through one read-model.
  - `MarketDataProvider` interface + chain: `BloombergProvider` →
    `ManualQuoteProvider` (analyst-entered + CSV upload, live, tested).
    Unconfigured/unreachable Bloomberg degrades to manual with an explicit
    source tag — same fault-isolation invariant as the LLM lanes.
  - **`BloombergProvider` implemented** (transport chosen with enterprise
    licensing — BLPAPI Server API/B-PIPE or HAPI REST): field mapping to DM
    inputs, request throttling, error taxonomy. Tested offline against
    recorded response fixtures; live validation is outstanding item #2.
  - **Sector RV refresh button**: manual pull → provider chain → validate →
    upsert store → table re-renders with as-of timestamp, per-row source tag,
    stale-age indicator. Server-side rate limit. The existing `credibleDm`
    plausibility guard (A4) moves into the provider chain as the validation
    stage.
  - **Settings → Market Data section**: login/API requirements documented
    in-UI; connection config (transport + credentials — admin-only under E2
    once it lands); status readout (unconfigured/configured/live/
    unreachable); test-connection button; last-refresh + quota readout.
    Credentials are secrets: E4 inventory, masked in UI, never logged.
  **Verify:** `pytest caos/tests/server/test_marketdata.py` (new) green
  against recorded fixtures; `grep -n market_quotes
  caos/server/migrations/versions/*.py` returns a hit. **Exit:** Sector RV
  refresh round-trips against the fixture-backed `BloombergProvider`, degrades
  cleanly to manual on failure; Settings Market Data section live
  (admin-gated); all RV/DM surfaces read only the persisted quote store.
- [ ] **C6 (M)** Concept-link suite: one run flows Pipeline → Deep-Dive →
  Model Builder → Report Studio with the same number identical on every
  surface; Evidence Sync cross-pane selection; click-to-source from any
  conclusion. Does not exist today (grep clean across `caos/tests/frontend/
  e2e/`). **Verify:** new Playwright spec + API assertions pass. **Exit:**
  spec green, wired into the per-PR e2e job (loop doc L7 work item).
- [ ] **C7 (S)** Head-to-head issuer comparison — fifth Query walk (expansion
  4.3): register in `questions.ts`/`views.ts`/`synthesis.ts` per the Query
  design mandates (synthesis sentence first, committee exhibit = charts +
  narrative); side-by-side headline `metric_facts`, covenant register rows,
  CP-3 RV percentile + CP-2B fragility. **Verify:** `npm --prefix
  caos/frontend run test -- head-to-head` (new vitest spec) +
  `npx playwright test caos/tests/frontend/e2e/query_flow.spec.ts` (extended)
  green. **Exit:** walk answers a real query end-to-end. **Latest:** green
  candidate/stamp PRs #187/#188 remain open; capability is not on current
  checkout or `origin/main`.
- [ ] **C8 (M)** IC Decision Record (expansion 4.1): append-only per-issuer
  record — recommendation, conviction, thesis sentence, committee date,
  decision, dissent, link to the run/report it was based on. Surfaced on
  Issuer Profile + Command board; mutations follow the E3 audit pattern.
  Lands before F so the beta cohort dogfoods it. **Verify:** new table +
  route + UI; `pytest caos/tests/server/test_decision_record.py` (new)
  green. **Exit:** record created/read/appended through the real UI path.
  **Latest:** implemented in the current branch only; PRs #191/#192 remain
  open. Do not close until migrated and green on `origin/main`.
- [ ] **C9 (S–M)** Committee-pack `.xlsx` export (expansion 4.2): the current
  export is a documented dependency-free CSV stub (`export.ts:39-45`,
  S4 Ev-7); upgrade to real `.xlsx` via `openpyxl` (already a dependency for
  ingestion reads — `requirements.txt`) on the backend, or `npm i xlsx` on
  the frontend per the stub's own comment. Model Builder scenario grid +
  assumptions + headline `metric_facts`; every sheet stamped run id + as-of.
  **Verify:** export produces a valid `.xlsx` readable by openpyxl round-trip
  test. **Exit:** C6's same-number-everywhere assertion extends to the export.
  **Latest:** current checkout still exports CSV; green candidate/stamp PRs
  #189/#190 remain open and are not counted as delivered.
- [ ] **C10 (M) — worklist action semantics (UW-01–UW-03).** Decide and
  implement the real contract for issuer assign-owner/refresh/delete and the
  Sponsor primary review action. Omitted actions may stay omitted if the
  product decision is recorded; an existing action may not claim “review” if
  it only focuses a panel. Sponsor monitoring thresholds route through the
  C3 watch-rule API. **Verify:** API mutation tests plus Issuers/Sponsors UI
  tests cover success, partial batch failure, permissions, and audit rows.
  **Exit:** every named action either persists its promised state or is
  removed/renamed so no focus/navigation proxy reads as a completed review.
- [ ] **C11 (M) — persisted model scenario application (UW-07/UF-07).** Keep
  the current scenario lens, but add an explicit **Apply to model** transaction
  that previews affected cells, writes provenance-bearing overrides, forms
  one undo step, saves to the working draft, and can be captured in an
  immutable checkpoint. Reset must never erase unrelated manual overrides.
  **Verify:** scenario → preview → apply → undo/redo → save → reopen →
  checkpoint restore test. **Exit:** scenario buttons are no longer a
  session-only calculation when the analyst chooses to commit them.
- [ ] **C12 (S–M) — Upload run-mode semantics (UW-23).** Decide whether
  Full analysis / Update / Primary transaction are true engine plans or
  source-manifest classifications. If they are plans, add a validated
  run-template field to `POST /api/runs`, resolve it into an immutable module
  plan, stamp it on the run, and make retry/idempotency preserve it. If they
  are classifications, remove all copy claiming they route modules. **Verify:**
  one contract/E2E case per visible mode proves the queued run's plan matches
  its label; invalid/retired modes fail explicitly. **Exit:** no selected mode
  can queue the full route while claiming a narrower/different route.

**Exit gate:** `MOCK_LEDGER.md` (C1) burned to zero silent-mock and zero
unlabeled sample in prod build · C3-seam: rule → event → inbox → `InAppSink`
live end-to-end, `EmailSink` stub records intent · C5: all RV/DM surfaces
read only the persisted quote store, Sector RV refresh round-trips against
fixture-backed Bloomberg and degrades to manual, Settings Market Data section
live · concept-link suite (C6) green · C10 action semantics honest · C11
scenario application persists and round-trips · C12 selected run mode matches
the immutable server plan · a11y axe re-run clean on
new/changed routes (Monitor inbox especially — loop doc `design-a11y-ux`
playbook). C7–C9 are tracked here but **do not block this gate** (§14
expansion policy).

**Loops:** L7 (concept-link — work item), L8 (e2e, live per-PR), L9 (mock
regression — work item), L11 (a11y — manual per UI-phase exit), integration-
seams and llm-safety-grounding playbooks (loop doc §3) — C3-seam is a new
LLM-adjacent surface and must hold the fault-isolation invariant.

---

## 6. Phase D — Ingestion breadth

**Objective:** the ingestion funnel accepts what real analysts actually feed
it. Runs parallel to C after B. **Shrunk this grounding — D2 (RAG answer
lane) is done and moved to §1's working table.**

- [x] **D1 (M) — DONE on main via PR #183.** The real scanned-PDF golden
  exercises upload → pypdf-empty → `ocrmypdf`/Tesseract → chunk persistence
  and asserts `prov="ocr"` plus recognized values. The deploy image installs
  both native binaries. The golden skips on hosts without the binary, so H2
  must still execute the deploy-image leg rather than treating a skip as a
  fresh runtime confirmation.
- [x] **D2 (—)** ~~RAG answer lane in Query~~ **DONE.** Committed and wired
  end-to-end — see §1 working table for anchors. No further action.
- [x] **D3 (S) — DONE on main.** `test_upload_robustness.py` covers empty,
  non-PDF, lying extension, mid-read oversize, corrupt, encrypted, non-workbook,
  and zip-bomb-like containers. Every case is an explicit 4xx or a loud
  zero-chunk warning; none becomes silent success.
- [ ] **D4 (S) — partial on main.** The Issuer Profile quick-note entry point,
  vault upload/autolink path, immediate re-read, and frontend test have landed.
  Remaining exit evidence is the live manual RAG answer proving the new memo's
  chunk id is cited. The quick capture writes a tagged memo through
  `VaultMemoUpload`/`memochunks.py` without a new store or schema; the
  `analyst-notes` and `VaultMemoUpload` tests are already green. **Exit:** a
  memo logged from Issuer Profile is answerable via D2's RAG lane (confirm
  with a manual
  `POST /api/query/answer` call citing the new memo's chunk id).

**Exit gate:** scanned-PDF golden green with real-binary confirmation (D1) ·
D2 already done · upload matrix green (D3) · no ingestion path can succeed
silently with 0 chunks.

**Loops:** L10 (ingestion matrix, live-partial today, completes with D3).

---

## 7. Phase E — Enterprise hardening

**Objective:** safe to put in front of an enterprise security review.
"Functional" ≠ "safe to transfer" — this phase is the difference.

- [ ] **E1 (M) — partial on main.** `WEB_CONCURRENCY`, Postgres-gated
  multi-worker launch, advisory-lock migration safety, and a recorded
  15-user/60-second two-worker run (2,584 requests, 0 failures, p95 89 ms)
  have landed. Remaining: 2×-pilot calibration and durable cross-worker
  claiming for the research/report executors, which remain in-process. Already
  landed: per-analyst run cap
  (`config.py:210 caos_run_per_analyst_limit=3`, enforced `routes/runs.py:298`),
  identity-keyed rate limits across runs/vault/chat/models/digest/edgar/
  ingestion/issuers, SKIP LOCKED worker lease (`config.py:326`,
  `routes/autonomy.py:18`, `run_executor.py:248`). Missing: DB pool sizing at
  the final 2× target and a durable lease/reaper or documented single-worker
  boundary for research/report execution.
  **Verify:** `caos/server/.venv311/bin/python -m pytest caos/tests/stress`
  plus a locust run @ 2× pilot concurrency with mock-Anthropic fault
  injection; record and close what it finds. **Exit:** stress suite green at
  2× pilot concurrency with fault injection; multi-worker config committed
  and load-tested (feeds G3).
- [ ] **E2 (L — own implementation plan at pickup) — DECIDED 2026-07-03:
  roles-lite.** Confirmed not built (S4 Ev-12: only `team_id` columns exist,
  which is the orthogonal cross-team tenancy mechanism from `313ebac`, not
  roles). Three roles on the existing analyst-profile system:
  - **analyst** (default) — full workspace read/write, runs, uploads, watch
    rules.
  - **admin** — analyst rights + profile/role management + audit-log view +
    destructive ops (GDPR delete, registry reset) become admin-only.
  - **read-only** — PM/CIO view; every mutating route rejected server-side.
  Work: migration adding `role` column (default `analyst`); admin
  bootstrap via `CAOS_ADMIN_EMAILS` env (listed OIDC emails get admin on
  profile creation; empty in production = boot warning); one FastAPI role
  dependency on every mutating route (deny-by-default for read-only,
  admin-only list explicit) — UI hides what the server forbids, but the
  server is the boundary; role × route test matrix (analyst/admin/read-only
  vs. mutate/admin routes), forged-role and cookie-tamper attempts, bootstrap
  path test. **Verify:** `pytest caos/tests/server/test_roles.py` (new)
  green — includes the forged-role/cookie-tamper cases. **Exit:** role model
  enforced server-side on 100% of mutating routes; documented in the
  accepted-risk register + H3 admin guide.
- [ ] **E3 (M)** *(Exec 2026-07-12: PR #169 open — audit_log table (migration 0038) + audit.py write helper wired into every route mutating firm/shared state; GDPR erase extends its anonymize-not-delete pattern to audit_log; caught + fixed a real flush-outside-try 500-vs-409 bug in 4 routes along the way. Full suite 1417/2, one unrelated pre-existing test_retention.py failure at full-suite scale flagged as its own follow-up, not this PR's bug.)* Audit trail: append-only `audit_log` table (who/what/when/
  before→after) on every mutating route — issuer CRUD, uploads, deletes,
  rating edits, watch-rule changes, GDPR delete. Confirmed absent (no
  `audit_log` in `database.py`'s full table list). Runs already stamp
  `analyst_id`; this extends the pattern. Surface read-only in Settings.
  **Verify:** new migration + `pytest caos/tests/server/test_audit_log.py`
  (new) asserting a row on every mutating route class. **Exit:** 100% of
  mutating routes tested to write an audit row.
- [x] **E4 (S) — DONE on main.** `docs/reference/SECRETS.md` inventories and
  explains rotation for shipped secrets; `test_secret_log_hygiene.py` is
  mutation-verified and CI-wired. C5/H4 must append future Bloomberg/email
  credential names and rotation steps when those integrations exist.
- [ ] **E5 (M) — baseline pass, final rerun still required.** The 2026-07-12
  security-infra review passed all six gates with 0 new HIGH/MED findings and
  replaced the route-gate regex with an AST sweep. Keep this item open until
  the full post-C3/C5/E2/E3 diff is rerun. Already re-verified present: SSRF
  allow-list (`edgar.py:111,270`), CSP/HSTS (`test_security_headers.py`),
  GDPR-delete transactional integrity (`test_gdpr_erase.py`,
  `erase_analyst.py`). Remaining: run `/security-review` on the full diff
  since the last gate (covering C3-seam/C5's new LLM/network surfaces and
  E2/E3's new mutating routes); confirm the key safety property — no LLM
  lane has tools/writes — still holds after C3-seam lands; header-spoof +
  edge-secret checks (LAUNCH_PHASE1 §5) re-verify. CRIT/HIGH fixed, MED/LOW
  to the accepted-risk register. **Verify:** `/security-review` run recorded
  with 0 open CRIT/HIGH. **Exit:** same, plus register published.
- [x] **E6 (S) — DONE on main.** `docs/reference/SBOM.md` records locked
  backend/frontend packages, license findings, and the three accepted flags;
  no unflagged copyleft or unknown license remains in shipped paths.
- [ ] **E7 (S–M) — per-lane model routing (UW-12).** Either wire the three
  currently disabled Settings selectors into the run contract or remove the
  stored-but-inert fields from the production UI. A real implementation must
  validate an allow-listed provider/model per lane, stamp the resolved route
  on the run authority/audit record, preserve the workspace default, and fail
  closed to that default when a selected route is unavailable. **Verify:**
  Settings persistence + run dispatch tests prove each lane selection changes
  the executed route; an unavailable route produces an explicit recovery
  state. **Exit:** no permanently disabled/no-op production select remains.

**Exit gate:** stress suite green at 2× pilot concurrency with fault
injection (E1) · roles-lite implemented + tested (E2) · audit log on 100% of
mutating routes, tested (E3) · secrets runbook + grep test (E4) · security
review PASS with accepted-risk register (E5) · SBOM published (E6) · custom
model-lane routing is either live and audited or removed from production
Settings (E7).

**Loops:** L12 (stress — work item for weekly smoke; manual full run at
phase exits), L18 (security review — manual + live per-PR subset),
backend-api-data and security-infra playbooks (loop doc §3).

---

## 8. Phase F — Beta: build the dictionary

**Objective:** real analysts build real coverage; find the gaps only breadth
exposes. *(= DEVELOPMENT_PHASES Phase 3, unchanged in spirit — 0/5 boxes
checked there.)* Calendar-parallel with E after C+D land.

- [ ] **F1 (S)** Reset production registry to empty (launch default). **Keep
  the sealed golden set** — it is the regression net, never "cleanup." File
  anchor: production `Issuer` table (`caos/server/database.py`), excluding
  rows tagged in the golden fixture set. **Verify:** `SELECT count(*) FROM
  issuers WHERE ticker NOT IN ('VSAT','FUN','VMO2', ...corpus tickers)`
  returns 0 post-reset. **Exit:** registry empty except the sealed golden +
  corpus set.
- [ ] **F2 (—)** Onboard 3–5 analysts; each builds their own issuers via the
  real ingestion path (upload / EDGAR-vault). Brief them on LAUNCH_PHASE1 §6
  expectations + how to read provenance. File anchor: `LAUNCH_PHASE1.md §6`
  (briefing content). **Verify:** each onboarded analyst has ≥1 profile row
  (`SELECT * FROM analysts WHERE created_at > <F2-start-date>`) and has
  completed the briefing (recorded in F2's own onboarding log — create one
  if it doesn't exist). **Exit:** 3–5 analyst profiles active, each briefed.
- [ ] **F3 (M)** Coverage + gap log: every issuer attempted → certifiable or
  categorized gap (scanned-PDF/OCR quality, IFRS mapping, covenant not
  retrievable, market data absent…). Weekly triage (L20); CRIT/HIGH fixed
  in-phase. File anchor: new `caos/docs/qa/BETA_GAP_LOG.md`. **Verify:** the
  gap log has one row per attempted issuer with a terminal status
  (certifiable/categorized-gap) and, for each categorized gap, a severity.
  **Exit:** 0 uncategorized attempts; 0 open CRIT/HIGH gap rows.
- [ ] **F4 (M)** Feedback → golden growth: any analyst-reported wrong read
  becomes a fault-log entry (`caos/docs/qa/FAULT_LOG.md` — currently 0 open /
  6 closed); the fix adds that issuer to the golden set if it exposed a new
  bug class. Golden-master must stay green throughout. **Verify:**
  `caos/server/.venv311/bin/python -m pytest caos/tests/server/golden -q`
  stays green after every fault-log-driven fix lands. **Exit:** every
  analyst-reported wrong read has a `FAULT_LOG.md` row; golden set grew by
  ≥1 issuer for each row that exposed a new bug class.
- [ ] **F5 (S)** Monitor dogfood: analysts set real watch rules (requires
  C3-seam, §5); alert relevance feedback feeds rule tuning. File anchor:
  the watch-rule table C3-seam creates (`caos/server/database.py`, once it
  lands). **Verify:** `SELECT count(*) FROM watch_rules WHERE analyst_id IS
  NOT NULL` > 0 (real analyst-authored rules, not seed data); a feedback log
  (new `caos/docs/qa/MONITOR_DOGFOOD_LOG.md`) has ≥1 entry per active rule.
  **Exit:** every onboarded analyst (F2) has ≥1 real watch rule; feedback
  captured for each.

**Exit gate:** cohort has built ≥15 issuers (3–5 each, F2/F3) · certifiable
rate ≥80% with every failure categorized (F3) · gap-log CRIT/HIGH = 0 (F3) ·
golden set grew with any new bug class (F4) · golden-master green the whole
phase (F4) · **every onboarded analyst has set ≥1 real watch rule with
captured feedback (F5)** — F5 is core beta work, not a §14 expansion item,
and is included in this gate so it cannot silently remain open once the
phase is marked passed.

**Loops:** L20 (gap-log triage, weekly during F only).

---

## 9. Phase G — Ops readiness & loops locked

**Objective:** the boring operational muscle an enterprise handover assumes.

- [x] **G1 (S) — DONE on main.** `deploy/restore_drill.sh` restores Postgres
  and vault into scratch targets, checks data, cleans up, and fails closed on
  a corrupt dump. Compose, deploy README, and launch documentation expose the
  drill; L19 retains the quarterly handover cadence.
- [ ] **G2 (S)** Error-rate alerting — dogfood Monitor: a watch rule over the
  app's own logs/health (unhandled-exception count, run-failure rate, 5xx
  rate) → alert inbox via `AlertSink`. **Depends on C3-seam existing first.**
  No paid APM (by decision). File anchor: the watch-rule table + `AlertSink`
  seam C3-seam creates. **Verify:**
  `caos/server/.venv311/bin/python -m pytest
  caos/tests/server/test_ops_alerting.py -q` (new file — trigger a synthetic
  5xx/unhandled-exception burst against a test client and assert an alert
  lands in the inbox via `InAppSink`). **Exit:** rule live, test green.
- [ ] **G3 (M)** Load characterization: locust at enterprise-plausible
  concurrency (define with owner — e.g. 15 analysts × think-time) on
  prod-parity build; p95 targets per route class; document ceiling + first
  bottleneck. Builds on E1's multi-worker config. **Verify:** `performance`
  playbook §4(B)/(C) legs run against the isolated QA stack. **Exit:**
  documented ceiling, p95 targets met or exception filed.
- [x] **G4 (S) — DONE on main.** `docs/reference/DR_RUNBOOK.md` records the
  fresh-host recovery procedure and an isolated-host rehearsal that restored
  a real issuer from the off-host copy in 88 seconds. RPO/RTO and the
  total-loss risk when `BACKUP_SYNC_CMD` is unset are stated explicitly.
- [x] **G5 (S)** ~~Migration safety~~ **DONE** — `test_migrations.py` already
  covers single-head, `alembic check`, and a full up/downgrade round-trip on
  both py3.11 and py3.14 CI legs.
- [x] **G6 (S)** ~~Off-host backup copy~~ **DONE** — opt-in `BACKUP_SYNC_CMD`
  hook landed 2026-07-11 (`backup.sh:56-58`, `.env.example`). G1's restore
  drill should exercise this path at least once to close the loop.

**Exit gate:** restore drill from off-host copy PASS (G1, using G6's hook) ·
**error-rate alerting live and tested (G2)** — included in this gate for the
same reason as F5 above: it is core ops work, not a §14 expansion item, and
must not stay silently open once the phase is marked passed · DR rehearsal
PASS with stated RTO/RPO (G4) · load test PASS at agreed concurrency (G3) ·
migration up/down PASS (G5, done) · every loop-doc §2 loop relevant to a
landed phase has run ≥2 consecutive green cycles.

**Loops:** L13 (perf smoke), L19 (restore drill — manual + `HANDOVER` post-
transfer cadence).

---

## 10. Recurring verification — pointer

**All loop definitions, mechanism classes (LIVE / WORK-ITEM / MANUAL /
HANDOVER), and the 9-playbook scheduling table live in
[PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md).** Every phase
section above cites loop IDs (`L1`–`L20`) instead of restating cadence — this
is deliberate: a cadence word with no loop ID in the other document is not a
claim this program makes. If a phase exit needs a loop that doesn't exist
yet, the loop doc names it as a `WORK-ITEM` with a file anchor (almost always
`.github/workflows/nightly.yml`, itself a new file — see loop doc §5).

---

## 11. Phase H — Pre-deployment gate & handover package

**Objective:** prove the end state and package the transfer.

- [ ] **H1 (M)** Full [LAUNCH_PHASE1 §5](LAUNCH_PHASE1.md) checklist on a
  prod-parity host (`.venv311` / fastapi pin), every box, no skips (currently
  16/16 unchecked there — by nature, these are deploy-time checks).
- [ ] **H2 (S)** Full regression stack green on that build in one sweep:
  golden-master + golden E2E + concept-link + e2e + stress + a11y + perf +
  ingestion matrix. Reuses the `workflow_dispatch:` trigger the loop doc's
  `nightly.yml` work item adds (§5 there) — one CI dispatch, results
  archived. **Verify:** the dispatched run's summary. **Exit:** all green in
  one archived run.
- [ ] **H3 (M)** Handover package (`caos/docs/handover/` — does not exist
  yet, S4 Ev-9):
  - Architecture overview (refresh README/docs to as-built)
  - Admin guide: deploy, env/secrets inventory (names, not values), rotation
    runbook (E4), backup/restore (G1), DR (G4), scaling notes (G3), role
    assignment procedure (E2)
  - Analyst onboarding guide (from F briefings)
  - OpenAPI export + endpoint inventory
  - SBOM/license report (E6)
  - Accepted-risk register (E2/E5 decisions, signed)
  - Support model: issue intake, triage SLA, release cadence — this is also
    where the `HANDOVER`-class loops (quarterly security review, quarterly
    restore drill) get a named owner post-transfer.
  **Verify:** `ls caos/docs/handover/` shows all 7 listed sub-documents,
  each non-empty and dated. **Exit:** package complete; PM/CIO can execute
  the H5 sign-off from it without asking a follow-up question.
- [ ] **H4 (S)** The two outstanding-item activation packages, transfer-ready:
  - `EmailSink` adapter spec: SMTP + MS Graph variants; auth, rate limits,
    template rendering already proven by the stub's outbox records (C3-seam);
    test plan.
  - **Bloomberg activation runbook** (connector already built + fixture-
    tested in C5): entitlement checklist (transport per enterprise licensing
    — SAPI/B-PIPE or HAPI; EIDs; network path), credential entry via the
    Settings Market Data section (test-connection green), then the
    **parallel-run reconciliation** — Bloomberg vs. manual marks on golden
    issuers, material diffs explained and signed off before cutover
    (DEVELOPMENT_PHASES Phase 5 is executed by/with enterprise, never
    flip-the-switch). Rollback = provider chain falls back to manual.
  **Verify:** `caos/docs/reference/EMAILSINK_SPEC.md` and
  `caos/docs/reference/BLOOMBERG_ACTIVATION_RUNBOOK.md` (both new) exist,
  each with a named transport decision and a test plan. **Exit:** both
  packages reviewable by enterprise IT/licensing without further CAOS-side
  work.
- [ ] **H5 (S)** Sign-off (table below). **Verify:** each row's "Sign-off"
  cell is filled with a name + date, not blank. **Exit:** all three rows
  signed.

| Role | Gate | Sign-off |
|------|------|----------|
| Deploying engineer | H1 + H2 green | |
| Head of Research / QA | golden set + gap log + CP-5 gate | |
| PM / CIO | accepted-risk register + the two named outstanding items | |

**Exit gate = pre-deployment reached:** every phase gate A–G passed
(including F5's dogfood row and G2's alerting row above, so no unlisted item
survives outside the two named seams) · H1/H2 green · handover package
complete (H3) · both outstanding-item packages ready (H4) · H5 signed ·
outstanding items = exactly two: the `EmailSink` adapter (spec'd) and
Bloomberg activation (connector built; runbook ready). **Verify:** re-run the
`grep -c "^- \[ \]" caos/docs/PRE_DEPLOYMENT_PLAN.md` sanity check — every
remaining open checkbox at this point should be inside H4's own two
activation-package bullets, nothing else.

---

## 12. What an app like this is expected to have — coverage map

Senior-engineer expectations for an institutional numbers platform, mapped so
nothing is missing by omission. "By design" links to a recorded decision.

| Expectation | Status today | Covered by |
|-------------|--------------|-----------|
| SSO / domain-restricted auth | ✅ oauth2-proxy + Google OIDC | exists; enterprise IdP = transfer config (H3) |
| In-app identity / profiles | ✅ analyst profiles, signed cookie | exists |
| Authorization model | ⚠️ single-team + optional config-gated cross-team tenancy mechanism (off by default) | **E2 — roles-lite decided, not built** |
| Audit trail | ⚠️ runs/decision events only; firm-wide append-only log is not on main | E3; PR #169 remains open |
| Rate limiting / abuse caps | ✅ per-analyst run cap + identity-keyed limits | E1 closes multi-worker gap |
| Secrets management + rotation | ✅ fail-closed + shipped rotation/log-hygiene runbook | E4 done; append future market/email credentials in C5/H4 |
| Dependency scanning | ✅ Dependabot + policy | A5 + L14 loop |
| Malware scanning on upload | ✅ clamav | exists |
| SSRF / egress control | ✅ allow-list | re-verified E5 |
| Security headers / TLS | ✅ Caddy + CSP/HSTS | re-verified H1 |
| Pen-test style review | ⚠️ 2026-07-12 baseline pass; final-diff rerun outstanding | E5 + loop doc L18 |
| SBOM / license compliance | ✅ shipped report; no unflagged non-permissive license | E6 done |
| Backups | ✅ daily + rotation + opt-in off-host sync | exists (G6 done) |
| Restore drills | ✅ scripted and real failure path verified | G1 done; quarterly L19 cadence |
| DR / host-loss plan | ✅ fresh-host runbook rehearsed from off-host copy | G4 done; H2 final-build rehearsal |
| Observability (logs) | ✅ structured, contextual | exists |
| Alerting on errors | ❌ (depends on C3-seam) | G2 |
| APM | ❌ **by design** (no paid services) | recorded decision |
| Load testing | ⚠️ 15-user/2-worker run passed; 2× pilot calibration remains | E1, G3 |
| Migrations discipline | ✅ alembic self-migrate + up/down round-trip test | done (G5) |
| Graceful LLM degradation | ✅ fault isolation by construction | exists; re-proven at each LLM-surface phase exit |
| Market-data integration | ⚠️ normalized REFERENCE snapshot/run WIP; no live/manual provider chain | C5 connector + store + refresh + Settings; H4 activation w/ entitlements |
| Monitor alert seam | ⚠️ live inbox/state WIP; no watch-rule/sink/email pipeline | C3-seam; H4 EmailSink activation |
| Data retention | ✅ run-fact pruning | exists |
| GDPR delete | ✅ transactional | re-verified E5 |
| Empty/error/degraded states | ⚠️ explicit shared state contract shipped; reference/live route gaps remain | C4 plus UW/UF register |
| Accessibility | ✅ latest local sweep: 0 serious/critical axe findings on 15 routes | rerun on immutable H1 build; loop doc `design-a11y-ux` |
| i18n | ❌ **by design** — single-desk English product | note in H3 |
| Multi-tenancy | ⚠️ mechanism exists (config-gated, off) but **by design** default is one shared team | SECURITY §2, H3; `tenancy.py` |
| API documentation | ✅ OpenAPI | exported H3 |
| Runbooks (deploy/rollback) | ✅ LAUNCH_PHASE1 | rehearsed G/H |
| User onboarding docs | ⚠️ §6 briefing only | H3 guide |
| Support/maintenance model | ❌ | H3 |
| Feature tracking / QA ledger | ✅ 355/355 `Pass` | A7b done; per-phase sweeps keep it current |
| Regression corpus (exact) | ✅ 3 sealed goldens | grows in F + via B5 promotion |
| Test corpus (breadth) | ⚠️ selection delivered (61 issuers), 0 fixtures captured | B5 |

This table covers *platform/ops* expectations. The **product-capability**
expectation map (analyst-workflow lifecycle: screen → analyse → model →
decide → monitor → compare → distribute) lives in
[FEATURE_IDEATION_2026-07-03.md](FEATURE_IDEATION_2026-07-03.md) §3, with its
open items tracked as §14 expansion backlog here.

---

## 13. Ways of working (applies to every phase)

- **Gates are hard.** CRIT/HIGH block exit; MED/LOW get tracker rows, not
  heroics. Do not chase perfection past a gate.
- **One implementation plan per L item** (B5, C3-seam, C5, E2) written **at
  pickup**, in plan mode, output to `docs/superpowers/plans/` following the
  existing convention in this repo — this document stays at program altitude.
- **TDD default** on engine/API work; UI work ships with its E2E/a11y checks
  in the same PR.
- **Impact before edit, `detect_changes` before commit** (GitNexus, per
  CLAUDE.md — non-negotiable).
- **Frequent small merges to `main`;** long-lived branches are how the A0
  incident happened (§15) — never commit code that references still-
  uncommitted implementation files; land features as one coherent commit or
  stack, not committed-refs-ahead-of-files.
- **Docs lie until reconciled** — status claims come from code/tests, not
  trackers; per-phase sweeps (L15) keep them honest.
- **Confidence and goal audits at every phase exit** (L16, L17) — a
  fresh-context review thread re-grounding this plan's status claims and
  scope against the live code before calling a gate closed; see loop doc
  L16/L17.
- **Re-estimate at each gate.** The sizes in §2 are planning aids, not
  commitments.

---

## 14. Expansion backlog — product-capability items

Source: [FEATURE_IDEATION_2026-07-03.md](FEATURE_IDEATION_2026-07-03.md)
(§ numbers below) + the PM review of 2026-07-03. **Policy unchanged from
prior grounding: expansion items are MED by rubric — they never block a
phase exit gate.** The in-phase ones ride their host phase and carry an
*(expansion 4.x)* tag: C2 (maturity wall, screener filters), C3-seam
(out-of-bounds DM jump rule, peer-outlier signal, `news` enum reservation,
filing calendar, digest-as-sink-consumer), **C7–C9**, **D4**. The rest queue
here with a named unblocking event — none is scheduled by default.

- [ ] **X1 (M–L, own plan)** Amendment / credit-agreement diff (4.5) —
  deterministic redline + structured covenant-term delta. **Unblock:** D1
  (OCR) + F-phase evidence that register extraction is reliable on
  amendments.
- [ ] **X2 (M)** Terms-vs-precedent benchmarking (4.6) — basket/add-back
  looseness percentiled against the register corpus. **Unblock:** F exit
  (≥15-issuer corpus).
- [ ] **X3 (M)** Covenant compliance calendar (4.6b) — cert due/test dates.
  **Unblock:** register date-field extraction proven reliable in the F gap
  log.
- [ ] **X4 (M)** Analyst call tracking / hit rate (4.8). **Unblock:**
  post-transfer real marks (Bloomberg cutover, outstanding item #2). C8's
  timestamps make this retroactive from day one.
- [ ] **X5 (L, own plan)** Sector dashboards — CP-SR (4.10). **Unblock:**
  post-transfer (needs F breadth **and** real marks).
- [ ] **X6 (M–L, own plan)** Actionable-intel lane. **Unblock:** C3-seam
  (alert schema + inbox) — **now unblocked once C3-seam lands**, still
  unscheduled by default.
- [ ] **X7 (L, vendor + integration)** Intel transport (automated inbound
  half of X6). **Unblock:** Phase-2 vendor feed decision (PHASE2_SCOPE §B).

### Query concept-data collection (gap audit 2026-07-04)

**Shipped (Phase-C Query walks, no migration):** covenant register cross-
issuer walk, sponsor/counterparty graph — both live in `questions.ts`/
`views.ts`/`synthesis.ts`.

**Backlog — concept artifacts Query still should collect:**

- [ ] **X8 (M)** Deep-research reports → Query. **Unblock:** D2 — **now
  satisfied** (D2 shipped this grounding window); unblocked, unscheduled.
- [ ] **X9 (M)** Saved models/forecasts → Query. **Unblock:** none technical
  — queue behind C7 so the model-vs-model view lands once.
- [ ] **X10 (S–M)** Archived deliverables → vault. **Unblock:** none — ride a
  Report Studio export change (natural pairing with C9).
- [ ] **X11 (M)** Digest history snapshots. **Unblock:** C3-seam
  digest-as-sink work.
- [ ] **X12 (M)** Promote graph expansion from a measurement harness into
  production retrieval. **Unblock:** prove the staged expansion improves
  answer quality within the latency/token budget; then integrate it with
  `retrieve_corpus` behind a kill switch and regression corpus.
- [ ] **X13 (M)** Vault peer/sponsor identity edges. **Unblock:** CP-1C and
  sponsor extraction must persist evidence-backed entity identities rather
  than aggregate counts; export only source-linked, canonicalized edges.
- [ ] **Market-spread RV / `market_quotes`** — tracked: **C5** (store) +
  **X5** (sector dashboards); Bloomberg = outstanding #2, post-transfer.

---

## 15. Program history (compact)

- **2026-07-03:** Initial full grounding; 33-issuer corpus selected;
  Bloomberg-in-plan (C5) and roles-lite (E2) product decisions recorded.
- **2026-07-08:** Working-branch grounding found **five P0 blockers (A0)** —
  commits landed referencing still-uncommitted implementation files (main.py
  importing untracked `routes/autonomy.py`; alembic chain gap; pgvector
  imported-not-declared; prod DB missing the vector extension; 3 red tests).
  Root cause: features committed ahead of their own files.
- **2026-07-08 → 2026-07-11:** All five A0 items resolved on `main` — verified
  this session by direct code inspection (autonomy routes/migrations
  committed and tested, pgvector declared + extension-created migration
  present, suite green). The A0 incident is the source of the "frequent
  small merges" rule in §13 — do not repeat the pattern.
- **2026-07-11 (this document):** Full re-grounding against `origin/main`.
  Corrected several stale claims in both directions: flipped **DONE** where
  the prior plan under-credited shipped work (A7, B3, D2, G5, G6); flipped
  **the two allowed-outstanding items from "seam built, transport pending"
  to "seam entirely unbuilt"** (C3-seam, C5) — the single largest correction,
  since it changes what "only two items outstanding" actually requires;
  corrected dependabot count from 2 to 12; split the monolithic plan into
  three documents (this one, the QA loop doc, the skills shortlist) to keep
  status and mechanism claims from drifting independently, which is how the
  "nightly loop" cadence claims went stale the first time (no `schedule:`
  trigger ever existed in `ci.yml`).
- **2026-07-12:** `origin/main` advanced to `14cb9c53` (merged #165 D4-stamp,
  #167 C1/E4/E6-stamp — those items' exec-notes above are current as of that
  SHA). Live dependabot re-check: 2 open (#139, #140), not 12 — confirms A5's
  same-day merge narrative. Separately, this update was written from an
  **unmerged working branch**, `feat/design-rebuild-p1` (15 commits ahead of
  `origin/main`, plus uncommitted WIP) — a P1-WP/P2-WP design-rebuild
  initiative not yet reconciled into the A–H phase-letter structure. It
  contains real, concrete progress on C3-seam's alert-inbox/persistence
  bullets (`alert_states` migration, live `AlertInbox` UI, `useAutonomyDraft`
  wiring) but **not** the `AlertSink`/`EmailSink` interface itself, and the
  branch's test suite is **currently broken** (22 failed / 319 errors on
  `.venv311`) under in-flight WIP touching core server files — not a
  deploy-ready state. See the "2026-07-12 update" block after the Trunk
  state table for the full delta. **Next full grounding should**: (a)
  reconcile the P1-WP/P2-WP commits against the phase-letter structure once
  merged, (b) re-run the suite clean once the WIP settles, (c) decide whether
  the branch's direct alert-inbox approach supersedes or complements the
  `AlertSink`/`EmailSink` interface C3-seam specifies.
