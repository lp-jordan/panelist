# Automated database backups → Cloudflare R2

A scheduled `pg_dump` that uploads a compressed, timestamped copy of the whole
database to a Cloudflare R2 bucket. Runs as its own Railway **cron service**, so
the database is never exposed publicly — the job reaches Postgres over Railway's
internal network.

Restores a full point-in-time copy: `gunzip -c panelist-*.sql.gz | psql "$DATABASE_URL"`.

## One-time setup

### 1. Cloudflare R2 (once)
1. Cloudflare dashboard → **R2** → create a bucket, e.g. `panelist-backups`.
2. **R2 → Manage API Tokens → Create API Token**: scope **Object Read & Write**,
   limited to that bucket. Copy the **Access Key ID**, **Secret Access Key**, and
   your account's **S3 endpoint** (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
3. (Recommended) Bucket → **Settings → Object lifecycle rules**: delete objects
   under `backups/` older than N days (e.g. 30) so old dumps don't accumulate.

### 2. Railway backup service (once)
Create a **new service in the same project** (so it shares the private network
with Postgres):
1. New service → **Deploy from the same GitHub repo**.
2. Service **Settings → Source → Root Directory** = `backup` (so it builds this
   Dockerfile, not the app).
3. **Settings → Cron Schedule** = e.g. `0 6 * * *` (daily 06:00 UTC).
4. **Variables** — set:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference the Postgres service
     so it uses the internal URL)
   - `R2_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `R2_BUCKET` = `panelist-backups`
   - `AWS_ACCESS_KEY_ID` = R2 token access key
   - `AWS_SECRET_ACCESS_KEY` = R2 token secret
5. Deploy. Trigger once manually to confirm a `backups/panelist-<timestamp>.sql.gz`
   object appears in the bucket.

Because it's a cron service, Railway runs the container on the schedule; it dumps,
uploads, and exits.
