# Playbook — Code Health & Methodology Consistency Audit

Re-runnable goal-prompt for a Sonnet agent. Cadence: **weekly** and **pre-deploy**.
Run from the repo root. **Report-only: never refactor, fix, or commit code.** The
only files you may write are the dated report (§5) and the fallow baseline (§4.2).
The user works in this tree in parallel — never `git add -A`; if you commit the
report, stage that explicit path only.

## 1. Objective

Hold the line against the two rots that quietly kill a credit platform:

- **Code entropy** — dead code, duplication, complexity creep, circular imports,
  boundary violations. Each one raises the cost of the next change and hides the
  next bug; money is behind a wrong read.
- **Methodology drift** — the 27-module `Modular OS/` corpus is the analytical
  contract (Taxonomy A). If a module_name, route-graph entry, or doc claim
  diverges from the code, CP-X routing degrades and the committee-facing output
  no longer matches the methodology it claims to implement.

The audit asserts the invariants in §3. It **never re-litigates the existing
backlog**: like CI, gates fire on *new* findings only. Pre-existing offenders
live in the accepted-risk register (§6), marked in-place.

## 2. Scope discovery

Establish, fresh each run (never from memory or stale docs):

```bash
git fetch origin
# Changed-code surface — always vs origin/main (local main may be stale)
git diff --name-only --diff-filter=d origin/main...HEAD
# Canonical module taxonomy: payload-schema filenames are the authority
ls "Modular OS/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS/"        # CP-XX__<ModuleName>__payload.schema.txt (24 today)
ls -d "Modular OS"/CP-*/                                            # corpus module dirs
grep -oE '"CP-[0-9A-Za-z]+"' caos/server/engine/registry.py | sort -u  # engine registry module ids
```

Note the registry↔corpus delta explicitly (engine-only ids like `CP-EXTRACT`,
`CP-RENDER` are expected; a *new* unexplained delta is a finding). If the branch
equals `origin/main` (weekly run on trunk), changed-only checks scope to the
commits since the last dated report instead.

## 3. Health invariants

Assert each; classify any breach as NEW (gate) or PRE-EXISTING (register).

**Code entropy**
1. **Dead code (Python)** — `vulture` over `caos/server caos/scripts` at
   confidence ≥80 returns zero findings. The baseline IS zero, so any hit is new.
2. **Dead code / unused exports & deps (TS)** — fallow reports no dead code or
   unused/unlisted dependencies introduced on the branch delta. `.fallowrc.json`
   `ignoreExports`/`ignoreDependencies` entries are register items, not findings.
3. **Duplication** — no new clone groups on the branch delta; full-repo
   duplication may only shrink or hold vs the identity baseline.
4. **Complexity** — no new or edited function on a changed `.py` file exceeds
   cyclomatic 10 (ruff C901) without a `# noqa: C901` register mark. Never run
   C901 repo-wide — the gate is changed-only by design.
5. **Circular dependencies** — zero fallow `circular-dependency` findings in the
   frontend; the CP-X DAG stays acyclic (registry raises at import on
   declared-before-dependent violations; `test_runner_layers.py` green).
6. **Architecture boundaries** — `caos/server/engine/**` imports no `fastapi`,
   `routes/`, or `main` (dependency direction is routes→engine only);
   `caos/frontend/src/lib/**` never imports from `src/app/**`. (No fallow
   `boundaries` config exists — greps are the check.)
7. **Lint cleanliness** — `ruff check caos/server caos/tests` clean (ruff.toml);
   `mypy` engine gate green; frontend `lint --max-warnings=0` and `tsc --noEmit`
   clean.

**Methodology consistency**
8. **Taxonomy agreement** — `check_module_consistency.py` exits 0: every
   module_name agrees across schema filename (authority), schema body,
   ACTIVE_PROMPT, `CP-X/SYSTEM_REFERENCE.md` route table, and the onboarding doc.
9. **CP route-graph integrity** — the engine registry imports cleanly, the
   runner layer/cycle tests pass, and every payload-schema module resolves in
   the CP-X route table (the script covers the corpus side; you cover the
   registry↔corpus delta from §2).
10. **Documentation drift** — any `caos/docs/` or README claim naming a CI gate,
    command, or file path matches `.github/workflows/ci.yml` and the live tree.
    This playbook itself must match ci.yml's gate invocations — a ci.yml gate
    change without a playbook update is a finding. `AUDIT.md` and
    `FEATURE_TRACKER.csv` lag the code: grep the code before citing either as
    evidence that something is open.
11. **Suppression hygiene** — no stale suppressions (fallow
    `--stale-suppressions`); every register marker added since the last report
    carries a reason (comment or commit message).

## 4. Procedure

Python tools come from `caos/server/.venv311/bin/` (ruff 0.15.18, vulture, mypy
already installed — matches CI pins; if absent, `pip install ruff==0.15.18
vulture==2.14` into a throwaway venv, never into the project venvs). Fallow runs
via `npx --yes fallow` from the repo root so `.fallowrc.json` applies. Append
`|| true` to fallow JSON commands (exit 1 = findings, not error).

### 4.1 Changed-only gates (exact CI parity)

```bash
VENV=caos/server/.venv311/bin
# Complexity — C901 on changed Python only, mirroring ci.yml
files=$(git diff --name-only --diff-filter=d origin/main...HEAD -- '*.py' | grep -vE '(^|/)\.(venv|goal)/' || true)
[ -n "$files" ] && echo "$files" | xargs $VENV/ruff check --select C901
# Fallow — new dead code / duplication on the branch delta only
npx --yes fallow dead-code --changed-since origin/main --ci
npx --yes fallow dupes --changed-since origin/main --ci
```

### 4.2 Full-tree sweeps

```bash
$VENV/ruff check caos/server caos/tests
# --exclude covers only dirs a CI checkout doesn't have (venvs, built static,
# untracked scratch); vendor/ is tracked and stays in scope, exactly like CI.
$VENV/vulture caos/server caos/scripts --min-confidence 80 --ignore-names cls \
  --exclude ".venv311,.venv,static,.impeccable"
(cd caos/server && .venv311/bin/mypy)                      # engine type gate
python3 "Modular OS/tools/check_module_consistency.py"     # exit 0 = consistent
$VENV/python -m pytest caos/tests/server/test_runner_layers.py -q
# Boundary greps — both must return nothing
grep -rn "fastapi\|from routes\|import routes" caos/server/engine/*.py
grep -rn "from ['\"]@/app\|from ['\"]\.\./app" caos/frontend/src/lib
# Frontend lint/type (skip if node_modules absent and run is pre-deploy-CI-covered)
(cd caos/frontend && npm run lint -- --max-warnings=0 && npx tsc --noEmit)
# Fallow backlog sweep — report-only, new-vs-baseline via identity snapshot
npx --yes fallow dead-code --format json --quiet --baseline caos/docs/qa/playbooks/fallow-baseline.json 2>/dev/null || true
npx --yes fallow dupes --format json --quiet 2>/dev/null || true
npx --yes fallow dead-code --format json --quiet --stale-suppressions 2>/dev/null || true
npx --yes fallow health --format json --quiet --hotspots --targets 2>/dev/null || true   # informational trend only
```

First run: create the baseline with `--save-baseline
caos/docs/qa/playbooks/fallow-baseline.json` and commit it with the report.
Refresh it only when a register decision absorbs findings — never to make a red
run green.

### 4.3 Documentation drift spot-check

For each doc changed since the last report (plus `caos/README.md`,
`LAUNCH_PHASE1.md`, `PRE_DEPLOYMENT_PLAN.md` always): extract every claimed
command, CI job name, gate threshold, and file path; verify each against
`.github/workflows/ci.yml` and the tree (`test -e`, `grep`). Diff this
playbook's §4.1 against ci.yml's complexity/fallow/vulture/corpus steps.

## 5. Evidence & reporting

Write `caos/docs/qa/playbooks/reports/code-health-YYYY-MM-DD.md`:

- **Verdict table** — one row per §3 invariant: PASS / FAIL / REGISTER, with the
  command output snippet that proves it. FAIL only on NEW breaches; anything
  pre-existing goes to the register delta, never a failure.
- **Adversarial confirmation** — before reporting any "dead/unused" item as
  actionable: `npx --yes fallow dead-code --trace <file>:<export>` (or
  `--trace-file` / `--trace-dependency`); for vulture hits, grep for dynamic use
  (`getattr`, string references, FastAPI `Depends`, pytest fixtures, alembic
  hooks). For duplication, `fallow dupes --trace dup:<fingerprint>`. Unconfirmed
  items are listed as *candidates* and never drive a FAIL.
- **Backlog delta** — full-sweep counts vs the previous report (dupes groups,
  hotspot top-5, register size). Trend commentary in one line each.
- **Registry↔corpus delta** (§2) and any taxonomy/doc drift, quoted exactly.
- End with an overall PASS/FAIL line: FAIL means a new invariant breach exists
  that is neither fixed nor registered. Report it; do not fix it yourself.

## 6. Accepted-risk register

Pre-existing offenders are marked **in-place**; the report's register table just
enumerates the marks — the code is the register of record:

| Mark | Covers | Where |
|---|---|---|
| `# noqa: C901` | complexity offender grandfathered when its file was next touched | changed `.py` |
| `// fallow-ignore-next-line <type>` / `// fallow-ignore-file <type>` | TS dead-code/dupe/circular acceptance | frontend/tests |
| `/** @expected-unused */` | intentionally unused export (staleness-tracked) | frontend |
| `.fallowrc.json` `ignoreExports` / `ignoreDependencies` | file-level export & dep acceptances | repo root |
| `--ignore-names cls` (vulture, in ci.yml) | classmethod signature arg | ci.yml |
| `fallow-baseline.json` | full-sweep backlog identity snapshot | this dir |

Each run: `grep -rn "noqa: C901" caos/server caos/scripts` and `grep -rn
"fallow-ignore\|@expected-unused" caos/frontend/src caos/tests/frontend`; diff
the set against the previous report. A new mark without a stated reason, or a
stale suppression (§3.11), is a finding. Never add, move, or delete a mark
yourself — propose it in the report and let a human commit the acceptance.
