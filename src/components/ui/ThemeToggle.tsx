"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_LABEL, THEME_ORDER, isTheme, type Theme } from "@/lib/theme";

/**
 * Cycles system → light → dark.
 *
 * The choice lives in a cookie so the server can stamp `data-theme` on <html>
 * in the first byte of HTML — there is no pre-paint script and no flash. The
 * token layer keys off that stamp, with an explicit choice beating the OS
 * preference in either direction (see globals.css).
 */

function readTheme(): Theme {
  const match = document.cookie.match(/(?:^|;\s*)panelist-theme=([^;]*)/);
  const value = match?.[1];
  return isTheme(value) ? value : "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme === "system" ? "light dark" : theme;

  // A year for a choice, or an immediate expiry to fall back to the system.
  document.cookie =
    theme === "system"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

// A store rather than an effect, so the button never renders the wrong icon
// after hydration and every toggle in the app stays in step.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function ThemeToggle() {
  // The server can't read document.cookie; it already stamped <html>, and the
  // first client read corrects the icon without changing what's painted.
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "system");

  const cycle = useCallback(() => {
    applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(readTheme()) + 1) % THEME_ORDER.length]);
    listeners.forEach((listener) => listener());
  }, []);

  return (
    <button
      type="button"
      className="icon-btn icon-btn--quiet"
      onClick={cycle}
      title={THEME_LABEL[theme]}
      aria-label={THEME_LABEL[theme]}
    >
      {theme === "system" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none" />
        </svg>
      )}
      {theme === "light" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M6.3 6.3L4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5" />
        </svg>
      )}
      {theme === "dark" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
