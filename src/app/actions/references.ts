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

  const scriptId = formData.get("scriptId");
  const file = formData.get("file");
  const captionRaw = formData.get("caption");

  if (typeof scriptId !== "string" || scriptId.length === 0) return;
  if (!(file instanceof File) || file.size === 0) return;
  if (!file.type.startsWith("image/")) return;
  if (file.size > MAX_BYTES) return;

  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : null;
  const bytes = Buffer.from(await file.arrayBuffer());

  // One transaction: the Asset (metadata), its bytes, and the Reference that
  // ties the image to the issue. storageKey stays non-null for the art
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
    await tx.reference.create({ data: { scriptId, assetId: asset.id, caption } });
  });

  revalidatePath(`/scripts/${scriptId}/reference`);
}

export async function updateReferenceCaption(formData: FormData) {
  await verifySession();

  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  const captionRaw = formData.get("caption");
  if (typeof id !== "string" || typeof scriptId !== "string") return;

  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : null;
  await prisma.reference.update({ where: { id }, data: { caption } });
  revalidatePath(`/scripts/${scriptId}/reference`);
}

// --- collections / tags -----------------------------------------------------

// Sets a reference's collections (free-form tags, §5) in one go, optionally
// creating a new collection from the sheet's text field. Read "collection" as
// "tag": many-to-many, per issue, created as you go.
export async function updateReferenceTags(formData: FormData) {
  await verifySession();
  const referenceId = formData.get("referenceId");
  const scriptId = formData.get("scriptId");
  if (typeof referenceId !== "string" || typeof scriptId !== "string") return;

  const ids = formData.getAll("collectionIds").filter((v): v is string => typeof v === "string");
  const newName = typeof formData.get("newCollection") === "string" ? (formData.get("newCollection") as string).trim() : "";

  if (newName) {
    const created = await prisma.collection.upsert({
      where: { scriptId_name: { scriptId, name: newName } },
      create: { scriptId, name: newName },
      update: {},
    });
    if (!ids.includes(created.id)) ids.push(created.id);
  }

  await prisma.$transaction([
    prisma.referenceInCollection.deleteMany({ where: { referenceId } }),
    ...(ids.length > 0
      ? [prisma.referenceInCollection.createMany({ data: ids.map((collectionId) => ({ referenceId, collectionId })) })]
      : []),
  ]);
  revalidatePath(`/scripts/${scriptId}/reference`);
}

export async function deleteCollection(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  if (typeof id !== "string" || typeof scriptId !== "string") return;
  // Cascades the ReferenceInCollection rows; the references themselves stay.
  await prisma.collection.delete({ where: { id } });
  revalidatePath(`/scripts/${scriptId}/reference`);
}

// --- placements (pins on the locked read view) -----------------------------

export async function createPlacement(input: {
  referenceId: string;
  scriptId: string;
  pageNumber: number;
  xPct: number;
  yPct: number;
}) {
  await verifySession();
  const { referenceId, scriptId, pageNumber, xPct, yPct } = input;
  if (!referenceId || !scriptId || !Number.isFinite(pageNumber)) return;

  // Clamp to the page so a stray click near the edge can't store an off-sheet
  // position. x/y are 0–1 fractions of the page box.
  const clamp = (n: number) => Math.min(1, Math.max(0, n));

  await prisma.referencePlacement.create({
    data: { referenceId, pageNumber, xPct: clamp(xPct), yPct: clamp(yPct) },
  });
  revalidatePath(`/scripts/${scriptId}`);
}

export async function deletePlacement(input: { id: string; scriptId: string }) {
  await verifySession();
  if (!input.id) return;
  await prisma.referencePlacement.delete({ where: { id: input.id } });
  revalidatePath(`/scripts/${input.scriptId}`);
}

export async function deleteReference(formData: FormData) {
  await verifySession();

  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  if (typeof id !== "string" || typeof scriptId !== "string") return;

  const reference = await prisma.reference.findUnique({ where: { id }, select: { assetId: true } });
  if (!reference) return;

  // Deleting the Asset cascades to AssetData and, via Reference.assetId's
  // onDelete: Cascade, to the Reference (and its placements) in one shot.
  await prisma.asset.delete({ where: { id: reference.assetId } });
  revalidatePath(`/scripts/${scriptId}/reference`);
}
