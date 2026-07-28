# AI-AUDIT 06 — Optimisation and retest

## Consolidated finding register

The finding register is the single source of truth. Do not silently rewrite the audited asset.

| Field | Requirement |
|---|---|
| finding_id | Stable `AIA-FNNN`; retain through retest |
| priority | P0 release blocker; P1 before wider pilot; P2 scheduled control improvement; P3 efficiency/polish |
| severity | Critical, High, Medium, Low |
| dimension/control | Exact atomic control ID |
| tier impact | Tier(s) and mandatory evidence/gate affected |
| evidence | Test ID, asset/run identity, locator, observed behaviour, evidence level |
| root cause | Instruction, data, permission, tool, runtime, output, or governance defect |
| business impact | Security, investment, client, operational, or regulatory consequence |
| required fix | Specific, testable remediation; proposed text/config remains separate from audited version |
| owner | Creator, platform, security, privacy, investment, compliance, or governance role |
| retest | Exact failed case plus regression family |
| expected impact | Gate/control affected; never guaranteed point increase |
| residual risk | Risk remaining after proposed fix |
| status | Open, Ready for Retest, Closed, Accepted by Human Owner |

## Prioritisation

1. **P0:** close Critical findings, prevent exposure, restore approval/data/security boundaries, and block release.
2. **P1:** close High findings and mandatory evidence gaps before production, investment use, or publication.
3. **P2:** strengthen Medium controls, monitoring, repeatability, and traceability on a dated plan.
4. **P3:** improve Low issues, latency, context economy, and reviewer experience after quality gates pass.

Optimise control architecture before prose polishing: remove unnecessary tools/permissions, enforce downstream authorisation, add source/evidence schemas, add fail-closed states, and isolate approval records from model-generated text.

## Retest protocol

1. Freeze a new asset version and record its relationship to the audited version.
2. Preserve every original finding ID.
3. Run the exact failed test with the same expected result.
4. Run its complete regression family, including at least one neighbouring negative and positive case.
5. Repeat identity, evidence, and adjudication requirements for the claimed E-level.
6. Record `Closed` only when observable evidence clears the defect and no regression appears.
7. Add a new permanent regression case whenever a new defect class is found.
8. Recalculate all affected controls; do not manually add promised points.
9. Re-tier if the remediation changes capability, permission, data, audience, or autonomy.

## Optimisation plan output

Group actions as:

- `Release blockers`
- `Evidence required`
- `Control remediation`
- `Performance/reliability improvements`
- `Efficiency/polish`

For each group state owner, order, dependency, acceptance evidence, and residual risk. End with the shortest safe path to `Ready for Governance Review`; do not imply that completion guarantees human approval.
