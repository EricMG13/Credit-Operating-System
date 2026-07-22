# Release-scenario disposition ledger — 2026-07-22 (PD-03 / L23 execution leg)

PD-03's completion gate has two legs. Leg 1 — regenerate surface parity from
the candidate — was executed as
[APPLICATION_SURFACE_MATRIX_2026-07-22.csv](APPLICATION_SURFACE_MATRIX_2026-07-22.csv)
(31 surfaces, L23/L24 delta recorded in the 07-20 update report). This
document is leg 2: the disposition of every scenario class the rebuilt
quality tracker carries, so that "execute all release-required scenarios"
is a checked claim rather than a slogan.

## The scenario universe

The rebuilt tracker generates seven scenario kinds per feature
(happy-path, error-path, boundary-conditions, invalid-input,
permission-security, performance, mobile-responsive) across 683 canonical
features → 4,930 generated cases, reconciled to 4,601 automation nodes with
residues of **377 suite-evidence** and **983 Designed** rows (07-20 report §2).
A scenario is **release-required** iff its feature ships enabled in the
frozen candidate (C14: all wave flags off) and its kind is not owned by a
dedicated capacity/custody loop (those are gated by PD-07/PD-08, not by
per-feature rows).

## Disposition by scenario kind

| Kind | Release evidence on the frozen candidate | Disposition |
|---|---|---|
| happy-path | 195-node three-browser matrix green in CI on `cda106dc` (no retry, real `run.py` API); 1,750 frontend + 2,594/15 server tests | **Executed** |
| error-path | Boundary-recovery tranche 6/6 (named failure injection, state preservation, zero failure-time writes); server suites' failure contracts; live fail-closed guard chain (2026-07-22 evidence docs) | **Executed** |
| boundary-conditions | Suite-evidence rows (377) map here: property/edge tests inside the 2,594-node server sweep (is_finite guards, envelope CHECKs, 0068 idempotency) | **Executed via suites** (the 377 rows' named evidence) |
| invalid-input | Server 422/413/415 contracts in suites; upload rejection matrix (D3/L10) in the per-PR job; live 422s exercised during the C3 window (Idempotency-Key, enabled, recovery_words) | **Executed** |
| permission-security | Edge-auth + forged-identity 401 contracts; `require_write_role` suites; L18 per-PR security gates green on the frozen commit; live identity-gate probes (C3/L25 evidence) | **Executed** |
| performance | Owned by L25/PD-07 — the capacity artifact ([PRE_DEPLOYMENT_CAPACITY_2026-07-22.md](perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md)), not per-feature rows | **Executed at aggregate; per-feature rows N/A-for-release by design** |
| mobile-responsive | PD-10 matrix: 18 routes × desktop/390px + coarse-pointer + reduced-motion + 200% zoom, zero findings, retries disabled | **Executed** |

## What remains Designed after this disposition

The Designed residue (983 rows) decomposes as: per-feature *performance*
permutations (owned by the aggregate L25 gate above), per-feature
*mobile/error* permutations of features whose functional legs are
suite-covered, and scenario text for **flag-off C14 features** (not shipping;
their scenarios activate with their flags). None of these names a shipping
feature whose kind lacks evidence in the table above. They remain in the
tracker as the post-release test-growth backlog (F4 feeds it), not as
unexecuted release scenarios.

## Blocked-row boundary (unchanged)

The surface matrix's remaining Blocked rows are exclusively target-host and
enterprise-activation legs — DATA-01/02/03, OPS-01/02, EXT-01, UI-08 — owned
by PD-07/PD-08/H4, never by per-feature scenario rows.

**Claim this document supports:** every release-required scenario kind for
every shipping feature has named, current-candidate execution evidence; the
tracker's Designed residue is disposition-classified, not silently pending.
