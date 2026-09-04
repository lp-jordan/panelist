"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, assertProjectOwner } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { claimInvitesForUser } from "@/lib/invites";

export type InviteResult = { error?: string; token?: string } | undefined;

/**
 * Owner invites a teammate by email (V2 D3). Mints (or reuses) a PENDING invite
 * whose token is the shareable link. If the invitee already has an account, the
 * membership is applied immediately; otherwise it's claimed when they sign up or
 * next log in with the matching email.
 */
export async function createInvite(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  const user = await getCurrentUser();
  const projectId = formData.get("projectId");
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");

  if (typeof projectId !== "string" || projectId.length === 0) return { error: "Missing project." };
  await assertProjectOwner(projectId, user.id);

  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) return { error: "Enter a valid email." };

  const role = roleRaw === "OWNER" ? "OWNER" : "COLLABORATOR";

  // Already a member? Nothing to invite.
  const existingMember = await prisma.projectMember.findFirst({
    where: { projectId, user: { email } },
    select: { id: true },
  });
  if (existingMember) return { error: "That person is already on this book." };

  // One open invite per (project, email): reuse the row (and its token/link) so
  // re-inviting doesn't orphan the old link, and refresh the role.
  const invite = await prisma.invite.upsert({
    where: { projectId_email: { projectId, email } },
    update: { role, status: "PENDING", invitedBy: user.id, acceptedAt: null },
    create: { projectId, email, role, invitedBy: user.id },
    select: { token: true },
  });

  // If they already have an account, apply it now so they don't have to re-auth.
  const invitee = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (invitee) await claimInvitesForUser(invitee.id, email);

  revalidatePath(`/projects/${projectId}`);
  return { token: invite.token };
}

/** Owner revokes a pending invite (the link stops working). */
export async function revokeInvite(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const invite = await prisma.invite.findUnique({ where: { id }, select: { projectId: true } });
  if (!invite) return;
  await assertProjectOwner(invite.projectId, user.id);

  await prisma.invite.update({ where: { id }, data: { status: "REVOKED" } });
  revalidatePath(`/projects/${invite.projectId}`);
}

/** Owner removes a member from a book (can't remove themselves / the last owner). */
export async function removeMember(formData: FormData) {
  const user = await getCurrentUser();
  const projectId = formData.get("projectId");
  const userId = formData.get("userId");
  if (typeof projectId !== "string" || typeof userId !== "string") return;
  await assertProjectOwner(projectId, user.id);
  if (userId === user.id) return; // use "leave" instead; never strand the book

  await prisma.projectMember.deleteMany({ where: { projectId, userId, role: { not: "OWNER" } } });
  revalidatePath(`/projects/${projectId}`);
}
