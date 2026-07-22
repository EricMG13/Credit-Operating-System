# Promise-to-Runtime Map

**Gate:** PD-06 / C13  
**As of:** 2026-07-22 (C3 candidate landed on the working line; CP-RENDER/CP-EXTRACT executed; CP-SR deferred; C5/Bloomberg rescoped to H4; first mapped 2026-07-20)  
**Disposition:** OPEN — NO-GO (remaining: C3 live-operation legs, model-provider activation evidence, and the H0-bound evidence legs)  
**C3 verification:** exact-tree candidate-local gate passed; live release gates remain open

This is the operative map for reconciling named Credit Prompt modules with
callable production behavior. It records current truth; it does not close
PD-06.

## Decision rule

A promise is resolved only when it is backed by either:

1. a callable engine module with an owned API and production-data evidence, or
2. a documented live service whose contract fully replaces that module.

Reference fixtures, default-off flags, UI labels, registry entries, and partial
adjacent workflows do not by themselves constitute runtime implementation.

## Status vocabulary

| Status | Meaning |
|---|---|
| RESOLVED | Callable production behavior and evidence satisfy the promise. |
| PROVISIONAL | A credible equivalent exists, but contract or evidence work remains. |
| BLOCKED | The promise is still materially absent or incomplete. |
| RETIRE-CANDIDATE | The architecture no longer needs the named module; explicit retirement or redirect is required. |

## Named module promises

| Promise | Status | Current runtime truth | Required closure |
|---|---|---|---|
| CP-SR | DEFERRED (Phase-1 deferral recorded 2026-07-22) | The sector-review route persists versioned partial/reference reviews with honest labels; all six dimensions remain unavailable and ready publication stays unreachable — deliberately, for Phase-1 (user product decision; RT-2026-07-22-790/791). Nothing presents CP-SR as implemented. Implementation plan exists: [CP_SR_IMPLEMENTATION_PLAN.md](../CP_SR_IMPLEMENTATION_PLAN.md) (S0–S5; the C3 substrate it builds on landed 2026-07-22). | Phase-1 release requires only the honest-state evidence (states already shipped and tested). S0–S5 executes as the first post-pilot item; reopen RT-790 if any surface presents CP-SR as implemented. |
| CP-MON | PROVISIONAL | The landed C3 tranche contains additive watch-rule persistence through verified head `0068`, including `0067` JSON storage envelopes and `0068` scoped create-idempotency state. It also contains historical issuer/portfolio/position authority, completed-run reconciliation, explicit terminal resume, SQLite foreign-key enforcement, split legacy-global/C3-profile UUID ownership, profile-less proxy C3 isolation, retained-audit privacy handling, and one persisted Monitor authority/custody model. The exact-tree local gate passed: 2,919 server tests, 1,927 zero-retry frontend tests, 28 migration tests plus direct rehearsal through head `0068`, production build/staging, 18/18 real-local-API browser tests across Chromium/Firefox/WebKit, and freshly recaptured zero-finding normal/reduced axe matrices (1440×900 + 390×844, including the hardened supporting-rail overflow check after the RT-2026-07-22-831 visual false negative). The deployment-global flag remains default-off; email remains rendered intent only and NOT SENT; **no external scheduler, dispatcher, or recurring reconciler was operated** — evaluation ran only through explicit test/manual invocations. | Keep all additive migrations applied. Complete live PostgreSQL multi-worker proof, real external scheduler/dispatcher/reconciler operation, production flag enablement and observation, enterprise transport/failure evidence, immutable H0 production-data parity, and target-host capacity/fault proof. |
| CP-RENDER | RESOLVED (equivalent service; H0 browser evidence outstanding) | **Decision recorded 2026-07-22:** Report Studio IS the render service. Evidence: the committee export gate (`engine/report.py`) refuses non-Committee-Ready runs; published versions are immutable, document-hash-verified, and bound to an approved analyst-owned source manifest (`routes/reports.py`); the module registry documents CP-RENDER as a deliberate omission (CP-DB precedent) instead of a pending build; engine payloads no longer stamp CP-RENDER as a downstream consumer; the module API stays honestly unavailable (`test_engine`: `/modules/CP-RENDER` → 404, plan-absence asserted). Red-team: RT-2026-07-20-772, RT-2026-07-22-775…779. | Production-data browser export evidence on frozen H0 (retained in the contract-evidence list below). Reopen if any surface reintroduces a CP-RENDER runtime claim. |
| CP-EXTRACT | RETIRED (2026-07-22) | **Retirement decision recorded 2026-07-22:** the server is JSON-native and no application document boundary uses the promised canonical DOCX appendix parser. Registry spec and all production `downstream_consumers` stamps removed; documented omission at `engine/registry.py`; plan-absence and honest-404 asserted in `test_planner`/`test_engine`. Upload extraction remains under its real PDF/XLSX ingestion contract and is explicitly NOT labeled equivalent. Red-team: RT-2026-07-20-772, RT-2026-07-22-775…779. | None for the promise itself. A future adapter must register as a new module through the normal registry mechanism with its own contract evidence. |

CP-DB is deliberately infrastructure, not an executable analytical module:
SQLAlchemy, Postgres, and Alembic provide the persistence seam. It should be
documented as infrastructure rather than converted into a synthetic engine
route.

Candidate-local evidence is recorded in
[C3_MONITOR_ALERT_CANDIDATE_EVIDENCE_2026-07-21.md](C3_MONITOR_ALERT_CANDIDATE_EVIDENCE_2026-07-21.md).
It is not immutable H0, production-data, live-PostgreSQL, enterprise-delivery,
external-scheduler-operation, or target-host evidence.

The correction wave's full server/frontend regression, strict type/lint checks,
production build/static staging, three-browser real-API Playwright, migration
rehearsal, and normal/reduced-motion axe plus visual evidence are complete and
green. They remain local candidate evidence, not live PostgreSQL or H0 proof.

## External seam truth

| Seam | Current state | PD-06 implication |
|---|---|---|
| Workflow notifications | Live internal NotificationEvent workflow exists. | Keep separate from credit AlertEvent semantics. |
| Credit alerts | PROVISIONAL candidate with a passed exact-tree local gate: scoped rules, time-correct evaluation, persisted events/context/intents, bounded reconciliation, one-shot trigger/dispatch boundaries, and one persisted Monitor authority are implemented behind a default-off flag. Verified Alembic head is `0068`. Email is rendered intent only and NOT SENT. | C3 is not release-closed: live PostgreSQL, immutable H0, real external scheduler/dispatcher/reconciler operation, production flag observation, enterprise transport, and target-host proof remain open. |
| Outlook email | No OAuth, Microsoft Graph transport, or connection test exists. A stored boolean is not connection evidence. | Must remain unavailable until an authenticated transport and failure evidence exist. **Grouped 2026-07-22 with Bloomberg as the single H4 enterprise-side activation package** — not a pre-deployment gate. |
| Manual market data | Live analyst-supplied XLSX preview/commit flow with immutable snapshots exists, plus the immutable RV reference snapshot. | **IS the Phase-1 provider** (product decision 2026-07-22, RT-2026-07-22-788): provenance/as-of labeling stays mandatory; no silent-blend path exists because no provider chain exists. |
| Bloomberg market data | No licensed transport or provider implementation exists — and none is built pre-deployment (2026-07-03 in-plan decision superseded 2026-07-22; plan §C5 rescope, RT-2026-07-22-789). | **Removed from pre-deployment.** Build-and-activate at H4 with the enterprise, grouped with email, once licensing/official transport documents exist. |
| Model providers | Anthropic, Gemini, and OpenRouter adapters exist behind opt-in egress controls. | Activation requires target-specific credentials, approval state, redaction/egress checks, and success/failure evidence; key presence alone is insufficient. |

## Contract evidence required

Before PD-06 can close, the release record must include:

- API contract tests proving honest unavailable, reference, partial, and live
  states for all four promises.
- Authorization tests proving alert rules, events, and delivery attempts are
  scoped to the owning analyst or authorized team.
- Idempotency and concurrency tests for refresh, scheduler claims, evaluation,
  and delivery retries.
- Failure-path evidence showing that provider, email, and model seams do not
  report success when the external action did not occur.
- Production-data browser evidence for the resolved CP-RENDER path.
- An explicit retirement or redirect decision for CP-EXTRACT.
- H0 no-retry evidence captured only after the runtime work is complete.

## Closure checklist

- [x] C3 Monitor and alert seam candidate implemented and exact-tree candidate-local evidence captured (landed on the working line 2026-07-22).
- [ ] C3 live PostgreSQL, H0, external scheduler/dispatcher, production flag, enterprise transport, and target-host proof completed.
- [x] C5 market-data provider chain — RESCOPED OUT of pre-deployment
      (2026-07-22): Phase-1 ships the labeled fixed/manual provider;
      chain + Bloomberg move to the H4 enterprise activation package.
- [x] CP-SR — Phase-1 deferral recorded 2026-07-22 (honest states shipped;
      plan [CP_SR_IMPLEMENTATION_PLAN.md](../CP_SR_IMPLEMENTATION_PLAN.md)
      executes post-pilot, S0–S5).
- [ ] CP-RENDER equivalent-service decision recorded and verified — decision,
      registry omission, provenance cleanup, and contract tests landed
      2026-07-22; verification completes with the H0 production-data browser
      export evidence below.
- [x] CP-EXTRACT retirement or replacement decision recorded (2026-07-22:
      retired; registry spec and production consumer stamps removed).
- [ ] Model-provider activation evidence recorded for every enabled target.
- [ ] No UI, API, or provenance stamp overstates an unavailable seam.
- [ ] PD-06 evidence links added to the pre-deployment release record.

Until every applicable item is complete, PD-06 remains OPEN and deployment
remains NO-GO.
