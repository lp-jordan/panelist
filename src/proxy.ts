import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Reachable signed out: the log-in and sign-up pages, the magic-link landing page, and invite
// links (the invite page itself sends signed-out visitors to /login with the
// invited email prefilled).
function isPublic(path: string) {
  return path === "/login" || path === "/signup" || path === "/login/verify" || path.startsWith("/invite/");
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicPath = isPublic(path);

  const cookie = request.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  // A signature-valid cookie can still name a user that no longer exists
  // (e.g. the owner account was recreated). Check the DB here — this is
  // the only place allowed to clear a stale cookie before the redirect;
  // Server Components can't mutate cookies during render. Without this,
  // a stale cookie makes this check and a DB-backed check elsewhere
  // (src/lib/dal.ts) disagree and bounce the request between them forever.
  const isValidUser = session?.userId
    ? Boolean(await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }))
    : false;

  if (!isPublicPath && !isValidUser) {
    const response = NextResponse.redirect(new URL("/login", request.nextUrl));
    if (session?.userId) response.cookies.delete("session");
    return response;
  }

  // Signed-in visitors skip the log-in and sign-up forms; verify and invite
  // pages handle a signed-in visitor themselves.
  if ((path === "/login" || path === "/signup") && isValidUser) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$).*)"],
};
