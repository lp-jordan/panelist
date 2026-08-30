import { Extension } from "@tiptap/core";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import {
  insertNodeAndFocus,
  insertPage,
  insertBlankPage,
  insertPageNoteAtTop,
  extendBlockSelection,
  moveSibling,
  deleteRangeAndFocusNear,
  endPanelFromEmptyLine,
  mergeTextElementBackward,
} from "./commands";
import { findAncestorPos } from "./positions";

// Tab cycles a line through these in order. "dialogue" is the only one that
// carries a character name; the rest are fixed labels. Order matches how a
// writer reaches for them: a character speaking, then the effects around them.
export const KIND_CYCLE = ["dialogue", "sfx", "narration", "caption"] as const;
type Kind = (typeof KIND_CYCLE)[number];

function currentBlockPos(state: EditorState): number | null {
  const pos = state.selection.$from.pos;
  return findAncestorPos(state, pos, "panel") ?? findAncestorPos(state, pos, "note");
}

// This extension is what makes the editor feel like a plain document instead
// of a form: every key that would otherwise need a button (change this
// line's type, reorder it, delete it) is a keyboard shortcut instead, and
// Enter always anticipates what comes next the way Final Draft does.
export const ScriptKeymap = Extension.create({
  name: "scriptKeymap",

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        const parentType = $from.parent.type.name;
        const insertPos = $from.after();

        if (parentType === "panelDescription") {
          insertNodeAndFocus(editor, insertPos, {
            type: "textElement",
            attrs: { kind: "dialogue", character: "", modifier: "", autoFocusCharacter: true },
            content: [],
          });
          return true;
        }

        if (parentType === "textElement") {
          // Enter on a line left empty means "done with this panel" — drop the
          // empty line and start the next panel (the familiar double-Enter).
          if ($from.parent.content.size === 0) {
            const panelPos = findAncestorPos(state, $from.pos, "panel");
            if (panelPos != null) {
              return endPanelFromEmptyLine(editor, $from.before($from.depth), panelPos);
            }
          }

          // Carry the previous speaker over but land in the name field with it
          // selected, so the next line can be a different character without
          // reaching for the mouse — and stays the same one if you just Tab on.
          const { kind, character } = $from.parent.attrs as { kind: string; character: string };
          insertNodeAndFocus(editor, insertPos, {
            type: "textElement",
            attrs: { kind, character, modifier: "", autoFocusCharacter: true },
            content: [],
          });
          return true;
        }

        if (parentType === "note") {
          insertNodeAndFocus(editor, insertPos, {
            type: "panel",
            content: [{ type: "panelDescription", content: [] }],
          });
          return true;
        }

        // A freeform (blank) page is a plain document — Enter just splits the
        // paragraph like anywhere else, no script scaffolding.
        if (parentType === "paragraph") {
          return editor.commands.splitBlock();
        }

        return false;
      },

      // Mirrors Google Docs' Ctrl/Cmd+Enter page break.
      "Mod-Enter": () => {
        insertPage(this.editor);
        return true;
      },

      // Insert a freeform blank page after the current one.
      "Mod-Shift-b": () => {
        insertBlankPage(this.editor);
        return true;
      },

      // Add (or jump to) the page's NOTE — an italic aside to the artist that
      // sits at the top of the page, above the first panel.
      "Mod-Shift-n": () => insertPageNoteAtTop(this.editor),

      // Cycle the current line's type instead of picking it from a dropdown.
      Tab: () => cycleKind(this.editor, 1) || true,
      "Shift-Tab": () => cycleKind(this.editor, -1) || true,

      Backspace: () => {
        const { editor } = this;
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false; // a range selection is handled elsewhere

        const parentType = $from.parent.type.name;
        const lineIsEmpty = $from.parent.content.size === 0;

        // Freeform paragraphs edit like a normal document: native char delete
        // mid-line, join into the previous paragraph at the start. joinBackward
        // no-ops at the first paragraph (the page is isolating), so swallow the
        // key there rather than letting it escape the blank page.
        if (parentType === "paragraph") {
          if ($from.parentOffset === 0) return editor.commands.joinBackward() || true;
          return false;
        }

        if (parentType === "textElement") {
          const nodePos = $from.before($from.depth);
          if ($from.parentOffset > 0) {
            // Mid-line: delete the character before the caret ourselves instead
            // of letting the browser do it natively. When a native delete empties
            // the content span, the browser removes that <span> — and the node
            // view's ignoreMutation drops the removal, leaving the document out of
            // sync with a DOM that no longer has a content element. The next
            // keystroke then lands on the wrong line and splits off a phantom one.
            // Deleting through ProseMirror keeps the content span under its control.
            const tr = state.tr.delete($from.pos - 1, $from.pos);
            tr.setSelection(TextSelection.create(tr.doc, $from.pos - 1));
            editor.view.dispatch(tr);
            editor.view.focus();
            return true;
          }
          if (lineIsEmpty) {
            // Empty line → remove it and land at the end of the line above.
            return deleteRangeAndFocusNear(editor, nodePos, nodePos + $from.parent.nodeSize, -1);
          }
          // Written line, caret at its start: merge into the line above when
          // that's a compatible line, otherwise hold the caret here. (Never hop
          // it up into the description or another speaker's line.)
          return mergeTextElementBackward(editor, nodePos);
        }

        // Everything below only fires at the very start of a line.
        if ($from.parentOffset !== 0) return false;

        if (parentType === "note") {
          if (!lineIsEmpty) return false;
          const nodePos = $from.before($from.depth);
          return deleteRangeAndFocusNear(editor, nodePos, nodePos + $from.parent.nodeSize, -1);
        }

        if (parentType === "panelDescription") {
          if (!lineIsEmpty) return false;
          const panelPos = findAncestorPos(state, $from.pos, "panel");
          const pagePos = findAncestorPos(state, $from.pos, "page");
          if (panelPos == null || pagePos == null) return false;

          const panelNode = state.doc.resolve(panelPos).nodeAfter;
          const pageNode = state.doc.resolve(pagePos).nodeAfter;
          // Only remove the whole (empty) panel if it has no dialogue/caption/
          // SFX lines and isn't the page's only content — an empty page is
          // handled by Mod-Backspace instead, so there's always somewhere to type.
          if (!panelNode || panelNode.childCount > 1) return false;
          if (!pageNode || pageNode.childCount <= 1) return false;

          return deleteRangeAndFocusNear(editor, panelPos, panelPos + panelNode.nodeSize, -1);
        }

        return false;
      },

      // Deletes the panel (or note) the cursor is in, dialogue and all —
      // plain Backspace only clears lines that are already empty, which left
      // no way to remove a panel that still had text in it.
      "Mod-Backspace": () => {
        const { editor } = this;
        const { state } = editor;
        const blockPos = currentBlockPos(state);
        const pagePos = findAncestorPos(state, state.selection.$from.pos, "page");
        if (blockPos == null || pagePos == null) return false;

        const blockNode = state.doc.resolve(blockPos).nodeAfter;
        const pageNode = state.doc.resolve(pagePos).nodeAfter;
        if (!blockNode || !pageNode) return false;

        if (pageNode.childCount > 1) {
          return deleteRangeAndFocusNear(editor, blockPos, blockPos + blockNode.nodeSize, -1);
        }

        // It's the page's only content, so the page goes with it — unless
        // it's the last page, which would leave nowhere to type.
        if (state.doc.childCount <= 1) return false;
        return deleteRangeAndFocusNear(editor, pagePos, pagePos + pageNode.nodeSize, -1);
      },

      // Highlight whole panels across the isolating boundaries a plain
      // Shift+Arrow can't cross, so a run of (e.g. empty) panels can be selected
      // and deleted together instead of one Backspace at a time.
      "Mod-Shift-ArrowDown": () => extendBlockSelection(this.editor, 1),
      "Mod-Shift-ArrowUp": () => extendBlockSelection(this.editor, -1),

      "Alt-ArrowUp": () => moveCurrentBlock(this.editor, -1),
      "Alt-ArrowDown": () => moveCurrentBlock(this.editor, 1),
      "Alt-Shift-ArrowUp": () => moveCurrentPage(this.editor, -1),
      "Alt-Shift-ArrowDown": () => moveCurrentPage(this.editor, 1),
    };
  },
});

export function cycleKind(editor: import("@tiptap/core").Editor, direction: 1 | -1): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== "textElement") return false;

  const nodePos = $from.before($from.depth);
  const node = $from.parent;
  const currentIndex = KIND_CYCLE.indexOf(node.attrs.kind as Kind);
  const nextKind = KIND_CYCLE[(currentIndex + direction + KIND_CYCLE.length) % KIND_CYCLE.length];

  // Keep the character name in the attrs even while a non-dialogue label is
  // showing, so cycling back to "dialogue" restores it rather than losing it.
  const attrs: Record<string, unknown> = { ...node.attrs, kind: nextKind };

  editor.view.dispatch(state.tr.setNodeMarkup(nodePos, undefined, attrs));
  return true;
}

function moveCurrentBlock(editor: import("@tiptap/core").Editor, direction: -1 | 1): boolean {
  const pos = currentBlockPos(editor.state);
  if (pos == null) return true;
  moveSibling(editor, pos, direction);
  return true;
}

function moveCurrentPage(editor: import("@tiptap/core").Editor, direction: -1 | 1): boolean {
  const { state } = editor;
  const pos =
    findAncestorPos(state, state.selection.$from.pos, "page") ??
    findAncestorPos(state, state.selection.$from.pos, "freeformPage");
  if (pos == null) return true;
  moveSibling(editor, pos, direction);
  return true;
}
