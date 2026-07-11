#!/bin/sh
# CAOS Phase-1 backup loop (P7-1). Daily pg_dump of the Postgres DB (custom
# format, restorable with pg_restore) + a gzip tarball of the document vault,
# written to the `backups` volume with rotation. Started by the `backup` service
# in docker-compose.yml (image postgres:18-alpine — has pg_dump, tar, sh;
# pg_dump major matches the pgvector:pg18 db).
#
# ON-HOST DURABILITY ONLY unless BACKUP_SYNC_CMD is set. For real protection
# against host loss, copy /backups OFF the host: set BACKUP_SYNC_CMD to any
# shell command (rsync / rclone / aws s3 sync ...) and it runs after each cycle
# — see LAUNCH_PHASE1 Operations.
#
# Restore — DRILL into a SCRATCH target, never the live DB/vault (verify quarterly,
# see LAUNCH_PHASE1 Operations):
#   db    : createdb -h db -U caos caos_restore_test
#           pg_restore -h db -U caos -d caos_restore_test /backups/caos-db-<ts>.dump
#           dropdb -h db -U caos caos_restore_test   # after verifying row counts
#   vault : mkdir -p /tmp/vault_restore_test && tar -xzf /backups/caos-vault-<ts>.tar.gz -C /tmp/vault_restore_test
#   WARNING: a real disaster-recovery restore (`pg_restore -d caos --clean`) OVERWRITES
#   the live database — only run that during an actual recovery, never as a drill.
set -u

KEEP="${BACKUP_KEEP:-7}"                       # artifacts of each kind to retain
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"   # seconds between runs (default daily)
DB_HOST="${DB_HOST:-db}"
mkdir -p /backups

run_once() {
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  echo "[backup] $ts start"

  # Rotate ONLY after a verified, non-empty artifact. A failed/partial dump must
  # never trigger rotation, or a run of failures evicts every good backup and
  # leaves only junk. Drop the partial so it can't masquerade as a valid one. D5.
  db_file="/backups/caos-db-$ts.dump"
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$DB_HOST" -U caos -d caos -Fc \
      -f "$db_file" && [ -s "$db_file" ]; then
    echo "[backup] db dump ok -> caos-db-$ts.dump"
    # shellcheck disable=SC2012  # ls -t for mtime sort; filenames are our own timestamps (alphanumeric)
    ls -1t /backups/caos-db-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  else
    echo "[backup] db dump FAILED — keeping existing backups, no rotation" >&2
    rm -f "$db_file"
  fi

  vault_file="/backups/caos-vault-$ts.tar.gz"
  if tar -czf "$vault_file" -C /vault . 2>/dev/null && [ -s "$vault_file" ]; then
    echo "[backup] vault tarball ok -> caos-vault-$ts.tar.gz"
    # shellcheck disable=SC2012  # ls -t for mtime sort; filenames are our own timestamps (alphanumeric)
    ls -1t /backups/caos-vault-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  else
    echo "[backup] vault tarball FAILED/empty — keeping existing, no rotation" >&2
    rm -f "$vault_file"
  fi

  # Off-host copy hook (audit 2026-07-11 E-2): host loss must not equal backup
  # loss. Off by default; failure is logged but never blocks the local cycle.
  if [ -n "${BACKUP_SYNC_CMD:-}" ]; then
    if sh -c "$BACKUP_SYNC_CMD"; then
      echo "[backup] off-host sync ok"
    else
      echo "[backup] off-host sync FAILED (local backups unaffected)" >&2
    fi
  fi
}

echo "[backup] starting; KEEP=$KEEP INTERVAL=${INTERVAL}s"
while true; do
  run_once || echo "[backup] run error (continuing)" >&2
  sleep "$INTERVAL"
done
