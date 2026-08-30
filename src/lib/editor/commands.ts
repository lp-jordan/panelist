import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { AllSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { findAncestorPos } from "./positions";

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

// Backspace at the very start of a *written* line. A structured line can only
// truly merge into the one above when they're the same kind — joining a
// character's dialogue into the panel description, or into a different
// speaker's line, would corrupt the structure. So merge when the previous line
// is compatible (same kind, and same speaker for dialogue), and otherwise hold
// the caret exactly where it is. The earlier version hopped the caret up into
// the previous line instead, which read as "backspace skipped my cursor and
// left the text behind" — and the next keypress then ate that unrelated line.
export function mergeTextElementBackward(editor: Editor, nodePos: number): boolean {
  const { state } = editor;
  const $pos = state.doc.resolve(nodePos);
  const node = $pos.nodeAfter; // the current line
  const prev = $pos.nodeBefore; // the line above, if any
  if (!node) return true;

  const canMerge =
    prev != null &&
    prev.type.name === "textElement" &&
    prev.attrs.kind === node.attrs.kind &&
    (node.attrs.kind !== "dialogue" || prev.attrs.character === node.attrs.character);

  // Nothing safe to merge into: swallow the key so the caret stays put rather
  // than hopping into (and then deleting) the description or another speaker.
  if (!canMerge) return true;

  // Fold this line's content onto the end of the previous line and remove it.
  // `joinPos` sits inside the previous line, just before its closing token;
  // it's before the deleted range, so it stays valid after the delete.
  const joinPos = nodePos - 1;
  try {
    const tr = state.tr;
    tr.delete(nodePos, nodePos + node.nodeSize);
    tr.insert(joinPos, node.content);
    tr.setSelection(TextSelection.create(tr.doc, joinPos));
    editor.view.dispatch(tr);
    editor.view.focus();
    return true;
  } catch {
    // Rejected by the schema — still swallow, never fall through to a hop.
    return true;
  }
}

// Clears a selection that spans the computed page/panel labels — the "hold
// Delete to proceed" escape hatch from the editor's overwrite guard. The
// endpoints are rounded out to whole nodes first (via blockRange) so a
// half-selected auto-formatted line is removed in full rather than sliced,
// which would leave a malformed fragment. Returns true if anything was deleted.
export function deleteSelectionRoundedToNodes(view: EditorView): boolean {
  const { state } = view;
  const { selection, doc, schema } = state;

  // Select-All is the reachable way to span every page. Deleting literally
  // everything would leave the doc with zero pages, which the schema forbids,
  // so reset to a single empty page — a clean slate rather than a rejected edit.
  if (selection instanceof AllSelection) {
    try {
      const emptyPage = schema.nodeFromJSON({
        type: "page",
        content: [{ type: "panel", content: [{ type: "panelDescription" }] }],
      });
      const tr = state.tr.replaceWith(0, doc.content.size, emptyPage);
      tr.setSelection(TextSelection.near(tr.doc.resolve(1), 1));
      view.dispatch(tr.scrollIntoView());
      view.focus();
      return true;
    } catch {
      return false;
    }
  }

  // Otherwise round both ends out to whole sibling nodes at their shared depth
  // and delete the lot.
  const range = selection.$from.blockRange(selection.$to);
  const from = range ? range.start : selection.from;
  const to = range ? range.end : selection.to;
  try {
    const tr = state.tr.delete(from, to);
    const at = Math.max(0, Math.min(from, tr.doc.content.size));
    tr.setSelection(TextSelection.near(tr.doc.resolve(at), -1));
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
  } catch {
    // Rejected by the schema (e.g. would strip a panel's required description).
    return false;
  }
}

// Adds an empty panel right after the one the cursor is in (or at the end of
// the current page if the cursor isn't in a panel), landing the caret in its
// description. This is the button form of the "double-Enter starts a panel"
// gesture, for touch where that gesture is awkward.
export function insertPanelAfterCurrent(editor: Editor) {
  const { state } = editor;
  const panelPos = findAncestorPos(state, state.selection.$from.pos, "panel");
  const pagePos = findAncestorPos(state, state.selection.$from.pos, "page");

  let insertAt: number;
  if (panelPos != null) {
    const panelNode = state.doc.resolve(panelPos).nodeAfter;
    insertAt = panelNode ? panelPos + panelNode.nodeSize : state.doc.content.size;
  } else if (pagePos != null) {
    const pageNode = state.doc.resolve(pagePos).nodeAfter;
    insertAt = pageNode ? pagePos + pageNode.nodeSize - 1 : state.doc.content.size;
  } else {
    insertAt = state.doc.content.size;
  }

  insertNodeAndFocus(editor, insertAt, {
    type: "panel",
    content: [{ type: "panelDescription", content: [] }],
  });
}

// Removes the page whose node starts at `pagePos`. Refuses to delete the last
// remaining page — the schema requires at least one — returning false so the
// caller can leave the UI untouched. The caret lands near the deletion point.
export function deletePageAt(editor: Editor, pagePos: number): boolean {
  const { state } = editor;
  const node = state.doc.resolve(pagePos).nodeAfter;
  if (!node || (node.type.name !== "page" && node.type.name !== "freeformPage")) return false;

  // Never leave the document empty, and always keep at least one script page —
  // numbering, pagination and the page outline all assume one exists. A blank
  // page can be removed freely as long as something remains.
  if (state.doc.childCount <= 1) return false;
  if (node.type.name === "page") {
    let scriptPages = 0;
    state.doc.forEach((child) => {
      if (child.type.name === "page") scriptPages++;
    });
    if (scriptPages <= 1) return false;
  }

  try {
    const tr = state.tr.delete(pagePos, pagePos + node.nodeSize);
    const at = Math.max(0, Math.min(pagePos, tr.doc.content.size));
    tr.setSelection(TextSelection.near(tr.doc.resolve(at), -1));
    editor.view.dispatch(tr);
    editor.view.focus();
    return true;
  } catch {
    return false;
  }
}

// Reorders the top-level pages by moving the page at `fromIndex` to sit at
// `toIndex`, rebuilding the doc's page list in one transaction — mirrors
// moveSibling but operates on the document's own top-level children.
export function movePage(editor: Editor, fromIndex: number, toIndex: number) {
  const { state } = editor;
  // Reorder across every top-level sheet — script pages and freeform (blank)
  // pages alike — so the outline's drag-to-reorder keeps blank pages in place
  // rather than dropping them. The doc has no other top-level node types, so
  // the outline's array index lines up 1:1 with these.
  const pages: PMNode[] = [];
  state.doc.forEach((node) => {
    pages.push(node);
  });
  if (
    fromIndex < 0 ||
    fromIndex >= pages.length ||
    toIndex < 0 ||
    toIndex >= pages.length ||
    fromIndex === toIndex
  ) {
    return;
  }

  const [moved] = pages.splice(fromIndex, 1);
  pages.splice(toIndex, 0, moved);

  try {
    const tr = state.tr.replaceWith(0, state.doc.content.size, Fragment.fromArray(pages));
    editor.view.dispatch(tr);
    editor.view.focus();
  } catch {
    // Rejected by the schema — leave the document as it was.
  }
}

// Grows the selection by one whole sibling block (panel or note) in `dir`,
// keeping the anchor put. Panels are `isolating`, so a normal Shift+Arrow can't
// reach across them — this is how you highlight several (e.g. empty) panels at
// once to delete them together, rather than backspacing them one by one. The
// resulting multi-block selection is removed by the editor's existing
// hold-to-delete guard. Stays within the current page; returns true (swallowing
// the key) at a page edge so it never quietly does something else.
export function extendBlockSelection(editor: Editor, dir: 1 | -1): boolean {
  const { state } = editor;
  const sel = state.selection;
  const headBlockPos =
    findAncestorPos(state, sel.head, "panel") ?? findAncestorPos(state, sel.head, "note");
  if (headBlockPos == null) return false;

  const $block = state.doc.resolve(headBlockPos);
  const blockNode = $block.nodeAfter;
  if (!blockNode) return false;

  const targetStart = dir === 1 ? headBlockPos + blockNode.nodeSize : headBlockPos - ($block.nodeBefore?.nodeSize ?? 0);
  if (dir === -1 && !$block.nodeBefore) return true; // nothing above within the page

  const $target = state.doc.resolve(Math.max(0, Math.min(targetStart, state.doc.content.size)));
  const targetNode = $target.nodeAfter;
  // Only extend to a sibling block in the same page — never hop across pages.
  if (!targetNode || $target.parent !== $block.parent) return true;
  if (targetNode.type.name !== "panel" && targetNode.type.name !== "note") return true;

  try {
    const head = TextSelection.near(state.doc.resolve(targetStart + 1), dir);
    const selection = TextSelection.between(sel.$anchor, head.$head);
    editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
    editor.view.focus();
    return true;
  } catch {
    return false;
  }
}

// Inserts (or, if one is already there, jumps to) a NOTE at the very top of the
// current page — under the page heading, above the first panel. A note is an
// italic aside to the artist and only ever belongs at the head of the page, so
// this always targets page-content position 0 rather than the caret.
export function insertPageNoteAtTop(editor: Editor): boolean {
  const { state } = editor;
  const pagePos = findAncestorPos(state, state.selection.$from.pos, "page");
  if (pagePos == null) return false;
  const pageNode = state.doc.resolve(pagePos).nodeAfter;
  if (!pageNode) return false;

  // Page content opens one position inside the page node.
  const contentStart = pagePos + 1;

  // Already has a leading note — just put the caret in it.
  if (pageNode.firstChild && pageNode.firstChild.type.name === "note") {
    try {
      const sel = TextSelection.near(state.doc.resolve(contentStart + 1), 1);
      editor.view.dispatch(state.tr.setSelection(sel));
      editor.view.focus();
      return true;
    } catch {
      return false;
    }
  }

  insertNodeAndFocus(editor, contentStart, { type: "note", content: [] });
  return true;
}

export function insertPage(editor: Editor) {
  const endPos = editor.state.doc.content.size;
  insertNodeAndFocus(editor, endPos, {
    type: "page",
    content: [{ type: "panel", content: [{ type: "panelDescription" }] }],
  });
}

// Inserts a freeform (blank) document page right after the page the caret is in
// — a plain sheet of paragraphs, no panels, skipped by page numbering — and
// lands the caret in its first paragraph. Falls back to the end of the document
// when the caret isn't inside any page.
export function insertBlankPage(editor: Editor) {
  const { state } = editor;
  const currentPos =
    findAncestorPos(state, state.selection.$from.pos, "page") ??
    findAncestorPos(state, state.selection.$from.pos, "freeformPage");

  let insertAt = state.doc.content.size;
  if (currentPos != null) {
    const node = state.doc.resolve(currentPos).nodeAfter;
    if (node) insertAt = currentPos + node.nodeSize;
  }

  insertNodeAndFocus(editor, insertAt, {
    type: "freeformPage",
    content: [{ type: "paragraph", content: [] }],
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
