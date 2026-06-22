# CAOS — Full QA Sweep

Goal: build sanitized production-scale local data under production-like settings;
inventory every user-facing feature/route/control/state/workflow with acceptance
criteria + risk-based edge cases; test as a real user; log bugs with repro; fix by
shared cause with regression tests; rerun to a clean pass or blocked handoff.

Started 2026-06-22. Branch `fix/vmo2-followups`.

## Test environment

- **Backend**: FastAPI on :8000 (`caos/server/run.py`). Prod-like gating via env.
- **Frontend**: `next dev` on :3000 (proxies `/api` → :8000). Prod serves the
  static export from FastAPI directly (no proxy) — slash behaviour differs, see
  BUG-001.
- **QA database**: a *separate* `caos/server/data/caos_qa.db` (DATABASE_URL).
  The existing `caos.db` is the user's parallel WIP (VMO2/ATLF validation, plus
  E2E test pollution) and is **not** touched.
- **Seed**: demo issuers + ATLF reference deal (CAOS_DEMO_SEED) + a scale-seeder
  for ~30 sanitized HY issuers (`scripts/seed_qa_scale.py`), plus real runs
  triggered through the API so run-dependent views render authentic data.

## Routes (Next.js app)

| Route | Concept | Primary data path |
|-------|---------|-------------------|
| `/` → `/issuers` | Issuer Directory | `GET /api/issuers/`, `POST /api/issuers/` |
| `/command` | Command Center | mock `PORTFOLIO` + ? |
| `/pipeline` | Pipeline / Execution Graph | runs |
| `/deepdive` | Deep-Dive | run modules |
| `/model` | Model Builder | scenario |
| `/reports` | Report Studio | run report/export |
| `/monitor` | Monitor | runs/QA |
| `/research` | Deep Research | `POST /api/research` |
| `/query` | Cross-issuer NL query / graph | query endpoints |
| `/upload` | Document upload | ingestion endpoints |
| `/settings` | Workspace settings | `GET /api/settings` |

## Bug log

Severity: **S1** blocker/data-integrity · **S2** broken feature · **S3** degraded UX · **S4** polish/finding.

### BUG-001 — `/api/issuers/` 404s through `next dev`; UI silently shows mock issuers — S2
- **Repro**: `curl localhost:3000/api/issuers/` → 404. Direct `curl localhost:8000/api/issuers/` → 200. The dev proxy strips the trailing slash → backend `/api/issuers` (no slash) → catch-all 404.
- **Root cause (shared)**: inconsistent trailing-slash convention on root collection routes. `issuers` is registered `@router.get("/")` (needs slash); `runs`/`research`/`settings` use `""` (no slash). The `/api/{path:path}` catch-all in `main.py` shadows FastAPI's `redirect_slashes`, so a slash mismatch is a hard 404 instead of a 307. The dev proxy strips trailing slashes, so the lone slash-requiring route is unreachable in dev.
- **Masking**: `issuers/page.tsx` falls back to the demo `PORTFOLIO` universe on *any* fetch failure (not just empty registry), so the 404 is invisible — the directory shows 10 fabricated "US HY sleeve" issuers instead of the real registry. On a "trust through transparency" platform, silently presenting fabricated issuers on a *failed* fetch is itself a concern (BUG-002).
- **Prod impact**: prod serves FastAPI directly (no proxy), so `/api/issuers/` works in prod today. Dev-only data-path break, but it blocks all QA-in-dev against real data.
- **Fix (DONE)**: dual-registered the issuers collection routes to accept both `""` and `/` (slash-tolerant) in `routes/issuers.py`, so the proxy-stripped path resolves. Regression test `test_issuers_collection_slash_tolerant` added in `tests/server/test_api.py`. Verified live: `/api/issuers` (no slash) → 200 direct and through the dev proxy; directory renders 34 real issuers.

## QA environment status (live)

- QA DB `data/caos_qa.db` + vault `data/vault_qa`, `ANTHROPIC_API_KEY` unset →
  engine takes its **deterministic** path (demo-fallback): reproducible runs, no
  token spend, real ModuleOutputs/QA/claims. council/debate off.
- **34 issuers** (4 fixture: Acme/Aurora/Meridian/ATLF + 30 sanitized HY via
  `scripts/seed_qa_scale.py`) across **31 sectors**; docs+chunks + 8 headline
  metric_facts each.
- **3 completed runs** (ATLF, GPHC, SVBC), 23 modules each, QA "Restricted".

### BUG-002 — silent demo fallback masks API failures (transparency) — S3 — FIXED
- `issuers/page.tsx` `.catch(() => setIssuers(demoFiltered()))` showed fabricated issuers indistinguishably from real coverage on fetch error.
- **Fix (DONE)**: added a `degraded` flag set only on the *catch* path (distinct from an empty registry). When degraded, a `role="alert"` banner — *"Couldn't reach the registry — showing demo coverage, not live data"* — renders above the table with a **RETRY** that re-runs the fetch (`reloadKey`). Empty-registry still shows the demo nudge silently (that's a real, honest state). Verified end-to-end: killed the backend → banner appears with demo coverage; restarted + refetch → banner clears, 35 live rows return. No fabricated rows are presented as real coverage anymore.

### BUG-003 — directory row click drops the issuer id; Deep-Dive is ATLF-pinned — S3 — FIXED
- **Repro (before)**: click any directory row → `router.push("/deepdive")` with **no issuer id**; Deep-Dive always loaded the ATLF reference run. Clicking issuer X showed issuer Y's analysis.
- **Fix (DONE)** — honest, minimal wiring (the bespoke debate/recovery/covenant tabs + DEAL narrative are ATLF-only fixtures, so full per-issuer rendering is a redesign, out of scope):
  - `issuers/page.tsx` — row click/keydown now pass `?issuer=<id>`.
  - `api.ts` — added `getIssuer(id)` (`GET /api/issuers/{id}`).
  - `deepdive/page.tsx` — resolves `?issuer=` (default = ATLF reference when absent), keys `useLiveRun(issuerId)` to it, fetches the issuer's name/ticker for the chrome, swaps the hardcoded `ATLF` chip + deal title + `ASK ATLF` to the resolved issuer, defaults a non-reference issuer to the **live CP-1** tab (not the ATLF CP-6A debate), and renders a `warning` caveat: *"live engine output · bespoke tabs show the ATLF reference template"*.
  - Verified: directory → `/deepdive?issuer=…`; GPHC shows "Granite Peak Healthcare / GPHC / ● LIVE / ASK GPHC" + caveat + live CP-1; the ATLF default (no param) is byte-for-byte unchanged (ASK ATLF, "2L TL '31", RUN #2641). tsc clean, 127 vitest pass.

### OBS-003 — offline deterministic runs project reference-fixture financials for every issuer — S4
- A live run on GPHC returns CP-1 numbers **identical** to ATLF (revenue 2410/2588/2742/2801, adj_ebitda 358/392/415/421). In demo-fallback/offline mode the engine projects the reference-deal fixture, not the issuer's seeded metrics/docs — the documented "mock vs engine" reality. With a real LLM + uploaded docs, CP-1 would extract issuer-specific financials. The BUG-003 caveat covers the bespoke tabs; this OBS records that even the "live" generic-module numbers are reference-derived offline. Not a regression; surfaced by issuer-scoped Deep-Dive.

### OBS-001 — venv has fastapi 0.115.14, repo pinned 0.138 (CVE fix 8c11066) — S4
- The server `.venv` was not reinstalled after the starlette-CVE bump. Runtime boots fine on 0.115 but the deployed image (built from requirements) will differ from local. Reinstall venv from `server/requirements.txt` before trusting local security posture.

### OBS-002 — Ask/NL leverage ranking shows "10 issuers ranked" against a 34-issuer store — S4
- The cross-issuer leverage ranking reported "10 issuers ranked · 1/10 cited" with a 34-issuer registry. Likely a top-N display cap (sensible), but the median is then computed over the displayed subset and "10 issuers ranked" reads as the full population. Verify whether the rank/median is over the full universe or a top-N/portfolio subset; if a cap, label it "top 10 of N".

## Inventory · acceptance criteria · edge cases (tested as a real user)

Legend: ✅ verified pass · ⚠ finding logged above · ▢ structural-only (rendered clean, deep interaction not exercised).

| Concept / control | Acceptance criterion | Result | Risk-based edge cases checked |
|---|---|---|---|
| Issuer Directory · list | Renders the real registry from `/api/issuers/` | ✅ 34 real issuers (post BUG-001 fix) | fetch failure → honest degraded banner + retry (BUG-002 fixed); empty registry → demo nudge |
| · search | Debounced server search across name/ticker/industry/country/FIGI | ✅ "aurora"→1, "chem"→2 (name+industry), gibberish→empty state, clear→34 | rapid keystrokes (debounce race — harness only), blank/whitespace `q` |
| · New Issuer modal | Required-name validation; POST 201; appears in registry; redirect to pipeline | ✅ created + persisted + redirected | double-submit guarded (`creating`); error surfaced via `role=alert` (code) |
| · row click | Opens that issuer's Deep-Dive | ✅ passes `?issuer=`; Deep-Dive scoped to issuer (BUG-003 fixed) | offline runs share reference financials (OBS-003) |
| Upload | Issuer-scoped; run-mode selector (R-IC/ER/RV/LG); file input; EDGAR import | ▢ renders correct, scoped to issuer | EDGAR 503s without `EDGAR_USER_AGENT` (expected gate) |
| Deep-Dive | Live-wired to a run's modules/QA; evidence rails; debate; export-to-vault | ✅ loaded ATLF run modules CP-0/1/5/5B + qa; **vault export wrote 2 notes (200)** | export with no run / no vault dir → documented 503 path |
| Pipeline | Execution graph + trace + module inspector + lineage render | ▢ renders clean (CP-X plan, CP-5B lineage) | user WIP files (`views.tsx`,`GraphCanvas.tsx`) — covered by passing vitest |
| Model Builder | Driver inputs recompute scenario/sensitivity outputs | ✅ changing a driver recomputed outputs (76 inputs reactive) | — |
| Report Studio | Committee deliverables / compose / export / lineage render | ▢ renders clean | committee-export gate (409 unless Committee Ready) — in code |
| Monitor | Email intelligence / alert routing render | ▢ renders clean | — |
| Research | Brief form + report; `POST /api/research` (demo without key) | ▢ form renders | long-running call has no client timeout (by design) |
| Query (cross-issuer) | NL → grounded graph/ranking over the metric store | ✅ energy-exposure graph surfaces chemicals/energy issuers w/ provenance disclaimer | capability rail correctly greys un-runnable edges (needs ≥2 runs / no sponsor data) |
| Ask ⌘K (global) | Grounded cross-issuer answer, provenance-tagged | ✅ leverage ranking (Beacon 7.38x), SEEDED vs cited labels | OBS-002 ranking count |
| Settings | Research defaults (browser) + workspace config (env, read-only) | ▢ renders both panels | — |
| Runs (engine) | POST queues; executor completes; 23 modules + QA | ✅ 4 runs complete (ATLF/GPHC/SVBC/empty-issuer) | **empty issuer (no docs/metrics) → completes gracefully, 0 unhandled exceptions** ✅ |
| API surface | No 4xx/5xx on normal navigation | ✅ access-log scan: zero 4xx/5xx across the full walk | trailing-slash class fixed (BUG-001) |

## Verdict

**Clean functional pass with documented handoff items.**

- All 11 routes render with **no crashes and no console errors**; full server suite **311 passed / 2 skipped** (incl. new regression test); frontend **127 passed**.
- **Three bugs fixed**: BUG-001 (routing/data-path, server regression test), BUG-002 (silent demo fallback → honest degraded banner + retry), BUG-003 (issuer-scoped Deep-Dive wiring). Engine is robust under the empty-issuer edge.
- Residual items are **product/triage decisions, not blocking defects**: OBS-001 (reinstall venv for CVE pin), OBS-002 (ranking "10 of N" label), OBS-003 (offline runs share reference-fixture financials — engine-mode characteristic).

### What was changed (Claude)
- `server/routes/issuers.py` — dual-register collection routes (slash-tolerant) [BUG-001]
- `tests/server/test_api.py` — `test_issuers_collection_slash_tolerant` regression test
- `frontend/src/app/issuers/page.tsx` — pass `?issuer=` on row activate [BUG-003]; degraded banner + retry [BUG-002]
- `frontend/src/app/deepdive/page.tsx` — resolve `?issuer=`, issuer-scoped live run + chrome + reference-template caveat [BUG-003]
- `frontend/src/lib/api.ts` — `getIssuer(id)` wrapper [BUG-003]
- `scripts/seed_qa_scale.py` — sanitized production-scale QA seeder (new)
- `docs/QA_FULL_SWEEP.md` — this report (new)

Gates green after all fixes: server **311 passed / 2 skipped**, frontend **tsc clean · 127 vitest passed**, no console errors across the route walk.

### Untouched (user's parallel WIP — flagged, not modified)
- `frontend/src/app/globals.css`, `frontend/src/components/pipeline/views.tsx`, `frontend/src/components/query/GraphCanvas.tsx`

---

## Session 2 (2026-06-22) — trust-boundary fix cluster

Picked up the goal's "implement coherent fixes with regression tests" step against the
actionable findings logged in [audit-log.md](../../audit-log.md) /
[audit-backlog.md](../../audit-backlog.md). One **shared cause** ties three of them:
*untrusted LLM/web output reaches a trust-bearing surface without enough validation.*
Fixed as a cluster, each with a regression test. All **backend-only** — they don't alter
the deterministic QA render path (these paths fire only on the live LLM / web-search lane),
so the live route-walk verdict above is unchanged; the server suite (which boots `main.app`)
is the regression proof.

### FIX-A — scenario NaN/±Inf bypasses the driver clamp → poisons the projection — S3
- **Cause** (audit #13): `validate_scenario`'s `max(lo, min(hi, x))` doesn't bound non-finite
  floats — `json.loads`/pydantic admit `NaN`/`Infinity`, and `NaN` defeats comparison-based
  clamping, so a non-finite delta passes through and renders `NaN` in the Model Builder.
- **Fix**: coerce `x` to `0.0` when `not math.isfinite(x)` before clamping
  ([server/scenario.py](../server/scenario.py)). A scenario of only non-finite deltas then
  correctly collapses to a no-op (`ScenarioError`).
- **Test**: `test_validate_drops_nonfinite_deltas` ([tests/server/test_scenario.py](../tests/server/test_scenario.py)).

### FIX-B — `safe_chunk_id` silently presents a substituted/absent source as "Directly Sourced / High" — S3 (trust)
- **Cause** (audit-backlog): the helper returned a bare id, falling back to the top BM25 hit
  on a fabricated **or null/absent** id. Callers stamped that id as `lineage_class="Directly
  Sourced" / confidence="High"` unconditionally — so a model that *declined* to cite (null)
  got a concrete high-confidence citation of a chunk it never asserted. Inverts design
  principle #3 ("show your work"); LLM-path-only but medium-on-trust.
- **Fix**: `safe_chunk_id` now returns `(chunk_id, exact)` — `exact=True` only when the model
  pinned a real retrieved chunk ([server/engine/llm_safety.py](../server/engine/llm_safety.py)).
  CP-1 add-back (`E-ADJ1`) and CP-4C covenant (`E-CAP1`/`E-CAP2`) citations downgrade to
  `Inferred / Medium` when `exact=False`, keeping the (substituted) chunk only for navigation
  ([server/engine/adjusted.py](../server/engine/adjusted.py),
  [server/engine/covenants.py](../server/engine/covenants.py)). Deterministic extractors pair
  each figure with its exact regex-matched chunk → always `exact=True`.
- **Tests**: `test_safe_chunk_id_rejects_fabricated_ids` (null/empty/fabricated → `exact=False`)
  + `test_inexact_chunk_id_downgrades_citation` (end-to-end CP-4C citation downgrade).

### FIX-C — Deep-Research source URL → `javascript:` / `data:` click-to-exec — S2 (security)
- **Cause** (audit-backlog): a web-search source URL flows untouched to a clickable `href`
  in the Report pane; CSP runs `script-src 'unsafe-inline'`, so a poisoned `javascript:` source
  would execute on click. The href bypasses react-markdown's URL sanitizer (hand-rolled JSX).
- **Fix**: validate the scheme at the single choke point where the URL enters —
  `_collect_sources` drops anything not `http(s)://` ([server/deepresearch.py](../server/deepresearch.py)).
  Server-side, so it protects every consumer of `Source.url`, not just `ReportPane.tsx` (no
  frontend edit needed → user's frontend WIP untouched).
- **Test**: `test_collect_sources_drops_non_http_schemes` (javascript:/data:/leading-space dropped).

### Gates (Session 2)
- Server suite **314 passed / 2 skipped** (was 311; +3 regression tests), `main.app` boots clean.
- No frontend change → frontend gates unchanged from Session 1.

### Remaining handoff (deliberately not fixed — out of the trust cluster)
- **OBS-001** — local `server/.venv` has `fastapi 0.115.14`; repo pins `0.138` (CVE bump 8c11066).
  Env drift, not code: reinstall the venv from `server/requirements.txt` before trusting local
  security posture. Not reinstalled mid-sweep to avoid disturbing the suite's environment.
- **Audit #6 / #245** — SQLite `InProcessExecutor` has no startup orphan-sweep; a hard-crashed
  run strands `running` forever. **Dev-only** (Postgres prod self-heals via the lease reaper);
  cosmetic zombie row, blocks nothing. One-liner if wanted: reset `running→failed` in `start()`.
- **OBS-002** — Ask/NL leverage ranking reads "10 issuers ranked" against a 34-issuer store;
  label as "top 10 of N" or compute the median over the full universe. Lives in frontend WIP
  area (`Ask.tsx`) — left for the user's branch.
</content>
