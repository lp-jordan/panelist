"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertScriptOwner, assertProjectAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { writeScriptPages } from "@/lib/editor/persist";
import { type JSONNode } from "@/lib/editor/serialize";

export async function saveScriptContent(scriptId: string, doc: JSONNode) {
  const user = await getCurrentUser();
  await assertScriptOwner(scriptId, user.id);
  await writeScriptPages(scriptId, doc);
  revalidatePath(`/scripts/${scriptId}`);
  revalidatePath("/");
}

// Saves the title-page fields — title, "written by" credit, draft label and
// date. Separate from saveScriptContent so editing the cover never rewrites the
// page content (and vice versa). `draftDate` is an ISO date string (yyyy-mm-dd)
// from the date field; a blank or unparseable value leaves the date untouched.
export async function updateScriptMeta(
  scriptId: string,
  meta: { title: string; author: string; draftLabel: string; draftDate: string },
) {
  const user = await getCurrentUser();
  await assertScriptOwner(scriptId, user.id);

  const parsedDate = meta.draftDate ? new Date(meta.draftDate) : null;
  const draftDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

  await prisma.script.update({
    where: { id: scriptId },
    data: {
      title: meta.title.trim() || "Untitled",
      author: meta.author.trim(),
      draftLabel: meta.draftLabel.trim() || "Draft #1",
      ...(draftDate ? { draftDate } : {}),
    },
  });

  revalidatePath(`/scripts/${scriptId}`);
  revalidatePath("/");
}

export async function addCastMemberFromEditor(projectId: string, name: string) {
  const user = await getCurrentUser();
  await assertProjectAccess(projectId, user.id);
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await prisma.castMember.findFirst({
    where: { projectId, name: { equals: trimmed } },
  });
  if (!existing) {
    await prisma.castMember.create({ data: { projectId, name: trimmed } });
  }
}
