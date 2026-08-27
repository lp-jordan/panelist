import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { insertNodeAndFocus, insertPage, moveSibling, deleteRangeAndFocusNear, endPanelFromEmptyLine } from "./commands";
import { findAncestorPos } from "./positions";

const KIND_CYCLE = ["dialogue", "caption", "sfx"] as const;
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

        return false;
      },

      // Mirrors Google Docs' Ctrl/Cmd+Enter page break.
      "Mod-Enter": () => {
        insertPage(this.editor);
        return true;
      },

      // Cycle the current line's type instead of picking it from a dropdown.
      Tab: () => cycleKind(this.editor, 1) || true,
      "Shift-Tab": () => cycleKind(this.editor, -1) || true,

      Backspace: () => {
        const { editor } = this;
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parentOffset !== 0 || $from.parent.content.size > 0) return false;

        const parentType = $from.parent.type.name;

        if (parentType === "textElement" || parentType === "note") {
          const nodePos = $from.before($from.depth);
          return deleteRangeAndFocusNear(editor, nodePos, nodePos + $from.parent.nodeSize, -1);
        }

        if (parentType === "panelDescription") {
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

      "Alt-ArrowUp": () => moveCurrentBlock(this.editor, -1),
      "Alt-ArrowDown": () => moveCurrentBlock(this.editor, 1),
      "Alt-Shift-ArrowUp": () => moveCurrentPage(this.editor, -1),
      "Alt-Shift-ArrowDown": () => moveCurrentPage(this.editor, 1),
    };
  },
});

function cycleKind(editor: import("@tiptap/core").Editor, direction: 1 | -1): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== "textElement") return false;

  const nodePos = $from.before($from.depth);
  const node = $from.parent;
  const currentIndex = KIND_CYCLE.indexOf(node.attrs.kind as Kind);
  const nextKind = KIND_CYCLE[(currentIndex + direction + KIND_CYCLE.length) % KIND_CYCLE.length];

  const attrs: Record<string, unknown> = { ...node.attrs, kind: nextKind };
  if (nextKind === "sfx") {
    attrs.character = "";
    attrs.modifier = "";
  }

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
  const pos = findAncestorPos(editor.state, editor.state.selection.$from.pos, "page");
  if (pos == null) return true;
  moveSibling(editor, pos, direction);
  return true;
}
