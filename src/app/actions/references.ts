"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertScriptAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { RASTER_TYPES } from "@/lib/image-types";

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
  // Added into whichever folder is open (or the root).
  const folderId = await folderInScript(scriptId, formData.get("folderId"));

  if (file instanceof File && file.size > 0) {
    if (!RASTER_TYPES.has(file.type)) return { error: "Use a PNG, JPEG, WebP, GIF or AVIF image." };
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
      await tx.reference.create({ data: { scriptId, assetId: asset.id, caption, folderId } });
    });
  } else {
    const url = parseLink(formData.get("url"));
    if (!url) return { error: "Add an image or paste a link." };
    // Only the URL is stored; the server never fetches it.
    await prisma.reference.create({ data: { scriptId, url, caption, folderId } });
  }

  revalidatePath(`/scripts/${scriptId}/reference`);
  return undefined;
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

// --- folders ----------------------------------------------------------------

const MAX_FOLDER_NAME = 60;

function folderName(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ").slice(0, MAX_FOLDER_NAME) : "";
}

/** The folder id if it belongs to this script, else null (the root). */
async function folderInScript(scriptId: string, raw: FormDataEntryValue | null): Promise<string | null> {
  if (typeof raw !== "string" || !raw) return null;
  const folder = await prisma.referenceFolder.findFirst({ where: { id: raw, scriptId }, select: { id: true } });
  return folder?.id ?? null;
}

export type FolderResult = { error?: string } | undefined;

export async function createFolder(formData: FormData): Promise<FolderResult> {
  const user = await getCurrentUser();
  const scriptId = formData.get("scriptId");
  if (typeof scriptId !== "string") return { error: "Missing script." };
  await assertScriptAccess(scriptId, user.id);
  const name = folderName(formData.get("name"));
  if (!name) return { error: "Name the folder." };
  if (await prisma.referenceFolder.findFirst({ where: { scriptId, name }, select: { id: true } })) {
    return { error: "A folder with that name already exists." };
  }
  await prisma.referenceFolder.create({ data: { scriptId, name } });
  revalidatePath(`/scripts/${scriptId}/reference`);
  return undefined;
}

export async function renameFolder(formData: FormData): Promise<FolderResult> {
  const user = await getCurrentUser();
  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  if (typeof id !== "string" || typeof scriptId !== "string") return { error: "Missing folder." };
  await assertScriptAccess(scriptId, user.id);
  const name = folderName(formData.get("name"));
  if (!name) return { error: "Name the folder." };
  const clash = await prisma.referenceFolder.findFirst({ where: { scriptId, name, NOT: { id } }, select: { id: true } });
  if (clash) return { error: "A folder with that name already exists." };
  await prisma.referenceFolder.updateMany({ where: { id, scriptId }, data: { name } });
  revalidatePath(`/scripts/${scriptId}/reference`);
  return undefined;
}

/**
 * Deletes a folder. `contents` = "move" sends its references to the root (the
 * FK's SetNull does it); "delete" removes them too, images and pins included.
 */
export async function deleteFolder(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  const scriptId = formData.get("scriptId");
  if (typeof id !== "string" || typeof scriptId !== "string") return;
  await assertScriptAccess(scriptId, user.id);
  const folder = await prisma.referenceFolder.findFirst({ where: { id, scriptId }, select: { id: true } });
  if (!folder) return;

  if (formData.get("contents") === "delete") {
    const refs = await prisma.reference.findMany({ where: { folderId: id, scriptId }, select: { id: true, assetId: true } });
    const assetIds = refs.map((r) => r.assetId).filter((a): a is string => a !== null);
    await prisma.$transaction([
      // Image references go with their Asset (cascade); links are deleted directly.
      prisma.asset.deleteMany({ where: { id: { in: assetIds } } }),
      prisma.reference.deleteMany({ where: { folderId: id, scriptId } }),
      prisma.referenceFolder.delete({ where: { id } }),
    ]);
  } else {
    await prisma.referenceFolder.delete({ where: { id } });
  }
  revalidatePath(`/scripts/${scriptId}/reference`);
  revalidatePath(`/scripts/${scriptId}`);
}

/** Every "id" in the form: one reference, or a multi-selection. */
function idsFrom(formData: FormData): string[] {
  return formData.getAll("id").filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** Files references in a folder, or back at the root (empty folderId). */
export async function moveReference(formData: FormData) {
  const user = await getCurrentUser();
  const ids = idsFrom(formData);
  const scriptId = formData.get("scriptId");
  if (ids.length === 0 || typeof scriptId !== "string") return;
  await assertScriptAccess(scriptId, user.id);
  const folderId = await folderInScript(scriptId, formData.get("folderId"));
  await prisma.reference.updateMany({ where: { id: { in: ids }, scriptId }, data: { folderId } });
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

/** Moves a pin to a new spot on the same page (x/y are 0–1 page fractions). */
export async function movePlacement(input: { id: string; scriptId: string; xPct: number; yPct: number }) {
  const user = await getCurrentUser();
  const { id, scriptId, xPct, yPct } = input;
  if (!id || !Number.isFinite(xPct) || !Number.isFinite(yPct)) return;
  await assertScriptAccess(scriptId, user.id);
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  await prisma.referencePlacement.updateMany({
    where: { id, reference: { scriptId } },
    data: { xPct: clamp(xPct), yPct: clamp(yPct) },
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
  const ids = idsFrom(formData);
  const scriptId = formData.get("scriptId");
  if (ids.length === 0 || typeof scriptId !== "string") return;
  await assertScriptAccess(scriptId, user.id);

  const refs = await prisma.reference.findMany({ where: { id: { in: ids }, scriptId }, select: { assetId: true } });
  const assetIds = refs.map((r) => r.assetId).filter((a): a is string => a !== null);

  // Images go with their Asset (cascading to AssetData, the Reference and its
  // placements); links have no asset, so delete those References directly.
  await prisma.$transaction([
    prisma.asset.deleteMany({ where: { id: { in: assetIds } } }),
    prisma.reference.deleteMany({ where: { id: { in: ids }, scriptId } }),
  ]);
  revalidatePath(`/scripts/${scriptId}/reference`);
  revalidatePath(`/scripts/${scriptId}`);
}
