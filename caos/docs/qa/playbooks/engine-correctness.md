# Prove CAOS engine correctness

## 1. Objective and credit stakes

You are the Sonnet 5 engine-correctness auditor. Prove that every deterministic financial value emitted by `caos/server/engine/` is finite, contract-correct, basis-consistent, period-aligned, and financially defensible. Include deterministic boundary math outside the package when it consumes or emits engine values. At authoring, that includes `caos/server/scenario.py`; discovery, not this sentence, defines the current surface.

A crash is visible. A plausible but wrong leverage, coverage, EBITDA, net debt, recovery, liquidity-runway, or Altman value can reach an investment committee and move real money. Treat silent wrong reads as release blockers.

Audit and report only. Do not edit engine code, tests, contracts, or golden fixtures. Run offline from the repository root. Pass only when every current census entry maps to an invariant and a proof. An unproven invariant, unexplained skip, or unmapped site is a failure.

## 2. Scope discovery

Discover the full tree on every run. Use `origin/main` as the comparison base, but prove the invariants over the full current tree, not only the diff.

```bash
PY=caos/server/.venv311/bin/python

rg --files caos/server/engine | rg '\.py$' | sort
rg --files caos/tests/server | rg '(^|/)test_.*\.py$' | sort
rg --files caos/tests/server/golden | sort
rg --files caos/tests/server | rg 'test_.*_contract\.py$' | sort

git diff --name-status origin/main -- \
  caos/server/engine caos/server/scenario.py caos/tests/server
```

Enumerate every registered module, including default-off and spec-only entries. Record `module_id`, owned object, implementation state, feature flag, and dependencies.

```bash
PYTHONPATH=caos/server "$PY" - <<'PY'
from engine.registry import REGISTRY
for spec in REGISTRY.values():
    print(spec.module_id, spec.owned_object, spec.implemented,
          spec.feature_flag, spec.depends_on, spec.after)
PY
```

Enumerate every divide and multiply. The output includes non-numeric overloads such as `Path / "name"`; classify each site explicitly instead of filtering by filename or intuition.

```bash
"$PY" - <<'PY'
import ast
from pathlib import Path
paths = sorted(Path("caos/server/engine").glob("*.py"))
paths += [Path("caos/server/scenario.py")]
for path in paths:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Div, ast.Mult)):
            print(f"{path}:{node.lineno}:{type(node.op).__name__}:{ast.unparse(node)}")
PY

rg -n 'is_finite_number|safe_div|checked_(divide|multiply)' \
  caos/server/engine caos/server/scenario.py
```

Enumerate parse, validation, projection, persistence, and read-back boundaries. Trace each hit to the first stored or computed financial value.

```bash
rg -n 'json\.loads|JSONDecoder|loads_finite|parse_constant|float\(|Decimal\(|model_validate|allow_nan' \
  caos/server/engine caos/server/scenario.py caos/server/edgar.py

rg -n 'MetricFact\(|ModuleOutput\(|session\.add\(|runtime_output|extract_facts|extract_cost_facts' \
  caos/server/engine caos/server/database.py
```

Build the live test-to-engine import map. Integration tests that reach engine code through routes must be added to the map during trace review.

```bash
"$PY" - <<'PY'
import ast
from pathlib import Path
for path in sorted(Path("caos/tests/server").rglob("test_*.py")):
    modules = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("engine"):
            modules.add(node.module)
        if isinstance(node, ast.Import):
            modules.update(a.name for a in node.names if a.name.startswith("engine"))
    if modules:
        print(f"{path}: {', '.join(sorted(modules))}")
PY
```

The census fails if a command misses a moved path, a new implemented numeric module lacks a mapped test, or a new arithmetic or boundary site lacks an invariant classification.

## 3. Coverage checklist

Prove every invariant over the current census. Cite code by `file:symbol` or `file:line` and cite the tests that would fail if the invariant regressed.

- [ ] **I-1: Every CP-1-derived divide and multiply is finite-gated.** Every operand derived directly or transitively from CP-1, including values read from `runtime_output` or `MetricFact`, is dominated by `engine.periods.is_finite_number` or a finite-safe helper before arithmetic. The result is also finite before emission or storage. A plain `isinstance(x, (int, float))`, `x is not None`, or truthiness check is not a finite gate: `bool(float("nan"))` is `True`. `latest()` returning a numeric type does not remove the consumer's duty to re-gate it. Every load-bearing guard has regression cases for `NaN`, `+inf`, `-inf`, and an ordinary finite value.

- [ ] **I-2: Every possible zero denominator degrades.** Every denominator is proven finite and non-zero after all transformations. This includes derived denominators such as `ebitda * (1 - pct)` when `pct == 1`, rounded denominators that become `0.0`, empty population counts, and denormal inputs whose quotient overflows. Undefined math returns `None`, a documented degraded state, or a blocked finding. It never raises, emits infinity, or fabricates zero. `safe_div` and equivalent helpers reject non-finite operands, zero denominators, and non-finite results.

- [ ] **I-3: Non-finite values cannot cross a parse or store boundary.** EDGAR companyfacts, reported-disclosure regex captures, text scans, scenario/model JSON, LLM tool dictionaries, fixtures, API models, and database read-backs reject `NaN`, `Infinity`, `-Infinity`, and overflow such as `1e999` before financial use. Plain `json.loads` is unsafe because Python accepts non-finite literals. Model output uses `loads_finite`, including SDK dictionaries round-tripped through JSON. `validate_payload` rejects non-finite values anywhere in nested `runtime_output`. `metrics.extract_facts`, `extract_cost_facts`, `metricfactlane`, and every `MetricFact` write re-gate values. Store readers re-gate because historical or malformed rows are not trusted. No persisted payload, emitted JSON, formatted string, aggregate, or peer statistic contains a non-finite number.

- [ ] **I-4: Every implemented CP-1, CP-2, and CP-3 numeric contract is executable and pinned.** Map every implemented registry entry in those families to its owned numeric object, synthesizer, degradation semantics, and at least one unit, contract, or integration suite. Current proof families include `test_edgar_cp1.py`, `test_reported_cp1.py`, `test_adjusted*.py`, `test_engine.py`, `test_overlays.py`, and every discovered `test_*_contract.py`. Contract proofs cover exact keys, types, rounding order, finding IDs, status semantics, and malformed inputs. A registry entry that becomes implemented or gains a numeric output without a mapped proof fails this invariant.

- [ ] **I-5: Frozen real-issuer goldens do not drift.** The offline CP-1 golden rebuild from captured SEC companyfacts reproduces the exact human-validated VSAT and FUN revenue, adjusted EBITDA, net debt, leverage, coverage, Altman score, zone, and source lineage. The reported-disclosure golden reproduces VMO2. The marked golden end-to-end suite preserves the full deterministic lane and gate behavior. Never run `_capture.py` during an audit and never update a fixture to make a failure green. A methodology change requires independent filing validation and separate adjudication before any golden update.

- [ ] **I-6: Headline outputs are financially plausible and independently reconcilable.** Net debt equals the correctly signed debt total less cash. Leverage reconciles to same-basis net debt divided by annual adjusted EBITDA. Coverage reconciles to annual EBITDA divided by positive cash interest where that contract requires a positive denominator. EDGAR EBITDA follows the documented reported proxy and does not claim covenant-adjusted basis; add-backs run once and only on the adjusted lane. Altman Z-double-prime uses `3.25 + 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4`, with `X4 = book equity / total liabilities`, exact zone boundaries, and no intermediate rounding. Recovery stays within 0% to 100%, pari-passu rows recover at the same rate, and junior value cannot precede a senior rank. Plausibility bands create visible findings, not silent clamps; a genuinely distressed issuer may exceed an advisory leverage band.

- [ ] **I-7: Signs, units, scale, and rounding are correct at each handoff.** Raw EDGAR USD converts to millions exactly once. Reported-disclosure values preserve currency and declared scale; million/billion conversion occurs once and mixed currencies do not aggregate. Money numerators and denominators use the same currency and scale. Leverage and coverage are unitless turns, spreads and rate shocks are basis points converted by `10_000`, margins are percentages, margin changes are percentage points, and decimal rates are not percentages. Debt, cash, interest, EBITDA, claims, recoveries, and shocks obey their contract-specific sign rules. Rounding happens only at the documented presentation boundary and in the documented order.

- [ ] **I-8: Period alignment is deterministic and basis-safe.** `year`, `sort_key`, `latest`, `latest_annual`, and headline selection correctly order two-digit and four-digit years, quarters, half-years, fiscal years, dated and undated LTM labels, and insertion-order adversaries. Annual formulas never consume a standalone quarter as LTM. Ratio operands share a period and basis; debt, cash, interest, and Altman balance-sheet facts meet their freshness rules relative to EBITDA. EDGAR keys facts by the fact's period end and handles restatements deterministically. Reported-basis CP-1 skips adjusted-EBITDA reconciliation so add-backs are not stripped twice. Missing or conflicting dates degrade instead of combining mismatched periods.

- [ ] **I-9: Proof coverage is closed over the census.** Maintain a review table with one row for every divide/multiply site, numeric parse/store boundary, and implemented numeric CP-1/2/3 owned object. Each row names its classification, invariant, guard, and proof test. Non-financial arithmetic and overloaded operators require an explicit exclusion rationale. No sampling, prior-report trust, or green aggregate test count can replace this closure table.

## 4. Procedure and exact gates

Keep all tests offline. `caos/tests/server/conftest.py` clears provider keys, but clear the shell too. Never set `CAOS_TEST_LIVE` or `EDGAR_USER_AGENT` for this audit.

```bash
unset ANTHROPIC_API_KEY GEMINI_API_KEY OPENROUTER_API_KEY
unset CAOS_TEST_LIVE EDGAR_USER_AGENT
PY=caos/server/.venv311/bin/python

# Discovery and invariant mapping: run every command in section 2 first.

# Ruff, identical scope and config to CI.
caos/server/.venv311/bin/ruff check caos/server caos/tests

# Changed-code complexity gate, using the canonical remote base.
"$PY" caos/scripts/check_complexity_delta.py --base-ref origin/main

# Mypy engine gate. mypy.ini resolves files=engine from caos/server.
(cd caos/server && .venv311/bin/mypy)

# Focused correctness proofs.
"$PY" -m pytest -q \
  caos/tests/server/test_nan_guards.py \
  caos/tests/server/test_adjusted.py \
  caos/tests/server/test_adjusted_guards.py \
  caos/tests/server/test_engine_math_degrade_guards.py \
  caos/tests/server/test_periods.py \
  caos/tests/server/test_periods_safe_div.py \
  caos/tests/server/test_metrics.py \
  caos/tests/server/test_metricengine.py \
  caos/tests/server/test_metricfactlane.py \
  caos/tests/server/test_leverage_plausibility.py \
  caos/tests/server/test_leverage_magnitude.py \
  caos/tests/server/test_recon_basis_gate.py \
  caos/tests/server/test_cp1_grounding.py \
  caos/tests/server/test_edgar_cp1.py \
  caos/tests/server/test_reported_cp1.py \
  caos/tests/server/test_overlays.py \
  caos/tests/server/test_scenario.py \
  caos/tests/server/test_scenario_network.py \
  caos/tests/server/test_*_contract.py \
  caos/tests/server/golden

# Frozen captured-fact alarm, called out separately in the report.
"$PY" -m pytest -q caos/tests/server/golden/test_golden_cp1.py
"$PY" -m pytest -m golden_e2e -q caos/tests/server/golden

# Full server regression gate, identical to CI's SQLite leg.
"$PY" -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q
```

PR and pre-deploy evidence must also show the same full pytest command green in the repository's Python 3.11 and Python 3.14 CI matrix. If Python 3.14 and the locked dependencies are available locally, the exact runtime command is:

```bash
python3.14 -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q
```

Record every exit code, collected count, pass count, skip, xfail, warning, and interpreter version. A missing target, collection error, new skip, or 3.11/3.14 behavioral divergence fails the gate until explained and adjudicated.

## 5. Evidence and reporting

Write `caos/docs/qa/reports/engine-correctness-YYYY-MM-DD.md`. Include:

- **Run identity:** UTC date, branch, `HEAD`, `origin/main` base, dirty-tree state, Python versions, and offline environment confirmation
- **Census:** engine modules, registered and implemented modules, divide/multiply sites, parse/store boundaries, mapped tests, contract files, and golden fixtures, with counts and the delta from the prior report
- **Command evidence:** exact command, exit code, collected/passed/skipped/failed counts, duration, and CI links for both Python legs
- **Closure table:** every census entry mapped to I-1 through I-9, its guard or exclusion rationale, and the proof test
- **Invariant verdicts:** `PASS` or `FAIL` only, with code and test citations; unproven means `FAIL`
- **Findings:** severity, `file:line`, violated invariant, minimal input, actual result, independently computed result, committee impact, and the first persistence or presentation boundary reached
- **Accepted-risk recheck:** every section 6 premise marked `HOLDS` or `BROKEN`; a broken premise becomes a finding

Overall `PASS` requires all invariants, ruff, mypy, focused tests, goldens, the full suite, both CI interpreter legs, and census closure to pass. Any failure means `DO NOT MERGE / DO NOT DEPLOY`. There is no pass-with-warnings state for deterministic credit math.

Adversarially re-verify every suspected miscompute before calling it confirmed:

1. Try to refute it against the module contract, source filing anchor, existing golden, and accepted-risk register.
2. Reproduce it with the smallest raw input in `/tmp`; do not edit repository code or tests.
3. Recompute from raw XBRL, disclosure, or fixture values without calling the function under suspicion or a shared helper.
4. Check sign, currency, scale, period, basis, rounding order, and downstream persistence independently.
5. Trace whether the value can reach a stored fact, API payload, report, or committee surface. Right-size severity to that path.
6. Mark it `CONFIRMED` only if it survives all checks. Record refuted candidates and their refuting evidence. An unresolved candidate keeps the invariant failed.

## 6. Accepted-risk register

Seed this register from [`REVIEW_MATRIX_BACKEND.md`](../REVIEW_MATRIX_BACKEND.md). Accepted risk suppresses duplicate findings only while its premise holds. It never waives a wrong finite number, non-finite leak, unit or period mismatch, unadjudicated golden drift, or untested arithmetic site.

| Risk | Accepted boundary | Premise to re-verify every run |
|---|---|---|
| Single-team IDOR, XFF rate-key spoof, global login-bucket self-DoS, edge-secret trust, on-host backup, and PERF-2 bundle size | Outside deterministic math; owned by backend, security, and performance audits | The engine change does not alter these trust or deployment assumptions |
| EDGAR in-process throttle | Availability and multi-process scaling risk, not numeric methodology | A throttled or failed fetch degrades without stale, partial, or fabricated CP-1 values |
| No OCR for scanned PDFs | Missing-source limitation | A scan with no text yields explicit insufficient information or no data, never invented financials |
| Demo and mock seams by design | Permitted only when unmistakably labelled and excluded from real-run provenance | Demo values cannot enter the run-derived `MetricFact` store or masquerade as live committee data |
| Negative liquidity or negative coverage in interest-runway characterization | Deliberate, golden-pinned behavior | `test_interest_runway_contract.py` still pins `liq_negative` and `cov_negative`; consumers disclose the sign and do not reinterpret it as positive runway |
| Pari-passu pro-rata sharing within a consecutive seniority rank | Deliberate recovery-waterfall model | Contract tests still prove equal recovery rates, absolute priority between ranks, and visible limitations for unknown intercreditor mechanics |
| Mypy exclusions for nine dict-heavy synthesizers | Deferred typing debt, not a correctness waiver | The exclusion list in `caos/server/mypy.ini` has not grown, excluded modules remain covered by runtime contracts, and new numeric modules are not added to the list |

Add a row only after a finding survives adversarial verification and receives explicit owner acceptance. Remove a row when fixed or when its premise breaks. A new failure mode in an accepted area is still a new finding.
