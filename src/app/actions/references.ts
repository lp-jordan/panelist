"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Reference images are small screen/photo grabs, not the layered art the future
// R2 pipeline handles. Cap generously so an unoptimised phone photo still fits,
// but stop a stray multi-hundred-MB file from landing in a Postgres BYTEA column.
const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadReference(formData: FormData) {
  await verifySession();

  const projectId = formData.get("projectId");
  const file = formData.get("file");
  const captionRaw = formData.get("caption");

  if (typeof projectId !== "string" || projectId.length === 0) return;
  if (!(file instanceof File) || file.size === 0) return;
  if (!file.type.startsWith("image/")) return;
  if (file.size > MAX_BYTES) return;

  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : null;
  const bytes = Buffer.from(await file.arrayBuffer());

  // One transaction: the Asset (metadata), its bytes, and the Reference that
  // ties the image to the project. storageKey stays non-null for the art
  // pipeline's sake; a DB-backed reference just points it at its own id.
  await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: {
        kind: "REFERENCE",
        storageKey: "", // set below, once we know the id
        mime: file.type,
        bytes: file.size,
        originalName: file.name || null,
      },
    });
    await tx.asset.update({ where: { id: asset.id }, data: { storageKey: `db:${asset.id}` } });
    await tx.assetData.create({ data: { assetId: asset.id, data: bytes } });
    await tx.reference.create({ data: { projectId, assetId: asset.id, caption } });
  });

  revalidatePath(`/projects/${projectId}/reference`);
}

export async function updateReferenceCaption(formData: FormData) {
  await verifySession();

  const id = formData.get("id");
  const projectId = formData.get("projectId");
  const captionRaw = formData.get("caption");
  if (typeof id !== "string" || typeof projectId !== "string") return;

  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : null;
  await prisma.reference.update({ where: { id }, data: { caption } });
  revalidatePath(`/projects/${projectId}/reference`);
}

export async function deleteReference(formData: FormData) {
  await verifySession();

  const id = formData.get("id");
  const projectId = formData.get("projectId");
  if (typeof id !== "string" || typeof projectId !== "string") return;

  const reference = await prisma.reference.findUnique({ where: { id }, select: { assetId: true } });
  if (!reference) return;

  // Deleting the Asset cascades to AssetData and, via Reference.assetId's
  // onDelete: Cascade, to the Reference (and its placements) in one shot.
  await prisma.asset.delete({ where: { id: reference.assetId } });
  revalidatePath(`/projects/${projectId}/reference`);
}
