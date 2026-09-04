#!/bin/sh
# Dump the whole database and upload a compressed, timestamped copy to R2.
# The DB stays private: this runs inside Railway and reaches Postgres over the
# internal network via DATABASE_URL.
set -eu

: "${DATABASE_URL:?DATABASE_URL not set}"
: "${R2_BUCKET:?R2_BUCKET not set}"
: "${R2_ENDPOINT:?R2_ENDPOINT not set (https://<accountid>.r2.cloudflarestorage.com)}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID not set (R2 token access key)}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY not set (R2 token secret)}"
# R2 ignores region but the S3 client needs one.
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="panelist-${TS}.sql.gz"
TMP="/tmp/${FILE}"

echo "[$(date -u)] dumping database…"
pg_dump "$DATABASE_URL" --no-owner --no-acl --clean --if-exists | gzip -9 > "$TMP"
echo "[$(date -u)] dump size $(du -h "$TMP" | cut -f1); uploading to s3://${R2_BUCKET}/backups/${FILE}"

aws s3 cp "$TMP" "s3://${R2_BUCKET}/backups/${FILE}" \
  --endpoint-url "$R2_ENDPOINT" \
  --only-show-errors

echo "[$(date -u)] backup complete: ${FILE}"
