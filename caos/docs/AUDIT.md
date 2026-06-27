# CAOS — Codebase Audit

**Audit date:** 2026-06-27 (code-reconciliation refresh: closed the lines the
shipped engine had already addressed and corrected the health snapshot; the
prior 2026-06-16 register text is retained where still accurate). The 2026-06-16
pass followed the EDGAR engine stack (#13), the DM/loans re-model (#14), and the
retention / N+1 / async / budgeting work; it superseded 2026-06-14.
**Scope:** `caos/` — FastAPI server (~14.7k LOC Python, 89 files, excl. tests/venv;
+65 test files), Next.js frontend (~18.2k LOC TS/TSX, 113 files, excl. tests),
config, CI, tests. The `Modular OS/` corpus is analytical-methodology prose, not
code, and is out of scope.

> Companion to [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), [TIER1_ENGINE_PLAN.md](TIER1_ENGINE_PLAN.md),
> [SECURITY.md](SECURITY.md), [IA_REVIEW.md](IA_REVIEW.md), [LAUNCH_PHASE1.md](LAUNCH_PHASE1.md).
> Severity legend: **P0** blocks deploy · **P1** ships broken · **P2** degrades
> quality/security · **P3** nice-to-have.

## Health snapshot (all green)

Frontend: eslint ✓ · `tsc --noEmit` (strict) ✓ · vitest ✓ (gated in CI) ·
`next build` ✓ (12/12 static pages, export OK). Server: **686 pytest ✓, 3
skipped** (Postgres-only worker tests skipped on the SQLite default suite;
verified offline 2026-06-27 via `caos/tests/server`). The suite has grown ~4×
since the 2026-06-16 snapshot's 171.
CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) runs lint + tsc +
vitest + build on the frontend job, pytest on the server job, and a Docker image
build — so the tests and the deploy image are gated. No committed secrets/DB/vault
(`.gitignore` covers them), no `TODO/FIXME` in app code, no SQL string-building,
no `eval`/`exec`, no `shell=True` (except the operator-configured markitdown spike,
list-form), Alembic chain linear, `tsconfig` strict.

**Verdict:** a well-built, deploy-ready codebase — **no P0/P1**. Since the last
audit the engine grew materially and is no longer a 3-module slice. It now runs a
**19-module CP-X DAG** (registry/planner/runner, CP-0…CP-6E) — core seats include
CP-0 SourceReadiness, CP-1 (with the EDGAR XBRL→CP-1 deterministic lane),
**CP-1A BusinessTransactionFactPack**, **CP-1B EarningsDelta**,
**CP-1C PeerBenchmark**, CP-2 CostStructure, **CP-4C covenant capacity** — gated by
**CP-5B** lineage, the opt-in **CP-5C** adversarial council, and the **CP-5** gate
(the LLM never sets its own committee status). Plus: async run execution + per-run
token budgeting, a `metric_facts` store with retention, cross-issuer NL query
(structured + semantic + hybrid), a Scenario Builder, and an Altman-Z distress
score — all identity-gated, typed, lint-clean, tested. The live-synthesis path
(SYNTH-1) that led the prior pass is **resolved**; open findings are P2/P3
hardening plus the mock→engine epic (A-1).

## Findings register

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| SYNTH-1 | P2 | Engine/Tests | **Live synthesis is the least-defended path.** `LiveSynthesizer._parse_payload` ([engine/synth.py](../server/engine/synth.py)) extracts JSON with a greedy `re.search(r"\{.*\}")` + `json.loads` — no structured output / tool use, no repair, no retry; a truncated (`max_tokens`) or prose-wrapped response → `SynthesisError` → the module (and its downstream consumers) are Blocked. **Zero live-path test coverage:** `conftest.py` / `test_api.py` force `ANTHROPIC_API_KEY=""`, so all 171 pytest run fixture-only. | **Resolved** — forced tool use (`emit_module_payload`, `tool_choice` forced — [synth.py:305](../server/engine/synth.py)) + a one-shot, budget-gated repair turn ([synth.py:355](../server/engine/synth.py)); mocked-Anthropic live-path tests landed ([test_synth_live.py](../tests/server/test_synth_live.py), 25 cases: well-formed / truncated / prose-wrapped / schema-violating). The greedy `re.search(r"\{.*\}")` survives only as a recoverable fallback *behind* the forced `tool_choice`. `validate_payload` ([schemas.py](../server/engine/schemas.py)) still gates enums. |
| SEC-1 | P2 | Rate limit | The read GETs `/api/query/catalog` and `/api/query/chunk/{id}` were identity-gated but not rate-limited. | **Fixed** — `_read_rate_guard` (60/min/caller) on both ([routes/query.py](../server/routes/query.py)). |
| D-1 | P2 | Deps | **8 npm advisories (2 moderate + 6 high).** The 2 moderate are **postcss `<8.5.10`** pulled transitively by Next.js build tooling (build-time only, no untrusted-CSS path). The high set is the **vite/esbuild/vitest dev chain**, incl. the esbuild dev-server arbitrary-file-read advisory (dev-server-on-Windows only). None ship in the static export. | **Accepted-risk** — none exploitable in this app's usage; `npm audit fix --force` downgrades Next (**do not run**). Track upstream Next/esbuild bumps. |
| DATA-1 | P3 | Storage | `metric_facts` run-derived rows accumulating unbounded per run. | **Resolved** — on run completion the runner deletes the issuer's older `provenance="run"` rows ([runner.py](../server/engine/runner.py) "Retention (DATA-1)"); seed facts untouched; covered by [test_retention.py](../tests/server/test_retention.py). |
| PERF-1 | P3 | Query | Hybrid `execute()` issued one `retrieve_corpus` per ranked issuer (N+1). | **Resolved** — `retrieve_corpus_by_issuer` ([retrieval.py](../server/retrieval.py)) does one query + one BM25 pass for the best chunk per issuer ([nlquery.py](../server/nlquery.py)). *(Separate in-flight perf: P4-2 builds the issuer BM25 index once per run rather than per `retrieve()` — on `perf/bm25-corpus-memo`, not yet merged.)* |
| PERF-2 | P3 | Bundle | `/deepdive` first-load JS was **643 kB** (largest route; `/reports` 561 kB). Fine functionally; heavy for a desk on a metered link. | **Resolved (2026-06-27)** — the heavy tabs (Debate/Recovery/Covenants/ModuleView), `IssuerChat`, and `EvidenceModal` are now `dynamic(() => import())` with `ssr:false` ([deepdive/page.tsx:41-46](../frontend/src/app/deepdive/page.tsx)), so the 1.8k-LOC seeded `step-outputs.ts` loads behind a tab boundary rather than in the initial chunk. Measured `next build`: **`/deepdive` first-load 643 → 191 kB** (`/reports` 561 → 180 kB); every route now sits in a 103–191 kB band over the 103 kB shared baseline. |
| F-1 | P2 | Tests | RTL component coverage was thin. | **Resolved** — RTL render/interaction tests now cover `EdgarImport`, `evidence-sync`, `primitives`, `issuer-chat-context`, and (this round) **`NlQuery`** ([NlQuery.test.tsx](../frontend/src/components/command/NlQuery.test.tsx), 5 cases), **`CitationViewer`** (4), **`ScenarioPanel`** (5) — 14 new render+interaction cases, mocked API / offline. Frontend vitest 218 passing. |
| DOC-1 | P3 | Docs/Deploy | **Stale "Databricks" references** survive the self-hosted-Docker pivot ([LAUNCH_PHASE1](LAUNCH_PHASE1.md)): [retrieval.py](../server/retrieval.py) docstring (Databricks Vector Search), [routes/auth.py](../server/routes/auth.py) + [identity.py](../server/identity.py) + SECURITY.md §1 (Databricks-Apps auth model). **Functionally sound** — `ENVIRONMENT=production` is fixed in the stack so the identity gate still fails closed, and Caddy strips client `X-Forwarded-*` (both verified in LAUNCH_PHASE1 §5) — but `DATABRICKS_APP_PORT` is now a vestigial no-op trigger. | **Reconciled (2026-06-27)** — docstrings + SECURITY §1 refreshed. The `DATABRICKS_APP_PORT` branch was **kept by decision**, not retired: it survives on both `main` and the working branch as `_LEGACY_PLATFORM_PORT` ([identity.py:45-49](../server/identity.py)), an extra fail-closed identity trigger that is harmless when unset (the Docker stack gates on `ENVIRONMENT=production` regardless). Not cruft — closed. |
| S-4 | P3 | Authz | No per-issuer / row-level authz — any authenticated analyst can read any issuer; `/query/*` + `/scenario` widen this cross-issuer surface. | **Documented** ([SECURITY.md](SECURITY.md) §2) — single-team-by-design. **Now a Phase-2 entry criterion:** material the moment multi-user, entitlement-restricted (Bloomberg/MNPI) data lands, not only on multi-tenancy. |
| F-2 | P3 | Types | Localized `any` confined to [reports/model.ts](../frontend/src/lib/reports/model.ts) + whole-file `eslint-disable` on the large mock-data files. New code is `any`-free. | Open (acceptable; eslint clean, no regression). |
| A-1 | — | Architecture | **Mock-vs-engine gap — narrowing further.** Now engine-derived: CP-1/1A/1B/1C, CP-2, CP-4C, peers, distress, `metric_facts`, NL query, citation viewer. **Still seeded mock:** much of Deep-Dive ([step-outputs.ts](../frontend/src/lib/deepdive/step-outputs.ts)), Command boards, Pipeline sim, Monitor, and the CP-3 RV / CP-3B recovery / CP-6A surfaces; the Scenario Builder drives the **panel only**, not the model grid's BASE/DOWN columns. CP-3 RV is **market-data-gated (Phase 2)**. | Known — smaller but real; tracked as the mock→engine epic. |
| S-1/2/3, B-1/2 | P2/P3 | Security/Seed/Ingest | Fail-closed auth gate (S-1), security-headers middleware (S-2), forwarded-identity trust model (S-3), demo-seed flag (B-1), untrusted-doc parsing surface (B-2). | **Fixed / documented** (see below). B-2 now also covers **EDGAR exhibits** on the document→LLM path; mitigated by [llm_safety](../server/engine/llm_safety.py) `wrap_untrusted` + `UNTRUSTED_RULE`. |

## Fixed / addressed
- **SYNTH-1** — **resolved**: forced tool use + one-shot repair + live-path tests ([test_synth_live.py](../tests/server/test_synth_live.py), 25 cases).
- **DATA-1 / PERF-1** — resolved this cycle (retention prune; per-issuer hybrid retrieval).
- **SEC-1** — read rate guard on `/query/catalog` + `/query/chunk`.
- **S-1** — fail-closed auth: [identity.py](../server/identity.py) rejects (401) when `ENVIRONMENT == "production"` (fixed in the Docker stack) or the legacy `DATABRICKS_APP_PORT` is set; permissive identity only for genuine local dev.
- **S-2** — security-headers middleware ([main.py](../server/main.py)); CSP/nosniff/Referrer/HSTS verified in LAUNCH_PHASE1 §5.
- **S-3** — forwarded-identity trust model; on the self-hosted stack the trusted edge is **Caddy + oauth2-proxy** (strips client `X-Forwarded-*`), per [SECURITY.md](SECURITY.md) §1.
- **B-1** — demo-seed flagged demo-only; `CAOS_DEMO_SEED=false` fixed in the production stack.

## Verified clean (this round)
- **Auth:** every route `Depends(get_identity)`; only `/health` open. The CP-X run, EDGAR, covenant, scenario and NL endpoints are all identity-gated; mutating/LLM POSTs and the read GETs are rate-limited.
- **Injection:** no `text()`/string-built SQL; parameterized SQLAlchemy throughout; NL→QuerySpec fills a closed schema (the model never authors SQL).
- **Document→LLM path:** EDGAR exhibits + uploads reaching synth/council/chat are wrapped with `wrap_untrusted` + an `UNTRUSTED_RULE` system instruction.
- **Cost:** per-run token budget (`engine/budget.py`) consulted by every LLM module; the CP-5C council fan-out is opt-in and budgeted.
- **Frontend:** 0 `dangerouslySetInnerHTML`, 0 `eval`, `any` only in the known mock files; tsc strict + eslint clean.

## Shipped since 2026-06-16 (closed in this reconciliation)
- **SYNTH-1** — forced tool use + one-shot repair + mocked live-path tests ([test_synth_live.py](../tests/server/test_synth_live.py)).
- **CP-1A naming** — code now reads `BusinessTransactionFactPack` throughout ([factpack.py](../server/engine/factpack.py), [registry.py](../server/engine/registry.py), [runner.py](../server/engine/runner.py)); the corpus/code module map agrees.
- **F-1 (cont.)** — RTL tests for `NlQuery` / `CitationViewer` / `ScenarioPanel` landed.
- **P4-2** — the per-run BM25 index is built once and reused (`build_issuer_index`, [retrieval.py](../server/retrieval.py)); the per-`retrieve()` rebuild is gone.
- **PERF-2** — `/deepdive` code-split landed and **measured**: first-load 643 → 191 kB (see the row above). Closed.
- **LLM request timeout** — every Anthropic/Gemini client is now bound to `caos_llm_timeout_s` (120 s) so a stuck inference can't pin a run/lane open; all LLM lanes already isolate the resulting timeout (per-module Blocked / council `return_exceptions` / deterministic fallback), so it degrades rather than aborts a run.

## Recommended next
1. **A-1 (mock→engine epic)** — the real long-haul: much of Deep-Dive ([step-outputs.ts](../frontend/src/lib/deepdive/step-outputs.ts)), the Command boards, Pipeline sim, Monitor, and the CP-3 RV / CP-3B recovery / CP-6A surfaces are still seeded mock. CP-3 RV is market-data-gated (Phase 2).
2. **S-4** — per-issuer authorization as a Phase-2 entry criterion (multi-user MNPI/Bloomberg-entitled data).

## Notably well done
- Identity on every route via `Depends(get_identity)`; only `/health` open. Rate limits on all mutating/LLM endpoints.
- The CP-5 invariant — the LLM never declares its own work committee-ready; `gate.py` decides from findings.
- Deterministic, source-cited modules (CP-2 cost-structure, CP-4C covenants, EDGAR XBRL→CP-1) that work with no LLM and clear the same gate.
- Consistent "prefer-live / deterministic-fallback" seams (useLiveRun, useModelEngine, nlquery, scenario) so the offline demo always works and real output overlays when present.
- Uploads: size-cap, magic-byte MIME sniff, path-traversal-safe storage; idempotent seed; Alembic migrations; same-origin single-process serving (no CORS surface).
- Strict TypeScript; WCAG-AA + colorblind-safe design system; evidence/citation lineage one click from source.
