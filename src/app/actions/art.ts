"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertScriptAccess, assertScriptOwner, getScriptRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  originalKey,
  presignUpload,
  presignDownload,
  deleteObjects,
} from "@/lib/art-storage";

// V2 Phase E — art pipeline server actions. Files stream straight to R2 via a
// presigned PUT (bypassing our server); we only record the version row. Art
// pages are keyed by (scriptId, pageNumber), never Page.id (see the
// "art-pipeline-anchoring" memory).

const MAX_BYTES = 250 * 1024 * 1024; // 250 MB — layered PSD ceiling.

// Browsers can render these directly, so the original doubles as its own web
// preview. PSD/TIFF have no preview yet (thumbnailing is a later slice) — the
// UI shows a placeholder tile for them.
const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function extFromName(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1] : "bin";
}

/**
 * Step 1 of an upload: reserve the next version number for a page, mint a
 * short-lived PUT URL, and return the object key the client should confirm.
 * Creates the ArtPage row on first upload. Any user with script access may
 * upload (collaborators included).
 */
export async function createArtUploadUrl(input: {
  scriptId: string;
  pageNumber: number;
  fileName: string;
  contentType: string;
  bytes: number;
}) {
  const user = await getCurrentUser();
  const { scriptId, pageNumber, fileName, contentType, bytes } = input;
  if (!scriptId || !Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("bad request");
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) throw new Error("file too large");
  await assertScriptAccess(scriptId, user.id);

  const artPage = await prisma.artPage.upsert({
    where: { scriptId_pageNumber: { scriptId, pageNumber } },
    create: { scriptId, pageNumber },
    update: {},
    select: { id: true },
  });

  const last = await prisma.artVersion.findFirst({
    where: { artPageId: artPage.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const ext = extFromName(fileName);
  const key = originalKey(scriptId, pageNumber, version, ext);

  const uploadUrl = await presignUpload(key, contentType || "application/octet-stream");
  return { artPageId: artPage.id, version, key, uploadUrl };
}

/**
 * Step 2: the browser has PUT the bytes to R2 at `key`. Record the version and
 * make it current. Re-checks that the version slot is still free (a rare race
 * with a concurrent upload) via the (artPageId, version) unique constraint.
 */
export async function finalizeArtVersion(input: {
  scriptId: string;
  artPageId: string;
  version: number;
  key: string;
  fileName: string;
  contentType: string;
  bytes: number;
}) {
  const user = await getCurrentUser();
  const { scriptId, artPageId, version, key, fileName, contentType, bytes } = input;
  await assertScriptAccess(scriptId, user.id);

  const artPage = await prisma.artPage.findFirst({
    where: { id: artPageId, scriptId },
    select: { id: true },
  });
  if (!artPage) throw new Error("not found");

  const created = await prisma.artVersion.create({
    data: {
      artPageId,
      version,
      storageKey: key,
      previewKey: PREVIEWABLE.has(contentType) ? key : null,
      bytes,
      mime: contentType || null,
      originalName: fileName || null,
      uploadedBy: user.id,
    },
    select: { id: true },
  });

  await prisma.artPage.update({
    where: { id: artPageId },
    data: { currentVersionId: created.id },
  });

  revalidatePath(`/scripts/${scriptId}/art`);
  return { versionId: created.id };
}

/** Roll the "current" pointer back to an earlier version ("Make current"). */
export async function setCurrentArtVersion(input: { scriptId: string; versionId: string }) {
  const user = await getCurrentUser();
  const { scriptId, versionId } = input;
  await assertScriptAccess(scriptId, user.id);

  const version = await prisma.artVersion.findFirst({
    where: { id: versionId, artPage: { scriptId } },
    select: { artPageId: true },
  });
  if (!version) throw new Error("not found");

  await prisma.artPage.update({
    where: { id: version.artPageId },
    data: { currentVersionId: versionId },
  });
  revalidatePath(`/scripts/${scriptId}/art`);
}

/**
 * Hard-delete a NON-current version: remove the row and its R2 objects. Owner
 * only. Records an Event so the deletion survives even though the file doesn't.
 */
export async function deleteArtVersion(input: { scriptId: string; versionId: string }) {
  const user = await getCurrentUser();
  const { scriptId, versionId } = input;
  await assertScriptOwner(scriptId, user.id);

  const version = await prisma.artVersion.findFirst({
    where: { id: versionId, artPage: { scriptId } },
    select: {
      id: true,
      version: true,
      storageKey: true,
      previewKey: true,
      artPage: { select: { id: true, pageNumber: true, currentVersionId: true } },
    },
  });
  if (!version) throw new Error("not found");
  if (version.artPage.currentVersionId === versionId) {
    throw new Error("cannot delete the current version");
  }

  // Delete the DB row first; only touch R2 once that's committed.
  await prisma.$transaction([
    prisma.artVersion.delete({ where: { id: versionId } }),
    prisma.event.create({
      data: {
        type: "art.version.deleted",
        subjectId: version.artPage.id,
        actorId: user.id,
        meta: JSON.stringify({ scriptId, pageNumber: version.artPage.pageNumber, version: version.version }),
      },
    }),
  ]);

  // previewKey may equal storageKey (image originals) — dedupe so we don't
  // issue a redundant delete.
  await deleteObjects([...new Set([version.storageKey, version.previewKey ?? ""])]);
  revalidatePath(`/scripts/${scriptId}/art`);
}

/** A presigned download URL for one version, for the download buttons. */
export async function getArtDownloadUrl(input: { scriptId: string; versionId: string }) {
  const user = await getCurrentUser();
  const { scriptId, versionId } = input;
  await assertScriptAccess(scriptId, user.id);

  const version = await prisma.artVersion.findFirst({
    where: { id: versionId, artPage: { scriptId } },
    select: { storageKey: true, originalName: true, artPage: { select: { pageNumber: true } } },
  });
  if (!version) throw new Error("not found");

  const name = version.originalName || `page-${version.artPage.pageNumber}.bin`;
  return presignDownload(version.storageKey, name);
}

// --- comments (pins on the art) --------------------------------------------

export async function createArtComment(input: {
  scriptId: string;
  pageNumber: number;
  body: string;
  xPct: number;
  yPct: number;
}) {
  const user = await getCurrentUser();
  const { scriptId, pageNumber, body, xPct, yPct } = input;
  const text = body.trim();
  if (!text) throw new Error("empty note");
  await assertScriptAccess(scriptId, user.id);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const artPage = await prisma.artPage.upsert({
    where: { scriptId_pageNumber: { scriptId, pageNumber } },
    create: { scriptId, pageNumber },
    update: {},
    select: { id: true },
  });

  await prisma.artComment.create({
    data: { artPageId: artPage.id, authorId: user.id, body: text, xPct: clamp(xPct), yPct: clamp(yPct) },
  });
  revalidatePath(`/scripts/${scriptId}/art`);
}

export async function toggleArtCommentResolved(input: { scriptId: string; commentId: string }) {
  const user = await getCurrentUser();
  const { scriptId, commentId } = input;
  await assertScriptAccess(scriptId, user.id);

  const comment = await prisma.artComment.findFirst({
    where: { id: commentId, artPage: { scriptId } },
    select: { resolved: true },
  });
  if (!comment) throw new Error("not found");

  await prisma.artComment.update({
    where: { id: commentId },
    data: { resolved: !comment.resolved, resolvedAt: comment.resolved ? null : new Date() },
  });
  revalidatePath(`/scripts/${scriptId}/art`);
}

/** Delete a note. Author, or the script owner, may remove it. */
export async function deleteArtComment(input: { scriptId: string; commentId: string }) {
  const user = await getCurrentUser();
  const { scriptId, commentId } = input;
  await assertScriptAccess(scriptId, user.id);

  const comment = await prisma.artComment.findFirst({
    where: { id: commentId, artPage: { scriptId } },
    select: { authorId: true },
  });
  if (!comment) throw new Error("not found");

  if (comment.authorId !== user.id) {
    // Not the author — allow only if the caller is owner-level on the script.
    const role = await getScriptRole(scriptId, user.id);
    if (role !== "OWNER") throw new Error("forbidden");
  }

  await prisma.artComment.delete({ where: { id: commentId } });
  revalidatePath(`/scripts/${scriptId}/art`);
}
