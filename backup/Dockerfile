# Scheduled Panelist backup job: Postgres dump + art originals -> Cloudflare R2.
#
# Runs as a SEPARATE Railway service with a Cron Schedule (e.g. daily). It is
# not part of the app image. pg_dump must be >= the server version (prod is
# Postgres 18), hence the postgres:18 base. aws-cli talks to R2's S3 API, age
# encrypts the dump to the backup public key, rclone mirrors the art bucket.
FROM postgres:18-alpine

RUN apk add --no-cache aws-cli age rclone

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Railway runs this once per cron tick; the script runs BACKUP_MODE and exits.
CMD ["/usr/local/bin/backup.sh"]
