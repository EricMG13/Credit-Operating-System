# Frontend Functional Audit — Playbook

Re-runnable goal-prompt for a Sonnet agent. Run it on every PR that touches
`caos/frontend/` or `caos/tests/frontend/`. You are the auditor: prove the
behaviors below, produce the dated report, and stop. Do not fix findings in
the audit run; do not restyle, refactor, or extend tests beyond what proving a
behavior requires.

## 1. Objective and stakes

Prove that the five CAOS workspaces (Command Center, Pipeline, Deep-Dive,
Model Builder, Report Studio — plus Query, Research, Issuers, Upload,
Settings) render **correct numbers and correct run-state**. The users are
buy-side credit analysts; a misrendered metric, a NaN that survives an
adapter, a stale run silently presented as live, or a broken cross-pane
selection corrupts an investment read with money behind it. Silent wrongness
is the failure mode this audit exists to catch — a crash is a lesser bug than
a plausible wrong number.

In scope: functional correctness of components, hooks, adapters, run-state
sync, and end-to-end journeys. Out of scope: visual polish (`/impeccable`),
accessibility (`node caos/frontend/scripts/a11y-axe.mjs` is the a11y
harness), backend engine math (REVIEW_MATRIX_BACKEND.md), performance.

## 2. Scope discovery

Run these fresh every audit — never trust counts or lists written in this
file. All paths relative to repo root; frontend commands run from
`caos/frontend/`.

```bash
# Routes (Next.js app dir — one page.tsx per route)
find caos/frontend/src/app -name "page.tsx" | sort

# Component and lib surface
ls caos/frontend/src/components caos/frontend/src/lib

# Engine hooks and adapters (the live-data seam)
ls caos/frontend/src/lib/engine

# Vitest suites
find caos/frontend/src -name "*.test.*" | sort

# Playwright e2e specs
ls caos/tests/frontend/e2e/*.spec.ts

# What this PR actually changed (origin/main, never local main — it goes stale)
git diff --stat origin/main... -- caos/frontend caos/tests/frontend
```

Snapshot at authoring (2026-07-10): 15 routes, ~80 vitest files, 9 e2e specs.
If discovery finds a route, hook, or data-backed view with no test file and no
e2e coverage, that gap is itself a finding. Weight effort toward the PR diff,
but the full suite always runs (§4).

## 3. Coverage checklist — behaviors to prove

### A. Component contracts

- Every data-backed component renders the value it was given — no silent
  reformat that changes magnitude, sign, or unit. Numeric formatting goes
  through `src/lib/format.ts` / `src/lib/model/` formatters; a component
  hand-rolling number formatting is a finding.
- Prop/state contracts hold under the shapes the API layer actually emits
  (`src/lib/api.ts` DTOs), including optional/null fields — not just the
  happy fixture.
- The structural guard `src/no-alpha-concat.test.ts` passes: no source file
  concatenates a 2-hex alpha suffix onto a color (invalid CSS on `var(--…)`,
  silently dropped). New color math uses `color-mix(in srgb, X N%, transparent)`.
- State restored from persistence (model save/restore, query history,
  research prefs, layout prefs) round-trips exactly; the existing race suites
  (`model-restore-race.test.tsx`, `history-restore.test.tsx`) stay green.

### B. Engine hooks and numeric edges (`src/lib/engine/`)

The seam contract is **"prefer live, static fallback"**. Prove, for
`useLiveRun`, `useModelEngine`, `usePortfolio`, `useLatestRun`:

- **Read-only**: no hook ever creates a run or issues a mutating request.
  Any POST from these hooks is a critical finding.
- **Fail-open**: no backend, no run, or any thrown error returns the empty
  shape and the UI falls back to seeded constants — never a crash, never a
  half-populated live view.
- **Error ≠ empty**: `RunPhase` (`loading | error | none | in_flight |
  complete`, `useLatestRun.ts`) distinguishes a backend error from genuinely
  empty coverage. A view that collapses both into the same silent empty state
  is a finding.
- **Adapters reject garbage**: `modelAnchor.ts`, `downsidePathway.ts`,
  `adapt.ts` return `null` (or skip the section) on missing, non-finite, or
  degraded payloads — `finiteNumber` gates every number. Prove with NaN,
  ±Infinity, string-typed numerics, empty `scenarios`, and missing fields:
  nothing non-finite reaches a render.
- **Partial-run resilience**: a module absent from a run is skipped (static
  fallback for that tab only); an absent/Blocked CP-2B never rejects the pair
  and drops the CP-1 anchor (`useModelEngine` catch).
- **Downside/anchor math**: `cp1ToAnchor` and `cp2bToDownside` outputs match
  the engine payload arithmetically (stressed leverage/coverage at 10/20/30%
  declines, shock-to-breach, fragility band) — spot-check against a live run's
  raw module JSON, not just the vitest fixtures.

### C. Live run-state and Evidence Sync

- A completed live run's output actually overlays the seeded demo on
  Deep-Dive and Model Builder (the `live` flag flips, values change), and a
  subsequent run for a *different* issuer never bleeds into the current view.
- Live evidence chips resolve against **the run's own evidence map**
  (`LiveEvidence` in `useLiveRun.ts`), never the seeded demo map — the known
  defect class is a live `E-103` colliding with the demo `E-103` and showing
  another issuer's source as VERIFIED.
- Evidence Sync (`src/lib/evidence-sync.tsx`): hovering or focusing any
  `E-xx` chip highlights every other chip with that id and every CP-5B source
  driver citing it, across panes; pages without the provider stay inert (no
  crash, no-op setter); the interaction is keyboard-operable.
- Run-state transitions render truthfully: `in_flight` shows as running,
  a terminal run stops polling, `committeeStatus` (e.g. Restricted/Blocked)
  is surfaced, not swallowed.

### D. Loading / empty / error states

For **every** data-backed view found in §2 (walk the route list): prove the
loading state resolves (no infinite spinner), the empty state is honest
("no coverage" when `phase: none`), and a backend error surfaces visibly
(`phase: error` → banner/notice, not a blank board). `error-surfaces.test.tsx`
is the existing pattern — extend the same proof to any new view in the diff.

### E. End-to-end journeys (Playwright)

The nine specs in `caos/tests/frontend/e2e/` map to the user journeys; all
must pass against a real stack:

login (register + both error paths) · bootstrap (create issuer → trigger run →
poll terminal → output surfaces in UI) · upload/ingest · deep-dive · model
build · query · research (flow + full run) · settings.

A journey that exists in the product but has no spec is a coverage finding
(list it; do not silently write one mid-audit).

## 4. Procedure

All from `caos/frontend/` unless noted. Engine and e2e run **keyless**
(deterministic demo-fallback) — unset `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY`
for reproducibility.

```bash
# 1. Static gates
npm run lint
npx tsc --noEmit

# 2. Unit + component — ALWAYS the full suite, never only changed files:
#    shared-state / module-order flakes only reproduce in the full run
npm run test                      # = vitest run
npx vitest run src/lib/engine     # targeted re-run while investigating
npm run test:coverage             # emits coverage/coverage-final.json

# 3. E2E stack: FastAPI serves API + the static frontend export on one port
npm run build                     # Next static export → out/
cd ../server && .venv311/bin/python run.py   # :8000 (or .venv/bin/python)
cd ../frontend && npm run test:e2e           # = playwright test
npm run test:e2e -- login_flow               # single spec while investigating
```

To keep the user's dev stack (`:8000`, default DB) untouched, run e2e against
an isolated stack: start the server with `PORT=8010`, a throwaway
`DATABASE_URL` (SQLite file, see `caos/server/config.py` header) and a fixed
`SESSION_SECRET`, then point Playwright at it with
`PLAYWRIGHT_BASE_URL=http://localhost:8010 npm run test:e2e`.

Auth: `global-setup.ts` logs in **once** (`POST /api/auth/profile`, code
`E2E_ACCESS_CODE`, default `131113`) and persists `storageState` to
`.auth/state.json` for every spec. Never add per-test logins — the login rate
limit (10/min/IP) will 429 the suite.

Flake protocol: `retries: 1` is configured. A test that fails then passes on
retry is **not** a pass — it is a finding to verify under §5, with its trace
(`trace: on-first-retry`) attached.

## 5. Evidence and reporting

Write `caos/docs/qa/reports/frontend-functional-YYYY-MM-DD.md` (create the
directory if absent). Structure:

1. **Verdict table** — one row per §3 domain (A–E): PASS / FAIL / DEGRADED,
   with the command output that proves it (test counts, not adjectives).
2. **Findings** — `FF-<n>`, severity (CRITICAL: wrong number or corrupted
   state rendered · HIGH: contract/guard broken · MED · LOW), `file:line`,
   the §3 behavior violated, minimal repro, evidence (test output, trace zip
   path under `test-results/`, or run JSON).
3. **Coverage gaps** — routes/hooks/journeys found in §2 with no proof.
4. **Register deltas** — anything in §6 observed to have changed status.

Gates (any ⇒ overall FAIL): a vitest failure; an e2e failure after retry; the
no-alpha-concat guard failing; a NaN/`undefined`/`Infinity` rendered in any
numeric surface; an engine hook issuing a mutation; live data resolving
against the seeded evidence map.

**Adversarial verification** — mandatory before reporting any flaky or
state-corruption finding, because these get expensive attention: reproduce it
3× from a clean state (fresh `out/` build, no orphan server on the port, no
stale `.next/dev/lock`); rule out the harness (Node localStorage polyfill in
`vitest.setup.ts`, module-order dependence — re-run the single file *and* the
full suite); check `git log` for a recent fix already landed; attach the
Playwright trace or failing seed. Report it CONFIRMED only when it survives
all of that; otherwise report it as UNREPRODUCED with what you tried.

## 6. Accepted-risk register

Known seams. **Do not report these as findings.** Remove an entry only with
maintainer sign-off; do report a register entry whose behavior has drifted
from what is described here.

| Seam | Status | Why accepted |
|---|---|---|
| Command Center / Monitor boards | Seeded mock; autonomy DAG exists backend-side but frontend is unwired | Phase-2 wiring; `usePortfolio` overlay is the only live element |
| Pipeline Visualizer | Timer-driven simulation (`lib/pipeline/sim.ts`), not live orchestrator telemetry | Demo by design; live pipeline is `useLivePipeline` |
| Deep-Dive seeded module outputs + demo evidence map | Static fallback content | "Prefer live, static fallback" is the product contract offline |
| Reference deal bespoke tabs (CP-6A/6E, CP-3B, CP-4) | Keep showcase renderers even when live output exists | Non-reference issuers use the generic live `ModuleView` |
| CP-2B downside | Surfaces as a separate ScenarioPanel readout, not grid DOWN columns | Payload shape (segmented P&L) mismatches leverage-shock grid points — by design |
| Market-spread RV | Static sample spreads | Phase-2 (Bloomberg) |
| Login e2e `/api/auth/me` stub | Spec stubs `/me → 401` to defeat the dev auto-identity | Single-process dev server auto-identifies; mutations hit the real backend |
| Node ≥25 localStorage | In-memory polyfill in `vitest.setup.ts` | Node bug workaround; not app behavior |
