import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Content Security Policy, built per request with a fresh nonce: Next.js puts
// the nonce on its own scripts, so only scripts we served can run, and anything
// injected into a page is refused. Styles allow inline because React renders
// style attributes. Art lives on Cloudflare R2 (presigned GET for previews, PUT
// for uploads), so that one origin is allowed for images and requests.
function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  let r2 = "";
  try {
    if (process.env.ART_R2_ENDPOINT) r2 = new URL(process.env.ART_R2_ENDPOINT).origin;
  } catch {
    // A malformed endpoint just means no art origin is allowed.
  }
  return [
    "default-src 'self'",
    // wasm-unsafe-eval permits WebAssembly only (the PDF exporter's layout
    // engine), not JavaScript eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${r2 ? ` ${r2}` : ""}`,
    "font-src 'self' data:",
    // data: lets the PDF exporter fetch its bundled WebAssembly module.
    `connect-src 'self' data:${r2 ? ` ${r2}` : ""}`,
    // The PDF importer's pdf.js worker and the PDF exporter run as workers.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Reachable signed out: the log-in and sign-up pages, the magic-link landing page, and invite
// links (the invite page itself sends signed-out visitors to /login with the
// invited email prefilled).
function isPublic(path: string) {
  return path === "/login" || path === "/signup" || path === "/login/verify" || path.startsWith("/invite/");
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
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

  // Next.js reads the nonce from the request's CSP header and stamps it on the
  // scripts it renders; the browser enforces the response header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$).*)"],
};
