# SPEC-TEMPLATE — Phase Specification Standard

> Copy this file to `specs/phase-NN-<slug>.md` when authoring the specification for any
> phase ≥ 2. Fill every section. A phase spec that omits a section, or fills one with
> prose that cannot be executed or tested, is **not ready for implementation** and must
> not be handed to the implementation model.
>
> The implementation model executes phase specs with **no access to the conversation
> that produced them**. Every contract, path, command, and acceptance criterion must be
> stated in the file itself. If the author cannot state something precisely, it belongs
> in `OPEN-QUESTIONS.md`, and the spec must say the item is blocked on it.

---

## 0. Header block (required, machine-readable)

```yaml
phase_id: NN                      # integer, zero-padded in filename
phase_name: ""                    # short name, matches ROADMAP.md exactly
status: draft | ready | in-progress | done
depends_on: [phase-ids]           # every phase whose Done-When must be green first
checklist_items: []               # Enterprise_Transfer_Rebuild_Checklist native IDs
                                  # (e.g. ["3.1", "3.2", "3.4", "3.7"]) satisfied or
                                  # advanced by this phase — must agree with the
                                  # ROADMAP.md traceability matrix
canon_rules_touched: []           # which of Canon Core rules 1–9 this phase implements
                                  # or must not regress (see CLAUDE.md → Canon rules)
```

## 1. Objective

One paragraph. What capability exists at the end of this phase that did not exist
before, and which checklist items it retires. State the objective in terms of
*verifiable system behaviour*, not activity ("the CP-X job halts a pathway when any
node's `qa_status` is `Blocked`", not "work on orchestration").

## 2. Scope and explicit out-of-scope

Two lists.

- **In scope** — the components, files, and behaviours this phase delivers.
- **Out of scope** — the adjacent things an implementer might be tempted to build now,
  each with the phase where they belong. Anything not listed as in-scope is out of
  scope by default; the out-of-scope list exists to name the *tempting* items
  explicitly.

## 3. Input dependencies (artifacts, not vibes)

A table of concrete artifacts this phase consumes. Every row must be checkable before
work starts — path exists, test passes, schema applied.

| Artifact | Path / location | Produced by | Verified how |
|---|---|---|---|
| e.g. contracts package | `dbx/contracts/` | Phase 1 | `pytest dbx/tests/contracts -q` green |

## 4. Exact file tree

The complete tree of files this phase **creates or modifies**, with a one-line purpose
per file. Use real paths from the repository root. Mark modified-not-created files
with `(mod)`. The implementation model must be able to `mkdir -p` / `touch` this tree
mechanically.

```
dbx/
  <package>/
    <file>.py            # purpose
```

## 5. Interface contracts

Code stubs, schemas, or function signatures for every boundary this phase introduces
or changes. Rules:

- Contracts are **typed** (Python type hints / Pydantic models / SQL DDL / TypeScript
  interfaces / JSON Schema). No prose-only contracts.
- Show the exact signature the caller sees, including error/None semantics.
- Reference the canonical schemas in `dbx/contracts/` rather than restating them; new
  schemas are added there, not inlined into feature code.
- If a contract implements part of the DEPLOY_B canon (envelope fields, six H2s,
  filename rule, payload schemas, severity engine), cite the canon source file and the
  conformance test that pins it.

## 6. Data model changes

DDL for every new/altered table (Lakebase Postgres) or Delta table, including
constraints. Schema changes ship as migration files under `dbx/schemas/migrations/`
with forward migration only (no down-migrations in shared environments). If the phase
has no data-model changes, state "None."

## 7. Tests to write FIRST (TDD)

An enumerated list of test files with the specific behaviours each must cover, written
**before** implementation code. Each entry:

- Test file path.
- Behaviours covered, one line each, phrased as assertions.
- Whether it is unit / property / conformance / parity / integration, and where it
  runs (CI-pure = no cluster, no network; CI-platform = needs a workspace).

Golden-master parity: any phase that ports or re-implements behaviour that exists in
the legacy engine MUST extend the parity harness (`dbx/parity/`) to cover it, and the
parity run must be green before phase sign-off (checklist 9.1).

## 8. Implementation requirements

Ordered, numbered requirements. Each is a single testable statement ("MUST", "MUST
NOT"). Group by component. Every requirement maps to at least one test from §7 —
annotate the test file in parentheses. Requirements that enforce checklist items cite
the native ID (e.g. "fail-closed on missing secret scope — 6.5").

## 9. Done-when criteria (all must hold)

Checkbox list. Minimum set for every phase:

- [ ] All §7 tests green: `<exact command>`
- [ ] Full CI-pure suite green from repo root: `<exact command>`
- [ ] Parity harness green on the frozen corpus (if engine behaviour touched): `<exact command>`
- [ ] `python3 dbx/tools/validate_handoff.py` conformance suite green (if envelope/artifact behaviour touched)
- [ ] Lint/type gates green: `<exact commands>`
- [ ] No new dependency added without an entry in `OPEN-QUESTIONS.md`
- [ ] `DEVIATIONS.md` updated for every intentional divergence introduced this phase
- [ ] Checklist items in the header block demonstrably satisfied, with the evidence
      (test name, config path, or doc) listed next to each ID

Add phase-specific criteria (deployed bundle validates, endpoint responds, a11y check
clean, etc.) with exact commands.

## 10. Forbidden actions

Restate, then extend for the phase:

1. Do not modify spec files (`specs/**`), `roadmap/ROADMAP.md`,
   `architecture/**`, or the frozen parity corpus. If a spec is wrong or ambiguous,
   STOP, log it in `DEVIATIONS.md` or `OPEN-QUESTIONS.md`, and wait for review.
2. Do not add scope from later phases, even if adjacent code makes it easy.
3. Do not add dependencies (Python or JS) without logging name, version, licence, and
   reason in `OPEN-QUESTIONS.md`.
4. Do not call any model-vendor SDK directly (`anthropic`, `openai`, `google-genai`,
   OpenRouter HTTP, etc.). All model calls go through the gateway seam
   (`dbx/gateway/`). (Checklist 3.1 — this is a hard architectural invariant.)
5. Do not weaken, skip, or mock-away a canon gate (fail-closed validation,
   stop-on-Blocked, null≠zero, never-fabricate, model-never-grades-its-own-output) to
   make a test pass.
6. Do not write to `caos/**` (legacy tree) or `Modular OS/**` — they are read-only
   reference and golden-master source.

## 11. Rollback / abort note

One paragraph: what to revert if the phase must be abandoned mid-way, and what state
the repo must be left in (all previous phases' Done-When still green).

---

### Authoring checklist (for the spec author, delete before publishing)

- [ ] Every §5 contract is typed and compilable/parsable as written.
- [ ] Every §8 requirement has a §7 test.
- [ ] Every checklist ID in the header appears in §9 with evidence.
- [ ] No section says "TBD". TBDs live in `OPEN-QUESTIONS.md` with a blocking note here.
- [ ] An implementer with only this repo could execute the phase with zero questions.
