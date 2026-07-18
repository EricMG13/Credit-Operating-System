# CAOS — Codebase Audit

**Audit date:** 2026-06-16 (full re-audit after the EDGAR engine stack (#13),
the DM/loans re-model (#14), and the retention / N+1 / async / budgeting work;
supersedes the 2026-06-14 pass).
**Last reconciled:** 2026-07-18 — final pre-deployment closure audit across
the routed UI, API/platform services, feature/control wiring, code
reachability, audit loops, 15-user throughput, persistence, vault, backup,
and security posture. See
[PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](qa/reports/PRE_DEPLOYMENT_CLOSURE_2026-07-18.md).
**Scope:** `caos/` — FastAPI server, Next.js frontend, config, CI, deploy/backup,
and tests. The `Modular OS/` corpus is
analytical-methodology prose, not code, and is out of scope.

> Companion to [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), [TIER1_ENGINE_PLAN.md](TIER1_ENGINE_PLAN.md),
> [SECURITY.md](SECURITY.md), [IA_REVIEW.md](IA_REVIEW.md), [LAUNCH_PHASE1.md](LAUNCH_PHASE1.md).
> Severity legend: **P0** blocks deploy · **P1** ships broken · **P2** degrades
> quality/security · **P3** nice-to-have.

## Health snapshot

Frontend: eslint ✓ · `tsc --noEmit` (strict) ✓ · production static export of
**18 page endpoints** ✓ · **1,438 Vitest tests / 234 files ✓**. Server:
**2,405 pytest passed / 15 skipped** in the restricted lane; the seven
socket-denied ClamAV cases passed on an unrestricted rerun, yielding an
effective **2,412 passed / 15 skipped**. Rendered axe/layout: **36
route/viewport scans, zero findings**. Fresh 15-user local load: **2,913
requests, zero failures, p95 7 ms**; the dated production-like Postgres/
two-worker run remains **2,584 requests, zero failures, p95 89 ms**.

The feature tracker still contains **355/355 historical Pass** rows, but it
covers 14 concepts and is not a whole-application release manifest: newer
Portfolio Lab, Decisions/IC Book, Sponsors, and several current RV/context
flows need dedicated rows. The 2026-07-18 three-browser inventory is
**125 passed / 15 failed / 1 flaky**, so dynamic control wiring is not green.
The current checkout is also dirty and cannot be treated as an immutable RC.
Parallel frontend WIP changed during this audit, so the command results are
diagnostic snapshots rather than evidence from one stable candidate.
CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) runs lint + tsc +
vitest + build on the frontend job, pytest on the server job, and a Docker image
build — so the tests and the deploy image are gated. No committed secrets/DB/vault
(`.gitignore` covers them), no `TODO/FIXME` in app code, no SQL string-building,
no `eval`/`exec`, no `shell=True` (except the operator-configured markitdown spike,
list-form), Alembic chain linear, `tsconfig` strict.

**Verdict:** a well-built codebase with no newly confirmed P0/P1 defect in the
historical findings register, but **NO-GO for pre-deployment release today**.
PD-01…PD-09 in [PRE_DEPLOYMENT_PLAN.md](PRE_DEPLOYMENT_PLAN.md) block an
immutable candidate: current E2E contracts, surface/tracker parity, dead-code
disposition, recovery boundaries, live/reference seams, target capacity,
encryption/off-host recovery, and evidence-to-artifact integrity.

> **Status (as of the shipped engine):** the engine now wires **21 implemented
> modules** (+ 4 spec-only) per [`registry.py`](../server/engine/registry.py) — the
> "7-module DAG" below was an earlier snapshot. The full implemented set is CP-0,
> CP-1/1A/1B/1C, CP-2/2B/2C/2D/2E/2F/2G, CP-3/3B/3C/3D,
> CP-4/4C/4D, CP-6A/6E.

It runs a multi-module analytical DAG — CP-0 SourceReadiness, CP-1 (with the EDGAR
XBRL→CP-1 deterministic lane), **CP-1A BusinessTransactionFactPack**, **CP-1B
EarningsDelta**, **CP-1C PeerBenchmark**, **CP-2 FundamentalCreditSynthesizer**
(*its canonical name and analytical role — the 9-dimension fundamental synthesis;
`CostStructure` is only the degraded offline-fixture output, not the module's
purpose*), **CP-2G**, **CP-4D**, **CP-4C covenant capacity**, and the rest of the registry — gated by
**CP-5B** lineage, the opt-in **CP-5C** adversarial council, and the **CP-5** gate
(the LLM never sets its own committee status). Plus: async run execution + per-run
token budgeting, a `metric_facts` store with retention, cross-issuer NL query
(structured + semantic + hybrid), a Scenario Builder, and an Altman-Z distress
score — all identity-gated, typed, lint-clean, tested. No unresolved Phase-1
code defect remains in this register; `S-4` entitlement activation and CP-SR /
CP-MON are explicit Phase-2 roadmap constraints.

## Findings register

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| SYNTH-1 | P2 | Engine/Tests | **Live synthesis is the least-defended path.** `LiveSynthesizer._parse_payload` ([engine/synth.py](../server/engine/synth.py)) extracts JSON with a greedy `re.search(r"\{.*\}")` + `json.loads` — no structured output / tool use, no repair, no retry; a truncated (`max_tokens`) or prose-wrapped response → `SynthesisError` → the module (and its downstream consumers) are Blocked. **Zero live-path test coverage:** `conftest.py` / `test_api.py` force `ANTHROPIC_API_KEY=""`, so all 171 pytest run fixture-only. | **Resolved** — forced tool use (`emit_module_payload`, `tool_choice` forced — [synth.py:305](../server/engine/synth.py)) + a one-shot, budget-gated repair turn ([synth.py:355](../server/engine/synth.py)); mocked-Anthropic live-path tests landed ([test_synth_live.py](../tests/server/test_synth_live.py), 25 cases: well-formed / truncated / prose-wrapped / schema-violating). The greedy `re.search(r"\{.*\}")` survives only as a recoverable fallback *behind* the forced `tool_choice`. `validate_payload` ([schemas.py](../server/engine/schemas.py)) still gates enums. |
| SEC-1 | P2 | Rate limit | The read GETs `/api/query/catalog` and `/api/query/chunk/{id}` were identity-gated but not rate-limited. | **Fixed** — `_read_rate_guard` (60/min/caller) on both ([routes/query.py](../server/routes/query.py)). |
| D-1 | P2 | Deps | **8 npm advisories (2 moderate + 6 high)** — postcss (Next.js build tooling) + the vite/esbuild/vitest dev chain. None shipped in the static export. | **Resolved** — `npm audit --audit-level=high` on the current lockfile now returns 0 vulnerabilities at every severity (2026-07-10 security-infra audit); the dev-chain deps have since been patched upstream. Re-open if a future dependency bump reintroduces dev/build-chain advisories. |
| DATA-1 | P3 | Storage | `metric_facts` run-derived rows accumulating unbounded per run. | **Resolved** — on run completion the runner deletes the issuer's older `provenance="run"` rows ([runner.py](../server/engine/runner.py) "Retention (DATA-1)"); seed facts untouched; covered by [test_retention.py](../tests/server/test_retention.py). |
| PERF-1 | P3 | Query | Hybrid `execute()` issued one `retrieve_corpus` per ranked issuer (N+1). | **Resolved** — `retrieve_corpus_by_issuer` ([retrieval.py](../server/retrieval.py)) does one query + one BM25 pass for the best chunk per issuer ([nlquery.py](../server/nlquery.py)). P4-2 is also merged: [runner.py](../server/engine/runner.py) builds one issuer BM25 index per run and reuses `rank_with_index`; parity is pinned in [test_engine.py](../tests/server/test_engine.py). |
| PERF-2 | P3 | Bundle | `/deepdive` first-load JS was **643 kB** and the largest route before code splitting. | **Resolved** — heavy module tabs, seeded step outputs, chat, and evidence overlays load through `next/dynamic` ([deepdive/page.tsx](../frontend/src/app/deepdive/page.tsx)). Fresh 2026-07-11 production export: the 229,048-byte seeded payload is an async chunk absent from initial HTML; `/deepdive` initial scripts total 350,256 gzip bytes versus `/reports` at 354,855, so Deep-Dive is no longer the largest route. |
| F-1 | P2 | Tests | RTL component coverage was thin. | **Resolved** — RTL render/interaction tests now cover `EdgarImport`, `evidence-sync`, `primitives`, `issuer-chat-context`, **`NlQuery`** ([NlQuery.test.tsx](../frontend/src/components/command/NlQuery.test.tsx)), **`CitationViewer`**, and **`ScenarioPanel`** with mocked API / offline coverage. |
| DOC-1 | P3 | Docs/Deploy | **Stale "Databricks" references** survive the self-hosted-Docker pivot ([LAUNCH_PHASE1](LAUNCH_PHASE1.md)): [retrieval.py](../server/retrieval.py) docstring (Databricks Vector Search), [routes/auth.py](../server/routes/auth.py) + [identity.py](../server/identity.py) + SECURITY.md §1 (Databricks-Apps auth model). **Functionally sound** — `ENVIRONMENT=production` is fixed in the stack so the identity gate still fails closed, and Caddy strips client `X-Forwarded-*` (both verified in LAUNCH_PHASE1 §5) — but `DATABRICKS_APP_PORT` was still read as a vestigial no-op trigger. | **Resolved** — retrieval/auth docstrings + SECURITY §1 refreshed; the vestigial `DATABRICKS_APP_PORT` branch removed — `config.is_deployed` / identity.py now key on `ENVIRONMENT != development` only. |
| S-4 | P3 | Authz | No per-issuer / row-level authz — any authenticated analyst can read any issuer; `/query/*` + `/scenario` widen this cross-issuer surface. | **Enforcement scaffold shipped (opt-in, default off)** — [tenancy.py](../server/tenancy.py) adds `require_issuer` / `scope_issuers` / `require_run_access` / `block_if_tenancy_unscoped` wired across the issuer-derived spine; `CAOS_TENANCY_ENABLED` (default **off**) gates it, so default behaviour is unchanged single-team. Cross-issuer aggregate lanes fail closed (501) under tenancy; `team_id` on issuers/analysts (migration 0037). `test_tenancy` pins the isolation. Documented [SECURITY.md](SECURITY.md) §2; flip on when multi-user, entitlement-restricted (Bloomberg/MNPI) data lands (Phase-2 entry criterion). |
| F-2 | P3 | Types | Localized `any` was confined to [reports/model.ts](../frontend/src/lib/reports/model.ts) + whole-file `eslint-disable` on the large mock-data files. | **Resolved** — model finalizers use narrow `ModelCol` structural types; blanket disables were removed from the four Deep-Dive fixture files (verified: no `eslint-disable` remains in either file). Strict TypeScript, full eslint, and 40 focused model/scenario tests pass. |
| A-1 | — | Architecture | **Phase-1 live seams closed.** The Command governance queue now reads exact findings from the bounded, analyst/tenancy-scoped [`GET /api/qa/findings`](../server/routes/qa.py), retaining issuer gate roll-up only when the accessible latest run emitted no finding rows. Live Deep-Dive renders adapted persisted sections in a provenance-labelled runtime register and never substitutes seeded workflow steps/charts. CP-5B persists a bounded decision-driver register from real claims/evidence/QA findings; Pipeline renders its evidence chips and discloses that ordering is decision-proximity + module diversity, not a measured market-materiality score. Seeded Pipeline/Deep-Dive content remains only in the labelled ATLF/offline demo; a missing live register fails explicitly. CP-SR, CP-MON and market-data-gated CP-3 RV remain Phase-2 by design. | **Resolved for Phase 1** — remaining seed surfaces are explicit demo or Phase-2 scope, not hidden live fallbacks. |
| S-1/2/3, B-1/2 | P2/P3 | Security/Seed/Ingest | Fail-closed auth gate (S-1), security-headers middleware (S-2), forwarded-identity trust model (S-3), demo-seed flag (B-1), untrusted-doc parsing surface (B-2). | **Fixed / documented** (see below). B-2 now also covers **EDGAR exhibits** on the document→LLM path; mitigated by [llm_safety](../server/engine/llm_safety.py) `wrap_untrusted` + `UNTRUSTED_RULE`. |

## Fixed / addressed
- **SYNTH-1** — **resolved**: forced tool use + one-shot repair + live-path tests ([test_synth_live.py](../tests/server/test_synth_live.py), 25 cases).
- **DATA-1 / PERF-1 / PERF-2 / P4-2** — resolved (retention prune; per-issuer hybrid retrieval; Deep-Dive async chunks; one BM25 index per run).
- **F-2** — resolved: no `any` or blanket eslint suppression remains in the identified model/fixture files.
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
- **Frontend:** 0 `dangerouslySetInnerHTML`, 0 `eval`; the known F-2 type/suppression debt is removed; tsc strict + eslint clean.

## Recommended next

SYNTH-1, DOC-1, F-1, F-2, PERF-1, PERF-2, and the CP-1A naming item above are
all **Resolved** (reconciled against code, not the tracker). What genuinely
remains:

1. **S-4 follow-through** — the tenancy enforcement scaffold ships opt-in
   (`CAOS_TENANCY_ENABLED`, default off); flip it on and add the entitlement model
   when multi-user MNPI/Bloomberg-restricted data lands (Phase-2 entry criterion) —
   policy and entitlement source must be defined first.
2. **Phase-2 analytical modules** — CP-SR and CP-MON remain deliberately
   `implemented=false`; CP-3 RV still requires licensed/current market data.
   Their nine Sector Review tracker stories are now verified **Pass** for the
   labelled seed/demo contract, not claims that CP-SR runtime persistence exists.
3. **Demo discipline** — keep the Sample Sleeve and ATLF reference workflow
   labelled and isolated from live-run states. Any future mock→engine slice must
   preserve the current fail-unavailable behavior rather than silently backfill.

## Notably well done
- Identity on every route via `Depends(get_identity)`; only `/health` open. Rate limits on all mutating/LLM endpoints.
- The CP-5 invariant — the LLM never declares its own work committee-ready; `gate.py` decides from findings.
- Deterministic, source-cited modules (CP-2 cost-structure, CP-4C covenants, EDGAR XBRL→CP-1) that work with no LLM and clear the same gate.
- Consistent "prefer-live / deterministic-fallback" seams (useLiveRun, useModelEngine, nlquery, scenario) so the offline demo always works and real output overlays when present.
- Uploads: size-cap, magic-byte MIME sniff, path-traversal-safe storage; idempotent seed; Alembic migrations; same-origin single-process serving (no CORS surface).
- Strict TypeScript; WCAG-AA + colorblind-safe design system; evidence/citation lineage one click from source.
