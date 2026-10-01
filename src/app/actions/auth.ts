"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { claimInvitesForUser } from "@/lib/invites";
import { appUrl, renderEmail, sendEmail } from "@/lib/email";
import { CODE_TTL_MINUTES, consumeCode, consumeLinkToken, issueLoginToken, normalizeEmail } from "@/lib/login-tokens";

// Passwordless sign-in. One flow covers log-in and sign-up:
//   1. requestCode — enter an email, get a 6-digit code + magic link by email.
//   2. verifyCode (typed code) or verifyLink (clicked link) — proves the person
//      controls that inbox, then signs them in, creating the account on first
//      use. Because the email is now verified, claiming pending invites for it
//      is trustworthy (it used to be a bare email match).

// `sent` survives a failed resend, so a rate-limit error on "Resend code" keeps
// the person on the code step instead of bouncing them back to the email step.
export type RequestCodeState =
  | { error?: string; sent?: { email: string; isNew: boolean }; resent?: boolean }
  | undefined;

export async function requestCode(_prev: RequestCodeState, formData: FormData): Promise<RequestCodeState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };

  const isResend = formData.get("resend") === "1";
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const sent = { email, isNew: !existing };
  const fail = (error: string): RequestCodeState => (isResend ? { error, sent } : { error });

  const issued = await issueLoginToken(email);
  if (!issued.ok) return fail(issued.error);

  const origin = await appUrl();
  const link = origin ? `${origin}/login/verify?token=${encodeURIComponent(issued.linkToken)}` : null;

  const { html, text } = renderEmail({
    heading: existing ? "Your sign-in code" : "Welcome to Panelist",
    paragraphs: [
      link
        ? `Enter this code to ${existing ? "sign in" : "finish creating your account"}, or use the button below.`
        : `Enter this code to ${existing ? "sign in" : "finish creating your account"}.`,
    ],
    code: issued.code,
    button: link ? { label: existing ? "Sign in to Panelist" : "Continue to Panelist", url: link } : undefined,
    footer: `This code expires in ${CODE_TTL_MINUTES} minutes and can only be used once. If you didn't ask for it, you can ignore this email.`,
  });

  try {
    await sendEmail({ to: email, subject: `${issued.code} is your Panelist code`, html, text });
  } catch (err) {
    console.error("[auth] sending sign-in email failed", err);
    return fail("We couldn't send the email. Try again in a moment.");
  }

  return { sent, resent: isResend };
}

export type VerifyState = { error: string } | undefined;

export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = normalizeEmail(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!email) return { error: "Start again with your email." };
  if (code.length !== 6) return { error: "Enter the 6-digit code from the email." };

  if (!(await consumeCode(email, code))) {
    return { error: "That code is wrong or has expired." };
  }

  await signIn(email, formData.get("name"));
  return undefined; // unreachable: signIn redirects
}

/** The magic link lands on a confirm page whose button posts here. */
export async function verifyLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = await consumeLinkToken(token);
  if (!email) redirect("/login?expired=1");
  await signIn(email, formData.get("name"));
}

/** Find or create the account for a verified email, claim invites, start a session. */
async function signIn(email: string, nameField: FormDataEntryValue | null) {
  let user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    const typed = typeof nameField === "string" ? nameField.trim() : "";
    // Fall back to the address's local part ("jordan.m" → "jordan.m") so a
    // magic-link sign-up never stalls on a missing name.
    const name = typed || email.split("@")[0];
    user = await prisma.user.create({ data: { name, email, role: "COLLABORATOR" }, select: { id: true } });
  }

  await claimInvitesForUser(user.id, email);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
