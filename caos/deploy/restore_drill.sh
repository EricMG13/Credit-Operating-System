#!/bin/sh
# G1 restore drill — turns backup.sh's header-comment procedure into a real,
# runnable script. Restores the LATEST db dump + vault tarball into SCRATCH
# targets, asserts they're real (non-empty, real tables, real row counts),
# then tears the scratch down. Never touches the live `caos` DB or `/vault`.
#
# Run it (from the deploy dir, same container the backup service uses):
#   docker compose exec backup /usr/local/bin/restore_drill.sh
# or, if the backup service isn't running, mount + run once:
#   docker compose run --rm backup /usr/local/bin/restore_drill.sh
#
# The backup service drills the local /backups volume. The separate backup-sync
# service downloads the configured rclone remote into isolated scratch storage
# and invokes this same script with BACKUPS_DIR pointed at that downloaded copy.
# That remote round trip proves the host-loss copy, not merely the local volume.
#
# Exit 0 = both restores verified and scratch state cleaned up. Non-zero =
# see stderr for which leg failed.
set -u

DB_HOST="${DB_HOST:-db}"
BACKUPS_DIR="${BACKUPS_DIR:-/backups}"
SCRATCH_DB="${SCRATCH_DB:-caos_restore_test}"
# Restore payloads can be large, so default to the disk-backed recovery volume.
SCRATCH_VAULT="${SCRATCH_VAULT:-$BACKUPS_DIR/.restore-drill-vault}"

fail() {
  echo "[restore-drill] FAIL: $1" >&2
  exit 1
}

echo "[restore-drill] starting against $BACKUPS_DIR"

# ── DB leg ────────────────────────────────────────────────────────────────
# shellcheck disable=SC2012  # ls -t for mtime sort; filenames are our own timestamps
db_dump="$(ls -1t "$BACKUPS_DIR"/caos-db-*.dump 2>/dev/null | head -n1)"
[ -n "$db_dump" ] || fail "no db dump found in $BACKUPS_DIR — run backup.sh at least once first"
echo "[restore-drill] db: restoring $db_dump into scratch DB $SCRATCH_DB"

# Defensive: never let a stale scratch DB from an interrupted prior drill
# make this run silently pass against old data.
PGPASSWORD="$POSTGRES_PASSWORD" dropdb -h "$DB_HOST" -U caos --if-exists "$SCRATCH_DB" 2>/dev/null

if ! PGPASSWORD="$POSTGRES_PASSWORD" createdb -h "$DB_HOST" -U caos "$SCRATCH_DB"; then
  fail "createdb $SCRATCH_DB failed"
fi

if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h "$DB_HOST" -U caos -d "$SCRATCH_DB" "$db_dump"; then
  PGPASSWORD="$POSTGRES_PASSWORD" dropdb -h "$DB_HOST" -U caos --if-exists "$SCRATCH_DB" 2>/dev/null
  fail "pg_restore into $SCRATCH_DB failed"
fi

# Real assertion, not just "the command exited 0": the alembic version table
# must exist (proves the schema restored, not an empty DB) and at least one
# real table must be present. A dump that restores into an empty/near-empty
# DB is exactly the "backup that never actually backs anything up" failure
# mode this drill exists to catch.
table_count="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -U caos -d "$SCRATCH_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
if [ "${table_count:-0}" -lt 5 ]; then
  PGPASSWORD="$POSTGRES_PASSWORD" dropdb -h "$DB_HOST" -U caos --if-exists "$SCRATCH_DB" 2>/dev/null
  fail "restored DB has only $table_count public tables — dump looks empty/partial"
fi
alembic_ok="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -U caos -d "$SCRATCH_DB" -tAc \
  "SELECT count(*) FROM alembic_version")"
if [ "${alembic_ok:-0}" -lt 1 ]; then
  PGPASSWORD="$POSTGRES_PASSWORD" dropdb -h "$DB_HOST" -U caos --if-exists "$SCRATCH_DB" 2>/dev/null
  fail "restored DB has no alembic_version row — migration state didn't come back"
fi
echo "[restore-drill] db: OK — $table_count tables restored, alembic_version present"

if ! PGPASSWORD="$POSTGRES_PASSWORD" dropdb -h "$DB_HOST" -U caos "$SCRATCH_DB"; then
  fail "could not drop scratch DB $SCRATCH_DB — clean it up manually"
fi

# ── Vault leg ─────────────────────────────────────────────────────────────
# shellcheck disable=SC2012
vault_tar="$(ls -1t "$BACKUPS_DIR"/caos-vault-*.tar.gz 2>/dev/null | head -n1)"
[ -n "$vault_tar" ] || fail "no vault tarball found in $BACKUPS_DIR"
echo "[restore-drill] vault: extracting $vault_tar into $SCRATCH_VAULT"

rm -rf "$SCRATCH_VAULT"
mkdir -p "$SCRATCH_VAULT"
if ! tar -xzf "$vault_tar" -C "$SCRATCH_VAULT"; then
  rm -rf "$SCRATCH_VAULT"
  fail "tar extraction of $vault_tar failed"
fi
file_count="$(find "$SCRATCH_VAULT" -type f | wc -l | tr -d ' ')"
if [ "${file_count:-0}" -lt 1 ]; then
  rm -rf "$SCRATCH_VAULT"
  fail "vault tarball extracted 0 files — tarball looks empty"
fi
echo "[restore-drill] vault: OK — $file_count files extracted"
rm -rf "$SCRATCH_VAULT"

echo "[restore-drill] PASS — db ($db_dump) and vault ($vault_tar) both verified restorable"
