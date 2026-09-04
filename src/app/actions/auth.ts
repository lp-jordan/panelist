"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");

  if (!email || typeof password !== "string" || password.length === 0) {
    return { error: "Enter your email and password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message whether the email is unknown or the password is wrong, so the
  // form doesn't reveal which accounts exist.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id);
  redirect("/");
}

export async function register(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const name = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");

  if (!name) return { error: "Enter your name." };
  if (!email || !email.includes("@")) return { error: "Enter a valid email." };
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "An account with that email already exists. Log in instead." };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "COLLABORATOR" },
  });

  // D2 will apply any pending email-keyed invitations here on sign-up.

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
