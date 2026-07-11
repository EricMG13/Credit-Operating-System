# Engine Correctness Audit — Re-runnable Playbook

Goal-prompt for the auditing agent (Sonnet). Re-run on every PR touching `caos/server`
and before every deploy. You audit and report; you do not edit engine code — fixes land
as separate commits after adjudication. Run fully offline (the test conftest blanks
`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/`OPENROUTER_API_KEY`; never set `CAOS_TEST_LIVE`).
All commands run from the repo root unless noted.

## 1. Objective

Prove the deterministic credit engine cannot hand a wrong number to an investment
committee. The engine's leverage, coverage, EBITDA, net-debt, recovery, liquidity-runway
and Altman figures drive position sizing and committee decisions on leveraged-loan
credits; real money moves on them. The failure mode that matters is not a crash — a
crash is visible — it is the **silent wrong read**: a NaN that survives a truthiness
check, a double-scaled unit, a stale period picked as "latest", a reported-basis EBITDA
re-stripped of add-backs. Each of these produces a plausible-looking number that is
wrong, and nobody downstream can tell.

Scope: the deterministic (no-LLM) math lane — `caos/server/engine/` plus
`caos/server/scenario.py` (deterministic math that lives outside `engine/`; see
REVIEW_MATRIX_BACKEND BE-2 path note). LLM lanes (`llm_client`, `council`, `debate`,
`gemini`, `openrouter`, live `synth`) are in scope only at their **output boundary**:
the point where LLM JSON becomes stored numbers.

The audit passes when every invariant in §3 is proven over the module census discovered
in §2, every gate in §4 is green, and every suspected miscompute has been adversarially
re-verified per §5. Any unproven invariant is a FAIL, not a warning.

## 2. Scope discovery — run fresh every audit

Never audit from a remembered module list. Enumerate the current surface each run; the
census defines the domain the §3 invariants quantify over.

```bash
# 2a. Engine module census
find caos/server/engine -name '*.py' -not -path '*__pycache__*' | sort

# 2b. Registry census — the governed module DAG (implemented vs spec-only)
caos/server/.venv311/bin/python -c "
import sys; sys.path.insert(0, 'caos/server')
from engine.registry import all_specs
for s in all_specs(): print(s.module_id, s.module_name, 'impl' if s.implemented else 'spec-only')"

# 2c. Guarded-math surface — modules already using the finite guard
grep -rln --include='*.py' 'is_finite_number\|safe_div' caos/server/engine caos/server/scenario.py

# 2d. Divide/multiply census — EVERY arithmetic site the finite-gating invariant covers
caos/server/.venv311/bin/python - <<'EOF'
import ast, pathlib
files = sorted(pathlib.Path("caos/server/engine").glob("*.py")) + [pathlib.Path("caos/server/scenario.py")]
for f in files:
    for node in ast.walk(ast.parse(f.read_text())):
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Div, ast.Mult)):
            print(f"{f}:{node.lineno}")
EOF

# 2e. Test census
ls caos/tests/server/test_*_contract.py                      # contract suites
ls caos/tests/server/golden/                                 # golden fixtures + tests
ls caos/tests/server/test_nan_guards.py \
   caos/tests/server/test_engine_math_degrade_guards.py \
   caos/tests/server/test_leverage_plausibility.py \
   caos/tests/server/test_periods.py \
   caos/tests/server/test_periods_safe_div.py \
   caos/tests/server/test_recon_basis_gate.py                # guard/invariant suites

# 2f. Ingress boundaries — where external numbers enter (parse + store)
grep -rn --include='*.py' 'loads_finite' caos/server/engine | grep -v test
grep -n 'json.loads\|float(' caos/server/engine/edgar_cp1.py caos/server/engine/reported_cp1.py caos/server/engine/metrics.py
```

Staleness rules:

- Compare the 2a/2d census against the previous report's counts (§5). Any **new module
  or new arithmetic site** must be mapped to a §3 invariant and its proof named. An
  unmapped new site is automatically a finding — coverage gaps are findings, not notes.
- A registry module flipping `spec-only → impl` with a numeric `owned_object` and no
  contract/unit suite is a finding.
- If a glob in 2e matches nothing, the suite was moved or deleted: locate or flag —
  never conclude "not applicable".

## 3. Invariants to prove

Written as invariants, not steps: for each, cite the standing proof (tests), then prove
it still holds for every **new** census entry since the last report. "The suite passed"
proves only what the suite exercises; the census diff is what keeps this exhaustive.

**A. Finite-gating of CP-1 arithmetic**
Every divide/multiply on a CP-1-derived value (leverage, net debt, EBITDA, coverage,
claims, EV) is dominated by `engine.periods.is_finite_number` or goes through
`engine.periods.safe_div`. A plain `isinstance(x, (int, float))` — or any truthiness
check — passes NaN, because `bool(NaN)` is `True`; the NaN then poisons the arithmetic
and leaks a silent wrong read downstream (CLAUDE.md engine convention).
*Proof:* walk the 2d census; each site is either (i) on a non-CP-1 constant/counter, or
(ii) gated. Standing evidence: `test_nan_guards.py` (NaN/inf → None/skip across
covenants, refinancing, metrics, peers), `test_periods_safe_div.py`. Regression teeth:
spot-check that replacing one `is_finite_number` with `isinstance` at a load-bearing
site would fail a test — a guard no test pins rots silently (the BE2-3 gap class; that
instance is closed, but every NEW guard needs the same teeth).

**B. Zero-denominator degradation**
A denominator that can reach 0 — including by arithmetic, e.g. `ebitda * (1 - pct)` as
`pct → 1` — degrades to `None`/skip; it never raises and never emits ±inf. Raising
matters doubly here: a raise inside the QA/gate phase **aborts and rolls back the whole
run** (BE3 abort semantics), so a bad divide converts one missing figure into a lost run.
*Proof:* every 2d division site shows an explicit non-zero check or `safe_div`. Standing
evidence: `test_engine_math_degrade_guards.py` (negative/zero EBITDA → `_distressed_ev`
None, not a −$500M EV), Altman guards (`distress.py` gates finiteness **before** the
`total_assets<=0` denominator checks — verify that ordering survives edits).

**C. Non-finite ingress at parse and store boundaries**
NaN/±inf cannot enter the number stores. Parse boundaries: EDGAR companyfacts JSON
(`edgar_cp1` gates at parse), reported-disclosure scans, every LLM-JSON lane through
`engine.llm_safety.loads_finite` (plain `json.loads` accepts `NaN`/`Infinity` literals —
that is the trap). Store boundaries: `metrics.extract_facts` drops non-finite before the
fact store; fixture/demo payloads are finite. DB read-back paths re-gate rather than
trust (interior `runtime_output` is unvalidated below the top level — the standing trust
boundary).
*Proof:* 2f census — every `json.loads`/`float()` on external numeric input is either
`loads_finite` or followed by a finite gate before storage. Standing evidence:
`test_nan_guards.py::test_loads_finite_rejects_non_finite`, `test_extract_facts_drops_nan_values`.
A **new** parse or store site without a gate is a finding even if unreachable today.

**D. CP-1/2/3 contract conformance**
Each implemented module's payload keeps its contract: the shapes, keys, degradation
semantics and finding IDs the downstream modules and the CP-5 gate consume.
*Proof:* the `caos/tests/server/test_*_contract.py` census (Altman Z″, recovery
waterfall, interest runway, rate sensitivity, score vulnerability, assess fit,
scorecard, deltas, pathways — enumerate, don't assume) plus `test_engine.py`,
`test_edgar_cp1.py`, `test_reported_cp1.py` all green on both interpreters. Every
implemented registry module owning a numeric object maps to at least one contract/unit
suite; unmapped = finding.

**E. Golden-master regression**
The engine reproduces the frozen, human-validated CP-1 anchors byte-exactly from
captured SEC facts: `caos/tests/server/golden/` (VSAT + FUN EDGAR fixtures, VMO2
reported-lane, portfolio, query gates) — fully offline, exact-match.
*Proof:* golden suites pass. On drift: **adjudicate before touching fixtures** — decide
whether the diff is an intended methodology change (then regenerate via
`golden/_capture.py`, manual, needs `EDGAR_USER_AGENT`, never CI) or a regression (then
it is a P0 finding). Never re-capture to make red green; the drift alarm is the product.

**F. Financial plausibility**
Outputs are internally consistent and domain-plausible, because the open
`runtime_output` schema means an in-range-but-wrong number passes every type check.
Invariants: asserted `net_leverage_adj_ltm` ≈ `net_debt_ltm / adj_ebitda(LTM)` (the
`CP-1-LEV-PLAUS` MATERIAL finding fires when not); recovery estimates ∈ [0, 100] and
non-increasing down the seniority waterfall; `pct_of_structure` sums ≈ 100; margins ∈
[−100, 100]%; leverage/coverage within leveraged-credit-plausible bands on the golden
issuers; Altman zone boundaries map to the Z″ thresholds.
*Proof:* `test_leverage_plausibility.py`, waterfall/Altman contract suites; then
recompute the golden issuers' headline metrics independently from the raw fixture facts
and compare — do not trust the engine to check itself.

**G. Sign and unit correctness**
One unit regime, applied once: USD→$M conversion happens at a single point
(`edgar_cp1` `$M, one decimal` — the catalog/UI unit); no site double-scales or mixes
raw-USD with $M. Ratios are unitless turns (x), margins %. (Market-spread RV — DM in
bps, the loans-only convention — is Phase-2; its absence from `relval.py` is not a
gap, but any spread field that lands must carry bps.) Sign discipline: a negative LTM
EBITDA degrades EV to None rather than publishing a negative distressed EV; each
`MetricDef` unit label agrees with its computation.
*Proof:* golden anchors (a scaling error cannot survive an exact-match against
human-validated $M values); `test_engine_math_degrade_guards.py`. Two sign behaviors
are **pinned by design — do not flag** (§6): the coverage-divide sign asymmetry (BE1-1)
and the negative interest-runway passthrough (`test_interest_runway_contract.py`
`cov_negative`/`liq_negative`).

**H. Period-alignment math**
"Latest" means latest: 2-digit years normalize to 4 before ordering (`'LTM_Q1_26'` must
not sort below `'FY2024'`); an LTM stub ranks just above the period it trails; `latest()`
selects by `sort_key`, never by insertion order, and degrades to None on a non-dict
series (unvalidated interiors, invariant C). Numerator and denominator of any ratio come
from the same period basis. Reported vs adjusted basis is honored: the add-back
reconciliation runs **only** on an adjusted-basis CP-1 — re-stripping add-backs from a
reported-basis EBITDA double-counts and overstates leverage ("reported is canonical").
*Proof:* `test_periods.py`, `test_recon_basis_gate.py`; any new period-keyed series
found in the census uses `periods.latest`/`sort_key` rather than ad-hoc max()/ordering.

## 4. Procedure

Run in order; record every exit code and count verbatim in the report.

```bash
# 0. Preconditions — offline + the pinned toolchain
caos/server/.venv311/bin/python -V           # 3.11.x (prod parity; never downgrade fastapi 0.138)
env | grep -E 'ANTHROPIC|GEMINI|OPENROUTER|CAOS_TEST_LIVE' || true   # CAOS_TEST_LIVE must be unset

# 1. Lint gate (ruff 0.15.18, config ruff.toml)
caos/server/.venv311/bin/ruff check caos/server caos/tests

# 2. Complexity gate — C901 on the Python files this branch changed (merge-base scope)
files=$(git diff --name-only --diff-filter=d origin/main...HEAD -- '*.py' | grep -vE '(^|/)\.(venv|goal)/' || true)
[ -n "$files" ] && echo "$files" | xargs caos/server/.venv311/bin/ruff check --select C901

# 3. Engine type gate (mypy 2.1.0, mypy.ini files=engine, pins 3.11)
cd caos/server && .venv311/bin/mypy && cd ../..

# 4. Full deterministic suite — py3.11 leg (conftest blanks LLM keys itself)
caos/server/.venv311/bin/python -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q

# 5. Cross-interpreter leg (py3.9 floor) — divergence between legs is itself a finding
caos/server/.venv/bin/python -m pytest caos/tests/server -q

# 6. Targeted invariant suites (fast re-run set for §3 evidence)
caos/server/.venv311/bin/python -m pytest \
  caos/tests/server/test_nan_guards.py \
  caos/tests/server/test_engine_math_degrade_guards.py \
  caos/tests/server/test_leverage_plausibility.py \
  caos/tests/server/test_periods.py caos/tests/server/test_periods_safe_div.py \
  caos/tests/server/test_recon_basis_gate.py \
  caos/tests/server/golden caos/tests/server/test_*_contract.py -q
```

Then execute §2 discovery, diff the census against the last report, and prove §3 A–H
over the diff (read every new/changed arithmetic and ingress site; cite file:line).

## 5. Evidence and reporting

Write `caos/docs/qa/ENGINE_CORRECTNESS_<YYYY-MM-DD>.md`:

- **Baseline table** — each §4 command, exact counts (`N passed, N skipped`), exit code,
  interpreter, date. Mirror the REVIEW_MATRIX_BACKEND baseline format.
- **Census table** — module count, divide/multiply site count, contract-suite count,
  golden-fixture count, each vs the previous report (the staleness diff). If no prior
  report exists, this run's census is the baseline.
- **Gate verdicts** — one row per invariant A–H: PASS / FAIL / DEGRADED, with the
  evidence (test names + census citations). Any FAIL ⇒ overall verdict **DO NOT
  MERGE / DO NOT DEPLOY**; there is no "pass with warnings" for the engine.
- **Findings** — file:line, invariant violated, severity by money impact (would the
  wrong number reach a committee?), minimal reproduction.

Adversarial re-verification — mandatory for every suspected miscompute before it enters
the report:

1. **Refute first.** Try to prove the engine right: check the golden anchors, the
   module docstring, and §6 — engine behavior that looks wrong is sometimes a pinned
   methodology choice (the 2026-07-04 engine-math audit lesson: check golden/"by
   design" before declaring an engine bug).
2. **Reproduce minimally**, in a throwaway script under the session scratchpad — never
   by editing engine or test code.
3. **Recompute independently** from the raw inputs (fixture JSON, XBRL facts) without
   calling the code under suspicion; compare.
4. Only a finding that survives all three is CONFIRMED; otherwise record it as refuted
   with the refuting evidence. Agents inflate severity — right-size against backstops.

## 6. Accepted-risk register

Seeded from the adjudicated 2026-07-03 backend review
([REVIEW_MATRIX_BACKEND.md](../REVIEW_MATRIX_BACKEND.md)). Never re-flag these as new
findings. Each run, spend one minute per row re-checking the premise ("still true?");
a broken premise escalates the row back to an open finding.

**The matrix lags the code.** Its finding rows (BE1-1, BE2-1..3, BE3-1..3) are
adjudication-time snapshots; all of them were subsequently fixed in code (verified
2026-07-10: `edgar_cp1.py` `int_ly[0] > 0`, `liquidity.py:109` finite-gated sum,
`peers.py` per-value gates, `metrics._as_dict` coercion, `adjusted.py:222` dict guard,
NaN-amount cases in the liquidity/waterfall suites). Before treating any matrix row as
an open accepted risk, grep the code at the cited line — code is truth, the matrix is
history.

| ID | Accepted risk | Why accepted | Premise to re-verify each run |
|---|---|---|---|
| RUNWAY-NEG | Negative interest-runway/coverage passthrough | Deliberate, golden-pinned methodology choice; escalation owner = methodology, not code | `test_interest_runway_contract.py` `cov_negative`/`liq_negative` still pin it |
| WATERFALL-IC | Intercreditor sharing assumed pari-passu pro-rata within each seniority rank | Modeling limitation, disclosed in the payload caveat (`capstructure.py` waterfall-basis text) | Caveat text still emitted with every waterfall |
| MYPY-EXCL | Nine dict-heavy synthesizers excluded from the mypy engine gate (`mypy.ini` `ignore_errors` list) | Dynamic-by-design dict shaping; typed-dataclass pass deferred | Exclusion list has not grown; drop rows as modules get typed |
| EDGAR-THROTTLE / NO-OCR / DEMO-SEAMS | In-process EDGAR throttle; scanned PDFs → 0 chunks; demo/mock seams | Matrix "Adjudicated-accepted register" ("never re-flag") | Matrix register section unchanged |

Register hygiene: additions require the same adjudication trail (finding → adversarial
verify → explicit accept with owner); removals require either a fix commit or a matrix
update. This register caps re-audit noise — it never caps severity of a **new** failure
mode in the same area.
