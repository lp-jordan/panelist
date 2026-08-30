"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Nothing to subscribe to — this only distinguishes server (no document) from
// client. getServerSnapshot returns false so SSR emits nothing; the client
// snapshot returns true, so after hydration the portal mounts, mismatch-free.
const noopSubscribe = () => () => {};

/**
 * Renders its children at the end of <body>, escaping whatever container it's
 * written inside. Modals need this: the library list sits in `.pullback`, which
 * takes a `transform`/`filter` while a sheet is open — and a transformed or
 * filtered ancestor becomes the containing block for its `position: fixed`
 * descendants, which trapped the full-screen scrim inside the shrunken library
 * box instead of covering the viewport. Portalling to <body> frees it.
 *
 * Mount-gated so the server render (which has no `document`) and the first
 * client render agree on emitting nothing, then the portal appears.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
