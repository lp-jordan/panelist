import type { EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

// Position immediately before the nearest ancestor of `typeName` containing `pos`, or null.
export function findAncestorPos(state: EditorState, pos: number, typeName: string): number | null {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth >= 1; depth--) {
    if ($pos.node(depth).type.name === typeName) {
      return $pos.before(depth);
    }
  }
  return null;
}

export function findAncestorNode(state: EditorState, pos: number, typeName: string): PMNode | null {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth >= 1; depth--) {
    if ($pos.node(depth).type.name === typeName) {
      return $pos.node(depth);
    }
  }
  return null;
}

// 1-based panel number: how many `panel`-type siblings precede (and include)
// the panel starting at `panelPos`, within its parent `page`.
export function panelNumberAt(state: EditorState, panelPos: number): number {
  const $pos = state.doc.resolve(panelPos);
  const parent = $pos.parent;
  const index = $pos.index();
  let count = 0;
  for (let i = 0; i <= index && i < parent.childCount; i++) {
    if (parent.child(i).type.name === "panel") count++;
  }
  return count;
}

// 0-based index of the script page starting at `pagePos`, counting only
// `page` nodes — freeform (blank) pages sit at the top level too but are
// skipped by numbering, so they don't advance the page count.
export function pageIndexAt(state: EditorState, pagePos: number): number {
  const childIndex = state.doc.resolve(pagePos).index();
  let count = 0;
  for (let i = 0; i < childIndex; i++) {
    if (state.doc.child(i).type.name === "page") count++;
  }
  return count;
}

export function panelCountInPage(pageNode: PMNode): number {
  let count = 0;
  pageNode.forEach((child) => {
    if (child.type.name === "panel") count++;
  });
  return count;
}

// Given the position right before a node (as returned by findAncestorPos or
// getPos()), the position right after that whole node.
export function afterNodeAt(state: EditorState, beforePos: number): number {
  const node = state.doc.resolve(beforePos).nodeAfter;
  return node ? beforePos + node.nodeSize : beforePos;
}

// Given the position right before a node, the position right before its own
// closing token — i.e. the end of its content, for appending a last child.
export function contentEndOfNodeAt(state: EditorState, beforePos: number): number {
  const node = state.doc.resolve(beforePos).nodeAfter;
  return node ? beforePos + node.nodeSize - 1 : beforePos;
}
