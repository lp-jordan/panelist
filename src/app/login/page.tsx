"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import "./login.css";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const fieldRef = useRef<HTMLInputElement>(null);

  // Restart the shake on every failure, not just the first — re-adding the
  // class only replays the animation if the element has been reflowed between.
  useEffect(() => {
    const field = fieldRef.current;
    if (!state?.error || !field) return;
    field.classList.remove("shake");
    void field.offsetWidth;
    field.classList.add("shake");
    field.focus();
    field.select();
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

      <form action={formAction} className="login-form">
        <input
          ref={fieldRef}
          id="password"
          name="password"
          type="password"
          className="field"
          placeholder="Password"
          aria-label="Password"
          autoFocus
        />
        <button disabled={pending} type="submit" className="btn-primary">
          {pending ? "Checking…" : "Unlock"}
        </button>
        {/* The slot is always here, so a failure doesn't shove the button down. */}
        <p className="login-error" role="status">
          {state?.error}
        </p>
      </form>
    </main>
  );
}
