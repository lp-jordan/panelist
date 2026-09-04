"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertScriptOwner } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Flips a script between the editor (unlocked) and the reference read view
// (locked). D2 will additionally gate this to the owner role.
export async function setScriptLock(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  const locked = formData.get("locked") === "true";
  if (typeof id !== "string") return;
  await assertScriptOwner(id, user.id);

  await prisma.script.update({ where: { id }, data: { locked } });
  revalidatePath(`/scripts/${id}`);
  // When toggled from a project hub's row menu, refresh the hub too so the
  // menu item reflects the new state.
  const projectId = formData.get("projectId");
  if (typeof projectId === "string" && projectId.length > 0) revalidatePath(`/projects/${projectId}`);
}

export async function createScript(formData: FormData) {
  const user = await getCurrentUser();
  const title = formData.get("title");
  const projectIdRaw = formData.get("projectId");
  if (typeof title !== "string" || title.trim().length === 0) return;

  let projectId = typeof projectIdRaw === "string" && projectIdRaw.length > 0 ? projectIdRaw : null;
  // Only accept a project the creator actually belongs to; otherwise the script
  // is created loose (owned, no project).
  if (projectId) {
    const member = await prisma.projectMember.findFirst({ where: { projectId, userId: user.id }, select: { id: true } });
    if (!member) projectId = null;
  }

  await prisma.script.create({
    data: {
      title: title.trim(),
      projectId,
      ownerId: user.id,
      author: user.name,
      draftLabel: "Draft #1",
      draftDate: new Date(),
    },
  });
  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function renameScript(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  const title = formData.get("title");
  if (typeof id !== "string" || typeof title !== "string" || title.trim().length === 0) return;
  await assertScriptOwner(id, user.id);

  await prisma.script.update({ where: { id }, data: { title: title.trim() } });
  revalidatePath("/");
}

export async function duplicateScript(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await assertScriptOwner(id, user.id);

  const original = await prisma.script.findUniqueOrThrow({
    where: { id },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { order: "asc" },
            include: {
              panel: {
                include: { textElements: { orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  });

  await prisma.script.create({
    data: {
      projectId: original.projectId,
      ownerId: user.id,
      title: `${original.title} (Copy)`,
      author: original.author,
      draftLabel: original.draftLabel,
      draftDate: original.draftDate,
      pages: {
        create: original.pages.map((page) => ({
          order: page.order,
          items: {
            create: page.items.map((item) => ({
              order: item.order,
              type: item.type,
              noteText: item.noteText,
              panel: item.panel
                ? {
                    create: {
                      description: item.panel.description,
                      textElements: {
                        create: item.panel.textElements.map((textElement) => ({
                          order: textElement.order,
                          type: textElement.type,
                          character: textElement.character,
                          modifier: textElement.modifier,
                          text: textElement.text,
                        })),
                      },
                    },
                  }
                : undefined,
            })),
          },
        })),
      },
    },
  });
  revalidatePath("/");
}

export async function moveScript(scriptId: string, projectId: string | null) {
  const user = await getCurrentUser();
  if (typeof scriptId !== "string" || scriptId.length === 0) return;
  await assertScriptOwner(scriptId, user.id);

  // A dropped project must still exist, be un-trashed, and be one the user
  // belongs to, else the script would vanish into a group they can't see.
  // Falling back to Unassigned (null) is safer than throwing on a stale drag.
  let target: string | null = null;
  if (typeof projectId === "string" && projectId.length > 0) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null, members: { some: { userId: user.id } } },
      select: { id: true },
    });
    target = project?.id ?? null;
  }

  await prisma.script.update({ where: { id: scriptId }, data: { projectId: target } });
  revalidatePath("/");
}

export async function archiveScript(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await assertScriptOwner(id, user.id);

  await prisma.script.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/");
  revalidatePath("/trash");
}

export async function restoreScript(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await assertScriptOwner(id, user.id);

  await prisma.script.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath("/");
  revalidatePath("/trash");
}

export async function deleteScriptForever(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await assertScriptOwner(id, user.id);

  const script = await prisma.script.findUnique({ where: { id } });
  if (!script?.deletedAt) {
    throw new Error("A script must be in the trash before it can be permanently deleted.");
  }

  await prisma.script.delete({ where: { id } });
  revalidatePath("/trash");
}
