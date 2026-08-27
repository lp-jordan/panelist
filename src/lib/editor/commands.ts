import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { findAncestorPos, afterNodeAt, contentEndOfNodeAt } from "./positions";

// Swaps the node starting at `childPos` with its previous (-1) or next (+1)
// sibling by rebuilding the parent's content in one step — simpler and less
// error-prone than manually tracking position offsets across delete+insert.
export function moveSibling(editor: Editor, childPos: number, direction: -1 | 1) {
  try {
    const { state } = editor;
    const $pos = state.doc.resolve(childPos);
    const parent = $pos.parent;
    const index = $pos.index();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= parent.childCount) return;

    const children: PMNode[] = [];
    parent.forEach((child) => children.push(child));
    const [moved] = children.splice(index, 1);
    children.splice(targetIndex, 0, moved);

    const contentStart = $pos.start($pos.depth);
    const contentEnd = $pos.end($pos.depth);
    editor.view.dispatch(state.tr.replaceWith(contentStart, contentEnd, Fragment.fromArray(children)));
  } catch {
    // Rejected by the schema (e.g. would move a textElement before panelDescription).
  }
}

export function deleteNodeAt(editor: Editor, pos: number, nodeSize: number) {
  try {
    editor.view.dispatch(editor.state.tr.delete(pos, pos + nodeSize));
  } catch {
    // Rejected by the schema (e.g. would leave the doc with zero pages).
  }
}

// Inserts `nodeJSON` at `pos` and places the cursor at the nearest valid text
// position inside it — using TextSelection.near instead of hand-computed
// offsets means it correctly dives into nested empty content (e.g. a new
// panel's panelDescription) without position arithmetic that could throw.
export function insertNodeAndFocus(editor: Editor, pos: number, nodeJSON: Record<string, unknown>) {
  const node = editor.schema.nodeFromJSON(nodeJSON);
  const tr = editor.state.tr.insert(pos, node);
  const resolved = tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size));
  tr.setSelection(TextSelection.near(resolved, 1));
  editor.view.dispatch(tr);
  editor.view.focus();
}

const emptyTextElement = (kind: "dialogue" | "caption" | "sfx", character = "", modifier = "") => ({
  type: "textElement",
  attrs: { kind, character, modifier },
  content: [],
});

const emptyPanel = () => ({
  type: "panel",
  content: [{ type: "panelDescription", content: [] }],
});

export function insertPage(editor: Editor) {
  const endPos = editor.state.doc.content.size;
  insertNodeAndFocus(editor, endPos, { type: "page", content: [emptyPanel()] });
}

// Where to insert a new panel/note "after the current one": if the cursor is
// inside a panel or note, that block's own end; otherwise the end of the
// enclosing page (appended as its last child).
function currentPageBlockInsertPos(editor: Editor): number | null {
  const { state } = editor;
  const { $from } = state.selection;
  const pagePos = findAncestorPos(state, $from.pos, "page");
  if (pagePos == null) return null;

  const panelPos = findAncestorPos(state, $from.pos, "panel");
  const notePos = findAncestorPos(state, $from.pos, "note");
  const blockPos = panelPos ?? notePos;

  return blockPos != null ? afterNodeAt(state, blockPos) : contentEndOfNodeAt(state, pagePos);
}

export function insertPanelAfterCurrent(editor: Editor) {
  const insertAt = currentPageBlockInsertPos(editor);
  if (insertAt == null) return;
  insertNodeAndFocus(editor, insertAt, emptyPanel());
}

export function insertNoteAfterCurrent(editor: Editor) {
  const insertAt = currentPageBlockInsertPos(editor);
  if (insertAt == null) return;
  insertNodeAndFocus(editor, insertAt, { type: "note", content: [] });
}

export function insertTextElementInCurrentPanel(editor: Editor, kind: "dialogue" | "caption" | "sfx") {
  const { state } = editor;
  const panelPos = findAncestorPos(state, state.selection.$from.pos, "panel");
  if (panelPos == null) return;

  insertNodeAndFocus(editor, contentEndOfNodeAt(state, panelPos), emptyTextElement(kind));
}
