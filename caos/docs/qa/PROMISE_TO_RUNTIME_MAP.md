# Promise-to-Runtime Map

**Gate:** PD-06 / C13<br>
**As of:** 2026-07-21<br>
**Disposition:** OPEN — NO-GO

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
| CP-MON | PROVISIONAL | Candidate-local code and tests implement additive watch-rule persistence, scoped CRUD and manual evaluation, deterministic evaluation and replay deduplication, atomic persisted AlertEvent/context/in-app and email-intent materialization, durable one-shot completed-run and scheduled claims, rendered-intent dispatch, and one persisted Live Monitor authority. The deployment-global flag is default-off; email remains rendered intent only and NOT SENT. | Keep migration 0066 applied and complete live PostgreSQL multi-worker proof, real external scheduler/dispatcher operation, production flag enablement and observation, enterprise transport and failure evidence, immutable H0 production-data parity, and target-host capacity/fault proof. |
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

## External seam truth

| Seam | Current state | PD-06 implication |
|---|---|---|
| Workflow notifications | Live internal NotificationEvent workflow exists. | Keep separate from credit AlertEvent semantics. |
| Credit alerts | PROVISIONAL candidate: scoped rules, evaluation, persisted events/context/intents, one-shot trigger/dispatch boundaries, and one persisted Monitor authority are implemented and locally verified behind a default-off flag. Email is rendered intent only and NOT SENT. | C3 is not release-closed: live PostgreSQL, immutable H0, real external scheduler/dispatcher operation, production flag observation, enterprise transport, and target-host proof remain open. |
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

- [ ] C3 Monitor and alert seam candidate implemented; live PostgreSQL, H0, external scheduler/dispatcher, production flag, enterprise transport, and target-host proof remain open.
- [ ] C5 market-data provider chain implemented and verified.
- [ ] CP-SR implementation plan written and executed.
- [ ] CP-RENDER equivalent-service decision recorded and verified.
- [ ] CP-EXTRACT retirement or replacement decision recorded.
- [ ] Model-provider activation evidence recorded for every enabled target.
- [ ] No UI, API, or provenance stamp overstates an unavailable seam.
- [ ] PD-06 evidence links added to the pre-deployment release record.

Until every applicable item is complete, PD-06 remains OPEN and deployment
remains NO-GO.
