import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

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
    editor.view.focus();
  } catch {
    // Rejected by the schema (e.g. would move a textElement before panelDescription).
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

// Deletes [from, to) and places the cursor at the nearest valid text position
// searching in `direction` from the deletion point — used for Backspace on an
// empty element, where "nearest valid position searching backward" is
// exactly "end of whatever came before it".
export function deleteRangeAndFocusNear(editor: Editor, from: number, to: number, direction: -1 | 1) {
  try {
    const tr = editor.state.tr.delete(from, to);
    const resolved = tr.doc.resolve(Math.max(0, Math.min(from, tr.doc.content.size)));
    tr.setSelection(TextSelection.near(resolved, direction));
    editor.view.dispatch(tr);
    editor.view.focus();
    return true;
  } catch {
    // Rejected by the schema (e.g. would leave the doc with zero pages).
    return false;
  }
}

export function insertPage(editor: Editor) {
  const endPos = editor.state.doc.content.size;
  insertNodeAndFocus(editor, endPos, {
    type: "page",
    content: [{ type: "panel", content: [{ type: "panelDescription" }] }],
  });
}

// "Double Enter" — pressing Enter on a dialogue/caption/SFX line that was left
// empty means "I'm done with this panel", so the empty line is removed and the
// next panel begins. Both edits go in one transaction so undo treats it as a
// single step and the insert position stays valid after the delete.
export function endPanelFromEmptyLine(editor: Editor, textElementPos: number, panelPos: number) {
  const { state } = editor;
  const textElementNode = state.doc.resolve(textElementPos).nodeAfter;
  const panelNode = state.doc.resolve(panelPos).nodeAfter;
  if (!textElementNode || !panelNode) return false;

  const removedSize = textElementNode.nodeSize;
  const insertAt = panelPos + panelNode.nodeSize - removedSize;

  try {
    const tr = state.tr.delete(textElementPos, textElementPos + removedSize);
    const newPanel = editor.schema.nodeFromJSON({
      type: "panel",
      content: [{ type: "panelDescription", content: [] }],
    });
    tr.insert(insertAt, newPanel);
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertAt + 1, tr.doc.content.size)), 1));
    editor.view.dispatch(tr);
    editor.view.focus();
    return true;
  } catch {
    return false;
  }
}
