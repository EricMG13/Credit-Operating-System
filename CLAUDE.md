# CAOS Databricks Rebuild — Implementation-Model Guide

Guidance for the AI implementation model (and any human contributor) executing the
CAOS → Databricks rebuild in this repository. `AGENTS.md` is a symlink to this file.
(The legacy application guide this file replaces lives in git history and applies
only to the read-only `caos/` tree.)

## What this repository is now

Three zones, with different rules:

| Zone | Contents | Rule |
|---|---|---|
| `dbx/` | **The rebuild.** All new code lives here. | Build per specs. |
| Spec set: `audit/`, `architecture/`, `roadmap/`, `specs/`, `DEVIATIONS.md`, `OPEN-QUESTIONS.md`, `corpus/` | The binding specification and the normative methodology corpus (`corpus/DEPLOY_B_COWORK_SKILLS/` incl. the vendored `Enterprise_Transfer_Rebuild_Checklist.md`). | **Read-only** for the implementation model (append-only for `DEVIATIONS.md` / `OPEN-QUESTIONS.md` per the protocols inside them). |
| Legacy: `caos/`, `Modular OS/`, root audit ledgers | The golden master (checklist 9.1) and its history. | **Read-only reference.** Never edit; the parity harness imports from it. |

**Read in this order before writing any code:**
1. `roadmap/ROADMAP.md` — find the current phase (lowest phase whose Done-When is not
   yet green).
2. `specs/phase-NN-*.md` for that phase (Phase 1 exists; later phases must first be
   authored from `specs/SPEC-TEMPLATE.md` and reviewed — if the spec for the current
   phase is missing, STOP and say so).
3. `architecture/ARCHITECTURE.md` + `architecture/DECISIONS.md` for context;
   `audit/AUDIT-2026-07-28.md` for the "why" behind every guard.

## Handoff rules (binding, verbatim)

1. Tests before implementation. Parity harness must be green before phase sign-off.
2. Never modify spec files. Log any necessary deviation in `DEVIATIONS.md` and stop
   for review.
3. If any contract is ambiguous, halt and ask — do not improvise.
4. Canon rules are invariants: fail closed, stop on Blocked, null≠zero, never
   fabricate, a model never grades its own output.

"Halt and ask" concretely: append an entry to `OPEN-QUESTIONS.md` (question, working
assumption if any, what changes with each answer), stop work on the affected item,
and continue only on unaffected items.

## Domain invariants (canon — enforced by tests, never weakened)

From `corpus/DEPLOY_B_COWORK_SKILLS/_COMMON_CORE.md` (normative) and the audited
legacy engine:

1. **Every run is a full workflow** — no reduced mode for decision-grade output.
2. **Markdown first, fail closed** — canonical envelope (15 YAML fields, six exact
   H2s, `[SubjectKey]_[Module]_[YYYYMMDD].md` filename) validated before anything
   else; optional exports can fail without invalidating valid Markdown. The vendored
   `dbx/tools/validate_handoff.py` is the reference implementation — never edit it.
3. **Stop on Blocked** — a `qa_status: Blocked` node halts the whole pathway; no
   routing around a blocked gate, even when a downstream node's other inputs are
   satisfied.
4. **Upstream Re-Anchor Gate** — every module re-verifies upstream `module_id` /
   `run_id` / period / subject before consuming; missing/Blocked/mismatch ⇒
   `[Insufficient Information]` + stop, never inference.
5. **null ≠ zero** — `None` is absence (a gap with a flag); `0.0` is a value. No code
   path converts one into the other.
6. **Never fabricate** — every figure carries file + locator or is null + gap;
   unresolved sourced citations stay unresolved so the lineage validator can flag
   them; a wrong citation is worse than a missing one.
7. **A model never grades its own output** (checklist 8.3) — `qa_status` /
   `committee_status` come only from the deterministic CP-5A gate over findings;
   unknown status ranks **worst**; only explicit `Passed` can reach committee.
8. **Limitation flags propagate** — every downstream consumer carries upstream
   limitation flags; every cap/truncation emits a flag; nothing silently truncates
   committee-facing content.
9. **Covenant capacity is never inferred** — absent inputs ⇒ `Not Calculable`.
   Debt = balance-sheet carrying value; finance-subsidiary perimeters split
   industrial vs finance metrics; multi-figure events keep all figures + one conflict
   row; subsequent events are flagged, never blended.
10. **Numeric safety is type-level** — any computation dividing/multiplying a
    CP-1-derived value gates inputs through `caos_engine.guards.is_finite_number`
    (a bare `isinstance` or truthiness check is not a finite gate: `bool(NaN)` is
    `True`). Guarded arithmetic (`safe_div/mul/add`) returns `None` or finite —
    never raises, never returns NaN/±inf. One period kernel
    (`caos_engine/periods.py`); no parallel date logic anywhere.
11. **Closed vocabularies** — every status is a closed enum; unknown maps to the most
    restrictive state; UI renders unknown as attention, never success.
12. **Module IDs are the canonical DEPLOY_B namespace** everywhere in `dbx/`; the
    legacy alias map lives only in `dbx/parity/alias_map.py` and resolves by
    (legacy ID + owned_object), never ID alone.
13. **Provenance is visible** — fixture/demo-derived numbers are tagged, flagged
    MATERIAL for non-demo subjects, and rendered distinctly (fixture mode is a
    feature, checklist 3.6; contamination is a bug).
14. **Platform state only** — no in-process lock/cache/counter guards a
    cross-request invariant; idempotency and single-active-run are DB-enforced.
15. **No direct model-vendor SDK usage anywhere** (checklist 3.1) — all model calls
    go through `caos_gateway`; the egress predicate is enforced inside the seam.

## Build & test commands

```bash
# all commands from dbx/ unless noted
uv sync                                     # install (uv-managed, lockfile committed)
uv run pytest tests -q -m "not platform"    # CI-pure suite (no cluster, no network)
uv run pytest tests/parity -q               # golden-master parity (legacy vs dbx)
uv run mypy src                             # strict; no exclusion lists
uv run ruff check .
python3 tools/validate_handoff.py <file.md> --expected-module CP-N \
    --expected-run-id <id> --expected-period <period>   # reference validator
# schema tests need Postgres+pgvector:
#   export CAOS_TEST_PG_DSN=postgresql://postgres:postgres@localhost:5432/postgres
# platform suite (Phase ≥2, needs a workspace): uv run pytest tests -q -m platform
# bundle (Phase ≥2): databricks bundle validate && databricks bundle deploy -t dev
```

Legacy suite (reference only, when parity questions arise): see `caos/README.md`
(bootstrap a venv from `caos/server/requirements.txt`; run
`python -m pytest caos/tests/server -q`).

## Test strategy

- **TDD is mandatory** — each phase spec lists the test files to write first; red
  before green.
- **Parity is the migration** (9.1/9.5): field-by-field diff vs the legacy engine on
  the frozen corpus (`dbx/parity/corpus/` — never edit after freeze), tolerance 1e-9
  relative, alias-mapped. An intended difference requires a `DEVIATIONS.md` row cited
  in the test.
- **Property tests** (hypothesis) guard the numeric kernel (9.2) and every closed
  vocabulary; conformance tests pin contracts to the corpus schema files;
  differential tests pin the typed validator to the vendored one.
- **Verify before you fix** (audit lesson: reviewer severity inflates ~3:1 in this
  repo's history) — act on findings only with a runnable repro or a file:line
  verification; behaviour-focused tests exist to stop "fixes" that regress pinned
  idioms.
- Migrations are forward-only; never rename an applied revision; check heads before
  adding one.

## Forbidden actions

1. Modifying `specs/**`, `architecture/**`, `roadmap/**`, `audit/**`, `corpus/**`,
   `dbx/tools/validate_handoff.py`, or `dbx/parity/corpus/**` (post-freeze).
2. Writing to `caos/**` or `Modular OS/**`.
3. Adding any dependency without a prior `OPEN-QUESTIONS.md` entry (name, version,
   licence, reason). No GPL/AGPL/SSPL/BUSL runtime dependencies (checklist 5.2).
4. Importing model-vendor SDKs or ad-hoc HTTP clients for model calls (3.1).
5. Weakening, skipping, or mocking-away a canon gate to make a test pass.
6. Building scope from a later phase (each spec's out-of-scope list is binding).
7. Editing `.github/workflows/*` other than `dbx-ci.yml` additions.

## Working conventions

- **Parallel-WIP staging:** stage explicit paths only — never `git add -A` / `git add .`.
  Commit only files you changed for the task.
- **Diffs/comparisons** run against `origin/main` (local `main` may be stale).
- **Branching:** work on the designated feature branch; never push elsewhere without
  explicit permission.
- **Red-team gate:** before committing to a *new* architecture/interface decision not
  already covered by the spec set (which should be rare — prefer halting), record a
  critic pass in `.agent-reviews/redteam.md` and address objections.
- Code style: match surrounding code; comments only for constraints the code cannot
  express — the ported legacy docstrings that encode audit findings are load-bearing,
  keep them.
- UI work follows the Design Context: dark institutional terminal (`--caos-*` tokens),
  WCAG 2.1 AA, colour never the sole signal, `prefers-reduced-motion` honoured,
  tabular numerals for all numerics, Report Studio's light "paper" mode preserved
  (checklist 9.3; ARCHITECTURE + legacy `caos/frontend/src/app/globals.css` as token
  source).

## Current phase pointer

Phase 1 (`specs/phase-01-foundation.md`) is authored and ready. Later phases require
spec authoring + review first. When in doubt about state: run the Phase-1 Done-When
commands; if green and no Phase-2 spec exists, the next action is to request the
Phase-2 spec review, not to improvise one.
