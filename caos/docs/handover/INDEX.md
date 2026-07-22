# CAOS handover package — index (H3) — 2026-07-22

Every artifact the H5 signers need, one link each. A row is complete when its
link resolves; owner-fill items are marked.

| # | Artifact | Location | State |
|---|---|---|---|
| 1 | Architecture overview | [caos/README.md](../../README.md) + [Master Blueprint](../CAOS_Master_Blueprint.md) | as-built |
| 2 | Admin guide (deploy, secrets, flags, backup/DR, scaling, roles) | [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | complete |
| 3 | Analyst onboarding guide | [ANALYST_ONBOARDING.md](ANALYST_ONBOARDING.md) | complete |
| 4 | OpenAPI export + endpoint inventory | [openapi.json](openapi.json) (139 routes / 178 operations — matches the surface matrix) | generated from the frozen candidate |
| 5 | SBOM / license report | [reference/SBOM.md](../reference/SBOM.md) + CycloneDX pair in [strict-h0-cda106dc3973/](../qa/release/strict-h0-cda106dc3973/) | complete |
| 6 | Release manifest + scan disposition | [RELEASE_MANIFEST.json](../qa/release/strict-h0-cda106dc3973/RELEASE_MANIFEST.json) · [SCAN_DISPOSITION.md](../qa/release/strict-h0-cda106dc3973/SCAN_DISPOSITION.md) | manifest frozen; disposition awaiting owner signature |
| 7 | Migration/rollback rehearsal evidence | manifest slot `db_restore_upgrade_rehearsal` | **owner/target leg open** |
| 8 | Host baseline (G9) | — | **owner: target host not yet named** |
| 9 | Monitoring inventory (G7) | [MONITORING_INVENTORY.md](MONITORING_INVENTORY.md) | doc complete; external probe = owner config |
| 10 | Cutover run sheet (H7) | [CUTOVER_RUNSHEET.md](CUTOVER_RUNSHEET.md) | complete; names + rehearsal at owner |
| 11 | Data-governance / vendor matrix (E8) | [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) | complete; ☐ owner decisions at H5 |
| 12 | Accepted-risk register | [ACCEPTED_RISK_REGISTER.md](ACCEPTED_RISK_REGISTER.md) | complete; signatures at H5 |
| 13 | Support model + handover loops | [SUPPORT_MODEL.md](SUPPORT_MODEL.md) | complete; owner names at H5 |
| 14 | Activation package: email | [reference/EMAILSINK_SPEC.md](../reference/EMAILSINK_SPEC.md) | transfer-ready |
| 15 | Activation package: Bloomberg | [reference/BLOOMBERG_ACTIVATION_RUNBOOK.md](../reference/BLOOMBERG_ACTIVATION_RUNBOOK.md) | transfer-ready |
| 16 | Capacity evidence (L25) | [qa/perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md](../qa/perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md) | this session |
| 17 | Seam evidence (C3 live ops, provider activation) | [C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md](../qa/C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md) · [MODEL_PROVIDER_ACTIVATION_EVIDENCE_2026-07-22.md](../qa/MODEL_PROVIDER_ACTIVATION_EVIDENCE_2026-07-22.md) | this session |
| 18 | Scenario disposition (PD-03) | [SCENARIO_DISPOSITION_2026-07-22.md](../qa/SCENARIO_DISPOSITION_2026-07-22.md) | this session |
