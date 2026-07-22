# Promise-to-Runtime Map

**Gate:** PD-06 / C13  
**As of:** 2026-07-22 (CP-RENDER/CP-EXTRACT dispositions executed; first mapped 2026-07-20)  
**Disposition:** OPEN — NO-GO (CP-SR, CP-MON/C3, C5, and seam activation evidence remain open)

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
| CP-SR | BLOCKED (plan written 2026-07-22) | The sector-review route persists versioned partial/reference reviews. All six dimensions remain unavailable, missing dependencies are retained, and ready publication is unreachable. Implementation plan now exists: [CP_SR_IMPLEMENTATION_PLAN.md](../CP_SR_IMPLEMENTATION_PLAN.md) (deterministic-first six-dimension synthesis on the existing versioned-dossier substrate; execution gated on the C3 tranche landing — RT-2026-07-22-784…787). | Execute the plan (S0–S5); prove complete dimension synthesis, comparables, recovery, ratification, and production-data publication. |
| CP-MON | BLOCKED | Watchtower and autonomy worklists provide adjacent monitoring behavior, and alert-event lifecycle APIs exist. There is no complete watch-rule evaluator, durable delivery sink, scheduler claim model, briefing, or single persisted Monitor authority. | Execute the C3 Monitor and alert seam plan, preserving existing AlertEvent compatibility; prove deterministic evaluation, scoped event access, durable delivery, failure handling, and production-data Monitor parity. |
| CP-RENDER | RESOLVED (equivalent service; H0 browser evidence outstanding) | **Decision recorded 2026-07-22:** Report Studio IS the render service. Evidence: the committee export gate (`engine/report.py`) refuses non-Committee-Ready runs; published versions are immutable, document-hash-verified, and bound to an approved analyst-owned source manifest (`routes/reports.py`); the module registry documents CP-RENDER as a deliberate omission (CP-DB precedent) instead of a pending build; engine payloads no longer stamp CP-RENDER as a downstream consumer; the module API stays honestly unavailable (`test_engine`: `/modules/CP-RENDER` → 404, plan-absence asserted). Red-team: RT-2026-07-20-772, RT-2026-07-22-775…779. | Production-data browser export evidence on frozen H0 (retained in the contract-evidence list below). Reopen if any surface reintroduces a CP-RENDER runtime claim. |
| CP-EXTRACT | RETIRED (2026-07-22) | **Retirement decision recorded 2026-07-22:** the server is JSON-native and no application document boundary uses the promised canonical DOCX appendix parser. Registry spec and all production `downstream_consumers` stamps removed; documented omission at `engine/registry.py`; plan-absence and honest-404 asserted in `test_planner`/`test_engine`. Upload extraction remains under its real PDF/XLSX ingestion contract and is explicitly NOT labeled equivalent. Red-team: RT-2026-07-20-772, RT-2026-07-22-775…779. | None for the promise itself. A future adapter must register as a new module through the normal registry mechanism with its own contract evidence. |

CP-DB is deliberately infrastructure, not an executable analytical module:
SQLAlchemy, Postgres, and Alembic provide the persistence seam. It should be
documented as infrastructure rather than converted into a synthetic engine
route.

## External seam truth

| Seam | Current state | PD-06 implication |
|---|---|---|
| Workflow notifications | Live internal NotificationEvent workflow exists. | Keep separate from credit AlertEvent semantics. |
| Credit alerts | Partial: event lifecycle exists; rule evaluation and durable delivery do not. | C3 remains blocking. |
| Outlook email | No OAuth, Microsoft Graph transport, or connection test exists. A stored boolean is not connection evidence. | Must remain unavailable until an authenticated transport and failure evidence exist. |
| Manual market data | Live analyst-supplied XLSX preview/commit flow with immutable snapshots exists. | May remain the current provider when clearly labeled analyst-supplied. |
| Bloomberg market data | No licensed transport or provider implementation exists. | Vendor-specific work is blocked on an enterprise choice and official transport documentation. |
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

- [ ] C3 Monitor and alert seam implemented and verified.
- [ ] C5 market-data provider chain implemented and verified.
- [ ] CP-SR implementation plan written and executed — plan written 2026-07-22
      ([CP_SR_IMPLEMENTATION_PLAN.md](../CP_SR_IMPLEMENTATION_PLAN.md));
      execution (S0–S5) open, gated on the C3 tranche landing.
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
