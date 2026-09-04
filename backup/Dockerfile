# Scheduled Postgres → Cloudflare R2 backup job.
#
# Runs as a SEPARATE Railway service with a Cron Schedule (e.g. daily). It is
# not part of the app image. pg_dump must be >= the server version (prod is
# Postgres 18), hence the postgres:18 base; aws-cli talks to R2's S3 API.
FROM postgres:18-alpine

RUN apk add --no-cache aws-cli

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Railway runs this once per cron tick; the script dumps, uploads, and exits.
CMD ["/usr/local/bin/backup.sh"]
