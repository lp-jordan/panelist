# Panelist backups

A nightly Railway **cron service** (`panelist-backup`, Root Directory `backup`)
that copies, into the backup R2 bucket:

- the **whole database**, as a `pg_dump` encrypted with
  [age](https://age-encryption.org) to the backup public key, and
- **every art original**, every version, from the art bucket.

Art deleted from Panelist moves to `art/deleted/<date>/` in the backup instead
of vanishing. The database stays private: the job reaches Postgres over
Railway's internal network. Restores (and the monthly practice restore) are in
[RESTORE.md](RESTORE.md).

## Variables (panelist-backup service)

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | the backup bucket, e.g. `panelist-backups` |
| `ART_SOURCE_BUCKET` | the art bucket, `panelist-art` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | one R2 token with **Object Read** on the art bucket and **Object Read & Write** on the backup bucket |
| `BACKUP_AGE_RECIPIENT` | the backup **public** key (`panelist-backup-key.pub`) |

One token covers both buckets on purpose: rclone then copies art inside R2
(server-side), so art bytes never pass through Railway, which bills outbound
data. Both buckets must be in the same Cloudflare account for that.

Without `ART_SOURCE_BUCKET` the job skips art; without `BACKUP_AGE_RECIPIENT`
the dump is uploaded unencrypted. Both log a WARNING.

## Backup bucket settings (Cloudflare → R2 → bucket → Settings)

**Bucket lock rules** (nothing in these can be deleted or overwritten early):
- prefix `db/`: 30 days
- prefix `art/deleted/`: 30 days

**Object lifecycle rules** (delete old copies):
- prefix `db/daily/`: delete after 31 days
- prefix `db/monthly/`: delete after 366 days
- prefix `art/deleted/`: delete after 31 days
- prefix `backups/`: delete after 30 days (old dumps from before this setup)

`art/current/` gets no lock: the nightly sync has to move deleted art out of
it into `art/deleted/`.

## The private key

The backup private key never lives in Railway. It's kept by whoever runs
Panelist (password manager plus an offline copy), and pasted in only for a
restore. Lose every copy and the database backups can't be opened.
