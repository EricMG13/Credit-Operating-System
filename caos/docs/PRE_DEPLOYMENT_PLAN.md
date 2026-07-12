# CAOS — Pre-Deployment Program Plan

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

**Goal:** take CAOS from today's state (engine certified, 5 concepts live to
varying degrees, pilot deployed) to **pre-deployment**: the final stage before
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

## Trunk state (this grounding)

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

## 1. Current state — evidence, not aspiration

Verified 2026-07-11 against `origin/main@313ebac` by direct code inspection
and a live test run this session. Every row below is a re-derived fact, not
inherited from a prior grounding.

### Working and tested today

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

### Not live / not done (the gap this plan closes)

| Gap | Evidence | Phase |
|-----|----------|-------|
| **`AlertSink`/`EmailSink`/`InAppSink` seam, watch-rule model, alert persistence, alert inbox — entirely absent.** Monitor frontend still a labeled simulation. Autonomy *engine* is committed but nothing turns its output into a persisted, actionable alert. | Zero hits (S4 Ev-1); `monitor/page.tsx:14-18,64-67` | C (C3-seam) |
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
| **12** open dependabot PRs (plan previously under-tracked this at 2) + 4 draft feature/infra PRs + 1 non-draft feature PR (#147 merged) | GitHub MCP query, 2026-07-11 | A (A5) |
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

- [ ] **A1 (S)** *(Exec 2026-07-11: PR #154 open — reviewed, single-file test w/ exact-slice oracle; merge after #158 unbreaks CI.)* Querygraph node-count regression test. Cap exists
  (`querygraph.py:866 _GATE_NODE_CAP=300`, used at `:886`; sibling
  `_WIKI_RUN_CAP=300` at `:1246`) but zero tests assert the bound (S4 Ev-11).
  Build the graph against a seeded 100-run history and assert node count
  stays ≤300. **Verify:** new test in `caos/tests/server/test_querygraph.py`
  passes; `git grep -c GATE_NODE_CAP caos/tests/server/test_querygraph*.py`
  returns ≥1. **Exit:** test lands and is green.
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
- [ ] **A5 (M)** *(Exec 2026-07-11 evening: decisions for every open PR recorded in `caos/docs/qa/PR_TRIAGE_2026-07-11.md` (PR #159). The list below is stale — 9 of the 12 dependabot PRs merged same-day, and one of them (#141 typescript 7) broke 3 CI jobs on main → revert PR #158, merge first. #157 completes #135's lock regen. Merged same evening: #155, #157, #160, #161 — close #135 as superseded; #150 verdict = rebase+rescope, do not merge as-is; #158 revert is the remaining unblock.)* PR triage, current as of 2026-07-11 (**12** open dependabot,
  not the previously-tracked 2): **#85** alembic 1.13→1.18, **#88** fastapi
  0.138→0.139 (do not downgrade the 0.138 pin — an upgrade needs py3.11/
  starlette re-verify), **#133** playwright/test 1.60→1.61.1, **#134**
  actions/checkout 4→7, **#135** uvicorn 0.49→0.51, **#136** tailwindcss
  4.3.1→4.3.2, **#137** mypy ~=2.1→~=2.2, **#138** anthropic ≥0.116<2,
  **#139** vitest 3.2.6→4.1.10, **#140** @vitest/coverage-v8 3.2.6→4.1.10,
  **#141** typescript 5.9.3→7.0.2 (major — held pending react/tailwind4
  policy re-check), **#142** @playwright/test 1.60→1.61.1. Plus non-dependabot:
  **#118** (Cursor Cloud dev env, draft) — adopt/close decision;
  **#124** (restores `security-best-practices` skill symlink — feeds A6b),
  **#127** (fable-5-prompter skill rework), **#144** (Query/Command triage
  fixes) — all drafts, review for merge; **#147** (security-audit fixes) —
  merged 2026-07-11, no action needed;
  **#150** (lease-gated boot sweep for research/report/pipeline jobs) —
  non-draft, review for merge. **Verify:** `mcp__github__list_pull_requests`
  state=open count. **Exit:** every PR above has a recorded
  merge/close/defer decision; 0 PRs older than 14 days without one (L14).
- [ ] **A6 (S)** *(Exec 2026-07-11: all 27 remote branches classified; 18 verified merge-base-ancestor with the ready-to-run delete command, and per-orphan dispositions (4 verified superseded incl. the re-synced security brief), recorded in `caos/docs/qa/PR_TRIAGE_2026-07-11.md`. Deletion itself left to the owner.)* Remote branch hygiene: **18 branches fully merged into
  `main`** (safe to delete — includes `fix/vmo2-followups`,
  `feat/command-center-layout-and-sector-rv-cleanup`,
  `feat/query-route-fast-lane`, `feat/fold-profile-rv`, the merged `claude/*`
  set) and **9 unmerged
  orphans with no open PR** (`fix/rv-dm-plausibility-guard` and several
  `claude/*-brief-*` branches — triage each: land, close, or delete). Keep
  `feat/covenant-frontend` until A3 lands. **Verify:** `git ls-remote --heads
  origin` + `git merge-base --is-ancestor <branch> origin/main` per branch.
  **Exit:** 0 merged-and-stale remote branches remain; every orphan has a
  disposition. *(Local branch/worktree counts from the prior 2026-07-08
  grounding — "43 local branches, 10 worktrees" — describe the developer's
  own machine and are not verifiable from a fresh clone; re-check locally at
  pickup, do not carry the stale number forward.)*
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
- [ ] **A7b (S) — new.** *(Exec 2026-07-11: PR #159 open — all 9 rows verified against shipped code (sector routes + workspace tests, 2 coverage gaps closed to make it honest) and flipped to Pass; tracker 355/355 terminal.)* Adjudicate the 9 `FEATURE_TRACKER.csv` rows still
  marked `Pending Verification` (all Command "Sector Review":
  command-29/30/31/47/48/49/50/51/57). CP-SR is registered
  `implemented=False` by design (spec-only, honestly routed "Not
  Implemented" per `registry.py:152-170`) — likely resolution is "flip to
  N/A, tracked as CP-SR scope" rather than a code fix, but confirm each row
  individually. **Verify:** re-run the CSV status count after edit — 0 rows
  should remain `Pending Verification` without a recorded reason. **Exit:**
  all 355 rows carry a terminal status.

**Exit gate:** `main` is the only active branch (post A3/A6/A6b) · 0 open
non-dependabot PRs without a recorded decision · dependabot backlog ≤14 days
old (A5/L14) · CI green on `main` tip (re-check — not true as of this
grounding) · server suite green on `.venv311` (this session: 1393 pass / 2
skip) · `FEATURE_TRACKER.csv` has 0 unresolved `Pending Verification` rows ·
0 dangling skill symlinks.

**Loops:** L1 (CI gate), L2 (code review), L3 (blast radius), L14 (dependency
triage), L15 (tracker sweep) — see the loop doc.

---

## 4. Phase B — Engine certification completion

**Objective:** the credit math is provably correct on real third-party
filings at the API layer, both lanes, before any UI work sits on top of it.
*(= DEVELOPMENT_PHASES Phase 1 remainder — 0/5 boxes checked there as of this
grounding, including the #25/#26/#27 engine-fault closure boxes.)*

- [ ] **B1 (M)** *(Exec 2026-07-11 late: PR #163 open — golden/test_golden_e2e.py runs the full chain offline on all 3 goldens, keyless EDGAR + reported lanes AND a keyed mock-LLM lane; `golden_e2e` marker registered in a new repo-root pytest.ini; .github/workflows/nightly.yml created with schedule+workflow_dispatch running `-m golden_e2e` (loop L5). Also freezes that CP-2 is the only LLM-bound module offline. Suite 1397/2 in-tree.)* Full-chain golden test: each golden issuer (VSAT, FUN, VMO2)
  **keyless** (EDGAR/reported lane) and **keyed** (LLM synth) end-to-end via
  `TestClient` — upload → chunk → 19-module DAG → CP-5 gate — asserting
  output matches frozen goldens. **The `-m golden_e2e` marker does not exist
  today** (S4 Ev-3); today's goldens (`caos/tests/server/golden/
  test_golden_cp1.py`) assert CP-1 numeric drift only, not the full chain.
  Create the marker (register it in a `pytest.ini`/`pyproject.toml` marker
  list — none exists yet either) and the full-chain test. **Verify:** `pytest
  -m golden_e2e -q` passes on all 3 issuers × both lanes. **Exit:** marker
  registered, test green, wired into CI (loop doc L5 work item).
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
- [ ] **B4 (S)** *(Exec 2026-07-11: PR #159 open — `test_cp5_gate_honesty.py` green on `.venv311`: pristine golden passes clean; injected bad figure → CP-1-LEV-PLAUS MATERIAL/Restricted; dropped evidence → CRITICAL/Blocked.)* CP-5 gate honesty re-check: inject one known-bad figure into
  a golden fixture copy; assert the gate raises a finding and the run aborts.
  No such test exists today (adjacent harnesses — `test_grounding.py`,
  `test_tier2_findings_contract.py`, `golden/test_golden_query_gates.py` —
  cover related ground but not this injection case). **Verify:**
  `caos/server/.venv311/bin/python -m pytest
  caos/tests/server/test_cp5_gate_honesty.py -q` (new file) green. **Exit:**
  test lands, green.
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

- [ ] **C1 (S)** *(Exec 2026-07-12: PR #166 open — MOCK_LEDGER.md delivered; 0 silent-mock rows, all seed consumers visibly labeled; burndown mapped to C2/C3-seam/C4/C5; 2 MED watch-items. L9's grep list = the ledger's seed-module import table.)* Mock inventory: grep every route/component for seeded/
  sample/sim imports; classify each hit live / labeled-sample / silent-mock.
  Deliverable: `caos/docs/qa/MOCK_LEDGER.md` (file:line burndown list — does
  not exist today, S4 Ev-9). Silent-mock = CRIT, labeled-sample = MED.
  **Verify:** ledger file exists and is non-empty. **Exit:** every hit
  classified; feeds C2/C4's remaining scope.
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
- [ ] **C3-seam (L — own implementation plan at pickup)** Monitor alert seam.
  The autonomy **engine** (Sentinel→Anomaly→Analyst→Reporter DAG) is
  committed and tested (`engine/autonomy.py` et al., `test_autonomy.py`) —
  that part is done. What's missing, confirmed zero-hit (S4 Ev-1):
  - **Watch-rule model** (DB, alembic migration): rule = issuer/portfolio
    scope × signal type × threshold. Signal sources exist already: run
    completions, QA-gate flips, covenant findings (register), new-EDGAR-filing
    polls, DM moves (via C5, once it lands — include an out-of-bounds jump
    rule vs. trailing band), CP-1B monitoring + CP-1C peer-outlier findings.
    Schema reserves a `news` signal-type enum value (no producer yet) so a
    future news feed plugs in without a migration.
  - **Event generator**: evaluates rules on run completion + scheduled EDGAR
    poll; persists alerts (dedup on rule+issuer+fact).
  - **Alert inbox UI**: live feed replacing the `AlertFeed`/`simAlertsToday`/
    `EMAIL_TILES` mock (`monitor/page.tsx:14-18,64-67`); ack/resolve states;
    keyboard-operable; provenance click-through.
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
- [ ] **C4 (M)** Deep-Dive / Report Studio residual seeded panels (from the
  C1 ledger): each → live adapter or explicit "no data / degraded" state. No
  unlabeled seed survives in a production build. **Verify:** C1's
  `MOCK_LEDGER.md` shows 0 open silent-mock rows in these surfaces. **Exit:**
  same.
- [ ] **C5 (L — own implementation plan at pickup)** Market data: quote
  store + Bloomberg connector. Confirmed entirely absent (S4 Ev-2; 0/38
  migrations touch market data). This is **allowed-outstanding-item #2**'s
  entire build phase — only enterprise entitlements/credentials/parallel-run
  reconciliation should remain outstanding after this item lands:
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
  green. **Exit:** walk answers a real query end-to-end.
- [ ] **C8 (M)** IC Decision Record (expansion 4.1): append-only per-issuer
  record — recommendation, conviction, thesis sentence, committee date,
  decision, dissent, link to the run/report it was based on. Surfaced on
  Issuer Profile + Command board; mutations follow the E3 audit pattern.
  Lands before F so the beta cohort dogfoods it. **Verify:** new table +
  route + UI; `pytest caos/tests/server/test_decision_record.py` (new)
  green. **Exit:** record created/read/appended through the real UI path.
- [ ] **C9 (S–M)** Committee-pack `.xlsx` export (expansion 4.2): the current
  export is a documented dependency-free CSV stub (`export.ts:39-45`,
  S4 Ev-7); upgrade to real `.xlsx` via `openpyxl` (already a dependency for
  ingestion reads — `requirements.txt`) on the backend, or `npm i xlsx` on
  the frontend per the stub's own comment. Model Builder scenario grid +
  assumptions + headline `metric_facts`; every sheet stamped run id + as-of.
  **Verify:** export produces a valid `.xlsx` readable by openpyxl round-trip
  test. **Exit:** C6's same-number-everywhere assertion extends to the export.

**Exit gate:** `MOCK_LEDGER.md` (C1) burned to zero silent-mock and zero
unlabeled sample in prod build · C3-seam: rule → event → inbox → `InAppSink`
live end-to-end, `EmailSink` stub records intent · C5: all RV/DM surfaces
read only the persisted quote store, Sector RV refresh round-trips against
fixture-backed Bloomberg and degrades to manual, Settings Market Data section
live · concept-link suite (C6) green · a11y axe re-run clean on new/changed
routes (Monitor inbox especially — loop doc `design-a11y-ux` playbook).
C7–C9 are tracked here but **do not block this gate** (§14 expansion policy).

**Loops:** L7 (concept-link — work item), L8 (e2e, live per-PR), L9 (mock
regression — work item), L11 (a11y — manual per UI-phase exit), integration-
seams and llm-safety-grounding playbooks (loop doc §3) — C3-seam is a new
LLM-adjacent surface and must hold the fault-isolation invariant.

---

## 6. Phase D — Ingestion breadth

**Objective:** the ingestion funnel accepts what real analysts actually feed
it. Runs parallel to C after B. **Shrunk this grounding — D2 (RAG answer
lane) is done and moved to §1's working table.**

- [ ] **D1 (M)** OCR lane completion. The extraction lane is built and
  stub-tested: `ocrmypdf`/tesseract config (`config.py:237`
  `ocrmypdf_cmd="ocrmypdf"`, 300s timeout) and `_ocrmypdf_text`
  (`ingest.py:123`, called at `:168`, degrades to `""` on missing binary);
  tests (`test_ingest_markitdown.py:72,79,88`) use a **stub** binary, not the
  real one. Remaining: (a) tag chunk provenance `ocr` so CP-5/analysts can
  discount fidelity — not present today; (b) a genuinely-scanned-PDF golden
  fixture — `caos/tests/server/corpus/MANIFEST.md` explicitly notes "no
  scanned-PDF issuer here… D1's OCR lane needs its own genuinely-scanned
  fixture"; (c) verify `ocrmypdf` is actually installed in the deploy image
  (not just referenced in config). **Verify:** new golden test with a real
  scanned PDF fixture passes; chunk records show `prov="ocr"`; `docker run
  <image> which ocrmypdf` succeeds. **Exit:** scanned-PDF golden green,
  binary confirmed present in the shipped image.
- [x] **D2 (—)** ~~RAG answer lane in Query~~ **DONE.** Committed and wired
  end-to-end — see §1 working table for anchors. No further action.
- [ ] **D3 (S)** *(Exec 2026-07-11 late: PR #164 open — table-driven adversarial matrix: 0-byte/non-PDF/lying-extension 400s, oversized 413 mid-read, corrupt + password-protected PDFs degrade with the explicit 0-chunk warning, pricing-sheet rejects non-workbook + zip-bomb-ish containers pre-expansion. Suite 1402/2 in-tree.)* Upload robustness matrix. 0-chunk warning
  (`test_api.py:210,232`) and upload concurrency bounds
  (`test_upload_concurrency.py:25-78`) are tested; the full adversarial
  matrix (corrupt PDF, password-protected, 0-byte, 200MB, wrong-extension,
  zip-bomb-ish docx) is not. **Verify:** table-driven pytest covering all six
  cases, each rejected/degraded with an explicit analyst-visible reason
  (never a silent 0-chunk success). **Exit:** test green, wired per-PR (loop
  doc L10).
- [ ] **D4 (S)** *(Exec 2026-07-12: gap confirmed REAL — the profile notes panel was read-only, the only memo write lived in Query. PR #165 open: VaultMemoUpload issuer mode (LOG NOTE textarea → composed .md with issuer mention → existing upload/autolink/memochunks path, no new store/schema), mounted on AnalystNotesPanel w/ immediate re-read + covering vitest case. Residual: the manual keyed POST /api/query/answer citation check at pickup of a live stack.)* "Log a note" quick-capture on Issuer Profile writing a
  tagged memo into the vault (expansion 4.9). Partially covered: vault memo
  upload exists (`components/query/VaultMemoUpload.tsx`, `engine/
  memochunks.py`, Query walk `analyst-memos`); confirm the specific
  quick-capture-from-profile flow (`analyst-notes.test.tsx`) covers the full
  "no new store, no new schema" requirement. **Verify:** `npm --prefix
  caos/frontend run test -- analyst-notes VaultMemoUpload` green; if the
  profile-entry-point gap is real, add a covering case to
  `analyst-notes.test.tsx` and re-run. **Exit:** a memo logged from Issuer
  Profile is answerable via D2's RAG lane (confirm with a manual
  `POST /api/query/answer` call citing the new memo's chunk id).

**Exit gate:** scanned-PDF golden green with real-binary confirmation (D1) ·
D2 already done · upload matrix green (D3) · no ingestion path can succeed
silently with 0 chunks.

**Loops:** L10 (ingestion matrix, live-partial today, completes with D3).

---

## 7. Phase E — Enterprise hardening

**Objective:** safe to put in front of an enterprise security review.
"Functional" ≠ "safe to transfer" — this phase is the difference.

- [ ] **E1 (M)** *(Exec 2026-07-12: PR #171 open — WEB_CONCURRENCY multi-worker launch (Postgres-gated), stress harness run for REAL for the first time: 2-worker + throwaway Postgres, 15-user/60s locust, 2584 req/0 failures/p95 89ms. Advisory-lock migration safety across concurrent boots confirmed working. Found (not fixed, own follow-up): research/report executors stay in-process-only under multi-worker.)* Stress/scale closure. Already landed: per-analyst run cap
  (`config.py:210 caos_run_per_analyst_limit=3`, enforced `routes/runs.py:298`),
  identity-keyed rate limits across runs/vault/chat/models/digest/edgar/
  ingestion/issuers, SKIP LOCKED worker lease (`config.py:326`,
  `routes/autonomy.py:18`, `run_executor.py:248`). Missing: multi-uvicorn-
  worker deploy config (grep clean for `--workers`/`WEB_CONCURRENCY` in
  `caos/deploy/`), DB pool sizing re-check, and — critically — **the stress
  harness has never been run** (`caos/tests/stress/` exists, untriggered).
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
- [ ] **E3 (M)** Audit trail: append-only `audit_log` table (who/what/when/
  before→after) on every mutating route — issuer CRUD, uploads, deletes,
  rating edits, watch-rule changes, GDPR delete. Confirmed absent (no
  `audit_log` in `database.py`'s full table list). Runs already stamp
  `analyst_id`; this extends the pattern. Surface read-only in Settings.
  **Verify:** new migration + `pytest caos/tests/server/test_audit_log.py`
  (new) asserting a row on every mutating route class. **Exit:** 100% of
  mutating routes tested to write an audit row.
- [ ] **E4 (S)** *(Exec 2026-07-12: PR #166 open — SECRETS.md runbook + test_secret_log_hygiene.py: deployed-posture sentinel scan, mutation-verified, PG-gated + wired into the CI Postgres step. Booting it exercised 3 fail-closed guards — all held.)* Secrets runbook. Boot guards for `SESSION_SECRET`/
  `EDGE_PROXY_SECRET`/`ANALYST_SIGNUP_CODE`/demo-seed are tested
  (`test_audit_p0_fixes.py:133-148`); no runbook document exists, no
  "never in logs" grep test exists. Inventory (add Bloomberg credentials once
  C5 configures them via Settings), rotation procedure per secret, "never in
  logs" grep test. **Verify:** `caos/docs/reference/SECRETS.md` (new) exists;
  new grep-based test scans structured logs for known secret patterns.
  **Exit:** runbook complete, grep test green in CI.
- [ ] **E5 (M)** Security review pass. Already re-verified present: SSRF
  allow-list (`edgar.py:111,270`), CSP/HSTS (`test_security_headers.py`),
  GDPR-delete transactional integrity (`test_gdpr_erase.py`,
  `erase_analyst.py`). Remaining: run `/security-review` on the full diff
  since the last gate (covering C3-seam/C5's new LLM/network surfaces and
  E2/E3's new mutating routes); confirm the key safety property — no LLM
  lane has tools/writes — still holds after C3-seam lands; header-spoof +
  edge-secret checks (LAUNCH_PHASE1 §5) re-verify. CRIT/HIGH fixed, MED/LOW
  to the accepted-risk register. **Verify:** `/security-review` run recorded
  with 0 open CRIT/HIGH. **Exit:** same, plus register published.
- [ ] **E6 (S)** *(Exec 2026-07-12: PR #166 open — SBOM.md from requirements.lock pins + frontend license-checker; no copyleft/unknown in shipped paths; 3 accepted flags documented.)* License/SBOM report. Confirmed absent (S4 Ev-9).
  `pip-licenses` + `license-checker` (both free) → `caos/docs/reference/
  SBOM.md`; flag anything non-permissive. **Verify:** file exists,
  non-empty. **Exit:** SBOM published, no unflagged non-permissive licenses.

**Exit gate:** stress suite green at 2× pilot concurrency with fault
injection (E1) · roles-lite implemented + tested (E2) · audit log on 100% of
mutating routes, tested (E3) · secrets runbook + grep test (E4) · security
review PASS with accepted-risk register (E5) · SBOM published (E6).

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

- [ ] **G1 (S)** *(Exec 2026-07-12: PR #175 open — restore_drill.sh scripts the drill end to end, verified against a REAL Postgres restore incl. the failure path (corrupt dump -> exit 1, no false pass); wired into docker-compose.yml + README + LAUNCH_PHASE1.)* Backup restore drill automated. Today the restore procedure
  is **comments in `backup.sh:13-19`** (`pg_restore … caos_restore_test`, tar
  extract) — not a script. Wrap it: pg_restore → scratch DB → row-count
  assert → drop; vault tarball → scratch extract. **Verify:** new
  `caos/deploy/restore_drill.sh` runs and exits 0 against the latest backup.
  **Exit:** drill scripted, run once now, calendared quarterly (loop doc L19,
  `HANDOVER` class).
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
- [ ] **G4 (S)** DR runbook: host-loss scenario — restore from off-host
  backups (now possible via the `BACKUP_SYNC_CMD` hook, `backup.sh:56-58`) to
  a fresh host; state RTO/RPO honestly (daily backup = up to 24h RPO). No
  runbook doc exists yet. **Rehearse once.** **Verify:** `caos/docs/
  reference/DR_RUNBOOK.md` (new) exists; rehearsal performed and logged.
  **Exit:** runbook complete, rehearsed once, PASS.
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
| Audit trail | ⚠️ runs only | E3 |
| Rate limiting / abuse caps | ✅ per-analyst run cap + identity-keyed limits | E1 closes multi-worker gap |
| Secrets management + rotation | ⚠️ fail-closed, no runbook | E4 |
| Dependency scanning | ✅ Dependabot + policy | A5 + L14 loop |
| Malware scanning on upload | ✅ clamav | exists |
| SSRF / egress control | ✅ allow-list | re-verified E5 |
| Security headers / TLS | ✅ Caddy + CSP/HSTS | re-verified H1 |
| Pen-test style review | ⚠️ ad hoc | E5 + loop doc L18 |
| SBOM / license compliance | ❌ | E6 |
| Backups | ✅ daily + rotation + opt-in off-host sync | exists (G6 done) |
| Restore drills | ⚠️ manual, undocumented (comments only) | G1 |
| DR / host-loss plan | ❌ | G4 |
| Observability (logs) | ✅ structured, contextual | exists |
| Alerting on errors | ❌ (depends on C3-seam) | G2 |
| APM | ❌ **by design** (no paid services) | recorded decision |
| Load testing | ⚠️ harness built, never run | E1, G3 |
| Migrations discipline | ✅ alembic self-migrate + up/down round-trip test | done (G5) |
| Graceful LLM degradation | ✅ fault isolation by construction | exists; re-proven at each LLM-surface phase exit |
| Market-data integration | ❌ entirely unbuilt | C5 connector + store + refresh + Settings; H4 activation w/ entitlements |
| Monitor alert seam | ❌ entirely unbuilt (engine only) | C3-seam; H4 EmailSink activation |
| Data retention | ✅ run-fact pruning | exists |
| GDPR delete | ✅ transactional | re-verified E5 |
| Empty/error/degraded states | ⚠️ most surfaces | C1/C4 ledger closes the rest |
| Accessibility | ✅ axe-clean target | loop doc `design-a11y-ux` playbook |
| i18n | ❌ **by design** — single-desk English product | note in H3 |
| Multi-tenancy | ⚠️ mechanism exists (config-gated, off) but **by design** default is one shared team | SECURITY §2, H3; `tenancy.py` |
| API documentation | ✅ OpenAPI | exported H3 |
| Runbooks (deploy/rollback) | ✅ LAUNCH_PHASE1 | rehearsed G/H |
| User onboarding docs | ⚠️ §6 briefing only | H3 guide |
| Support/maintenance model | ❌ | H3 |
| Feature tracking / QA ledger | ✅ 355-row tracker | per-phase sweeps (A7b closes the 9 open rows) |
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
