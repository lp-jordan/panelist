import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Apply any pending invitations addressed to `email` for the given user (V2 D3).
 * Called whenever someone signs in, so an invite sent to someone who already has
 * an account is picked up the next time they sign in.
 *
 * Sign-in is passwordless — the person just proved they control `email` by
 * entering the code (or clicking the link) sent to it — so matching a PENDING
 * invite on that verified email is sound.
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
