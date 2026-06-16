#!/bin/sh
# CAOS Phase-1 backup loop (P7-1). Daily pg_dump of the Postgres DB (custom
# format, restorable with pg_restore) + a gzip tarball of the document vault,
# written to the `backups` volume with rotation. Started by the `backup` service
# in docker-compose.yml (image postgres:16-alpine — has pg_dump, tar, sh).
#
# ON-HOST DURABILITY ONLY. For real protection against host loss, copy /backups
# OFF the host (rsync / object storage) — see LAUNCH_PHASE1 Operations.
#
# Restore (manual):
#   db    : pg_restore -h db -U caos -d caos --clean /backups/caos-db-<ts>.dump
#   vault : tar -xzf /backups/caos-vault-<ts>.tar.gz -C /vault
set -u

KEEP="${BACKUP_KEEP:-7}"                       # artifacts of each kind to retain
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"   # seconds between runs (default daily)
DB_HOST="${DB_HOST:-db}"
mkdir -p /backups

run_once() {
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  echo "[backup] $ts start"
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$DB_HOST" -U caos -d caos -Fc \
      -f "/backups/caos-db-$ts.dump"; then
    echo "[backup] db dump ok -> caos-db-$ts.dump"
  else
    echo "[backup] db dump FAILED" >&2
  fi
  if tar -czf "/backups/caos-vault-$ts.tar.gz" -C /vault . 2>/dev/null; then
    echo "[backup] vault tarball ok -> caos-vault-$ts.tar.gz"
  else
    echo "[backup] vault tarball skipped (empty vault?)" >&2
  fi
  # Rotation: keep the newest $KEEP of each kind (xargs -r: no-op on empty).
  ls -1t /backups/caos-db-*.dump 2>/dev/null    | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  ls -1t /backups/caos-vault-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
}

echo "[backup] starting; KEEP=$KEEP INTERVAL=${INTERVAL}s"
while true; do
  run_once || echo "[backup] run error (continuing)" >&2
  sleep "$INTERVAL"
done
