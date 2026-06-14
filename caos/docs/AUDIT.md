# CAOS — Codebase Audit

**Audit date:** 2026-06-14
**Scope:** `caos/` — FastAPI server (~2.6k LOC Python), Next.js frontend
(~12k LOC TS/TSX), config, CI, tests. The `Modular OS/` corpus is
analytical-methodology prose, not code, and is out of scope.

> Companion to [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) (2026-06-09) and
> [TIER1_ENGINE_PLAN.md](TIER1_ENGINE_PLAN.md). Severity legend matches those:
> **P0** blocks deploy · **P1** ships broken · **P2** degrades quality/security
> · **P3** nice-to-have.

## Health snapshot (all green)

Frontend: eslint ✓ · `tsc --noEmit` ✓ · 41 vitest ✓ · `next build` ✓.
Server: **40 pytest ✓**. CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml))
runs all of the above on both jobs. No committed secrets/DB/vault (`.gitignore`
covers them), no `TODO/FIXME` in app code, no `eval/exec/subprocess`, no SQL
string-building, `tsconfig` is `strict`.

**Verdict:** a well-built, deploy-ready codebase. Every API route enforces
identity, uploads are validated and stored safely, the seed is idempotent, and
CI is real. Findings are hardening/hygiene — **no P0/P1**.

## Findings register

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| S-1 | P2 | Auth | Auth gate failed open: header-less requests were rejected only when `ENVIRONMENT == "production"`, which defaults to `"development"`. A deploy not applying `app.yaml` would run unauthenticated. | **Fixed** — now also enforces when `DATABRICKS_APP_PORT` is present (the platform always injects it), so it fails closed on the platform regardless of `ENVIRONMENT`. |
| S-2 | P2 | Headers | No security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, HSTS) set by the app on the served static UI ([main.py](../server/main.py)). | Open — add a headers middleware. |
| S-3 | P3 | Auth | Identity trusts `X-Forwarded-Email/-User` ([identity.py](../server/identity.py)); spoofable if the Databricks edge is ever bypassed. Correct for the platform's network-isolated model. | Open (documented assumption). |
| S-4 | P3 | Authz | No per-issuer / row-level authorization — any authenticated analyst can access any issuer. Fine for a single-team tool. | Open (by design; revisit if multi-tenant). |
| D-1 | P2 | Deps | 7 npm advisories (was 1 critical + 1 high + 5 moderate). **All in the dev/build toolchain (vitest → vite → esbuild); `npm ls --omit=dev` confirms none ship in the production export.** | **Partially fixed** — vitest 2→3 cleared the critical (tests still green). Remaining (esbuild dev-server class) are dev-only / non-exploitable in this project's usage (headless `vitest run`, no exposed dev server); accepted-risk pending upstream esbuild. |
| B-1 | P2 | Seed | `CAOS_DEMO_SEED=true` in [app.yaml](../server/app.yaml) seeds 3 demo issuers + the ATLF reference deal into the prod DB on boot (idempotent, count-gated). Intentional for a POC. | Open — set `false` for a real deployment. |
| B-2 | P3 | Ingest | Untrusted document parsing (`pypdf`/`openpyxl` on uploads). Mitigated by the 250 MB cap + `openpyxl` read-only streaming + swallowed exceptions. | Open (inherent surface; low). |
| F-1 | P2 | Tests | No component/page tests — only 3 lib unit files + 1 e2e (`upload_flow`). The Evidence Sync, live-run adapter, and report DSL (~12k LOC) are untested. | Open — add interaction tests for the riskiest logic. |
| F-2 | P3 | Types | Localized `any` in [reports/model.ts](../frontend/src/lib/reports/model.ts); whole-file `eslint-disable` on the large mock-data files (`lib/deepdive/*`). | Open (acceptable for generated data). |
| A-1 | — | Architecture | **Mock-vs-engine gap (honesty flag, not a defect):** the backend has a *real but narrow* engine (Tier-1: runs, evidence, deterministic QA gate, CP-1 via fixture/LLM synth). Most of the frontend's analytical richness (24-module deep-dive, debate, recovery, covenants) is **seeded demo data** ([lib/deepdive/*](../frontend/src/lib/deepdive), [lib/reports/deal.ts](../frontend/src/lib/reports/deal.ts)), with `useLiveRun` overlaying live output only when a run exists. | Known — most of the UI is high-fidelity mock, not engine output. |

## Fixed in this pass

- **S-1** — fail-closed auth keyed off `DATABRICKS_APP_PORT` ([identity.py](../server/identity.py)); 40 pytest pass, local dev identity still resolves.
- **D-1** — `vitest` 2→3 (clears the critical advisory; 41 vitest pass). Remaining advisories are dev-only and confirmed absent from the production tree.

## Recommended next (in priority order)

1. **S-2** — security-headers middleware (small, high leverage).
2. **B-1** — decide demo-seed policy for real deployments.
3. **F-1** — component/interaction tests for Evidence Sync + the live-run adapter.

## Notably well done

- Auth enforced on every route via `Depends(get_identity)`; only `/health` open.
- Uploads: incremental size-cap, magic-byte MIME sniff, **path-traversal-safe**
  storage (sanitized filename + UUID-prefixed key, [ingest.py](../server/ingest.py)).
- Idempotent seed; Alembic migrations; same-origin single-process serving (no CORS surface).
- Strict TypeScript; design system is WCAG-AA + colorblind-safe (prior remediation rounds).
