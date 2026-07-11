# Playbook: Integration Seams & Contracts

Standalone goal-prompt for a Sonnet agent. Re-run on every PR. You audit the
cross-stack contracts; you do not fix code. Deliverable: one dated report
(§5). Repo root is the working directory unless a command says otherwise.

**Run context.** Server venvs: `caos/server/.venv` (py3.9) and
`caos/server/.venv311` (py3.11, prod-parity — preferred). `caos/server/.env`
carries a real `ANTHROPIC_API_KEY`, so any out-of-pytest probe MUST export
`ANTHROPIC_API_KEY="" GEMINI_API_KEY="" OPENROUTER_API_KEY=""` and a throwaway
`DATABASE_URL` — never touch the user's `caos.db`. The pytest conftest
(`caos/tests/server/conftest.py`) already does this; prefer probes as
throwaway test files so they inherit the hermetic env. Never `git add -A`;
stage nothing — the report is the only artifact. Live-key tests
(`CAOS_TEST_LIVE=1`) spend tokens: skip unless explicitly requested.

---

## 1. Objective

Hold four contracts:

1. **FE↔BE type parity.** Frontend DTOs are *hand-written mirrors* of the
   server's Pydantic response models — no codegen, no runtime validation
   (axios `then((r) => r.data)` casts, only two runtime guards in
   `caos/frontend/src/lib/api.ts`). A server field rename/removal/retype is
   invisible to `tsc` and renders as blank/`NaN`/`undefined` cells in
   committee-facing views. Note: `caos/frontend/tsconfig.sync.json` is
   design-sync path aliases only — it is **not** a contract mechanism; do not
   audit it as one.
2. **Error-envelope stability.** The FE's `toErrorMessage` hard-codes FastAPI's
   `detail` polymorphism (string | 422 `{loc,msg,type}` list | structured
   `{message}` dict). Any new error shape renders as `[object Object]` or the
   generic fallback.
3. **External-boundary fault handling.** EDGAR (SEC) and three LLM providers
   (Anthropic / OpenRouter-DeepSeek / Gemini) fail routinely. Every fault must
   land in a designed degrade path — never a crashed run, never a silent wrong
   number.
4. **Degradation honesty.** FE hooks fail open to seeded demo data by design.
   The audited property is that degraded/demo/fallback state is always
   *visibly marked* — an analyst must never read fixture numbers as live
   (precedent: the EvidenceModal shadow-resolve findings in
   `caos/docs/qa/REVIEW_MATRIX_SEAMS.md`).

Stakes: money is behind a wrong read. Silent contract drift is worse than an
outage because it looks like data.

## 2. Scope discovery — run fresh every audit

Do not trust any endpoint/DTO list in this file; re-derive. Orientation
snapshot (2026-07-10): 19 routers in `caos/server/routes/` mounted flat under
`/api` (`main.py`, no version prefix), ~78 decorators, ~60 with
`response_model=`, schemas inline per route module; FE DTOs in
`caos/frontend/src/lib/api.ts` plus `src/lib/engine/types.ts`,
`src/lib/query/types.ts`, `src/lib/query/graph.ts`, `src/types/issuers.ts`.

```bash
AUDIT_TMP=$(mktemp -d)

# 1. OpenAPI schema without starting the server (lifespan does not run on
#    import; prod gates /openapi.json off, so this dump is the only way):
cd caos/server && ANTHROPIC_API_KEY="" .venv311/bin/python -c \
  "import json, main; print(json.dumps(main.app.openapi()))" \
  > "$AUDIT_TMP/openapi.json" && cd ../..

# 2. Endpoint inventory + which decorators lack a response_model:
grep -rn "@router\.\(get\|post\|put\|delete\|patch\)" caos/server/routes/ \
  > "$AUDIT_TMP/decorators.txt"
grep -v "response_model" "$AUDIT_TMP/decorators.txt" > "$AUDIT_TMP/untyped.txt"
# Caution: a few decorators span multiple lines (3 as of 2026-07-10), so
# confirm each untyped.txt hit by reading the decorator before counting it.

# 3. FE call inventory (path+verb) and DTO surface. Axios calls routinely
#    split across lines two different ways — `api\n  .post("/x", ...)` and
#    `api.post(\n  "/x", ...)` — and a line-based grep misses both patterns
#    in different ways (confirmed on 2026-07-10: a same-line grep dropped
#    queryOverlay/queryAnswer/edgarVaultUrl — exactly the 130s LLM-lane
#    calls). Use a DOTALL regex over the whole file instead of grep:
python3 - caos/frontend/src/lib/api.ts <<'PYEOF' > "$AUDIT_TMP/fe-calls.txt"
import re, sys
src = open(sys.argv[1]).read()
pat = re.compile(r'\bapi\s*\.\s*(get|post|put|delete|patch)\s*\(\s*[`"\']([^`"\']*)', re.DOTALL)
seen = set()
for m in pat.finditer(src):
    verb, url = m.group(1).upper(), m.group(2)
    if url.startswith("/api/"):
        seen.add((src[:m.start()].count("\n") + 1, verb, url))
for l, v, u in sorted(seen):
    print(f"{l}: {v} {u}")
PYEOF
grep -n "^export \(interface\|type\)" \
  caos/frontend/src/lib/api.ts \
  caos/frontend/src/lib/engine/types.ts \
  caos/frontend/src/lib/query/types.ts \
  caos/frontend/src/lib/query/graph.ts \
  caos/frontend/src/types/issuers.ts > "$AUDIT_TMP/fe-dtos.txt"

# 4. Which views are data-backed this run (fetch-hook usage):
grep -rln "usePortfolio\|useLiveRun\|useModelEngine\|useLivePipeline\|from \"@/lib/api\"\|from '@/lib/api'" \
  caos/frontend/src/app caos/frontend/src/components > "$AUDIT_TMP/data-backed.txt"

# 5. PR delta — what moved this time (contract files first):
git diff origin/main --stat -- caos/server/routes caos/server/main.py \
  caos/server/edgar.py caos/server/llm.py caos/server/engine \
  caos/frontend/src/lib caos/frontend/src/types caos/mcp
```

Full pass every run (the surface is small enough); the PR delta tells you
where to dig deepest and what the adversarial-verification targets are.

## 3. Contracts to hold (coverage checklist)

### A. FE↔BE request/response parity — every data-backed view
- Every FE call (path+verb in `fe-calls.txt`, after substituting path params)
  resolves to exactly one OpenAPI operation. No orphan calls; no FE call
  hitting an `include_in_schema=False` slash-duplicate.
- For each data-backed view's DTO: every field the FE reads exists in the
  server's response schema with compatible type and nullability. Extra server
  fields are fine; missing/renamed/retyped server fields are drift.
- Endpoints without `response_model` (the `untyped.txt` set — historically
  concentrated in `routes/query.py`) have no server-side contract: the FE type
  is the only contract. Probe their live JSON shape (§4-P2) instead of the
  schema.
- Request direction: FE request bodies satisfy the server's required fields
  and `Field` bounds (min/max lengths, numeric limits — a 422 here is a broken
  view).

### B. Type-sync drift mechanics
- The mirrors live where the comments say the source of truth is (`api.ts`
  cites `routes/issuers.py`, `runs.py`, `engine/presets.py`). Any PR touching
  a Pydantic response model must show the matching mirror edit, or prove the
  FE never reads the changed field.
- `npx tsc --noEmit` (from `caos/frontend/`) must pass — it is the only
  automated FE-side check, and it only works if the mirrors were edited.
- No new runtime-unvalidated trust: new FE code paths reading deep optional
  chains from untyped endpoints get flagged.

### C. Versioning & optional-field handling
- There is no URL versioning; the app version is a string (`2.0.0` in
  `main.py` and echoed by `/api/health`). Contract: FE and BE deploy together;
  therefore any *breaking* schema change within a PR must land both sides in
  that same PR.
- New **required** request field on an existing endpoint = breaking (old FE
  emits 422). Fail it.
- Pydantic convention split: request models use `Optional[x] = None`
  (omittable); some response models use `Optional[x]` with **no default**
  (required-but-nullable). These have different wire semantics — the FE `?`
  marker must match omittable-ness, and `| null` must match nullability.
  Flag any response field whose FE mirror treats `null` as impossible.
- 422 envelope stays a *list* of `{loc,msg,type}`; string `detail` stays a
  string; structured 409s keep `.message`. `toErrorMessage` and its test
  (`api.test.tsx`) pin this — any server change to these shapes fails.

### D. EDGAR MCP server contract (`caos/mcp/edgar/server.py`)
- The MCP server is a thin stdio wrapper over the CAOS REST API — it makes
  zero direct SEC calls. Contract: its 4 tools (`edgar_search`,
  `edgar_issuer_filings`, `edgar_list_exhibits`, `edgar_fetch_and_vault`)
  stay parameter-compatible with `routes/edgar.py` (names, defaults, bounds —
  e.g. a `limit` outside route `Field` bounds must surface the 422, not be
  silently clamped).
- Error surface: any HTTP ≥400 from the API becomes a raised error
  (`RuntimeError("CAOS API {status}: {detail}")`) → MCP tool error. No retry,
  no fallback — by design. Verify the message still carries status + detail.
- Env contract: `CAOS_API_BASE` (default `http://localhost:8000`),
  `CAOS_ANALYST_EMAIL` → `X-Forwarded-Email`. The wrapper has no tests —
  static parity check is mandatory every run (§4-P5).

### E. External-dependency fault handling
- **EDGAR** (`caos/server/edgar.py`, sole SEC client — `engine/edgar_cp1.py`
  reuses it): single attempt, no retry (by design), 30s timeout
  (`edgar_timeout_s`), global 0.15s throttle, empty `EDGAR_USER_AGENT` =
  kill-switch. Fault mapping to hold: any HTTP error/timeout/non-JSON →
  `EdgarError`; routes translate `EdgarError` → **502**, UA-unset → **503**,
  per-caller 30 req/min → **429**. SSRF guards (host pinned to `.sec.gov`,
  archive-path pinning, size cap) stay intact.
- **Two EDGAR consumer lanes, two designed degrades:** legal/covenant lane
  (routes → MCP) hard-fails per request with 502; CP-1 financial lane is
  fail-safe — `fetch_cp1` catches everything, returns `None`, and
  `cp1_sources` falls through EDGAR → reported-disclosure → fixture/LLM. An
  EDGAR outage must never abort a run.
- **LLM providers:** model-id string routes the provider (gemini* → Gemini,
  slash/deepseek* → OpenRouter, else Anthropic). Selection-time degrade: a
  tier whose key is missing falls back to the Anthropic equivalent. Runtime
  degrade: overload (429/5xx/529) → one fallback attempt (Anthropic: retry
  loop 3×, exp backoff capped 8s, `budget.degraded=true`; OpenRouter/Gemini:
  one cheap-tier attempt). Master gate: live synth/council/debate/chat lanes
  activate only with `ANTHROPIC_API_KEY`.
- **Keyless degrade matrix** (offline = all three keys blank) — each lane must
  produce its deterministic output, never an exception: chat → demo reply;
  deep research → demo report flagged `demo:true`; synth → ATLF fixture;
  council → empty findings; debate → deterministic prose; RAG
  answer/overlay → 503 (`"Model lane unavailable…"`); query route → keyword
  fallback `{"source":"keyword"}`, never 5xx; extractors (adjusted EBITDA,
  covenants) → regex derivation; NL-query → demo translate; autonomy →
  `_empty_draft`.
- Every LLM lane keeps one of the three fault-isolation patterns (Blocked
  gate / `gather(return_exceptions=True)` / deterministic fallback). A new
  LLM call site without one of the three is a failure.

### F. Retry / timeout / idempotency per boundary
- **Timeout ladder** — a caller's timeout must exceed its downstream budget,
  else work is orphaned and errors are misattributed. Known ladder: FE axios
  default 20s; overrides `getMe` 8s, uploads 300s, `queryOverlay`/`queryAnswer`
  130s > server LLM 120s (`CAOS_LLM_TIMEOUT_S`) ✓; MCP httpx 60s > EDGAR 30s ✓.
  Verify the ladder holds for every FE call that proxies an external
  dependency — an FE 20s default over a route that can spend 30s in EDGAR is
  a violation to verify and report.
- **Retry:** exists only inside the Anthropic overload-fallback loop and the
  FE research poll (tolerates 10 consecutive transport errors; 404 = gone).
  Contract: no new blind retry on non-idempotent POSTs.
- **Idempotency:** all GETs side-effect-free (EDGAR GETs spend SEC quota but
  no state). Re-running mutating POSTs (`vault-exhibit`, run creation, model
  save) must be safe — duplicate-or-reject is acceptable, silent corruption is
  not. Probe any mutating endpoint the PR touched twice with the same body.
- 401 → FE `caos:auth-lost` event (re-auth), not an error toast loop.

### G. Graceful degradation when a dependency is down
- Backend down entirely: data-backed hooks fail open to seeded demo data with
  their error/phase state set — the view must *mark* the state (demo/fallback
  banner, error phase), never render fixture numbers as live. This is the
  EvidenceModal failure class; check every view the PR touched.
- EDGAR down: upload/import surfaces show the 502/503 detail; runs proceed
  (CP-1 precedence fallback).
- All LLM providers down (keys present, providers erroring): runs complete
  with modules `Blocked` and committee status capped by the QA cascade; query
  answer 502 says the deterministic result is unaffected; graph/overlay
  deterministic surfaces stay up.

## 4. Procedure

**P1 — Endpoint parity diff.** From `openapi.json` build the set of
`(method, path)` operations (`jq -r '.paths | to_entries[] | .key as $p |
.value | keys[] | . + " " + $p'`). Normalize FE calls from `fe-calls.txt`
(substitute template literals with `{param}`). Report: FE calls with no
operation (drift), operations no FE code calls (informational).

**P2 — Field-level DTO diff.** For each data-backed view (start from
`data-backed.txt`, weight by PR delta): resolve its api.ts method → OpenAPI
operation → response schema (`jq '.components.schemas.<Name>'` via the
operation's `$ref`). Compare field-by-field against the FE interface: name,
type, nullable, optional. For untyped endpoints, get the real shape from a
probe instead — drop a throwaway test into `caos/tests/server/` (inherits
hermetic sqlite + blanked keys) and delete it afterwards:

```python
# caos/tests/server/_audit_probe_shapes.py  (throwaway — delete after run)
# The shared `client` fixture lives in test_api.py, NOT conftest — a probe
# file must define its own (same pattern; conftest still blanks keys/DB):
import os, sys, pytest
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "server"))

@pytest.fixture(scope="session")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("audit")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'audit.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    from main import app  # import after env is set
    with TestClient(app) as c:   # headerless = local-dev identity; no auth headers needed
        yield c

def test_probe_untyped_shapes(client):
    r = client.get("/api/query/capabilities")
    assert r.status_code == 200
    print(sorted(r.json().keys()))      # compare against the FE type by hand
```

```bash
cd caos/server && .venv311/bin/python -m pytest \
  ../tests/server/_audit_probe_shapes.py -q -s && rm ../tests/server/_audit_probe_shapes.py
```

**P3 — Error-envelope regression.** Probe one 422 (bad body), one 404, one
string-detail 4xx, and — if the PR touched runs — the structured 409. Assert
shapes parse under `toErrorMessage`'s three branches. FE side:
`cd caos/frontend && npx vitest run src/lib/api.test.tsx`.

**P4 — Boundary fault suites (offline).** Both venvs, keys auto-blanked by
conftest:

```bash
cd caos/server
.venv311/bin/python -m pytest ../tests/server -q
.venv/bin/python -m pytest ../tests/server -q
```

Green suites are necessary but not sufficient — known coverage gaps you must
probe directly (throwaway test, same pattern as P2): monkeypatch
`urllib.request.urlopen` to raise `HTTPError(429)`, `HTTPError(503)`,
`URLError`, and to return non-JSON; assert each becomes `EdgarError` and that
the route maps it to 502. These branches in `edgar.py` are untested by the
suite as of 2026-07-10; if that's still true, say so in the report.

**P5 — MCP parity (static, every run).** Diff `caos/mcp/edgar/server.py` tool
signatures + request paths against `caos/server/routes/edgar.py` decorators
and `Field` bounds. Live smoke (only if a server is already running — do not
start one against the user's DB): call one tool via stdio and confirm the
error shape on a UA-unset 503.

**P6 — Keyless degrade matrix.** The offline suite (P4) covers most lanes;
spot-check the route-level surfaces from §3-E via throwaway probes: query
answer → 503, query route → `source:"keyword"`, chat → 200 demo, autonomy →
empty draft. Any lane raising instead of degrading fails G7.

**P7 — FE gates.**

```bash
cd caos/frontend
npx tsc --noEmit
npx vitest run
```

**P8 — Degradation honesty.** For each view in the PR delta: read the
hook's error/fallback branch and the component's rendering of it; confirm
degraded state is visibly marked. Static read is acceptable evidence; a
browser check is stronger when the dev stack is already up.

## 5. Evidence & reporting

Write `caos/docs/qa/reports/integration-seams-YYYY-MM-DD.md` (create the
directory if absent). Structure: verdict table of gates, then findings, then
evidence appendix (commands run + key outputs). Gates — each PASS/FAIL with
one line of evidence:

| Gate | PASS means |
|------|------------|
| G1 endpoint parity | no FE call without a matching operation |
| G2 field parity | no proven missing/renamed/retyped/nullability-drifted field read by a view |
| G3 no new untyped routes | `untyped.txt` set did not grow vs origin/main |
| G4 error envelope | all probed error shapes parse under `toErrorMessage` |
| G5 optional-field discipline | no new required request field on an existing endpoint; response nullability matches FE mirrors |
| G6 EDGAR fault mapping | EdgarError→502, UA→503, limiter→429, urlopen fault probes pass |
| G7 LLM degrade matrix | offline suites green on both venvs; every lane degrades per §3-E |
| G8 MCP parity | tool signatures ↔ route params/bounds match |
| G9 timeout ladder | every proxied call's FE timeout ≥ downstream budget |
| G10 degradation honesty | no PR-touched view renders fallback/demo data unmarked |

**Adversarial verification — mandatory before any FAIL.** A suspected drift is
a finding only if you prove the break: name the exact component/field that
reads the drifted value and show the wrong render (blank, NaN, crash, mock
shadow-resolve), or show the failing probe output. "Server has an extra field"
or "types differ but no FE code reads it" is informational, not a FAIL.
Severity honesty: this codebase's history shows auditors inflate severity —
each HIGH needs a demonstrated user-visible wrong read. Confirmed findings
additionally get one row appended to `caos/docs/qa/REVIEW_MATRIX_SEAMS.md`
(matching its existing table format). Do not re-report rows already there.

## 6. Accepted-risk register — do not report these

| By-design seam | Rationale |
|----------------|-----------|
| FE hooks fail open to seeded demo data (`usePortfolio`, `useLiveRun`, `useModelEngine`, `useLivePipeline*`) | "prefer live, static fallback" is the product design; audit the *marking* (G10), not the fallback's existence |
| `/monitor` page + `useSimRun`/`useSharedDayRun` client-side sims | Phase-2 mock by design; no backend exists to drift against |
| Keyless fixture/demo lanes (ATLF fixture synth, demo chat/research, keyword query router) | designed offline degrade — the audited property is determinism, not absence |
| No retry/backoff in `edgar.py`; global in-process throttle; no `Retry-After` handling | SEC fair-access design: single attempt + 0.15s spacing; limiter assumes one process |
| No EDGAR response cache (in-process ticker map only) | accepted; CP-1 precedence fallback is the availability story |
| Legacy `response_model`-less routes (grep shows 21 raw, ≈18 after multi-line false positives; mostly `routes/query.py`) | known debt; contract held by FE types + P2 probes; gate G3 only stops *growth* |
| `include_in_schema=False` slash-tolerance duplicate routes (×5) | deliberate 307-avoidance; excluded from parity counts |
| `tsconfig.sync.json` | design-sync alias overlay; not a contract tool; referenced by no build/CI step |
| MCP wrapper has no test suite | thin wrapper; covered by mandatory static parity (P5) |
| FEATURE_TRACKER.csv endpoint column free-text; "endpoint parity" doc claims are prose | tracker lags code by design; never treat tracker rows as contract evidence |
| Single-process rate limiter + locks | deployment is single-process by design (documented deploy posture) |
| `GET /api/issuers/{id}/cross-default`, `GET /api/sponsors/*` — no FE caller on this branch | PLANNED: FE consumer exists on unmerged `feat/covenant-frontend` (`3605c999`); `PRE_DEPLOYMENT_PLAN.md:126` tracks the merge. Re-check once that branch lands. |
| `GET /api/issuers/{id}/research-report[/{id}]` — no FE caller | Backend-complete (module + executor + migration `0033` + tests), zero FE caller, no unwiring plan doc. Track as a pending Issuer Profile feature, not drift. |
| `DELETE /api/auth/profile` — no FE caller | Tested self-service GDPR erasure (`test_gdpr_erase.py`), intentionally distinct from the `erase_analyst.py` operator CLI. No settings-page trigger yet — real gap, not a contract bug. |
| `GET /api/issuers/{id}/documents` — no FE caller | Confirmed dead (pre-CAOS era route, stale `FEATURE_TRACKER.csv` "Pass" claim, no real caller, no plan doc). Candidate for deletion — flag, don't silently carry forward. |
