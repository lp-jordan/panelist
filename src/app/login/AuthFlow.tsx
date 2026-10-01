"use client";

import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { requestCode, verifyCode, type AuthMode } from "@/app/actions/auth";
import "./login.css";

// The shared two-step flow behind /login and /signup: details → code. The code
// step reads the same in every case, so it never reveals whether the email has
// an account (see src/app/actions/auth.ts).
export function AuthFlow({ mode }: { mode: AuthMode }) {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense>
      <AuthShell mode={mode} />
    </Suspense>
  );
}

function AuthShell({ mode }: { mode: AuthMode }) {
  // Bumping the key remounts the flow — "use a different email" starts over.
  const [attempt, setAttempt] = useState(0);
  return <Flow key={attempt} mode={mode} onRestart={() => setAttempt((n) => n + 1)} />;
}

function Mark() {
  return (
    <div className="login-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    </div>
  );
}

function useShakeOnError(error: string | undefined) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (!error || !field) return;
    field.classList.remove("shake");
    void field.offsetWidth;
    field.classList.add("shake");
    field.focus();
  }, [error]);
  return ref;
}

function Flow({ mode, onRestart }: { mode: AuthMode; onRestart: () => void }) {
  const params = useSearchParams();
  // Invite links deep-link here with the invited email prefilled.
  const prefillEmail = params.get("email") ?? "";
  const expired = params.get("expired") === "1";
  const signup = mode === "signup";

  const [requestState, requestAction, requesting] = useActionState(requestCode, undefined);
  const [verifyState, verifyAction, verifying] = useActionState(verifyCode, undefined);

  const requestError = requestState?.error;
  const sent = requestState?.sent;
  const resent = requestState?.resent === true;

  const emailRef = useShakeOnError(requestError);
  const codeRef = useShakeOnError(verifyState?.error);
  // Controlled on purpose: React resets uncontrolled fields after every form
  // action, so an error would otherwise wipe what was already typed.
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const otherHref = (signup ? "/login" : "/signup") + (prefillEmail ? `?email=${encodeURIComponent(prefillEmail)}` : "");

  return (
    <main className="login">
      <Mark />
      <h1>Panelist</h1>

      {!sent ? (
        <>
          <p className="login-tagline">{signup ? "Create your account." : "Comic scripts, properly numbered."}</p>
          <form action={requestAction} className="login-form">
            <input type="hidden" name="mode" value={mode} />
            {signup && (
              <input
                name="name"
                type="text"
                className="field"
                placeholder="Your name"
                aria-label="Your name"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            )}
            <input
              ref={emailRef}
              name="email"
              type="email"
              className="field"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={!signup}
              required
            />
            <button disabled={requesting} type="submit" className="btn-primary">
              {requesting ? "Sending…" : signup ? "Create account" : "Email me a sign-in code"}
            </button>
            <p className="login-error" role="status">
              {requestError ?? (expired ? "That sign-in link expired or was already used. Request a new one." : "")}
            </p>
          </form>
          <p className="login-note">
            {signup ? "Already have an account? " : "New here? "}
            <Link href={otherHref} className="login-switch">
              {signup ? "Log in" : "Create an account"}
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="login-tagline">
            {signup ? "Check your email." : "If that email has an account, we sent it a code."}
          </p>
          <p className="login-note">
            <strong>{sent.email}</strong>
          </p>
          <form action={verifyAction} className="login-form">
            <input type="hidden" name="email" value={sent.email} />
            <input
              ref={codeRef}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              className="field login-code"
              placeholder="123456"
              aria-label="6-digit code"
              autoFocus
              required
            />
            <button disabled={verifying} type="submit" className="btn-primary">
              {verifying ? "…" : "Continue"}
            </button>
            <p className="login-error" role="status">
              {verifyState?.error ?? requestError ?? (resent ? "New code sent." : "")}
            </p>
          </form>
          <p className="login-note">
            {signup
              ? "Or tap the button in the email. The code expires in 15 minutes."
              : "Didn't get it? Check the address, or create an account instead."}
          </p>

          <div className="login-actions">
            <form action={requestAction}>
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="email" value={sent.email} />
              <input type="hidden" name="name" value={sent.name} />
              <input type="hidden" name="resend" value="1" />
              <button type="submit" className="login-switch" disabled={requesting}>
                Resend code
              </button>
            </form>
            <button type="button" className="login-switch" onClick={onRestart}>
              Use a different email
            </button>
            {!signup && (
              <Link href={`/signup?email=${encodeURIComponent(sent.email)}`} className="login-switch">
                Create an account
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
