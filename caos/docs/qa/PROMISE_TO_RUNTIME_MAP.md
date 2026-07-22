# Promise-to-Runtime Map

**Gate:** PD-06 / C13<br>
**As of:** 2026-07-22<br>
**Disposition:** OPEN — NO-GO<br>
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
| CP-SR | BLOCKED | The sector-review route persists versioned partial/reference reviews. All six dimensions remain unavailable, missing dependencies are retained, and ready publication is unreachable. | Implement the separately planned asynchronous, source-backed sector-review service; prove complete dimension synthesis, comparables, recovery, ratification, and production-data publication. |
| CP-MON | PROVISIONAL | The candidate contains additive watch-rule persistence through verified head `0068`, including `0067` JSON storage envelopes and `0068` scoped create-idempotency state. It also contains historical issuer/portfolio/position authority, completed-run reconciliation, explicit terminal resume, SQLite foreign-key enforcement, split legacy-global/C3-profile UUID ownership, profile-less proxy C3 isolation, retained-audit privacy handling, and one persisted Monitor authority/custody model. The exact-tree local gate passed: 2,919 server tests, 1,927 zero-retry frontend tests, 28 migration tests plus direct rehearsal through head `0068`, production build/staging, 18/18 real-local-API browser tests across Chromium/Firefox/WebKit, and freshly recaptured zero-finding normal/reduced axe matrices (1440×900 + 390×844, including the hardened supporting-rail overflow check after the RT-2026-07-22-831 visual false negative). The deployment-global flag remains default-off; email remains rendered intent only and NOT SENT; **no external scheduler, dispatcher, or recurring reconciler was operated** — evaluation ran only through explicit test/manual invocations. | Keep all additive migrations applied. Complete live PostgreSQL multi-worker proof, real external scheduler/dispatcher/reconciler operation, production flag enablement and observation, enterprise transport/failure evidence, immutable H0 production-data parity, and target-host capacity/fault proof. |
| CP-RENDER | PROVISIONAL | Report Studio already freezes exact run/model/source manifests and produces immutable JSON, XLSX, and PDF versions. The registry still marks CP-RENDER unimplemented, its module route returns unavailable, and some UI provenance stamps imply the module exists. | Decide and document Report Studio as the equivalent service or implement the module; redirect or retire the obsolete promise, clean up provenance claims, and pass production-data browser export evidence. |
| CP-EXTRACT | RETIRE-CANDIDATE | No CP-EXTRACT runtime exists. Current PDF/XLSX ingestion does not implement the promised canonical DOCX appendix parser. The server is JSON-native. | Explicitly retire or redirect the promise to the supported ingestion contract, or define and implement a future adapter. Do not label the existing ingestion path as equivalent without contract parity. |

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

- [x] C3 Monitor and alert seam candidate implemented and exact-tree candidate-local evidence captured.
- [ ] C3 live PostgreSQL, H0, external scheduler/dispatcher, production flag, enterprise transport, and target-host proof completed.
- [ ] C5 market-data provider chain implemented and verified.
- [ ] CP-SR implementation plan written and executed.
- [ ] CP-RENDER equivalent-service decision recorded and verified.
- [ ] CP-EXTRACT retirement or replacement decision recorded.
- [ ] Model-provider activation evidence recorded for every enabled target.
- [ ] No UI, API, or provenance stamp overstates an unavailable seam.
- [ ] PD-06 evidence links added to the pre-deployment release record.

Until every applicable item is complete, PD-06 remains OPEN and deployment
remains NO-GO.
