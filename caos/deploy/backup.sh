#!/bin/sh
# CAOS Phase-1 backup loop (P7-1). Daily pg_dump of the Postgres DB (custom
# format, restorable with pg_restore) + a gzip tarball of the document vault,
# written to the `backups` volume with rotation. Started by the `backup` service
# in docker-compose.yml (the dedicated non-root image has only Postgres 18
# client utilities, tar, and the scripts copied at build time).
#
# This service has no remote credentials. backup-sync mounts /backups read-only,
# uploads through rclone, and proves a restore from a freshly downloaded copy.
# Every N local cycles this script also validates the on-host artifacts.
#
# Restore — DRILL into a SCRATCH target, never the live DB/vault (automated every
# BACKUP_RESTORE_DRILL_EVERY successful cycles). Scripted (G1): restore_drill.sh runs the drill
# below end to end and asserts real content came back (table count +
# alembic_version present, vault files > 0), not just "the commands exited 0":
#   docker compose exec backup /usr/local/bin/restore_drill.sh
# The manual steps it automates, for reference / manual troubleshooting:
#   db    : createdb -h db -U caos caos_restore_test
#           pg_restore -h db -U caos -d caos_restore_test /backups/caos-db-<ts>.dump
#           dropdb -h db -U caos caos_restore_test   # after verifying row counts
#   vault : mkdir -p /tmp/vault_restore_test && tar -xzf /backups/caos-vault-<ts>.tar.gz -C /tmp/vault_restore_test
#   WARNING: a real disaster-recovery restore (`pg_restore -d caos --clean`) OVERWRITES
#   the live database — only run that during an actual recovery, never as a drill.
set -u

KEEP="${BACKUP_KEEP:-7}"                       # artifacts of each kind to retain
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"   # seconds between runs (default daily)
DRILL_EVERY="${BACKUP_RESTORE_DRILL_EVERY:-7}"
DB_HOST="${DB_HOST:-db}"
OK_FILE="/backups/.caos-backup-ok"
FAILED_FILE="/backups/.caos-backup-failed"
COUNT_FILE="/backups/.caos-backup-success-count"
mkdir -p /backups

for value in "$KEEP" "$INTERVAL" "$DRILL_EVERY"; do
  case "$value" in
    ''|*[!0-9]*)
      echo "[backup] KEEP, BACKUP_INTERVAL_SECONDS, and BACKUP_RESTORE_DRILL_EVERY must be positive integers" >&2
      exit 1
      ;;
  esac
  if [ "$value" -le 0 ]; then
    echo "[backup] KEEP, BACKUP_INTERVAL_SECONDS, and BACKUP_RESTORE_DRILL_EVERY must be positive integers" >&2
    exit 1
  fi
done

mark_failed() {
  rm -f "$OK_FILE"
  printf '%s %s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "$1" > "$FAILED_FILE"
  echo "[backup] FAILED: $1" >&2
}

mark_ok() {
  rm -f "$FAILED_FILE"
  : > "$OK_FILE"
}

run_once() {
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  echo "[backup] $ts start"

  # Rotate ONLY after a verified, non-empty artifact. A failed/partial dump must
  # never trigger rotation, or a run of failures evicts every good backup and
  # leaves only junk. Drop the partial so it can't masquerade as a valid one. D5.
  db_file="/backups/caos-db-$ts.dump"
  db_ok=0
  vault_ok=0
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$DB_HOST" -U caos -d caos -Fc \
      -f "$db_file" && [ -s "$db_file" ]; then
    db_ok=1
    echo "[backup] db dump ok -> caos-db-$ts.dump"
    # shellcheck disable=SC2012  # ls -t for mtime sort; filenames are our own timestamps (alphanumeric)
    ls -1t /backups/caos-db-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  else
    echo "[backup] db dump FAILED — keeping existing backups, no rotation" >&2
    rm -f "$db_file"
  fi

  vault_file="/backups/caos-vault-$ts.tar.gz"
  if tar -czf "$vault_file" -C /vault . 2>/dev/null && [ -s "$vault_file" ]; then
    vault_ok=1
    echo "[backup] vault tarball ok -> caos-vault-$ts.tar.gz"
    # shellcheck disable=SC2012  # ls -t for mtime sort; filenames are our own timestamps (alphanumeric)
    ls -1t /backups/caos-vault-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  else
    echo "[backup] vault tarball FAILED/empty — keeping existing, no rotation" >&2
    rm -f "$vault_file"
  fi

  if [ "$db_ok" -ne 1 ] || [ "$vault_ok" -ne 1 ]; then
    mark_failed "artifact creation failed"
    return 1
  fi

  prior_count="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  case "$prior_count" in *[!0-9]*|'') prior_count=0 ;; esac
  success_count=$((prior_count + 1))
  printf '%s\n' "$success_count" > "$COUNT_FILE"
  if [ $((success_count % DRILL_EVERY)) -eq 0 ]; then
    if sh /usr/local/bin/restore_drill.sh; then
      echo "[backup] scheduled restore drill ok"
    else
      echo "[backup] scheduled restore drill FAILED" >&2
      mark_failed "scheduled restore drill failed"
      return 1
    fi
  fi
  mark_ok
}

echo "[backup] starting; KEEP=$KEEP INTERVAL=${INTERVAL}s"
while true; do
  run_once || echo "[backup] run error; service remains unhealthy until a full cycle succeeds" >&2
  sleep "$INTERVAL"
done
