import { getCurrentUser, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { RASTER_TYPES } from "@/lib/image-types";

// Streams a reference image's bytes out of Postgres (AssetData). Scoped to the
// requester: the asset must belong to a reference in a script they can access,
// so image ids can't be enumerated across accounts. Bytes are immutable per
// asset id, so a long private cache is safe.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  // Gate on access before touching the bytes. The asset is reachable if it
  // backs a reference OR an imported PDF page in a script the user can access.
  const [reference, importedPage] = await Promise.all([
    prisma.reference.findFirst({
      where: { assetId: id, script: accessibleScriptWhere(user.id) },
      select: { id: true },
    }),
    prisma.importedPage.findFirst({
      where: { assetId: id, script: accessibleScriptWhere(user.id) },
      select: { id: true },
    }),
  ]);
  if (!reference && !importedPage) {
    return new Response("Not found", { status: 404 });
  }

  const [asset, blob] = await Promise.all([
    prisma.asset.findUnique({ where: { id }, select: { mime: true } }),
    prisma.assetData.findUnique({ where: { assetId: id }, select: { data: true } }),
  ]);

  if (!asset || !blob) {
    return new Response("Not found", { status: 404 });
  }

  const body = new Uint8Array(blob.data);
  // These bytes are served from our own origin, so they must never be treated
  // as a document. Only known raster types go out as themselves; anything else
  // (e.g. an SVG stored before uploads were restricted) is a download. nosniff
  // stops the browser guessing, and the CSP sandboxes the response even if it
  // is opened directly.
  const safe = asset.mime !== null && RASTER_TYPES.has(asset.mime);
  return new Response(body, {
    headers: {
      "Content-Type": safe ? asset.mime! : "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(safe ? {} : { "Content-Disposition": "attachment" }),
    },
  });
}
