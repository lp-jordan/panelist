import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Passwordless sign-in tokens. Each request mints one LoginToken row carrying
// two secrets for the same sign-in: a 6-digit code (typed in) and a long random
// link token (the magic link). Either one consumes the row. Only HMACs are
// stored, keyed by SESSION_SECRET, so a database leak can't be replayed and the
// low-entropy code can't be brute-forced offline. Online guessing is capped by
// MAX_ATTEMPTS per row and the request rate limits below.

export const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const MIN_SECONDS_BETWEEN_REQUESTS = 30;
const MAX_REQUESTS_PER_HOUR = 6;

function hmac(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export type IssueResult =
  | { ok: true; code: string; linkToken: string }
  | { ok: false; error: string };

/** Mint a fresh code + link for `email`, retiring any earlier unused ones. */
export async function issueLoginToken(email: string): Promise<IssueResult> {
  const now = Date.now();
  const recent = await prisma.loginToken.findMany({
    where: { email, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < MIN_SECONDS_BETWEEN_REQUESTS * 1000) {
    return { ok: false, error: "A code was just sent — give it a moment before asking for another." };
  }
  if (recent.length >= MAX_REQUESTS_PER_HOUR) {
    return { ok: false, error: "Too many codes requested. Try again in a little while." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const linkToken = randomBytes(32).toString("base64url");

  await prisma.$transaction([
    // Only the newest code works — an older email can't be used once a new one is sent.
    prisma.loginToken.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date(now) },
    }),
    prisma.loginToken.create({
      data: {
        email,
        codeHash: hmac(`code:${email}:${code}`),
        linkHash: hmac(`link:${linkToken}`),
        expiresAt: new Date(now + CODE_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  return { ok: true, code, linkToken };
}

/** Consume a typed code. Returns true when it matched the live token. */
export async function consumeCode(email: string, code: string): Promise<boolean> {
  const token = await prisma.loginToken.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return false;

  if (!safeEqualHex(token.codeHash, hmac(`code:${email}:${code}`))) {
    await prisma.loginToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    return false;
  }

  // Conditional update so two simultaneous submissions can't both succeed.
  const { count } = await prisma.loginToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return count === 1;
}

/** Look up a link token without consuming it (for the confirm page). */
export async function peekLinkToken(linkToken: string): Promise<string | null> {
  if (!linkToken) return null;
  const token = await prisma.loginToken.findUnique({
    where: { linkHash: hmac(`link:${linkToken}`) },
    select: { email: true, consumedAt: true, expiresAt: true },
  });
  if (!token || token.consumedAt || token.expiresAt <= new Date()) return null;
  return token.email;
}

/** Consume a magic-link token. Returns the email it was issued to, or null. */
export async function consumeLinkToken(linkToken: string): Promise<string | null> {
  if (!linkToken) return null;
  const token = await prisma.loginToken.findUnique({
    where: { linkHash: hmac(`link:${linkToken}`) },
    select: { id: true, email: true },
  });
  if (!token) return null;

  const { count } = await prisma.loginToken.updateMany({
    where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  return count === 1 ? token.email : null;
}
