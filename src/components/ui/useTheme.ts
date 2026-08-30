"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_ORDER, isTheme, type Theme } from "@/lib/theme";

// Shared theme state for every control that reads or sets the appearance (the
// nav toggle and the format sheet's segmented control). The choice lives in a
// cookie so the server can stamp `data-theme` on <html> before first paint; a
// tiny store keeps all controls in step after hydration without an effect.

function readTheme(): Theme {
  if (typeof document === "undefined") return "system";
  const match = document.cookie.match(/(?:^|;\s*)panelist-theme=([^;]*)/);
  return isTheme(match?.[1]) ? (match![1] as Theme) : "system";
}

function writeTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme === "system" ? "light dark" : theme;

  document.cookie =
    theme === "system"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const notify = () => listeners.forEach((listener) => listener());

export function useTheme() {
  // The server can't read document.cookie; it already stamped <html>, so the
  // first client read only corrects controls, never what's painted.
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "system");

  const setTheme = useCallback((next: Theme) => {
    writeTheme(next);
    notify();
  }, []);

  const cycle = useCallback(() => {
    setTheme(THEME_ORDER[(THEME_ORDER.indexOf(readTheme()) + 1) % THEME_ORDER.length]);
  }, [setTheme]);

  return { theme, setTheme, cycle };
}
