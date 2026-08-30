"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { cycleKind } from "@/lib/editor/keymap";
import { insertPage, insertPanelAfterCurrent } from "@/lib/editor/commands";

const KIND_LABEL: Record<string, string> = {
  dialogue: "Character",
  sfx: "SFX",
  narration: "Narration",
  caption: "Caption",
};

// Reads the kind of the line the caret is in, or null if it isn't in one.
function currentKind(editor: Editor): string | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name !== "textElement") return null;
  return ($from.parent.attrs.kind as string) ?? "dialogue";
}

/**
 * A touch toolbar for the actions that live on keys a phone keyboard doesn't
 * have: Tab (cycle line type) and Mod+Enter (new page). Shown only on coarse
 * pointers (see CSS). Enter and Backspace already exist on the soft keyboard,
 * so they aren't duplicated here.
 */
export function KeyboardToolbar({ editor }: { editor: Editor }) {
  const [kind, setKind] = useState<string | null>(() => currentKind(editor));

  useEffect(() => {
    const sync = () => setKind(currentKind(editor));
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor]);

  return (
    <div className="sx-kbtoolbar" role="toolbar" aria-label="Formatting">
      <button
        type="button"
        className="sx-kb-btn sx-kb-type" onMouseDown={(e) => e.preventDefault()}
        onClick={() => cycleKind(editor, 1)}
        disabled={kind === null}
        title="Change line type (Tab)"
      >
        <span className="sx-kb-type-label">{kind ? KIND_LABEL[kind] : "Line type"}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12h13M11 6l6 6-6 6M20 6v12" />
        </svg>
      </button>

      <span className="sx-kb-spacer" />

      <button type="button" className="sx-kb-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertPanelAfterCurrent(editor)} title="New panel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <path d="M12 9v6M9 12h6" />
        </svg>
        Panel
      </button>

      <button type="button" className="sx-kb-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertPage(editor)} title="New page">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4M12 11v6M9 14h6" />
        </svg>
        Page
      </button>
    </div>
  );
}
