import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET environment variable is not set");
}
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type SessionPayload = {
  userId: string;
};

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({ userId });
  const cookieStore = await cookies();

  // Mark the cookie `secure` only when the request actually arrived over HTTPS,
  // not merely because NODE_ENV is production. A `secure` cookie is dropped by
  // the browser over plain HTTP on any non-localhost host, which bounced the
  // phone (reaching a `next start` build over http://<tailscale-ip>:3000)
  // between /login and / forever. A production build served behind an HTTPS
  // proxy still gets `secure` via x-forwarded-proto.
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const isHttps = proto === "https";

  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: isHttps,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  return decrypt(session);
}
