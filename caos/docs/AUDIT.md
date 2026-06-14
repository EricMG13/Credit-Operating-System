# CAOS — Codebase Audit

**Audit date:** 2026-06-14 (re-audit after the NL-query / CP-2 / Scenario-Builder
work; supersedes the earlier 2026-06-14 pass).
**Scope:** `caos/` — FastAPI server (~4.0k LOC Python, 35 files), Next.js frontend
(~14.2k LOC TS/TSX, 85 files), config, CI, tests. The `Modular OS/` corpus is
analytical-methodology prose, not code, and is out of scope.

> Companion to [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), [TIER1_ENGINE_PLAN.md](TIER1_ENGINE_PLAN.md),
> [SECURITY.md](SECURITY.md), [IA_REVIEW.md](IA_REVIEW.md). Severity legend:
> **P0** blocks deploy · **P1** ships broken · **P2** degrades quality/security
> · **P3** nice-to-have.

## Health snapshot (all green)

Frontend: eslint ✓ · `tsc --noEmit` (strict) ✓ · **98 vitest ✓** · `next build` ✓
(12/12 static pages, export OK). Server: **73 pytest ✓**.
CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) runs lint + tsc +
vitest + build on the frontend job and pytest on the server job, so the new tests
are gated. No committed secrets/DB/vault (`.gitignore` covers them), no
`TODO/FIXME` in app code, no SQL string-building, no `eval`/`exec`, no
`shell=True`, Alembic chain linear (`0001→0002→0003`), `tsconfig` strict.

**Verdict:** a well-built, deploy-ready codebase — **no P0/P1**. This round's work
materially advanced the engine: a real QA-gated CP-2 cost-structure module,
a structured `metric_facts` store, cross-issuer NL query (structured + semantic +
hybrid) grounded in real evidence with a run/derived/seed provenance ladder,
click-to-source, and a Scenario Builder — all identity-gated, typed, lint-clean,
and tested. Open findings are P2/P3 hardening.

## Findings register

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| SEC-1 | P2 | Rate limit | The read GETs `/api/query/catalog` and `/api/query/chunk/{id}` were identity-gated but not rate-limited (the NL POSTs are). `chunk` hits the DB per call. | **Fixed** — `_read_rate_guard` (60/min/caller) on both ([routes/query.py](../server/routes/query.py)); 73 pytest still green. |
| D-1 | P2 | Deps | **7 npm advisories (2 moderate + 5 high).** The 2 moderate are **postcss `<8.5.10`** (CSS-stringify XSS) pulled transitively by **Next.js's build tooling** (`next/node_modules/postcss`) — so it sits in the prod dep *tree*, but is **build-time only** with no untrusted-CSS path in this app. The 5 high are the vite/esbuild/vitest dev chain. | **Accepted-risk** — none exploitable in this app's usage; `npm audit fix --force` would downgrade Next to 9.3.3 (**do not run**). Pin to upstream Next/esbuild bumps. |
| DATA-1 | P3 | Storage | `metric_facts` run-derived rows accumulate one set per run (deduped to the latest run at query time, never pruned) → unbounded growth as runs scale. | Open — add retention / "latest-run-per-issuer" prune before opening runs widely. |
| PERF-1 | P3 | Query | Hybrid `execute()` issues one `retrieve_corpus` per ranked issuer (N calls). Fine at demo scale (≤10 issuers); N+1 at portfolio scale. | Open — batch retrieval if issuer count grows. |
| F-1 | P2 | Tests | Logic is well covered (73 pytest incl. nlquery/scenario/CP-2/extraction; 98 vitest incl. buildScenarios/format/translators), but the new React components (`NlQuery`, `CitationViewer`, `ScenarioPanel`) have no RTL render/interaction tests. | Open (cont.) — lib + endpoint coverage strong; component/page coverage still growing. |
| S-4 | P3 | Authz | No per-issuer / row-level authz — any authenticated analyst can read any issuer. The new `/query/*` + `/scenario` **widen this cross-issuer surface** (any analyst can read any issuer's chunks/metrics). | **Documented** ([SECURITY.md](SECURITY.md) §2) — single-team-by-design; build per-issuer authz only if multi-tenant. |
| F-2 | P3 | Types | Localized `any` confined to [reports/model.ts](../frontend/src/lib/reports/model.ts) + whole-file `eslint-disable` on the large mock-data files. New code is `any`-free. | Open (acceptable for generated data; no regression). |
| A-1 | — | Architecture | **Mock-vs-engine gap — narrowing.** This round added real engine output: CP-2 (gated, cited), `metric_facts`, NL query grounded in real evidence with provenance, the citation viewer. Still: most deep-dive/report UI is seeded mock; the Scenario Builder + scenarios lens drive the **panel only**, not the model grid's BASE/DOWN columns; `energy_cost_pct` is run-derived for run issuers / seed-derived otherwise. | Known — the gap is smaller but real. |
| S-1/2/3, B-1/2 | P2/P3 | Security/Seed/Ingest | Prior round: fail-closed auth gate (S-1), security-headers middleware (S-2), forwarded-identity trust model (S-3), demo-seed flag (B-1), untrusted-doc parsing surface (B-2). | **Fixed / documented** (see below) — unchanged this round. |

## Fixed / addressed
- **SEC-1** (this round) — read rate guard on `/query/catalog` + `/query/chunk`.
- **S-1** — fail-closed auth keyed off `DATABRICKS_APP_PORT` ([identity.py](../server/identity.py)).
- **S-2** — security-headers middleware ([main.py](../server/main.py)), verified live, no CSP violations.
- **S-3 / S-4** — forwarded-identity trust model + single-team authz decision in [SECURITY.md](SECURITY.md).
- **B-1** — demo-seed flagged demo-only in app.yaml + production-seed WARNING in main.py.

## Verified clean (this round)
- **Auth:** every route `Depends(get_identity)`; only `/health` open. All four new endpoints (`/query/nl|catalog|chunk`, `/scenario/nl`) gated; POSTs + (now) read GETs rate-limited.
- **Injection:** no `text()`/string-built SQL; parameterized SQLAlchemy throughout; new `ilike(f"%{v}%")` passes the pattern as a bound param.
- **`subprocess` (markitdown spike):** list form (no `shell=True`), operator-configured command, content→temp file, timeout + swallowed failures — no shell-injection surface.
- **LLM endpoints** (`nlquery`, `scenario`): output validated/clamped to a closed schema, `max_tokens` caps, `try/except`→deterministic offline fallback, rate-limited; the model never authors SQL.
- **Frontend:** 0 `dangerouslySetInnerHTML`, 0 `eval`, 0 stray `any` outside the known mock files.

## Recommended next
1. **DATA-1** — `metric_facts` retention/prune before scaling runs.
2. **D-1** — track upstream Next/esbuild for the postcss + dev-chain advisories; never `audit fix --force`.
3. **F-1 (cont.)** — RTL tests for `NlQuery` / `CitationViewer` / `ScenarioPanel`.
4. **S-4** — per-issuer authorization only if the threat model expands to multi-tenant.

## Notably well done
- Identity on every route via `Depends(get_identity)`; only `/health` open. Rate limits on all mutating/LLM endpoints.
- Consistent "prefer-live / deterministic-fallback" seams (useLiveRun, useModelEngine, nlquery, scenario) so the offline demo always works and real output overlays when present.
- Uploads: incremental size-cap, magic-byte MIME sniff, path-traversal-safe storage; idempotent seed; Alembic migrations; same-origin single-process serving (no CORS surface).
- Strict TypeScript; WCAG-AA + colorblind-safe design system; evidence/citation lineage one click from source.
