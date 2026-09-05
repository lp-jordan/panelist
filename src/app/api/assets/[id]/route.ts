import { getCurrentUser, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

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
  return new Response(body, {
    headers: {
      "Content-Type": asset.mime ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
