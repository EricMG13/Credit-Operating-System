#!/bin/sh
# Upload completed local recovery artifacts through rclone, then periodically
# download the remote copy into isolated scratch storage and run the real
# database/vault restore assertions against that downloaded copy.
set -u

INTERVAL="${BACKUP_SYNC_INTERVAL_SECONDS:-86400}"
DRILL_EVERY="${BACKUP_REMOTE_RESTORE_DRILL_EVERY:-7}"
DB_HOST="${DB_HOST:-db}"
REMOTE="${BACKUP_REMOTE:-}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/run/secrets/backup_rclone_config}"
RESTORE_ROOT="${BACKUP_REMOTE_RESTORE_DIR:-/restore/offhost}"
OK_FILE="/restore/.caos-backup-sync-ok"
FAILED_FILE="/restore/.caos-backup-sync-failed"
COUNT_FILE="/restore/.caos-backup-sync-success-count"

[ -n "$REMOTE" ] || {
  echo "[backup-sync] BACKUP_REMOTE is required" >&2
  exit 1
}
[ -r "$RCLONE_CONFIG" ] || {
  echo "[backup-sync] rclone config is not readable at $RCLONE_CONFIG" >&2
  exit 1
}
export RCLONE_CONFIG
REMOTE="${REMOTE%/}"

for value in "$INTERVAL" "$DRILL_EVERY"; do
  case "$value" in
    ''|*[!0-9]*)
      echo "[backup-sync] intervals must be positive integers" >&2
      exit 1
      ;;
  esac
  if [ "$value" -le 0 ]; then
    echo "[backup-sync] intervals must be positive integers" >&2
    exit 1
  fi
done

mark_failed() {
  rm -f "$OK_FILE"
  printf '%s %s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "$1" > "$FAILED_FILE"
  echo "[backup-sync] FAILED: $1" >&2
}

mark_ok() {
  rm -f "$FAILED_FILE"
  : > "$OK_FILE"
}

latest_artifact() {
  pattern="$1"
  # Timestamp filenames are generated locally and contain no whitespace.
  # shellcheck disable=SC2012,SC2086
  ls -1t /backups/$pattern 2>/dev/null | head -n1
}

sync_once() {
  db_file="$(latest_artifact 'caos-db-*.dump')"
  vault_file="$(latest_artifact 'caos-vault-*.tar.gz')"
  if [ -z "$db_file" ] || [ ! -s "$db_file" ] || [ -z "$vault_file" ] || [ ! -s "$vault_file" ]; then
    mark_failed "local recovery artifacts unavailable"
    return 1
  fi

  echo "[backup-sync] uploading $(basename "$db_file") and $(basename "$vault_file")"
  if ! rclone copyto "$db_file" "$REMOTE/$(basename "$db_file")" \
      || ! rclone copyto "$vault_file" "$REMOTE/$(basename "$vault_file")" \
      || ! rclone check /backups "$REMOTE" --include "$(basename "$db_file")" --one-way \
      || ! rclone check /backups "$REMOTE" --include "$(basename "$vault_file")" --one-way; then
    mark_failed "remote upload verification failed"
    return 1
  fi

  prior_count="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  case "$prior_count" in *[!0-9]*|'') prior_count=0 ;; esac
  success_count=$((prior_count + 1))
  printf '%s\n' "$success_count" > "$COUNT_FILE"

  if [ $((success_count % DRILL_EVERY)) -eq 0 ]; then
    rm -rf "$RESTORE_ROOT"
    mkdir -p "$RESTORE_ROOT"
    if ! rclone copy "$REMOTE" "$RESTORE_ROOT" \
        --include 'caos-db-*.dump' --include 'caos-vault-*.tar.gz'; then
      mark_failed "remote recovery download failed"
      return 1
    fi
    if ! BACKUPS_DIR="$RESTORE_ROOT" \
        SCRATCH_DB="caos_remote_restore_test" \
        SCRATCH_VAULT="/restore/.remote-restore-drill-vault" \
        DB_HOST="$DB_HOST" \
        sh /usr/local/bin/restore_drill.sh; then
      mark_failed "remote-copy restore drill failed"
      return 1
    fi
    rm -rf "$RESTORE_ROOT"
    echo "[backup-sync] remote-copy restore drill ok"
  fi

  mark_ok
  echo "[backup-sync] remote round trip healthy"
}

echo "[backup-sync] starting; REMOTE=$REMOTE INTERVAL=${INTERVAL}s"
while true; do
  sync_once || echo "[backup-sync] cycle failed; service remains unhealthy" >&2
  sleep "$INTERVAL"
done
