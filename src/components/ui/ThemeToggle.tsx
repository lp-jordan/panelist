"use client";

import { useTheme } from "./useTheme";

/**
 * Switches between light and dark. State and persistence live in useTheme, shared
 * with the format sheet's appearance control so both stay in step. The choice
 * is a cookie the server reads to stamp `data-theme` on <html> before first
 * paint, so there is no pre-paint script and no flash.
 */
export function ThemeToggle() {
  const { appearance, toggle } = useTheme();
  const label = appearance === "dark" ? "Switch to light" : "Switch to dark";

  return (
    <button
      type="button"
      className="icon-btn icon-btn--quiet"
      onClick={toggle}
      title={label}
      aria-label={label}
    >
      {appearance === "light" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M6.3 6.3L4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5" />
        </svg>
      )}
      {appearance === "dark" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
