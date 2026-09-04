"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, register } from "@/app/actions/auth";
import "./login.css";

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  // Invite links (D2) can deep-link with a prefilled email and sign-up mode.
  const prefillEmail = params.get("email") ?? "";
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");

  const [state, formAction, pending] = useActionState(mode === "signup" ? register : login, undefined);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const field = firstFieldRef.current;
    if (!state?.error || !field) return;
    field.classList.remove("shake");
    void field.offsetWidth;
    field.classList.add("shake");
    field.focus();
  }, [state]);

  return (
    <main className="login">
      <div className="login-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
      </div>

      <h1>Panelist</h1>
      <p className="login-tagline">Comic scripts, properly numbered.</p>

      <form action={formAction} className="login-form" key={mode}>
        {mode === "signup" && (
          <input
            ref={mode === "signup" ? firstFieldRef : undefined}
            name="name"
            type="text"
            className="field"
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="name"
            autoFocus
          />
        )}
        <input
          ref={mode === "login" ? firstFieldRef : undefined}
          name="email"
          type="email"
          className="field"
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          defaultValue={prefillEmail}
          autoFocus={mode === "login"}
        />
        <input
          name="password"
          type="password"
          className="field"
          placeholder="Password"
          aria-label="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        <button disabled={pending} type="submit" className="btn-primary">
          {pending ? "…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
        <p className="login-error" role="status">
          {state?.error}
        </p>
      </form>

      <button
        type="button"
        className="login-switch"
        onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
      >
        {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
      </button>
    </main>
  );
}
