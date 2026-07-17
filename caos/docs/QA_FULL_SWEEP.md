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

### OBS-001 — venv has fastapi 0.115.14, repo pinned 0.138 (CVE fix 8c11066) — S4 — ⚠ CORRECTED in Session 3 (do NOT "reinstall the venv" / downgrade — see below)
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
- **OBS-001** — ⚠ **CORRECTED in Session 3.** The "reinstall the venv" advice is wrong: the pin
  is valid but needs **Python ≥ 3.10**, and the local venv is **py3.9.6** — it can't host the
  pinned stack, and downgrading the pin to match would re-open the CVEs. No deploy blocker
  (Docker is py3.11). See Session 3 → "OBS-001 — CORRECTED".
- **Audit #6 / #245** — SQLite `InProcessExecutor` has no startup orphan-sweep; a hard-crashed
  run strands `running` forever. **Dev-only** (Postgres prod self-heals via the lease reaper);
  cosmetic zombie row, blocks nothing. One-liner if wanted: reset `running→failed` in `start()`.
- **OBS-002** — Ask/NL leverage ranking reads "10 issuers ranked" against a 34-issuer store;
  label as "top 10 of N" or compute the median over the full universe. Lives in frontend WIP
  area (`Ask.tsx`) — left for the user's branch.

---

## Session 3 (2026-06-22) — fresh-session re-verification + OBS-001 correction

Re-ran the inventory in a clean session (parallel user edits could have moved the tree).
The Session 1–2 verdict **still holds**, one prior code item closed, and one prior finding
was found to be **materially mis-logged** — corrected below.

### Re-verification (gates + live surface)
- Server suite **315 passed / 2 skipped** (314 + the FIX-D regression test). Frontend
  **tsc clean · 127 vitest**. No regression from the parallel WIP.
- Live route walk against `data/caos_qa.db` (35 issuers, 4 complete runs): **all 12 HTML
  routes 200**, all GET API paths 200 (`/api/auth/me`, issuers, issuer docs, run summary,
  run module detail, run QA, query catalog/capabilities, settings), `query/nl` + `scenario/nl`
  + `query/graph` (real capability ids) 200, EDGAR 503 (expected no-`EDGAR_USER_AGENT` gate),
  bogus capability 404 (guard), malformed bodies 422 (validation). **No 5xx, no tracebacks.**
- **Closed two prior `▢` items to `✅`:**
  - *Research demo contract* — `POST /api/research` with the key **cleared** returns **200 in
    6.5 ms** with a `demo` report. (With the key **set**, it correctly takes the documented
    multi-minute keyed web-search path — the earlier "25 s no response" was that path, not a hang.)
  - *Report Studio committee-export gate* — `POST /api/runs/{id}/report` on a Restricted run
    returns **409** carrying the 2 MATERIAL blocking findings (module + description) — the
    "gate with teeth" refuses and explains what to remediate.

### FIX-D — `InProcessExecutor` strands a hard-crashed run in `running` forever — S3 (dev robustness)
- **Cause** (Audit #6/#245): a SIGKILL/power-loss skips `stop()`'s mark-failed handler, so a
  run left `running`/`queued` zombies forever — SQLite/`InProcessExecutor` has no reaper
  (the Postgres `QueueWorker` self-heals via `_reap_orphans`). Demonstrated live this session:
  the QA server was `pkill`-ed mid-walk (the exact strand path).
- **Fix**: `InProcessExecutor.start()` now sweeps any non-terminal run (`running`/`queued`) to
  `failed` on boot. start() runs in lifespan **before any request is served** and the executor
  has no in-flight tasks yet, so every non-terminal row is provably a strand — safe to sweep
  ([server/run_executor.py](../server/run_executor.py)). Terminal runs (`complete`/`failed`) are
  untouched.
- **Test**: `test_inprocess_start_sweeps_stranded_runs` (running+queued → failed, complete
  preserved). Reordered `test_inprocess_executor_runs_enqueued` to start the executor **before**
  creating the run, matching real lifespan ordering (it previously relied on start() being a no-op).

### OBS-001 — CORRECTED: not a deploy blocker, and "reinstall the venv" is wrong advice
The Session 1–2 entry ("venv has fastapi 0.115.14, repo pins 0.138 — reinstall the venv")
is misleading and acting on it would **re-open the 7 starlette CVEs**:
- `fastapi==0.138.*` is **valid and installable** — but **only on Python ≥ 3.10** (0.138 caps
  starlette to 1.x; starlette ≥ 1.3.1 needs py3.10+, exactly as the `requirements.txt` comment
  states). The **local venv is Python 3.9.6**, so it *physically cannot* host the pinned stack —
  the reinstall fails, and there is **no deploy blocker** (Docker runtime is `python:3.11-slim`,
  installs 0.138 fine; `server/static` is rebuilt fresh in-image — verified in `deploy/Dockerfile`).
- The local pip's "max fastapi 0.128.8 / max starlette 0.49.3" listing is a **Python-3.9 filter
  artifact**, not the real ceiling (PyPI `/json`: fastapi latest 0.138.0, starlette latest 1.3.1).
  **Do not downgrade the pin to match the old venv** — that reverts the CVE fix (8c11066).
- **Right action**: leave the pin; for a production-faithful local run, use a **py3.10+
  interpreter or Docker**.

### Production-dependency-parity — RESOLVED (py3.11 parity venv, user-approved)
The suite's earlier "production-like" claim ran on the local **py3.9.6 + fastapi 0.115 +
starlette 0.46** venv, while prod runs **py3.11 + fastapi 0.138 + starlette 1.x** — a *major*
starlette jump (0.46 → 1.x). With user approval, installed **python@3.11** (Homebrew) and built a
parity venv (`server/.venv311`) from `server/requirements.txt`:
- The pinned stack resolves cleanly: **python 3.11.15 · fastapi 0.138.0 · starlette 1.3.1** —
  definitively confirming the pin is valid + installable (re-settling OBS-001).
- **Full suite on the prod stack: 315 passed / 2 skipped.** The starlette 0.46→1.x breaking
  changes do **not** break tested behavior. Parity gate **closed.**
- 3 deprecation *warnings* (forward-compat only, all in fastapi/starlette internals, not app code):
  `TestClient`+httpx deprecation (install `httpx2` eventually), and `HTTP_422_UNPROCESSABLE_ENTITY`
  → `_CONTENT` rename (×2, raised from `fastapi/routing.py`). Cosmetic now; tidy before a future
  starlette removes them.

### FIX-E — LLM-call-site security guard's venv exclusion is brittle — S4 (test robustness)
- **Cause** (surfaced by the parity run): `test_no_unreviewed_llm_call_sites` scans `server/**/*.py`
  excluding only path components named **exactly** `.venv`. The parity venv `.venv311` slipped the
  filter, so the anthropic SDK's own `.messages.create(` / `.stream(` sites leaked into the scan and
  failed the guard. Any venv under `server/` not named `.venv` (or a vendored dep) silently breaks
  this AML.T0051.001 guard.
- **Fix**: exclude by `site-packages` — the universal, naming-agnostic marker of installed code
  ([tests/server/test_llm_safety.py](../../caos/tests/server/test_llm_safety.py)). Green on both
  py3.9 `.venv` and py3.11 `.venv311`.

### Deterministic-QA caveat (process note, not a defect)
`server/.env` carries a real `ANTHROPIC_API_KEY`, and `config.py` reads `env_file=".env"` — so a
server started from `server/` **loads the key** and the LLM lanes (chat, research, live runs) go
**live (token spend)**, contradicting the Session 1 "key unset → deterministic" premise. For
offline/deterministic QA, start with the key explicitly cleared:
`ANTHROPIC_API_KEY="" … python run.py`.

### Local artifact note (not a code defect)
`server/static/` was **stale** (built before the `/query` route existed) → `/query` 404'd in the
single-process server. It is **gitignored** and **rebuilt fresh by the Docker image**, so this is
**local-only** — no prod impact. Refreshed locally from the current `frontend/out`. Reminder:
run `scripts/build_frontend.sh` (or rebuild) after adding a route before testing the static-served app.

### Session 3 verdict
**Clean pass — no blocked items remain.** Two code fixes added with regression coverage (FIX-D
orphan sweep, FIX-E guard robustness); one prior finding corrected (OBS-001); production-dependency
parity verified on the real pinned stack. Gates:
- **py3.11 prod-parity** (fastapi 0.138 / starlette 1.3.1): server **315 / 2 skip**
- **py3.9 baseline** (fastapi 0.115): server **315 / 2 skip**
- frontend **tsc clean + 127 vitest**; live surface walk **zero 5xx / zero tracebacks**

### What changed (Claude, Session 3)
- `server/run_executor.py` — orphan-run sweep on `InProcessExecutor.start()` [FIX-D]
- `tests/server/test_async_runs.py` — `test_inprocess_start_sweeps_stranded_runs` regression test;
  reordered `test_inprocess_executor_runs_enqueued` to real lifespan ordering [FIX-D]
- `tests/server/test_llm_safety.py` — exclude `site-packages` (not just `.venv`) so the LLM-call-site
  guard is venv-name-agnostic [FIX-E]
- `docs/QA_FULL_SWEEP.md` — this Session 3 section (re-verification, OBS-001 correction, parity gate,
  FIX-D/E)
- *(env, not committed)* `server/.venv311` — py3.11 prod-parity venv for local parity runs (gitignored)

### Still untouched (user's parallel WIP — flagged, not modified)
- `frontend/src/app/globals.css`, `components/pipeline/views.tsx`, `components/query/GraphCanvas.tsx`,
  `components/.../Ask.tsx` (OBS-002 lives here)

---

## Session 4 (2026-06-22) — watchdog re-verification (no tree drift)

`/loop` re-entry. Working tree is **byte-identical to commit `183b459`** (only untracked
`caos/data/` QA db) — no parallel WIP since the Session 3 clean pass. Re-ran the gates as the
regression proof; **skipped the full live UI re-walk** — with zero tree change it adds no
information (Session 3's live surface walk still applies verbatim).

- **py3.9 baseline** (offline, key cleared): server **315 passed / 2 skipped**.
- **Frontend**: `tsc --noEmit` clean (exit 0) · **127 vitest passed**.

**Verdict: clean pass holds.** No new findings, no code change this iteration. The 10-min loop
now acts as a watchdog — a future iteration becomes meaningful only when the tree changes; until
then it re-confirms green. Cancel with `CronDelete` when no longer wanted.

---

## Session 5 (2026-06-23) — deep real-user re-walk; 2 transparency bugs fixed

Full re-walk against an **isolated, prod-parity QA stack**: FastAPI on `:8010`
(`.venv311` — fastapi 0.138/starlette 1.3.1, the deployed pin) against
`data/caos_qa.db` + `vault_qa`, deterministic (`ANTHROPIC_API_KEY=""`,
council/debate off); Next.js dev on `:3010` (`NEXT_PUBLIC_API_URL` → `:8010`,
new `qa-frontend` launch config). The user's parallel `:8000`/`caos.db` backend
was left running and untouched. Every concept exercised as a real user via the
browser preview — not structural-only this time: each ▢ from Sessions 1–3 was
driven (clicks, form fills, real ingest, gate probes).

This pass went past *render-clean* into *behaviour*: login (wrong + valid code),
directory search/empty-state/modal-create→persist→redirect, pipeline node→inspector
lineage, **vault export wrote 2 notes to disk**, Model Builder driver→97 recomputed
cells (+ clamp/negative edges, no NaN), **committee-export 409 with 2 blocking
findings**, Research demo report (honest DEMO banner), **real PDF ingest → 23 chunks**
(pypdf fallback; markitdown CLI honestly off), EDGAR import → **503 gate**, Settings
workspace panel = honest env mirror. Two real defects surfaced, sharing one root cause.

### Shared root cause — *scoped data shown without disclosing its scope*
Both bugs violate the platform's **trust-through-transparency** value the same way:
a partial/reference dataset is presented as if it were the complete, issuer-specific
truth. Fixed coherently as one theme.

### BUG-004 — Deep-Dive of a **never-run** issuer shows ATLF reference financials as the issuer's own — S3 — FIXED
- **Repro**: create issuer "Zephyr Synthetic Materials" (0 runs, 0 docs) → open
  `/deepdive?issuer=<zsyn>`. Renders a full populated analysis (revenue 2410/2588…,
  "41 KPIs, tie-out within 0.3%, GREEN for all consumers") — the ATLF reference
  fixture — under "ASK ZSYN". The only caveat read *"live engine output · bespoke
  tabs show the ATLF reference template"*, which **implies the live modules reflect
  this issuer** when zero runs exist. `useLiveRun().runId === null` was not
  distinguished from the has-a-run case.
- **Root cause**: the sub-header caveat was binary (reference vs non-reference);
  the dangerous *no-run* state fell into the non-reference branch and inherited
  "live engine output" wording.
- **Fix**: extracted a pure `deepDiveCaveatKind({isReference, loading, runId})` →
  `reference | loading | live | noRun` (`lib/deepdive/caveat.ts`, unit-tested).
  The `noRun` branch renders *"no run for <TICKER> · figures are the ATLF reference
  template, not this issuer"* and is **not** `xl:`-hidden (the most important
  disclaimer always shows). `live`/`reference` wording unchanged.
- **Verified live**: ZSYN now shows the honest no-run disclaimer (visible at all
  widths); GPHC (has a run) still shows the live caveat; ATLF default unchanged.
- **Regression**: `caveat.test.ts` — 4 tests, incl. `noRun` must never be `live`.

### OBS-002 → resolved — NL ranking labeled a top-N slice as the full universe — S4 — FIXED
- **Repro**: Ask ⌘K → "which issuer is most levered" with a 35-issuer ranked
  universe → *"…1.17x above the 6.21x **median**. 10 issuers ranked …"*. The
  median was computed over the **top-10 cohort** (the 10 most-levered), and "10
  issuers ranked" read as the whole population.
- **Root cause**: `narrate()` (`lib/query/viz.ts`) derived the median and count
  from `res.rows` — already capped at `spec.limit` in `nlquery.execute()` — with
  no universe size to compare against.
- **Fix**: `execute()` now returns `total_ranked` (candidates eligible **before**
  the top-N slice). `narrate()` says *"Top 10 of 35 ranked"* and *"median of these
  10"* when capped; uncapped wording is unchanged.
- **Verified live**: *"…1.17x above the 6.21x median of these 10. Top 10 of 35
  ranked · 1/10 cited…"*.
- **Regression**: `viz.test.ts` (capped top-N + scoped-median assertions) and
  `tests/server/test_nlquery.py::test_ranking_reports_total_ranked_for_top_n_labeling`
  (field present + `rows ⊆ total_ranked` invariant).

### Observations (non-blocking, no code change)
- **Mobile**: `/issuers` overflows horizontally at 375px (scrollW 1297). Accepted —
  the UI is a deliberately desktop-dense terminal ("dense, multi-window"); mobile is
  an explicit non-persona. Renders, no crash.
- **QA-env artifact**: restarting the QA backend rotates the random `SESSION_SECRET`,
  invalidating the analyst cookie (one re-login). Not a product bug — prod sets a
  stable secret. Use a fixed `SESSION_SECRET` for QA to avoid the re-login.
- **OBS-003 stands** (offline runs project reference-fixture financials) — a known
  mock-vs-engine characteristic, now partly mitigated by BUG-004's no-run disclaimer.

### Gates (final)
- **Server pytest** (py3.9 `.venv`, offline, key cleared): **327 passed / 2 skipped**.
- **Frontend**: `tsc --noEmit` clean · **vitest 133 passed** (19 files).
- **axe-core a11y** (`scripts/a11y-axe.mjs`, BASE `:3010`): **0 violations across 12 routes**.

**Verdict: clean functional pass.** All 12 concepts exercised as a real user with no
crashes/console errors; two transparency defects fixed by shared cause with regression
tests; full inventory re-confirmed green. Residual items are accepted non-goals
(desktop-only) or documented mock-vs-engine characteristics.

### What was changed (Claude, Session 5)
- `frontend/src/lib/deepdive/caveat.ts` + `caveat.test.ts` — no-run caveat helper [BUG-004]
- `frontend/src/app/deepdive/page.tsx` — 4-state honesty caveat (always-visible no-run) [BUG-004]
- `server/nlquery.py` — return `total_ranked` (universe before top-N cap) [OBS-002]
- `frontend/src/lib/query/{viz.ts,viz.test.ts,types.ts}` — "Top N of M" + scoped median [OBS-002]
- `tests/server/test_nlquery.py` — `total_ranked` invariant regression [OBS-002]
- `.claude/launch.json` — `qa-frontend` config (port 3010 → QA backend 8010)

### Untouched (user's parallel WIP — flagged, NOT modified or staged)
- `audit-backlog.md`, `audit-backlog.round1-resolved.md`,
  `caos/server/access_log.py`, `caos/server/identity.py`, `caos/server/routes/runs.py`

---

## Session 6 (2026-06-25) — drift re-verification after the H/M/L hardening branch

Re-ran the full inventory against the current `fix/vmo2-followups` tree, which has
**drifted since the Session 5 clean pass**: seven backend hardening items landed
(commits `df83134`→`fcbb5cf`), tracked and closed in
[audit_report.md](../../audit_report.md) — **H-1** (cumulative per-run token budget),
**M-1** (`caos.llm` per-inference tracing), **M-2** (heavy→cheap model fallback on
429/529), **M-3** (Deep Research → durable background job + poll), **M-4** (prod guard
on the default signup code), **L-1** (`.git` in `.dockerignore`), **L-2** (opt-in
Pydantic boundary validation for `extract_json`). All seven are marked resolved with
regression tests. The drift is backend-only except **M-3**, which changes one
user-facing contract (the `/research` POST now returns a job id and the client polls).

### Verification strategy
Drift is narrow and test-covered, so this session is a **re-verification**, not a new
bug hunt: prove the gates still hold on the drifted tree, then exercise the one new
user-facing surface (M-3) both at the API and as a real user in a browser. Same
isolated, prod-parity stack as Session 5 — single-process FastAPI on `:8010`
(`.venv311`, fastapi 0.138 / starlette 1.3.1) against `data/caos_qa.db` + `vault_qa`,
deterministic (`ANTHROPIC_API_KEY=""`), fixed `SESSION_SECRET` (no re-login churn).

### M-3 durable Deep Research — verified end-to-end
- **API (live):** `POST /api/research` → **201** with a job id (2.7 ms, connection-independent);
  `GET /api/research/{id}` polls → **200 `status:complete`, `demo:true`**, full ~14 kB demo
  report, `truncated:false`. Migration `0010_research_jobs` applied cleanly to the QA db; both
  `run` and `research` in-process executors start. Per-user isolation + missing-id both **404**.
- **Real user (browser):** Playwright `research_flow.spec.ts` test 3 drives the actual durable
  loop in Chromium — POST→`running`, poll #1→`running` (client **must** loop), poll #2→`complete`
  → renders the **DEMO** report + cited sources. Pass.
- The client poll wrapper (`api.ts` `deepResearch`) is sound: 2 s interval, immediate first poll,
  15-min wall-clock cap, tolerates 10 consecutive transport errors before giving up (a proxy
  blip never aborts the durable run). `research/page.tsx` shape is unchanged — the polling is
  fully encapsulated, so the page's `await deepResearch(brief)` contract held.

### Gates (all green on the drifted tree)
- **Server pytest** — **360 passed / 2 skipped** on *both* py3.9 `.venv` and py3.11 `.venv311`
  prod-parity (was 327 in Session 5; **+33** regression tests for H-1/M-1..4/L-1/L-2). The two
  py3.11 deprecation warnings are unchanged forward-compat noise (starlette `HTTP_422_*` rename).
- **Frontend** — `tsc --noEmit` clean · **189 vitest passed** (24 files; was 133/19 in Session 5).
- **E2E** — **11/11 Playwright passed** against the fresh single-process `:8010` build
  (research M-3, settings, upload wizard, directory, concept nav, chat demo fallback).
- **axe-core a11y** — **0 violations across all 12 routes** (`scripts/a11y-axe.mjs`, BASE `:8010`).
- **Live surface walk** — 126 requests, **zero 5xx, zero tracebacks**. Every non-2xx is a designed
  guard firing: 404 (missing module / bogus job id / catch-all), 422 (validation), **409**
  (committee-export gate carrying its blocking findings), **503** (EDGAR no-`EDGAR_USER_AGENT` gate).

### Observations (non-blocking, no code change)
- **OBS-004 — `GET /api/research/{id}/` (trailing slash) → catch-all 404 with generic detail.**
  Same class as BUG-001: the `/api/{path:path}` catch-all shadows `redirect_slashes`, so the
  slash variant misses the route and returns `{"detail":"Not Found"}` instead of the route's
  `"Research job not found."`. **Not a defect** — the client polls without a trailing slash
  (`/api/research/${id}`) and no other consumer adds one, so it's unreachable in practice.
  Logged for awareness; a fix would only matter if a future client appended the slash.
- **Local-artifact note (not a code defect):** `server/static/` was **stale** — built Jun 23
  22:05, *before* the M-3 commit (Jun 24 22:03) — so the single-process server was serving
  pre-M-3 UI. `server/static` is **gitignored** and **rebuilt fresh by the Docker image**, so
  this is **local-only, no prod impact** (same finding as Session 3). Refreshed locally via
  `scripts/build_frontend.sh` (81 files) so the e2e/a11y walks tested real M-3 code. Reminder
  stands: rebuild the static export locally after a frontend change before testing the
  static-served app. *(Bonus: `/deepdive` first-load is now **261 kB**, down from the 643 kB
  PERF-2 flagged in AUDIT.md — the code-split already landed.)*

### Session 6 verdict
**Clean pass — no blocked items, no code change this session.** The seven-item hardening branch
is fully test-covered and the only user-facing change (M-3) is verified at both the API and the
browser. No regression from the drift; all Session 1–5 fixes still hold. One new non-blocking
observation (OBS-004, an unreachable trailing-slash 404) is documented for awareness, not fixed
(YAGNI — no client reaches it).

### What changed (Claude, Session 6)
- `docs/QA_FULL_SWEEP.md` — this Session 6 section (re-verification log).
- *(local, gitignored, not committed)* refreshed `server/static/` from current `frontend/out`.

### Untouched (user's parallel WIP — flagged, NOT modified or staged)
- No source files modified this session. The `qa-frontend` `launch.json` config from Session 5
  is no longer present in the tree (reverted in parallel WIP); booted the QA backend directly
  via env (`PORT=8010 DATABASE_URL=…caos_qa.db CAOS_STORAGE_DIR=…vault_qa ANTHROPIC_API_KEY=""
  SESSION_SECRET=… .venv311/bin/python run.py`).

---

## Session 7 (2026-06-29) — production-like local rerun after frontend drift

Re-ran the goal against the current dirty tree using the existing acceptance-criteria
inventory as the source of truth: `caos/docs/qa/FEATURE_TRACKER.csv` contains **302**
user-facing rows across Command Center, Pipeline, Deep-Dive, Model Builder, Report
Studio, Monitor, Research, Query, Upload, Shell, Auth, and Settings. The QA stack was
isolated and production-shaped: static Next export served by FastAPI on `127.0.0.1:8010`,
py3.11 prod-parity deps (`fastapi 0.138.0`, `starlette 1.3.1`), `caos_qa.db`,
`vault_qa`, stable local session secret, LLM keys cleared, council/debate off. The
scale seeder was idempotent: **30 sanitized issuers already present, 0 created**.

### Bugs found and fixed
- **BUG-005 — Global issuer search shared the directory search accessible name.**
  Playwright `getByLabel("Search issuers")` matched both the page-local directory
  search and the shell search. Fixed the shell input label to `Global issuer search`;
  directory search is unique again.
- **BUG-006 — Settings E2E still assumed the old untabbed Settings page.**
  The product now defaults to the Models tab. Updated the real-user test to open
  Workspace before checking server config and Research before saving/reloading
  defaults.
- **BUG-007 — Command sector cards nested remove buttons inside clickable cards and
  used sub-24px remove targets.** Axe flagged WCAG 4.1.2 / 2.5.8. Fixed the card
  click target as a sibling overlay button and made remove controls 24×24.
- **BUG-008 — Query graph SVG exposed interactive nodes under `role="img"` and
  nested wiki links inside selectable node buttons.** Fixed SVG role to `group`
  and rendered wiki links as sibling SVG anchors.

### Evidence
- Static build: **pass** (`next build`, 15 static routes, 172 files staged).
- Frontend typecheck: **pass** (`npx tsc --noEmit`).
- Frontend unit/component: **248 passed** across 37 files.
- Frontend lint: **pass** (`eslint src`).
- Browser E2E against `127.0.0.1:8010`: **11 passed**.
- Axe WCAG 2.0/2.1/2.2 A+AA route walk against `127.0.0.1:8010`: **0 violations** across
  `/`, `/command`, `/issuers`, `/deepdive`, `/pipeline`, `/model`, `/reports`,
  `/research`, `/upload`, `/settings`, `/query`, `/monitor`.
- Server regression on prod-parity py3.11 isolated test setup: **794 passed / 2 skipped**
  (1 Starlette/httpx deprecation warning).
- In-app browser smoke: `/command/` rendered, sector remove controls measured 24×24,
  no nested role-button/button pairs; `/query/` rendered, graph SVG role `group`,
  no nested SVG button/link pairs.

### GitNexus / worktree note
Pre-edit impact checks for `GlobalIssuerSearch`, `SectorBoard`, `GraphCanvas`, and
`Settings` were **LOW** risk. Post-edit `detect_changes` reported **CRITICAL** because
the worktree already contains broad unrelated WIP across 16 files (AGENTS/CLAUDE,
Command, Deep-Dive, Sector RV, Model Sheet, table filters, etc.). That is a repo-wide
dirty-tree signal, not solely the Session 7 patch. This session only deliberately
touched `GlobalIssuerSearch.tsx`, the SectorBoard hunk in `views.tsx`,
`GraphCanvas.tsx`, `settings_flow.spec.ts`, rebuilt local `server/static`, and this log.

### Verdict
**Clean pass on the current production-like local stack.** No blocked handoff items from
this rerun. Existing unrelated WIP remains unstaged and was not reverted.

---

## Session 8 (2026-07-02) — realistic scenario streak, first failure

Ran a five-case realistic Scenario Builder corpus through the offline translator. First
failure was **BUG-009 — upside demand wording mapped as recession**:
`pricing improves and demand recovery accelerates` produced `rev_growth_delta=-0.05`
and `margin_delta=-0.02` because the deterministic mapper treated any `demand` token
as weaker demand before checking recovery/upside context.

### Fix
- `server/scenario.py` now classifies demand recovery/improvement/acceleration as
  upside before the generic demand downside rule and gives explicit positive-pricing
  phrasing a modest margin lift.
- Regression: `test_recovery_demand_is_not_treated_as_recession`.
- Benchmark guard: `tests/perf/test_scenario_benchmark.py` keeps the realistic
  deterministic corpus local and sub-100ms for 500 translations.

Continuing the corpus found **BUG-010 — spread tightening signed as higher rates**:
`spreads tighten 75bps after refinancing clears` produced `rate_delta=+0.0075`
because the explicit-bps parser only treated cut/ease/lower/fall wording as negative.
Fixed the sign rule for spread tightening and rate relief. Regression coverage was
added to `test_explicit_bps_rate_move_signed`; the benchmark corpus now includes both
spread tightening and rate relief cases.

After the restart, the corpus reached 8 passes and found **BUG-011 — input-cost
deflation was a no-op**: `raw material deflation lifts gross margin` raised
`ScenarioError("no recognizable driver movement in the scenario")`. Fixed the
deterministic mapper with the upside counterpart to the existing input-cost inflation
rule. Regression: `test_input_cost_deflation_lifts_margin`; benchmark corpus includes
the deflation phrase.

After the next restart, the corpus reached 10 passes and found **BUG-012 — capex
bps cuts were parsed as rate cuts plus capex increases**:
`management cuts capex by 150bps to preserve liquidity` produced
`rate_delta=-0.015` and `capex_delta=+0.02`. Fixed the explicit-bps parser to route
clear capex-bps and margin-bps phrases to those drivers instead of always rates, and
to avoid generic double-counting. Regression coverage now pins capex cuts and margin
compression bps; benchmark corpus includes both.

After the next restart, the corpus reached 11 passes and found **BUG-013 — volume
recovery with pricing power mapped as cost inflation plus weak demand**:
`volume recovery with pricing power` tripped both the generic `volume` downside rule
and the `power` input-cost rule. Fixed volume to follow the same upside-context gate
as demand and excluded `pricing power` from utility/input-cost matching. Regression:
`test_volume_recovery_with_pricing_power_is_upside`; benchmark corpus includes the
phrase.

Resumed on 2026-07-17 with a fresh five-case corpus. Case 1 immediately found
**BUG-014 — growth slowdown mapped as revenue upside**:
`revenue growth slows as customer churn rises` produced
`rev_growth_delta=+0.03` because the deterministic mapper treated the bare token
`growth` as positive regardless of its directional context. The streak reset to
**0/5**. Fixed the polarity classifier to use explicit recovery/acceleration phrases
for upside and explicit slowdown/contraction/churn-deterioration phrases for downside;
the generic weak-demand effect now handles the latter. Regression:
`test_growth_slowdown_is_not_treated_as_upside`. The realistic performance corpus now
includes the failing phrase.

The restarted corpus then passed four consecutive cases before case 5 found
**BUG-015 — easing inflation mapped as an input-cost spike**:
`inflation eases and raw material costs normalize` produced
`margin_delta=-0.03` and `rate_delta=+0.005` because the generic `inflation` token
overrode the phrase's explicit relief direction. The streak reset again to **0/5**.
Fixed the classifier so explicit deflation/disinflation/easing/normalization language
takes precedence over the generic inflation shock, without moving unrelated drivers.
Regression: `test_easing_inflation_is_not_treated_as_cost_spike`. The failing phrase
is also part of the bounded realistic benchmark corpus.

### Final restarted streak — 5/5 consecutive successes

After BUG-015 was repaired, the corpus restarted from case 1 and all five cases
passed consecutively with exact driver-delta assertions:

1. Growth slowdown plus worsening churn → revenue `-5pp`, margin `-2pp`.
2. EBITDA margin expansion of `125bps` → margin `+125bps` only.
3. Maintenance-capex reduction of `100bps` → capex `-100bps` only.
4. Customer-volume decline / contract roll-off → revenue `-5pp`, margin `-2pp`.
5. Inflation easing / raw-material cost normalization → margin `+2pp` only.

Final verification: the complete Scenario Builder regression file plus realistic
benchmark passed **16/16**; the benchmark call remained **0.01s** and Ruff passed on
the translator, regression file, and benchmark file. The only warning was the known
Starlette `TestClient`/httpx deprecation notice.
