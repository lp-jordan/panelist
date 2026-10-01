import Link from "next/link";
import type { Metadata } from "next";
import { peekLinkToken } from "@/lib/login-tokens";
import { verifyLink } from "@/app/actions/auth";
import "../login.css";

export const metadata: Metadata = { title: "Sign in — Panelist" };

// Magic-link landing page. The GET only *looks up* the token; signing in takes a
// button press (a POST to verifyLink). Email security scanners often open links
// before the person does — if the GET consumed the single-use token, the real
// click would land on "expired".
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const email = await peekLinkToken(token);

  if (!email) {
    return (
      <main className="login">
        <h1>Panelist</h1>
        <p className="login-tagline">This sign-in link expired or was already used.</p>
        <Link href="/login" className="login-switch">Get a new code</Link>
      </main>
    );
  }

  return (
    <main className="login">
      <h1>Panelist</h1>
      <p className="login-tagline">
        Continue as <strong>{email}</strong>
      </p>
      <form action={verifyLink} className="login-form">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn-primary">
          Continue to Panelist
        </button>
      </form>
    </main>
  );
}
