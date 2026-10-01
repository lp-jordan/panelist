"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { claimInvitesForUser } from "@/lib/invites";
import { appUrl, renderEmail, sendEmail } from "@/lib/email";
import {
  CODE_TTL_MINUTES,
  consumeCode,
  consumeLinkToken,
  issueLoginToken,
  normalizeEmail,
  type Verified,
} from "@/lib/login-tokens";

// Passwordless sign-in, split into two entry points that look identical from
// the outside:
//   • /login  — sends a code only if the email has an account.
//   • /signup — sends a "welcome" code to a new email, or a plain sign-in code
//     (with a note that the account already exists) to a registered one.
// Both screens answer every request with the same "check your email" step, so
// neither reveals whether an address is registered; only the inbox owner learns
// that. Unregistered log-in attempts still mint a (never-sent) token so the rate
// limits — and their error messages — behave the same for every address.
// Verifying a code or link proves control of the inbox; a token may create an
// account only if it came from the sign-up form (it carries the name).

export type AuthMode = "login" | "signup";

// `sent` survives a failed resend, so a rate-limit error on "Resend code" keeps
// the person on the code step instead of bouncing them back to the email step.
export type RequestCodeState =
  | { error?: string; sent?: { email: string; name: string }; resent?: boolean }
  | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestCode(_prev: RequestCodeState, formData: FormData): Promise<RequestCodeState> {
  const mode: AuthMode = formData.get("mode") === "signup" ? "signup" : "login";
  const email = normalizeEmail(formData.get("email"));
  const nameField = formData.get("name");
  const name = typeof nameField === "string" ? nameField.trim().slice(0, 80) : "";
  if (mode === "signup" && !name) return { error: "Enter your name." };
  if (!email || !EMAIL_RE.test(email)) return { error: "Enter a valid email." };

  const isResend = formData.get("resend") === "1";
  const sent = { email, name };
  const fail = (error: string): RequestCodeState => (isResend ? { error, sent } : { error });

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const createsAccount = mode === "signup" && !existing;

  const issued = await issueLoginToken(email, createsAccount ? name : null);
  if (!issued.ok) return fail(issued.error);

  // Log-in for an unknown email: nothing to send, same response as a real one.
  if (!existing && !createsAccount) return { sent, resent: isResend };

  const origin = await appUrl();
  const link = origin ? `${origin}/login/verify?token=${encodeURIComponent(issued.linkToken)}` : null;
  const action = createsAccount ? "finish creating your account" : "sign in";

  const { html, text } = renderEmail({
    heading: createsAccount ? "Welcome to Panelist" : "Your sign-in code",
    paragraphs: [
      ...(mode === "signup" && existing
        ? ["Someone tried to sign up with this email, but you already have a Panelist account. If it was you, use this code to sign in."]
        : []),
      link ? `Enter this code to ${action}, or use the button below.` : `Enter this code to ${action}.`,
    ],
    code: issued.code,
    button: link ? { label: createsAccount ? "Continue to Panelist" : "Sign in to Panelist", url: link } : undefined,
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

const BAD_CODE = "That code is wrong or has expired.";

export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = normalizeEmail(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!email) return { error: "Start again with your email." };
  if (code.length !== 6) return { error: "Enter the 6-digit code from the email." };

  const verified = await consumeCode(email, code);
  if (!verified || !(await signIn(verified))) return { error: BAD_CODE };
  return undefined; // unreachable: signIn redirects
}

/** The magic link lands on a confirm page whose button posts here. */
export async function verifyLink(formData: FormData) {
  const verified = await consumeLinkToken(String(formData.get("token") ?? ""));
  if (!verified || !(await signIn(verified))) redirect("/login?expired=1");
}

/**
 * Sign in a verified email, creating the account only for a sign-up token.
 * Returns false (no redirect) when there's no account and nothing to create.
 */
async function signIn({ email, name }: Verified): Promise<boolean> {
  let user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    if (!name) return false;
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
