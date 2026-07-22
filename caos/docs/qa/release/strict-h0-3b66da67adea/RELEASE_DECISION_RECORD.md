# CAOS release decision record — H0 candidate `3b66da67` / image `sha256:882efb398526…`

**PD-09 archive.** This record binds the released bytes to their evidence and
carries the final go/no-go signature. Everything referenced is committed at or
before the candidate commit; the manifest directory is digest-addressed.

## The candidate

| Field | Value |
|---|---|
| Commit (== origin/main) | `3b66da67adea…` |
| App image (unchanged from the cda106dc freeze — no image-input files changed in the config-only delta) | `caos-app@sha256:882efb398526a374faa6100a04effbd6275f145ba391215990e048fd7cd52258` |
| Schema head | `0068` |
| Flags | 13/13 declared, all `false` |
| Strict manifest | `RELEASE_MANIFEST.json` in this directory (zero strict failures) |

## Evidence bundle (H0/H1/H2 + blocker legs)

| Evidence | Artifact |
|---|---|
| H0 freeze + preflight | this directory + [SCAN_DISPOSITION.md](SCAN_DISPOSITION.md) + restore→upgrade→boot rehearsal in [data-custody-recovery-2026-07-22.md](../../audits/data-custody-recovery-2026-07-22.md) |
| H1 checklist | [H1_REHEARSAL_2026-07-22.md](../../H1_REHEARSAL_2026-07-22.md) (target repeat = owner) |
| H2 one-sweep regression | CI 29917558055 (cda106dc code) + CI on `3b66da67` + Nightly 29929720671 — links in the manifest |
| Capacity + faults (PD-07) | [PRE_DEPLOYMENT_CAPACITY_2026-07-22.md](../../perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md) |
| Custody + recovery (PD-08) | [data-custody-recovery-2026-07-22.md](../../audits/data-custody-recovery-2026-07-22.md) |
| Seam runtime (PD-06) | [C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md](../../C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md) + [MODEL_PROVIDER_ACTIVATION_EVIDENCE_2026-07-22.md](../../MODEL_PROVIDER_ACTIVATION_EVIDENCE_2026-07-22.md) |
| Scenario execution (PD-03) | [SCENARIO_DISPOSITION_2026-07-22.md](../../SCENARIO_DISPOSITION_2026-07-22.md) |
| Blocker closure (H8) | [H8_CLOSURE_LEDGER_2026-07-22.md](../../H8_CLOSURE_LEDGER_2026-07-22.md) — zero OPEN rows |
| Handover (H3/H4) | [handover/INDEX.md](../../../handover/INDEX.md) |

## Conditions of release (from the accepted-risk register and ledgers)

1. Scan disposition signed (SCAN_DISPOSITION §3).
2. Target host named (G9) and the target legs executed there: H1 §5 verbatim,
   L25/L26 repeats, external monitoring probe live (G7), real off-host remote
   with encryption + staleness alerting (G8), H6 persona UAT, H7 timed
   rehearsal with one forced abort.
3. H5 sign-off table completed (all six roles).
4. The two allowed-outstanding items remain: email transport and Bloomberg
   activation (packages ready; in-app delivery and manual market data are the
   operating modes until activated).

## Decision

| Decision | Name | Date |
|---|---|---|
| ☐ GO (deploy this digest) / ☐ NO-GO | ____________ | ______ |
