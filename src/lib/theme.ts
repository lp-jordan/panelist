export const THEME_COOKIE = "panelist-theme";

export type Theme = "system" | "light" | "dark";

export const THEME_ORDER: Theme[] = ["system", "light", "dark"];

export const THEME_LABEL: Record<Theme, string> = {
  system: "Match system appearance",
  light: "Light appearance",
  dark: "Dark appearance",
};

export function isTheme(value: string | undefined): value is "light" | "dark" {
  return value === "light" || value === "dark";
}
