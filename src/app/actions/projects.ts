"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertProjectAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function createProject(formData: FormData) {
  const user = await getCurrentUser();
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length === 0) return;

  // The creator becomes the project's OWNER member — access is by membership.
  await prisma.project.create({
    data: {
      name: name.trim(),
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  revalidatePath("/");
}

export async function renameProject(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  const name = formData.get("name");
  if (typeof id !== "string" || typeof name !== "string" || name.trim().length === 0) return;
  await assertProjectAccess(id, user.id);

  await prisma.project.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/");
}

export async function archiveProject(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await assertProjectAccess(id, user.id);

  const deletedAt = new Date();
  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: { deletedAt } }),
    // Cascade so a project's scripts don't vanish from both the dashboard
    // and the trash (they'd otherwise sit under a project that no longer
    // shows up anywhere).
    prisma.script.updateMany({ where: { projectId: id, deletedAt: null }, data: { deletedAt } }),
  ]);
  revalidatePath("/");
  revalidatePath("/trash");
}

export async function restoreProject(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await assertProjectAccess(id, user.id);

  await prisma.project.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath("/");
  revalidatePath("/trash");
}

export async function deleteProjectForever(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await assertProjectAccess(id, user.id);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project?.deletedAt) {
    throw new Error("A project must be in the trash before it can be permanently deleted.");
  }

  await prisma.project.delete({ where: { id } });
  revalidatePath("/trash");
}
