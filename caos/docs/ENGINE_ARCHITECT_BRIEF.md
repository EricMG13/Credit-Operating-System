# Engine Architecture Review — Execution Context for Fable 5

> **What this file is.** A self-contained context pack. You (Fable 5) are the
> **Principal Engine Architect** of CAOS's analytical core — you hold authority
> over how `caos/server/engine/` is *structured*: its modules, interfaces, seams,
> and test surfaces. Read this whole file, then own the mission below. Everything
> you need — the goal, the immutable engine conventions, the exact measurement
> commands, a **measured baseline already run for you** (§2), the real module map
> (§4), the mock↔engine data seam (§5), a proven output shape (§6), and an
> adversarial self-check protocol (§7) — is here. You are not filling in a
> template; you are deciding what this engine's architecture should *become*.
> **"Deepen" throughout means turning shallow modules into deep ones — interface,
> seam, and test-surface redesign — *not* rewriting the analytics: the CP
> methodology and the numbers each module computes are fixed (§3a); only how the
> code is *shaped* is in scope.** You do **not** write engine code — your
> deliverable is a Markdown implementation specification that **Opus 4.8** executes.
>
> **Repo root:** `/Users/ericguei/Claude/Projects/Credit Operating System`
> **Engine root:** `caos/server/engine/` (FastAPI service; 65 modules, 15,128 LOC)
> **Write your spec to:** `caos/docs/ENGINE_IMPLEMENTATION_SPEC.md`
>
> This brief is the engine-side sibling of
> [`FRONTEND_ARCHITECT_BRIEF.md`](FRONTEND_ARCHITECT_BRIEF.md) and mirrors its
> rigor: measured baseline, verified map, strict output spec, adversarial checks.
> It is an expanded, CAOS-grounded port of the open-source
> [`improve-codebase-architecture`](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md)
> skill; §6 preserves that skill's deliverables (visual HTML report + grilling
> loop) inside this brief's severity-graded structure.

---

## 0. The Mission

**Outcome you own:** a credit engine that a coding agent (and a human) can reason
about *locally* — where understanding one CP figure, or one autonomy layer, does
not require bouncing across a dozen modules, and where the real bug surface (how
modules *compose*) is testable through an interface rather than only through a
847-line orchestrator. Money is behind a wrong read: a NaN through a leverage
divide is a silent wrong number in front of an investment committee. Deep,
locally-reasoned, interface-tested modules are how the analytical seams stay
honest.

CAOS's engine has grown to **65 modules / 15,128 LOC with 129 intra-engine import
edges**. It is not slop — coverage is real (139 server test files) and the CP
methodology is sound. The architectural debt is **shape**: a fleet of shallow
single-use adapters under a god orchestrator, a CP-1 metric figure smeared across
six modules, a safety guard enforced by convention rather than by type, and a
1,499-line query god-module. Your job is to specify the **deepening** that fixes
shape without touching the analytics, on two fronts:

1. **Deepen shallow seams.** Decide which of the measured candidates in §2 to turn
   from shallow → deep: concentrate complexity into one testable module, collapse
   a needless bounce, or make an implicit convention explicit in an interface.
2. **Raise the test surface.** Where the composition — not the pure function — is
   the bug surface, specify the interface that makes composition directly testable.

**Your authority is full, inside four fixed posts.** You decide module shape,
seams, interfaces, and what to collapse or deepen. You do **not** move these, and
every decision must survive them:
- **The CP methodology and computed numbers are immutable (§3a).** Refactor
  *shape*, never *what a figure equals*. Golden tests (`tests/server/golden/`)
  must stay green byte-for-byte.
- **The `is_finite_number` guard law is non-negotiable (§3a).** Any CP-1-derived
  divide/multiply must remain guarded; a deepening may make the guard *more*
  enforced (e.g. a guarded-quantity type), never less.
- **Every refactor must earn its place in credit analysis.** If you cannot state
  in one line how a deepening makes an analyst-facing read more correct, more
  navigable, or more testable, it does not go in the spec.
- **Respect the mock↔engine seam and the data model (§5).** Never specify a
  refactor that changes a payload contract the frontend or a route depends on
  without naming the consumer and the migration.

**Deliverable.** A single Markdown spec Opus 4.8 executes top-to-bottom,
**grouped strictly by execution severity (P0→P3)**. Each item states the gap in
one sentence, points at real modules and named functional blocks (**never guessed
line numbers**), gives Opus an explicit build instruction, and names the
architectural principle (§3) and the credit payoff it serves. §6 gives a proven
item shape — a completeness floor, not a cage. Run the self-check in §7 as you go.

---

## 0.1 How to work — operating guide (written for how Fable 5 performs best)

Read this before you start; it is calibrated to how you do your best work.

- **Design first, then decompose. Don't wait for permission.** You have the goal,
  the constraints, the measured baseline, and the map. When you have enough to
  decide, decide — pick the deepening direction and specify it. Give a
  recommendation, not a survey of options you won't pursue. Re-deriving what this
  file establishes, or re-litigating a fixed constraint, is wasted motion.
- **Start at the highest-leverage seam, not the easiest.** The `runner`/`synthesize_*`
  orchestration and the CP-1 metric lane (§2) are where the shape problem is real
  and where the blast radius is largest. Scope those first; the smaller adapters
  follow the pattern you set.
- **Generate options where the design space is wide, then commit.** For a seam
  that could plausibly go several ways (e.g. registry-driven runner vs. pipeline
  vs. layered synthesizer protocol), lay out 2–4 concrete directions (each: what
  changes, why it serves correctness/navigability/testability, one line of
  rationale), pick one, and specify only that in depth. Hand Opus a decision with
  its reasoning, not a menu.
- **Lead every writeup with the outcome.** The first sentence of any section
  answers "what should change and why does correctness/navigability improve." Full
  prose, spelled-out terms, no arrow-chains in the deliverable. (This brief uses
  compressed shorthand for density; that is a note-taking register, not a model
  for your spec.)
- **Ground every claim in evidence — you have a measured baseline; extend it,
  don't assert past it.** Before claiming a module is shallow, a seam leaks, or a
  path is untested, point to the number: a `depth.py` row, a fan-in count, a
  missing `test_<module>.py`. Re-run the §3 measurement commands on anything you
  touch. A ratio you did not measure is a defect, not a finding. **The GitNexus
  MCP tools that `CLAUDE.md` prescribes were not connected in the session that
  produced §2 — the baseline was measured by direct static analysis (AST + import
  graph). If GitNexus is available to you, prefer it and reconcile any delta; if
  not, say so and use the same static method.**
- **Apply the deletion test to every candidate.** Would deleting this module
  *concentrate* complexity (good — a real deepening signal) or just *move* it (no
  win)? Keep only "concentrates."
- **State boundaries, then stay inside them.** Your remit is a *spec*, not code and
  not an analytics rewrite. Don't change what a figure computes, don't break a
  payload contract without naming its consumer, and don't let "full authority"
  drift into rewriting the CP methodology.
- **Delegate verification to fresh-context sub-agents, and keep working while they
  run.** Your self-check (§7) is strongest when a separate agent that has not seen
  your reasoning audits it — fresh eyes catch a hallucinated import edge or a
  golden-test break that self-review rationalizes. Fan these out asynchronously at
  each checkpoint; don't block on the slowest.
- **Keep a working memory file** (`caos/docs/.engine-spec-notes.md`): which
  direction you chose per seam and why, which candidates you rejected and why. It
  keeps the spec consistent across clusters and gives your checkpoints something
  to audit against.

---

## 1. Product goal, users, and what "material leverage" means

**CAOS — Credit Agent OS.** An institutional leveraged-finance credit-analysis
platform. The engine (`caos/server/engine/`) is the deterministic + LLM analytical
core behind a FastAPI service and a Next.js analyst UI. The methodology is the
27-module "Modular OS" CP corpus (`Modular OS/`): CP-1 (facts/metrics), CP-2/3
(analysis), CP-4 (structure/headroom), CP-5 (QA gate).

**Primary consumer of the engine — the buy-side credit analyst,** indirectly, via
the UI and the autonomy DAG. When the engine produces a leverage figure, a
covenant finding, or a distress read, an analyst defends it to an investment
committee. The engine's architecture serves that by keeping each read **correct**
(guarded arithmetic, lineage-validated), **navigable** (a figure's derivation
readable in one place), and **testable** (the composition, not just the leaf
function, exercised through an interface).

**"Material leverage" for this brief** means a shape change that measurably makes a
read *more correct*, *more navigable*, or *more testable* — not churn. Concretely
valuable deepenings: collapsing a multi-module CP-1 bounce into one deep metric
module; making the `is_finite_number` guard a property of a quantity type rather
than a per-call-site convention; turning the `runner`→`synthesize_*` god
orchestration into a registry-driven seam whose composition is directly testable;
splitting the 1,499-line `querygraph` god-module along its real internal seams.
**These are the measured candidates in §2 — argue each on its number, not its
vibe.** Anti-pattern to reject: refactoring for tidiness with no correctness /
navigability / testability payoff, or that risks a golden-test delta.

**The mock↔engine seam (critical context, §5).** The engine emits real output;
the UI is "prefer live, static fallback." Some engine payloads are contracts the
frontend and routes depend on. A deepening that reshapes a payload must name its
consumer and specify the migration — never silently change a contract.

---

## 2. The measured baseline (already run for you — 2026-07-08)

I measured `caos/server/engine/` directly: per-module LOC, public interface count
(top-level non-underscore `def`/`class` = the interface surface), depth ratio
(LOC ÷ public symbols — high is deep, low is shallow), intra-engine fan-out
(engine modules imported) and fan-in (engine modules importing this one), and
dedicated-test presence (`caos/tests/server/test_<module>.py`). **Use these as
your starting numbers; re-measure only what you touch.** The headline: the engine
is **well-tested and correct but structurally shallow-in-places** — a shape
redesign target, not a rewrite.

**Scale:** 65 modules · 15,128 LOC · 129 intra-engine import edges · 139 server
test files. Two backbone surfaces carry the graph: **`schemas`** (fan-in 27) and
**`periods`** (fan-in 20).

### 2a. Measured candidate seams (ranked by leverage)

| # | Seam / cluster | Measured signal | Deletion-test read |
|---|---|---|---|
| **C1** | **`runner` god-orchestrator over `synthesize_*` adapters** | `runner.py` 847 LOC, **2 public, fan-out 27, fan-in 0**. Its ~20 `synthesize_*` callees are 69–208 LOC, 1–3 public, **fan-in 1 (only runner)**. Several — `catalysts, sponsor, legal, refinancing, relval, macro, capstructure, downside, portfoliofit, coststructure` — have **no dedicated test**; the composition is reachable only via `test_runner_layers.py`. | Deleting an adapter *moves* complexity into `runner`; the bug surface is the orchestration, which has no interface. **Concentrates → strong deepening candidate.** |
| **C2** | **CP-1 metric lane smeared across 6 modules** | One figure flows `metricfactlane`(286)→`metricengine`(315)→`metrics`(293)→`periods`(85), plus `adjusted`(246), `reported_cp1`(264), `edgar_cp1`(521) ≈ **1,900 LOC**, consumed at **10 call sites** (`anomaly, coststructure, peers, reporter, runner, queryanswer, querygraph, query route`). | Understanding one CP-1 number requires traversing 4–6 modules — **locality loss**. A deep `MetricLane` facade would concentrate the derivation. **Concentrates.** |
| **C3** | **`is_finite_number` guard is an implicit convention across 20 modules** | `periods.py` 85 LOC, 4 public, **fan-in 20**. `CLAUDE.md` mandates gating every CP-1 divide/multiply through `is_finite_number`, but enforcement lives at each of ~20 call sites, not in the metric interface. | The guard is a hypothetical seam repeated 20×. A guarded-quantity type (the guard *is* the interface) concentrates it. **Concentrates → high-correctness-leverage.** |
| **C4** | **`querygraph` navigability god-module** | `querygraph.py` **1,499 LOC**, 3 public (`availability`, `capabilities`, `build_graph`) over **42 private helpers**; sits in a `query*` cluster with `queryinsights`(613), `queryanswer`(435, fan-out 8), `queryoverlay`(306) ≈ **2,850 LOC**. | High LOC/public ratio reads "deep," but 1,499 lines in one file is a navigability failure — internal seams want their own modules. **Split along measured internal seams; verify each split passes the deletion test.** |

> **Two guardrails on these numbers.** (1) **Depth ratio is a proxy, not the
> objective.** `runner` (423) and `querygraph` (499) score "deep" by LOC/public
> yet are the two worst shape problems — the fan-out (27) and single-file bulk
> (1,499) are the real tells. Read the *pair* (depth ratio + fan-in/out + file
> size + test surface), never one number. (2) **≈36-style bar analog:** there is
> no off-the-shelf 40-point scale for backend architecture, so the measurable
> proxy is per-candidate: *deletion-test = concentrates*, *composition testable
> through an interface*, *fan-out or single-file bulk reduced*, and **golden +
> full suite still green**. If a change wouldn't move one of those, it doesn't
> earn its place.

### 2b. What is explicitly NOT the problem (weight your spec accordingly)

- **Not test absence.** 139 test files; 44 engine modules carry a dedicated
  `test_<module>.py`. The gap is *test surface* (composition vs. leaf), not
  coverage. Your P0/P1 items should specify interfaces that make composition
  directly testable, not "add tests."
- **Not the analytics.** The CP figures are correct and golden-locked. Do not
  touch what a number equals.
- **Not the shared surfaces themselves.** `schemas` (fan-in 27) and `periods`
  (fan-in 20) are legitimately central; deepen *around* them, and treat any change
  to their interface as automatically HIGH blast-radius (§7).

---

## 3. Running the baseline (do this first, before writing the spec)

The mission requires measured evidence as your baseline. Mechanics:

1. **Re-measure depth/coupling** with the same method that produced §2 (AST +
   import graph). A reproducible script equivalent to the one used:
   ```bash
   # from caos/server/ : per-module LOC, public interface count, fan-in/out
   python3 - <<'PY'
   import os, ast
   from collections import defaultdict
   mods={}; 
   for f in sorted(os.listdir("engine")):
       if not f.endswith(".py"): continue
       n=f[:-3]; src=open(f"engine/{f}").read(); t=ast.parse(src)
       pub=sum(1 for x in t.body if isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)) and not x.name.startswith("_"))
       imps={a.split(".")[1] for node in ast.walk(t) if isinstance(node,ast.ImportFrom) and (node.module or "").startswith("engine.") for a in [node.module]}
       mods[n]=(src.count(chr(10))+1, pub, imps)
   fanin=defaultdict(int)
   for n,(_,_,imps) in mods.items():
       for i in imps: 
           if i in mods: fanin[i]+=1
   for n,(loc,pub,imps) in sorted(mods.items(), key=lambda kv: (kv[1][0]/max(kv[1][1],1))):
       print(f"{n:22}{loc:5}{pub:4}  depth={loc/max(pub,1):6.1f}  fanout={len([i for i in imps if i in mods]):3}  fanin={fanin[n]:3}")
   PY
   ```
   Cite its output (module + ratio + fan-in/out) for any claim you make.
2. **Confirm the import edge** before asserting coupling: `grep -n "import" engine/<mod>.py`
   and `grep -rl "engine.<mod>" engine/ routes/` for consumers. A path you did not
   grep is a defect.
3. **Establish the safety baseline you must not break** — run the suite green
   before proposing anything, so any later red is *your* delta:
   ```bash
   .venv311/bin/python -m pytest caos/tests/server -q          # 139 files
   .venv311/bin/python -m pytest caos/tests/server/golden -q   # byte-for-byte CP goldens
   ```
   (Use the designated venv per `CLAUDE.md`; do not downgrade the FastAPI pin in `requirements.txt` — currently `0.139.*`.)
4. **If GitNexus is connected**, prefer it for blast radius:
   `impact({target, direction:"upstream"})`, `context({name})`, `detect_changes({scope:"compare", base_ref:"main"})`.
   The §2 baseline was produced without it (not connected in-session) — reconcile
   any difference and note it, don't silently override the measured numbers.

### 3a. CAOS Engine Conventions — the law Opus MUST obey (authoritative)

**The `is_finite_number` guard (from `CLAUDE.md`).** Every engine computation that
divides or multiplies a CP-1-derived value (leverage, net debt, EBITDA, coverage)
must gate the input through `engine.periods.is_finite_number(x)` first. A plain
`isinstance(x,(int,float))` passes a `NaN` (`bool(NaN)` is `True`), leaking `NaN`
into the payload or crashing on a zero denominator. `is_finite_number` rejects
`NaN`/`±inf` while accepting `bool`/`0`. Also guard denominators that can reach 0
(e.g. `ebitda*(1-pct)` as `pct→1`) — return `None`/degrade rather than divide.
This recurs across CP-2B/2E/2F/3B/3D and the Altman score. **A deepening may make
this guard *structural* (part of a quantity type's interface); it may never
weaken it.**

**Golden determinism.** `caos/tests/server/golden/` (CP-1, portfolio, query gates)
pins output byte-for-byte. Any refactor must leave goldens unchanged. If a
deepening *would* change a payload, that is a contract change (§5) requiring a
named consumer and a migration note — not a golden rewrite.

**Red-team gate (from `CLAUDE.md`).** Before committing to an interface or rollout,
record a critic pass in `.agent-reviews/redteam.md`; fix and verify each
high-impact objection or document why the risk is accepted.

**Payload / lineage integrity.** Findings carry lineage (`engine.lineage`,
`_SOURCED_TYPES`, `validate_lineage`) and schema-validated payloads
(`engine.schemas.validate_payload`, `ModulePayload`). A deepening must preserve
lineage validation and schema conformance end-to-end.

**Architecture vocabulary (use exactly; do not drift to "component/service/helper").**
**Module** = interface + hidden implementation. **Interface** = all a caller must
understand. **Depth** = hidden-implementation ÷ interface (deep = small interface,
substantial implementation). **Seam** = where two modules meet. **Adapter** =
translates across a seam (one adapter = hypothetical seam; two = real). **Leverage**
= downstream payoff of a small interface change. **Locality** = whether the code to
understand one behaviour sits together.

---

## 4. Engine architecture map (real paths — use these, do not invent)

> Engine root **`caos/server/engine/`**, 65 modules. Routed via
> `caos/server/routes/*.py`; the FastAPI app is `caos/server/main.py`. Tests in
> `caos/tests/server/` (139 files, incl. `golden/`).

### Functional clusters (measured groupings)

| Cluster | Modules | Role | Key measured shape |
|---|---|---|---|
| **CP-1 metric lane** | `metrics`, `metricengine`, `metricfactlane`, `adjusted`, `reported_cp1`, `edgar_cp1`, `periods` | Extract & compute CP-1 facts/figures | C2 (6-module bounce) + C3 (guard convention); `metrics` fan-in 7 |
| **Autonomy / synthesis DAG** | `runner`, `council`, `debate`, `analyst`, `anomaly`, `autonomy`, `sentinel`, `reporter`, `planner`, `registry`, `synth`, `factpack`, `readiness` | Orchestrate module runs → findings → report | C1 (`runner` fan-out 27; `synth` 621 LOC; `planner` 425) |
| **`synthesize_*` analytical adapters** | `covenants`, `capstructure`, `liquidity`, `downside`, `distress`, `legal`, `macro`, `relval`, `refinancing`, `sponsor`, `catalysts`, `coststructure`, `earnings`, `peers`, `portfoliofit` | Per-CP-module analytics called by `runner` | Mostly fan-in 1, 1–3 public; several untested directly (C1) |
| **Query subsystem** | `querygraph`(1499), `queryinsights`(613), `queryanswer`(435), `queryoverlay`(306), `relval` | NL query → graph/answer/overlay | C4 (`querygraph` god-module; `queryanswer` fan-out 8) |
| **LLM plumbing** | `llm_client`, `llm_safety`, `openrouter`, `gemini`, `embeddings`, `rerank`, `entailment`, `grounding`, `budget` | Model calls, safety, retrieval | `llm_safety` fan-in 10; generally self-contained |
| **Backbone surfaces** | `schemas` (fan-in 27), `periods` (fan-in 20), `gate` (fan-in 9), `registry`, `lineage`, `fixtures`, `presets` | Shared types, guards, gate, registry | Change = automatically HIGH blast-radius (§7) |
| **Portfolio / ingest / misc** | `portfolio`, `portfoliofit`, `pipeline`, `pipeline_executor`, `memochunks`, `textscan`, `graphexpansion`, `locks`, `eval`, `macro` | Portfolio rollups, pipeline, misc | Lower leverage; scope last |

### Consumers of the CP-1 metric lane (contract awareness)
`anomaly`, `coststructure`, `metricengine`, `metricfactlane`, `peers`, `reporter`,
`runner`, `queryanswer`, `querygraph`, and the `routes/query.py` route import the
metric cluster — any facade you introduce must preserve their call sites or name
each as a migration.

### The `runner` fan-out (C1, the 27 imports)
`budget, edgar_cp1, presets, reported_cp1, fixtures, adjusted, factpack, council,
covenants, capstructure, catalysts, debate, downside, legal, liquidity, macro,
portfoliofit, refinancing, relval, sponsor, coststructure, earnings, peers,
readiness, metrics, gate, lineage, planner, registry, schemas, synth`.

---

## 5. Data-seam classification (know before you spec)

**Engine output is a contract in these places — a deepening must preserve or
migrate, never silently reshape:**
- **Module payloads** (`schemas.ModulePayload`, `validate_payload`) consumed by
  `routes/runs.py`, `routes/issuers.py`, and the frontend `lib/engine/*` hooks
  ("prefer live, static fallback"). Reshaping a payload is a cross-stack change.
- **Golden-pinned outputs** — CP-1 (`golden/test_golden_cp1.py`), portfolio, query
  gates. Byte-for-byte fixed.
- **The autonomy DAG output** (`GET /api/autonomy/draft`, `runner`→`reporter`) —
  the frontend Command Center / Monitor wiring (see the frontend brief) depends on
  this shape; coordinate any change with that surface.

**Safe-to-reshape (internal seams, no external contract):** the *internal*
composition between `runner` and its `synthesize_*` adapters; the *internal* helper
structure of `querygraph`; how the CP-1 lane threads `periods`/`adjusted`
internally — provided the *public* module payloads and golden outputs are
unchanged. **This is where C1–C4 live: they are internal-shape deepenings, which
is exactly why they are tractable without a contract migration.** Confirm against
the live code before you spec — do not assume a boundary is internal without
grepping its importers.

---

## 6. Output specification — how to write `ENGINE_IMPLEMENTATION_SPEC.md`

Produce ONE Markdown file, **grouped strictly by execution severity** so Opus works
top-to-bottom:

```
# CAOS Engine Implementation Spec (for Opus 4.8)

## P0 — Correctness / guard / contract risk   (do first)
## P1 — Major deepenings: shallow→deep seams that hold navigability/testability back
## P2 — Minor: locality collapses, dead-adapter removal, test-surface tightening
## P3 — Net-new structure (build after the base deepenings land & suite is green)
#      GATE: every P3 item must name a real consumer/lane it serves, or be tagged SPECULATIVE
```

Within each group, order by cluster using the §7 sequence. **Every item follows
this shape — adapt to the finding; it's a completeness floor, not a rigid form:**

```markdown
### [P?] <Cluster> — <Short title>
- **Gap (1 sentence):** <concrete, no hedging — cite the measured signal>.
- **Modules / logical blocks:** `engine/<mod>.py` → <function/class block, named — NOT a line number>; consumers: `<...>`.
- **Measured evidence:** <depth ratio, fan-in/out, LOC, or missing test — the number from §2/§3, not a vibe>.
- **Principle satisfied:** deletion-test verdict (concentrates/moves) and/or "interface is the test surface" / locality / one-vs-two-adapter; and which §3a law it honors.
- **Opus instruction (technical):** <exact steps — the deep module/seam to introduce, its interface, what moves behind it, which call sites migrate, how composition becomes testable, and the guard/golden/lineage invariants to hold>.
- **Blast radius:** <consumers touched; flag HIGH if it reaches `schemas`/`periods`/a payload contract; name the golden tests that must stay green>.
- **Credit payoff:** <one line — how this makes a read more correct, navigable, or testable; if you can't state one, cut the item>.
```

**Rules for the spec:**
- **Reuse before invent.** Deepen existing modules and shared surfaces; do not add
  a parallel type system or a dependency existing code covers. A new deep module is
  fine when it *concentrates* existing scattered logic.
- **Preserve invariants explicitly.** Every item that touches CP-1 arithmetic must
  restate the `is_finite_number` guard requirement; every item that touches a
  payload must name the golden test(s) that pin it.
- **No line numbers.** Name the function, class, or region.
- **Composition-testability is the point.** For C1-class items, specify the
  interface that lets `test_runner_layers.py` (or a successor) exercise composition
  directly — that is how you convert "shallow adapter fleet" into "deep, tested seam."
- **Respect the contract seam (§5).** "Reshape internally" must name the importers
  that stay unchanged; "migrate a contract" must name the consumer and the steps.
- **P3 gate.** A net-new structural module may be specified only if it serves a
  named consumer or measured need; otherwise cut it or tag `⚠ SPECULATIVE — no
  current consumer`. Opus builds exactly what you describe.

**Optional companion deliverable (from the upstream skill).** If a visual aid would
help the human choose, additionally emit a **self-contained HTML architecture
review** to the OS temp dir (`$TMPDIR`/scratchpad, never the repo) —
`caos-engine-review-<timestamp>.html`, Tailwind + Mermaid via CDN, one card per
C1–C4 with a before/after mass diagram (interface breadth vs. implementation
depth) and the measured numbers. Open it, give the absolute path, and ask the human
which seam to grill first. This is scratch; it does not go in the repo.

---

## 7. Self-check protocol (verify as you go)

Verification serves the outcome, not a gate you march through. The rhythm: **a
fresh-context sub-agent check after roughly every cluster.** Dispatch verifiers
**asynchronously and keep specifying while they run**; **reconcile every REVISE
before you declare the spec done (§8)** — that reconciliation is the gate.

Suggested cluster order (highest leverage first):

1. Autonomy/synthesis DAG (C1: `runner` + `synthesize_*`) · **[CHECKPOINT A]**
2. CP-1 metric lane (C2 + C3: `metric*` + `periods` guard) · **[CHECKPOINT B]**
3. Query subsystem (C4: `querygraph` split) · **[CHECKPOINT C]**
4. LLM plumbing + backbone-surface-adjacent items · **[CHECKPOINT D]**
5. Portfolio / pipeline / misc + global consistency · **[CHECKPOINT E]**

**At each checkpoint, dispatch a verification subagent** (general-purpose or
Explore) with this charge — do **not** self-approve:

> "Review the last cluster's spec items in `caos/docs/ENGINE_IMPLEMENTATION_SPEC.md`
> (`<cluster>`). For each item verify: (1) **the module, function, and import edge
> actually exist** in `caos/server/engine/` — grep them; flag any hallucinated path
> or edge. (2) The **measured evidence is real** — re-run the depth/fan-in
> one-liner (§3) and confirm the cited ratio/fan-in/out/LOC; flag any number that
> doesn't reproduce. (3) The **deletion-test verdict is honest** — would the change
> concentrate or merely move complexity? (4) The item **preserves the guard/golden/
> lineage laws (§3a)** — flag anything that could change a CP figure or break a
> golden. (5) The **blast radius is correct** — does it actually reach
> `schemas`/`periods`/a payload contract? (6) The **credit payoff is genuine**
> (more correct / navigable / testable), not tidiness. Return a table: item →
> PASS / REVISE (with the specific defect). Be adversarial; assume an edge is
> hallucinated and a refactor breaks a golden until proven otherwise."

Record each verdict inline (`> Checkpoint A: N pass, M revised — <what changed>`).

**Anti-hallucination guardrails (apply continuously):**
- Before citing any module/function/import edge, confirm it (`grep`/read/AST). An
  unverified path or edge is a defect.
- Before asserting a depth ratio or fan-in, reproduce it with the §3 one-liner.
- Do not claim a golden stays green without having run (or explicitly reasoned
  from) the golden suite; if you reasoned statically, say so.
- Prefer *deepening/concentrating existing modules* over inventing new abstraction
  layers. Verify the deletion test before you spec a new module.

---

## 8. Definition of done

- `caos/docs/ENGINE_IMPLEMENTATION_SPEC.md` exists, severity-grouped P0→P3; every
  item carries the §6 fields that apply (gap · modules · measured evidence ·
  principle · instruction · blast radius · payoff), adapted to the finding — gate
  on the *information* present, not literal template conformance; every path and
  import edge verified; every checkpoint recorded.
- Every P0/P1 item cites a **measured** signal from §2/§3 and a **deletion-test
  verdict**, and names the guard/golden/lineage invariants it preserves.
- Every net-new (P3) item names a real consumer/need or is tagged SPECULATIVE.
- No item changes what a CP figure computes, breaks a golden, weakens the
  `is_finite_number` guard, or reshapes a payload contract without a named consumer
  and migration.
- The spec is executable by Opus **top-to-bottom without further clarification** —
  modules and named functional blocks, not line numbers — and, if executed, leaves
  `pytest caos/tests/server` and the golden suite green.
