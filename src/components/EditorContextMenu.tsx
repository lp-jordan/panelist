"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { findAncestorPos } from "@/lib/editor/positions";
import {
  insertPage,
  insertPageNoteAtTop,
  insertPanelRelativeTo,
  setTextElementKind,
  deleteTextElementAt,
  deleteBlockAt,
  deleteSelectionRoundedToNodes,
} from "@/lib/editor/commands";
import { Portal } from "@/components/ui/Portal";

const MENU_WIDTH = 200;

// What the right-click landed on, resolved once when the menu opens. Positions
// are captured up front so the actions run against exactly what was clicked even
// if the caret has since moved.
type MenuContext = {
  x: number;
  y: number;
  clickPos: number;
  pagePos: number | null;
  panelPos: number | null;
  textElementPos: number | null;
  notePos: number | null;
  freeform: boolean;
  kind: string | null;
  hasSelection: boolean;
};

const KINDS: { value: string; label: string }[] = [
  { value: "dialogue", label: "Dialogue" },
  { value: "sfx", label: "SFX" },
  { value: "narration", label: "Narration" },
  { value: "caption", label: "Caption" },
];

/**
 * The editor's right-click menu. It replaces the browser menu inside the script
 * body (only there — the rest of the app keeps its native menus) and offers the
 * structural actions that are otherwise keyboard-only: changing a line's type,
 * inserting a panel, adding a page note, and deleting a line or panel.
 *
 * It's context-driven. A right-click anywhere in a page gets the basics (add a
 * note, insert a panel, new page); a right-click that lands on a specific line
 * or panel adds the actions that only make sense there (line type, delete);
 * right-clicking inside a selection offers "Delete selection".
 */
export function EditorContextMenu({ editor }: { editor: Editor }) {
  const [ctx, setCtx] = useState<MenuContext | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;

    const onContextMenu = (e: MouseEvent) => {
      const { state, view } = editor;
      const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!hit) return; // outside any text — let the browser menu through

      e.preventDefault();
      const clickPos = hit.pos;
      const sel = state.selection;
      const withinSelection = !sel.empty && clickPos >= sel.from && clickPos <= sel.to;

      // Move the caret to the click, so a following keyboard action and the
      // menu's own commands share the same target — but never collapse a
      // selection the user right-clicked inside (they may want "Delete selection").
      if (!withinSelection) {
        const near = TextSelection.near(state.doc.resolve(clickPos), 1);
        view.dispatch(state.tr.setSelection(near));
      }

      const freeformPos = findAncestorPos(state, clickPos, "freeformPage");
      const textElementPos = findAncestorPos(state, clickPos, "textElement");
      const textNode = textElementPos != null ? state.doc.resolve(textElementPos).nodeAfter : null;

      setCtx({
        // Clamp so the menu stays on-screen (its height is small; a bottom flip
        // near the viewport edge keeps it from clipping).
        x: Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8),
        y: Math.min(e.clientY, window.innerHeight - 320),
        clickPos,
        pagePos: findAncestorPos(state, clickPos, "page"),
        panelPos: findAncestorPos(state, clickPos, "panel"),
        textElementPos,
        notePos: findAncestorPos(state, clickPos, "note"),
        freeform: freeformPos != null,
        kind: (textNode?.attrs.kind as string) ?? null,
        hasSelection: withinSelection,
      });
    };

    dom.addEventListener("contextmenu", onContextMenu);
    return () => dom.removeEventListener("contextmenu", onContextMenu);
  }, [editor]);

  // Dismiss on any outside pointer or Escape (matches the page outline's menu).
  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtx(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [ctx]);

  if (!ctx) return null;

  const run = (fn: () => void) => {
    fn();
    setCtx(null);
  };

  // Point the selection at the clicked position before running a selection-based
  // command (add-note reads which page the caret is in).
  const withCaretAtClick = (fn: () => void) => {
    const { state, view } = editor;
    const near = TextSelection.near(state.doc.resolve(Math.min(ctx.clickPos, state.doc.content.size)), 1);
    view.dispatch(state.tr.setSelection(near));
    fn();
  };

  const onLine = ctx.textElementPos != null;
  const onPanel = ctx.panelPos != null;
  const onNote = ctx.notePos != null;
  // In a script page (not a freeform blank page), the structural actions apply.
  const inScriptPage = ctx.pagePos != null && !ctx.freeform;

  return (
    <Portal>
      <div
        className="sx-outline-menu sx-context-menu"
        role="menu"
        style={{ top: ctx.y, left: ctx.x }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Line type — only when the click landed on a dialogue/caption/etc. line. */}
        {onLine && (
          <>
            <div className="sx-context-heading" aria-hidden="true">
              Line type
            </div>
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="menuitemradio"
                aria-checked={ctx.kind === k.value}
                className="sx-outline-menu-item sx-context-radio"
                onClick={() => run(() => setTextElementKind(editor, ctx.textElementPos!, k.value))}
              >
                <span className="sx-context-check" aria-hidden="true">
                  {ctx.kind === k.value && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 6" />
                    </svg>
                  )}
                </span>
                {k.label}
              </button>
            ))}
            {(inScriptPage || onNote) && <hr className="sx-outline-menu-sep" />}
          </>
        )}

        {/* Inserts — panels only inside a script page. */}
        {inScriptPage && (
          <>
            {onPanel && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="sx-outline-menu-item"
                  onClick={() => run(() => insertPanelRelativeTo(editor, ctx.panelPos!, "above"))}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20V10M8 14l4-4 4 4M4 4h16" />
                  </svg>
                  Insert panel above
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="sx-outline-menu-item"
                  onClick={() => run(() => insertPanelRelativeTo(editor, ctx.panelPos!, "below"))}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4v10M8 10l4 4 4-4M4 20h16" />
                  </svg>
                  Insert panel below
                </button>
              </>
            )}
            <button
              type="button"
              role="menuitem"
              className="sx-outline-menu-item"
              onClick={() => run(() => withCaretAtClick(() => insertPageNoteAtTop(editor)))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M4 12h10M4 17h7" />
              </svg>
              Add note to page
            </button>
          </>
        )}

        <button
          type="button"
          role="menuitem"
          className="sx-outline-menu-item"
          onClick={() => run(() => insertPage(editor))}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V7l-4-4z" />
            <path d="M14 3v4h4M12 11v6M9 14h6" />
          </svg>
          New page
        </button>

        {/* Deletes. */}
        {(ctx.hasSelection || onLine || onPanel || onNote) && <hr className="sx-outline-menu-sep" />}

        {ctx.hasSelection && (
          <button
            type="button"
            role="menuitem"
            className="sx-outline-menu-item is-danger"
            onClick={() => run(() => deleteSelectionRoundedToNodes(editor.view))}
          >
            <DeleteIcon />
            Delete selection
          </button>
        )}

        {!ctx.hasSelection && onLine && (
          <button
            type="button"
            role="menuitem"
            className="sx-outline-menu-item is-danger"
            onClick={() => run(() => deleteTextElementAt(editor, ctx.textElementPos!))}
          >
            <DeleteIcon />
            Delete line
          </button>
        )}

        {!ctx.hasSelection && onNote && (
          <button
            type="button"
            role="menuitem"
            className="sx-outline-menu-item is-danger"
            onClick={() => run(() => deleteBlockAt(editor, ctx.notePos!))}
          >
            <DeleteIcon />
            Delete note
          </button>
        )}

        {!ctx.hasSelection && onPanel && (
          <button
            type="button"
            role="menuitem"
            className="sx-outline-menu-item is-danger"
            onClick={() => run(() => deleteBlockAt(editor, ctx.panelPos!))}
          >
            <DeleteIcon />
            Delete panel
          </button>
        )}
      </div>
    </Portal>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </svg>
  );
}
