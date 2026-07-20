# CAOS — Feature → User-Story Sweep (2026-06-25)

> **2026-07-20 release-coverage update:** this remains a historical June sweep.
> The 2026-07-19 quality seal now maps 683 canonical features, 4,917 cases,
> 4,638 executed automation nodes, 710 controls, 173 AST handler rows, and 17
> processes; its browser set records 165 passing nodes across 14 specs without
> retry. Production files in `f4c790f4` are newer, five routed concepts still
> lack dedicated E2E, and 1,207 scenarios remain Designed. Use
> [APPLICATION_SURFACE_MATRIX_2026-07-20.csv](APPLICATION_SURFACE_MATRIX_2026-07-20.csv),
> L23/L27, and
> [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md)
> for current release coverage.

> **2026-07-18 reconciliation — historical baseline:** this is a historical sweep of the application
> as it existed in June, not proof of every current feature. The canonical CSV
> has since grown to 355 historical Pass rows, while the production export now
> has 18 page endpoints and newer Portfolio Lab, Decisions/IC Book, Sponsors,
> RV, analysis-context, and recovery flows that are not all represented by
> dedicated current rows. That reconciliation used
> [APPLICATION_SURFACE_MATRIX_2026-07-18.csv](APPLICATION_SURFACE_MATRIX_2026-07-18.csv),
> L23/L27, and
> [PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](reports/PRE_DEPLOYMENT_CLOSURE_2026-07-18.md)
> for release coverage. The current three-browser inventory is 125 passed / 15
> failed / 1 flaky, so the historical “every feature” language below is scoped
> to that dated run only.

End-to-end pass over **every feature then inventoried**: each was turned into a user
story with code-derived expected behaviour, tracked in one canonical sheet,
tested on a live isolated stack, and the UX defects found were fixed and
re-tested.

- **Canonical tracker:** [`FEATURE_TRACKER.csv`](FEATURE_TRACKER.csv) — **302**
  stories (291 first sweep + 8 post-sweep features + 3 endpoint-inventory finds,
  added 2026-06-26), one row each: `id, concept, feature, story, expected,
  trigger, files, endpoint, status, test_result, severity, notes`.
- **Source of truth for the rows:** [`FEATURE_ROWS_1..4.txt`](.) (raw blocks) →
  [`build_tracker.py`](build_tracker.py) (→ CSV) →
  [`apply_test_results.py`](apply_test_results.py) (stamps test verdicts).
  Re-run both scripts to regenerate the CSV.

## Coverage (302 stories across 12 concept areas)

| Concept | Stories | Concept | Stories |
|---|--:|---|--:|
| Command Center | 47 | Research | 27 |
| Pipeline | 45 | Upload | 27 |
| Model Builder | 42 | Query | 14 |
| Deep-Dive | 33 | Auth | 15 |
| Report Studio | 27 | Shell (nav/identity/evidence-sync) | 13 |
| Monitor | 7 | Settings | 5 |

## Test environment

Isolated QA stack (leaves the user's `:8000`/`caos.db` untouched):

- **Backend** `:8010` — `caos_qa.db`, fixed `SESSION_SECRET`, `ANTHROPIC_API_KEY=`
  (offline/demo), `EDGAR_USER_AGENT=` / `VAULT_EXPORT_DIR=` empty (503 paths),
  demo seed on. Launch config `qa-backend` in `.claude/launch.json`.
- **Frontend** `:3010` — `qa-frontend` config, proxies `/api` → `:8010`.
- Backend suite: `caos/server/.venv/bin/python -m pytest caos/tests/server`.

## Method

1. **Backend** — full pytest suite + direct endpoint smoke (auth, issuers, runs,
   query, scenario, research, chat, edgar) against `:8010`.
2. **Frontend** — drove a headless browser through all 13 routes: each route
   loaded, console checked for errors, key interactions exercised, network
   checked for 4xx/5xx.

## Results

- **Backend:** `360 passed, 2 skipped` (offline). Re-run post-fix: identical.
- **Frontend:** all 13 routes load with **0 console errors** and **0 failed API
  calls** (only the benign root→`/issuers` redirect abort). Interactions verified
  per concept: login/logout round-trip; cross-issuer NL query (interpretation +
  ranked table); pipeline live CP-X graph (node select, swimlanes); deep-dive
  evidence modal, layout toggle, CP-4 covenants, issuer Q&A chat; model live
  CP-1 tie-out (5.68×) + scenario preset; report deliverable select + watermark;
  monitor live email stream; research durable job → demo report; query capability
  graph (31 nodes); upload wizard + **create-issuer write (37→38 persisted)** +
  EDGAR 503 banner; directory search.

### Findings (3, all Low) — fixed / dispositioned

| # | Severity | Story | Issue | Disposition |
|---|---|---|---|---|
| **F1** | Low (a11y) | `shell-05` | `/upload` rendered a **second** "Skip to content" link on top of the global one in `layout.tsx` (both → `#main-content`) — orphaned after the `<main>` landmark moved to the root layout. | **FIXED** — removed the page-local skip link (`upload/page.tsx`). Verified: `/upload` now has exactly 1 skip link. |
| **F2** | Low (UX) | `shell-06` | Global `✦ Ask ⌘K` launcher floated over the unauthenticated **login** screen (rendered in the root layout, outside `RequireAuth`). | **FIXED** — `AskLauncher` returns `null` when no signed-in profile (`useAuth: !user \|\| needsLogin`). Verified hidden pre-auth; present + ⌘K modal opens post-auth; deep-dive / model chat unaffected. |
| **F3** | Low (by-design) | `model-21` | Offline `scenario/nl` heuristic stacks multiple phrase matches (e.g. `oil … compress 200bps` → margin −5.5pp). | **By-design** — demo fallback only; live LLM path unaffected. Documented, not changed. |

### Fixes (frontend, 2 files)

- `caos/frontend/src/app/upload/page.tsx` — drop the duplicate skip link.
- `caos/frontend/src/components/shared/Ask.tsx` — gate `AskLauncher` on a
  signed-in profile.

`tsc --noEmit` ✓ · `eslint` (changed files) ✓ · post-fix re-test ✓.

## Adversarial verification pass (workflow `caos-userstory-verify`)

A second, exhaustive pass re-checked **every** story (not a sample): 12 concept
verifiers re-derived each row's behaviour from the actual code and exercised every
backend endpoint against the live `:8010` stack; then a skeptic agent tried to
**refute** each flag (default = not-a-defect) so only real issues survive.

**7 findings upheld, all Low** — 6 were tracker/doc corrections, 1 a real code fix:

| Story | Type | Resolution |
|---|---|---|
| `command-25/26/27/28` | stale dupes | CP-MON Email tiles / list / detail-modal / alert-feed were **relocated to the Monitor concept** (IA restructure) and duplicate `monitor-01..04`. **Deleted** from the tracker (295→291). |
| `command-18` | doc | NL structured-results table is **pre-ranked server-side** (`rank_by`/`direction`); headers are *not* click-to-sort. `expected` corrected. |
| `command-19` | doc | Semantic result cards are **static**, not collapsible. `expected` corrected. |
| `command-34` | **code (UX)** | **FIXED** — `GapsList` ([views.tsx:392](../../frontend/src/components/command/views.tsx)) rendered the Source-Gaps array in raw order, contradicting the documented "ordered by severity"; it now sorts severity→recency (worst-first, like the QA-queue / alert-feed). Verified: QLMH (high) → BLHP (med, Jun 07) → ATLF (med, Jun 04) → ATLF (low). |

No correctness/security/data defects surfaced. Static layer, whole-repo:
`pytest` 360/2 · `tsc` ✓ · `eslint src` ✓ · `ruff` ✓ · **axe-core WCAG 0 violations × 12 routes**.

## Iteration 2 — post-sweep feature delta (2026-06-26)

Four commits landed after the first sweep (`1324352`); a recursive discovery pass
found **8 user-facing features with no tracker row**. All were added (291→299),
each tied to its backing test:

| ID | Concept | Feature | Backing test |
|---|---|---|---|
| `shell-10` | Shell | Per-route error boundary (`error.tsx`) | `src/app/error-surfaces.test.tsx` (new) |
| `shell-11` | Shell | Root error boundary (`global-error.tsx`) | `src/app/error-surfaces.test.tsx` (new) |
| `shell-12` | Shell | Custom 404 (`not-found.tsx`) | `src/app/error-surfaces.test.tsx` (new) |
| `upload-26` | Upload | Optional ClamAV malware scan | `test_avscan.py` (8) |
| `auth-12` | Auth | Logout revokes all sessions (token_version bump) | `test_token_revocation.py` |
| `auth-13` | Auth | Token-version revocation enforcement | `test_identity.py::test_revoked_token_version_rejected` |
| `auth-14` | Auth | Self-service GDPR erase (`DELETE /api/auth/profile`) | `test_gdpr_erase.py` |
| `auth-15` | Auth | Operator GDPR erase CLI (`erase_analyst.py`) | `test_gdpr_erase.py::test_erase_by_email_resolves_id_then_erases` |

The three error surfaces had **no test** — added the smallest render check
(`error-surfaces.test.tsx`, static server-render, asserts role/copy/recovery
action for each). The other five already shipped with dev-written backend tests;
this pass confirmed each covers the documented behaviour and stamped the verdict.

**Regression:** `pytest` 377/2 · `vitest` 197/25 files · `tsc` ✓ · `eslint` ✓.
No defects found this iteration; all 299 stories **Pass**.

## Iteration 3 — endpoint-inventory discovery (2026-06-26)

Re-entered the loop with a stricter discovery method: enumerated **every FastAPI
route decorator** (prefix + path) and diffed against the tracker's `endpoint`
column. Two camelCase false positives aside, **3 endpoints had no story** (299→302):

| ID | Concept | Endpoint | Backing test |
|---|---|---|---|
| `query-14` | Query | `GET /api/query/catalog` (metric dictionary) | `test_nlquery.py::test_catalog_endpoint` |
| `upload-27` | Upload | `GET /api/edgar/filings/{cik}` (issuer filings) | `test_edgar.py` (**new** — 3 cases) |
| `shell-13` | Shell | `GET /api/health` (readiness probe) | `test_api.py::test_health` |

`GET /api/edgar/filings/{cik}` had **no test** — added 3 (503 without UA; returns
pointer hits + forwards forms/limit; rejects limit 0/101 → 422). Catalog and health
were already covered; documented + stamped.

**Convergence check:** re-ran the route↔tracker diff → **0 undocumented endpoints**
(29 unique routes, all mapped). Frontend pages (12) and CLI modules
(`erase_analyst`) also fully covered.

**Regression:** `pytest` **380/2** · `vitest` 197/25 files · `tsc` ✓ · `eslint` ✓.
No defects; all 302 stories **Pass**.

## Phase-6 exit criteria — status (end of Iteration 3)

| Criterion | Status |
|---|---|
| No undiscovered features | ✅ route↔tracker diff = 0; pages + CLI mapped |
| No failing tests | ✅ backend 380/2, frontend 197/25 |
| No critical defects | ✅ none open |
| No high-severity defects | ✅ none open |
| No unresolved UX issues | ✅ prior 3 Low all fixed/dispositioned; none new |
| No incomplete user journeys | ✅ all concept journeys exercised in sweeps 1–3 |

All six hold → the recursive loop has reached a fixed point for the current tree.

## Verdict

The app is in strong shape — consistent with the six prior QA sessions in
[`QA_FULL_SWEEP.md`](../QA_FULL_SWEEP.md) having already cleared the substantive
trust/correctness bugs. Across the live route walk **and** the adversarial
all-stories pass, every finding was Low severity. Code fixes made and re-verified:
**3** — F1 duplicate skip link (`/upload`), F2 Ask launcher over the login screen,
command-34 Source-Gaps severity ordering. The rest were doc corrections (stale
concept attribution after the Monitor IA restructure; two over-stated `expected`
clauses) or one intentional offline-demo behaviour (F3). All 291 stories: **Pass**.
