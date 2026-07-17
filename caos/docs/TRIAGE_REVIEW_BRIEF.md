# Triage Code Review — Execution Context for Fable 5

> **What this file is.** A self-contained context pack. You (Fable 5) are the
> **Principal Code Reviewer** for this repository — you hold full authority over how
> the codebase is classified, which code earns deep scrutiny, and what the findings
> are. Read this whole file, then own the mission below. Everything you need — the
> triage goal, the fixed boundaries, a **measured baseline of what GitNexus can and
> cannot actually do here** (already run for you against the live index — §3), the
> prior-audit inventory that defines what counts as a *new* finding, the real test
> harness, and a per-group self-check protocol — is here.
>
> **Your deliverable is a Markdown triage report.** You do **not** modify the working
> tree. The Adversarial Rewrite Tournament (§5B) produces candidate rewrites as
> **fenced code blocks inside the report**, verified against a **scratch copy** of the
> file — never the real file. A single edit to a tracked source file is a failed run,
> not a bonus.
>
> **Repo root:** `/Users/ericguei/Claude/Projects/Credit Operating System`
> **Branch:** `codex/112` · **HEAD at brief time:** `8d746701`
> **Scratch root (all tournament work happens here):** `/private/tmp/claude-501/-Users-ericguei-Claude-Projects-Credit-Operating-System/d11bea83-e09b-4b53-b4f4-c68b06af5d05/scratchpad`
> **Write your report to:** `caos/docs/TRIAGE_REVIEW_REPORT.md`

---

## 0. The Mission

**Outcome you own:** a credit analyst is about to stake an investment-committee
recommendation on a number this codebase produced. Your job is to find, before they
do, the places where that number could be wrong — and to hand back a report where
every finding is ranked, grouped, evidenced against real code, and (for the worst
offenders) accompanied by a rewrite that has been proven not to break a single
caller. Money is behind a wrong read; that is the ranking criterion.

The mission runs in **three stages**, and the report covers all three:

1. **Classify.** Re-index the repository with GitNexus, then partition **every
   tracked file** into coherent review groups. §3A is the load-bearing constraint
   here: GitNexus's own `Community` layer will *not* give you this partition, and
   discovering that yourself costs hours. Read §3A before you write a single query.
2. **Triage.** Review each group, wide and cheap. Rank candidates by
   money-is-behind-a-wrong-read risk. Most of the codebase will produce nothing —
   that is the expected and correct outcome, and saying so is a finding.
3. **Tournament.** Run the Adversarial Rewrite Tournament (§5B) on the top
   candidates that triage surfaces — not on every file. This stage is expensive and
   strictly budgeted (§4C).

**Your authority is full, inside six fixed boundaries.** You decide the group
taxonomy, the triage criteria, which candidates earn a tournament, and the report's
shape. You do **not** get to move these six posts, and every decision must survive
them:

- **The working tree is read-only.** You may read any tracked file. You may write
  **only** `caos/docs/TRIAGE_REVIEW_REPORT.md` and files under the scratch root.
  Tournament candidates are applied to a **scratch copy** and tested there. The
  repository has **uncommitted parallel work in progress** — as of this brief,
  `caos/frontend/src/lib/api.ts` (modified), `caos/frontend/src/lib/api-auth-loss.test.ts`
  (untracked), and `.agent-reviews/redteam.md` (modified) are the user's live edits.
  Touching them destroys work. Never `git add`, never `git stash`, never `git checkout`.
- **A finding must be new.** This repository has been audited extensively and
  repeatedly (§3C). A "finding" that was already found and fixed is a defect in your
  report, not a contribution. Cross-check §3C before you write any item.
- **A finding must be grounded.** Every claim cites a real file and a real named
  block you actually opened. GitNexus is authoritative for *discovery*; the file on
  disk is authoritative for *fact*; the test suite is authoritative for
  *correctness*. A path you did not read is a defect.
- **No rewrite may change a contract.** For any tournament candidate, the impact set
  from `impact` (§5B step 2) is binding: a rewrite that changes a signature, return
  type, raised exception, or side effect that anything in the impact set relies on is
  **disqualified**, regardless of how elegant it is or how the Arbiter voted.
- **Financial semantics are exact, not approximate.** See §2B. A rewrite that changes
  a rounding boundary, a `None`-vs-`0.0` degrade, a NaN guard, or a waterfall
  ordering has changed the analytical output and is disqualified even if every test
  passes — the tests may simply not cover it.
- **Report, don't fix.** Your remit is the report. Do not open a PR, do not commit,
  do not apply a winner to the real file. Recommending a fix is the deliverable;
  applying it is the user's decision.

**Deliverable.** One Markdown report at `caos/docs/TRIAGE_REVIEW_REPORT.md`,
grouped by the taxonomy you derive in Stage 1, each group's findings ranked P0→P3,
with tournament results for the top candidates. §5 gives the shape.

---

## 0.1 How to work — operating guide (written for how Fable 5 performs best)

Read this before you start; it is calibrated to how you specifically do your best
work.

- **Decide the taxonomy, then decompose. Don't wait for permission.** You have the
  goal, the constraints, and a measured baseline of what the graph can tell you. When
  you have enough to commit to a group partition, commit to it and move. Give a
  recommendation, not a survey of every possible clustering. Re-deriving what §3
  already establishes is wasted motion.
- **Start at the hard foundation, not the easiest group.** The engine
  (`caos/server/engine/`, 1,897 indexed nodes) is where a wrong number is born and
  where the recurring bug class lives (§2B). Triage it first, at full depth, while
  your attention is freshest. The frontend and the docs are not where money is lost.
  A report that triages `caos/scripts/` beautifully and the engine shallowly has
  failed.
- **Most groups are clean, and saying so is the job.** Do not manufacture findings to
  fill a group heading. An empty group with one honest sentence ("47 files, no
  finding above P3 — the money math here is all delegated to `engine/periods.py`") is
  more useful than four padded P3s. The failure mode to fear is a report where every
  group happens to yield findings.
- **Lead every writeup with the outcome.** The first sentence of any section, and of
  the final report, answers "what did you find and why does the analyst care."
  Supporting detail comes after. Readability beats brevity: complete sentences,
  spelled-out terms, no arrow-chains or invented shorthand. The user reads this cold.
- **Ground every claim in evidence.** §3 was produced by querying the live index and
  reading the live tree. Before you assert a fact not in §3, open the file and
  confirm it. Before reporting progress, audit each claim against a tool result from
  this session. A finding you did not verify is worse than no finding.
- **Delegate to fresh-context subagents, and keep working while they run.** The
  tournament roles (§5B) are subagents by construction. Your self-check (§6) is
  strongest when an agent that has *not* seen your reasoning audits a completed
  group. Dispatch and keep moving; don't block on the slowest.
- **Respect the fan-out budget (§4C).** This is not a style note. Large parallel
  subagent fan-outs trip the session token cap and kill the run mid-flight. Stagger.
- **Keep a working memory file.** Record decisions and rationale in
  `caos/docs/.triage-notes.md` (scratch-tier, but in-repo is fine — it is a new file,
  not a tracked one you are mutating): the group taxonomy and why, which candidates
  you rejected for tournament and why, which prior-audit items you checked a finding
  against. It keeps the report internally consistent across many groups and gives
  your checkpoints something to audit against.
- **De-prescription is deliberate.** This brief gives you the goal, the constraints,
  the baseline, and the map — not a step list. Fill the gaps with judgment; that is
  the job.

---

## 1. System context — what CAOS is

**CAOS — Credit Agent OS.** An institutional leveraged-finance credit-analysis
platform. One FastAPI process (`caos/server/main.py`) serves the JSON API under
`/api` and the built Next.js static export at `/`. The analytical work is a 27-module
"Modular OS" methodology executed by a deterministic engine (`caos/server/engine/`),
much of it LLM-backed. It deploys as a self-hosted Docker stack (Caddy →
oauth2-proxy → FastAPI → Postgres).

**Who is harmed by a defect here.** The primary user is a **buy-side credit analyst**
building a defensible credit view for an investment committee. A wrong leverage
figure, a silently-degraded scenario, or a NaN that renders as a plausible number is
not a cosmetic bug — it is a wrong investment decision. The secondary personas (PM/CIO
scanning posture, Head of Research owning the QA gate) are harmed by the same class of
defect, one layer removed.

**The shape of the tree** (tracked files, measured): 495 Python, 440 TypeScript/TSX,
992 Markdown, 2,696 total. The Markdown is not filler — `Modular OS/` is the
analytical prompt corpus that the engine actually reads at runtime, and it has two
consumers. Prose is in scope for classification; apply judgment on whether prose
earns a finding.

---

## 2. The success bar (the objective proxy)

### 2A. What makes a finding worth writing

The objective is "the analyst does not stake a recommendation on a wrong number."
The measurable proxy is the bar below. Like any proxy it is the *floor*, not the
objective — clear a row by making a real defect visible, never by filing an item that
technically satisfies a column.

| Criterion | The pass bar |
|---|---|
| **Novel** | Not already recorded as found-and-fixed in §3C. If it overlaps a prior item, say which, and say what is *new* about your read. |
| **Grounded** | Cites a real file and a real named block (function/class/middleware), read this session. **No line numbers** — they rot; name the block. |
| **Consequential** | States, in one sentence, the wrong number or wrong behavior an analyst would actually see. "This is untested" is not a finding; "an all-`None` period silently yields leverage `0.0x` instead of `None`, which renders as investment-grade" is. |
| **Falsifiable** | States how to prove it: the input that triggers it, the test to run, the assertion that fails. An item nobody can check is an opinion. |
| **Ranked** | P0 (wrong number reaches the analyst) → P1 (wrong number reachable under a plausible input) → P2 (correctness risk, not currently reachable) → P3 (maintainability/clarity). |
| **Bounded** | Names the blast radius from `impact`, not a guess. |

### 2B. The financial invariants (these are the crown jewels)

A rewrite or a finding that touches these must treat them as exact. These are drawn
from the repository's own conventions and its prior audit history — treat them as the
known bug classes and confirm each against the live code before relying on it:

- **The CP-1 finite guard.** Any engine computation that divides or multiplies a
  CP-1-derived value (leverage, net debt, EBITDA, coverage) must gate the input
  through `engine/periods.py` → `is_finite_number` first. A plain
  `isinstance(x, (int, float))` check passes a `NaN` — and `bool(NaN)` is `True`, so
  the NaN slips the guard and poisons the divide, leaking `NaN` into the payload or
  crashing on a zero denominator. `is_finite_number` rejects `NaN`/`±inf` while
  accepting `bool`/`0`. This pattern recurs across CP-2B/2E/2F/3B/3D and the Altman
  score. **The guard family, verified present in the index:** `engine/periods.py` →
  `is_finite_number`, `safe_div`, `safe_add`; `engine/portfolio.py` →
  `checked_divide`, `_pct`; `engine/macro.py` → `_finite`.
- **Zero denominators degrade, they don't divide.** A denominator that can reach `0`
  (e.g. `ebitda * (1 - pct)` as `pct → 1`) returns `None`/degrades rather than
  dividing.
- **Output-infinity is a real bug class here.** A guard on the *inputs* is not a
  guard on the *output* — a `safe_div` whose inputs are both finite can still return
  `inf`. This class has been found and fixed more than once; assume it is not extinct.
- **`None` and `0.0` are not interchangeable.** `None` means "not computable" and
  renders as a dash; `0.0` renders as a number an analyst will act on. A rewrite that
  collapses one into the other has changed the analytical output.
- **The golden master is the drift alarm.** `caos/tests/server/golden/` —
  `test_golden_cp1.py`, `test_golden_e2e.py`, `test_golden_portfolio.py`,
  `test_golden_query_gates.py`, with `fun_facts.json` as fixture. If a rewrite moves
  a golden number, the rewrite is wrong until proven otherwise — the golden captures
  intended behavior, including behavior that looks like a bug. **Check the golden and
  the "by design" notes before calling engine behavior a defect.**
- **Waterfall ordering and day-count are semantics, not implementation.** Recovery
  waterfalls, seniority ordering, and period conventions encode credit meaning. A
  "cleaner" rewrite that reorders them is a wrong answer.

---

## 3. MEASURED BASELINE (already run for you — 2026-07-16)

Queried against the live GitNexus index and the live tree. **Use these as your
starting facts; re-verify only if you extend beyond them.**

### 3A. GitNexus capability map — READ THIS FIRST

**The honest headline: the symbol graph is excellent and the semantic layers are
not.** GitNexus will give you a reliable call graph, blast radius, and symbol
lookup. It will **not** give you a usable classification out of the box. Budget your
trust accordingly — the table below is measured, not inferred.

| Tool / layer | Verdict | What was measured |
|---|---|---|
| `query` | **Use it.** | Found the exact CP-1 guard family on a natural-language query. Returns `definitions` reliably. Note: **`embeddings: 0`** — hybrid ranking degrades to BM25 keyword only, so phrase your queries with terms that literally appear in the code, not concepts. |
| `context` | **Use it.** | 360° symbol view; the disambiguation path (`file_path`/`kind`/`uid`) works. |
| `impact` (`mode: 'callgraph'`) | **Use it — this is the tournament's binding input.** | Inter-procedural upstream/downstream over CALLS/IMPORTS/EXTENDS/IMPLEMENTS. Use `summaryOnly: true` on hub symbols to avoid output explosion. |
| `trace` | **Use it.** | Shortest path between two symbols; answers "how does A reach B" in one call. |
| `cypher` | **Use it — this is how you classify.** | Path-prefix partition over `n.filePath` works and yields a clean, usable partition (§3B). This is the substitute for the broken Community layer. |
| `Community` nodes | **DO NOT USE for grouping.** | 344 communities, but the distribution is unusable: `Server`=1812 members, `Engine`=584, `Routes`=449, then a long tail including ~11 *unnamed* buckets (`Cluster_173`, `Cluster_182`, `Cluster_166`, `Cluster_625`, …). A 1,812-member "Server" bucket is ~17% of all nodes in one undifferentiated blob. It is not a review taxonomy. |
| `Process` nodes | **DO NOT USE as execution flows.** | 300 processes, but they are trivial 2-hop chains: `Get_portfolio → Get_settings`, `Create_run → _sig`, `Get_run_freshness → _run_rollback_cleanups`. They name a caller and a callee, not a flow. |
| `route_map` / `api_impact` | **Handlers only — distrust the rest.** | `/api/runs` resolved its handler (`caos/server/routes/runs.py`) correctly, but returned **`middleware: []` and `consumers: []`** across all 8 matched routes. The middleware/consumer detection is tuned for Next.js API routes and does not fire on FastAPI. Do **not** conclude a route is unprotected from an empty `middleware` array — read `main.py` and the router dependencies instead. |
| `explain` (taint) | **Unavailable.** | Returns `no taint layer — run gitnexus analyze --pdg`. There are **zero** persisted taint findings. Absence of taint findings here is *not* evidence of no injection risk; the layer was never built. |
| `pdg_query`, `impact mode:'pdg'` | **Unavailable.** | Same missing `--pdg` layer. |

**Re-indexing (Stage 1).** The index carries a per-branch snapshot. The `codex/112`
branch was indexed 2026-07-16 at commit `716ded5b`; HEAD is now **`8d746701`**, so
the index is **1 commit behind** and does not contain the working-tree WIP at all.
Re-index before you classify:

```
node .gitnexus/run.cjs analyze --skip-agents-md --skip-skills
```

This runner is WIP-safe and takes roughly 16 seconds. **Decide explicitly whether to
add `--pdg`**: it would unlock `explain`/`pdg_query` and give you a real
source→sink taint layer for the security dimension, at the cost of a longer index.
Given that the security dimension is otherwise blind (§3A), the recommendation is to
run it — but it is your call, and if you skip it, say so in the report and mark the
security group's coverage as limited rather than clean.

### 3B. The measured partition (your Stage 1 starting point)

Path-prefix partition over `n.filePath`, run against the `codex/112` index. This is
the shape the tree actually has — refine it into your taxonomy, don't re-derive it:

| Area | Indexed nodes |
|---|---|
| root/other (incl. `Modular OS/`, config, docs) | 4,810 |
| `caos/server/` (excl. routes/engine) | 4,063 |
| `caos/tests/` | 2,811 |
| `caos/server/routes/` | 2,481 |
| `caos/server/engine/` | 1,897 |
| `caos/frontend/src/components/` | 1,584 |
| `caos/frontend/src/lib/` | 1,451 |
| `caos/frontend/src/app/` | 691 |
| `caos/frontend/` (other) | 164 |
| `caos/scripts/` | 60 |

Index totals for reference: 991 files, 10,855 nodes, 19,217 edges. `caos/server/`
alone holds 1,412 indexed functions. Note the node counts exceed the tracked-file
counts because `File`/`Folder` nodes are included — treat these as *relative weight*,
not a file census.

### 3C. Prior audit inventory — what is already known (your novelty filter)

**This repository has been audited hard and often.** The single highest-probability
failure mode for this run is re-reporting a fixed defect as a new finding. Before you
file any item, check it against this set. These are real paths, verified present:

**Standing matrices and audits** (`caos/docs/qa/`):
- `REVIEW_MATRIX_BACKEND.md` (51 KB) — 9 backend groups, 28 findings, 26 fixed.
- `REVIEW_MATRIX_FRONTEND.md` (31 KB) — 98 findings.
- `CONFIDENCE_AUDIT_2026-07-10.md` (64 KB) and `CONFIDENCE_AUDIT_2026-06-26.md` (331 KB).
- `ENGINE_CORRECTNESS_2026-07-10.md` — engine math family review.
- `PR_TRIAGE_2026-07-11.md`, `FAULT_LOG.md`, `MOCK_LEDGER.md`, `FEATURE_TRACKER.csv`.

**Methodology playbooks** (`caos/docs/qa/playbooks/`) — these encode the dimensions
prior reviews used, and are the best short read for "what has already been looked
for": `engine-correctness.md`, `llm-safety-grounding.md`, `security-infra.md`,
`backend-api-data.md`, `frontend-functional.md`, `integration-seams.md`,
`design-a11y-ux.md`, `performance.md`, `code-health-methodology.md`.

**A caveat that matters:** the repository's own convention is that **trackers lag the
code** — `AUDIT.md`-style documents and issue lists trail the shipped engine. Do not
treat a line in a tracker as an open defect without grepping the code first. The
inverse also holds: do not treat a matrix as proof a defect is fixed without reading
the fix. Use §3C to *raise your bar for novelty*, not to close questions.

### 3D. The test harness (authoritative for correctness)

Verified present. This is what a tournament winner must survive:

- **Server suite.** Use the prod-parity virtualenv:
  `caos/server/.venv311/bin/python` (Python 3.11 — the `.venv` alias is 3.9 and lags
  new dependencies). **Never downgrade the FastAPI `0.138` pin.** CI runs:
  `python -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q`.
  Clear `ANTHROPIC_API_KEY` for offline runs.
- **Frontend suite.** `caos/frontend/` → `npm test` (`vitest run`), lint via
  `eslint src`. Note the repo convention that **concurrent vitest runs corrupt each
  other** — run the suite serially.
- **Shared-DB gotcha.** The server tests share one process-global database. Seeds must
  be per-entity idempotent and non-colliding, or you get module-order flakes. A test
  that fails only in a full-suite run may be this, not your rewrite.
- **CI gates a tournament winner must not break:**
  - `ruff check caos/server caos/tests` (config: `ruff.toml`).
  - **Complexity gate:** `caos/scripts/check_complexity_delta.py --base-ref origin/<base>`
    — C901 cyclomatic > 10 on the Python paths the PR changed. Baseline debt may not
    worsen; new findings fail. **This directly scores your Readability challenger** —
    a rewrite that lowers complexity is a measurable win here, and one that raises it
    fails CI regardless of the Arbiter's vote.
  - **Dead code:** `vulture` 2.14 over the backend, currently zero findings at
    confidence ≥ 80.
- **Compare against `origin/main`**, not local `main` — local may be stale or shallow.

---

## 4. Scope, group map, and execution order

### 4A. Scope

**Everything tracked** (2,696 files). But scope is not the same as depth — see §4B.
Every tracked file lands in exactly one group in your taxonomy; not every group earns
equal scrutiny, and the report says explicitly which groups you triaged deeply and
which you swept.

### 4B. Execution order (dependency-correct)

| # | Stage | What happens | Why here |
|---|---|---|---|
| **0** | **Re-index** | `node .gitnexus/run.cjs analyze --skip-agents-md --skip-skills` (+ `--pdg` decision, §3A) | The index is 1 commit stale and has no PDG layer. Everything downstream reads this graph. |
| **1** | **Classify** | Cypher path-partition (§3B) refined into a review taxonomy; each tracked file assigned to exactly one group | The taxonomy is the report's spine. Doing it after triage means re-doing triage. |
| **2** | **Triage: engine** | `caos/server/engine/` at full depth, against §2B | The hard foundation — where a wrong number is born. Freshest attention goes here. |
| **3** | **Triage: server** | `caos/server/routes/` + `caos/server/` (models, executors, config, auth) | Where a wrong number is served, and the trust boundary. |
| **4** | **Triage: frontend** | `caos/frontend/src/` | Where a wrong number is rendered — including "renders plausibly when it should render a dash". |
| **5** | **Triage: everything else** | `Modular OS/`, `caos/tests/`, `caos/scripts/`, `caos/deploy/`, docs | Swept, not excavated. The corpus matters (the engine reads it); most docs do not. |
| **6** | **Tournament** | §5B on the ranked candidates from stages 2–5 | Needs the full ranked list to spend its budget well. Cannot start before triage completes. |

### 4C. The fan-out budget (hard constraint, not a suggestion)

**Large parallel subagent fan-outs trip the session token cap and kill the run.** The
repository's own operating convention, learned the hard way: **6+ concurrent agents
is the danger zone.** The tournament (§5B) spawns 5 roles per target. Therefore:

- **Run at most one tournament at a time.** Its 5 roles are the fan-out.
- **Stagger triage subagents 2–3 at a time**, not one-per-group in parallel.
- **Budget roughly 4–8 tournaments total** across the whole run, spent on the highest
  P0/P1 candidates. If triage surfaces 30 candidates, tournament the top handful and
  report the rest as findings without a tournament. Say in the report how many
  candidates you tournamented and how many you did not — **a silent cap reads as
  "covered everything" when it didn't.**
- **Make the Arbiter defensive** — it must handle a role that returns nothing.

---

## 5. Output specification — how to write `TRIAGE_REVIEW_REPORT.md`

### 5A. Report structure

```
# CAOS Triage Code Review — <date>

## Summary                       <- outcome first: what you found, how bad, what to do
## Method & coverage             <- taxonomy, what was deep vs swept, tournaments run vs skipped, PDG decision
## Group: <name>                 <- one per group in your taxonomy
   ### [P?] <Component> — <title>
## Adversarial Rewrite Tournaments
   ### Tournament N: <symbol> (<path>)
## Not findings                  <- things that look wrong and aren't, with why (this section earns trust)
```

**Every finding follows this shape** — a completeness floor, not a rigid form:

```markdown
### [P?] <Component> — <short title>
- **Finding (1 sentence):** <the wrong number or behavior, concrete, no hedging>.
- **Files / blocks:** `caos/server/<file>.py` → `<function/class name>` (NOT a line number).
- **Analyst impact (1 sentence):** <what the analyst sees, and why it misleads>.
- **Blast radius:** <from `impact` — callers/processes affected, or "leaf">.
- **Novelty:** <new, or: overlaps `REVIEW_MATRIX_BACKEND.md` item X — here's what's new>.
- **Proof:** <the input that triggers it / the test that fails / the assertion to add>.
```

### 5B. The Adversarial Rewrite Tournament (Stage 6)

Run this per selected candidate. You are the Orchestrator. **You — not the agents —
own correctness.**

**Step 1 — Ground it.** Read the target with your own file tools before spawning any
agent. Quote real paths and line ranges. Detect the test command (§3D). List the
financial invariants the code must preserve (§2B).

**Step 2 — Map the connections (hard constraint).** Before any rewrite, build the
impact set with `context <symbol>` (disambiguate shared names via `file_path`/`kind`)
and `impact <symbol>` (both directions). **Record the impact set explicitly in the
report.** Any rewrite that changes a signature, return type, raised exception, or
side effect relied on by anything in the set is **disqualified — no exceptions.** The
graph may be stale relative to your scratch edits: treat it as authoritative for
*discovery*, and the test suite as authoritative for *correctness*.

**Step 3 — Spawn the roles** as distinct subagents. Keep snippets **anonymous (A/B)**
when they reach the Arbiter.

- **Incumbent** — Principal Systems Engineer. Defends the existing code: argues that
  stability and predictability are paramount, and that the current complexity may be
  **load-bearing for edge cases** (rounding, stub periods, PIK toggles, edge
  covenants, NaN guards), citing **specific callers from the impact set** that depend
  on current behavior. Argues refactoring is risk. **Writes no new code** — defends
  the existing logic only.
- **Challenger 2a — Speed.** Rewrite for minimum execution time.
- **Challenger 2b — Memory.** Rewrite for minimum allocation / space.
- **Challenger 2c — Readability.** Rewrite for fewest lines and maximum clarity.
  (Note: this one is objectively scoreable against the C901 complexity gate — §3D.)

Each challenger: brutally critique inefficiencies, anti-patterns, and cyclomatic
complexity, then output a refactored version in a fenced code block. **Every rewrite
must preserve exact financial semantics (§2B) and honor the contract for every caller
in the impact set — no silent behavior changes.**

**Step 4 — Arbiter.** Neutral Staff Engineer. Judges **only** on (1)
readability/conciseness, (2) time/space complexity, (3) maintainability. Ignores
rhetoric that doesn't map to the actual code. Runs the bracket:
**2a vs 2b → winner vs 2c → ultimate Challenger vs Incumbent.** At each match,
declare a definitive winner (Snippet A or B) with a 3-bullet justification.

**Step 5 — Orchestrator verification (do not skip).** For the final winning
candidate:

1. Apply it to a **scratch copy** of the file, under the scratch root. **Never the
   real file.**
2. Run the real test suite (§3D); report pass/fail with **actual output**.
3. Confirm the §2B invariants are unchanged — spot-check at least one concrete case
   (a golden number, a waterfall ordering, a NaN guard).
4. Re-check that each caller in the impact set still imports/compiles and passes —
   **this is where a "better" rewrite gets caught.**

**Reject any winner that fails tests or breaks a caller — even if the Arbiter favored
it** — and fall back to the next candidate. Note the repository's convention here: a
subagent's self-reported diff can omit real changes it made. **Re-run `git diff`
against the scratch copy yourself; do not trust the prose.**

**Step 6 — Report the tournament:**

```markdown
### Tournament N: <symbol> (`<path>`)
- **Impact set:** <callers/processes from `impact` — the binding contract>
- **Winner:** Snippet A or B (<which role>), replacing `<path>` → `<block>` (lines X–Y)
- **Justification:** <3 bullets from the Arbiter>
- **Final code:** <one fenced block>
- **Verification:** <exact test command run + actual result; invariant spot-check; caller re-check>
```

**If nothing beats the Incumbent on verified merits, say so and keep the original.**
That is a legitimate and common outcome — the Incumbent wins by default when the
complexity is load-bearing, and a tournament that always crowns a challenger is a
rigged tournament.

### 5C. Rules for the report

- **No line numbers in findings** (the tournament's replace-range is the one
  exception — it needs them). Name the block.
- **Don't re-report fixed defects.** Cross-check §3C. If you disagree with a prior
  matrix, say so with evidence from the current code.
- **Every finding ties to §2A's bar.** An item that clears no row does not belong.
- **The "Not findings" section is mandatory and load-bearing.** Anything that looked
  like a defect and survived scrutiny goes here with the reason. It is how the reader
  calibrates trust in the rest, and it is where the golden-master "looks like a bug,
  is by design" cases land.
- **Report coverage honestly.** Which groups were deep, which were swept, how many
  tournaments ran versus how many candidates deserved one, and whether you ran `--pdg`.

---

## 6. Self-check protocol

**Cadence: one fresh-context verifier subagent per completed group.** Dispatch it
**asynchronously and keep triaging the next group while it runs** (inside the §4C fan-out
budget). **Reconcile every REVISE before you declare done (§7)** — the reconciliation is
the gate, not mid-stream progress.

Charge the verifier with this — do **not** self-approve:

> "Review the just-completed `## Group: <name>` section of
> `caos/docs/TRIAGE_REVIEW_REPORT.md`. For each finding verify, against the live code:
> (1) **the file path and named block actually exist** — flag any hallucinated path or
> call site; (2) the **defect is genuinely present** — read the code and try to
> disprove it; flag anything that is already guarded, already handled, or misread;
> (3) the **defect is novel** — cross-check `caos/docs/qa/REVIEW_MATRIX_BACKEND.md`,
> `REVIEW_MATRIX_FRONTEND.md`, and the playbooks in `caos/docs/qa/playbooks/`; flag any
> item that re-reports a known-fixed defect; (4) the **analyst impact is real and
> correctly stated** — would a buy-side credit analyst actually see a wrong number, or
> is this a theoretical concern dressed up? flag inflated severity; (5) the **proof is
> falsifiable** — could someone actually run it and see the failure? (6) the **blast
> radius matches `impact`**, not a guess. Return a table: finding → PASS / REVISE (with
> the specific defect). Be adversarial; assume a cited call site is hallucinated and a
> severity is inflated until proven otherwise."

**Why adversarial:** the repository's own convention, learned across many audits, is
that **agents inflate severity**. A verifier that agrees with everything has not
verified anything.

**Continuous guardrails (apply as you write, not only at checkpoints):**
- Before citing any file/block, confirm you read it this session.
- Before filing any finding, ask: is this in §3C already?
- Before crowning any tournament winner, ask: did I run the tests, or did an agent
  tell me it ran them?
- Before every claim of progress, point at the tool result that proves it.

---

## 7. Definition of done

- `caos/docs/TRIAGE_REVIEW_REPORT.md` exists, structured per §5A, opening with the
  outcome.
- The index was re-built at Stage 0, and the `--pdg` decision is stated.
- **Every tracked file is assigned to exactly one group**, and the taxonomy is derived
  from the measured partition (§3B) — not from GitNexus `Community` nodes.
- Every finding meets the §2A bar: novel, grounded in a real named block, consequential
  in analyst terms, falsifiable, ranked, blast-radius bounded.
- No finding re-reports a defect recorded as fixed in §3C without saying what is new.
- Every tournament records its impact set, its bracket, its winner (or a reasoned
  Incumbent hold), and **verification with actual test output** — not a claim of it.
- No tournament winner that fails tests or breaks an impact-set caller is crowned.
- **The working tree is unmodified except for the report** (and optionally
  `caos/docs/.triage-notes.md`). `git status` shows the user's WIP —
  `caos/frontend/src/lib/api.ts`, `caos/frontend/src/lib/api-auth-loss.test.ts`,
  `.agent-reviews/redteam.md` — **untouched**. Nothing staged, nothing committed.
- Every group checkpoint is recorded, and every REVISE is reconciled.
- Coverage is reported honestly: deep vs swept groups, tournaments run vs candidates
  deferred, and any dimension left blind (e.g. taint, if `--pdg` was skipped).

---

## Appendix — Invocation (operator note)

Hand this brief to a **Claude Fable 5** session at **`xhigh` effort** by pasting the
prompt below. It is deliberately thin: this file is the context pack, so the prompt
only points Fable 5 at it and states the deliverable, the boundaries, and the autonomy.

```
I'm reviewing CAOS — an institutional leveraged-finance credit-analysis platform
(Next.js frontend, FastAPI server, Postgres) — to find places where a buy-side credit
analyst could stake an investment-committee recommendation on a number the codebase
got wrong. You are acting as the Principal Code Reviewer.

Read `caos/docs/TRIAGE_REVIEW_BRIEF.md` in full and own the mission it defines. Your
deliverable is the triage report — write it to `caos/docs/TRIAGE_REVIEW_REPORT.md`.
The deliverable is the report: do not modify the working tree. Tournament rewrites are
fenced code blocks in the report, verified on a scratch copy. The repo has uncommitted
work in progress; never stage, stash, or check out anything.

Work autonomously through the brief's §4B stages: re-index, classify every tracked file
into groups (the brief's §3A tells you which GitNexus layers are usable — trust it),
triage each group starting with the engine, then run the §5B Adversarial Rewrite
Tournament on the top candidates within the §4C fan-out budget. Ground every finding in
a file you actually opened and check it against the prior-audit inventory in §3C before
you file it — re-reporting a known-fixed defect is a defect. After each group, run the
§6 self-check with a fresh-context verifier subagent and reconcile every REVISE before
the §7 definition of done. Before reporting progress, audit each claim against a tool
result from this session; if you say the tests passed, they must have actually run.
Proceed without pausing for confirmation; pause only for a genuine scope change or a
decision only I can make.
```

**Recommended effort:** `xhigh` — the tournament's contract reasoning (proving a
rewrite preserves exact financial semantics across an impact set) and the novelty
filter against a large prior-audit corpus are the capability-sensitive parts; the
payoff is a report whose findings are real rather than plausible.
