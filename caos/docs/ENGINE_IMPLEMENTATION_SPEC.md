# CAOS Engine Implementation Spec (for Opus 4.8)

> **What this is.** The executable deepening spec for `caos/server/engine/`,
> authored by Fable 5 (Principal Engine Architect) per
> `ENGINE_ARCHITECT_BRIEF.md`. Opus 4.8 executes it top-to-bottom, grouped by
> execution severity (P0 → P3). Every item is *shape only*: it changes how the
> code is structured, never what a CP figure computes. Read §0 (laws) before
> touching anything.

## 0. Laws Opus MUST obey (non-negotiable — from the brief §3a + `CLAUDE.md`)

1. **The analytics and golden outputs are immutable.** `caos/tests/server/golden/`
   (`test_golden_cp1.py`, `test_golden_portfolio.py`, `test_golden_query_gates.py`)
   pins output byte-for-byte. A refactor that changes a number, a key, or a
   payload shape is a *defect*, not progress. Baseline this session:
   **1257 passed, 2 skipped** (full server suite), **27 passed** (golden), via
   `caos/server/.venv311/bin/python -m pytest caos/tests/server -q` with
   `ANTHROPIC_API_KEY` cleared. Leave both green.
2. **The `is_finite_number` guard may only get *stronger*.** Every engine
   computation that divides or multiplies a CP-1-derived value (leverage, net
   debt, EBITDA, coverage) must gate its inputs through
   `engine.periods.is_finite_number` first (a plain `isinstance(x,(int,float))`
   passes `NaN`, and `bool(NaN)` is `True`). A deepening may make the guard
   *structural* (part of a function's interface); it may never remove or weaken a
   guard, and denominators that can reach `0` must still degrade to `None` rather
   than divide.
3. **Payload contracts are preserved or migrated, never silently reshaped.**
   Module payloads (`schemas.ModulePayload`, `validate_payload`) are consumed by
   `routes/*.py` and the frontend. If an item reshapes a payload it names the
   consumer and the migration; otherwise it keeps every call site's output
   identical. Lineage (`engine.lineage`, `_SOURCED_TYPES`, `validate_lineage`)
   and schema validation stay intact end-to-end.
4. **Reuse before invent.** Deepen existing modules and shared surfaces
   (`schemas`, `periods`); do not add a parallel type system. A *new* module is
   justified only when it **concentrates** existing scattered logic (passes the
   deletion test) — never as speculative structure.

**Vocabulary (used exactly).** *Module* = interface + hidden implementation.
*Interface* = everything a caller must know. *Depth* = behaviour behind a small
interface. *Seam* = where a module's interface lives. *Adapter* = a thing that
satisfies an interface at a seam (one adapter = hypothetical seam; two = real).
*Deletion test* = if you deleted this module, does complexity **concentrate**
(earns its keep) or merely **move** (no win)?

**Measured baseline (reproduced this session; extend, don't re-assert).**
65 modules · 15,191 LOC (AST line-count; the brief's 15,128 is `wc -l`) · 129
intra-engine import edges. Backbone fan-in: `schemas` 27, `periods` 20, `gate`
9, `textscan` 6. Any change to `schemas` or `periods`' **existing** interface is
automatically HIGH blast-radius; the P0 guard item is additive (new functions),
so it is low-risk despite `periods`' fan-in.

**Reconciled brief numbers (measured this session; each verified by re-running
the AST script and/or grep).** These correct the brief where the code disagrees —
none changes a deepening's direction, but a spec must not assert past its
measurements:
- **`runner` fan-out is 31, not 27.** The brief's §2 label (27) counts only the
  dotted `from engine.X import` form; its own §4 lists all 31, and the 4 extra
  (`budget, edgar_cp1, presets, reported_cp1`) enter via the grouped
  `from engine import …` line. Both the re-measure and the Checkpoint-A verifier
  confirm 31.
- **`queryanswer` fan-out is 11, not ~8** (3 function-local imports: `embeddings`,
  `packer`, `metricfactlane`). **`autonomy` fan-out is 6, not 5** (the brief
  omitted `queryinsights.fingerprint_issuer`).
- **Total intra-engine edges: 166** counting both import forms (the brief's 129 is
  the dotted-only count). **Total LOC 15,191** (AST line-count incl.
  `__init__.py`); the brief's 15,128 reproduces under neither `wc -l` (15,126) nor
  the AST sum — treat 15,191 as the baseline. **Dedicated `test_<module>.py`: 39
  engine modules** carry one (the brief's 44 overcounts); 111 `test_*.py` /​ 118
  total test files under `caos/tests/server` (the brief's 139 reproduces under no
  count).
- **`relval` is mis-clustered in the brief** (listed under the query subsystem):
  it is CP-3 RelativeValueSecuritySelection, imported only by `runner`, and has no
  `test_relval.py` (though it is covered by 3 direct tests in `test_analytics.py`).
  Do not fold it into the C4 split.
- **The C2 dataflow is the one *material* framing correction.** The brief's import
  chain `metricfactlane → metricengine → metrics → periods` is a *real* import
  path (every edge confirmed) — but reading it as "one figure flowing linearly
  through six modules" is misleading: `metrics` is the catalog + **write-path**
  projection, `metricengine`/`metricfactlane` are two **read-path** lanes, and the
  edges are shared-vocabulary reuse (`CATALOG_BY_KEY`, `MetricFactEntry`,
  `is_finite_number`). The real coupling is a shared catalog + the shared guard +
  a **quadruplicated** read (see the P1 §"CP-1 metric lane" item).

**GitNexus reconciliation (brief §3.4).** The GitNexus index is 17 commits
behind HEAD with `embeddings: 0`; it was used only to cross-check consumer edges
(which reproduced the AST import graph), **not** for depth. The AST measurements
above are the authoritative baseline, as the brief sanctions when GitNexus is
stale.

---

## P0 — Correctness / guard / contract risk (do first)

### [P0] CP-1 metric lane — Make the `is_finite_number` divide-guard structural (`safe_div`)

- **Gap (1 sentence):** The guard that keeps a `NaN`/`±inf`/zero-denominator out
  of every CP-1 arithmetic is enforced by a hand-written convention repeated at
  each call site across **21 source modules**, so its correctness depends on each
  author remembering to write it rather than on an interface that cannot be
  bypassed.
- **Modules / logical blocks:** add `safe_div` to `engine/periods.py` (alongside
  `is_finite_number`); migrate the CP-1 **variable/variable** divide sites whose
  guard is exactly "both operands finite and denominator non-zero":
  `engine/metrics.py` (`extract_facts` inner `ebitda_margin` `100*v/rv` and
  `fcf_conversion`; `leverage_plausibility_finding`'s `nd/eb` and the second
  `/abs(lev)`), `engine/adjusted.py` (`reconcile_adjusted_ebitda`: `nd/lev`,
  `nd/ebitda_excl`), `engine/metricengine.py` (`_robust_z`:
  `0.6745*(iv-med)/mad`), `engine/peers.py` (`_own_values` margin `100*eb[p]/rev[p]`).
  Consumers of `periods`: 20 engine modules import it — this item only **adds** a
  function, so no existing importer changes. **Explicitly excluded** (verified by
  Checkpoint B, do not migrate): `downside.compute_pathways` — `lev/(1-s)` has a
  *literal* denominator (`s ∈ {0.1,0.2,0.3}`) and `cov*(1-s)` is a
  *multiplication*, so neither fits a division helper; `peers._percentile` divides
  two counts (`100*better/len(peer_vals)`), neither operand CP-1-derived and the
  non-zero denominator already guaranteed upstream.
- **Measured evidence:** `grep -rl is_finite_number engine/` → 21 source modules
  (adjusted, anomaly, capstructure, catalysts, covenants, distress, downside,
  earnings, edgar_cp1, liquidity, macro, metricengine, metricfactlane, metrics,
  peers, periods, portfolio, querygraph, refinancing, relval, schemas — confirmed
  by Checkpoint B); `periods.py` 85 LOC / 4 public / fan-in 20. The
  finite-plus-nonzero-denominator idiom is physically re-implemented at the ~6
  variable/variable divide sites above (`metrics.extract_facts`,
  `adjusted.reconcile_adjusted_ebitda`, `metricengine._robust_z`,
  `peers._own_values`).
- **Principle satisfied:** *The guard becomes a concentrated, enforceable
  interface.* Deletion test: delete `safe_div` and the finite-plus-nonzero-
  denominator logic reappears at the ~6 metric-lane divide sites —
  **concentrates**. Honors Law 2 by making the guard *stronger*, never weaker;
  honors Law 1 (identical arithmetic → identical numbers). **Honest scope
  (grilling):** migrating call sites alone does *not* make the guard unbypassable —
  a developer can always write a raw `a/b`. So this item pairs the primitive +
  dense-cluster migration with the **P2 CI lint** below (the actual enforcement:
  an unguarded CP-1 divide fails CI). The other ~15 guarded CP-1 divides
  engine-wide (`macro`, `liquidity`, `distress`, `anomaly`, `capstructure`,
  `covenants`, `earnings`, `relval` — all already correctly guarded per Checkpoint
  B) are **not** mass-migrated here (byte-identical churn across 12 modules, real
  regression risk on subtle guards like `anomaly`'s sigma-clamp); they adopt
  `safe_div` opportunistically for readability, and the lint guards new code.
- **Opus instruction (technical):**
  1. In `engine/periods.py` add just this one function:
     ```python
     def safe_div(numerator: object, denominator: object) -> Optional[float]:
         """Finite-guarded division for CP-1 arithmetic. Returns
         numerator/denominator as a float only when BOTH operands are finite
         (is_finite_number) AND the denominator is non-zero; otherwise None.
         This is the structural form of the CLAUDE.md divide-guard: a caller
         cannot divide a CP-1 figure without the NaN/inf/zero-denominator check."""
         if is_finite_number(numerator) and is_finite_number(denominator) and denominator != 0:
             return float(numerator) / float(denominator)
         return None
     ```
     Do **not** add a separate `safe_ratio(..., scale=)` helper: Checkpoint B
     measured that `scale*(num/den)` reassociates the float versus the current
     `(scale*num)/den` in ~35% of raw trials (though **0 of 2,000,000** differ
     after `round(,1)`). To keep bitwise-raw identity, scale the *numerator* and
     call `safe_div` — see step 2.
  2. Migrate **only** the ~6 sites above. Replace each local
     `if is_finite_number(...) and ... : a/b` block with `safe_div`, scaling the
     numerator *before* the call so the arithmetic order is unchanged, and
     preserving each site's existing `round(...)`, `None`/skip, and
     limitation-flag behaviour **verbatim** — e.g. the `ebitda_margin` site
     becomes `m = safe_div(100 * v, rv); if m is not None: add(..., round(m, 1), ...)`
     and `_robust_z` becomes `z = safe_div(0.6745 * (iv - med), mad)`.
  3. Do **not** touch `is_finite_number`, `latest`, `sort_key`, or any
     period-label logic; do not migrate the excluded sites named above.
  4. Add `caos/tests/server/test_periods_safe_div.py` asserting: `safe_div(4, 2)==2.0`;
     `safe_div(float("nan"), 2) is None`; `safe_div(1, 0) is None`;
     `safe_div(1, float("inf")) is None`; `safe_div(True, 2)==0.5` (bool accepted
     as int); `safe_div(100 * 3, 4)==75.0`.
- **Blast radius:** `periods` fan-in 20 = HIGH surface, but the change is purely
  **additive** (one new function; existing interface untouched), so no importer
  breaks. Golden tests that must stay green: `test_golden_cp1.py` (leverage /
  coverage / margin numbers), `test_golden_query_gates.py` (`metricengine`
  robust-z), `test_golden_portfolio.py`. Full suite must stay at 1257 passed.
- **Credit payoff:** A leverage or margin an analyst defends is protected by one
  tested primitive across the metric lane (where the densest CP-1 arithmetic
  lives), and — with the P2 lint — a *new* unguarded CP-1 divide can no longer
  reach `main` silently, so the `NaN`-poisoning class is closed going forward
  rather than relying on every future author remembering the convention.

> **Live-bug hunt: DONE and clean (Checkpoint B).** A fresh-context verifier
> enumerated every `/` and `*` on a CP-1-derived value across all 11 analytical
> adapters (`macro, capstructure, refinancing, liquidity, relval, covenants,
> distress, portfolio, anomaly, earnings, catalysts`) and confirmed **each is
> already guarded** by `is_finite_number` (or a `_finite()`/NaN-collapse
> equivalent) plus a non-zero denominator — including `anomaly`'s cusum
> (sigma clamped to `1e-6`) and `capstructure`'s waterfall (finite+positive
> claims). Two bare-`isinstance` sites (`macro`, `earnings`) are safe because an
> upstream `_finite()` already ran. **So this item is prophylactic hardening, not
> a bug fix** — there is no live money-path defect to repair; the value is making
> the existing guard unbypassable going forward.

---

## P1 — Major deepenings: shallow → deep seams that hold navigability/testability back

### [P1] Autonomy / synthesis DAG (C1) — Extract runner's module-dispatch into a composition-testable `bindings` seam

- **Gap (1 sentence):** `runner.synthesize_module` is a ~100-line
  `if module_id == "CP-…"` chain that hard-wires each analytical module to its
  synthesizer with a bespoke argument shape, so the composition an engineer most
  needs to reason about and test — *which adapter runs for a module and what run
  state it receives* — has no interface and is reachable only by executing a full
  run against a live database.
- **Modules / logical blocks:** create `engine/bindings.py` (the dispatch) **and
  `engine/cp1_sources.py`** (the CP-1 source-precedence helpers `_synthesize_cp1`
  + `_vault_edgar_facts`, extracted to break the import cycle — see instruction
  step 2). Move the dispatch body of `runner.py` → `synthesize_module` (plus the
  CP-2 live-vs-fixture branch and CP-1's add-back reconcile) behind `bindings.py`.
  The 15 adapter imports currently at the top of `runner.py` (`covenants,
  capstructure, catalysts, debate, downside, legal, liquidity, macro,
  portfoliofit, refinancing, relval, sponsor, coststructure, earnings, peers` and
  `factpack, readiness, adjusted`) move to `bindings.py`. `runner` keeps
  orchestration only: `_dependency_layers`, `_run_layer`, `_persist_synth_result`,
  the `_SESSION_SYNTH` session-safety gate, the QA phase, and fact projection.
- **Measured evidence:** `runner.py` 847 LOC / 2 public / **fan-out 31** / fan-in
  0 (the god-orchestrator). *(Measured correction: the brief's §2 says fan-out
  27, but its own §4 enumerates all 31 — the 4 missing siblings `budget`,
  `edgar_cp1`, `presets`, `reported_cp1` enter via the grouped
  `from engine import …` line that the brief's dotted-only measurement script
  drops; both the Checkpoint-A verifier and the independent re-measure confirm
  31.)* Its ~20 `synthesize_*` callees are 70–208 LOC, 1–3 public, **fan-in 1
  (only runner)**. **The genuine test-surface gap is the *dispatch*, not the
  adapters:** ten adapters (`catalysts, sponsor, legal, refinancing, relval,
  macro, capstructure, downside, portfoliofit, coststructure`) have no
  `test_<module>.py`, **but all ten are directly unit-tested under other
  filenames** (e.g. `synthesize_downside`/`synthesize_relative_value`/
  `synthesize_legal_review` in `test_analytics.py`, `synthesize_refinancing` in
  `test_nan_guards.py`, catalysts/sponsor/macro/recovery/portfoliofit in
  `test_overlays.py`) — so they are *not* untested. What no unit test exercises is
  `synthesize_module` itself: the module→adapter→args wiring, covered only through
  full-run integration/golden tests, never `test_runner_layers.py` (2 tests, both
  on `_dependency_layers`).
- **Principle satisfied:** *The interface is the test surface* + fan-out
  reduction. **Honest framing:** the dispatch already lives in one function, so
  this is not de-duplication (contrast the sibling C2 item, which genuinely
  de-dups a triplicated query); it is a *move that creates a callable seam and
  co-locates the 15 adapter imports*. Deletion test: delete `bindings.py` and the
  dispatch plus its imports fall back into `runner`, re-inflating the
  847-LOC/fan-out-31 god-orchestrator — so extraction earns its place on the two
  brief-sanctioned criteria (**composition testable through an interface**;
  **fan-out reduced**, from 31 to ~16), not on concentration-of-duplication. The
  ~20 adapters stay single-purpose (correct — they are the analytics); what
  changes is that their *composition* gains an interface.
- **Opus instruction (technical):**
  1. In `engine/bindings.py` define the run-state carrier and the binder type:
     ```python
     @dataclass(frozen=True)
     class RunContext:
         module_id: str
         session: AsyncSession
         issuer: Optional[Issuer]
         issuer_name: str
         synthesizer: Synthesizer          # engine.synth.Synthesizer
         upstream: Dict[str, ModulePayload]
         retrieve: RetrieveFn              # engine.synth.RetrieveFn
         portfolio_id: Optional[str] = None

     Binder = Callable[[RunContext], Awaitable[ModulePayload]]
     ```
  2. **Resolve the `bindings`↔`runner` import cycle FIRST — it is fatal, not
     optional (grilling finding; the five checkpoints missed it because they
     verified arg-shapes/behavior, not the module-load import graph).** `runner.py`
     will `from engine.bindings import resolve_binding`; if `bindings.py` also does
     a top-level `from engine.runner import _synthesize_cp1`, Python loads a
     partially-initialized `runner` (the CP-1 helpers are defined *low* in the
     file, after `execute_run`) and raises
     `ImportError: cannot import name '_synthesize_cp1'`. A top-level back-edge is a
     cycle regardless of which symbol — the earlier "no cycle because runner imports
     `resolve_binding`, not the private binders" reasoning was **wrong**. **Fix
     (decided): extract `_synthesize_cp1` and `_vault_edgar_facts` into a new
     `engine/cp1_sources.py`** (promote to public `synthesize_cp1_reported` /
     `vault_edgar_facts`). It imports only leaf producers (`edgar_cp1`,
     `reported_cp1`, `fixtures.REFERENCE_ISSUER_ID`, `config`, `database`) — none of
     which import `runner`/`bindings` — so it is cycle-free; both `runner` (where
     still needed) and `bindings` import from it, and there is **no `bindings →
     runner` edge**. This also gives CP-1's source-precedence (EDGAR →
     reported-disclosure → LLM/fixture) its own navigable, tested home.
  3. Write one small named binder per special-cased module (`_bind_cp0`,
     `_bind_cp1`, `_bind_cp2`, `_bind_cp1a`, `_bind_cp1b`, `_bind_cp1c`,
     `_bind_cp4c`, `_bind_cp2b`, `_bind_cp2c`, `_bind_cp2d`, `_bind_cp2e`,
     `_bind_cp2f`, `_bind_cp3`, `_bind_cp3b`, `_bind_cp3c`, `_bind_cp3d`,
     `_bind_cp4`, `_bind_debate`) whose body is the code currently under each `if`
     in `synthesize_module`. `_bind_cp1` calls
     `cp1_sources.synthesize_cp1_reported(...)` then applies the reconcile.
     Assemble `BINDERS: Dict[str, Binder]` and a `_default_binder` that calls
     `ctx.synthesizer.synthesize(ctx.module_id, ...)`.
  4. **Preserve VERBATIM these behaviors the if-chain encodes (grilling checklist)
     — a naive per-branch copy drops several, and the goldens (seeded issuers,
     happy-path upstream) will not catch the regressions:**
     - **`issuer is None → default`:** `_bind_cp0` and `_bind_cp1c` must begin
       `if ctx.issuer is None: return await _default_binder(ctx)` before calling
       their session adapters — else a null-issuer run flips from default-output to
       CP-0/CP-1C **Blocked**.
     - **`upstream["CP-1"]` (KeyError-on-absent) vs `upstream.get("CP-1")`
       (None-on-absent) is per-module and load-bearing** — copy each subscript-vs-
       `.get` exactly, do not normalize. Subscript: CP-1B, CP-4C, CP-2B, CP-2F,
       CP-3 (`["CP-1C"]`), CP-3C (`["CP-3"]`), CP-3D (`["CP-1"]`). `.get`: CP-2E,
       CP-3B, CP-3C (`.get("CP-1")`), CP-3D (`.get("CP-2B")`).
     - **CP-1B returns *without* `await`** (`synthesize_earnings_delta` is sync);
       `_bind_cp1b` returns it un-awaited — do not add a spurious `await`.
     - **CP-2 keeps its branch:** `if ctx.synthesizer.name == "live":
       ctx.synthesizer.synthesize("CP-2", ...) else:
       synthesize_cost_structure(ctx.issuer_name, ctx.retrieve)`.
     - **CP-6A and CP-6E share `_bind_debate`**, which reads `ctx.module_id` and
       calls `synthesize_debate(ctx.module_id, ctx.upstream)` — register both keys.
     - **`_bind_cp1` moves the reconcile basis gate**
       (`if basis not in ("reported_gaap_xbrl", "reported_disclosure")`) with the
       reconcile call, plus its `runtime_output` mutation and `claims.append`.
  5. Expose `async def resolve_binding(ctx: RunContext) -> ModulePayload:
     return await BINDERS.get(ctx.module_id, _default_binder)(ctx)`. `RunContext`
     stays a uniform 7-field frozen carrier (so `BINDERS` is a flat table and the
     test seam is DB-free); `frozen=True` only prevents rebinding the fields, the
     live `session` inside stays usable — no footgun. `module_id` is a field
     because `_bind_debate` reads it.
  6. In `runner.execute_run`, replace the `synthesize_module(...)` call inside
     `_attempt_synth` with construction of a `RunContext` and
     `await resolve_binding(ctx)`. Delete the old `synthesize_module` body and the
     migrated imports. **Keep `_SESSION_SYNTH` and the serial-vs-concurrent layer
     scheduling in `runner` unchanged** — the binders are agnostic to it; the
     session-safety gate (`_SESSION_SYNTH = {CP-0, CP-1, CP-1C, CP-3C}` run
     serially, pure modules via `asyncio.gather`) stays in `_run_layer`, so the
     refactor cannot move a session-touching binder into the concurrent path. Keep
     the `SynthesisError`/`Exception` isolation in `_attempt_synth` exactly as is.
  7. Add `caos/tests/server/test_bindings.py` — **routing-only, all 18 binders,
     DB-free** (the decided scope). Build a `RunContext` with a stub `synthesizer`,
     a stub `session` (never hit), hand-made upstream `ModulePayload`s, and
     monkeypatched adapters (and `cp1_sources.synthesize_cp1_reported`,
     `reconcile_adjusted_ebitda`) that record their arguments — then assert, with
     **no database**, that `resolve_binding` routes each module to the right adapter
     with the right upstream slice, **and** that the guard branches fire: `CP-2B →
     synthesize_downside(upstream["CP-1"])`; `CP-2C → synthesize_catalysts(upstream)`;
     `CP-3C → synthesize_portfolio_fit(upstream["CP-3"], upstream.get("CP-1"),
     session, issuer, portfolio_id)`; `CP-0`/`CP-1C` with `issuer=None` → default
     binder (the fall-through); `CP-2` under a live vs fixture stub synthesizer →
     the two branches; an unmapped id → default. The adapter *bodies* keep their
     existing tests (`test_analytics.py`, `test_nan_guards.py`, `test_overlays.py`,
     …); this seam owns the *wiring*. This is the composition test
     `test_runner_layers.py` cannot be.
- **Blast radius:** `runner`-internal; `synthesize_module` has fan-in 0 outside
  `runner` (grep confirms no other importer). Two new modules, both *extractions*
  of existing runner-private logic (not speculative): `bindings.py` and
  `cp1_sources.py`. `cp1_sources` is imported by `bindings` (and `runner` if it
  still calls the helpers); `edgar_cp1`/`reported_cp1` are unaffected — they are
  called *by* `cp1_sources`, they do not import it. **Not** a payload contract —
  the payloads each binder returns are byte-identical to today. Golden tests that
  must stay green: all three (the run path produces CP-1, portfolio, and query
  goldens); also `test_runner_layers.py` and any `test_runner*`/`test_execute_run*`.
- **Credit payoff:** The wiring bug class that actually bites this engine — a
  module handed the wrong upstream slice, silently reading `None` and degrading a
  credit read — becomes catchable in a fast unit test instead of only in a full
  live run, so a mis-wired analytical dependency is caught before it reaches a
  committee memo.

### [P1] CP-1 metric lane (C2) — Concentrate the shared headline-fact predicate; correct the brief's dataflow

- **Gap (1 sentence):** Four readers of the `MetricFact` store are structurally
  different queries that nonetheless re-state the same three predicates defining
  "a valid, non-Blocked headline fact," so that guard-definition has no single
  tested home — and one of the four (`queryinsights`) **omits the
  `qa_status != "Blocked"` predicate** (a defense-in-depth inconsistency, not a
  live bug: the runner write-skip already keeps Blocked CP-1 facts out of the
  store, so no Blocked `_DELTAS` fact exists for it to read).
- **Measured evidence & brief correction:** the brief's C2 describes "one figure
  [flowing] `metricfactlane → metricengine → metrics → periods`." Measured (and
  confirmed by Checkpoint B), that is not the dataflow: `metrics` is the
  **catalog** (`METRIC_CATALOG`) plus the **write-path** projection
  (`extract_facts`/`extract_cost_facts`, persisted by the runner to the
  `MetricFact` store — it never `select`s the store); `metricengine` and
  `metricfactlane` are two **read-path** lanes; `adjusted`/`reported_cp1`/
  `edgar_cp1` are CP-1 producers. The real coupling is (a) a shared catalog
  (legitimately central), (b) the shared `is_finite_number` guard (the P0 item),
  and (c) a **quadruplicated read** — `peers._peer_facts`,
  `metricengine._headline_facts_by_issuer`, `metricfactlane._raw_facts`, **and
  `queryinsights._delta_entries`** each re-implement the same core query. They
  form a *mirror chain*, not a single origin: `metricengine` names
  `peers._peer_facts`, `metricfactlane` names `metricengine`, and `metricengine`
  cites `queryinsights` as the pattern origin. **`queryinsights._delta_entries` is
  the one copy that omits `qa_status != "Blocked"`** (it relies solely on the
  runner write-skip). `querygraph._best_fact`/`_profile_values` is a lighter 5th
  variant (a comparator + reader, addressed in the C4 split). Metric-cluster
  consumers measured at **~13–14** (`anomaly, coststructure, metricengine,
  metricfactlane, peers, queryanswer, querygraph, queryinsights, reporter, runner`
  plus routes `issuers, portfolio, query, sponsors`) — the brief's "10"
  undercounts.
- **Modules / logical blocks (grilled — a *predicate helper*, NOT a shared
  `Select`):** the 4 readers are structurally different queries — different
  column-sets (`peers`: `select(MetricFact, Issuer)`; `metricengine`:
  `+Run.created_at`; `metricfactlane`: `+Issuer.name`; `queryinsights`: raw
  columns), different joins (`peers` joins only `Issuer`; the other three join
  `Run` too), different provenance policies (`peers`: `!= "demo_fixture"`; the
  others: `== "run"`), and different caps (none / 2000 / 500 / 2000). A shared
  `Select` builder would fight all of that. What they genuinely share is **three
  predicates**: `MetricFact.headline.is_(True)`, `metric_key.in_(keys)`,
  `qa_status != "Blocked"`. Extract exactly those into
  `metrics.headline_fact_predicates(keys) -> list[ColumnElement]`; each reader
  spreads `*headline_fact_predicates(keys)` into its own `select(...).join(...)
  .where(...)` and keeps everything else (columns, joins, provenance, cap, order,
  grouping) verbatim. `metrics.py` gains `from database import MetricFact`
  (`database` is a leaf — it imports no engine module — so no cycle).
- **Principle satisfied:** *the guard becomes one tested definition* (locality).
  Deletion test: delete the helper and the three predicates that define "a valid,
  non-Blocked headline fact" reappear at four sites — **concentrates the
  definition** (not a whole query; the queries legitimately differ). Folding
  `queryinsights._delta_entries` onto the helper **adds the `qa_status !=
  "Blocked"` predicate it lacks today** — the one lane that could drift is brought
  into line.
- **Opus instruction (technical):**
  1. Add to `engine/metrics.py`:
     `def headline_fact_predicates(keys): return [MetricFact.headline.is_(True),
     MetricFact.metric_key.in_(list(keys)), MetricFact.qa_status != "Blocked"]`
     (and `from database import MetricFact` — leaf import, cycle-free).
  2. `peers._peer_facts`, `metricengine._headline_facts_by_issuer`, and
     `metricfactlane._raw_facts` **already carry all three predicates** — replace
     their inline `headline`/`metric_key`/`qa_status` conditions with
     `*headline_fact_predicates(keys)`, leaving every other predicate (provenance,
     complete-run `Run.status == "complete"`, self/industry exclusion, cap, order,
     grouping) **verbatim**. These three are **byte-identical** refactors.
  3. `queryinsights._delta_entries`: the same spread — which **adds** the
     `qa_status != "Blocked"` it omits today. This is the one intended behavior
     change. Given the runner write-skip (a Blocked CP-1 never persists the
     `_DELTAS` keys `net_leverage`/`interest_coverage`/`ebitda_margin`), it should
     be result-identical; verify against `test_golden_query_gates.py` and
     `test_query_insights.py`, and if a golden shifts, treat it as evidence of a
     real write-skip gap (a separate finding) — do not force the filter off.
  4. Add `caos/tests/server/test_headline_fact_predicates.py` asserting the
     predicate list, applied to seeded rows, excludes a Blocked fact and a
     non-headline fact and a wrong-key fact, and includes a valid headline fact —
     the guard definition tested once.
- **Blast radius:** LOW for `peers` (CP-1C), `metricengine`, `metricfactlane` —
  byte-identical (they already carry the three predicates; the helper only spreads
  them). The single intended change is `queryinsights` gaining the Blocked guard.
  **Not** a payload reshape — `MetricFact` rows and each lane's `MetricFactEntry`s
  are unchanged. `metrics.py` gains a `database` import (leaf, no cycle). Goldens
  that must stay green: `test_golden_query_gates.py` and any
  `test_peers*`/`test_metricengine*`/`test_metricfactlane*`/`test_query_insights*`.
- **Credit payoff:** "A QA-Blocked or fabricated figure never enters a peer median
  or a cross-issuer answer" is defined in one tested place instead of restated at
  four sites — and the one lane that silently lacked the Blocked guard inherits
  it, so a desk-brief delta an analyst cites cannot be contaminated by a lane that
  forgot the filter.

### [P1] Query subsystem (C4) — Split the `querygraph` god-module along its mode-keyed builder seams

- **Gap (1 sentence):** `querygraph.py` is 1,499 lines in one file, but it is
  already internally organized as a capability rail plus a set of *independent,
  mode-keyed graph builders* — so the file's bulk is a navigability failure, not
  a tangle: each builder is a self-contained view buried behind hundreds of lines
  of unrelated builders.
- **Modules / logical blocks:** the 42 private helpers group into 8 cohesive
  seams behind the 3 public functions. Extract in this order (the shared kit
  first, so the builders can import it):
  1. `engine/querygraph_layout.py` — the **pure, DB-free payload + geometry kit**
     (`_node`, `_edge`, `_result`, `_empty`, `_clip`, `_norm`,
     `_radial_positions`, `_spread`, `_grid_centers`, `_member_grid`, ~78 LOC)
     used by *every* builder and by `build_graph`.
  2. `engine/queryfacts.py` — the **fact read-model + peer math**
     (`_best_fact`, `_profile_values`, `_rank_peers`, `_default_focus`, `_peers`,
     ~90 LOC), the "peers" mode plus the shared `_profile_values` read.
  3. `engine/queryclusters.py` — the **`concentration`-mode builders**: the
     grid-cluster + cross-issuer register family (`_concentration` dispatch,
     `_cluster_by_field`, `_rating_distribution`, `_portfolio_exposure`,
     `_committee`, `_gate_lane`, `_cluster_by_wiki`, `_sponsor_graph`,
     `_covenant_register`, ~403 LOC — one repeated
     group→sort→`_grid_centers`→`_member_grid` idiom) **plus all of
     `_concentration`'s other dispatch targets** — the metric-axis builders
     `_scatter`, `_percentile`, `_trend`, `_coverage` **and `_provenance_split`**
     (~152 LOC). **These five must move *with* `_concentration`, not stay in
     core** — see the cycle warning below.
  4. `engine/queryprovenance.py` — the **`provenance`-mode builders**
     (`_provenance` dispatch, `_latest_run`, `_modules`, `_dag`,
     `_attach_source_chain`, `_claim_audit`, `_findings`, `_debate`,
     `_analyst_memos`, ~267 LOC). *(Note: `_provenance_split` is dispatched by
     `_concentration`, not `_provenance` — it belongs in `queryclusters`, step 3.)*
  Keep in `querygraph.py` the capability registry (`_cap` + the `GROUPS`/
  `CAP_BY_ID` data), `availability`, `capabilities`, `build_graph`'s `mode`
  dispatch, the small `contagion`-mode overlays (`_contagion`, `_shared_theme` —
  called only by `build_graph`, extracting them only *moves* lines), and the
  `_append_accepted_links` tail (a cross-cutting post-processor run on every
  graph — leave it).

  > **MUST-FIX (Checkpoint C + grilling — avoids two real import cycles):** the
  > cycle rule is general: *anything a to-be-extracted builder calls must NOT stay
  > in `querygraph` core*, because core imports the builder module for the `mode`
  > dispatch, so a builder→core back-edge closes a cycle. Two consequences, both
  > verified in the code:
  > - **`_concentration`'s five dispatch targets** (`_scatter`, `_percentile`,
  >   `_trend`, `_coverage`, and `_provenance_split` — each called *only* by
  >   `_concentration`, GitNexus-confirmed) must move **with** `_concentration`
  >   into `queryclusters`. **No "leave in core" option.**
  > - **`_profile_values` (facts) is cycle-forced too:** `_concentration`'s
  >   sub-builders call `_profile_values`, so it cannot stay in core — it must live
  >   in the extracted `queryfacts` (which `queryclusters` imports). This is the
  >   same reason the layout kit is extracted, not a mere convenience. (Core's own
  >   `_contagion`/`_shared_theme` also call `_profile_values`, so `querygraph →
  >   queryfacts` is a normal one-directional edge; `queryfacts` calls nothing
  >   upward — verified — so it stays a leaf-ward module.)
- **Measured evidence:** `querygraph.py` 1,499 LOC / 3 public
  (`availability`, `capabilities`, `build_graph`) / 45 defs (42 private helpers);
  function-body LOC 1,207 / 1,498. The grid-cluster family is ~403 LOC and the
  provenance family ~267 LOC (measured per-function, not by line range) —
  together ~45% of the file, plus the ~78-LOC layout kit and ~90-LOC fact
  read-model that every builder depends on. Builders are `mode`-selected in
  `build_graph` and share only the layout kit + `_profile_values`, so they are
  genuinely independent. *(Cross-checked by the W1 query-cluster agent, which
  independently produced this 8-seam map and rated these four cuts "concentrates"
  while rejecting an overlays/tail split as "moves".)*
- **Principle satisfied:** locality / navigability. Deletion test: extracting a
  builder family **concentrates** a self-contained view into a focused module
  while the dispatch stays a thin rail — it does not merely move lines, because
  each family is independent (`mode`-keyed) and shares only the layout kit, which
  is itself extracted to one place. The two rejected cuts (a generic "overlays"
  grouping and the `_append_accepted_links` tail) would only *move* lines and are
  left in core.
- **Opus instruction (technical):**
  1. Create `engine/querygraph_layout.py` first and move the kit there. It is
     DB-free and imports **no engine sibling** (note: `_node` lazily imports
     `config.get_settings` for the Obsidian deep-link — that is fine, `config`
     does not import `querygraph`, so acyclicity holds). This breaks the potential
     import cycle: `build_graph` imports the builders, the builders import the
     layout kit, and the kit imports no `engine.*` module back.
  2. Create `engine/queryfacts.py`, `engine/queryclusters.py`,
     `engine/queryprovenance.py`; move each family plus the helpers used only by
     it. Each imports `querygraph_layout` for `_node`/`_edge`/`_result` and
     `queryfacts` for `_profile_values` where needed.
  3. In `querygraph.build_graph`, replace the inline builder bodies with calls
     into the extracted modules; the `mode == "…"` dispatch and the three public
     signatures stay **byte-identical**.
  4. **Preserve the emitted graph payload exactly** — the `node`/`edge`/`meta`/
     `caveats` shape is a live frontend + golden-adjacent contract. Preserve every
     `is_finite_number` guard inside the builders (querygraph uses it 6×,
     including the median/divide in `_contagion`); do not "simplify" a guarded
     normalization.
  5. **`test_fact_collapse.py` imports the private `_best_fact` directly** — when
     `_best_fact` moves to `queryfacts.py`, update that import (or re-export
     `_best_fact` from `querygraph`), or the test breaks. Give each new module a
     focused test (`test_queryclusters.py`, `test_queryprovenance.py`) driving the
     builder with a small seeded fixture — coverage a 1,499-line file discouraged.
- **Blast radius:** the three public functions keep their signatures, so
  `routes/query.py` (via `/capabilities` and `/graph`) — the only route importer;
  `routes/portfolio.py` merely names querygraph in a comment and does its own SQL —
  is untouched, and this is **not** a payload contract change (the graph JSON is
  identical). `test_querygraph.py` + `test_querygraph_registers.py` assert through
  the public `build_graph`, so an output-preserving split keeps them green;
  `test_fact_collapse.py` needs the `_best_fact` import update above. Confirmed
  (Checkpoint C): `test_golden_query_gates.py` contains **zero** `build_graph`/
  `querygraph` references, so no golden pins the graph output — the split has no
  golden constraint.
- **Credit payoff:** An analyst (or an agent) tracing why the concentration or
  provenance overlay drew a given edge reads one focused ~400-line module instead
  of scrolling a 1,499-line file — the "show your work" evidence path becomes
  navigable, and each view becomes independently testable.

> **Note (feeds the C2 item):** `querygraph._best_fact` / `_profile_values` is a
> lighter **fifth** variant of the "latest-per-(issuer, metric) fact,
> run-over-seed" selection the C2 item concentrates (the four full copies are
> `peers._peer_facts`, `metricengine._headline_facts_by_issuer`,
> `metricfactlane._raw_facts`, and `queryinsights._delta_entries`). It is a
> comparator + reader rather than a full query, so it is lighter, but the C2
> concentration should treat it as a candidate reuse site once the shared
> predicate exists.

> **The LLM-safety item was downgraded to P2 by Checkpoint D** — the verifier
> proved the 8 lanes do **not** share one byte-identical wrap+rule+finite triad
> (`council` carries no `UNTRUSTED_RULE` and no `wrap_untrusted`, has two call
> sites; the rule is *suffixed* by 7 lanes but *prefixed* by `rerank`; user
> messages carry lane-specific labels and composites), so a byte-preserving single
> interface is infeasible and the P1-scale "guard becomes the interface" claim did
> not hold. Only the call + finite-parse plumbing safely concentrates. See the
> reframed P2 item "LLM plumbing — Concentrate the reply-parse; flag the
> non-uniform injection posture."

### [P1] Autonomy / synthesis DAG — Inject the Sentinel→Anomaly→Analyst→Reporter cycle behind a stages seam

- **Gap (1 sentence):** `autonomy.run_cycle` chains its four DAG stages through
  hard-wired module-level imports of concrete functions, so the composition that
  actually carries risk — the fault-isolation branches deciding what an
  autonomous committee draft says when a stage fails — is testable only by
  monkeypatching module globals, even though the rest of the engine already
  exposes injectable factory seams (`get_synthesizer`, `get_reviewer`,
  `get_debater`).
- **Modules / logical blocks (grilled — inject the 5 boundaries, not "four
  stages"):** `engine/autonomy.py` → `run_cycle`, `_current_fingerprints`, and the
  `anomaly`/`analyst` try/except branches. The injectable set is the **five
  callables that touch a DB / the LLM / a capability gate** — `_current_fingerprints`
  (reads `Issuer` + `fingerprint_issuer`), `anomaly.detect_anomalies`,
  `queryanswer.available`, `analyst.investigate`, `reporter.compose_draft_report`.
  The **pure sentinel fns `detect_tickets`/`changed_issuers` stay direct calls** —
  they compute tickets from fingerprints, so the test feeds fingerprints through
  the injected `_current_fingerprints` and exercises the *real* diff logic rather
  than stubbing it. Consumer: `pipeline_executor.execute_job`; test
  `caos/tests/server/test_autonomy.py::_wire`.
- **Measured evidence:** `autonomy` is 100 LOC / 1 public (`run_cycle`) /
  **fan-out 6** — a measured correction to the brief's "fan-out 5": the sixth
  edge is `queryinsights.fingerprint_issuer` (confirm: `grep -nE
  '^\s*(from|import)' engine/autonomy.py | grep engine`). `test_autonomy.py::_wire`
  `monkeypatch.setattr(autonomy, …)` for all six stages, whereas `council`,
  `debate`, and `synth` each expose a `get_*` factory seam.
- **Principle satisfied:** *The interface is the test surface* + one-vs-two
  adapter (a second, injectable adapter makes the seam real). Deletion test:
  the stages bundle **concentrates** the DAG order and degradation policy behind
  an interface that composition tests drive directly — it does not move
  complexity, it exposes it. **Honest scope (grilling):** `_wire` already achieves
  DB-free branch coverage via global monkeypatch, so this is a *test-idiom upgrade*
  (global-patch → injection) justified by **consistency** — `autonomy` is the one
  DAG chained by hard imports while `council`/`debate`/`synth` expose `get_*`
  factory seams — not a bug fix, and there is no non-test consumer of injectable
  stages today. Lowest-priority of the P1 items; safe to defer behind C1/C2/C4.
- **Opus instruction (technical):**
  1. Define a frozen `CycleStages` dataclass with the **five** boundary callables
     as fields (`current_fingerprints`, `detect_anomalies`, `available`,
     `investigate`, `compose_draft_report`) and a `DEFAULT_STAGES` bound to the real
     functions (mirrors `get_synthesizer`/`get_reviewer`/`get_debater`). Give
     `run_cycle` a keyword-only `stages: CycleStages = DEFAULT_STAGES` parameter and
     call those five through it (`await stages.detect_anomalies(...)`, etc.). Leave
     `detect_tickets`/`changed_issuers` as direct module calls — they are pure.
  2. Rewrite `test_autonomy.py` to construct
     `run_cycle(db=None, stages=CycleStages(detect_anomalies=fake, …))` with fakes
     that raise or return canned values — no monkeypatch, no DB. `detect_tickets`/
     `changed_issuers` run for real (fed by the injected `current_fingerprints`), so
     the diff logic is genuinely exercised. Cover every degradation branch
     (`detect_anomalies` raises → empty-anomaly draft; `available()` False → skip
     analyst; `investigate` raises → anomalies-only draft) through the interface,
     **replacing** the `_wire` global-monkeypatch.
  3. Do **not** change the returned draft dict — that is the
     `GET /api/autonomy/draft` contract (see the P2 `DraftReport` item).
- **Blast radius:** `autonomy` functional fan-in 1 (`pipeline_executor.execute_job`
  is the only caller of `run_cycle`; a second `from engine import autonomy` in
  `routes/autonomy.py` is F401-suppressed/unused). No golden pins the DAG
  (Phase-2/live), so `test_autonomy.py`, `test_reporter.py`,
  `test_sentinel.py`, `test_anomaly.py`, `test_analyst.py` are the net — keep
  them green. **Not** a payload contract if the draft dict is unchanged.
- **Credit payoff:** The degradation paths — exactly where a wrong autonomous
  read reaches an analyst — become interface-tested rather than global-patch
  tested, so a regression in "what the draft says when a stage fails" is caught
  at the unit level.

---

## P2 — Minor: locality collapses, dead-adapter removal, test-surface tightening

### [P2] LLM plumbing — Finding: audit `council`'s unfenced payload input (review, no build)

- **Gap (1 sentence):** The anti-injection posture across the 10 LLM lanes is
  non-uniform, and the one inconsistency with teeth is that **`council` passes
  engine `ModulePayload`s to the model *unfenced*** — a payload's `runtime_output`
  can carry text extracted from ingested documents, which could carry injected
  instructions into the committee-review prompt.
- **Grilling conclusion — no build:** the earlier `guarded_llm_call` wrapper is
  **dropped**. Grilling confirmed it concentrates nothing worth the churn:
  `llm_client.create` is *already* the shared seam all 8 hand-roll lanes call, the
  reply-parse **varies per lane** (`council` `first_json_value`; `entailment`
  `first_json_object` + pydantic `model_validate`; others differ), and **every lane
  already finite-rejects** via the shared `first_json_*`/`loads_finite` primitives
  (no lane admits `NaN` today — Checkpoint D claim 1). So the value here is an
  **audit**, not a refactor.
- **Measured evidence:** `llm_safety` fan-in 10; `extract_json` (the structural
  wrap+rule+finite path) is used by only `adjusted`/`covenants`; the other 8 lanes
  hand-roll `llm_client.create`. `UNTRUSTED_RULE` appears at 9 sites but **not**
  uniformly: `council` uses neither `UNTRUSTED_RULE` nor `wrap_untrusted` and its
  user message is `json.dumps([asdict(p) for p in produced])` — the produced
  module payloads, **unfenced**. The rule is suffixed by 7 lanes but prefixed by
  `rerank`; `entailment` fences only the untrusted part of a composite.
- **Principle satisfied:** *show your work* — this is a security-audit finding
  (does adversarial document text reach `council`'s prompt unfenced?), not a
  deepening; no deletion-test concentration applies (grilling proved there is
  none).
- **Opus instruction (technical):** **Do not add `guarded_llm_call`.** Instead:
  1. Trace whether a module's `runtime_output` can contain text lifted from an
     ingested document (e.g. a quoted disclosure, a scanned covenant clause) that
     then flows into `council`'s `json.dumps(produced)` review prompt.
  2. If that path exists, wrap the payload JSON through `wrap_untrusted` (and/or
     prepend `UNTRUSTED_RULE`) in `council` only — a **model-input change to one
     lane**; byte-diff it and confirm `test_council.py` and the CP-1/CP-4C goldens
     (offline fixtures) stay green. If the payloads are provably free of
     doc-extracted free text (all structured numerics/enums), record that as the
     reason `council` is safe unfenced and make no change.
  3. Spot-check the other 7 hand-roll lanes only for the same property (untrusted
     source text is `wrap_untrusted`-fenced). No mechanical rewrite, no new
     interface, no byte change to a lane already correct.
- **Blast radius:** review-only. The single possible code change (fence
  `council`'s payload input) touches `council`'s model *input* — verify
  `test_council.py` and the goldens; nothing else moves.
- **Credit payoff:** The one genuinely load-bearing question in this cluster —
  can adversarial text inside a filing reach the autonomous committee reviewer's
  prompt unfenced? — gets a human's eye and an explicit verdict, instead of being
  buried under a refactor that concentrates nothing.

### [P2] CP-1 guard enforcement — CI lint for unguarded CP-1 divides (the real "structural" mechanism)

- **Gap (1 sentence):** `safe_div` concentrates the guard, but nothing *prevents*
  a future author writing a raw `a/b` on a CP-1 figure — the `CLAUDE.md` mandate
  ("gate every CP-1 divide/multiply through `is_finite_number`") is convention,
  unenforced, and the ~21 modules that honor it do so by discipline alone.
- **Modules / logical blocks:** a small AST checker (a script under
  `caos/server/`, or a local `ruff`/`flake8` plugin) wired into the existing CI
  lint job (the one that runs the C901 complexity gate).
- **Measured evidence:** `grep -rl is_finite_number engine/` → 21 source modules
  apply the guard by convention (P0 evidence); no check enforces it, so a
  regression is one forgotten guard away — exactly the failure mode `safe_div`
  and this lint together close.
- **Principle satisfied:** enforcement — this is what actually makes the guard
  "structural" (a new unguarded CP-1 divide fails CI), which call-site migration
  alone cannot. **Honest limitation (grilling):** the check is a **heuristic** —
  Python AST cannot prove an operand is "CP-1-derived" without dataflow analysis,
  so it keys on a proxy and will have bounded false positives/negatives; it is a
  guardrail, not a proof.
- **Opus instruction (technical):**
  1. Write an AST check that flags a `BinOp` division (`/`) or multiplication
     where an operand is read from a CP-1 figure proxy — a subscript or `.get(...)`
     on a name in `{nf, normalized_financials, fin}`, or a call to
     `cp1_leverage`/`latest` — **unless** the value flows through `safe_div` or is
     guarded by an `is_finite_number(...)` on the same operand within the enclosing
     function.
  2. **Scope it to changed lines** (run against the diff, e.g.
     `git diff origin/main`), not the whole tree — this bounds the heuristic's
     false positives to new/edited code and matches the existing complexity-gate
     pattern (C901 on changed `.py`). Provide a `# noqa: cp1-divide` escape for a
     reviewed-safe site (mirrors the accepted `noqa` convention).
  3. Wire it into the CI lint job; document the accepted false-positive/negative
     bounds in the check's header so a reviewer knows it is a guardrail.
- **Blast radius:** CI-only; **no runtime or payload change**. The heuristic can
  false-positive on a genuinely-safe new divide — the `noqa` escape + diff-scoping
  bound that; it can false-negative on a CP-1 value passed through an intermediate
  name (dataflow it can't see) — `safe_div` adoption + review cover that residue.
- **Credit payoff:** The `CLAUDE.md` guard mandate stops being tribal knowledge
  and becomes a CI gate: the next author who divides a leverage figure without the
  finite guard is told at PR time, not after a `NaN` reaches a committee read.

### [P2] Backbone — Add dedicated composition tests for the CP-5 gate and CP-5B lineage validator

- **Gap (1 sentence):** `gate` (the CP-5 severity gate, fan-in 9) and `lineage`
  (CP-5B `validate_lineage`) are clean deep modules, but neither has a dedicated
  test — the money-sensitive `findings → qa_status → committee_status →
  blocked-upstream cap → run roll-up` composition and its fail-closed branches
  are exercised only incidentally through `test_engine`/`test_council`.
- **Modules / logical blocks:** `engine/gate.py`
  (`qa_status_from`, `committee_status_from`,
  `cap_committee_status_for_blocked_upstream`, `roll_up_qa_status`,
  `worst_confidence`, `Finding`) and `engine/lineage.py` (`validate_lineage`);
  add `caos/tests/server/test_gate.py` and `test_lineage.py`.
- **Measured evidence:** `gate` fan-in 9, `lineage` fan-in 1, both with no
  `test_<module>.py` (`ls caos/tests/server/test_gate.py` → absent); `grep -rln
  "committee_status_from|qa_status_from|roll_up_qa_status" caos/tests/server` →
  only integration tests.
- **Principle satisfied:** *The interface is the test surface* — this is a
  test-surface deepening, **not** an interface reshape (`gate` is already deep;
  its deletion test is "concentrates"). Do not change any `gate`/`lineage` code.
- **Opus instruction (technical):** `test_gate.py` drives the composition through
  `gate`'s own interface — a `Finding` list → run-level qa/committee status —
  explicitly covering the fail-closed edges (an unrecognized status ranks worst
  via `_QA_RANK` default; `committee_status_from` on any non-`"Passed"` →
  `"Draft Only"`; the `Insufficient Information` branch) and the CP-5D
  blocked-upstream cap. `test_lineage.py` drives `validate_lineage` over crafted
  `ModulePayload`s (orphan claim → CRITICAL lane 1; Untraced/Weak/Conflicting →
  MATERIAL lane 6; unresolved sourced citation → MINOR).
- **Blast radius:** test-only; zero production/payload/golden risk. `gate`'s
  return **values** are a consumed contract (they flow via `runner` into
  `ModulePayload`/run status read by `routes/runs.py` and the golden query
  gates), so the tests must assert today's exact strings, not new ones.
- **Credit payoff:** The committee-readiness verdict — the most money-sensitive
  decision in the engine — becomes regression-locked at the unit level, including
  the defensive fail-closed branches integration tests do not reach.

### [P2] Autonomy — Give the autonomous draft one typed `DraftReport` envelope

- **Gap (1 sentence):** The autonomous draft served at `GET /api/autonomy/draft`
  is an ad-hoc dict built in `reporter.compose_draft_report` and independently
  re-declared in `routes/autonomy._empty_draft`, governed by no schema — and the
  two have already drifted (the full draft has `generated_at`; the empty envelope
  omits it).
- **Modules / logical blocks:** `engine/reporter.py` → `compose_draft_report`;
  `caos/server/routes/autonomy.py` → `_empty_draft` and `get_autonomy_draft`;
  round-tripped through `engine/pipeline.py` → `persist_cycle`/`latest_draft`.
- **Measured evidence:** `compose_draft_report` returns 8 draft-body keys incl.
  `generated_at`; `routes/autonomy._empty_draft` returns those same 7 minus
  `generated_at`, plus 2 route-envelope keys (`refreshing`, `error`) — so the
  load-bearing drift is the **missing `generated_at`** (confirmed by Checkpoint E).
  `reporter` fan-out 4
  (`analyst, anomaly, metricengine, provenance`) — `schemas` is **not** among
  them, i.e. this is the one DAG payload with no `ModulePayload`/`validate_payload`.
  Frontend consumers today: **0** (`grep -rn "autonomy/draft|api/autonomy" caos/frontend`
  → no hits; the Command Center / Monitor are still mock).
- **Principle satisfied:** locality + contract integrity. Deletion test:
  **concentrates** two hand-kept dicts into one typed definition with a shared
  `empty()`/degraded constructor.
- **Opus instruction (technical):** Define a `DraftReport` typed envelope
  (dataclass or `TypedDict`, in `reporter` or `schemas`) with `empty(...)` /
  degraded constructors and a `to_dict()`. `compose_draft_report` builds it; the
  route's degraded/starting paths call `DraftReport.empty(...).to_dict()` — one
  source of truth so the empty envelope provably matches the full draft
  (restoring `generated_at`). Keep `test_autonomy.py`, `test_reporter.py`, and
  the route test green.
- **Blast radius:** MEDIUM — this **is** the `GET /api/autonomy/draft` response
  contract, and `pipeline.persist_cycle`/`latest_draft` round-trip the dict
  through JSON. No golden pins it; the frontend has **zero** consumers today, so
  schematizing now — before the Command Center is wired (coordinate with
  `FRONTEND_ARCHITECT_BRIEF.md`) — is the low-cost window. This is the one item
  here that touches a (nascent) payload contract; it is included precisely
  because it fixes a live drift with no consumer yet to migrate.
- **Credit payoff:** One typed definition of the analyst-facing autonomous-draft
  contract; the degraded/empty path can no longer silently diverge from the full
  draft (it already lost `generated_at`).

### [P2] Reconcile flags — production-orphaned modules and one encapsulation leak (measured; not shape items)

These are honest measured findings the brief's "no silent caps" rule requires
surfacing. None is a deepening; each is a wiring/ownership decision for Opus to
raise, not silently "fix."

- **`rerank` has engine fan-in 0** — no engine module and no route imports
  `engine.rerank`; only `presets.rerank_model()` names its tier, and the callers
  are tests plus `run_graphexpansion_measurement.py`. It is staged-but-unwired or
  dead in the retrieval path. **Action:** reconcile (wire it into the
  `memochunks`/`graphexpansion` retrieval lane, or delete it) before treating
  retrieval as complete — do not fold it into a shape refactor.
- **`eval` is orphaned in prod** — no route and no non-test server consumer
  (only `test_golden_query_gates.py` references `engine.eval`). **Action:** treat
  it as a test-harness utility; do not assume its public API is a live contract,
  and do not delete it without checking the golden query-gate harness.
- **`report._NON_CONTENT` is imported cross-module by `vault_export.py`** — a
  private engine symbol consumed outside the engine. **Action:** treat it as a
  (leaky) contract; if a later pass touches `engine/report.py`, either promote
  `_NON_CONTENT` to a public name and update `vault_export.py`, or leave both —
  do not rename it in place and break the non-engine consumer.
- **`portfoliofit.assess_fit` gates leverage with `isinstance(...) and leverage
  >= 6.0`** (a comparison, not a divide) — safe today because `NaN` fails `>=`,
  but it is the guard-by-convention pattern; if the P0 pass "tidies" it toward
  `is_finite_number`, note it touches the CP-3C payload and re-run the goldens.

---

## P3 — Net-new structure (build after the base deepenings land and the suite is green)

> **GATE:** every P3 item names a real consumer/lane it serves, or is tagged
> `⚠ SPECULATIVE — no current consumer` and Opus does not build it without
> confirmation.

**Intentionally empty — and that is the correct outcome.** Every deepening this
review kept is a *concentration of existing logic* (P0–P2: `safe_div` + the CP-1
divide lint, `bindings` + `cp1_sources`, the shared headline-fact predicate, the
`querygraph_*` split, the `CycleStages` seam, `DraftReport`), each with a live
consumer today; the two items grilling showed concentrate *nothing* worthwhile
(the `guarded_llm_call` wrapper, the shared metric `Select` builder) were dropped
or reframed rather than padded into P3. No net-new structural module concentrates
scattered logic *and* serves a consumer beyond what P0–P2 already build, so per
the brief's P3 gate and the "no speculative structure" law, nothing is added here. A tempting P3 —
"add the ten missing `test_<module>.py` for the `synthesize_*` adapters" — was
**rejected**: the Checkpoint-A verifier confirmed all ten adapters are already
directly unit-tested under other filenames (`test_analytics.py`,
`test_nan_guards.py`, `test_overlays.py`, `test_nlquery.py`), so those files would
be redundant coverage, not structure. The genuine test-surface gap (the dispatch
composition) is closed by C1's `test_bindings.py`, not by a P3 item.

---

## Checkpoints (fresh-context verifier verdicts, brief §7)

> **Checkpoint A (C1 bindings) — 7 claims, 4 PASS / 3 REVISE, all reconciled.**
> Verifier confirmed `synthesize_module`, all 18 dispatch branches, the 15+3
> adapter imports, and fan-in 0. Reconciled REVISEs: (1) fan-out corrected 27→31
> (brief undercount via the grouped import form); (2) the "ten untested adapters"
> framing was false — reframed to "the *dispatch* is untested; the adapters are
> tested elsewhere" (and the P3 item dropped); (3) the "concentrates" verb
> softened to "move + test-seam + fan-out reduction" (honest — the dispatch is
> already single-site); (4) **must-fix applied** — the Opus instruction now
> preserves the `issuer is None → default` fall-through for CP-0/CP-1C and moves
> CP-1's reconcile basis-gate with the reconcile (the naive extraction would have
> silently regressed a null-issuer run, and goldens use seeded issuers so they
> would not catch it).

> **Checkpoint B (C3 guard + C2 read, incl. live-unguarded-divide hunt) — 8
> claims, 5 PASS / 3 REVISE, all reconciled.** The live-bug hunt returned
> **clean**: every CP-1 divide across all 11 adapters is already guarded, so the
> P0 is confirmed prophylactic hardening (verify-note updated to say so).
> Reconciled REVISEs: (1) dropped `downside` (`cov*(1-s)` is a multiplication;
> `lev/(1-s)` has a literal denominator) and `peers._percentile` (divides counts)
> from the `safe_div` migration list, and named them as explicit exclusions;
> (2) dropped the `safe_ratio(scale=)` helper in favor of `safe_div(scale*num, den)`
> (Checkpoint B measured ~35% raw-float reassociation, 0/2M after `round`), keeping
> bitwise-raw identity; (3) corrected the read from **triplicated → quadruplicated**
> — `queryinsights._delta_entries` is the 4th copy and the only one missing the
> `qa_status != "Blocked"` guard (folding it in is a defense-in-depth gain);
> corrected the "mirror chain" wording and the consumer count (10 → ~13–14).

> **Checkpoint C (C4 querygraph split) — 6 claims, 4 PASS / 2 REVISE, all
> reconciled.** All 32 named helpers exist under the claimed seams; layout-first
> ordering is acyclic; no golden pins `build_graph`. **Must-fix applied:**
> `_concentration` dispatches to `_scatter`/`_percentile`/`_trend`/`_coverage`
> **and `_provenance_split`** (the last unassigned in my draft) — the spec now
> moves all five *with* `_concentration` into `queryclusters` and deletes the
> "leave in core" option that would have recreated a `querygraph↔queryclusters`
> cycle. Cosmetic fixes: `routes/portfolio.py` is not a querygraph importer;
> the layout kit lazily imports `config` (not stdlib-only); `relval` has 3 direct
> tests.

> **Checkpoint D (LLM `guarded_llm_call` + gate/lineage tests) — 5 claims, 3 PASS
> / 2 REVISE, reconciled by downgrade.** The gate/lineage test item (B) is sound
> as written. But the verifier disproved the `guarded_llm_call` (A) premise: the 8
> lanes do **not** share a byte-identical wrap+rule+finite triad (`council` omits
> `UNTRUSTED_RULE`/`wrap_untrusted` and has 2 call sites; rule is suffixed by 7
> lanes but prefixed by `rerank`; user shapes carry lane-specific labels). A
> byte-preserving single interface is infeasible, so the item was **downgraded
> P1→P2 and reframed**: concentrate only the byte-safe call+finite-parse (callers
> keep composing system/user), and treat the non-uniform injection posture as a
> flagged finding, not a mechanical merge.

> **Checkpoint E (autonomy: `CycleStages`, `DraftReport`, reconcile flags) — 6
> claims, 6 PASS, reconciled.** All three items verified against code: `run_cycle`
> hard-wires 6 module-level stages with no injection param (vs the `get_*` factory
> seams on council/debate/synth); the `generated_at` drift between
> `compose_draft_report` (has it) and `_empty_draft` (lacks it) is confirmed;
> 0 frontend consumers; `rerank` fan-in 0, `eval` prod-orphaned, and the
> `report._NON_CONTENT` cross-module leak all hold. Two cosmetic count nits fixed
> (the `_empty_draft` key count; `autonomy` functional-vs-import fan-in).

> **Grilling: C1 `runner → bindings` (the highest-leverage seam) — deep interview,
> 2 decisions resolved, 1 fatal defect the checkpoints missed.** (1) **Import
> cycle (fatal):** a top-level `bindings ↔ runner` back-edge for
> `_synthesize_cp1` would `ImportError` at load; the earlier "no cycle" reasoning
> was wrong. **Resolved:** extract the CP-1 source helpers to a new
> `engine/cp1_sources.py` (cycle-free — it imports only leaf producers), so there
> is no `bindings → runner` edge. (2) **Behavior-preservation checklist** added
> verbatim to the instruction (per-module `["CP-1"]` vs `.get`; CP-1B sync/no-await;
> CP-2 live/fixture branch; CP-6A/6E shared binder; the reconcile basis gate).
> (3) **Test scope decided:** `test_bindings.py` is routing-only across all 18
> binders, DB-free (asserts wiring + guard branches; adapter bodies keep their
> existing tests). `RunContext` confirmed as a uniform 7-field frozen carrier
> (module_id load-bearing for `_bind_debate`; `_SESSION_SYNTH` stays in `runner`).

> **Grilling: C2 CP-1 metric read — reframed from an oversold "concentrate the
> quadruplicated read" to an honest predicate helper.** Reading all four readers
> showed they are *structurally different queries* (different columns/joins/
> provenance/caps) sharing only three predicates; a shared `Select` builder fights
> that shape. **Decided (user):** extract `metrics.headline_fact_predicates(keys)`
> (the three shared WHERE conditions) and have all four spread it — not a shared
> query. Sharpened facts: `queryinsights`'s missing Blocked guard is a
> *consistency gap, not a live bug* (the write-skip covers the `_DELTAS` keys);
> `peers`/`metricengine`/`metricfactlane` already carry all three predicates so
> their migration is **byte-identical** and the blast radius drops MEDIUM→LOW
> (only `queryinsights` changes); `metrics.py` gains a cycle-free `database` leaf
> import.

> **Grilling: C4 querygraph split — acyclicity verified, cycle-forcing
> generalized, no open decision.** Read the builder bodies: `provenance` calls no
> facts/clusters helper, `facts` calls nothing upward, and `build_graph`
> dispatches `_peers`(facts)/`_contagion`(core)/`_concentration`(clusters)/
> `_provenance`(provenance) + the tail — so the DAG is `layout ← facts ←
> {clusters, core}`, `provenance ← core`, acyclic. **Finding:** the layout **and**
> facts extractions are *cycle-forced*, not granularity choices — `_concentration`
> calls both `_node` (layout) and `_profile_values` (facts), so leaving either in
> core recreates the `querygraph↔queryclusters` cycle. The MUST-FIX note is
> generalized to state the rule (anything a builder calls must not stay in core)
> and to name `_profile_values` explicitly. Granularity is fact-determined (4
> forced modules + contagion-stays-in-core as "moves"); **no user decision open**.

> **Grilling: C1 `CycleStages` (autonomy) — corrected "four stages" to the 5
> injectable boundaries; scoped honestly.** `run_cycle` branches on more than the
> four analytical stages — `_current_fingerprints` (DB) and `queryanswer.available()`
> (capability) are injection points the "four" missed, and `test_autonomy._wire`
> already monkeypatches 7 attrs (db=None) for DB-free branch coverage. **Decided
> (user):** inject the **5 DB/LLM/capability boundaries** (`_current_fingerprints`,
> `detect_anomalies`, `available`, `investigate`, `compose_draft_report`) via a
> frozen `CycleStages` + `DEFAULT_STAGES`; keep the pure sentinel fns direct so the
> test exercises the real diff. Framed honestly as a *test-idiom upgrade* for
> sibling-consistency (the DAG lacks the `get_*` factory seam its siblings have),
> not a fix — lowest-priority P1, safe to defer.

> **Grilling: C3 `safe_div` scope — pair the primitive with a CI lint; don't
> mass-migrate.** ~15 guarded CP-1 divides live *outside* the metric lane
> (`macro`, `liquidity`, `distress`, `anomaly`, `capstructure`, `covenants`,
> `earnings`, `relval`), so the P0 "guard becomes the interface" claim was
> overstated — and migrating call sites never makes a guard unbypassable anyway.
> **Decided (user):** keep the primitive + metric-lane migration (P0), add a new
> **P2 CI lint** (the real enforcement: a new unguarded CP-1 divide fails CI —
> honestly specced as a *heuristic*, diff-scoped with a `noqa` escape, since AST
> can't prove CP-1 provenance), and leave the other ~15 to opportunistic
> readability migration. Softened the P0 principle/payoff accordingly.

> **Grilling: LLM `guarded_llm_call` — dropped the build, kept the finding.**
> After Checkpoint D stripped the wrap+rule concentration, the grill showed the
> remainder concentrates nothing: `llm_client.create` is already the shared seam,
> the reply-parse varies per lane, and every lane already finite-rejects via the
> shared `first_json_*`/`loads_finite` primitives. **Decided (user):** drop the
> wrapper; the P2 item becomes a **security-audit finding** — `council` passes
> engine `ModulePayload`s to the model *unfenced*, and a payload's `runtime_output`
> may carry doc-extracted text, so the item now instructs Opus to trace that
> injection path and fence `council`'s input if it exists (one-lane model-input
> change, golden-verified), not to build a wrapper.

---

## Definition of done (brief §8) — status

- **Spec exists, severity-grouped P0→P3; §6 fields present per item; paths/edges
  verified; checkpoints recorded.** ✅ P0 (1 item), P1 (4: C1, C2, C4, CycleStages),
  P2 (4: LLM reply-parse, gate/lineage tests, DraftReport, reconcile flags), P3
  (intentionally empty, justified). Every module, function, and import edge cited
  was grep/read-confirmed by a fresh-context checkpoint; five checkpoints recorded
  above.
- **Every P0/P1 item cites a measured signal + a deletion-test verdict + the
  guard/golden/lineage invariants it preserves.** ✅
- **Every P3 item names a real consumer or is tagged SPECULATIVE.** ✅ (none —
  the section is empty by design; the one candidate was rejected as redundant
  coverage).
- **No item changes a CP figure, breaks a golden, weakens `is_finite_number`, or
  reshapes a payload contract without a named consumer + migration.** ✅ C3
  *strengthens* the guard (additive `safe_div`); C1/C4 are internal, byte-identical
  reshapes; C2 is byte-identical (the one intended `queryinsights` guard-add is
  flagged + golden-gated); the only contract touch (`DraftReport`) names its
  consumer (`GET /api/autonomy/draft`), its migration (`_empty_draft` in lockstep),
  and its 0-consumer safety window.
- **Executable by Opus top-to-bottom, named blocks not line numbers, and (if
  executed) leaves the suite + goldens green.** ✅ Named functional blocks
  throughout; the executability gaps the checkpoints **and grills** found are all
  closed — the CP-0/CP-1C null-issuer fall-through, the two **fatal import cycles**
  (`bindings↔runner`, fixed by `cp1_sources.py`; `querygraph↔queryclusters`, fixed
  by moving all builder-called helpers out of core), and two oversold
  concentrations dropped/reframed (`guarded_llm_call`, the shared metric `Select`).
  **Caveat stated plainly:** the
  refactors were **not executed** in this planning session — "stays green" is a
  static prediction reasoned from the code and the recorded baseline (1257 passed /
  27 golden), not an observed test run. Opus verifies empirically on execution.
