// Art preview worker — a persistent Railway service (its own Root Directory).
// Polls Postgres for ArtVersion rows in previewStatus = PENDING, rasterizes a
// web-viewable preview.webp from the PSD/TIFF/PDF original in R2 via ImageMagick
// (+ Ghostscript for PDF), uploads it, and flips the row to READY (or FAILED).
//
// Deliberately self-contained (raw SQL via `pg`, no Prisma), because the Railway
// service builds only this folder — it can't see ../prisma or ../src. Keyed off
// storageKey, so no schema knowledge beyond the ArtVersion columns is needed.
//
// Single concurrency: one render at a time, so peak CPU/RAM is one file's
// footprint. Claims work with FOR UPDATE SKIP LOCKED, so a second replica (if
// ever added) never double-processes a row.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 4000);
const MAX_PX = Number(process.env.PREVIEW_MAX_PX ?? 1600);
const BUCKET = required("ART_R2_BUCKET");

const pool = new pg.Pool({ connectionString: required("DATABASE_URL") });
const s3 = new S3Client({
  region: "auto",
  endpoint: required("ART_R2_ENDPOINT"),
  forcePathStyle: true, // R2 wildcard cert covers one label; path-style avoids TLS failures.
  credentials: {
    accessKeyId: required("ART_R2_ACCESS_KEY_ID"),
    secretAccessKey: required("ART_R2_SECRET_ACCESS_KEY"),
  },
});

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

// preview.webp lives beside the original:
// art/<scriptId>/p<n>/v<v>/original.ext  ->  .../preview.webp
function previewKeyFor(storageKey) {
  return storageKey.replace(/original\.[^/]+$/, "preview.webp");
}

// Claim one PENDING row atomically and mark it PROCESSING.
async function claim() {
  const { rows } = await pool.query(
    `UPDATE "ArtVersion" SET "previewStatus" = 'PROCESSING'
       WHERE id = (
         SELECT id FROM "ArtVersion"
         WHERE "previewStatus" = 'PENDING'
         ORDER BY "createdAt" ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
     RETURNING id, "storageKey", version`,
  );
  return rows[0] ?? null;
}

async function downloadToFile(key, dest) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  await writeFile(dest, Buffer.concat(chunks));
}

// ImageMagick: first page/flattened composite -> downscaled webp. `[0]` picks the
// first PDF page / the merged PSD composite / the first TIFF frame. -flatten
// composites layers onto a white ground. Memory limits keep a huge PSD in check.
function render(input, output) {
  return new Promise((resolve, reject) => {
    const args = [
      "-limit", "memory", "512MiB",
      "-limit", "map", "1GiB",
      `${input}[0]`,
      "-flatten",
      "-resize", `${MAX_PX}x${MAX_PX}>`,
      "-quality", "82",
      output,
    ];
    // Prefer IMv7 `magick`; fall back to `convert` (IMv6).
    const bin = process.env.MAGICK_BIN ?? "magick";
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ImageMagick exit ${code}: ${err.slice(0, 500)}`))));
  });
}

async function processOne(row) {
  const dir = await mkdtemp(join(tmpdir(), "artprev-"));
  const inPath = join(dir, "in");
  const outPath = join(dir, "preview.webp");
  try {
    await downloadToFile(row.storageKey, inPath);
    await render(inPath, outPath);
    const webp = await readFile(outPath);
    const key = previewKeyFor(row.storageKey);
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: webp, ContentType: "image/webp" }));
    await pool.query(`UPDATE "ArtVersion" SET "previewStatus" = 'READY', "previewKey" = $1 WHERE id = $2`, [key, row.id]);
    log(`READY  v${row.version} ${row.id} (${(webp.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    await pool.query(`UPDATE "ArtVersion" SET "previewStatus" = 'FAILED' WHERE id = $1`, [row.id]);
    log(`FAILED v${row.version} ${row.id}: ${e.message}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  log("art-preview-worker up; polling every", POLL_MS, "ms");
  // Recover rows wedged in PROCESSING from a previous crash/restart.
  await pool.query(`UPDATE "ArtVersion" SET "previewStatus" = 'PENDING' WHERE "previewStatus" = 'PROCESSING'`);

  for (;;) {
    let row = null;
    try {
      row = await claim();
    } catch (e) {
      log("claim error:", e.message);
      await sleep(POLL_MS);
      continue;
    }
    if (!row) {
      await sleep(POLL_MS);
      continue;
    }
    await processOne(row);
    // Loop straight on to drain a batch without waiting.
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
