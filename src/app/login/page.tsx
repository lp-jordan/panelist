"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 320 }}>
      <h1>Panelist</h1>
      <form action={formAction}>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoFocus style={{ display: "block", width: "100%", marginBottom: "0.5rem" }} />
        {state?.error && <p style={{ color: "crimson" }}>{state.error}</p>}
        <button disabled={pending} type="submit">
          {pending ? "Checking..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
