import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const verifySession = cache(async () => {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  return { userId: session.userId };
});

// --- access scoping (V2 D1) -------------------------------------------------
// Access is by project membership; a script is also reachable by its owner
// (covers loose scripts with no project). These return Prisma `where`
// fragments so every list/read filters to what the current user may see.

export function memberProjectWhere(userId: string) {
  return { members: { some: { userId } } };
}

export function accessibleScriptWhere(userId: string) {
  return {
    OR: [{ ownerId: userId }, { project: { members: { some: { userId } } } }],
  };
}

/** Throws (→ caller maps to notFound/redirect) if the user can't reach the script. */
export async function assertScriptAccess(scriptId: string, userId: string) {
  const ok = await prisma.script.findFirst({
    where: { id: scriptId, ...accessibleScriptWhere(userId) },
    select: { id: true },
  });
  if (!ok) throw new Error("forbidden");
}

/** Throws if the user isn't a member of the project. */
export async function assertProjectAccess(projectId: string, userId: string) {
  const ok = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  });
  if (!ok) throw new Error("forbidden");
}

/** Throws unless the user is an OWNER member of the project (invites, member mgmt). */
export async function assertProjectOwner(projectId: string, userId: string) {
  const ok = await prisma.projectMember.findFirst({
    where: { projectId, userId, role: "OWNER" },
    select: { id: true },
  });
  if (!ok) throw new Error("forbidden");
}

/**
 * The current user's effective role on a script (V2 D2). Owner-level = they own
 * the script (covers loose scripts) OR they're an OWNER member of its project.
 * Anyone else with access is a COLLABORATOR. Returns null if no access.
 */
export async function getScriptRole(
  scriptId: string,
  userId: string,
): Promise<"OWNER" | "COLLABORATOR" | null> {
  const script = await prisma.script.findFirst({
    where: { id: scriptId, ...accessibleScriptWhere(userId) },
    select: {
      ownerId: true,
      project: { select: { members: { where: { userId }, select: { role: true } } } },
    },
  });
  if (!script) return null;
  if (script.ownerId === userId) return "OWNER";
  if (script.project?.members[0]?.role === "OWNER") return "OWNER";
  return "COLLABORATOR";
}

/** Throws unless the user is owner-level on the script (editing, locking, etc.). */
export async function assertScriptOwner(scriptId: string, userId: string) {
  if ((await getScriptRole(scriptId, userId)) !== "OWNER") throw new Error("forbidden");
}

export const getCurrentUser = cache(async () => {
  const session = await verifySession();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    // Shouldn't normally happen — proxy.ts already verifies the user
    // exists and clears the cookie otherwise. Cookies can't be mutated
    // from a Server Component render, so this is a plain fallback.
    redirect("/login");
  }

  return user;
});
