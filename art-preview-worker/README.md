# Art preview worker → Cloudflare R2

Renders web-viewable `preview.webp` thumbnails for the art the team actually
uploads — **PSD, TIFF, PDF** — which browsers can't display directly. Runs as its
own **persistent Railway service** (not cron): it polls Postgres for `ArtVersion`
rows in `previewStatus = PENDING`, pulls the original from the `panelist-art` R2
bucket, rasterizes the first page / flattened composite with ImageMagick
(+ Ghostscript for PDF), uploads `preview.webp` beside the original, and flips the
row to `READY` (or `FAILED`).

PNG/JPG/WEBP uploads never reach this worker — the app marks them `READY`
immediately (they are their own preview).

## Cost
Single-concurrency (one render at a time), so peak CPU/RAM is one file's
footprint. At rest it sips ~100 MB RAM and ~0 CPU; Railway bills measured usage,
so the idle service is ~$1–2/mo and each render is a fraction of a cent.

## One-time Railway setup
Create a **new service in the same project** (shares the private network with
Postgres), deployed from this same GitHub repo:

1. New service → **Deploy from the same GitHub repo**.
2. Service **Settings → Source → Root Directory** = `art-preview-worker` (so it
   builds this Dockerfile, not the app or the backup service).
3. Leave it as a normal (always-on) service — **no cron schedule, no exposed
   port**. It's a background worker.
4. **Variables** — set:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (internal URL)
   - `ART_R2_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `ART_R2_BUCKET` = `panelist-art`
   - `ART_R2_ACCESS_KEY_ID` = the art bucket token access key
   - `ART_R2_SECRET_ACCESS_KEY` = the art bucket token secret
   - (optional) `POLL_INTERVAL_MS` (default 4000), `PREVIEW_MAX_PX` (default 1600)
5. Deploy. Upload a PSD/TIFF/PDF in the app; within a few seconds the tile should
   flip from "Processing…" to a real thumbnail. Check the service logs for
   `READY` / `FAILED` lines.

## How it recovers
On start it resets any rows stuck in `PROCESSING` (from a crash/restart) back to
`PENDING`, and claims work with `FOR UPDATE SKIP LOCKED`, so it's safe to restart
and safe if you ever run more than one replica.
