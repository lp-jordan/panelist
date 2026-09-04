import "server-only";
import {
  S3Client,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Phase E art storage. Layered PSDs (20–250 MB) live in a DEDICATED R2 bucket
// (ART_R2_*), never in Postgres — unlike reference images. The DB row is the
// source of truth for which version is current; R2 just holds bytes at a key we
// can always rederive from (scriptId, pageNumber, version). See the memory
// notes "art-r2-bucket" and "art-pipeline-anchoring".

const BUCKET = process.env.ART_R2_BUCKET ?? "";
const ENDPOINT = process.env.ART_R2_ENDPOINT ?? "";

function client() {
  if (!BUCKET || !ENDPOINT) {
    throw new Error("Art storage is not configured (ART_R2_* env vars missing).");
  }
  return new S3Client({
    region: "auto", // R2 ignores region, but the S3 client requires one.
    endpoint: ENDPOINT,
    // R2's wildcard cert only covers one label, so virtual-hosted-style
    // addressing (bucket.<account>.r2...) fails the TLS handshake. Force
    // path-style (<account>.r2.../bucket) — same fix as backup/backup.sh.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.ART_R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.ART_R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

/** Object key for a version's original upload. Keyed by page NUMBER, not Page.id. */
export function originalKey(scriptId: string, pageNumber: number, version: number, ext: string) {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `art/${scriptId}/p${pageNumber}/v${version}/original.${safeExt}`;
}

/** Object key for a version's generated web preview (filled in later; see below). */
export function previewKeyFor(scriptId: string, pageNumber: number, version: number) {
  return `art/${scriptId}/p${pageNumber}/v${version}/preview.webp`;
}

const UPLOAD_TTL = 600; // 10 min — enough for a slow phone push of a big PSD.
const DOWNLOAD_TTL = 300;

/** Short-lived PUT URL so the browser uploads straight to R2, bypassing our server. */
export async function presignUpload(key: string, contentType: string) {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_TTL },
  );
}

/** Short-lived GET URL. `downloadName` sets the saved filename via Content-Disposition. */
export async function presignDownload(key: string, downloadName?: string) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: downloadName
        ? `attachment; filename="${downloadName.replace(/"/g, "")}"`
        : undefined,
    }),
    { expiresIn: DOWNLOAD_TTL },
  );
}

/** Deletes a version's objects (original + preview) when a version is hard-deleted. */
export async function deleteObjects(keys: string[]) {
  const real = keys.filter(Boolean);
  if (real.length === 0) return;
  await client().send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: real.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}

export function artStorageConfigured() {
  return Boolean(BUCKET && ENDPOINT);
}
