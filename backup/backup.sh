#!/bin/sh
# Panelist backups: the whole database plus every art original, into the backup
# R2 bucket. Runs as the `panelist-backup` Railway cron service. The database
# stays private: this reaches Postgres over Railway's internal network.
#
# BACKUP_MODE picks what a run does (default: backup). See RESTORE.md.
#   backup       nightly: encrypted database dump + art copy
#   verify       practice restore: load the latest dump into a scratch database
#                on the same server, compare row counts with live, drop it
#   restore-db   load a dump into RESTORE_DATABASE_URL (REPLACES its contents)
#   restore-art  copy art originals from the backup back into the art bucket
#
# Layout in the backup bucket:
#   db/daily/panelist-<ts>.sql.gz.age     every night   (expire after 30 days)
#   db/monthly/panelist-<ts>.sql.gz.age   1st of month  (expire after 365 days)
#   art/current/<same keys as panelist-art>
#   art/deleted/<date>/<key>              art removed from Panelist that day
#                                         (expire after 30 days)
set -eu

MODE="${BACKUP_MODE:-backup}"

: "${DATABASE_URL:?DATABASE_URL not set}"
: "${R2_BUCKET:?R2_BUCKET not set (the backup bucket)}"
: "${R2_ENDPOINT:?R2_ENDPOINT not set (https://<accountid>.r2.cloudflarestorage.com)}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID not set (R2 token access key)}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY not set (R2 token secret)}"
# The art bucket. One R2 token covers both buckets (read on this one, read and
# write on the backup bucket) so rclone copies inside R2 and the bytes never
# pass through Railway, which bills outbound data.
ART_BUCKET="${ART_SOURCE_BUCKET:-}"

# R2 ignores region but the S3 client needs one.
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
# R2's wildcard cert only covers one label, so virtual-hosted-style addressing
# (bucket.<account>.r2.cloudflarestorage.com) fails the TLS handshake. Force
# path-style (<account>.r2.cloudflarestorage.com/bucket).
aws configure set default.s3.addressing_style path

# rclone remote "r2", configured from the environment (no config file).
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_FORCE_PATH_STYLE=true
# The token is scoped to its buckets and can't create buckets; don't try.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
s3() { aws s3 "$@" --endpoint-url "$R2_ENDPOINT" --only-show-errors; }

# Row counts that say "this is the same data": compared live vs restored.
COUNTS_SQL='SELECT
  (SELECT count(*) FROM "User")          AS users,
  (SELECT count(*) FROM "Project")       AS projects,
  (SELECT count(*) FROM "Script")        AS scripts,
  (SELECT count(*) FROM "Page")          AS pages,
  (SELECT count(*) FROM "ImportedPage")  AS imported_pages,
  (SELECT count(*) FROM "Reference")     AS refs,
  (SELECT count(*) FROM "AssetData")     AS stored_images,
  (SELECT count(*) FROM "ArtVersion")    AS art_versions,
  (SELECT count(*) FROM "ArtComment")    AS art_notes;'

# The newest daily dump's key, or $RESTORE_FILE if one was named.
pick_dump() {
  if [ -n "${RESTORE_FILE:-}" ]; then
    echo "$RESTORE_FILE"
  else
    aws s3 ls "s3://${R2_BUCKET}/db/daily/" --endpoint-url "$R2_ENDPOINT" | awk '{print $4}' | sort | tail -n 1 | sed 's|^|db/daily/|'
  fi
}

# Download and decrypt a dump to $1 (plain .sql). Needs the private key, given
# only for the run in BACKUP_AGE_IDENTITY and removed afterwards.
fetch_dump() {
  : "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY not set: paste the backup private key for this run only}"
  key="$(pick_dump)"
  [ -n "$key" ] || { log "no dump found in db/daily/"; exit 1; }
  log "using s3://${R2_BUCKET}/${key}"
  s3 cp "s3://${R2_BUCKET}/${key}" /tmp/dump.age
  # Railway variables are single-line, so the key is usually pasted base64
  # encoded (private-key-one-line.txt); a raw key works too.
  umask 077
  case "$BACKUP_AGE_IDENTITY" in
    -----BEGIN*|AGE-SECRET-KEY-*) printf '%s\n' "$BACKUP_AGE_IDENTITY" > /tmp/identity ;;
    *) printf '%s' "$BACKUP_AGE_IDENTITY" | base64 -d > /tmp/identity ;;
  esac
  age -d -i /tmp/identity /tmp/dump.age | gunzip > "$1"
  rm -f /tmp/identity /tmp/dump.age
}

do_backup() {
  TS="$(date -u +%Y%m%dT%H%M%SZ)"

  # 1. Database: dump, check it, encrypt to the backup public key.
  log "dumping database…"
  pg_dump "$DATABASE_URL" --no-owner --no-acl --clean --if-exists | gzip -9 > /tmp/dump.sql.gz
  gzip -t /tmp/dump.sql.gz
  if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
    printf '%s\n' "$BACKUP_AGE_RECIPIENT" > /tmp/recipient
    age -R /tmp/recipient -o /tmp/dump.age /tmp/dump.sql.gz
    FILE="panelist-${TS}.sql.gz.age"
  else
    log "WARNING: BACKUP_AGE_RECIPIENT not set, so this dump is NOT encrypted"
    mv /tmp/dump.sql.gz /tmp/dump.age
    FILE="panelist-${TS}.sql.gz"
  fi
  log "dump size $(du -h /tmp/dump.age | cut -f1); uploading db/daily/${FILE}"
  s3 cp /tmp/dump.age "s3://${R2_BUCKET}/db/daily/${FILE}"
  if [ "$(date -u +%d)" = "01" ]; then
    s3 cp /tmp/dump.age "s3://${R2_BUCKET}/db/monthly/${FILE}"
    log "kept as this month's copy: db/monthly/${FILE}"
  fi
  rm -f /tmp/dump.sql.gz /tmp/dump.age /tmp/recipient

  # 2. Art: mirror every original (previews are rebuilt from them). Art removed
  #    from Panelist since last night moves to art/deleted/<date>/ rather than
  #    vanishing. Each version's key never changes, so size is enough to compare
  #    and each night only copies what's new.
  if [ -n "$ART_BUCKET" ]; then
    log "copying art originals from ${ART_BUCKET}…"
    rclone sync "r2:${ART_BUCKET}" "r2:${R2_BUCKET}/art/current" \
      --include "art/**/original.*" \
      --backup-dir "r2:${R2_BUCKET}/art/deleted/$(date -u +%Y-%m-%d)" \
      --size-only --fast-list --stats-one-line --stats-log-level NOTICE -v
    log "art backup: $(rclone size "r2:${R2_BUCKET}/art/current" --json | tr -d '\n')"
  else
    log "WARNING: ART_SOURCE_BUCKET not set, so art is NOT backed up"
  fi

  log "backup complete: db/daily/${FILE}"
}

do_verify() {
  fetch_dump /tmp/dump.sql
  # A scratch database on the same server; never the live one.
  base="${DATABASE_URL%/*}"
  check_url="${base}/panelist_restore_check"
  log "loading into scratch database panelist_restore_check…"
  psql "$DATABASE_URL" -q -c 'DROP DATABASE IF EXISTS panelist_restore_check;' -c 'CREATE DATABASE panelist_restore_check;'
  psql "$check_url" -q -v ON_ERROR_STOP=1 -f /tmp/dump.sql > /dev/null
  rm -f /tmp/dump.sql
  log "row counts, live vs restored (live may be slightly ahead of last night's backup):"
  echo "live:";     psql "$DATABASE_URL" -A -F ' | ' -c "$COUNTS_SQL"
  echo "restored:"; psql "$check_url"    -A -F ' | ' -c "$COUNTS_SQL"
  # KEEP_RESTORE_CHECK=yes leaves the scratch copy for a one-project restore.
  if [ "${KEEP_RESTORE_CHECK:-}" = "yes" ]; then
    log "kept scratch database panelist_restore_check; drop it when done"
  else
    psql "$DATABASE_URL" -q -c 'DROP DATABASE panelist_restore_check;'
  fi
  if [ -n "$ART_BUCKET" ]; then
    log "art originals, live vs backup:"
    echo "live:   $(rclone size "r2:${ART_BUCKET}" --include 'art/**/original.*' --json | tr -d '\n')"
    echo "backup: $(rclone size "r2:${R2_BUCKET}/art/current" --json | tr -d '\n')"
  fi
  log "practice restore finished"
}

do_restore_db() {
  : "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL not set: the database to restore INTO (its contents are replaced)}"
  [ "${RESTORE_CONFIRM:-}" = "yes" ] || { log "set RESTORE_CONFIRM=yes to replace that database's contents"; exit 1; }
  fetch_dump /tmp/dump.sql
  log "restoring into RESTORE_DATABASE_URL…"
  psql "$RESTORE_DATABASE_URL" -q -v ON_ERROR_STOP=1 -f /tmp/dump.sql > /dev/null
  rm -f /tmp/dump.sql
  echo "restored:"; psql "$RESTORE_DATABASE_URL" -A -F ' | ' -c "$COUNTS_SQL"
  log "database restore complete"
}

do_restore_art() {
  : "${ART_SOURCE_BUCKET:?ART_SOURCE_BUCKET not set}"
  [ "${RESTORE_CONFIRM:-}" = "yes" ] || { log "set RESTORE_CONFIRM=yes to copy art back into ${ART_BUCKET}"; exit 1; }
  # Default: put back everything in the backup that's missing from the art
  # bucket (copy, never delete). RESTORE_ART_FROM can name a folder instead,
  # e.g. art/deleted/2026-10-20 to bring back art deleted that day.
  from="${RESTORE_ART_FROM:-art/current}"
  log "copying r2:${R2_BUCKET}/${from} -> r2:${ART_BUCKET} (missing files only)…"
  rclone copy "r2:${R2_BUCKET}/${from}" "r2:${ART_BUCKET}" --size-only --fast-list --stats-one-line -v
  log "art restore complete. Previews: set those versions' previewStatus to PENDING and the worker rebuilds them."
}

case "$MODE" in
  backup) do_backup ;;
  verify) do_verify ;;
  restore-db) do_restore_db ;;
  restore-art) do_restore_art ;;
  *) log "unknown BACKUP_MODE: $MODE"; exit 1 ;;
esac
