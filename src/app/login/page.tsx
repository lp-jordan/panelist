import type { Metadata } from "next";
import { AuthFlow } from "./AuthFlow";

export const metadata: Metadata = { title: "Log in — Panelist" };

export default function LoginPage() {
  return <AuthFlow mode="login" />;
}
