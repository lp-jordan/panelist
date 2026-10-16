# Restoring Panelist

Every restore runs inside the `panelist-backup` Railway service, because it's
the only place that can reach both the private database and the backup bucket.
You switch what it does with variables, run it once, then switch it back.

**You'll need:** the backup private key (`private-key-one-line.txt` from your
password manager). It only ever goes into Railway for the length of a restore.

## How to run a mode (used by every section below)

1. Railway → **panelist-backup** → **Variables**. Add the variables the section
   lists.
2. **Deployments** → on the latest deployment, **⋮ → Redeploy**. That runs the
   job once with the new variables.
3. Open that deployment's **logs** and read the result.
4. **Delete every variable you added**, especially `BACKUP_AGE_IDENTITY`, and
   redeploy once more so the next scheduled run is a normal backup.

## Practice restore (once a month)

Proves last night's backup can actually be opened and loaded. It loads into a
scratch database on the same server, compares row counts with live, and drops
the scratch database. Live data isn't touched.

| Variable | Value |
|---|---|
| `BACKUP_MODE` | `verify` |
| `BACKUP_AGE_IDENTITY` | contents of `private-key-one-line.txt` |

Good result: the "live" and "restored" counts match, or live is a little ahead
(work done since last night). Art "live" and "backup" totals should match.

## Everything was wiped

Data lost: anything since the last nightly backup (up to a day).

1. **Database.** In Railway, add a new **Postgres** service (or use the wiped
   one). Copy its `DATABASE_URL`. Then run:

   | Variable | Value |
   |---|---|
   | `BACKUP_MODE` | `restore-db` |
   | `RESTORE_DATABASE_URL` | the new database's `DATABASE_URL` |
   | `RESTORE_CONFIRM` | `yes` |
   | `BACKUP_AGE_IDENTITY` | contents of `private-key-one-line.txt` |

   To use an older backup than last night's, also set `RESTORE_FILE` to its
   name, e.g. `db/daily/panelist-20261020T060001Z.sql.gz.age` (Cloudflare →
   R2 → backup bucket → `db/daily/` lists them).

2. **Point the app at it.** If you made a new Postgres service, set the
   `panelist` service's `DATABASE_URL` (and `panelist-backup`'s and
   `art-preview-worker`'s) to reference it. Redeploy `panelist`.

3. **Art.** If art files are gone too, run:

   | Variable | Value |
   |---|---|
   | `BACKUP_MODE` | `restore-art` |
   | `RESTORE_CONFIRM` | `yes` |

   It copies back every original missing from the art bucket and never
   deletes anything.

4. **Previews.** Art previews aren't backed up (they're rebuilt). Ask for them
   to be regenerated: every art version with a missing preview gets
   `previewStatus = 'PENDING'` and the worker remakes it.

5. **Check.** Sign in, open a few projects, scripts and art pages.

## One project was damaged or deleted

Data lost: that project's changes since the last nightly backup.

This is a careful, mostly manual job: load the backup into a scratch database
and copy only that project's rows back into live. There's no one-click script
for it yet.

1. Run the practice restore with one more variable,
   `KEEP_RESTORE_CHECK` = `yes`, so the scratch copy `panelist_restore_check`
   stays.
2. Copy that project's rows from `panelist_restore_check` into live, parents
   first: `Project`, `ProjectMember`, `Script`, `Page` and its panels and text,
   `Snapshot`, `ImportedPage`, `ReferenceFolder`, `Reference`,
   `ReferencePlacement`, `Asset` and `AssetData` for its images, `ArtPage`,
   `ArtVersion`, `ArtComment`.
3. Put its art back: `restore-art` with `RESTORE_ART_FROM` set to
   `art/current/art/<scriptId>` for each of its scripts (copies only missing
   files).
4. Drop `panelist_restore_check`.

## One art version was deleted by mistake

Within 30 days of the deletion, its original is in the backup bucket under
`art/deleted/<date it was deleted>/art/<scriptId>/p<page>/v<version>/`.

1. Run `restore-art` with `RESTORE_ART_FROM` =
   `art/deleted/<date>/art/<scriptId>/p<page>/v<version>` and
   `RESTORE_CONFIRM` = `yes`.
2. Its database row (version number, uploader, notes) is in the night-before
   database backup. Restore that row the same way as the project case, or
   re-upload the file as a new version if the history doesn't matter.

## What's in the backup bucket

| Path | What | Kept |
|---|---|---|
| `db/daily/` | encrypted database dump, every night | 30 days |
| `db/monthly/` | the 1st-of-month dump | 12 months |
| `art/current/` | every art original Panelist has now | while it exists |
| `art/deleted/<date>/` | art removed from Panelist that day | 30 days |
| `backups/` | old unencrypted dumps from before this setup | delete after 30 days |
