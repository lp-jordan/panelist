"use server";

import { revalidatePath } from "next/cache";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function createScript(formData: FormData) {
  const user = await getCurrentUser();
  const title = formData.get("title");
  const projectIdRaw = formData.get("projectId");
  if (typeof title !== "string" || title.trim().length === 0) return;

  const projectId = typeof projectIdRaw === "string" && projectIdRaw.length > 0 ? projectIdRaw : null;

  await prisma.script.create({
    data: {
      title: title.trim(),
      projectId,
      author: user.name,
      draftLabel: "Draft #1",
      draftDate: new Date(),
    },
  });
  revalidatePath("/");
}

export async function renameScript(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  const title = formData.get("title");
  if (typeof id !== "string" || typeof title !== "string" || title.trim().length === 0) return;

  await prisma.script.update({ where: { id }, data: { title: title.trim() } });
  revalidatePath("/");
}

export async function duplicateScript(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

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
  await verifySession();
  if (typeof scriptId !== "string" || scriptId.length === 0) return;

  // A dropped project must still exist and be un-trashed, else the script
  // would vanish into a dangling group. Falling back to Unassigned (null) is
  // safer than throwing on a stale drag target.
  let target: string | null = null;
  if (typeof projectId === "string" && projectId.length > 0) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    target = project?.id ?? null;
  }

  await prisma.script.update({ where: { id: scriptId }, data: { projectId: target } });
  revalidatePath("/");
}

export async function archiveScript(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await prisma.script.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/");
  revalidatePath("/trash");
}

export async function restoreScript(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await prisma.script.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath("/");
  revalidatePath("/trash");
}

export async function deleteScriptForever(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const script = await prisma.script.findUnique({ where: { id } });
  if (!script?.deletedAt) {
    throw new Error("A script must be in the trash before it can be permanently deleted.");
  }

  await prisma.script.delete({ where: { id } });
  revalidatePath("/trash");
}
