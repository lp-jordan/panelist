import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { claimInvitesForUser } from "@/lib/invites";
import { logout } from "@/app/actions/auth";
import "../../login/login.css";

// The shareable invite link (V2 D3). The token resolves to the invited email so
// the owner can share a link without exposing it. Behaviour:
//  • signed in with the matching email → claim + go to the book
//  • signed in as someone else → explain, offer to switch accounts
//  • signed out → bounce to sign-up with the email prefilled
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: { email: true, status: true, project: { select: { id: true, name: true } } },
  });

  if (!invite || invite.status !== "PENDING") {
    return (
      <main className="login">
        <h1>Panelist</h1>
        <p className="login-tagline">This invite link is no longer valid.</p>
        <Link href="/login" className="login-switch">Go to Panelist</Link>
      </main>
    );
  }

  const session = await getSession();
  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });

    if (user?.email === invite.email) {
      await claimInvitesForUser(session.userId, invite.email);
      redirect(`/projects/${invite.project.id}`);
    }

    // Signed in as someone else — the invite is email-keyed, so switch accounts.
    return (
      <main className="login">
        <h1>{invite.project.name}</h1>
        <p className="login-tagline">
          This invite is for <strong>{invite.email}</strong>, but you&apos;re signed in as{" "}
          <strong>{user?.email}</strong>.
        </p>
        <form action={logout}>
          <button type="submit" className="btn-primary">Switch account</button>
        </form>
      </main>
    );
  }

  // Signed out — the login page prefills the email and defaults to sign-up.
  redirect(`/login?mode=signup&email=${encodeURIComponent(invite.email)}`);
}
