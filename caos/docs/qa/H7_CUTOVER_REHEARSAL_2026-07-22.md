# H7 cutover / forced-abort / rollback rehearsal — 2026-07-22

Timed rehearsal of the [cutover run sheet](../handover/CUTOVER_RUNSHEET.md) on
the prod-parity local stack, consuming the candidate **by immutable digest**
(`caos-app@sha256:882efb398526…`, never a tag or build), with live PostgreSQL
and ClamAV at manifest digests. This satisfies H7's "rehearse the timed run
sheet on prod-parity, including one forced abort and restoration of the
last-good digest/data state"; the target repeat with named people is the
remaining owner leg.

## Timed sequence (all UTC, 2026-07-22)

| T | Step | Result |
|---|---|---|
| 18:26:39 | Deploy last-good **by digest** (fresh DB; migrations self-apply under the advisory lock) | healthy at 18:26:53 — **14 s** |
| 18:26:5x | Post-deploy spot checks: register **201**, issuer create **201** | pre-cutover state exists |
| 18:27:08 | **T-1d backup equivalent**: pg_dump (custom format) + vault tarball via the backup image | both artifacts written |
| 18:27:32 | **Cutover to the "new candidate"** — deliberately broken configuration (unreachable DB) plays the failed deploy | container **fail-closed exits**; service down; health unreachable |
| 18:27:44 | **ABORT decision** (threshold: app cannot serve / cannot reach DB) | rollback ordered |
| 18:28:05 | Rollback: drop broken state → `pg_restore` the pre-cutover dump → start the **last-good digest** | data restored 18:28:06; healthy 18:28:20 |
| 18:28:20 | Verification: health ok; **pre-cutover issuer present** via authenticated read | state loss: none |

**Abort → restored service: 36 seconds.** Deploy-to-healthy: 14 s. Restore
(dump ~221 KB at rehearsal scale): 1 s — scales with DB size; the target run
re-measures with target-size data.

## What the rehearsal proved

1. The digest-pinned deploy path works with zero source access.
2. A bad deploy **fails closed** (exits; it never half-serves).
3. The documented rollback path (previous digest + restored data) returns the
   exact pre-cutover state — verified by data presence, not just health.
4. The run-sheet thresholds are actionable: "cannot serve" was observable
   within seconds of the failed cutover.

Owner residuals: real names in the run-sheet roles, target-host repeat, and
the analyst-notification / status-channel legs (communication, not
mechanics).
