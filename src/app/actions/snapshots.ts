"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertScriptAccess, assertScriptOwner } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { docJSONToScriptPagesInput, scriptToDocJSON, type JSONNode } from "@/lib/editor/serialize";
import { serializeSnapshot as serialize, parseSnapshotContent, type SnapshotMeta } from "@/lib/snapshot";

// Version history. A Snapshot stores the full serialized script state as JSON in
// its `content` column — an envelope of the Tiptap doc plus the title-page meta,
// so restoring brings back both the pages and the cover exactly as they were.
// Content is never mutated in place; a restore writes a *new* current state and
// first snapshots whatever it's about to overwrite, so nothing is ever lost.
// The envelope helpers live in @/lib/snapshot (a "use server" module may only
// export async actions).

export type { SnapshotMeta } from "@/lib/snapshot";

export type SnapshotListItem = {
  id: string;
  label: string | null;
  isManual: boolean;
  createdAt: string;
};

// Read the version list for the history panel, newest first.
export async function listSnapshots(scriptId: string): Promise<SnapshotListItem[]> {
  const user = await getCurrentUser();
  await assertScriptAccess(scriptId, user.id);
  const rows = await prisma.snapshot.findMany({
    where: { scriptId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, isManual: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// Manual "Save Version": always writes, keyed by a user-typed label.
export async function createManualSnapshot(
  scriptId: string,
  doc: JSONNode,
  meta: SnapshotMeta,
  label: string,
) {
  const user = await getCurrentUser();
  await assertScriptOwner(scriptId, user.id);
  const created = await prisma.snapshot.create({
    data: { scriptId, isManual: true, label: label.trim() || "Saved version", content: serialize(doc, meta) },
  });
  revalidatePath(`/scripts/${scriptId}/history`);
  return { id: created.id, createdAt: created.createdAt.toISOString() };
}

// Automatic session checkpoint. Skipped when the newest snapshot already holds
// identical content, so a quiet session doesn't accrue duplicate checkpoints.
export async function createAutoSnapshot(scriptId: string, doc: JSONNode, meta: SnapshotMeta) {
  const user = await getCurrentUser();
  await assertScriptOwner(scriptId, user.id);
  const content = serialize(doc, meta);

  const latest = await prisma.snapshot.findFirst({
    where: { scriptId },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  if (latest?.content === content) return { skipped: true as const };

  const created = await prisma.snapshot.create({
    data: { scriptId, isManual: false, label: null, content },
  });
  revalidatePath(`/scripts/${scriptId}/history`);
  return { id: created.id, createdAt: created.createdAt.toISOString(), skipped: false as const };
}

// Restore-as-new: never destructive. Snapshots the current state first (so the
// pre-restore version is itself recoverable), then rewrites the script's pages
// and title-page meta from the chosen snapshot.
export async function restoreSnapshot(scriptId: string, snapshotId: string) {
  const user = await getCurrentUser();
  await assertScriptOwner(scriptId, user.id);

  const snapshot = await prisma.snapshot.findUniqueOrThrow({
    where: { id: snapshotId },
    select: { content: true, scriptId: true, label: true },
  });
  if (snapshot.scriptId !== scriptId) throw new Error("Snapshot does not belong to this script.");

  const { doc, meta } = parseSnapshotContent(snapshot.content);
  const pages = docJSONToScriptPagesInput(doc);

  // Capture the about-to-be-overwritten state as a checkpoint so a restore is
  // itself undoable.
  const current = await prisma.script.findUniqueOrThrow({
    where: { id: scriptId },
    include: {
      pages: { include: { items: { include: { panel: { include: { textElements: true } } } } } },
    },
  });
  const currentDoc = scriptToDocJSON(current) as JSONNode;
  const currentContent = serialize(currentDoc, {
    title: current.title,
    author: current.author,
    draftLabel: current.draftLabel,
    draftDate: current.draftDate.toISOString().slice(0, 10),
  });

  const parsedDate = meta.draftDate ? new Date(meta.draftDate) : null;
  const draftDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : current.draftDate;

  await prisma.$transaction([
    prisma.snapshot.create({
      data: { scriptId, isManual: false, label: "Before restore", content: currentContent },
    }),
    prisma.page.deleteMany({ where: { scriptId } }),
    prisma.script.update({
      where: { id: scriptId },
      data: {
        title: meta.title.trim() || "Untitled",
        author: meta.author.trim(),
        draftLabel: meta.draftLabel.trim() || "Draft #1",
        draftDate,
        pages: { create: pages },
      },
    }),
  ]);

  revalidatePath(`/scripts/${scriptId}`);
  revalidatePath(`/scripts/${scriptId}/history`);
  revalidatePath("/");
}

export async function deleteSnapshot(scriptId: string, snapshotId: string) {
  const user = await getCurrentUser();
  await assertScriptOwner(scriptId, user.id);
  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId }, select: { scriptId: true } });
  if (snapshot?.scriptId !== scriptId) throw new Error("Snapshot does not belong to this script.");
  await prisma.snapshot.delete({ where: { id: snapshotId } });
  revalidatePath(`/scripts/${scriptId}/history`);
}
