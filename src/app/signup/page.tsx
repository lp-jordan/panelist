import type { Metadata } from "next";
import { AuthFlow } from "../login/AuthFlow";

export const metadata: Metadata = { title: "Sign up · Panelist" };

export default function SignupPage() {
  return <AuthFlow mode="signup" />;
}
