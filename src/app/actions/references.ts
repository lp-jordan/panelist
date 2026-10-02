"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertScriptAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Reference images are small screen/photo grabs, not the layered art the future
// R2 pipeline handles. Cap generously so an unoptimised phone photo still fits,
// but stop a stray multi-hundred-MB file from landing in a Postgres BYTEA column.
const MAX_BYTES = 20 * 1024 * 1024;

const MAX_URL_LENGTH = 2048;

/** An http(s) URL, normalised, or null. Bare "pinterest.com/x" gets https://. */
function parseLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  if (!text || text.length > MAX_URL_LENGTH || /\s/.test(text)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type AddReferenceResult = { error?: string } | undefined;

/**
 * Adds a reference from whatever was given: an image file, or a link. The
 * add sheet, paste and drag-and-drop all land here; there is no mode switch.
 */
export async function addReference(formData: FormData): Promise<AddReferenceResult> {
  const user = await getCurrentUser();

  const scriptId = formData.get("scriptId");
  const file = formData.get("file");
  const captionRaw = formData.get("caption");

  if (typeof scriptId !== "string" || scriptId.length === 0) return { error: "Missing script." };
  await assertScriptAccess(scriptId, user.id);
  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : null;

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
    if (file.size > MAX_BYTES) return { error: "That image is too large (20 MB max)." };
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
  } else {
    const url = parseLink(formData.get("url"));
    if (!url) return { error: "Add an image or paste a link." };
    // Only the URL is stored; the server never fetches it.
    await prisma.reference.create({ data: { scriptId, url, caption } });
  }

  revalidatePath(`/scripts/${scriptId}/reference`);
  return undefined;
}

/** Form-action wrapper for the add sheet (FormSheet wants a void action). */
export async function addReferenceFromForm(formData: FormData): Promise<void> {
  await addReference(formData);
}

export async function updateReferenceCaption(formData: FormData) {
  const user = await getCurrentUser();

  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  const captionRaw = formData.get("caption");
  if (typeof id !== "string" || typeof scriptId !== "string") return;
  await assertScriptAccess(scriptId, user.id);

  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : null;
  // Scoped to the script just checked, so a reference id from another script
  // can't be edited through it.
  await prisma.reference.updateMany({ where: { id, scriptId }, data: { caption } });
  revalidatePath(`/scripts/${scriptId}/reference`);
}

// --- collections / tags -----------------------------------------------------

// Sets a reference's collections (free-form tags, §5) in one go, optionally
// creating a new collection from the sheet's text field. Read "collection" as
// "tag": many-to-many, per issue, created as you go.
export async function updateReferenceTags(formData: FormData) {
  const user = await getCurrentUser();
  const referenceId = formData.get("referenceId");
  const scriptId = formData.get("scriptId");
  if (typeof referenceId !== "string" || typeof scriptId !== "string") return;
  await assertScriptAccess(scriptId, user.id);

  if (!(await prisma.reference.findFirst({ where: { id: referenceId, scriptId }, select: { id: true } }))) return;

  // Only this script's collections can be attached.
  const requested = formData.getAll("collectionIds").filter((v): v is string => typeof v === "string");
  const ids = (
    await prisma.collection.findMany({ where: { scriptId, id: { in: requested } }, select: { id: true } })
  ).map((c) => c.id);
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
  const user = await getCurrentUser();
  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  if (typeof id !== "string" || typeof scriptId !== "string") return;
  await assertScriptAccess(scriptId, user.id);
  // Cascades the ReferenceInCollection rows; the references themselves stay.
  await prisma.collection.deleteMany({ where: { id, scriptId } });
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
  const user = await getCurrentUser();
  const { referenceId, scriptId, pageNumber, xPct, yPct } = input;
  if (!referenceId || !scriptId || !Number.isFinite(pageNumber)) return;
  await assertScriptAccess(scriptId, user.id);

  // Clamp to the page so a stray click near the edge can't store an off-sheet
  // position. x/y are 0–1 fractions of the page box.
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  if (!(await prisma.reference.findFirst({ where: { id: referenceId, scriptId }, select: { id: true } }))) return;

  await prisma.referencePlacement.create({
    data: { referenceId, pageNumber, xPct: clamp(xPct), yPct: clamp(yPct) },
  });
  revalidatePath(`/scripts/${scriptId}`);
}

export async function deletePlacement(input: { id: string; scriptId: string }) {
  const user = await getCurrentUser();
  if (!input.id) return;
  await assertScriptAccess(input.scriptId, user.id);
  await prisma.referencePlacement.deleteMany({ where: { id: input.id, reference: { scriptId: input.scriptId } } });
  revalidatePath(`/scripts/${input.scriptId}`);
}

export async function deleteReference(formData: FormData) {
  const user = await getCurrentUser();

  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  if (typeof id !== "string" || typeof scriptId !== "string") return;
  await assertScriptAccess(scriptId, user.id);

  const reference = await prisma.reference.findFirst({ where: { id, scriptId }, select: { assetId: true } });
  if (!reference) return;

  // An image: deleting the Asset cascades to AssetData and, via
  // Reference.assetId's onDelete: Cascade, to the Reference and its
  // placements. A link has no asset, so delete the Reference directly.
  if (reference.assetId) await prisma.asset.delete({ where: { id: reference.assetId } });
  else await prisma.reference.delete({ where: { id } });
  revalidatePath(`/scripts/${scriptId}/reference`);
}
