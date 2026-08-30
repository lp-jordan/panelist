"use client";

import { useEffect, useSyncExternalStore } from "react";

// The platform never changes mid-session, so there is nothing to subscribe to.
const noopSubscribe = () => () => {};
const isMacClient = () => /mac|iphone|ipad/i.test(navigator.userAgent);

// The shortcut strip under the page shows the three you need on day one.
// This is the rest of the keymap, which is otherwise undiscoverable.
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Writing",
    items: [
      ["Enter", "Next line"],
      ["Enter on an empty line", "Start the next panel"],
      ["Tab / Shift+Tab", "Cycle Character → SFX → Narration → Caption"],
      ["Mod+Enter", "Start a new page"],
      ["Mod+Shift+B", "Insert a blank freeform page (skipped by numbering)"],
      ["Mod+Shift+N", "Add a note to the artist at the top of the page"],
    ],
  },
  {
    title: "Rearranging",
    items: [
      ["Alt+↑ / Alt+↓", "Move this panel up or down"],
      ["Alt+Shift+↑ / Alt+Shift+↓", "Move this page up or down"],
    ],
  },
  {
    title: "Removing",
    items: [
      ["Backspace on an empty line", "Delete the line"],
      ["Mod+Backspace", "Delete this panel, dialogue and all"],
      ["Mod+Shift+↑ / Mod+Shift+↓", "Select whole panels, then Delete to remove them"],
    ],
  },
  {
    title: "Saving",
    items: [["Mod+S", "Save now"]],
  },
];

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Rendered as "Ctrl" on the server and corrected on the client, so the label
  // matches the machine without a hydration mismatch.
  const modKey = useSyncExternalStore(noopSubscribe, isMacClient, () => false) ? "⌘" : "Ctrl";

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div
        className="form-sheet sx-shortcuts"
        data-open={open}
        role="dialog"
        aria-label="Keyboard shortcuts"
        inert={!open}
      >
        <div className="form-sheet-card">
          <div className="form-sheet-head">
            <span />
            <strong>Keyboard shortcuts</strong>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
          <div className="sx-shortcuts-body">
            {GROUPS.map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                <dl>
                  {group.items.map(([keys, meaning]) => (
                    <div key={keys}>
                      <dt>{keys.replace(/Mod/g, modKey)}</dt>
                      <dd>{meaning}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
