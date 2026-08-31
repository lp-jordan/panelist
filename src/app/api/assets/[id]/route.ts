import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Streams a reference image's bytes out of Postgres (AssetData). Kept behind
// the session gate like the rest of the app — this is a single-user tool, so
// there's no public image surface. The bytes are immutable per asset id, so a
// long immutable cache is safe once past auth.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const [asset, blob] = await Promise.all([
    prisma.asset.findUnique({ where: { id }, select: { mime: true } }),
    prisma.assetData.findUnique({ where: { assetId: id }, select: { data: true } }),
  ]);

  if (!asset || !blob) {
    return new Response("Not found", { status: 404 });
  }

  const body = new Uint8Array(blob.data);
  return new Response(body, {
    headers: {
      "Content-Type": asset.mime ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
