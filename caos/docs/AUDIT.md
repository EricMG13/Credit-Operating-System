# CAOS — Codebase Audit

**Audit date:** 2026-06-16 (full re-audit after the EDGAR engine stack (#13),
the DM/loans re-model (#14), and the retention / N+1 / async / budgeting work;
supersedes the 2026-06-14 pass).
**Last reconciled:** 2026-07-10 — health snapshot + the S-4 / PERF-2 / A-1 rows
refreshed against shipped code from the pre-production security-audit branch (NaN
guards, run dedup, durable research, opt-in tenancy, the CP-5 completeness lane,
and the Command QA-queue live slice).
**Scope:** `caos/` — FastAPI server (~6.8k LOC Python, 51 files), Next.js frontend
(~14.7k LOC TS/TSX, 87 files), config, CI, tests. The `Modular OS/` corpus is
analytical-methodology prose, not code, and is out of scope.

> Companion to [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), [TIER1_ENGINE_PLAN.md](TIER1_ENGINE_PLAN.md),
> [SECURITY.md](SECURITY.md), [IA_REVIEW.md](IA_REVIEW.md), [LAUNCH_PHASE1.md](LAUNCH_PHASE1.md).
> Severity legend: **P0** blocks deploy · **P1** ships broken · **P2** degrades
> quality/security · **P3** nice-to-have.

## Health snapshot (all green)

Frontend: eslint ✓ · `tsc --noEmit` (strict) ✓ · **419 vitest ✓** · `next build` ✓
(16/16 static pages, export OK). Server: **1308 pytest ✓** (2 Postgres-only worker
tests skipped on the SQLite default suite; the worker/reaper/claim lane runs green
against pgvector/pg16 in the CI Postgres step).
CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) runs lint + tsc +
vitest + build on the frontend job, pytest on the server job, and a Docker image
build — so the tests and the deploy image are gated. No committed secrets/DB/vault
(`.gitignore` covers them), no `TODO/FIXME` in app code, no SQL string-building,
no `eval`/`exec`, no `shell=True` (except the operator-configured markitdown spike,
list-form), Alembic chain linear, `tsconfig` strict.

**Verdict:** a well-built, deploy-ready codebase — **no P0/P1**. Since the last
audit the engine grew materially and is no longer a 3-module slice.

> **Status (as of the shipped engine):** the engine now wires **19 implemented
> modules** (+ 4 spec-only) per [`registry.py`](../server/engine/registry.py) — the
> "7-module DAG" below was an earlier snapshot. The full implemented set is CP-0,
> CP-1/1A/1B/1C, CP-2/2B/2C/2D/2E/2F, CP-3/3B/3C/3D, CP-4/4C, CP-6A/6E.

It runs a multi-module analytical DAG — CP-0 SourceReadiness, CP-1 (with the EDGAR
XBRL→CP-1 deterministic lane), **CP-1A BusinessTransactionFactPack**, **CP-1B
EarningsDelta**, **CP-1C PeerBenchmark**, **CP-2 FundamentalCreditSynthesizer**
(*its canonical name and analytical role — the 9-dimension fundamental synthesis;
`CostStructure` is only the degraded offline-fixture output, not the module's
purpose*), **CP-4C covenant capacity**, and the rest of the registry — gated by
**CP-5B** lineage, the opt-in **CP-5C** adversarial council, and the **CP-5** gate
(the LLM never sets its own committee status). Plus: async run execution + per-run
token budgeting, a `metric_facts` store with retention, cross-issuer NL query
(structured + semantic + hybrid), a Scenario Builder, and an Altman-Z distress
score — all identity-gated, typed, lint-clean, tested. Open findings are P2/P3
hardening, led by the live-synthesis path (SYNTH-1).

## Findings register

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| SYNTH-1 | P2 | Engine/Tests | **Live synthesis is the least-defended path.** `LiveSynthesizer._parse_payload` ([engine/synth.py](../server/engine/synth.py)) extracts JSON with a greedy `re.search(r"\{.*\}")` + `json.loads` — no structured output / tool use, no repair, no retry; a truncated (`max_tokens`) or prose-wrapped response → `SynthesisError` → the module (and its downstream consumers) are Blocked. **Zero live-path test coverage:** `conftest.py` / `test_api.py` force `ANTHROPIC_API_KEY=""`, so all 171 pytest run fixture-only. | **Resolved** — forced tool use (`emit_module_payload`, `tool_choice` forced — [synth.py:305](../server/engine/synth.py)) + a one-shot, budget-gated repair turn ([synth.py:355](../server/engine/synth.py)); mocked-Anthropic live-path tests landed ([test_synth_live.py](../tests/server/test_synth_live.py), 25 cases: well-formed / truncated / prose-wrapped / schema-violating). The greedy `re.search(r"\{.*\}")` survives only as a recoverable fallback *behind* the forced `tool_choice`. `validate_payload` ([schemas.py](../server/engine/schemas.py)) still gates enums. |
| SEC-1 | P2 | Rate limit | The read GETs `/api/query/catalog` and `/api/query/chunk/{id}` were identity-gated but not rate-limited. | **Fixed** — `_read_rate_guard` (60/min/caller) on both ([routes/query.py](../server/routes/query.py)). |
| D-1 | P2 | Deps | **8 npm advisories (2 moderate + 6 high).** The 2 moderate are **postcss `<8.5.10`** pulled transitively by Next.js build tooling (build-time only, no untrusted-CSS path). The high set is the **vite/esbuild/vitest dev chain**, incl. the esbuild dev-server arbitrary-file-read advisory (dev-server-on-Windows only). None ship in the static export. | **Accepted-risk** — none exploitable in this app's usage; `npm audit fix --force` downgrades Next (**do not run**). Track upstream Next/esbuild bumps. |
| DATA-1 | P3 | Storage | `metric_facts` run-derived rows accumulating unbounded per run. | **Resolved** — on run completion the runner deletes the issuer's older `provenance="run"` rows ([runner.py](../server/engine/runner.py) "Retention (DATA-1)"); seed facts untouched; covered by [test_retention.py](../tests/server/test_retention.py). |
| PERF-1 | P3 | Query | Hybrid `execute()` issued one `retrieve_corpus` per ranked issuer (N+1). | **Resolved** — `retrieve_corpus_by_issuer` ([retrieval.py](../server/retrieval.py)) does one query + one BM25 pass for the best chunk per issuer ([nlquery.py](../server/nlquery.py)). *(Separate in-flight perf: P4-2 builds the issuer BM25 index once per run rather than per `retrieve()` — on `perf/bm25-corpus-memo`, not yet merged.)* |
| PERF-2 | P3 | Bundle | `/deepdive` first-load JS was **643 kB** (largest route), dominated by the 1.8k-LOC seeded step-outputs. | **Resolved** — the step-outputs register is code-split behind the dynamic `tabs.tsx` import ([deepdive/page.tsx](../frontend/src/app/deepdive/page.tsx):42) — confirmed absent from every route's first-load HTML; and the tear-sheet report tree (`buildReports`) is now lazily imported on first evidence-modal open rather than eagerly on mount. First-load is **~323 kB gzipped** (framework + polyfills + the shared deal/model chunk the eager 3-pane render needs). |
| F-1 | P2 | Tests | RTL component coverage was thin. | **Resolved** — RTL render/interaction tests now cover `EdgarImport`, `evidence-sync`, `primitives`, `issuer-chat-context`, and (this round) **`NlQuery`** ([NlQuery.test.tsx](../frontend/src/components/command/NlQuery.test.tsx), 5 cases), **`CitationViewer`** (4), **`ScenarioPanel`** (5) — 14 new render+interaction cases, mocked API / offline. Frontend vitest 218 passing. |
| DOC-1 | P3 | Docs/Deploy | **Stale "Databricks" references** survive the self-hosted-Docker pivot ([LAUNCH_PHASE1](LAUNCH_PHASE1.md)): [retrieval.py](../server/retrieval.py) docstring (Databricks Vector Search), [routes/auth.py](../server/routes/auth.py) + [identity.py](../server/identity.py) + SECURITY.md §1 (Databricks-Apps auth model). **Functionally sound** — `ENVIRONMENT=production` is fixed in the stack so the identity gate still fails closed, and Caddy strips client `X-Forwarded-*` (both verified in LAUNCH_PHASE1 §5) — but `DATABRICKS_APP_PORT` was still read as a vestigial no-op trigger. | **Resolved** — retrieval/auth docstrings + SECURITY §1 refreshed; the vestigial `DATABRICKS_APP_PORT` branch removed — `config.is_deployed` / identity.py now key on `ENVIRONMENT != development` only. |
| S-4 | P3 | Authz | No per-issuer / row-level authz — any authenticated analyst can read any issuer; `/query/*` + `/scenario` widen this cross-issuer surface. | **Enforcement scaffold shipped (opt-in, default off)** — [tenancy.py](../server/tenancy.py) adds `require_issuer` / `scope_issuers` / `require_run_access` / `block_if_tenancy_unscoped` wired across the issuer-derived spine; `CAOS_TENANCY_ENABLED` (default **off**) gates it, so default behaviour is unchanged single-team. Cross-issuer aggregate lanes fail closed (501) under tenancy; `team_id` on issuers/analysts (migration 0037). `test_tenancy` pins the isolation. Documented [SECURITY.md](SECURITY.md) §2; flip on when multi-user, entitlement-restricted (Bloomberg/MNPI) data lands. |
| F-2 | P3 | Types | Localized `any` confined to [reports/model.ts](../frontend/src/lib/reports/model.ts) + whole-file `eslint-disable` on the large mock-data files. New code is `any`-free. | Open (acceptable; eslint clean, no regression). |
| A-1 | — | Architecture | **Mock-vs-engine gap — narrowing further.** Now engine-derived: CP-1/1A/1B/1C, CP-2, CP-4C, peers, distress, `metric_facts`, NL query, citation viewer, live coverage, and (latest) the **Command QA queue** — [qa.ts](../frontend/src/lib/command/qa.ts) derives it from real CP-5 gate roll-ups on the live portfolio, with the seeded finding list as the offline fallback (per-issuer today; per-finding needs an aggregated findings endpoint). **Still seeded mock:** much of Deep-Dive ([step-outputs.ts](../frontend/src/lib/deepdive/step-outputs.ts)), the rest of the Command boards (gaps, portfolio table), Pipeline sim, Monitor, and the CP-3 RV / CP-3B recovery / CP-6A surfaces; the Scenario Builder drives the **panel only**, not the model grid's BASE/DOWN columns. CP-3 RV is **market-data-gated (Phase 2)**. | Known — smaller but real; tracked as the mock→engine epic. |
| S-1/2/3, B-1/2 | P2/P3 | Security/Seed/Ingest | Fail-closed auth gate (S-1), security-headers middleware (S-2), forwarded-identity trust model (S-3), demo-seed flag (B-1), untrusted-doc parsing surface (B-2). | **Fixed / documented** (see below). B-2 now also covers **EDGAR exhibits** on the document→LLM path; mitigated by [llm_safety](../server/engine/llm_safety.py) `wrap_untrusted` + `UNTRUSTED_RULE`. |

## Fixed / addressed
- **SYNTH-1** — **resolved**: forced tool use + one-shot repair + live-path tests ([test_synth_live.py](../tests/server/test_synth_live.py), 25 cases).
- **DATA-1 / PERF-1** — resolved this cycle (retention prune; per-issuer hybrid retrieval).
- **SEC-1** — read rate guard on `/query/catalog` + `/query/chunk`.
- **S-1** — fail-closed auth: [identity.py](../server/identity.py) rejects (401) whenever `ENVIRONMENT` is anything other than `development` (`config.is_deployed`; the Docker stack bakes in `ENVIRONMENT=production`); permissive identity only for genuine local dev.
- **S-2** — security-headers middleware ([main.py](../server/main.py)); CSP/nosniff/Referrer/HSTS verified in LAUNCH_PHASE1 §5.
- **S-3** — forwarded-identity trust model; on the self-hosted stack the trusted edge is **Caddy + oauth2-proxy** (strips client `X-Forwarded-*`), per [SECURITY.md](SECURITY.md) §1.
- **B-1** — demo-seed flagged demo-only; `CAOS_DEMO_SEED=false` fixed in the production stack.

## Verified clean (this round)
- **Auth:** every route `Depends(get_identity)`; only `/health` open. The 7-module run, EDGAR, covenant, scenario and NL endpoints are all identity-gated; mutating/LLM POSTs and the read GETs are rate-limited.
- **Injection:** no `text()`/string-built SQL; parameterized SQLAlchemy throughout; NL→QuerySpec fills a closed schema (the model never authors SQL).
- **Document→LLM path:** EDGAR exhibits + uploads reaching synth/council/chat are wrapped with `wrap_untrusted` + an `UNTRUSTED_RULE` system instruction.
- **Cost:** per-run token budget (`engine/budget.py`) consulted by every LLM module; the CP-5C council fan-out is opt-in and budgeted.
- **Frontend:** 0 `dangerouslySetInnerHTML`, 0 `eval`, `any` only in the known mock files; tsc strict + eslint clean.

## Recommended next

SYNTH-1, DOC-1, F-1, PERF-2, and the CP-1A naming item above are all **Resolved**
(reconciled against code, not the tracker). What genuinely remains:

1. **A-1 (mock→engine epic)** — the live spine keeps growing (latest: the Command
   QA queue reads real CP-5 gate roll-ups). Next slices: the remaining Command
   boards (coverage gaps, portfolio table) off `usePortfolio`; a per-finding QA
   queue behind an aggregated findings endpoint; the Scenario Builder's model-grid
   BASE/DOWN columns; and the Deep-Dive `step-outputs` register.
2. **S-4 follow-through** — the tenancy enforcement scaffold ships opt-in
   (`CAOS_TENANCY_ENABLED`, default off); flip it on and add the entitlement model
   when multi-user MNPI/Bloomberg-restricted data lands (Phase-2 entry criterion).
3. **F-2** — retire the localized `any` in [reports/model.ts](../frontend/src/lib/reports/model.ts) (acceptable today; eslint-clean, no regression).
4. **D-1** — track upstream Next/esbuild bumps to clear the accepted-risk dev-chain npm advisories (none ship in the static export).
5. **Sector Review (CP-SR)** — the 9 `Pending Verification` stories in the feature
   tracker are seed/demo until live signal persistence + CP-SR synthesis exist
   (`registry.implemented=false`, Phase-2); not defects.

## Notably well done
- Identity on every route via `Depends(get_identity)`; only `/health` open. Rate limits on all mutating/LLM endpoints.
- The CP-5 invariant — the LLM never declares its own work committee-ready; `gate.py` decides from findings.
- Deterministic, source-cited modules (CP-2 cost-structure, CP-4C covenants, EDGAR XBRL→CP-1) that work with no LLM and clear the same gate.
- Consistent "prefer-live / deterministic-fallback" seams (useLiveRun, useModelEngine, nlquery, scenario) so the offline demo always works and real output overlays when present.
- Uploads: size-cap, magic-byte MIME sniff, path-traversal-safe storage; idempotent seed; Alembic migrations; same-origin single-process serving (no CORS surface).
- Strict TypeScript; WCAG-AA + colorblind-safe design system; evidence/citation lineage one click from source.
