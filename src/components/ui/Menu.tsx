"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// `createPortal` needs a real `document`, which the server render doesn't have.
// A store rather than a mount effect, so this costs no extra render pass.
const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The `···` overflow menu, and the right-click menu for whatever contains it.
 *
 * The popover renders in a portal on `document.body` rather than beside its
 * trigger: a menu inside `.list` was being clipped by the `overflow: hidden`
 * that gives the list its rounded corners. Portalling also lets it escape a
 * scroll container and flip up when there is no room below.
 */

type Anchor = {
  /** The menu's right edge for a trigger, or its left edge for a cursor. */
  x: number;
  /** Preferred top edge — below the trigger, or at the cursor. */
  below: number;
  /** Edge to hang from instead when there isn't room below. */
  above: number;
  fromCursor: boolean;
};

export function Menu({
  label,
  children,
  triggerClassName = "more-btn",
  /** Trigger glyph. Defaults to the `···` overflow dots. */
  icon,
  /**
   * Selector for the ancestor that should also open this menu on right-click:
   * ".row" for a list row, ".group-head" for a project header.
   */
  contextSelector,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
  triggerClassName?: string;
  icon?: React.ReactNode;
  contextSelector?: string;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const isClient = useSyncExternalStore(noopSubscribe, onClient, onServer);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = anchor !== null;

  const close = useCallback(() => setAnchor(null), []);

  const openFromTrigger = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ x: rect.right, below: rect.bottom + 6, above: rect.top - 6, fromCursor: false });
  }, []);

  // Right-click anywhere on the owning row opens the same menu at the pointer.
  useEffect(() => {
    if (!contextSelector) return;
    const target = triggerRef.current?.closest(contextSelector);
    if (!target) return;

    const onContextMenu = (event: Event) => {
      const mouse = event as MouseEvent;
      mouse.preventDefault();
      setAnchor({ x: mouse.clientX, below: mouse.clientY + 2, above: mouse.clientY - 2, fromCursor: true });
    };

    target.addEventListener("contextmenu", onContextMenu);
    return () => target.removeEventListener("contextmenu", onContextMenu);
  }, [contextSelector]);

  // Placed after render, so the menu's real height decides whether it flips.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!open || !el || !anchor) return;

    const pad = 8;
    const width = el.offsetWidth;
    const height = el.offsetHeight;

    let left = anchor.fromCursor ? anchor.x : anchor.x - width;
    let top = anchor.below;
    let originY = "top";

    if (top + height > window.innerHeight - pad) {
      top = anchor.above - height;
      originY = "bottom";
    }
    top = Math.max(pad, top);
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transformOrigin = `${originY} ${anchor.fromCursor ? "left" : "right"}`;
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (menuRef.current?.contains(node) || triggerRef.current?.contains(node)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // A fixed-position menu would otherwise sit still while the page moved.
    const onReflow = () => close();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, close]);

  const popover = (
    <div className="menu" id={id} role="menu" ref={menuRef} data-open={open} inert={!open}>
      {children(close)}
    </div>
  );

  return (
    <div className="menu-anchor">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          // Rows are links; opening their menu must not follow them.
          event.preventDefault();
          event.stopPropagation();
          if (open) close();
          else openFromTrigger();
        }}
      >
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        )}
      </button>

      {/* Portalled so `overflow: hidden` on the list can't clip it. */}
      {isClient ? createPortal(popover, document.body) : null}
    </div>
  );
}
