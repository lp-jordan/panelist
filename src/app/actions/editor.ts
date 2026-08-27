"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { docJSONToScriptPagesInput, type JSONNode } from "@/lib/editor/serialize";

export async function saveScriptContent(scriptId: string, doc: JSONNode) {
  await verifySession();
  const pages = docJSONToScriptPagesInput(doc);

  await prisma.$transaction([
    prisma.page.deleteMany({ where: { scriptId } }),
    prisma.script.update({
      where: { id: scriptId },
      data: { pages: { create: pages } },
    }),
  ]);

  revalidatePath(`/scripts/${scriptId}`);
  revalidatePath("/");
}

export async function addCastMemberFromEditor(projectId: string, name: string) {
  await verifySession();
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await prisma.castMember.findFirst({
    where: { projectId, name: { equals: trimmed } },
  });
  if (!existing) {
    await prisma.castMember.create({ data: { projectId, name: trimmed } });
  }
}
