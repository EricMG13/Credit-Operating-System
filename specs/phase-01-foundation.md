# Phase 1 — Core Foundation & Data Layer

```yaml
phase_id: 01
phase_name: Core Foundation & Data Layer
status: ready
depends_on: []
checklist_items: ["8.3", "9.2"]        # satisfied outright
advances: ["8.5", "6.4", "3.6", "3.7", "9.1"]   # foundations laid here
canon_rules_touched: [1, 2, 3, 4, 9]
```

## 1. Objective

At the end of this phase the repository contains, all green in plain CI with **no
cluster, no network, no Databricks account**:

- `caos_contracts` — the typed canon: closed enums, the 15-field canonical-Markdown
  envelope (+CP-DR profile), payload base models, the filename rule, markdown
  render/parse, and a typed validator that **agrees with the vendored
  `validate_handoff.py` on every conformance file**.
- `caos_engine` kernel — numeric-safety guards, the period kernel, the canonical
  module registry (validated DAG), and the **CP-5A deterministic gate ported from
  legacy with its honesty tests** (checklist 8.3).
- `dbx/schemas/lakebase/0001_core.sql` — core OLTP DDL with the evidence chain
  enforced by schema (8.5), applying clean to Postgres 16 + pgvector.
- `dbx/parity/` — the frozen fixture corpus (hash-manifested) and a working parity
  harness that runs **legacy** kernel functions against **dbx** kernel functions and
  diffs field-by-field (9.1 scaffold).
- Property tests proving NaN/±inf can never slip a guard and guarded arithmetic
  never raises (9.2).

## 2. Scope and out-of-scope

**In scope.** Everything in §4's file tree, and nothing else.

**Out of scope** (tempting adjacents — do not build):
- Any Databricks artifact (`databricks.yml`, Terraform, endpoints) → Phase 2.
- `ServingGatewayClient`, any HTTP client, any model call → Phase 2/3. Only the
  `FixtureGatewayClient` stub and the `SynthesisPort` protocol exist here.
- Module synthesizer ports (CP-0…CP-6A bodies) → Phase 3. The registry lists them;
  their `run_module` dispatch raises `NotImplementedYet` (a defined exception) for
  modules whose port phase has not arrived.
- FastAPI app, frontend, intake pipeline, email lane → Phases 2/4/5/6.
- Monitoring/market/portfolio DDL groups → later migrations (their constraints are
  specified in their phases).

## 3. Input dependencies

| Artifact | Path | Verified how |
|---|---|---|
| DEPLOY_B corpus (normative) | `corpus/DEPLOY_B_COWORK_SKILLS/` | `python3 - <<'EOF'` script in §7 T-CONF-00 recomputes per-file SHA-256 against `DEPLOY_B_PROFILE_MANIFEST.json` for the files this phase consumes |
| Reference validator | `corpus/DEPLOY_B_COWORK_SKILLS/tools/validate_handoff.py` | `python3 <path> --help` exits 0 |
| Legacy engine (parity source) | `caos/server/engine/{periods.py,gate.py,lineage.py,registry.py,fixtures.py,schemas.py}` | files exist; imported by the harness via `dbx/parity/harness/legacy_loader.py` |
| Legacy kernel tests (port source) | `caos/tests/server/{test_nan_guards.py,test_periods_safe_div.py,test_periods.py,test_cp5_gate_honesty.py,test_qa_findings.py}` | files exist |
| Legacy fixture corpus (freeze source) | `caos/tests/server/golden/`, `caos/tests/server/corpus/`, `caos/server/engine/fixtures.py` | files exist |
| Alias register (parity mapping) | `corpus/.../rbot-orchestrator/references/MODULE_ID_ALIASES.md` | file exists; §6.6 table matches it |

## 4. Exact file tree to create

```
dbx/
  pyproject.toml                     # §6.1
  .python-version                    # "3.11"
  README.md                          # 20 lines: what dbx/ is, how to run tests
  src/
    caos_contracts/
      __init__.py                    # re-exports public API
      enums.py                       # ModuleId, QaStatus, ConfidenceBand, CommitteeStatus, Severity, OutputClass, SynthMode, Provenance
      envelope.py                    # CanonicalEnvelope, CpDrProfile, UpstreamArtifactRef, band_for, canonical_filename, SIX_H2S
      payloads.py                    # ModulePayloadBase, EvidenceTrace, WorkbookExportPayload, SourceManifestRow
      markdown.py                    # render_envelope_md, parse_envelope_md (frontmatter + H2 scan incl. fence handling)
      validator.py                   # validate_text(...) -> ValidationResult  (typed port; same exit-code semantics)
      findings.py                    # Finding(severity, lane, code, detail, affected_claim_id)
      errors.py                      # ContractError, NotImplementedYet
    caos_engine/
      __init__.py
      guards.py                      # is_finite_number, safe_div, safe_mul, safe_add  (port of caos/server/engine/periods.py:117-162)
      periods.py                     # sort_key, year, is_annual_label, latest, latest_annual (port of periods.py:20-114, docstrings included)
      gate.py                        # qa_status_from, committee_status_from, roll_up_qa_status, cap_committee_for_blocked_upstream (port of caos/server/engine/gate.py, canonical CP-5A naming in docstrings)
      lineage.py                     # CP-5 lane classifier (port of caos/server/engine/lineage.py taxonomy)
      registry.py                    # ModuleSpec, REGISTRY, validate_registry()  (§6.5)
      synthesis.py                   # SynthesisPort protocol, SynthMode usage, SynthResult
      runner_core.py                 # pure helpers: dependency_layers(REGISTRY), block_reason(upstream)  — no I/O
    caos_gateway/
      __init__.py
      fixture.py                     # FixtureGatewayClient (returns canned SynthResult; no network)
  schemas/
    lakebase/
      0001_core.sql                  # §6.7 verbatim
      README.md                      # how migrations are applied/ordered; forward-only rule
    delta/
      README.md                      # placeholder: Delta DDL arrives Phase 4/6 per ROADMAP
  tools/
    validate_handoff.py              # byte-identical copy of corpus tools/validate_handoff.py (do not edit)
    conformance/
      cases/                         # §7 T-CONF files (14 canonical .md cases)
      build_conformance.py           # regenerates derived cases from the valid seed (deterministic)
  parity/
    corpus/                          # frozen copies (§6.8) + MANIFEST.sha256
    alias_map.py                     # §6.6 verbatim table
    harness/
      __init__.py
      legacy_loader.py               # sys.path bootstrap to import caos/server/engine modules read-only
      diff.py                        # field-by-field diff w/ 1e-9 rel tolerance; report type
      freeze.py                      # one-shot: copies fixture sources into corpus/ and writes MANIFEST.sha256
  tests/
    conftest.py                      # pg fixture (env CAOS_TEST_PG_DSN or skip), corpus paths
    contracts/
      test_enums_closed.py
      test_envelope_validation.py
      test_markdown_roundtrip.py
      test_validator_differential.py
      test_payload_schema_conformance.py
      test_import_layering.py
      test_no_vendor_sdk.py
    engine/
      test_guards_property.py
      test_periods_property.py
      test_null_semantics.py
      test_gate_honesty.py
      test_registry_validation.py
    schema/
      test_ddl_applies.py
      test_evidence_chain_constraints.py
      test_status_vocabularies.py
    parity/
      test_corpus_frozen.py
      test_kernel_parity.py
.github/workflows/dbx-ci.yml         # new file; does not touch existing workflows
```

Do not create any file not listed. `(mod)` files: none — this phase only adds.

## 5. Tests to write FIRST (TDD)

Write these files with failing tests before any `src/` implementation. Behaviours
per file (each bullet is an assertion to encode):

**`tests/contracts/test_enums_closed.py`** (unit, CI-pure)
- `ModuleId` has exactly the 32 values of `CP_MODULE_PAYLOAD_BASE.schema.txt` §enum,
  plus nothing else; `"CP-MODEL"`/`"CP-SNAP"` are NOT `ModuleId` members (they are
  `WorkbookModuleId`).
- Constructing any enum from an unknown string raises.
- `QaStatus` order helper ranks `Blocked > Restricted > Passed > Not Reviewed`;
  ranking an **unknown** string via `rank_qa(s)` returns the worst rank (99-pattern).

**`tests/contracts/test_envelope_validation.py`** (unit)
- A fully valid issuer envelope validates; each of the 15 required fields removed →
  ValidationError naming the field.
- `confidence_band` must equal `band_for(score)`: 80→High, 79→Medium, 60→Medium,
  59→Low, 40→Low, 39→Insufficient Information (boundary table).
- `qa_status=Blocked` with score 40 → error (cap ≤39); `Restricted` with 60 → error
  (cap ≤59); equal-to-cap values pass.
- CP-DR profile: `module_id="CP-DR"` requires the 9 CP-DR fields; enum values pinned
  (`scope_type ∈ {issuer, sector}`, `source_mode ∈ {supplied_only, web_only, hybrid}`,
  `research_status`/`research_stop_reason` cross-rules incl. Blocked⇔blocked⇔qa Blocked).
- `canonical_filename`: issuer `ACME.HLD` + `CP-4A` + 2026-07-28 →
  `"ACME.HLD_CP-4A_20260728.md"`; CP-DR uses `scope_key`; invalid subject key
  (space, leading dot, empty) raises.
- `upstream_artifacts_used` entries require non-empty `module_id`/`run_id`/`period`;
  `module_id` must match the canonical CP-* regex.

**`tests/contracts/test_markdown_roundtrip.py`** (unit)
- `render_envelope_md(env, body_sections)` emits frontmatter + exactly the six H2s in
  canonical order; `parse_envelope_md` inverts it (envelope equality + body equality).
- A fenced code block containing `## Fake Heading` does NOT count as an H2 (fence
  rules per the vendored validator's `_canonical_h2s`).
- BOM at file start is tolerated; missing closing `---` raises.

**`tests/contracts/test_validator_differential.py`** (conformance, CI-pure)
- For every file in `tools/conformance/cases/`, run BOTH
  `caos_contracts.validator.validate_text` and the vendored
  `tools/validate_handoff.py` (via `subprocess`, and via `import` of its
  `validate_text`) with the same `--expected-*` args where the case defines them;
  assert identical exit-code class (0/2/3/4) and, for MALFORMED, that the typed
  validator reports a superset-or-equal set of the reference's error fields.
- Case list (create exactly these under `cases/`, content per description):
  1. `valid_issuer.md` — fully valid, qa Passed → 0
  2. `valid_cp_dr.md` — valid CP-DR profile → 0
  3. `blocked_valid.md` — structurally valid, qa Blocked, score 20 → 3
  4. `missing_field.md` — no `committee_status` → 2
  5. `wrong_heading_order.md` — Analysis before Audit Summary → 2
  6. `extra_heading.md` — seventh H2 → 2
  7. `band_mismatch.md` — score 85, band Medium → 2
  8. `blocked_score_cap.md` — Blocked with score 55 → 2
  9. `bad_subject_key.md` — `issuer_id: "ACME HOLDINGS"` → 2
  10. `bad_upstream_ref.md` — upstream entry missing `period` → 2
  11. `duplicate_field.md` — `run_id` twice → 2
  12. `unterminated_flow.md` — `limitation_flags: [a, b` → 2
  13. `identity_mismatch.md` — valid file; case metadata sets
      `--expected-module CP-2` against `module_id: CP-1` → 4
  14. `filename_mismatch.md` — valid content, stored under the wrong filename → 2
      (filename check via the `filename=` argument)
- `build_conformance.py` regenerates cases 3–14 from case 1 deterministically (string
  surgery, no randomness) so drift is impossible.

**`tests/contracts/test_payload_schema_conformance.py`** (conformance)
- Load `CP_MODULE_PAYLOAD_BASE.schema.txt` (any copy; assert all copies across skills
  are byte-identical first) with `json.loads`; assert `ModulePayloadBase`'s required
  field set, enum values, and the CP-EMAIL/`DISPLAY_DIGEST` + confidence-fields
  conditional rules match it exactly (programmatic comparison, not prose).
- Same for `CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt` vs `WorkbookExportPayload`
  (incl. `output_file` regex and empty `downstream_consumers`).

**`tests/contracts/test_import_layering.py`** (unit)
- AST-walk `dbx/src`: `caos_contracts` imports only stdlib+`pydantic`(+`typing_extensions`);
  `caos_engine` imports only stdlib+`caos_contracts`(+`typing_extensions`);
  `caos_gateway.fixture` imports only stdlib+contracts+engine. Any other import fails
  the test with the offending file:line.

**`tests/contracts/test_no_vendor_sdk.py`** (unit)
- Assert no module under `dbx/` imports or names `anthropic`, `openai`,
  `google.genai`, `google.generativeai`, `openrouter`, `httpx`, `requests`,
  `aiohttp` (checklist 3.1; HTTP arrives only in Phase-2 `caos_gateway.serving`,
  which will amend this test's allowlist explicitly).

**`tests/engine/test_guards_property.py`** (property, hypothesis)
- For all `x` in floats(allow_nan=True, allow_infinity=True) | ints | bools | None |
  text: `is_finite_number(x)` is True iff `isinstance(x,(int,float))` and
  `math.isfinite(x)` — and never raises.
- For all finite/non-finite pairs: `safe_div/safe_mul/safe_add` return None or a
  finite float; **never** raise; never return NaN/±inf. Includes: `safe_div(1.0, 0.0)
  is None`, `safe_div(1e308, 1e-308) is None` (overflow-to-None),
  `safe_mul(1e200, 1e200) is None`, `safe_add(1e308, 1e308) is None`,
  `safe_div(0.0, 5.0) == 0.0` (zero is a value — EC-03).
- `bool` inputs behave as 0/1 (documented legacy semantics).

**`tests/engine/test_periods_property.py`** (property + ported cases)
- Port every case from legacy `test_periods.py` + `test_periods_safe_div.py`
  verbatim (same inputs/expectations).
- EC-04: for any shuffle of a label set, `latest()` result is order-independent;
  2-digit years sort below nothing they shouldn't (`"26"` vs `"2024"` case);
  `H1 2025 < Q3 2025`; year-less `LTM` ranks newest-preferred consistently in both
  `latest()` and headline selection (single-semantics assertion).
- EC-05: `latest({"FY2025": 500, "LTM_2025": 560}) == 560` (the +0.5 LTM rank —
  changing this expectation requires a DEVIATIONS row; the test says so in a comment).
- EC-06: `latest_annual` never returns a value whose label is a standalone quarter
  (property over generated label sets).

**`tests/engine/test_null_semantics.py`**
- `0.0` propagates as a value through guards and payload fields; `None` propagates as
  absence; no code path converts one to the other (EC-03, canon rule 4).

**`tests/engine/test_gate_honesty.py`** (the 8.3 gate — port + extend)
- Port the legacy `test_cp5_gate_honesty.py` triple against dbx `gate.py`:
  clean findings → `Passed`/`Committee Ready`; one MATERIAL → `Restricted`; one
  CRITICAL → `Blocked`, and `committee_status_from` maps non-Passed → `Draft Only`
  (fail-closed), Blocked → `Blocked`.
- Property: for any findings list, `qa_status_from` is monotone (adding a finding
  never improves the status).
- `roll_up_qa_status(["Passed", "definitely-not-a-status"]) == "definitely-not-a-status"`-class
  input ranks worst → roll-up returns the unknown-as-worst behaviour (assert the
  rolled result is not `Passed`; exact legacy semantics: unknown ranks 99 ⇒ becomes
  the roll-up).
- `cap_committee_for_blocked_upstream` downgrades `Committee Ready → Restricted`,
  never upgrades, never touches `qa_status`.

**`tests/engine/test_registry_validation.py`**
- REGISTRY contains exactly the 32 canonical `ModuleId`s; every `depends_on` edge
  matches §6.5's edge table (programmatic comparison against a parsed copy of the
  fenced edge list); no cycles (topological layering succeeds); no dangling refs;
  duplicate ids impossible; `validate_registry()` raises loudly on a mutated copy
  with a cycle (construct one in-test).

**`tests/schema/test_ddl_applies.py`** (needs Postgres; skips with reason if
`CAOS_TEST_PG_DSN` unset — CI provides `pgvector/pgvector:pg16` service)
- `0001_core.sql` applies cleanly to an empty database, twice-idempotent guard not
  required (forward-only; second apply MAY fail — assert first apply clean).
- All 19 §6.7 tables exist with expected columns (information_schema comparison
  against a table manifest embedded in the test).

**`tests/schema/test_evidence_chain_constraints.py`** (8.5 enforced by schema)
- INSERT `metric_facts` row with `provenance='run'` and NULL `document_chunk_id` →
  rejected by CHECK.
- INSERT `evidence_items` with dangling `claim_pk` or dangling `document_chunk_id` →
  FK violation.
- INSERT second `module_outputs` row for same `(run_id, module_id)` → unique
  violation.
- INSERT second active (`queued`) run for one issuer → partial-unique violation.
- `report_versions.document_sha256` NULL → NOT NULL violation; wrong length → CHECK.
- `artifact_envelopes.filename` not matching the shape regex → CHECK violation.

**`tests/schema/test_status_vocabularies.py`**
- Every status CHECK in DDL admits exactly the enum values from `caos_contracts.enums`
  (generate INSERTs from the enums; assert unknown value rejected).

**`tests/parity/test_corpus_frozen.py`**
- `parity/corpus/MANIFEST.sha256` exists; every listed file present with matching
  hash; no unlisted files in `corpus/`; the manifest itself lists ≥ the freeze set in
  §6.8.

**`tests/parity/test_kernel_parity.py`** (9.1 scaffold — legacy vs dbx, both pure)
- Via `legacy_loader`, import legacy `periods`/`gate`. For the corpus of inputs
  extracted from frozen fixtures (§6.8) plus 500 hypothesis-generated cases per
  function (seeded, `derandomize=True`): `dbx.guards.is_finite_number ==
  legacy.periods.is_finite_number`; `safe_div/mul/add` identical (None==None, floats
  exact); `sort_key/latest/latest_annual` identical on the fixture label sets;
  `qa_status_from/roll_up/committee_status_from` identical on finding sets extracted
  from the frozen golden payloads.
- The alias map: for every row in §6.6, legacy `owned_object` (from legacy
  `registry.py`) resolves to the canonical `ModuleId`; unknown/ambiguous → raises.

## 6. Implementation requirements

### 6.1 `dbx/pyproject.toml`

- `[project]` name `caos-dbx`, `requires-python = ">=3.11"`, dependencies:
  `pydantic>=2.7,<3`. Optional dev group: `pytest>=8`, `hypothesis>=6.100`,
  `ruff>=0.5`, `mypy>=1.10`, `psycopg[binary]>=3.1`. Nothing else (Q-008 logs these;
  any addition requires a new Q entry first).
- src layout; packages `caos_contracts`, `caos_engine`, `caos_gateway`.
- `[tool.mypy]` strict = true for all three packages (no exclusion lists — audit F-12).
- `[tool.ruff]` line-length 100, `select = ["E","F","I","UP","B"]`.

### 6.2 `caos_contracts` requirements

1. Enums exactly as §5 tests pin them; `StrEnum`; module docstrings cite corpus file
   + audit F-5 (closed-vocabulary rule). (test_enums_closed)
2. `CanonicalEnvelope` field set = vendored validator `REQUIRED_FIELDS` +
   `ISSUER_FIELDS` / `CP_DR_FIELDS`; every validator rule from
   `tools/validate_handoff.py` `_validate_fields` implemented as pydantic
   validators — score/band consistency via `band_for`, caps, regexes
   (`MODULE_ID_RE`, `SUBJECT_KEY_RE`, `PLAN_HASH_RE`, `DATE_RE`), CP-DR cross-field
   rules. (test_envelope_validation)
3. `markdown.py` implements frontmatter emit/parse compatible with the vendored
   restricted-YAML subset (flow lists/mappings, one-level block sequences, quoted
   scalars, comments, BOM) and the fence-aware H2 scan. Do not import yaml — port the
   subset. (test_markdown_roundtrip, test_validator_differential)
4. `validator.py` returns `ValidationResult(errors, identity_mismatches, fields)`
   with `exit_code` semantics identical to the vendored tool (0/2/3/4). The vendored
   file under `dbx/tools/` is **never edited** and remains the reference. (differential)
5. `payloads.py` mirrors the two corpus payload-base schemas exactly, incl.
   conditional confidence rules and `WorkbookExportPayload` constants/regex.
   (test_payload_schema_conformance)
6. `findings.py`: `Severity` = CRITICAL/MATERIAL/MINOR only; `Finding.lane` int 1–8;
   codes are free strings (legacy finding codes arrive Phase 3).

### 6.3 `caos_engine.guards` / `periods`

Port from `caos/server/engine/periods.py` **with docstrings and comments** (they
encode audit ENG-6/ENG-17/ENG-18 rationale). Signatures:

```python
def is_finite_number(x: object) -> TypeGuard[float]
def safe_div(numerator: object, denominator: object) -> float | None
def safe_mul(left: object, right: object) -> float | None
def safe_add(left: object, right: object) -> float | None
def sort_key(label: str) -> float
def year(label: str) -> int
def is_annual_label(label: str) -> bool
def latest(series: Mapping[str, float]) -> float | None
def latest_annual(series: Mapping[str, float]) -> float | None
```

Behaviour byte-compatible with legacy (parity tests enforce). `TypeGuard` from
`typing` (3.11+).

### 6.4 `caos_engine.gate` (canonical CP-5A) and `lineage` (canonical CP-5)

Port `caos/server/engine/gate.py` function-for-function (severity ladder, fail-closed
committee mapping, unknown-ranks-worst roll-up, blocked-upstream cap that leaves
`qa_status` untouched) and `caos/server/engine/lineage.py`'s lane taxonomy
(orphan-claim → CRITICAL lane 1; Untraced/Weak Lineage/Conflicting → MATERIAL lane 6;
Assumption-Based/Analyst Inference/Insufficient Information → MINOR; unresolved
sourced citation → MINOR; `_SOURCED_TYPES` includes `documentary_fact`). Docstrings
must state the canonical↔legacy identity mapping (corpus CP-5A ⇔ legacy CP-5 gate;
corpus CP-5 ⇔ legacy CP-5B).

### 6.5 `caos_engine.registry`

`ModuleSpec` frozen dataclass per ARCHITECTURE §7.3. REGISTRY: all 32 canonical IDs.
`depends_on` edges = exactly the ROUTE_GRAPH dependency edges (ARCHITECTURE §6.1
fenced block — reproduce as data). `after` tuples empty in Phase 1 (populated in
Phase 3 while reconciling legacy soft edges; divergences → DEVIATIONS). Layers:
`CP-PARSE`:L-1 · `CP-0`,`CP-X`:L0 · `CP-1*`:L1 · `CP-2*`:L2 · `CP-3*`:L3 ·
`CP-4*`:L4 · `CP-5`,`CP-5A`:L5 · `CP-6`,`CP-6A`:L6 · `CP-DR`,`CP-EMAIL`:L7 ·
`CP-8`:L8. `implemented=True` for the 21 modules with legacy equivalents +
`CP-5`/`CP-5A`/`CP-X` (DECISIONS Table B "CONTRACT+LEGACY" with engine runtime);
`False` for `CP-2H`,`CP-3D`,`CP-4C`,`CP-EMAIL`,`CP-8`,`CP-DR`,`CP-PARSE` (runtime
arrives in their phases; CP-PARSE/CP-DR are job/lane-implemented, flagged
`implemented=False, feature_flag=None` with a comment). `validate_registry()` runs at
import: duplicate/dangling/cycle → `RegistryError` naming offenders (no silent
fallback — audit §5.5).

### 6.6 `parity/alias_map.py` (verbatim data)

```python
# Source: corpus/.../MODULE_ID_ALIASES.md v1.2 (2026-07-22). ID-only resolution is
# PROHIBITED — resolve by (legacy_id, owned_object). Ambiguity raises AliasError.
LEGACY_TO_CANONICAL: dict[tuple[str, str], str] = {
  ("CP-00", "document_parse_manifest"): "CP-PARSE",
  ("CP-0A", "source_readiness_register"): "CP-0",
  ("CP-0",  "source_readiness_register"): "CP-0",     # legacy registry id
  ("CP-0B", "route_plan"): "CP-X",
  ("CP-X",  "route_plan"): "CP-X",
  ("CP-1",  "canonical_data_foundation"): "CP-1",
  ("CP-1A", "business_transaction_fact_pack"): "CP-1A",
  ("CP-1B", "earnings_delta"): "CP-1B",
  ("CP-1C", "peer_benchmark"): "CP-1C",
  ("CP-2",  "fundamental_credit_view"): "CP-2",
  ("CP-2B", "downside_pathway"): "CP-2A",
  ("CP-2C", "event_catalyst_register"): "CP-2B",
  ("CP-2D", "governance_sponsor_score"): "CP-2C",
  ("CP-2E", "liquidity_cash_flow_bridge"): "CP-2D",
  ("CP-2F", "macro_fx_hedging_sensitivity"): "CP-2E",
  ("CP-2G", "esg_credit_risk"): "CP-2F",
  ("CP-2H", "forward_credit_model"): "CP-2G",
  ("CP-2R", "rating_transition_case"): "CP-2H",
  ("CP-3",  "relative_value_security_selection"): "CP-3",
  ("CP-3B", "recovery_instrument_assessment"): "CP-3A",
  ("CP-3C", "portfolio_fit_position_sizing"): "CP-3B",
  ("CP-3D", "refinancing_lme_risk"): "CP-3C",
  ("CP-3E", "market_implied_risk_map"): "CP-3D",
  ("CP-4",  "covenant_findings"): "CP-4",
  ("CP-4C", "covenant_capacity_calculation"): "CP-4A",
  ("CP-4D", "structural_priority_map"): "CP-4B",
  ("CP-4E", "restructuring_scenario"): "CP-4C",
  ("CP-5B", "evidence_trace_validation"): "CP-5",
  ("CP-5",  "qa_result"): "CP-5A",
  ("CP-6A", "ic_debate_challenge"): "CP-6",
  ("CP-6E", "portfolio_debate_challenge"): "CP-6A",
  ("CP-7",  "decision_ledger"): "CP-8",
  ("CP-MON","issuer_signal_register"): "CP-EMAIL",    # retired; compatibility only
}
```

Where a legacy `owned_object` string in `caos/server/engine/registry.py` differs
from the corpus register's wording, the loader resolves by legacy ID **and** asserts
the legacy registry's `owned_object` for that ID matches this table after
normalization; a mismatch raises `AliasError` (never guesses). Update this file only
by citing the corpus register.

### 6.7 `schemas/lakebase/0001_core.sql` (verbatim; core groups only)

```sql
-- CAOS dbx core OLTP schema. Forward-only. Postgres 16+, pgvector required.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS caos;
SET search_path TO caos;

CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analysts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer'
    CONSTRAINT ck_analysts_role CHECK (role IN ('analyst','viewer','qa','admin')),
  team_id UUID REFERENCES teams(id),
  token_version INTEGER NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_analyst_email ON analysts (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE issuers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  uniqueness_scope TEXT NOT NULL DEFAULT 'global',
  ticker TEXT, sector TEXT, sponsor TEXT,
  team_id UUID REFERENCES teams(id),
  created_by UUID REFERENCES analysts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_issuers_scope_normalized_name UNIQUE (uniqueness_scope, normalized_name)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  issuer_id UUID REFERENCES issuers(id),
  analyst_id UUID REFERENCES analysts(id),
  doc_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,                       -- UC Volume path (content-addressed)
  sha256 CHAR(64) NOT NULL,
  malware_scan TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT ck_documents_scan CHECK (malware_scan IN ('pending','clean','infected','error','not_configured')),
  status TEXT NOT NULL DEFAULT 'active',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES analysts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  text TEXT NOT NULL,
  chunk_hash CHAR(64) NOT NULL,
  prov TEXT CONSTRAINT ck_chunks_prov CHECK (prov IS NULL OR prov = 'ocr'),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  CONSTRAINT uq_chunk_doc_seq UNIQUE (document_id, seq)
);
CREATE INDEX ix_document_chunks_tsv ON document_chunks USING gin (tsv);
CREATE INDEX ix_document_chunks_document ON document_chunks (document_id);

CREATE TABLE document_chunk_embeddings (
  id UUID PRIMARY KEY,
  chunk_hash CHAR(64) NOT NULL,
  model TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT 'live'
    CONSTRAINT ck_embeddings_prov CHECK (provenance IN ('live','fixture')),  -- mock-vector lesson (migration-0060 post-mortem)
  vector vector(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chunk_embeddings_lookup UNIQUE (model, chunk_hash, provenance)
);
CREATE INDEX ix_chunk_embeddings_vector ON document_chunk_embeddings
  USING hnsw (vector vector_cosine_ops);

CREATE TABLE source_manifests (
  id UUID PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id),
  analyst_id UUID REFERENCES analysts(id),
  status TEXT NOT NULL DEFAULT 'draft',
  approval_state TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT ck_manifest_approval CHECK (approval_state IN ('draft','ratified','published','rejected')),
  files JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{document_id, sha256, malware_scan}]
  ratified_by UUID REFERENCES analysts(id),
  ratified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE runs (
  id UUID PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id),
  parent_run_id UUID REFERENCES runs(id),
  analyst_id UUID REFERENCES analysts(id),
  pathway TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CONSTRAINT ck_runs_status CHECK (status IN ('queued','running','complete','failed')),
  halt_reason TEXT,                                 -- stop-on-Blocked: set once, whole pathway halts
  qa_status TEXT
    CONSTRAINT ck_runs_qa CHECK (qa_status IS NULL OR qa_status IN ('Not Reviewed','Passed','Restricted','Blocked')),
  committee_status TEXT
    CONSTRAINT ck_runs_committee CHECK (committee_status IS NULL OR committee_status IN
      ('Blocked','Restricted','Draft Only','Requires More Work','Insufficient Information','Committee Ready')),
  model_id TEXT, prompt_version TEXT, model_mode TEXT,          -- 3.7 fingerprint
  input_document_ids JSONB, input_manifest_ids JSONB,
  input_corpus_sha256 CHAR(64),                                  -- 6.4 frozen corpus digest
  input_snapshot_state TEXT
    CONSTRAINT ck_runs_snapshot CHECK (input_snapshot_state IS NULL OR input_snapshot_state IN ('empty','approved','unapproved')),
  idempotency_key TEXT, idempotency_request_hash CHAR(64),
  tokens_used BIGINT NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  workflow_run_id TEXT,                                          -- Databricks Jobs run id (8.2)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_runs_issuer_active ON runs (issuer_id) WHERE status IN ('queued','running');
CREATE UNIQUE INDEX uq_runs_analyst_idempotency ON runs (analyst_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_runs_status_created_at ON runs (status, created_at);

CREATE TABLE module_outputs (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,                          -- canonical namespace only
  owned_object TEXT NOT NULL,
  output_class TEXT NOT NULL DEFAULT 'CANONICAL_MARKDOWN'
    CONSTRAINT ck_mo_class CHECK (output_class IN ('CANONICAL_MARKDOWN','DISPLAY_DIGEST','WORKBOOK_EXPORT')),
  runtime_output JSONB NOT NULL,
  confidence_score INTEGER CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100),
  confidence_band TEXT
    CONSTRAINT ck_mo_band CHECK (confidence_band IS NULL OR confidence_band IN ('High','Medium','Low','Insufficient Information')),
  qa_status TEXT NOT NULL DEFAULT 'Not Reviewed'
    CONSTRAINT ck_mo_qa CHECK (qa_status IN ('Not Reviewed','Passed','Restricted','Blocked')),
  committee_status TEXT
    CONSTRAINT ck_mo_committee CHECK (committee_status IS NULL OR committee_status IN
      ('Blocked','Restricted','Draft Only','Requires More Work','Insufficient Information','Committee Ready')),
  limitation_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  downstream_consumers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_run_module UNIQUE (run_id, module_id)
);

CREATE TABLE claims (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module_output_id UUID NOT NULL REFERENCES module_outputs(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL,                           -- C-xx
  claim_text TEXT NOT NULL
);
CREATE INDEX ix_claims_module_output ON claims (module_output_id);

CREATE TABLE evidence_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_pk BIGINT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL,                        -- E-xx
  extraction_type TEXT NOT NULL,
  lineage_class TEXT,
  source_locator TEXT,
  document_chunk_id UUID REFERENCES document_chunks(id)   -- the join that makes a citation real
);
CREATE INDEX ix_evidence_claim ON evidence_items (claim_pk);
CREATE INDEX ix_evidence_chunk ON evidence_items (document_chunk_id);

CREATE TABLE qa_findings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  severity TEXT NOT NULL CONSTRAINT ck_findings_sev CHECK (severity IN ('CRITICAL','MATERIAL','MINOR')),
  lane INTEGER NOT NULL CHECK (lane BETWEEN 1 AND 8),
  code TEXT NOT NULL,
  detail TEXT NOT NULL,
  affected_claim_id TEXT
);
CREATE INDEX ix_findings_run ON qa_findings (run_id);

CREATE TABLE metric_facts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id),
  run_id UUID REFERENCES runs(id),
  metric_key TEXT NOT NULL,
  period TEXT NOT NULL,
  value DOUBLE PRECISION,                            -- NULL = absence; 0.0 = value (EC-03)
  provenance TEXT NOT NULL DEFAULT 'run'
    CONSTRAINT ck_fact_prov CHECK (provenance IN ('run','seed','demo_fixture')),
  source_claim_id TEXT,
  source_evidence_id TEXT,
  document_chunk_id UUID REFERENCES document_chunks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fact UNIQUE (issuer_id, run_id, metric_key, period),
  -- 8.5 enforced by schema: a run-derived number MUST reach its source chunk
  CONSTRAINT ck_fact_chain CHECK (provenance <> 'run' OR document_chunk_id IS NOT NULL)
);

CREATE TABLE artifact_envelopes (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  subject_key TEXT NOT NULL
    CONSTRAINT ck_env_subject CHECK (subject_key ~ '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'),
  analysis_date DATE NOT NULL,
  filename TEXT NOT NULL
    CONSTRAINT ck_env_filename CHECK (filename ~ '^[A-Za-z0-9][A-Za-z0-9.-]*_CP-[0-9A-Z-]+_[0-9]{8}\.(md|xlsx)$'),
  sha256 CHAR(64) NOT NULL,
  volume_path TEXT NOT NULL,
  qa_status TEXT NOT NULL
    CONSTRAINT ck_env_qa CHECK (qa_status IN ('Not Reviewed','Passed','Restricted','Blocked')),
  limitation_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_envelope UNIQUE (run_id, module_id, filename)
);
-- filename composition is owned by caos_contracts.canonical_filename; the CHECK
-- enforces shape, tests enforce equality (generated columns can't call to_char).

CREATE TABLE report_drafts (
  id UUID PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id),
  analyst_id UUID NOT NULL REFERENCES analysts(id),
  payload JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_draft UNIQUE (issuer_id, analyst_id)
);

CREATE TABLE report_versions (
  id UUID PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id),
  analyst_id UUID REFERENCES analysts(id),
  run_id UUID REFERENCES runs(id),
  status TEXT NOT NULL DEFAULT 'published',
  payload JSONB NOT NULL,
  document_sha256 CHAR(64) NOT NULL CONSTRAINT ck_rv_sha CHECK (char_length(document_sha256) = 64),
  authority JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_report_versions_issuer_created ON report_versions (issuer_id, created_at);

CREATE TABLE llm_call_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id UUID REFERENCES runs(id),
  lane TEXT NOT NULL CONSTRAINT ck_llm_lane CHECK (lane IN ('heavy','light','extract','embed')),
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_hash CHAR(64) NOT NULL,
  prompt_tokens INTEGER, completion_tokens INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL CONSTRAINT ck_llm_status CHECK (status IN ('success','failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_llm_calls_run ON llm_call_records (run_id);

CREATE TABLE lineage_edges (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artifact_id TEXT NOT NULL,      -- "kind:id"
  parent_id TEXT NOT NULL,
  transform TEXT NOT NULL,
  transform_version TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lineage_idem UNIQUE (idempotency_key)
);
CREATE INDEX ix_lineage_artifact ON lineage_edges (artifact_id);
CREATE INDEX ix_lineage_parent ON lineage_edges (parent_id);
```

Nineteen tables. Monitoring (C3 + `news` kill-switch), market, portfolio, model-v2,
decisions/committee, `read_audit` groups arrive in later migrations at their phases —
do **not** add them now.

### 6.8 Parity corpus freeze

`parity/harness/freeze.py` copies, without modification:
- `caos/tests/server/golden/**` (golden payload JSON + fixtures)
- `caos/tests/server/corpus/**` (28 real-issuer fact fixtures + MANIFEST.md)
- `caos/server/engine/fixtures.py` (as `corpus/atlf_fixtures.py.txt` — data reference)
then writes `parity/corpus/MANIFEST.sha256` (`sha256  relative/path` lines, sorted).
Run once during this phase; committed output is thereafter **frozen** (tests + CI
enforce; edits forbidden).

### 6.9 CI (`.github/workflows/dbx-ci.yml`)

Single workflow, triggers on PRs touching `dbx/**`. Jobs:
1. `lint-type`: `uv sync` → `ruff check dbx` → `mypy dbx/src`.
2. `test-pure`: `uv run pytest dbx/tests -q -m "not platform"` with service container
   `pgvector/pgvector:pg16` exposing `CAOS_TEST_PG_DSN=postgresql://postgres:postgres@localhost:5432/postgres`.
Existing workflows are not modified.

## 7. Done-when criteria (all must hold)

- [ ] `cd dbx && uv sync && uv run pytest tests -q -m "not platform"` — **all green**
      (includes every §5 file; no skips except documented pg-DSN skip locally).
- [ ] `uv run mypy src` — zero errors, strict, no exclusions.
- [ ] `uv run ruff check .` — clean.
- [ ] Validator differential: 14/14 conformance cases agree with
      `python3 dbx/tools/validate_handoff.py` exit codes.
- [ ] Parity: `uv run pytest tests/parity -q` green (kernel functions + alias map +
      frozen-corpus hashes).
- [ ] DDL: `tests/schema` green against the pgvector service container, including all
      evidence-chain violation cases.
- [ ] `DEVIATIONS.md` untouched or extended only with reviewed rows; no edits to
      `specs/**`, `corpus/**`, `parity/corpus/**` (after freeze), `dbx/tools/validate_handoff.py`.
- [ ] Checklist evidence recorded in the PR description: 8.3 → `tests/engine/test_gate_honesty.py`;
      9.2 → `tests/engine/test_guards_property.py`.

## 8. Forbidden actions

1. No modification of `specs/**`, `architecture/**`, `roadmap/ROADMAP.md`,
   `corpus/**`, `dbx/tools/validate_handoff.py`, or (post-freeze)
   `dbx/parity/corpus/**`. Ambiguity or error found → STOP, log in
   `OPEN-QUESTIONS.md` (or `DEVIATIONS.md` if a divergence is needed), await review.
2. No dependencies beyond §6.1's list without a prior `OPEN-QUESTIONS.md` entry
   (name, version, licence, reason).
3. No model-vendor SDKs, no HTTP clients, no `databricks-*` packages anywhere in
   this phase (3.1; enforced by `test_no_vendor_sdk.py` / `test_import_layering.py`).
4. No weakening of canon gates to make tests pass (fail-closed validation,
   stop-on-Blocked semantics in the gate, null≠zero, never-fabricate,
   unknown-ranks-worst).
5. No writes to `caos/**` or `Modular OS/**` (read-only golden-master reference).
6. No scope from later phases (§2 list).

## 9. Rollback / abort note

This phase only adds files under `dbx/` and one new CI workflow. Abort = delete the
branch; no shared state, no platform resources, no data. Previous state of the
repository is untouched.
