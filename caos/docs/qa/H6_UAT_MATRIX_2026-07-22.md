# H6 persona-critical UAT matrix — 2026-07-22 (execution record for sign-off)

Per plan §H6, on H0's immutable candidate. Every row names its evidence:
**LIVE** = executed today against the digest-pinned stack; **BOUND** = named
current-candidate automation evidence. The owner executes the subjective
persona walkthroughs on the target and signs; no row is evidence-free.

## Persona journeys

| Case | Evidence | Status |
|---|---|---|
| Analyst: issuer onboarding → evidence-backed run → Deep-Dive/model/report/decision | BOUND: 510 governed runs on the image (L25); routed-concept browser journeys 15/15 incl. Decisions; CP-1 module + QA reads under load; EDGAR lane LIVE | ☐ owner walkthrough + sign |
| PM/CIO: portfolio posture, changes, committee pack, read-only behavior | BOUND: Portfolios/Command routed journeys green in the frozen-commit CI matrix; XLSX committee export suite (C9, merged 07-15) | ☐ |
| Research/QA: source tracing, CP-5 restriction, ratification, audit, correction | BOUND: QA gate states served honestly under load (incl. `Restricted` — observed live in the C3 window evidence); claim→evidence→chunk resolution suites | ☐ |

## Failure & edge cases (machine-checkable — executed)

| Case | Result | Status |
|---|---|---|
| Empty state | LIVE: fresh-DB lists return `[]` honestly (no fabricated rows) | PASS |
| Partial data | BOUND: gate cascade caps dependents (CP-5D suites); honest `Restricted` observed live | PASS |
| Vendor-down: EDGAR | LIVE: unconfigured lane returns the honest actionable message, never a blank | PASS |
| Vendor-down: model provider | LIVE: 429/529/hang → bounded fail-fast 502; reads unaffected (capacity artifact) | PASS |
| Stale-market | BOUND: provenance-labeled fixed/manual market data with as-of labels (C5 rescope decision); RV surfaces carry source tags | PASS (design-verified) |
| Auth expiry / stale session | LIVE: tampered profile cookie → **401**; forged identity without edge proof → **401** | PASS |
| Failed upload: not a PDF | LIVE: **400** "not a valid PDF" | PASS |
| Failed upload: malware | LIVE: EICAR embedded in a valid PDF → **422 "malware detected (Eicar-Test-Signature)"**, no vault write | PASS |
| Failed run | LIVE: nonexistent issuer → **404** honest; per-analyst concurrency limit → designed 429 under load | PASS |
| Narrow viewport / 200% zoom / coarse pointer / reduced motion | BOUND: PD-10 matrix — 18 routes × desktop/390px + dedicated 200% zoom, coarse-pointer, reduced-motion passes, zero findings, retries disabled | PASS |
| Keyboard operability | BOUND: axe + workbench keyboard suites in the 1,750-test frontend sweep (retry=0) | PASS |
| Print / PDF / XLSX outputs | BOUND: Report Studio print-ready output suites + ExcelJS committee-pack export tests | PASS |
| Supported browsers | BOUND: complete Chromium/Firefox/WebKit matrix green on the exact frozen commit (CI 29917558055) | PASS |
| Reference data stays reference-only | BOUND: provenance-label suites; L23 matrix records the LIVE/REFERENCE authority modes; reference JSON never satisfies a live case (CP-RENDER/C5 decisions) | PASS |

## Sign-off

All critical machine-checkable cases pass on the immutable candidate; three
persona walkthrough rows await the owner's target-host execution.

| Persona row | Executed by | Date | Signature |
|---|---|---|---|
| Analyst journey | | | |
| PM/CIO journey | | | |
| Research/QA journey | | | |
