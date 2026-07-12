# Code Health & Methodology Consistency — 2026-07-10

Playbook: [code-health-methodology.md](../code-health-methodology.md). Run type:
first execution (no prior report, no prior fallow baseline). Branch:
`feat/command-center-layout-and-sector-rv-cleanup` @ `6603568e`. Scope
discovery (§2) ran against `origin/main` @ `6603568e` (branch and main in sync
at that point); `origin/main` advanced one commit to `c1afff97` (docs-only —
a security-infra audit report plus two doc-rot fixes in `routes/auth.py` and
`AUDIT.md`/`SECURITY.md`, verified to touch none of this report's findings)
during the run, a normal consequence of this being a shared, actively-worked
tree. Branch delta vs the merge-base is 332 files, but ~300 of those are the
agent-tooling symlink farm (`.claude/.codex/.cursor/.gemini/.github/skills/**`)
landed by `chore: land parallel-session WIP`, not application code.

## Overall verdict: FAIL

Two new invariant breaches exist that are neither fixed nor registered (per
this playbook's own rule: FAIL = new breach, unfixed, unregistered). Both are
small, well-scoped, human-owned fixes — not flagged as blocking the branch's
overall direction, but they will fail CI's complexity gate and this playbook's
own duplication bar as-is:

1. **New C901 breach** — `run_deep_research` (deepresearch.py:232), 13>10.
2. **New duplication** — 5 new `error.tsx` files clone the pre-existing
   `app/error.tsx` (50 lines × 6 instances).

Plus one pre-existing-but-newly-exposed item that will also fail CI's
complexity gate if left unmarked: `_match_metric_keys` (metricfactlane.py:73,
11>10, unmarked). See Gate-blocking and Register-needed below for full
evidence; none of these three are fixed here per the report-only mandate.

## Verdict table

| # | Invariant | Result | Evidence |
|---|---|---|---|
| 1 | Dead code (Python, vulture) | PASS | `vulture caos/server caos/scripts --min-confidence 80 --ignore-names cls --exclude ".venv311,.venv,static,.impeccable"` → 0 findings |
| 2 | Dead code / unused exports & deps (TS, fallow) | PASS (new); 3 pre-existing | Changed-only: 1 new dead file (untracked scratch, not committed code — see below), 1 pre-existing stale suppression surfaced by a touched file. Full sweep: 3 total repo-wide, all pre-existing (see Backlog) |
| 3 | Duplication | **FAIL (new)** | 5 new per-route `error.tsx` files clone ~50 lines from pre-existing `app/error.tsx`, forming a 6-instance clone group (see Gate-blocking) |
| 4 | Complexity (C901, changed-only) | **FAIL (new)** + 1 register-needed | `run_deep_research` (deepresearch.py:232) 13>10, new. `_match_metric_keys` (metricfactlane.py:73) 11>10, pre-existing, unmarked (see Gate-blocking) |
| 5 | Circular dependencies | PASS | fallow full sweep: 0 circular-dependency findings. CP-X DAG: `test_runner_layers.py` (`test_cycle_raises` + 1 other) 2 passed |
| 6 | Architecture boundaries | PASS | `grep fastapi\|routes caos/server/engine/*.py` → 0 hits; `grep @/app caos/frontend/src/lib` → 0 hits |
| 7 | Lint cleanliness | PASS | `ruff check caos/server caos/tests` clean; `mypy` (caos/server, 67 files) clean; `npx eslint src --max-warnings=0` clean; `npx tsc --noEmit` clean |
| 8 | Taxonomy agreement | PASS | `check_module_consistency.py`: 24 modules checked, 0 drift |
| 9 | CP route-graph integrity | PASS | Registry↔corpus delta fully explained in-code (registry.py:31): CP-5/CP-5B are QA-phase outputs, never routed; CP-X is the router itself; CP-EXTRACT/CP-RENDER are engine-only infra spec modules. No unexplained delta |
| 10 | Documentation drift | PASS (playbook self-check); 1 observation | This playbook's §4.1 commands match ci.yml's C901/fallow gate steps verbatim. Observation: the 8-playbook family uses 5 different report-path conventions (`qa/playbooks/reports/`, `qa/audits/`, `qa/reports/`, `qa/ENGINE_CORRECTNESS_<date>.md`, `qa/perf/PERF_AUDIT_<date>.md`) — out of this playbook's scope to fix, flagged for whoever owns the family |
| 11 | Suppression hygiene | PASS (new); 1 pre-existing | 1 stale suppression confirmed real (`api.ts:406`, pre-existing, register-needed) |

## Gate-blocking findings (would fail CI today)

These are real, adversarially-confirmed, and new (or newly-exposed) — not
pre-existing backlog. Not fixed here per the playbook's report-only mandate.

### 1. New C901 breach — `run_deep_research`

[caos/server/deepresearch.py:232](../../../../server/deepresearch.py) —
cyclomatic complexity 13 > 10. Confirmed via diff: origin/main's copy of this
file has **zero** C901 hits; this branch added a nested `try/except` for
double-overload degrade handling (BE4-2 fault isolation — matches the
project's LLM fault-isolation pattern) inside the function, pushing it over
threshold. Legitimate resilience code, but needs either a decompose or a
`# noqa: C901` mark before merge — CI's complexity-gate step
(`.github/workflows/ci.yml` "Complexity gate (changed Python)") will fail on
this exact line today.

### 2. New duplication — 5 new per-route `error.tsx` boundary files

`caos/frontend/src/app/{command,deepdive,model,query,reports}/error.tsx` (new
this branch, confirmed absent from `origin/main`) plus the pre-existing
`caos/frontend/src/app/error.tsx` (confirmed present on `origin/main`, source
of the clone) form one 50-line, 6-instance fallow clone group. Confirmed via
`--trace`: the shared
fragment is the entire component body (client-directive comment, `useEffect`
console.error, the alert-role card markup) — not incidental overlap. fallow's
own `--ci` gate exits 0 on this (duplication is warn-tier in fallow's default
severity), so CI itself won't block it, but it's new duplication this branch
introduced and a clean extraction target: a shared `<RouteErrorBoundary
error={error} reset={reset} />` component that each route's `error.tsx`
re-exports, collapsing 6×50 lines to 1×50 + 6×3.

## Register-needed (pre-existing, unmarked — would also fail CI)

### `_match_metric_keys` — C901 11>10, pre-existing

[caos/server/engine/metricfactlane.py:73](../../../../server/engine/metricfactlane.py) —
confirmed identical complexity (11>10) on origin/main; this branch touched the
file elsewhere without adding a mark. Per the project's own accepted-risk
convention ("a `# noqa: C901` marks a pre-existing offender when its file is
next touched" — ci.yml:68), this file has now been "next touched" and needs
the mark, or CI's complexity gate fails on a pre-existing condition this
branch didn't cause but does expose.

### `api.ts:406` — stale suppression, pre-existing

`// fallow-ignore-next-line unused-export` above `createRun` in
[caos/frontend/src/lib/api.ts](../../../../frontend/src/lib/api.ts) is stale:
traced via `fallow dead-code --trace`, `createRun` is now imported by
`UploadWizard.tsx` (1 reference). The comment predates that consumer ("kept
ahead of its UI consumer") and is safe to delete — one line, zero risk.

## Backlog (pre-existing, full-repo sweep — no action required)

Full-repo fallow health: 262 files, 4,005 functions, maintainability avg 90.6,
0 circular deps, 0.4% dead files, 0.2% dead exports, 2.97% duplication (47
clone groups / 102 instances across 33 files) — captured as the first identity
baseline ([fallow-baseline.json](../fallow-baseline.json)), no prior run to
diff against.

3 full-sweep dead-code findings, all confirmed pre-existing (commit `35ef62fd`,
an ancestor of `origin/main`, not touched by this branch) and adversarially
confirmed via `--trace`/`--trace-file`:

| Finding | Confirmation |
|---|---|
| `WatchlistEditor.tsx` unreachable | 0 references, 0 importers, imports real (non-stub) dependencies — a scaffolded component never wired into the Query surface |
| `useLatestRun` unused export | Sibling `useLatestRunStatus` in the same file is actively used by 7 files; `useLatestRun` itself has 0 direct references — superseded, not file-dead |
| `api.ts:406` stale suppression | See Register-needed above (same finding, cross-listed) |

**Untracked scratch (not repo liabilities, informational only):** 4 debug
`.mjs` scripts under `caos/frontend/scripts/` (`_audit-fixed.mjs`,
`_debug-query.mjs`, `_debug-query2.mjs`, `a11y-query.mjs`) are untracked
(`git status` `??`), unreachable, and heavily duplicated among themselves (5
clone groups). Confirmed via `--trace-file` on `_debug-query.mjs`: 0 imports,
0 exports, not an entry point. Not gitignored, not committed — someone's
manual-testing scratch, left in the working tree during this audit's window.
Not flagged as a repo defect since they were never part of tracked source;
noted so the owner can clean up or `.gitignore` them.

## Operational finding: fallow full-sweep poisoned by local build dirs

A full (non-`--changed-since`) fallow scan took 7+ minutes and was still
running when killed, versus 5.3 seconds once `caos/frontend/{.next-qa,
.next-qa2,.next-qa3,.next}` (gitignored, ~3,500 files of bundled JS from the
isolated-QA-stack and dev-server build output) were excluded via a scratch
`--config`. `.fallowrc.json`'s `ignorePatterns` doesn't cover these. Recorded
as a defensive note in the playbook itself (§4.2) rather than fixed in the
tracked config — this run used a scratch config
(`/tmp/.../fallow-audit-scratch.json`, not committed) so the repo's
`.fallowrc.json` is untouched. **Recommendation for whoever owns
`.fallowrc.json`:** add `caos/frontend/.next-qa*/**` and `caos/frontend/.next/**`
to `ignorePatterns` — would make this a non-issue for every future run,
CI or local.

## Register delta (marks enumerated, none added/removed this run)

18 project-level `# noqa: C901` marks (excluding 110 vendored hits under
`.venv`/`.venv311` — this run also fixed the playbook's own register-grep
command, which wasn't excluding vendor dirs and would have made every future
register diff meaningless). 15 `fallow-ignore`/`@expected-unused` marks across
`caos/frontend/src` and `caos/tests/frontend`. No prior report exists to diff
against — this run establishes the starting set. The two register-needed
items above (§ Register-needed) are proposals for a human to commit, not
applied here.

## Resolution addendum (post-report, same day)

All four items in Gate-blocking and Register-needed were fixed at the user's
request, moving the overall verdict from FAIL to PASS. Left as originally
written above (audit trail); disposition only:

- `run_deep_research` C901 13>10 → **fixed**: `# noqa: C901` with reason
  (streaming continuation loop, cross-turn overload-fallback state that must
  stay coupled — matches house convention in `runner.py`/`routes/auth.py`).
  Chose register-mark over decompose: splitting the fallback branch risks the
  cross-turn state-persistence contract the BE4-2 comments call out.
- `_match_metric_keys` C901 11>10 → **fixed**: `# noqa: C901` with reason
  (pre-existing, flat synonym scan, not touched by this branch's actual diff).
- `api.ts:406` stale suppression → **fixed**: deleted the stale comment and
  the now-inaccurate "kept ahead of its UI consumer" prose above it; replaced
  with an accurate one-line comment naming the real consumer (`UploadWizard`).
- 5-file `error.tsx` duplication → **fixed**: extracted
  `caos/frontend/src/components/shared/RouteErrorBoundary.tsx`; all 6
  `app/**/error.tsx` (including the pre-existing root one) now re-export its
  default, collapsing 6×50 lines to 1×50 + 6×3.

Verification: `ruff check --select C901` on the full changed-file set (0
hits), full `ruff`/`vulture`/`mypy` (clean), `tsc --noEmit` + `eslint src`
(clean), `fallow dupes --changed-since origin/main` (error.tsx no longer
appears in any clone group), `fallow dead-code --trace-file` on the new
component (reachable, imported by all 6, re-export chain resolved — not
falsely flagged), `error-surfaces.test.tsx` (8/8 pass, unchanged), and a live
dev-server check on the isolated QA frontend (`/command` renders full chrome,
zero console errors, Fast Refresh clean) since Next.js file-convention
re-exports are the kind of thing that can look correct in `tsc` and break at
runtime.

## Playbook corrections made during this run

Two defects in [code-health-methodology.md](../code-health-methodology.md)
itself, found by executing it and fixed in place (in-scope: the playbook is
the deliverable, and a broken command in a "durable, re-runnable" playbook
defeats the point):

1. §6's register-enumeration grep didn't exclude `.venv`/`.venv311`, returning
   127 hits (110 vendored) instead of 18 real project marks — would have made
   every future register-delta comparison noise-dominated.
2. §4.2 had no warning about the `.next-qa*` full-sweep slowdown (see
   Operational finding above) — added so future runs don't burn 7+ minutes
   rediscovering it.
