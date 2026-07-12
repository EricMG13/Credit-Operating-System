# Engine Correctness Audit — 2026-07-10

First run of [engine-correctness.md](playbooks/engine-correctness.md). Branch
`feat/command-center-layout-and-sector-rv-cleanup` @ `088db6e6`. No prior report
exists — this run's census is the baseline for future diffs.

**Overall verdict: PASS.** All eight invariants hold. Zero confirmed findings.

## Baseline table

| Gate | Command | Result | Exit |
|---|---|---|---|
| Preconditions | `.venv311 python -V` / env check | 3.11.15; no LLM keys, no `CAOS_TEST_LIVE` | — |
| 1. Lint | `ruff check caos/server caos/tests` | All checks passed | 0 |
| 2. Complexity (changed) | `ruff check --select C901` on 9 files vs `origin/main` | All checks passed | 0 |
| 3. Engine type gate | `mypy` (files=engine) | Success — **67 source files** (was 43 at 2026-07-03 matrix baseline) | 0 |
| 4. Full suite (py3.11) | `pytest caos/tests/server caos/tests/stress caos/tests/cohort` | **1303 passed, 2 skipped** in 27.0s (was 870/2 at 2026-07-03) | 0 |
| 5. Cross-interpreter (py3.9) | `pytest caos/tests/server` | **1295 passed, 3 skipped** in 36.2s | 0 |
| 6. Targeted invariant suites | nan_guards + degrade_guards + plausibility + periods×2 + recon_basis + golden + `test_*_contract.py` | **342 passed** in 0.95s | 0 |

**Cross-interpreter divergence check** (playbook: "divergence between legs is itself
a finding"): py3.11 server-only = 1296 passed/2 skipped; py3.9 = 1295 passed/3
skipped. Same total collected (1298); the extra py3.9 skip is
`test_gemini.py:72`, a version-gated `skipif` (`thinking_level needs
google-genai 2.x (py3.10+)`) — `.venv` is 3.9, `.venv311` is 3.11. **Not a
finding** — environment-dependent skip, not a behavioral divergence.

## Census table (baseline — no prior report to diff against)

| Item | Count |
|---|---|
| Engine `.py` modules (2a) | 64 |
| Registry modules (2b) | 23 total — 19 implemented, 4 spec-only (CP-SR, CP-MON, CP-RENDER, CP-EXTRACT) |
| Files using `is_finite_number`/`safe_div` (2c) | 21 |
| Divide/multiply AST sites, `engine/` + `scenario.py` (2d) | 179 |
| Contract-suite files (2e) | 10 — includes `test_tier2_findings_contract.py`, **new since the playbook's authoring list** (which named 9) |
| Golden fixtures/tests (2e) | VSAT, FUN, VMO2, CLO-positions + `test_golden_cp1.py`, `test_golden_portfolio.py`, `test_golden_query_gates.py` |
| `loads_finite` call sites (2f) | 3 (`extract_json`, `_payload_data_from_resp`, `_parse_payload` in `synth.py`/`llm_safety.py`) |

## Gate verdicts (invariants A–H)

| Inv | Verdict | Evidence |
|---|---|---|
| A. Finite-gating of CP-1 arithmetic | **PASS** | Walked all 29 files with divide/multiply sites (179 total). CP-1-adjacent files (`portfolio.py` 14 sites, `macro.py`, `earnings.py`, `anomaly.py`, `metricengine.py`, `relval.py`) individually read and confirmed gated. `querygraph.py` (60+ sites, largest cluster) resolved as UI graph-layout math or downstream of the write-gated `MetricFact` store, not independent CP-1 arithmetic. 11 files with raw arithmetic but no `is_finite_number` import (`budget`, `embeddings`, `eval`, `gemini`, `llm_client`, `packer`, `queryanswer`, `readiness`, `reported_cp1`, `synth`, `textscan`) individually read and confirmed non-CP-1 (LLM billing/timing, RAG retrieval math, UI layout) or self-guarded (`... or 1.0`/`if denom else None`). `catalysts`/`refinancing`/`metricfactlane`/`schemas` guard via comparison/threshold, not division — correctly absent from the divide census. |
| B. Zero-denominator degradation | **PASS** | Same file walk; every division site has an explicit non-zero/finite guard or routes through `safe_div`. `anomaly.py`'s CUSUM `sigma<=0 → 1e-6` floor produces a large-but-finite severity, never ±inf/raise — a deliberate design choice, not a violation. |
| C. Non-finite ingress at parse/store boundaries | **PASS** | EDGAR XBRL: `edgar_cp1.py:118` gates before line 124's `float()` cast (redundant-safe). LLM JSON: `loads_finite` wired at all 3 call sites per GitNexus (`extract_json`, `_payload_data_from_resp`, `_parse_payload`). Store: `metrics.py` `add()`/`extract_cost_facts` both `is_finite_number`-gate before `float()`. Reported-disclosure text scan: `reported_cp1._AMOUNT`/`_LEVERAGE_PATTERNS` regex capture groups are digit-only (`[\d,]+`/`\d+(?:\.\d+)?`) — cannot match "nan"/"inf" text; leverage additionally range-checked `0.5–15.0` (NaN comparisons are always False, a second defense). |
| D. CP-1/2/3 contract conformance | **PASS** | 10 contract files (was 9 at authoring) cover all 19 implemented registry modules — cross-referenced test imports, not filename pattern-matching: CP-2C/2D/2F via `test_overlays.py`, CP-3/CP-4 via `test_analytics.py`, CP-6E via `test_debate.py:110`, full-mesh via `test_engine.py`'s ATLF end-to-end fixture. **New file `test_tier2_findings_contract.py`** pins the 5 CP-5 `*_finding` gate functions post an adversarial audit that closed 8 bugs (leverage_plausibility sign bug, reconciliation TypeError/NaN-text, monitoring/peer_outlier join crashes) — read in full, 52 parametrized cases, all pass. |
| E. Golden-master regression | **PASS** | `test_golden_cp1.py` (VSAT + FUN, exact-match against human-validated VIASAT_VALIDATION.md), `test_golden_reported_cp1_vmo2_no_drift` (VMO2 reported-lane), `test_golden_portfolio.py`, `test_golden_query_gates.py` — all green, no drift. |
| F. Financial plausibility | **PASS** | **Independent recompute performed** (not trusting the engine): pulled raw VSAT XBRL facts (`Assets`, `Liabilities`, `AssetsCurrent`, `LiabilitiesCurrent`, `RetainedEarningsAccumulatedDeficit`, `StockholdersEquity`, `OperatingIncomeLoss` FY2026) directly from the fixture JSON and hand-computed Altman Z″ via the textbook formula (independently of `engine.distress`) — **z = 4.47, exact match** to the golden/engine value, zone "safe" confirmed. Leverage consistency also verified: `4701.8 / 1462.6 = 3.2145 → 3.21`, matches golden. |
| G. Sign and unit correctness | **PASS** | Confirmed two $M-conversion points exist by design, not one — `edgar_cp1.py` (structured XBRL lane) and `textscan._to_musd` (reported-disclosure text-scan lane) — each the single canonical conversion for its own ingestion lane; traced `liquidity.py` consumption of `textscan.amount_musd` output and confirmed no re-multiplication (no double-scale). Playbook's §3G wording ("single point... edgar_cp1") describes the EDGAR lane specifically; not a defect, but the report notes the two-lane nuance for the next revision. |
| H. Period-alignment math | **PASS** | Independently re-verified (not just re-running `test_periods.py`): `year('LTM_Q1_26') == 2026` normalizes correctly above `year('FY2024') == 2024`; `sort_key('LTM_Q1_26') > sort_key('FY2024')`; `latest({'FY2024':100,'LTM_Q1_26':200})` picks 200 (not insertion order); `sort_key('LTM_2025') > sort_key('FY2025')` (LTM ranks above the period it trails). |

## Findings

**None.** Zero findings entered the report. One item was flagged mid-audit and
resolved before write-up (documented for audit-trail transparency, not because
it required a fix):

- `metrics.py:234-236` comment ("a non-numeric or NaN/inf value would raise (or
  persist NaN)") was misread on first pass as claiming NaN raises — re-reading
  the full sentence confirms it correctly distinguishes "non-numeric → raises"
  from "NaN/inf → persists" and the code is correctly gated one line earlier
  (`is_finite_number(val)` at line 237, before the `float()` cast at line 247).
  **Refuted — not a finding.**

## Adversarial re-verification log

Per §5 protocol, every candidate was checked against refutation before being
considered:

| Candidate | Refute-first result | Verdict |
|---|---|---|
| `metrics.py:235` comment implies NaN raises | Full sentence already distinguishes non-numeric (raises) from NaN (persists); code gates before the cast | Refuted — non-issue |
| `querygraph.py` 60+ ungated arithmetic sites | Traced to UI radial-layout math (`_radial_positions`, self-guarded `norm or 1.0`) and reads from the write-gated `MetricFact` store (`metricfactlane.py:179` gates on write) | Refuted — architecturally sound, gate lives upstream |
| Two $M-conversion points (edgar_cp1 + textscan) vs playbook's "single point" wording | Traced `liquidity.py` consumption of `textscan.amount_musd`; no re-scaling found | Refuted as a code defect; noted as a playbook wording nuance only |

No CONFIRMED findings this run.

## Accepted-risk register — premise re-check

| ID | Premise | Result |
|---|---|---|
| RUNWAY-NEG | `cov_negative`/`liq_negative` still pinned | **Holds** — `test_interest_runway_contract.py:64-65` |
| WATERFALL-IC | Caveat text still emitted | **Holds** — `capstructure.py:152-154` |
| MYPY-EXCL | Exclusion list not grown | **Holds** — still exactly 9 entries (`adjusted`, `council`, `covenants`, `edgar_cp1`, `reported_cp1`, `peers`, `planner`, `querygraph`, `synth`); coverage *ratio* improved (9/67 vs 9/43) as the engine grew |
| EDGAR-THROTTLE / NO-OCR / DEMO-SEAMS | Matrix register section unchanged | **Holds** — `REVIEW_MATRIX_BACKEND.md:36-37` unchanged |

No premise broken. No row escalated back to an open finding.

## Notes for the next run

- Diff future census counts (64 modules / 179 sites / 10 contract files / 21
  guarded files) against this baseline per the playbook's staleness rule.
- `test_tier2_findings_contract.py` and `portfolio.py`'s full guard coverage
  are worth naming explicitly in the playbook's own examples on its next
  revision — both are strong, currently-uncredited evidence for invariants A/D.
