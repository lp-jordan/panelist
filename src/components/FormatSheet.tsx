"use client";

import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { insertPage, insertPanelAfterCurrent } from "@/lib/editor/commands";
import { Portal } from "@/components/ui/Portal";
import { useTheme } from "@/components/ui/useTheme";
import { type Theme } from "@/lib/theme";

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M6.3 6.3L4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "Auto",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
];

/**
 * The mobile "everything" surface (Home 2): a bottom sheet holding the
 * deliberate, global actions — document commands, structural inserts, and the
 * appearance choice — grouped and labelled. It opens on tap (the keyboard has
 * already blurred), so unlike the old keyboard-anchored toolbar there is no
 * keyboard geometry to track. In-line formatting (line type, delete) lives in
 * the long-press menu instead, where it can act on the touched line.
 */
export function FormatSheet({
  editor,
  open,
  onClose,
  onSave,
  onExport,
  onTitlePage,
  onHistory,
}: {
  editor: Editor;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onExport: () => void;
  onTitlePage: () => void;
  onHistory: () => void;
}) {
  const { theme, setTheme } = useTheme();

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Run an action, then close.
  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <Portal>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div className="sx-format-sheet" data-open={open} role="dialog" aria-modal="true" aria-label="Actions">
        <div className="sx-format-card">
          <div className="sx-format-grip" aria-hidden="true">
            <span />
          </div>

          <div className="sx-format-body">
            <p className="sx-format-label">Document</p>
            <div className="sx-format-grid">
              <button type="button" className="sx-format-btn" onClick={() => act(onSave)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <path d="M17 21v-8H7v8M7 3v5h8" />
                </svg>
                Save
              </button>
              <button type="button" className="sx-format-btn" onClick={() => act(onExport)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-3a2 2 0 012-2h16a2 2 0 012 2v3a2 2 0 01-2 2h-2" />
                  <path d="M6 14h12v7H6z" />
                </svg>
                Export PDF
              </button>
              <button type="button" className="sx-format-btn" onClick={() => act(onTitlePage)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M9 8h6M10 12h4" />
                </svg>
                Title page
              </button>
              <button type="button" className="sx-format-btn" onClick={() => act(onHistory)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3v5h5" />
                  <path d="M3.05 13A9 9 0 106 5.3L3 8" />
                  <path d="M12 7v5l4 2" />
                </svg>
                History
              </button>
            </div>

            <p className="sx-format-label">Insert</p>
            <div className="sx-format-grid">
              <button type="button" className="sx-format-btn" onClick={() => act(() => insertPanelAfterCurrent(editor))}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="14" rx="2" />
                  <path d="M12 9v6M9 12h6" />
                </svg>
                New panel
              </button>
              <button type="button" className="sx-format-btn" onClick={() => act(() => insertPage(editor))}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 3h8l4 4v14H6z" />
                  <path d="M14 3v4h4M12 11v6M9 14h6" />
                </svg>
                New page
              </button>
            </div>

            <p className="sx-format-label">Appearance</p>
            <div className="sx-format-seg" role="radiogroup" aria-label="Appearance">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === opt.value}
                  className="sx-format-seg-btn"
                  data-active={theme === opt.value}
                  onClick={() => setTheme(opt.value)}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
