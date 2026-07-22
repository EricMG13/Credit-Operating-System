# Seams Review Matrix

> **2026-07-20 update:** explicit Pipeline/Monitor LIVE/REFERENCE controllers
> improve authority disclosure, but do not activate enterprise email, licensed
> market data, external providers, or spec-only modules. Current promise and
> activation gates remain PD-06 in
> [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md);
> the operative current-truth record is the
> [Promise-to-Runtime Map](PROMISE_TO_RUNTIME_MAP.md).

> **2026-07-18 release note:** this remains the pickup input for integration
> work, not proof that the seams are closed. The final audit retains C3
> Monitor/email, C5 licensed market data, C13 CP-SR/CP-RENDER equivalence, and
> live-issuer QA flag scoping as explicit blockers. Re-run this matrix against
> the immutable candidate and archive the promise-to-runtime/activation map.
> See
> [PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](reports/PRE_DEPLOYMENT_CLOSURE_2026-07-18.md).

Verified-findings audit across the CAOS cross-stack boundaries (mock-vs-live honesty and API contracts). Each audited item was reviewed against the seams lenses and live code; findings below survived adversarial verification.

## 1. Audit status

| Item | Status | Verified findings |
|------|--------|-------------------|
| SEAM-1 | AUDITED | 0 |
| SEAM-2 | AUDITED | 2 |
| SEAM-3 | AUDITED | 0 |
| SEAM-4 | AUDITED | 0 |

## 2. Findings (sorted by severity, high first)

| Severity | Item | File:line | Lens | Summary | Failure |
|----------|------|-----------|------|---------|---------|
| high | SEAM-2 | caos/frontend/src/app/reports/page.tsx:428 | mock-vs-live honesty | `EvidenceModal` is instantiated without passing the `isLiveRun` or `live` evidence parameters on the Report Studio page, causing live evidence clicks to shadow-resolve to mock data. | When viewing a report in Report Studio that displays live run data (from a non-reference issuer), clicking an E-xx evidence chip opens `EvidenceModal`. Because `isLiveRun` is not passed to the modal, it defaults to `false`. The modal then falls back to shadow-resolving the ID against the static, hardcoded `EVIDENCE` map of the Atlas Forge reference deal. The analyst is shown source text from Atlas Forge as "VERIFIED" for their live issuer, leaking another issuer's data and presenting fabricated source grounding. |
| high | SEAM-2 | caos/frontend/src/app/pipeline/page.tsx:195 | mock-vs-live honesty | `EvidenceModal` is instantiated without the `isLiveRun` parameter on the Pipeline page, causing live pipeline runs' evidence clicks to shadow-resolve to mock data. | Clicking an E-xx evidence chip on a live run under the Pipeline visualizer does not pass `isLiveRun=true` to `EvidenceModal`. The modal defaults to mapping the ID against the ATLF mock database (`EVIDENCE`), rendering the mock reference text instead of properly falling back to the unresolved or loading state. |
