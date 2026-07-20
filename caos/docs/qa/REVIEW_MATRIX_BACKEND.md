# Backend Review Matrix — caos/server

> **2026-07-20 update:** current effective server evidence is **2,601 passed /
> 15 skipped**; the bounded pool and raw-ASGI HTTP policy remediation is also
> represented in the first-fault report. This matrix remains historical input;
> current route/custody/capacity gates are in
> [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md).

> **2026-07-18 release note:** this bootstrap matrix is historical audit input,
> not a current readiness verdict. The effective current server suite is 2,412
> passed / 15 skipped, but individual findings remain open until re-adjudicated
> against current code and the target Postgres configuration. Route, queue,
> authorization, storage, and recovery closure is governed by PD-03/PD-07/PD-08
> and L23/L25/L26. See
> [PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](reports/PRE_DEPLOYMENT_CLOSURE_2026-07-18.md).

Total backend review, bootstrap 2026-07-03 (branch `feat/query-route-fast-lane`).
Report-only: findings are recorded here, fixes land as separate commits.

## Baseline

| Check | Result | Date |
|---|---|---|
| pytest (`.venv311`, py3.11 / fastapi 0.138) | **870 passed, 2 skipped** in 12.4s | 2026-07-03 |
| pytest (`.venv`, py3.9) | **869 passed, 3 skipped** in 17.6s | 2026-07-03 |
| `ruff check caos/server caos/tests` (0.15.18 config) | **clean** | 2026-07-03 |
| `mypy` engine gate (`caos/server`, mypy.ini files=engine) | **clean** — 43 source files | 2026-07-03 |

Suites run with `ANTHROPIC_API_KEY` unset (offline QA).

## Matrix

Status: `pending` → `in-progress` → `audited` (findings column holds count; `verified` = adversarially verified).

| Group | Paths | Status | Findings | Verified | Notes |
|---|---|---|---|---|---|
| BE-1 CP-1 spine | `engine/periods.py`, `engine/edgar_cp1.py`, `engine/reported_cp1.py`, `engine/factpack.py`, `engine/adjusted.py`, `engine/lineage.py`, `engine/textscan.py`, `edgar.py`, `engine/fixtures.py` | **audited** | 1 (0 MED, 1 LOW) | yes (adversarial, 2026-07-03) | Spine is clean. `is_finite_number` correct; EDGAR-JSON NaN gated at parse boundary (`edgar_cp1:118`); both edgar_cp1 divides zero-guarded; adjusted reconcile is textbook (`ebitda_excl<=0`→None before the divide). Blocking urllib off-threaded (`runner.py:575`); SSRF guard robust (exact host + userinfo reject + post-redirect `.sec.gov` recheck); JSON-only, no XXE. Sole residual = coverage-divide sign asymmetry (BE1-1). |
| BE-2 Analytics modules | `engine/capstructure.py`, `catalysts.py`, `coststructure.py`, `covenants.py`, `distress.py`, `downside.py`, `earnings.py`, `legal.py`, `liquidity.py`, `macro.py`, `metrics.py`, `peers.py`, `portfoliofit.py`, `refinancing.py`, `relval.py`, `sponsor.py`, `scenario.py` (→ `caos/server/scenario.py`) | **audited** | 3 (0 MED, 3 LOW) | yes (adversarial, 2026-07-03) | Unusually well-defended on the divide/NaN lens — the `is_finite_number` + ÷0 discipline is applied almost everywhere, with comments naming the `bool(NaN)` trap (downside/earnings/macro/scenario/distress all gate + zero-guard correctly; `latest()` results re-gated via `_finite`/`is_finite_number`). Residual = 2 defense-in-depth store/regex-read gaps (BE2-1/2) both unreachable today (producers can't emit NaN) + 1 test-coverage gap (BE2-3). Path note: matrix listed `scenario.py` under `engine/`; it lives at `caos/server/scenario.py`. |
| BE-3 Orchestration + gates | `engine/planner.py`, `engine/registry.py`, `engine/runner.py`, `engine/gate.py`, `engine/readiness.py`, `engine/budget.py`, `engine/schemas.py` | **audited** | 7 (0 MED, 7 LOW) | yes (adversarial, 2026-07-03) | Prior hardening (45054ba, 5fcecd8) holds everywhere applied: abs() tolerances, leaf `is_finite_number`, str-coerce joins all intact. Residual class = interior-container type assumptions (BE3-1..3). Abort semantics verified: gate raise → run failed + full rollback, terminal (no auto-retry); module raise → per-module Blocked, run continues. 15 gate-phase consumers examined, 8 provably no-raise. |
| BE-4 LLM lanes | `engine/llm_client.py`, `engine/llm_safety.py`, `engine/council.py`, `engine/debate.py`, `engine/synth.py`, `engine/gemini.py`, `engine/openrouter.py`, `engine/report.py`, `llm.py`, `deepresearch.py` | **audited** | 2 (0 MED, 2 LOW) | yes (adversarial, 2026-07-03) | All 5 invariants VERIFIED: timeout `caos_llm_timeout_s` on **every** client (Anthropic `llm.py:60`, Gemini `gemini.py:57`, OpenRouter `openrouter.py:160`); fault isolation holds per-lane (council `return_exceptions` correctly **filtered**, synth Blocked-gate, debate/nlquery deterministic fallback); no-tools/no-writes holds (only 2 documented benign server-tools: off-by-default advisor consult + Anthropic read-only web_search — no code-exec/FS/DB write); keyless→Anthropic degrade; llm_safety injection/forgery/non-finite gating. Both auditors' MED candidates right-sized to LOW on backstop evidence. |
| BE-5 Query lane | `engine/querygraph.py`, `engine/queryoverlay.py`, `nlquery.py`, `retrieval.py`, `routes/query.py`, `routes/chat.py` | **audited** | 6 (1 MED, 5 LOW) | yes (adversarial, 2026-07-03) | Known 2026-07-03 candidate (availability/_committee/_gate_lane uncapped) confirmed FIXED by cfacf8a; residual unfixed instance of that class = `_cluster_by_wiki` (BE5-1). Event loop clean: vault scans off-threaded, all DB async, /route fast-lane = 8 scalar queries + pinned Haiku call + keyword fallback. NaN ingress to fact store CLOSED (loads_finite both synth paths + extract_facts add() gate). |
| BE-6 API surface | `routes/*.py`, `main.py`, `run.py` | **audited** | 4 (0 MED, 4 LOW) | yes (adversarial, 2026-07-03) | App wiring clean: `Exception` handler masks (no `str(e)`/stack to client, `main.py:250-258`), 404-detail preserved for `/api`, **no CORSMiddleware** (same-origin + edge proxy → no `*`+credentials misconfig), middleware order correct, every `/api` router under the chain. Input validation strong (Pydantic bodies, `.limit`-capped lists, parameterized queries, no mass-assignment, upload+edgar path-traversal dead, SSRF guard holds). Residual = 1 cost-control gap (BE6-1) + 2 perf/scan + 1 validation-hygiene, all LOW. (`routes/auth.py` = BE-7; `query.py`+`chat.py` = BE-5.) |
| BE-7 Identity / security | `identity.py`, `passwords.py`, `rate_limit.py`, `access_log.py`, `avscan.py`, `erase_analyst.py`, `routes/auth.py`, `config.py` (auth knobs) + `main.py:40-90` boot guards | **audited** | 2 (0 MED, 1 LOW, 1 trivial) | yes (inline refute-first, 2026-07-03 — classifier outage blocked subagents) | Cleanest group: the auth layer is visibly battle-hardened (prior-review fix markers S2/S5/S6/S7/#22/#32/#B6 all verified in place). All 4 boot guards fail closed (edge secret, SESSION_SECRET, ANALYST_SIGNUP_CODE, demo seed). Timing-equalized dummy hashing on /login AND /recover (non-short-circuit 3-word verify); token exp mandatory server-side; revocation via token_version incl. missing-row fail; principal cross-check kills stale cross-user cookies; bytes-mode compare_digest everywhere; avscan fail-closed both directions; GDPR erase scrubs both id+email stamps incl. the proxy-stamped fallback. Residual = doc-rot + schema hygiene only. |
| BE-8 Data + executors + migrations | `database.py`, `migrations/`, `run_executor.py`, `research_executor.py`, `ingest.py`, `seed.py`, `vault_export.py`, `config.py` | **audited** | 1 (0 MED, 1 LOW) | yes (inline refute-first, session B, 2026-07-03 — classifier outage blocked subagents) | Clean. Migrations Alembic + **additive-only** (no DROP/DELETE/TRUNCATE), `pg_advisory_lock` serializes multi-instance boot (`database.py:491`), runner off-thread (`:499`). config fail-closed: demo-seed refuse (`:43`), SESSION_SECRET/edge-secret boot-fail, avscan 503, `is_deployed()` fail-closed (`:237`). run_executor fully isolated: CancelledError distinct (`:40`), last-resort mark-failed (`:48`), SQLite boot orphan-sweep (`:122`) + Postgres lease/re-claim/reap (`:188`); concurrency capped `caos_run_concurrency=2` via `FOR UPDATE SKIP LOCKED LIMIT 1`. ingest streaming size-cap (`:57`) + avscan fail-closed. seed per-entity idempotent (get-or-create `:51`, provenance-scoped replace `:165`). Residual = pool/concurrency coupling note (BE8-1). |
| BE-9 Test infrastructure | `caos/tests/server/` (conftest, golden), `caos/tests/stress/`, `caos/tests/perf/`, `caos/tests/cohort/`, `caos/tests/fixtures/` + `.github/workflows/ci.yml` | **audited** | 2 (0 MED, 2 LOW) | yes (inline refute-first, 2026-07-03 — classifier outage blocked subagents) | Harness quality high: golden-master is textbook (real captured SEC facts, human-validated anchors, exact-match, fully offline, regeneration documented); conftest isolation sound (temp DB, NullPool, autouse rate-limit reset, demo-seed opt-in #34); skip census = 2 legit `skipif`s; CI genuinely layered (ruff, C901 changed-only, vulture, mypy engine, dual-python 3.11+3.14, Postgres worker leg, e2e, image, shellcheck, pip-audit/bandit/npm-audit/gitleaks, corpus drift). Residual = BE9-1 env-dependent offline determinism + BE9-2 never-collected offline tests. |

## Adjudicated-accepted register (never re-flag)

single-team IDOR · XFF rate-key spoof · global login-bucket self-DoS ·
edge-secret-trust · on-host backup · EDGAR in-process throttle · no-OCR ·
PERF-2 bundle · demo/mock seams by design.

## Findings log

Every finding below survived an adversarial verification pass (independent agent
instructed to refute; severities right-sized from the auditors' initial claims).
Report-only — no fixes applied in this pass.

### BE-9 Test infrastructure (audited 2026-07-03)

Inline read (conftest, golden harness, stress/perf/cohort trees, full ci.yml);
verification inline, refute-first (classifier outage). Both findings are
one-line fixes.

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE9-1 | LOW | `caos/tests/server/conftest.py:22-24` | Provider keys are `os.environ.setdefault(...)`'d to "" — **defaults-when-absent, never overrides**. A developer with a real `ANTHROPIC_API_KEY` exported runs the suite ONLINE: run-creating tests flip from the fixture path to live synth, breaking fixture-path assertions (`test_async_runs.py:45` asserts `qa_status == "Restricted"` with comment "ATLF fixture → MATERIAL → Restricted") and spending real tokens. The standing "clear ANTHROPIC_API_KEY for offline QA" instruction is the human workaround for this missing guard. CI unaffected (no key in env) — laptop-only flake+cost. Fix: force-assign `""` for all three keys, behind an explicit `CAOS_TEST_LIVE=1` escape if a live lane is ever wanted. |
| BE9-2 | LOW | `caos/tests/stress/test_mock_anthropic.py`, `caos/tests/cohort/test_fetch_cohort.py` vs `.github/workflows/ci.yml:95` | Two **offline** pytest files are never collected anywhere: CI runs `pytest caos/tests/server` only, and the canonical local command matches. `test_mock_anthropic.py`'s own docstring says "Collected by pytest so the mock can't silently rot" — it isn't, so the stress mock (and cohort-fetcher predicates) can rot green. Both are network-free by design. Fix: extend the CI pytest line to `caos/tests/server caos/tests/stress caos/tests/cohort`. |

**BE-9 clean (verified):** golden-master drift alarm freezes real captured SEC
XBRL (VSAT + FUN) against human-validated figures with exact-match assertions,
fully offline, with the `_capture.py` regeneration procedure and
"confirm-the-new-number-is-correct" discipline documented in the test itself;
`perf/smoke.py` is a deliberate non-pytest deployment tool whose percentile math
IS CI-gated via `--selftest` (`ci.yml:99`); skip census = exactly 2 conditional
`skipif`s (Postgres-only worker tests, gemini 2.x thinking gate) — no bare
skips, no xfails; conftest routes a throwaway SQLite DB + vault before any
import, resets the process-global rate limiter per test, and opts into demo
seeding explicitly; the CI pipeline is genuinely layered (lint → complexity →
dead-code → types → dual-python suite incl. the 3.14 deploy interpreter →
Postgres lease/claim leg → e2e against the real static export → image build →
deploy-asset lint → security: pip-audit, bandit, npm audit, gitleaks → corpus
taxonomy drift).

## Rollup — backend review complete (all 9 groups, 2026-07-03)

**28 verified findings, 1 MED, 0 HIGH/CRITICAL** across BE-1…BE-9; 1 finding
already resolved (BE5-5 dead lanes deleted by user adjudication, same day).
Groups: BE-1 (1) · BE-2 (3) · BE-3 (7) · BE-4 (2) · BE-5 (6, incl. the sole MED
`_cluster_by_wiki` uncapped scan; BE5-5 resolved) · BE-6 (4) · BE-7 (2) ·
BE-8 (1) · BE-9 (2). Baselines held throughout (870/2 py3.11 · 869/3 py3.9 ·
ruff · mypy clean).

Cross-cutting shape:
1. **The engine's money-math discipline held everywhere it was checked** —
   `is_finite_number` + zero-denominator degrade verified across the CP-1 spine,
   analytics modules, gates, and query lane; the NaN-ingress door (synth
   `loads_finite`) is closed on both extraction paths.
2. **The one recurring defect class is interior-container trust** (BE3-1..3 +
   BE5-3 + BE2-1/2): `or {}` doesn't defend against truthy wrong-typed
   `runtime_output` interiors; blast radius is a cleanly-failed run, never a
   wrong number. One `_as_dict`-style guard pass over ~8 sites closes the class.
3. **Perf class = uncapped append-only-Run scans**: fixed by cfacf8a everywhere
   except `_cluster_by_wiki` (BE5-1, the sole MED) and the BE6-2 portfolio fold.
4. **Security spine is strong**: fail-closed boot guards ×4, timing-equalized
   auth lanes, fault-isolated LLM lanes with universal timeouts, additive-only
   migrations, fail-closed avscan. Residuals are hygiene (doc-rot, schema
   shape, CI collection gaps), not exposures.

Fix-bundle order when a fix pass is authorized: (1) BE5-1 wiki-graph cap +
BE6-2 portfolio window; (2) the interior-container guard pass (~8 sites);
(3) BE9-1/9-2 one-liners + BE7-1 doc pass; (4) BE6-1 model allowlist.

### Fix pass — 2026-07-03 (authorized same day; all four bundles applied)

**FIXED (26 of 27 open findings):**
- *Perf:* BE5-1 (wiki graph: newest-2-per-issuer window + 300 cap + real
  radial positions; true totals in meta), BE5-2 (both probes DISTINCT), BE5-4
  (synthesis payload serialized to a 2KB slice), BE5-6 (vault walk prunes
  Runs/Issuers during traversal), BE6-2 (portfolio latest-run window, rn==1).
- *Guards:* BE3-1 (adjusted container), BE3-2 (`periods.latest` non-dict → None
  + `_as_dict` on nf), BE3-3 (`_as_dict` over fin/rev/eb/fcf/lev/dz), BE3-4
  (planner CP-0 defensive casts), BE3-5 (registry duplicate-id fail-loud),
  BE3-6 (covenants/earnings/peers scalar-container wraps), BE5-3 (extract_cost_facts
  `is_finite_number` + `_contagion` finite filter), BE2-1 (liquidity sum gate),
  BE2-2 (peer store-read per-value gate), BE1-1 (edgar coverage `> 0` symmetry).
  Plus one test-caught residual: capstructure nulls a non-finite `amount_musd`
  ECHO on indeterminate rows (the computed fields were already guarded).
- *Infra/docs:* BE9-1 (conftest force-blanks provider keys unless
  `CAOS_TEST_LIVE=1`), BE9-2 (CI collects `tests/stress` + `tests/cohort` —
  suite 877→888), BE7-1 (5-site doc pass: scrypt→PBKDF2 ×3, legacy-exp,
  self-commit), BE7-2 (`recovery_words` min_length=3 in schema), BE3-7 (gate
  ladder docstring: LABELS, not blocks), BE8-1 (pool/concurrency coupling
  documented at the engine kwargs).
- *Control:* BE6-1 (X-Query-Model allowlisted to the configured tier universe;
  unknown id → Light lane), BE6-4 (accession pinned to the SEC shape).

**DEFERRED:** BE6-3 (digest truncated-flag) — unreachable at Phase-1 scale
(book ≪ 2000); revisit when the cap can bind.

Verification after the pass: py3.11 **888 pass / 2 skip** (incl. the newly
collected stress/cohort tests + 12 new regression tests), py3.9 880/3, ruff
clean, mypy engine gate clean. `caos/server/engine/querygraph.py` also carries
the BE5-5 lane deletion and one parallel-session `_scatter` axis-domain hunk
(disclosed in the commit).

### BE-7 Identity / security (audited 2026-07-03)

Inline read of all 910 scope lines + `main.py` boot guards + `database.erase_analyst_data`;
verification inline, refute-first (classifier outage blocked subagents — same method note
as FE-3). Refuted inline before recording: signup-code boot asymmetry (all 4 guards fail
closed, `main.py:66-75`), /recover CPU-burn (bounded by the adjudicated global bucket),
throttle-bypass via malformed body (Pydantic 422s cost no PBKDF2 work), rsplit token
ambiguity (b64url alphabet has no "."), recovery-word normalization drift (register and
recover both lower+strip), fixed-window boundary burst (inherent, 2× of a 10/min budget).

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE7-1 | LOW | `routes/auth.py:53, 56, 241` · `identity.py:81-82` vs `:102-104` · `database.py:529` vs `:546` | **Security doc-rot, 5 sites, 3 files:** auth comments claim "scrypt" three times (the hash is PBKDF2-HMAC-SHA256 — `passwords.py`'s own docstring explains scrypt was deliberately rejected for LibreSSL builds); `read_session_token`'s docstring says legacy no-exp tokens "are still accepted for back-compat" while the code rejects them (#32); `erase_analyst_data`'s docstring says "Caller commits via the session" while `:546` self-commits. Each misdocuments security-relevant behavior for the next auditor. One doc-only pass fixes all five. |
| BE7-2 | TRIVIAL | `routes/auth.py:91-92` vs `:155-159` | `RegisterRequest.recovery_words` is declared optional-shaped (`default_factory=list`, `max_length=3`) but `_recovery_hashes` 422s unless exactly 3 non-empty words — required-in-practice, optional-in-schema. Declare `min_length=3` so the contract is visible in OpenAPI instead of a handler 422. |

**BE-7 clean (verified):** cookie token = HMAC-SHA256 over b64url JSON, fixed algorithm
(no confusion surface), mandatory server-side `exp`, bytes-mode `compare_digest` on both
the token sig and the edge credential (non-ASCII → clean reject, not 500); edge-origin
check ordered BEFORE identity resolution; revocation = `token_version` re-checked per
request with missing-row (GDPR-erased) failing closed; principal cross-check drops a
cookie whose email ≠ this request's SSO principal; cookie flags httponly + samesite=lax +
secure-on-any-non-dev + path=/; PBKDF2 at the OWASP 600k floor with per-hash work factor;
user-enumeration closed on /login and /recover via dummy-hash timing equalization
(register's 409 necessarily confirms existence — accepted UX tradeoff, throttled, behind
single-team SSO); per-source + un-spoofable global throttle on every credential endpoint;
`rate_limit` spray-bounded (S6); `access_log` C0-strip + cap (S7) with the C1-separator
claim holding for the docker-logs/grep/jq consumer; avscan INSTREAM protocol correct,
fail-closed on unavailable/inconclusive/oversize, reply capped, off-thread; erase covers
both id- and email-stamped rows (research deleted, runs/documents anonymized, profile
deleted) for both the self-service and operator lanes.

### BE-6 API surface (audited 2026-07-03)

Two finders (data/upload routes + aux/app-wiring) plus a direct verifier pass on
the load-bearing app wiring. No HIGH/MED survived: the one MED candidate
(client-chosen model id) right-sized to LOW on the trusted-team + budget-gate +
graceful-degrade backstops. The security-critical wiring — error masking, CORS
absence, middleware order, path-traversal/SSRF guards — is clean.

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE6-1 | LOW | `engine/presets.py:131` via `main.py:115` (`X-Query-Model` header) | `resolved_query_model()` returns the client-supplied `X-Query-Model` header **verbatim** as the LLM `model=` for the query lanes, after only a provider-key-presence check — **no allowlist against the four configured TEST/LITE/BALANCED/MAX tiers**. An authenticated analyst can pin any model the deploy's key can reach (e.g. the priciest), bypassing the mode-tier cost table; a nonexistent id → provider 400 → lane error (degrades to the keyword fallback). Right-sized MED→LOW: single trusted team spending the org's own budget, the query lane is `budget.llm_allowed()`-gated per run, and a bad id degrades gracefully — no data/crash/cross-tenant. **Top BE-6 fix candidate** (few-line allowlist: reject a model id not in the configured tiers). Would read MED only if the cost tiers are treated as a hard business control. |
| BE6-2 | LOW | `routes/portfolio.py:82` | `get_portfolio` runs `select(Run).where(status=="complete").order_by(created_at.desc())` with **no `.limit()`**, then dict-folds to latest-per-issuer in Python. Run is append-only (retention prunes `MetricFact` rows, not `Run` rows — BE5-1/5-5), so this materializes every historical complete run per board load. The one P4 sibling that missed the window/cap its cousins (`runs`/`issuers`/`issuer_profile`) got; docstring "the universe is small" is true of issuer count but not the append-only run count. Rate-limited 60/min → LOW. Fix: per-issuer-latest window (`DISTINCT ON (issuer_id) … ORDER BY issuer_id, created_at DESC`), not a bare `.limit()` (which would drop issuers). |
| BE6-3 | LOW | `routes/digest.py:113-114` | `daily_digest` loads issuers `.limit(2000)` and reports `"issuers": len(issuers)` + WARF/CCC roll-ups over that **truncated** set — past 2000 issuers the digest silently understates the book (wrong-number-shown, not a crash/degrade), presenting a first-2000-by-name subset as the full-book roll-up. Unreachable at Phase-1 scale (book << 2000), so LOW; the run-scan caps (5000/1000, `:122-125,158-160`) are documented intentional P4 bounds. Fix when it could bind: surface a "truncated" flag rather than presenting a partial roll-up as complete. |
| BE6-4 | LOW | `routes/edgar.py:142-152` → `edgar.py:229-234` (`list_exhibits`) | The `filing_exhibits` route passes the raw client `accession` query param into `list_exhibits`, where `acc_nodash = accession.replace("-", "")` is interpolated (dash-strip only, no charset/length/format validation) into an outbound SEC URL path (`{_ARCHIVES}/index.json`). Host is hard-coded `www.sec.gov` and `_http_get` re-checks the post-redirect host stays on `.sec.gov`, so the fetch **cannot leave SEC** — worst case a malformed path → SEC 404 (a wasted round-trip). Validation hygiene: pin `accession` to the `\d{10}-\d{2}-\d{6}` shape. (Contrast: `fetch_exhibit`, the write-to-vault path, is fully guarded — https + exact host + `/Archives/` + no userinfo.) |

#### Verified-clean highlights (what was checked and held)

- **App-wide error masking** — `@app.exception_handler(Exception)` (`main.py:250-258`) logs the trace server-side and returns a fixed `{"detail":"Internal Server Error"}` 500; no `str(e)`/stack/DB error reaches the client. The 404 handler preserves only endpoint-authored HTTPException detail for `/api/*`, serves SPA 404.html otherwise. `edgar._http_get` maps raw `URLError`/`OSError` to a generic message (cause chained server-side only). No in-scope route echoes `str(e)` of an unexpected exception.
- **CORS** — no `CORSMiddleware` anywhere in app code (grep-confirmed, vendored hits only). Same-origin app (API + Next static from one origin) behind the edge proxy, so the `allow_origins:["*"]`+`allow_credentials` misconfig **does not exist**.
- **Middleware + mounts** — order `security_headers → edge_origin_guard → access_log` (edge-guard 401s still access-logged); CSP/HSTS/Permissions-Policy present; every `/api/*` router uniformly under the chain; `/api/health` deliberately exempt from edge-guard for liveness. No router bypasses the chain.
- **Path traversal dead** — `ingest.store` sanitizes `re.sub(r"[^A-Za-z0-9._-]","_", Path(name).name)` + uuid dir; `write_memo` title via `Path(name).stem` → `_title` maps `\`/`/`→`-`. Client filename can't escape the vault.
- **SSRF guarded** — `vault_exhibit` passes `exhibit_url` into `fetch_exhibit` (rejects non-https / non-`www.sec.gov` / missing `/Archives/` / userinfo; post-redirect host re-checked); `run_mode` allowlisted, content avscanned.
- **Input validation / injection** — `RunCreate`/`ResearchBrief`/`AnalystSettings`/`IssuerCreate`/`qa` bodies Pydantic-validated & length-capped; list endpoints `.limit`-bounded + paginated + ordered; search `q` uses parameterized `.ilike("%…%")`; no `Model(**raw_body)` mass-assignment (`settings`/`models` write opaque JSON columns scoped to `caller.id`; `create_issuer` feeds a validated allowlist dict); `health` uses parameterized `text("SELECT 1")`. No raw-SQL interpolation in scope.
- **Clean routes** — `runs.py`, `scenario.py`, `research.py`, `issuers.py`, `sponsors.py` (avg ÷len `if scores else None`, `is_finite_number` before float), `settings.py`, `models.py`, `qa.py`, `health.py`, `run.py` all clean.
- **Accept-by-design (not counted, not re-flagged):** role never enforced (`CallerIdentity.role` exists, no `require_admin`) = the adjudicated single-team roles-lite posture (spec'd but not yet an enforcement gate; no global-config write path exists — settings/models are self-scoped rows); `upload_memo`'s `select(Issuer)` with no limit is **correct** (autolink needs every issuer name — a `.limit()` would silently drop wikilinks); unbounded `issuer_id` string length is inert (parameterized `db.get`, 404 on miss, never a path/f-string).

### BE-8 Data + executors + migrations (audited 2026-07-03, session B)

Classifier outage blocked subagents, so this was an inline refute-first pass over
every file + all Alembic migrations. The persistence/executor layer is clean and
visibly hardened by prior reviews (orphan reaping, fail-closed config, migration
advisory lock). One thin config-coupling note; no live defect.

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE8-1 | LOW (ops/config) | `database.py:43` + `config.py:168` | The async engine sets only `pool_pre_ping=True` — no explicit `pool_size`/`max_overflow`, so it inherits SQLAlchemy's default pool (5 + 10 overflow = 15). `execute_run_by_id` holds one connection for the **entire run** (a long transaction across all LLM awaits — intentional, for run-atomic rollback per BE-3). Inert at defaults: `caos_run_concurrency=2` means ≤2 run-connections vs a 15-slot pool, huge headroom. But the two knobs are coupled and undocumented — an operator who raises `caos_run_concurrency` above ~13 (heavy-throughput deploy) without tuning `pool_size` would exhaust the pool under full load, making new DB ops wait `pool_timeout` (30s default) → request latency/timeouts (not a crash). Fix: set `pool_size` explicitly to `caos_run_concurrency + request-headroom`, or document the relationship. |

#### Verified-clean highlights (what was checked and held)

- **Migrations** — Alembic (`env.py` + `versions/`), **additive-only**: no `DROP`/`DELETE`/`TRUNCATE`/data-losing `ALTER` in any version (sole "drop"-adjacent hit is a `server_default=sa.false()`). Applied-revision tracking via `alembic_version` = idempotent re-run. Multi-instance safety: `_run_migrations` runs under `pg_advisory_lock(_MIGRATION_LOCK_KEY)` (`database.py:491`, unlocked at `:501`) so two Postgres app instances can't race the runner; re-reads `{versioned,legacy}` state inside the lock (`:495`). Runner is off-thread (`asyncio.to_thread`, `:499/:503`) — no loop block. SQLite dev is single-process (advisory-lock no-op is documented-safe).
- **database.py** — `pool_pre_ping=True` (stale-connection heal); SQLite `PRAGMA journal_mode=WAL` + `busy_timeout=5000` for dev concurrency; sessions are `async with`-scoped (auto-close/rollback); the shared-DB test gotcha is the documented process-global engine, not a new bug.
- **config.py fail-closed** — every deployed-context secret refuses to boot on a dev/empty value: `is_deployed()` (`:237`) is the fail-closed predicate (the prior `environment=="production"` check failed *open* on a mistyped value — now closed); demo seeding "hard-refuses in production" (`:43`); `session_secret` dev default fails startup when deployed (`:60-63`); a configured-but-unreachable avscan fails **closed** (503, `:152-155`). No secret logged; edge/session secrets covered by BE-7's boot-guard verification.
- **run_executor.py** — every fault-isolation property present: `CancelledError` (BaseException) caught **distinctly** from `Exception` so shutdown never strands a 'running' row (`:40-47`); last-resort `except Exception → _mark_run_failed(str(e)[:2000])` (`:48-50`); `_mark_run_failed` itself guarded (`:94`); vault export is best-effort and swallowed so it can't fail a good run (`:61-73`). Orphan recovery on both backends: SQLite boot-sweep marks stranded `running`/`queued` → failed (`:118-123`); Postgres `QueueWorker` claims via `FOR UPDATE SKIP LOCKED LIMIT 1` (`:201-231`), leases (`caos_run_lease_seconds=600`), re-claims on genuine death, and reaps `attempts>=MAX` → failed (`:188-198`). Loop never dies (`:248`, escalates to error after 3 consecutive failures so a stalled queue is distinguishable). Concurrency capped at `caos_run_concurrency=2` (`:240`).
- **research_executor.py** — verified in BE-4 (`_run_research` try/except→`_mark_failed`, semaphore-gated); consistent with run_executor.
- **ingest.py** — upload is **streaming size-capped** (reads to `limit`, 413s before full buffering, `:50-57`); avscan fail-closed (config); filename sanitization (`re.sub([^A-Za-z0-9._-],_) + uuid dir`) + no-OCR both verified/adjudicated in BE-6.
- **seed.py** — per-entity idempotent (not empty-DB-gated): `seed_demo_data` get-or-create by id ("insert if missing, else backfill", `:51-53`); `seed_metrics` provenance-scoped replace (delete `provenance in ("seed","derived")` then re-add, `:165/:187`) — never touches run/fixture facts. Demo seeding is prod-refused (config `:43`).
- **vault_export.py** — off-threaded scan + `_title` traversal guard verified in BE-5/BE-6; export failures never fail a run.

### BE-4 LLM lanes (audited 2026-07-03)

The fault-isolation invariant holds across every lane, verified by reading each
fan-out and fallback. Two independent finders each raised one MED; both
**right-sized to LOW** under adversarial verification once the backstops were
traced. The headline safety property — no LLM lane has executable tools or
performs writes — holds (the only two server-tools are a model-consult that is
off by default and Anthropic's own read-only web search; every other "tool" is a
forced-JSON-schema for structured output, not a callable function).

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE4-1 | LOW | `engine/debate.py:359-362` | `synthesize_debate` fans out `asyncio.gather(narrate(bull), narrate(bear))` **without** `return_exceptions=True`, unlike every sibling fan-out (council `:119/:173`, synth). Right-sized MED→LOW: behaviourally inert today — `LiveDebater.narrate` swallows every exception → `_prose` (`:310-312`) and `FixtureDebater.narrate` can't raise, so no exception reaches the gather; and even if one did, `runner._attempt_synth` catches it → per-module Blocked (run survives). Pure hygiene/asymmetry: fragile against a future refactor that lets `narrate` raise, where it would Blocked-the-module instead of degrading to deterministic prose. One-line fix (add `return_exceptions=True` + filter). |
| BE4-2 | LOW | `deepresearch.py:280` | The M-2 overload fallback's retry `msg = await _final_message(fb_model)` sits **outside** the try/except that guards the primary call (`:273-277`). A correlated double-overload (heavy **and** cheap model both 529 — the exact condition that triggered the fallback) propagates out of `run_deep_research`, defeating the fallback's own stated goal ("rather than 502-ing the whole report", `:271-272`). Right-sized MED→LOW: caught by `research_executor._run_research`'s last-resort `except Exception → _mark_failed` (`:90-92`, `_mark_failed` never raises), so the job is marked **failed cleanly** (never stranded/crashed, poll surfaces "failed") — graceful isolation, not a run-abort. Completeness gap: should degrade to `_demo_report()` on double-overload instead of failing the job. Run-less interactive lane; not part of the run DAG. |

#### Verified-clean highlights (what was checked and held)

- **Timeout on ALL clients** — `caos_llm_timeout_s` (120s) passed by every provider: Anthropic (`llm.py:60`, and at each lane build — `synth.py:375`, `council.py:99`, `debate.py:276`, `nlquery`, `queryoverlay`, `scenario`), Gemini (`gemini.py:57`, ms-scaled), OpenRouter (`openrouter.py:160`). `test_synth_live.py` asserts synth/council/debate build with it. No provider misses it.
- **Council fault isolation is the textbook pattern done right** — both fan-outs `gather(..., return_exceptions=True)` (`:119`, `:173`) AND the Exception results are **filtered** before use (`:122-126`, `:176-180` zip + skip `isinstance(_, Exception)`). The classic "gather-then-index-the-Exception" bug is **not** present. Peer round + fixture fallback both hold.
- **Per-lane patterns** — synth = per-module Blocked gate + one-shot repair; debate narration = per-advocate try/except→`_prose`; nlquery/scenario/queryoverlay = try/except → deterministic keyword/demo mapper; chat/deepresearch = degrade-to-demo on missing key. `llm_client.create` re-raises only overloads (same-provider cheaper retry, `:90/:130`), everything else surfaces typed for the caller to catch.
- **No tools / no writes** — the only two server-side tools in the entire engine are `advisor_20260301` (synth, `advisor_enabled` **off by default**, a model-consult — no exec/FS/DB/network write) and `web_search_20260209` (deepresearch — Anthropic's server-side **read-only** web search, output treated as untrusted data, non-`http(s)` URLs dropped at `:176`). No `code_execution`/`bash`/`computer_use`/`text_editor`/user-defined executable tools. `emit_module_payload`/covenant/route "tools" are forced-JSON-schema (structured output). LLM lanes perform no writes — `budget.trace_llm`/`record_usage` mutate only an in-process ContextVar + a log line.
- **Provider degrade** — `presets.model_for` substitutes `_ANTHROPIC_FALLBACK[tier]` when `openrouter_api_key`/`gemini_api_key` is unset, so a slash-id never reaches `openrouter.call`'s missing-key `RuntimeError` in the keyless default. Tested (`test_presets.py`).
- **llm_safety.py** — gates indirect prompt injection (`UNTRUSTED_RULE`+`wrap_untrusted`), citation forgery (`safe_chunk_id`), non-finite output (`loads_finite` fail-closed, `ValueError`/JSONDecodeError so existing handlers catch), optional Pydantic shape-validate→None. Injection defense is defense-in-depth by design (output schema-clamped + CP-5-gated).
- **Security** — no `anthropic_api_key`/Authorization logged (fallback warnings log `type(exc).__name__` only); OpenRouter URL hard-coded (no base_url override → no SSRF); no model output eval'd/exec'd; async clients throughout (no sync-blocking on the loop); fallbacks single-shot (no retry spin). `report.py` is a pure read-only assembler (no LLM lane).
- **Fan-out bounded** — council `min(seats,4)` × ≤2 rounds, debate exactly 2, deepresearch `_MAX_CONTINUATIONS=4` × mode-capped searches; all `budget.llm_allowed()`-gated. No BE-5-class uncapped run-history scan in these lanes.
- **Out of BE-4 scope (noted for a BE-5 re-touch, not counted here):** finder A surfaced two `nlquery.py` items (BE-5 territory, already audited) — metric-filter guard uses plain `float()` (accepts `"NaN"`/`"Infinity"`) not `loads_finite`, and `_llm_translate` uses plain `json.loads` — both soft empty-result on the non-financial NL-query lane, no numeric spec field reaching a divide. Gemini `get_client()` `lru_cache` freezing timeout/key at boot is by-design (boot-only config), dropped.

### BE-2 Analytics modules (audited 2026-07-03)

The compute layer where the divides live is the best-defended slice yet on the
CLAUDE.md invariant: every module that divides a CP-1 figure gates its inputs
through `is_finite_number` (or collapses NaN/inf to None first) **and** guards
the denominator against 0, and the `latest()` NaN pass-through is re-gated at
every consumer. Both residual code findings are defense-in-depth only — the
non-finite input is unreachable because the sole producers (the `amount_musd`
regex, the `is_finite_number`-gated `MetricFact` writer at `metrics.py:145`,
hard-coded seed literals) cannot emit NaN/inf. All three are LOW.

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE2-1 | LOW | `engine/liquidity.py:120-121` | The disclosed-liquidity sum filters values with bare `isinstance(f["amount_musd"], (int, float))`, **not** `is_finite_number`, before `round(sum(...), 1)`. A NaN amount would pass isinstance (`bool(NaN)` is True), sum to NaN, and ship a raw `disclosed_liquidity_musd = NaN` + a "~$nanM" summary string — the runway divide's guard (a) (`liquidity.py:76`) catches it for the ratio, but the raw figure still reaches the payload. Unreachable today: the only producer is `textscan.amount_musd`, whose `_to_musd` casts a `[\d,]+(?:\.\d+)?` regex group — cannot match `nan`/`inf`. Cross-module inconsistency (every sibling — `capstructure.py:146`, `relval.py:50` — uses `is_finite_number` for the same "sum/aggregate sized values" op); one-line fix. Verified: the runway divides at `:89` (`ebitda/coverage`) and `:99` are fully gated (guard (b) `is_finite_number(ebitda) and is_finite_number(coverage) and coverage`). |
| BE2-2 | LOW | `engine/peers.py:125,134` (`_peer_facts`) | `peer_vals`/`iv` are read from the `MetricFact` store and fed to `_percentile` (divides by `len`) and `median()` with no **per-value** finite gate — the "leaf-gated but container-not" class applied to a DB read rather than `runtime_output` (sibling of BE3-6/BE5-3). A NaN `MetricFact.value` → NaN peer_median + NaN-poisoned percentile for other issuers. Empty `peer_vals` **is** guarded (`:126`). Unreachable today: all three write paths gate on the way in — `extract_facts`/`extract_cost_facts` via the `add()` closure's `is_finite_number` (`metrics.py:145`), and `seed.py` writes hard-coded float literals; no migration backfills values. Trust-boundary hygiene, not a live defect. |
| BE2-3 | LOW (test) | `test_liquidity.py`, `test_recovery_waterfall_contract.py` | No NaN/inf-amount case in either suite: the liquidity sum (BE2-1 line) and the `capstructure.py:96` `is_finite_number(claim) and claim>0` recovery guard are never exercised with `float('nan')`. Both guards are correct today and the inputs unreachable, so this only pins intent — a regression swapping `is_finite_number`→`isinstance` at those lines would pass the whole suite. Pairs with BE2-1. |

#### Verified-clean highlights (what was checked and held)

- **`distress.py`** — `altman_z_double_prime` gates every input via `is_finite_number` (`:74-77`) **before** the `total_assets<=0`/`total_liabilities<=0` denominator guards and the four X-term divides (correct ordering — a NaN fails the finite check first). 8 nan/inf test refs.
- **`downside.py`** — `is_finite_number(lev)` gate (`:66`), fixed `_SHOCKS` {0.10,0.20,0.30} so `1-s` ∈ {0.9,0.8,0.7} never 0 (`:75`), coverage re-gated per-scenario (`:78`). Documents the NaN-comparison trap inline.
- **`earnings.py`** — explicit NaN/inf→None collapse at `:80-83` (comment names the `bool(NaN)` trap), then ÷0 guards at `:33` (`if not prev`) and `:91` (`and revenue`) before the margin/YoY divides.
- **`macro.py`** — `_finite()` (= `is_finite_number`) collapses net_debt, `latest(adj_ebitda)`, and coverage to None before every divide (`:72-82`); zero-denominators guarded (`not eb`, `and cov`, `if new_interest`). The `isinstance` checks are belt-and-suspenders after `_finite`.
- **`scenario.py`** (`caos/server/scenario.py`) — `validate_scenario` collapses NaN/inf→0.0 (`:57-58`, comment: "json.loads/pydantic admit them → poison the projection") then clamps to bands; regex-only `float()` casts.
- **`relval.py`** — filters `is_finite_number(percentile)` before `round(sum/len)`; empty `ranked`→None. **`refinancing.py`** — pure banded scoring, `is_finite_number(leverage)` gate, no CP-1 divide. **`coststructure.py`** — no arithmetic, regex pass-through, no LLM call. All well-tested (11 / contract nan-refs).
- **`capstructure.py`** — recovery_waterfall gates `claim` (`:96`), floors `remaining_ev` at 0, divides only after `claim_is_sized` (>0); `pct_of_structure` guarded by `total and is_finite_number`; sized-sum uses `is_finite_number` (`:146`); `preference[0]` safe via `not found` early-return.
- **`covenants.py`** — every divide double-gated (ebitda backout `:315`, cushion `1-lev/thr` with `thr != 0` `:368`, addback `load/cap_pct` with `cap_pct>0` `:448`, pro-forma `:325`). LLM lane `_llm_covenant_terms` correctly fault-isolated: try/except → deterministic regex fallback (`:290-293`), every LLM amount re-gated via `amount_term` (`is_finite_number and not bool and >0`, `:251`). Beyond the known BE3-6 latent gap at `:522`.
- **`metrics.py`** — no NEW divide/NaN issue beyond the recorded BE3-2 (`:227-229`), BE3-3 (`:122-190`), BE5-3 (`:200-211`); the `extract_facts` divides (`:166,176`) and `leverage_plausibility_finding` (`:233`) are double-gated with the abs()-denominator fix in place. The fact-store `add()` gate (`:145`) is what makes BE2-2 unreachable.
- **Scan/mapping modules** (`catalysts.py`, `legal.py`, `sponsor.py`, `portfoliofit.py`) — no divides; keyword/regex scanners + RV→sizing mapping. Clean on the divide/NaN lens; no LLM calls.

### BE-1 CP-1 spine (audited 2026-07-03)

The CP-1 ingest is the most disciplined slice reviewed so far — the
`is_finite_number` invariant is applied where it matters and the external
(EDGAR) trust boundary is hardened across several prior passes. One genuine LOW
survives; everything else verified clean.

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE1-1 | LOW | `engine/edgar_cp1.py:256-257` | Interest-coverage divide guards `int_ly[0]` **truthy** but not `> 0`, unlike the leverage divide one line up (`:252`, which checks `eb_ly > 0` and `net_debt > 0`). A US filer that tags its `_INTEREST` concept as a negative XBRL value → `eb_ly / negative` emits a negative `interest_coverage_ltm` — a wrong (nonsensical) but **finite** figure, never a NaN or crash (the value is is_finite-gated at `:118`). Right-sized LOW: low-probability (interest-expense concepts are conventionally tagged positive; no sign normalisation is done), the output is visibly-absurd (negative coverage) rather than plausibly-wrong, and it's a one-line fix (`and int_ly[0] > 0`) that restores symmetry with the leverage guard. Not covered by tests — `test_interest_coverage_*` exercise freshness, not sign. |

#### Verified-clean highlights (what was checked and held)

- **`is_finite_number` itself** (`periods.py:67-81`): `isinstance(x,(int,float)) and math.isfinite(x)` — correctly rejects NaN/±inf, accepts `bool`/`0`/int/float. TypeGuard narrowing intact.
- **NaN ingress at the EDGAR boundary**: `edgar_cp1.py:118` gates every raw XBRL `val` through `is_finite_number` before it enters a CP-1 series — the JSON decoder parses `NaN`/`Infinity` tokens, and this is the documented parse-boundary reject (confidence-review 2026-07-01). No non-finite value reaches the fact pack.
- **Zero-denominator degrade**: `edgar_cp1.py:252` (`eb_ly>0 and net_debt>0`) and `adjusted.py:161/170/172/177` — the adjusted reconcile is the textbook CLAUDE.md pattern: `is_finite_number(lev/nd/disclosed)`, `lev != 0` before `nd/lev`, and `if ebitda_excl <= 0: return None` **before** the `nd/ebitda_excl` divide (the pct→1 case). Tested in `test_adjusted_guards.py` (divide-by-zero, over-100%-addback, NaN-leverage all → None).
- **`float()` casts never raise on filing text**: `reported_cp1.py:61/75/91` and `textscan.py:27` cast only regex-captured `[\d,]+(\.\d+)?` groups (comma-stripped) — always valid floats; the one non-regex path (`_amount`) is `try/except ValueError → None`. Leverage is range-gated 0.5–15.0.
- **Event loop**: the only blocking I/O in scope is `edgar.py`'s stdlib `urllib.urlopen`, and it is always reached via `await asyncio.to_thread(edgar_cp1.fetch_cp1, …)` (`runner.py:575`) — never on the loop. `reported_cp1`/`factpack` are pure BM25-over-ingested-chunks (bounded `retrieve` k=12 / k=8).
- **SSRF / external trust boundary** (`edgar.py`): `fetch_exhibit` requires `https` + **exact** `www.sec.gov` host + `/Archives/` path and rejects embedded userinfo (`@`); `_http_get` re-checks the **post-redirect** host is `sec.gov`/`.sec.gov` (blocks an open-redirect bounce off-host); byte-cap enforced; UA-required off-switch; raw network errors masked from the client. JSON API only — no XML parse → no XXE.
- **Deterministic (no LLM)**: no LLM call in BE-1 files; `fetch_cp1` failsafes on malformed facts (`test_edgar_cp1.py:148`).
- **`periods.latest` NaN pass-through** is **by design, not a defect**: its `isinstance` filter can return a NaN, which is exactly why every consumer gates the result (e.g. `adjusted.py:169-170` `is_finite_number(disclosed) and disclosed>0`). Its non-dict-raise is already recorded as BE3-2; no in-scope consumer divides an ungated `latest()`.
- **`lineage.py`** validation is covered by BE-3's gate-exception-safety sweep (provably no-raise); `fixtures.py` is static deterministic data (no eval/format/path exposure).

### BE-5 Query lane (audited 2026-07-03)

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE5-1 | **MED → FIXED 2026-07-03** | `engine/querygraph.py` (`_cluster_by_wiki`) | Wiki-links graph loads full ORM `select(Run, Issuer)` rows for **every run in history** (Run is append-only, never pruned) and emits one node+edge per run, all at fixed position (0.5, 0.5). Payload then json.dumps'd into the overlay LLM prompt (`queryoverlay.py:288`) and sorted per call in `_graph_hash`. The residual unfixed instance of the uncapped-scan class cfacf8a closed elsewhere. Fix: latest-N-per-issuer window + node cap like `_GATE_NODE_CAP`; real positions. |
| BE5-2 | LOW | `engine/querygraph.py:497, 1089` | Covered-issuers probe `select(Run.issuer_id)` lacks `.distinct()` — O(total runs) rows into Python per concentration-map/wiki request. One-word fix (contrast `_coverage`, already DB-DISTINCT). |
| BE5-3 | LOW | `engine/metrics.py:200-211` + `engine/querygraph.py:377-389` | `extract_cost_facts` casts `energy_cost_pct` with bare `float(val)` — the one fact-projection path without `is_finite_number`; `_contagion` consumes with unguarded `round(v)`. Downgraded from MED: NaN ingress is CLOSED (loads_finite on both synth paths; verified), key name never appears in prompt corpus, so only a model-invented non-numeric string reaches `float()` → run abort. Defense-in-depth one-liner. |
| BE5-4 | LOW | `nlquery.py:647-695` (`execute_synthesis`) | Corpus build json.dumps's up to `_SYNTH_SCAN_CAP=2000` full `runtime_output` payloads + BM25-tokenizes on the event loop. Row-capped, per-item size uncapped — worst realistic stall sub-second to low seconds near cap. Fix: truncate per-item text and/or `asyncio.to_thread`. |
| BE5-5 | LOW → **RESOLVED (deleted) 2026-07-03** | `engine/runner.py:487-499` vs `engine/querygraph.py` (was :150-160, :1031-1090) | DATA-1 retention keeps ≤1 fact-bearing run per issuer, so the `runs2` availability flag and `_diff` (run-diff / coverage-changed walks) were **structurally dead**. **Adjudicated: delete the dead lanes** (user decision 2026-07-03). Removed: the "versions" capability group (run-diff + coverage-changed), the `runs2` probe + reason + availability flag, the `focus=="diff"` dispatch, the `_diff` builder; frontend twins in `lib/query/routing.ts` (diff/changed keywords), `lib/query/questions.ts` (question + engine-note entries), `shared/Ask.tsx` (2 starters). Verified: zero remaining refs (overlay tests use "run-diff" only as arbitrary self-contained fixture ids); 870/2 server, 335/335 vitest, ruff+mypy clean. Uncommitted — `querygraph.py` also carries a parallel session's `_scatter` WIP hunk, so the commit is deferred to keep it atomic. |
| BE5-6 | LOW | `vault_export.py:396-410` via `routes/query.py:69, 98` | `_scan_memo_files` rglobs the entire vault (Runs/ and Issuers/ filtered *after* traversal) on every /capabilities and /graph request. Off-threaded (prior fix holds — no loop block); cost is O(vault-files) stats per request. Fix: prune dirs during walk or TTL the mtime probe. |

### BE-3 Orchestration + gates (audited 2026-07-03)

Systemic pattern (BE3-1/2/3 + BE5-3 = one fix): QA-finding + fact-projection
code trusts **interior containers** of `runtime_output` — `or {}` doesn't defend
against truthy wrong types (`"not disclosed"`, list-of-objects), and any raise
in that phase (inside the fatal try, `runner.py:367/509-513`) marks the run
failed and rolls back **all** completed module outputs. Failed is terminal (no
auto-retry; manual re-run typically succeeds — fresh stochastic output). Leaf
values are already gated; the containers are not. ~6 call sites, all
`metrics.py`/`adjusted.py`. All downgraded MED→LOW on reachability: interior
shapes come from a pinned (best-effort) tool schema, deviation is rare, and the
blast radius is one cleanly-failed run, never a wrong number.

| ID | Sev | Where | Finding |
|---|---|---|---|
| BE3-1 | LOW | `engine/adjusted.py:218-219` | `reconciliation_finding`: truthy non-dict `adjusted_ebitda_reconciliation` → `ro.get` AttributeError → run abort. Key is engine-internal (never prompt-named); runner overwrite (`runner.py:170-173`) usually replaces it. Container guard one-liner. |
| BE3-2 | LOW | `engine/metrics.py:227-229` + `engine/periods.py:63` | `leverage_plausibility_finding`: non-dict `normalized_financials`/`adj_ebitda` raises before the `is_finite_number` guard; `periods.latest` does not tolerate non-dict input. Reachable only on live-LLM last-fallback CP-1 (EDGAR + reported preempt). |
| BE3-3 | LOW | `engine/metrics.py:122-190` (`extract_facts`) | Interior containers fin/rev/eb/fcf/lev/dz accessed `.keys()/.items()/.get()` after `or {}` — widest surface of the class; aborts a fully-completed run at final projection. Fix first via one `_as_dict()` coercion pass. |
| BE3-4 | LOW | `engine/planner.py:383-387, 249` | `build_route_plan` applies `set()`/`int()`/`.lower()` to unvalidated CP-0 output — reachable only when the issuer row is deleted mid-run with a live key (LLM CP-0 path, `runner.py:139`); called outside the per-module guard. |
| BE3-5 | LOW | `engine/registry.py:172-200` | `_validate_registry` doesn't reject duplicate module_ids (dict last-wins silently). Latent hygiene on a static import-validated 23-spec tuple; verifier refuted the claimed planner double-count consequence (Kahn leftover backstop holds). Fix: `assert len(REGISTRY) == len(_SPECS)`. |
| BE3-6 | LOW (latent) | `engine/covenants.py:522`, `engine/earnings.py:200`, `engine/peers.py:176-185` | Same container-gap class in three gates whose producers are deterministic code today (CP-4C/1B/1C code-built) — unreachable until an LLM/replay producer appears. Guard when touched. |
| BE3-7 | LOW | `engine/planner.py:349-361` | `gate_status=BLOCKED` is advisory — runner never consults it for execution (only persisted via `_cpx_confidence`); zero-source runs execute degradable modules (flagged + CP-5-gated by design). Docstring says "blocks outright" — docstring fix, not runtime defect. |

### Verified-clean highlights (what was checked and held)

- **Gate exception safety**: 15 gate-phase consumers examined; `gate.py` roll-ups, lineage validation, covlite/demo-fixture gates, council review (both fan-outs `return_exceptions=True`) provably no-raise on arbitrary input.
- **`is_finite_number` discipline**: every divide/multiply in BE-3 scope gated (schemas.cp1_leverage, adjusted, covenants cushion/utilization, earnings margins/yoy, metrics tolerances with abs(), peers) — sole miss is BE5-3. Zero-denominator paths degrade to None.
- **Abort semantics**: module raise → per-module Blocked + CRITICAL lane-7 finding, dependents blocked, run continues. Budget exhaustion → module Blocked, deterministic modules unaffected. Orphan sweep + CancelledError handling verified.
- **DAG integrity**: import-time registry validation (dangling deps, declared-before), deterministic Kahn ordering, cycle fail-loud in runner, VE-009 exclusion first-declared-wins. Budget accounting monotone across re-claims.
- **Query-lane caps**: availability HAVING…LIMIT 1, `_committee` DISTINCT, `_gate_lane` LIMIT 300 severity-first, window rn==1 fact collapses, `_CORPUS_SCAN_CAP=5000`, `_SYNTH_SCAN_CAP=2000`, shared-theme/claim-audit 12-member caps, `_latest_run` 200-probe bound.
- **Event loop**: no sync FS/DB on any async path in scope; vault scan + reads via `asyncio.to_thread` with mtime fast-path; all LLM calls awaited under 120s timeout; /route never touches the vault.
