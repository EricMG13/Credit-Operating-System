# Code Health & Methodology Consistency — Sonnet 5 Goal Prompt

## 1. Objective

Protect CAOS from two forms of silent rot:

- **Entropy:** dead code, unused exports or dependencies, duplication,
  complexity, import cycles, and layer violations make the next credit change
  harder to reason about and easier to get wrong.
- **Methodology drift:** the declared 27-module `Modular OS/` corpus is the
  analytical contract. A module ID, canonical name, route, implementation, or
  documentation claim that diverges can send evidence to the wrong lane and
  produce an indefensible committee read.

Run this audit weekly and before deployment from the repository root. Establish
the current taxonomy and graph each time; do not trust a hard-coded module
count. Gates are new-only: register existing debt without re-litigating it.
Deliver only the dated report in §5. **Report, do not refactor:** that report is
the sole permitted write; do not edit existing code, prompts, docs, CI,
suppressions, or baselines, and do not stage or commit.

## 2. Scope discovery

Use one immutable `BASE_REF` for the whole run. For a branch or pre-deploy run,
use its remote merge base (normally `origin/main`). For a weekly run on trunk,
use the `HEAD` recorded by the previous dated report; an empty `origin/main...HEAD`
diff is not a weekly scope. Record both resolved SHAs.

```bash
git fetch origin
BASE_REF="${BASE_REF:-origin/main}"
git rev-parse --verify "$BASE_REF"
git rev-parse --verify HEAD
git merge-base "$BASE_REF" HEAD
git status --short --untracked-files=all
git diff --name-status "$BASE_REF"...HEAD
git diff --name-status
git diff --cached --name-status
```

The gate scope is the committed `BASE_REF...HEAD` delta. Inventory staged,
unstaged, deleted, renamed, and untracked WIP separately; never attribute it to
`HEAD`. A dirty pre-deploy candidate is `BLOCKED`. A weekly report may exclude
clearly identified parallel WIP, but must say so.

Enumerate the live methodology and implementation sets; report counts and exact
set deltas without assuming that “27” still describes every surface:

```bash
rg --files "Modular OS/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS" \
  -g 'CP-*__*__payload.schema.txt' | LC_ALL=C sort
for path in "Modular OS"/CP-*; do
  [ -d "$path" ] && printf '%s\n' "$path"
done | LC_ALL=C sort
rg --files "Modular OS" -g 'CP-*_ACTIVE_PROMPT.md' | LC_ALL=C sort
rg -n '^\| CP-' "Modular OS/CP-X/SYSTEM_REFERENCE.md"
rg -n '^\| CP-' "Modular OS/README/CP_ONBOARDING_DOCUMENTATION_v2.txt"
rg -n '^(NODES|EDGES|LAYERS):' \
  "Modular OS/KNOWLEDGE SOURCES/03_ORCHESTRATION/CP-X_ROUTE_GRAPH_v2.2.txt"
rg -n 'ModuleSpec\("CP-' caos/server/engine/registry.py
```

The payload-schema filename is Taxonomy A’s canonical `(module_id,
module_name)` authority. Keep corpus modules, orchestration/infra nodes, engine
registry nodes, implemented nodes, and documented intentional omissions as
separate sets.

## 3. Coverage checklist — invariants to hold

Classify every invariant as `PASS`, `FAIL`, `REGISTER`, or `BLOCKED`.

1. **Dead/unused code:** the changed-code fallow gate introduces no unused
   files, exports, types, members, dependencies, unlisted dependencies, or stale
   suppressions. Vulture at confidence 80 remains clean; `cls` is its only CI
   name exemption.
2. **Duplication:** no clone identity outside `.fallow-dupes-baseline.json` is
   introduced by changed code. A baseline clone may disappear, but a baseline
   must never be refreshed merely to turn red green.
3. **Cyclomatic complexity:** C901 remains 10. On changed Python paths, no new
   function exceeds 10, no accepted function exceeds its exact
   path-and-symbol maximum, and lowered or removed offenders retire their stale
   entries from `caos/scripts/complexity_baseline.json`.
4. **Cycles:** fallow reports no new JS/TS circular or re-export cycle. The CP
   registry has unique IDs, no dangling hard/soft edges, declared-before-
   dependent ordering, and an acyclic execution graph.
5. **Architecture boundaries:** configured fallow zones have no new boundary or
   coverage violation. Independently, `caos/server/engine/**` does not import
   FastAPI, `routes`, or `main`, and `caos/frontend/src/lib/**` does not import
   `src/app/**`. If fallow reports `configured: false`, say that automation is
   absent; the explicit CAOS boundary checks still gate the run.
6. **Lint cleanliness:** repository Ruff, engine mypy, frontend ESLint, and
   frontend TypeScript checks are clean at the same thresholds as CI.
7. **Taxonomy A:** every payload schema has exactly one matching module
   directory and ACTIVE_PROMPT; `module_name` agrees across schema filename,
   schema body, ACTIVE_PROMPT, the CP-X route row, and onboarding row. Missing
   rows fail even where the checker’s conditional row lookup would not.
8. **CP route graph:** corpus node/edge/layer declarations and
   `engine/registry.py` agree wherever the engine claims implementation. Every
   extra, omitted, spec-only, feature-gated, QA-phase, or infrastructure node is
   explicitly documented; no silent ID, name, edge, or ordering delta exists.
9. **Documentation truth:** present-tense claims under `caos/docs/` and
   `caos/README.md` about module counts/status, paths, commands, thresholds, or
   CI jobs match the live tree and `.github/workflows/ci.yml`. Historical plans
   are clearly labelled historical; tracker prose alone is never proof.
10. **Suppression hygiene:** every accepted offender has a recognized §6 mark
    and rationale. New or widened suppressions, unexplained baseline growth, and
    stale suppressions are findings.

## 4. Procedure — evidence commands

Use the CI-pinned tool versions (`ruff==0.15.18`, `vulture==2.14`) and a
designated server virtual environment (`caos/server/.venv` or `.venv311`). A
missing tool or invalid analyzer result is `BLOCKED`, never `PASS`. The commands
below are read-only; where CI supplies `origin/${{ github.base_ref }}`, substitute
the single resolved `BASE_REF` from §2.

```bash
# Full-tree lint/dead-code gates, exactly as CI scopes them.
ruff check caos/server caos/tests
vulture caos/server caos/scripts --min-confidence 80 --ignore-names cls

# Changed Python only; this script owns C901=10 and the bounded-debt baseline.
python caos/scripts/check_complexity_delta.py --base-ref "$BASE_REF"

# Changed JS/TS only; reporting flags do not change the CI analysis.
npx --yes fallow dead-code --changed-since "$BASE_REF" --ci \
  --format json --quiet --explain 2>/dev/null || true
npx --yes fallow dupes --changed-since "$BASE_REF" \
  --baseline .fallow-dupes-baseline.json --ci \
  --format json --quiet --explain 2>/dev/null || true

# Fallow configuration/boundary visibility and informational full-tree inventory.
npx --yes fallow config --path --format json --quiet --explain 2>/dev/null || true
npx --yes fallow list --boundaries --format json --quiet --explain 2>/dev/null || true
npx --yes fallow dead-code --format json --quiet --explain 2>/dev/null || true

# Corpus drift gate, exactly as CI invokes it.
python3 "Modular OS/tools/check_module_consistency.py"
```

Because `|| true` distinguishes normal fallow findings from shell failure, read
each JSON root: validate `kind`; treat `error: true` / `exit_code: 2`, malformed
JSON, or missing output as `BLOCKED`. Full-tree fallow findings are inventory
and register evidence, not failures unless their identity is new to the audited
delta. If unignored local build output contaminates or stalls the full-tree
inventory, mark that inventory `BLOCKED`; do not edit `.fallowrc.json` during
the audit and do not weaken the changed-only CI verdict.

```bash
# CP graph and architecture invariants.
caos/server/.venv/bin/python -m pytest \
  caos/tests/server/test_registry.py caos/tests/server/test_runner_layers.py -q
rg -n '(^|[[:space:]])(from|import)[[:space:]]+(fastapi|routes|main)([.[:space:]]|$)' \
  caos/server/engine -g '*.py'
rg -n '(from|import).*(@/app|src/app|/app/)' \
  caos/frontend/src/lib -g '*.ts' -g '*.tsx'

# Remaining live lint gates.
(cd caos/server && .venv/bin/mypy)
(cd caos/frontend && npm run lint -- --max-warnings=0)
(cd caos/frontend && npx tsc --noEmit)

# Documentation claims to reconcile against the live tree and CI.
rg -n '(27[- ]module|24 modules|module_name|Taxonomy A|ci\.yml|C901|ruff|vulture|fallow|check_module_consistency)' \
  caos/docs caos/README.md
git diff --name-only "$BASE_REF"...HEAD -- caos/docs caos/README.md \
  .github/workflows/ci.yml .fallowrc.json ruff.toml
```

Also compare the complete schema/prompt/CP-X/onboarding sets from §2, not only
the checker exit code. Read the full CP-X graph and engine declarations when
comparing edges:

```bash
sed -n '1,280p' "Modular OS/CP-X/SYSTEM_REFERENCE.md"
sed -n '1,280p' \
  "Modular OS/KNOWLEDGE SOURCES/03_ORCHESTRATION/CP-X_ROUTE_GRAPH_v2.2.txt"
sed -n '1,320p' caos/server/engine/registry.py
```

Inspect changed documentation claims against the files and commands they name.
Do not run a fixer.

## 5. Evidence and reporting

Write `caos/docs/qa/playbooks/reports/code-health-YYYY-MM-DD.md` with:

- run type, timestamp, `HEAD`, `BASE_REF`, merge base, dirty-tree separation,
  tool versions, and every command’s exit/result;
- one verdict row per §3 invariant, with exact file/line, symbol or stable
  fallow fingerprint, and the evidence that makes it new or registered;
- corpus, CP-X, onboarding, route-graph, and engine-registry set deltas;
- a documentation-claim table: claim, source, live evidence, verdict;
- the §6 accepted-risk register and its delta from the previous report; and
- overall `PASS`, `FAIL`, or `BLOCKED`.

`FAIL` means at least one confirmed finding is new or worsened relative to
`BASE_REF`/the checked baseline. `REGISTER` means a pre-existing finding has an
unchanged recognized mark; it does not fail the run. `REGISTER-NEEDED` records
an unmarked pre-existing offender for owner decision without re-litigating it
as new. `BLOCKED` means required evidence could not be obtained. Never convert
uncertainty into `PASS`.

Adversarially confirm every dead/unused candidate before verdict:

```bash
npx --yes fallow dead-code --trace <file>:<export> \
  --format json --quiet --explain 2>/dev/null || true
npx --yes fallow dead-code --trace-file <file> \
  --format json --quiet --explain 2>/dev/null || true
npx --yes fallow dead-code --trace-dependency <package> \
  --format json --quiet --explain 2>/dev/null || true
npx --yes fallow dupes --trace dup:<fingerprint> \
  --format json --quiet --explain 2>/dev/null || true
```

For vulture findings, search direct callers plus decorators, FastAPI
registration, dependency injection, pytest fixtures, `getattr`, `importlib`,
string references, package scripts, and CI. A finding that lacks reachability
proof is a **candidate**, not a failure. Report the result; do not delete,
suppress, move, or consolidate anything.

## 6. Accepted-risk register

Accepted risk is explicit and in place; silence is not acceptance. Enumerate
these sources on every run:

| Register source | Accepted scope | Invariant |
|---|---|---|
| `caos/scripts/complexity_baseline.json` | exact Python path, symbol, and maximum | may not worsen; stale/lowered entries fail the delta gate |
| `.fallow-dupes-baseline.json` | exact pre-existing clone identities | new identities fail; removals retire debt |
| `.fallowrc.json` `ignoreExports`, `ignoreDependencies`, `ignorePatterns` | named fallow exceptions | reason and continued necessity remain reviewable |
| `// fallow-ignore-*` and `/** @expected-unused */` | local JS/TS exception | must match a live finding and carry a rationale |
| `# noqa: C901` | local Python exception, if present | must be justified; the CI baseline remains authoritative |
| CI `--ignore-names cls` | classmethod signature argument only | no broader vulture exemption |
| prior dated report `REGISTER` row | contextual owner/rationale/review date | supplements, never replaces, an in-repo mark |

```bash
sed -n '1,240p' caos/scripts/complexity_baseline.json
sed -n '1,260p' .fallow-dupes-baseline.json
sed -n '1,260p' .fallowrc.json
rg -n '# noqa: C901|fallow-ignore|@expected-unused' \
  caos/server caos/scripts caos/frontend/src caos/tests \
  -g '*.py' -g '*.ts' -g '*.tsx' -g '*.js' -g '*.mjs'
```

For each offender record stable ID/fingerprint, location, category, mark,
rationale, owner, first-seen date, and review/expiry condition. A mark added or
widened in the audited delta is a new governance change and requires explicit
owner rationale. The audit agent may recommend acceptance or removal in the
report, but may not alter the register.
