import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Apply any pending invitations addressed to `email` for the given user (V2 D3).
 * Called on both sign-up and login, so an invite sent to someone who already has
 * an account is picked up the next time they log in.
 *
 * Until an email provider (Resend) lands, the email match IS the proof — a
 * PENDING invite whose `email` equals the authenticated user's email is trusted.
 * When email verification arrives, the token becomes the real proof instead.
 *
 * Idempotent: skips projects the user already belongs to, and flips each claimed
 * invite to ACCEPTED so it can't be replayed.
 */
export async function claimInvitesForUser(userId: string, email: string): Promise<number> {
  const invites = await prisma.invite.findMany({
    where: { email, status: "PENDING" },
    select: { id: true, projectId: true, role: true },
  });
  if (invites.length === 0) return 0;

  let claimed = 0;
  for (const invite of invites) {
    await prisma.$transaction(async (tx) => {
      const already = await tx.projectMember.findFirst({
        where: { projectId: invite.projectId, userId },
        select: { id: true },
      });
      if (!already) {
        await tx.projectMember.create({
          data: { projectId: invite.projectId, userId, role: invite.role },
        });
      }
      await tx.invite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    });
    claimed++;
  }
  return claimed;
}
