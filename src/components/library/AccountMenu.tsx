"use client";

import { Menu } from "@/components/ui/Menu";
import { logout } from "@/app/actions/auth";

/**
 * The account avatar in the nav bar. Log out is the only item for now, but it's
 * a menu so the account surface has somewhere to grow — profile, preferences.
 */
export function AccountMenu() {
  return (
    <Menu
      label="Account"
      triggerClassName="avatar-btn"
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M5 20a7 7 0 0114 0" />
        </svg>
      }
    >
      {() => (
        <form action={logout}>
          <button type="submit" role="menuitem">
            Log out
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 12H4M11 8l-4 4 4 4M17 4h3v16h-3" />
            </svg>
          </button>
        </form>
      )}
    </Menu>
  );
}
