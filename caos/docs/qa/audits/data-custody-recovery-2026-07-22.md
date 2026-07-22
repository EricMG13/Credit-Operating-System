# Data custody & recovery audit — 2026-07-22 (L26 / PD-08, frozen candidate)

Executed against the frozen image `sha256:882efb398526…` stack from the L25
run (live PostgreSQL at the manifest digest, ClamAV, deploy container
contract, 15 principals, 300 issuers / 441 vault files / 510+ runs).

## 1. Record enumeration → store (verified live, not from docs)

| Record | Store observed | Evidence |
|---|---|---|
| Uploaded document bytes | `/vault` volume, content-addressed names | 441 files counted in the volume after the upload stage; survive app restart |
| Issuers, runs, module outputs, metric facts, watch rules, alerts, delivery intents, analysts | PostgreSQL | psql counts through every stage; survive app + DB restarts |
| Analyst drafts/preferences | browser storage only | no server table; absent from dumps (by design) |
| Access + LLM call audit | structured stdout logs (`caos.access`, `caos.llm`) | JSON lines captured during load incl. per-call tokens/cost |
| Backups | `backups` volume + rclone remote | artifacts below |

## 2. Isolation & principal switch

15 distinct forwarded principals drove the load; every `caos.access` line
carries the acting entity; run rows stamp `analyst_id` (verified in DB:
runs attributed across `analyst-01..15`). Registration/login throttles and
forged-identity 401s verified live (H1 rows). Team scope remains the shared
single-desk model per the accepted-risk register (#2).

## 3. Backup → off-host → recovery chain (all executed today)

| Leg | Mechanism (unmodified deploy scripts/images) | Result |
|---|---|---|
| Local cycle | `caos-backup:pg18` container, `backup.sh`: pg_dump -Fc (11.1 MB) + vault tar.gz (441 files) + ok-marker + rotation | **PASS** |
| Local scratch drill | `restore_drill.sh` in-container | **PASS** — 66 tables, `alembic_version` present, 441 files, scratch cleaned |
| Off-host sync | `caos-backup-sync:pg18-rclone`, `backup_sync.sh`: rclone upload → independent download → drill on the *downloaded* copy | **PASS** — "remote round trip healthy" |
| **Remote-only recovery** (local-loss simulation) | local `/backups` artifacts deleted; fresh rclone download from the remote; `BACKUPS_DIR=/restore/offhost` drill | **PASS** — restore succeeded with no local artifact present |
| **Restore + upgrade + boot rehearsal** (H0 manual slot) | pg_restore into a scratch DB → `alembic upgrade head` (0068, clean no-op procedure) → frozen image booted against the restored DB → critical read 200 + write (register) 201 → scratch dropped | **PASS** |

## 4. Boundaries — the owner/target legs PD-08 still needs

1. **Real off-host destination**: today's remote was an rclone local-alias
   stand-in proving the mechanism; the target needs a genuine remote
   (different failure domain) + `BACKUP_REMOTE`/secret config. (Also found:
   a stand-in local remote dir needs UID-10001 ownership — real cloud
   backends are unaffected.)
2. **Encryption**: at-rest encryption of host volumes and the remote bucket
   (+ optional rclone-crypt) is a host/provider control — unprovable off-target.
3. **Freshness alerting**: ok/failed marker files exist and flip container
   health; wiring them to the enterprise alert channel is G7/L22 owner config.
4. **Retention/legal hold**: policy written (handover DATA_GOVERNANCE.md);
   owner decisions ☐ at H5.

With those four named exceptions, every L26 mechanism is executed and green
on the frozen candidate.
