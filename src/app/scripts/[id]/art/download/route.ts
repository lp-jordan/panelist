import { Readable } from "node:stream";
import archiver from "archiver";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getCurrentUser, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Streaming "Download all (current)": one zip of every page's CURRENT version,
// pulled straight from R2 as streams and piped into the archive — memory-safe
// even when the total runs to gigabytes. Node runtime (needs node streams + the
// S3 client).
export const runtime = "nodejs";

function artClient() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.ART_R2_ENDPOINT ?? "",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.ART_R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.ART_R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function extOf(key: string, fallback = "bin") {
  const m = /\.([a-z0-9]+)$/i.exec(key);
  return m ? m[1] : fallback;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const script = await prisma.script.findFirst({
    where: { id, deletedAt: null, ...accessibleScriptWhere(user.id) },
    select: {
      title: true,
      artPages: {
        where: { currentVersionId: { not: null } },
        orderBy: { pageNumber: "asc" },
        select: {
          pageNumber: true,
          currentVersion: { select: { storageKey: true, originalName: true } },
        },
      },
    },
  });
  if (!script) return new Response("Not found", { status: 404 });

  const pages = script.artPages.filter((p) => p.currentVersion);
  if (pages.length === 0) return new Response("No art to download yet", { status: 404 });

  const s3 = artClient();
  const bucket = process.env.ART_R2_BUCKET ?? "";
  const archive = archiver("zip", { zlib: { level: 5 } });

  // Kick off appends. archiver drains as the response is read.
  (async () => {
    try {
      for (const page of pages) {
        const cur = page.currentVersion!;
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: cur.storageKey }));
        const num = String(page.pageNumber).padStart(2, "0");
        const ext = extOf(cur.originalName ?? cur.storageKey);
        archive.append(res.Body as Readable, { name: `p${num}.${ext}` });
      }
      await archive.finalize();
    } catch {
      archive.abort();
    }
  })();

  const safeTitle = (script.title || "issue").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "issue";
  const filename = `${safeTitle}-current.zip`;

  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
