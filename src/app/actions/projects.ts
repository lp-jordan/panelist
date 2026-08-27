"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function createProject(formData: FormData) {
  await verifySession();
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length === 0) return;

  await prisma.project.create({ data: { name: name.trim() } });
  revalidatePath("/");
}

export async function renameProject(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  const name = formData.get("name");
  if (typeof id !== "string" || typeof name !== "string" || name.trim().length === 0) return;

  await prisma.project.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/");
}

export async function archiveProject(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

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
  await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await prisma.project.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath("/");
  revalidatePath("/trash");
}

export async function deleteProjectForever(formData: FormData) {
  await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project?.deletedAt) {
    throw new Error("A project must be in the trash before it can be permanently deleted.");
  }

  await prisma.project.delete({ where: { id } });
  revalidatePath("/trash");
}
