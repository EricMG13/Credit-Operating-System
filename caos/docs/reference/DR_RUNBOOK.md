# Disaster Recovery Runbook — Host Loss (G4)

Scope: the self-hosted single-host Docker deploy (`caos/deploy/`) is
unreachable, destroyed, or its disk is gone. This runbook rebuilds on a
**fresh host** from the off-host backup copy. For a live host where you just
need to fix data (not rebuild the box), use G1's scratch-target restore drill
(`caos/deploy/restore_drill.sh`) instead — this document is specifically the
"the old host is gone" case.

## RTO / RPO — stated honestly

| | Value | Why |
|---|---|---|
| **RPO** (data loss window) | **Up to 24h + configured sync lag** | `backup.sh` and `backup_sync.sh` default to daily cycles (`BACKUP_INTERVAL_SECONDS` and `BACKUP_SYNC_INTERVAL_SECONDS`, both 86400s). At worst, a change can arrive just after a backup and that artifact just after a sync: **48h** with both defaults. Set the sync interval shorter if the operational RPO must remain 24h. Artifact, sync, or drill failure marks its service unhealthy. |
| **RTO** (time to serve again) | **Restore-and-boot leg: 88s, measured (§6).** Total RTO = that + host provisioning (untimed, infra-specific — could be minutes on a warm standby image, hours on a cold cloud order). Don't quote "88s" as the production RTO on its own — it excludes provisioning and was measured at pilot-scale data volume; re-time §6 at realistic data volume before citing a production number. | Provisioning a fresh host + Docker is the dominant, unbounded term this runbook can't estimate — it depends entirely on your infra (warm spare vs. cold order). The restore mechanics themselves (steps 3–5) are fast and now proven, not the bottleneck. |

**Prerequisite this whole runbook depends on:** Compose refuses an empty
`BACKUP_REMOTE` or missing `BACKUP_RCLONE_CONFIG_FILE`, but credentials must
also work before host loss. Verify the last run logged
`[backup-sync] remote round trip healthy` and periodically
`remote-copy restore drill ok` (`docker compose logs backup-sync`). An invalid
or silently failing remote means there is nothing to recover from. Also verify
`docker compose ps backup backup-sync` reports both healthy;
this is a **G-phase exit-gate check**, not just a
runbook note — confirm it at every ops readiness pass, not only during an
actual incident.

## 1. Declare the incident

- Confirm the old host is actually gone / unreachable (not a transient
  network blip — don't rebuild over a host that's about to come back with
  newer data than your last off-host sync).
- Note the timestamp of the last known-good off-host sync (from monitoring,
  or the destination's own file timestamps) — this bounds your RPO for this
  specific incident.

## 2. Provision the fresh host

Standard `LAUNCH_PHASE1.md` setup: Docker + Docker Compose, clone the repo
at the last-deployed commit (or `main` if unknown), copy `.env.example` to
`.env` and fill secrets **fresh** — do not try to recover the old host's
`.env`; if it's unrecoverable, that's expected, generate new secrets
(`SESSION_SECRET`, `EDGE_PROXY_SECRET`, `POSTGRES_PASSWORD`,
`ANALYST_SIGNUP_CODE`, oauth2-proxy client secret). Analysts re-authenticate
after recovery regardless (new `SESSION_SECRET` invalidates old cookies) —
this is expected, not a defect.

## 3. Pull the off-host backup artifacts onto the new host

Use rclone with the protected config referenced by `BACKUP_RCLONE_CONFIG_FILE`
(or the storage provider's recovery tooling) to pull the **latest**
`caos-db-<ts>.dump` and
`caos-vault-<ts>.tar.gz` down into a local directory, e.g.:

```bash
mkdir -p /tmp/dr-restore && cd /tmp/dr-restore
# BACKUP_REMOTE and the config path are copied from the recovered ops secrets.
rclone --config /secure/path/rclone.conf copy offhost:caos/production .
ls -t caos-db-*.dump | head -1     # confirm you have the latest
ls -t caos-vault-*.tar.gz | head -1
```

## 4. Restore into the fresh stack

Unlike G1's drill (which restores into a throwaway scratch DB on a *live*
host), this restores into the **real, empty** `caos` database and vault on
the new host — there is no live data to protect against, the host just
booted.

```bash
# Bring up db + backup only first (not app — app would boot against an
# empty/mid-restore DB and seed nothing useful).
docker compose up -d db backup

# Copy the pulled artifacts into the backups volume so paths match what the
# backup/restore tooling expects:
docker cp /tmp/dr-restore/caos-db-<ts>.dump "$(docker compose ps -q backup)":/backups/
docker cp /tmp/dr-restore/caos-vault-<ts>.tar.gz "$(docker compose ps -q backup)":/backups/

# DB: restore directly into caos (not a scratch name — this IS the recovery).
docker compose exec backup sh -c \
  'PGPASSWORD=$POSTGRES_PASSWORD pg_restore -h db -U caos -d caos --clean --if-exists /backups/caos-db-<ts>.dump'

# Vault: extract into the live vault volume.
docker compose exec backup sh -c \
  'tar -xzf /backups/caos-vault-<ts>.tar.gz -C /vault'
```

`--clean --if-exists` is safe here specifically because the target is a
freshly-provisioned empty database — this is the ONE context where the
`pg_restore -d caos --clean` command backup.sh's own comments warn never to
run casually applies as intended.

## 5. Boot the app, verify, resume traffic

```bash
docker compose up -d --build
docker compose logs -f app   # watch for "Application startup complete."
curl -f http://127.0.0.1:8000/api/health   # {"status":"ok", "db":"ok", ...}
```

Spot-check: log in, confirm a known issuer from before the incident is
present, confirm its latest run/documents are there. Only then point DNS /
the load balancer at the new host and restore public traffic.

## 6. Rehearsal log

Re-run this drill at minimum before pre-deployment sign-off and then
quarterly (loop doc L19, `HANDOVER` class post-transfer) — a DR runbook that
has never been executed is a DR runbook that doesn't actually work; every
entry below is a real, timed run, not a read-through.

| Date | Rehearsed by | Scenario | Result | Notes |
|---|---|---|---|---|
| 2026-07-12 | Claude (pre-deployment session) | Simulated full host loss: two isolated Docker networks ("old host", "new host"), a shared off-host volume standing in for the `BACKUP_SYNC_CMD` destination. Old host: fresh Postgres, booted the real CAOS app, created a real issuer via the API (`DR Rehearsal Survivor Co`, id `6a1f22c1-...`), ran a real `pg_dump` + vault tarball with the off-host copy hook (`cp -r /backups/. /mnt/offhost/caos-backups/`, matching `.env.example`'s documented `BACKUP_SYNC_CMD`), then the old host's DB **and its Docker network were destroyed entirely** — only the off-host volume survived, as intended. New host: fresh empty Postgres on a separate network with no connection to the old one, pulled the off-host artifacts, restored `--clean --if-exists` into the live `caos` DB (not a scratch name — this is the real recovery), extracted the vault tarball, booted the app fresh. | **PASS.** `GET /api/issuers?q=DR%20Rehearsal` on the new host returned the exact pre-incident issuer — same id (`6a1f22c1-...`), same name/ticker — recovered entirely from the off-host copy; the old host's data was never touched by the new host. | **88 seconds**, timed wall-clock, provision-new-db → pull-off-host-artifacts → `pg_restore` → vault extract → app boot → verified via API. (DB dump ~70KB / vault tarball ~180 bytes at this data volume — real-world restore time scales with data size, re-time at a realistic pilot data volume before quoting this figure as production RTO.) Host *provisioning* (§2, standing up the box + installing Docker) is out of scope for a container-to-container rehearsal and remains untimed — that's the real-world RTO's dominant, unbounded term, not the restore itself. |
