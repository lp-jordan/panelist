"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter the password." };
  }

  const owner = await prisma.user.findFirst({ where: { role: "OWNER" } });

  if (!owner || !(await bcrypt.compare(password, owner.passwordHash))) {
    return { error: "Incorrect password." };
  }

  await createSession(owner.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
