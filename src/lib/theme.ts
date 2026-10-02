export const THEME_COOKIE = "panelist-theme";

// "system" only means "no choice saved yet": first-time visitors get their
// OS appearance. Every control is a two-way light/dark switch from there.
export type Theme = "system" | "light" | "dark";
export type Appearance = "light" | "dark";

export function isTheme(value: string | undefined): value is "light" | "dark" {
  return value === "light" || value === "dark";
}
