"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./scratchpad.css";

// A plain-text notes pad beside the script: one shared pad per script, for
// loose ideas and trial dialogue. Never part of the script or its exports.
//
// Desktop: a floating card on the right, mirroring the page outline on the
// left — folded to a scribble chip, or open with the text area.
// Phones/tablets: a drawer from the right, opened by dragging (or tapping) a
// faint vertical bar on the screen edge and closed by dragging its grip back.
// A drag bar rather than an edge swipe, because iOS claims edge swipes for
// browser back/forward.

const SAVE_DELAY_MS = 800;
const STORAGE_KEY = "sx-pad-open";
const DESKTOP_QUERY = "(min-width: 1101px)";

type SaveState = "idle" | "saving" | "saved" | "error";

function ScribbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 16c2.5-5 4.5-7 5.5-5.5S8 16 10 15.5s3-6.5 5-6.5-.5 6 1.5 6.5S20 12 21 11" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function ScratchPad({ scriptId, initialText }: { scriptId: string; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Desktop remembers whether the card is open; the mobile drawer always starts
  // closed. The editor is client-only, so reading storage here can't mismatch
  // a server render.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia(DESKTOP_QUERY).matches && window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Live drawer offset while dragging (px from fully open) and the drawer's
  // width at drag start; null when not dragging.
  const [dragState, setDragState] = useState<{ x: number; width: number } | null>(null);

  const drawerRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(initialText);
  const savedText = useRef(initialText);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = `/api/scripts/${scriptId}/scratchpad`;

  const setOpenAndRemember = useCallback((next: boolean) => {
    setOpen(next);
    try {
      if (window.matchMedia(DESKTOP_QUERY).matches) window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* storage blocked — just don't remember */
    }
  }, []);

  const save = useCallback(async () => {
    timer.current = null;
    const value = latest.current;
    if (value === savedText.current) return;
    setSaveState("saving");
    try {
      const res = await fetch(url, { method: "POST", body: value, keepalive: true, headers: { "Content-Type": "text/plain" } });
      if (!res.ok) throw new Error(String(res.status));
      savedText.current = value;
      setSaveState(latest.current === value ? "saved" : "saving");
    } catch {
      setSaveState("error");
    }
  }, [url]);

  const onChange = (value: string) => {
    setText(value);
    latest.current = value;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  // Flush unsaved notes when the tab is hidden or closed — a beacon completes
  // during unload where a fetch might not.
  useEffect(() => {
    const flush = () => {
      if (latest.current === savedText.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const blob = new Blob([latest.current], { type: "text/plain" });
      if (navigator.sendBeacon(url, blob)) savedText.current = latest.current;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [url]);

  // Focus the text area when the pad opens.
  useEffect(() => {
    if (open) textareaRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !window.matchMedia(DESKTOP_QUERY).matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Drag on the edge bar (opening) or the drawer's grip (closing). The drawer
  // follows the finger; on release it settles open if more than half shown. A
  // press that barely moves counts as a tap and toggles.
  const drag = useRef<{ startX: number; startOffset: number; width: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const width = drawerRef.current?.offsetWidth ?? 320;
    drag.current = { startX: e.clientX, startOffset: open ? 0 : width, width, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    d.moved = true;
    setDragState({ x: Math.min(d.width, Math.max(0, d.startOffset + dx)), width: d.width });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setOpen((o) => !o);
    } else {
      const offset = Math.min(d.width, Math.max(0, d.startOffset + (e.clientX - d.startX)));
      setOpen(offset < d.width / 2);
    }
    setDragState(null);
  };

  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
  const dragging = dragState !== null;
  const status =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : "";

  return (
    <>
      {/* Phones/tablets: the faint edge bar that pulls the drawer out. */}
      <div
        className="sx-pad-handle"
        data-hidden={open || dragging}
        role="button"
        tabIndex={0}
        aria-label="Open scratch pad"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        {...dragHandlers}
      >
        <span className="sx-pad-line" />
      </div>
      <div
        className="sx-pad-scrim"
        data-open={open}
        style={dragState ? { opacity: 1 - dragState.x / dragState.width, transition: "none" } : undefined}
        onClick={() => setOpen(false)}
      />

      <aside
        ref={drawerRef}
        className="sx-pad"
        data-open={open}
        data-dragging={dragging}
        style={dragState ? { transform: `translateX(${dragState.x}px)` } : undefined}
        aria-label="Scratch pad"
      >
        {/* The grip that drags the drawer closed (phones/tablets only). */}
        <div className="sx-pad-grip" aria-hidden="true" {...dragHandlers}>
          <span className="sx-pad-line" />
        </div>

        <div className="sx-pad-head">
          <button
            type="button"
            className="sx-pad-toggle"
            onClick={() => setOpenAndRemember(!open)}
            aria-label={open ? "Close scratch pad" : "Open scratch pad"}
            aria-expanded={open}
            title="Scratch pad"
          >
            <ScribbleIcon />
          </button>
          <span className="sx-pad-title">Scratch pad</span>
          <span className="sx-pad-status" data-state={saveState} role="status" aria-live="polite">
            {status}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          className="sx-pad-text"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ideas, trial dialogue, anything. Shared with everyone on this script; never exported."
          aria-label="Scratch pad notes"
          spellCheck
        />
      </aside>
    </>
  );
}
