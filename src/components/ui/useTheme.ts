"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_COOKIE, isTheme, type Appearance, type Theme } from "@/lib/theme";

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

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** What's actually on screen: the saved choice, or the OS appearance if none. */
function readAppearance(): Appearance {
  const saved = readTheme();
  if (saved !== "system") return saved;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // An OS appearance change matters until a choice is saved.
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
};
const notify = () => listeners.forEach((listener) => listener());

export function useTheme() {
  // The server can't know the OS appearance; it already stamped <html>, so the
  // first client read only corrects the controls, never what's painted.
  const appearance = useSyncExternalStore<Appearance>(subscribe, readAppearance, () => "light");

  const setAppearance = useCallback((next: Appearance) => {
    const apply = () => {
      writeTheme(next);
      notify();
    };
    // Cross-fade the whole page from the old appearance to the new one (the
    // ::view-transition rules in globals.css set the timing). Where the browser
    // lacks view transitions, or the user prefers reduced motion, it switches
    // instantly.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduceMotion) {
      apply();
      return;
    }
    document.startViewTransition(apply);
  }, []);

  const toggle = useCallback(() => {
    setAppearance(readAppearance() === "dark" ? "light" : "dark");
  }, [setAppearance]);

  return { appearance, setAppearance, toggle };
}
