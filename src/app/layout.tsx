import type { Metadata } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import "./globals.css";
import "./ui.css";

export const metadata: Metadata = {
  title: "Panelist",
  description: "Comic script writer",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  // Shrink the *layout* viewport when the software keyboard opens (the default,
  // "resizes-visual", leaves it full-height and lets the keyboard overlay fixed
  // bars). With this, a `position: fixed; bottom: 0` element — the editor's
  // touch toolbar — sits above the keyboard natively on Chrome/Android with no
  // JS. iOS Safari ignores it, so the keyboardInset fallback in ScriptEditor
  // still handles that case.
  interactiveWidget: "resizes-content" as const,
};

// Each page renders its own nav bar: the library and trash share one, the
// editor has its own with the script's save state in it, and the login gate
// has none. A single global bar would have had to be all three.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read the appearance server-side and stamp it on <html> in the first byte
  // of HTML. A client script would have to run before paint to avoid a visible
  // flip, and React 19 warns about <script> rendered inside a component.
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = stored === "light" || stored === "dark" ? stored : "system";

  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      style={{ colorScheme: theme === "system" ? "light dark" : theme }}
    >
      <body>{children}</body>
    </html>
  );
}
