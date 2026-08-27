import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, useEditorState, type NodeViewProps } from "@tiptap/react";
import { toPageWordNumber } from "./numberToWords";
import { pageIndexAt, panelCountInPage, panelNumberAt } from "./positions";
import { moveSibling, deleteNodeAt } from "./commands";
import { CAST_DATALIST_ID, useCastContext } from "./CastContext";

// --- doc ---------------------------------------------------------------

export const ScriptDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "page+",
});

// --- page ----------------------------------------------------------------

function PageView({ node, getPos, editor }: NodeViewProps) {
  const pos = getPos();
  const pageIndex = typeof pos === "number" ? pageIndexAt(editor.state, pos) : 0;
  const panelCount = panelCountInPage(node);
  const label = `${toPageWordNumber(pageIndex + 1)} (${panelCount} Panel${panelCount === 1 ? "" : "s"})`;

  // Deleting a page never shifts an unrelated earlier page's own position,
  // so trackNodeViewPosition alone won't re-render this view when a *later*
  // sibling page is removed — read the page count reactively instead so the
  // "last page" delete-guard doesn't go stale.
  const pageCount = useEditorState({
    editor,
    selector: ({ editor }) => editor?.state.doc.childCount ?? 1,
  });
  const isOnlyPage = pageCount <= 1;

  return (
    <NodeViewWrapper className="sx-page">
      <div className="sx-page-toolbar" contentEditable={false}>
        <strong className="sx-page-heading">{label}</strong>
        <span className="sx-controls">
          <button type="button" onClick={() => typeof pos === "number" && moveSibling(editor, pos, -1)}>
            ↑ Page
          </button>
          <button type="button" onClick={() => typeof pos === "number" && moveSibling(editor, pos, 1)}>
            ↓ Page
          </button>
          <button
            type="button"
            disabled={isOnlyPage}
            onClick={() => typeof pos === "number" && deleteNodeAt(editor, pos, node.nodeSize)}
          >
            Delete page
          </button>
        </span>
      </div>
      <NodeViewContent className="sx-page-body" />
    </NodeViewWrapper>
  );
}

export const PageNode = Node.create({
  name: "page",
  content: "(note|panel)*",
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="page"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "page" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(PageView, { trackNodeViewPosition: true });
  },
});

// --- note ------------------------------------------------------------------

function NoteView({ node, getPos, editor }: NodeViewProps) {
  const pos = getPos();
  return (
    <NodeViewWrapper className="sx-note">
      <div className="sx-note-controls" contentEditable={false}>
        <button type="button" onClick={() => typeof pos === "number" && moveSibling(editor, pos, -1)}>
          ↑
        </button>
        <button type="button" onClick={() => typeof pos === "number" && moveSibling(editor, pos, 1)}>
          ↓
        </button>
        <button type="button" onClick={() => typeof pos === "number" && deleteNodeAt(editor, pos, node.nodeSize)}>
          ✕
        </button>
      </div>
      <NodeViewContent className="sx-note-content" />
    </NodeViewWrapper>
  );
}

export const NoteNode = Node.create({
  name: "note",
  content: "inline*",
  parseHTML: () => [{ tag: 'div[data-type="note"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "note" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(NoteView);
  },
});

// --- panel + panelDescription ----------------------------------------------

function PanelView({ node, getPos, editor }: NodeViewProps) {
  const pos = getPos();
  const panelNumber = typeof pos === "number" ? panelNumberAt(editor.state, pos) : 1;
  const hasTextElements = node.childCount > 1; // first child is always panelDescription

  return (
    <NodeViewWrapper className="sx-panel">
      <div className="sx-panel-toolbar" contentEditable={false}>
        <button type="button" onClick={() => typeof pos === "number" && moveSibling(editor, pos, -1)}>
          ↑ Panel
        </button>
        <button type="button" onClick={() => typeof pos === "number" && moveSibling(editor, pos, 1)}>
          ↓ Panel
        </button>
        <button type="button" onClick={() => typeof pos === "number" && deleteNodeAt(editor, pos, node.nodeSize)}>
          Delete panel
        </button>
      </div>
      <div className="sx-panel-flow">
        <strong className="sx-panel-label" contentEditable={false}>
          Panel {panelNumber}:{" "}
        </strong>
        <NodeViewContent<"span"> className="sx-panel-body" as="span" />
      </div>
      {!hasTextElements && (
        <div className="sx-no-copy" contentEditable={false}>
          NO COPY
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const PanelNode = Node.create({
  name: "panel",
  content: "panelDescription textElement*",
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="panel"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "panel" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(PanelView, { trackNodeViewPosition: true });
  },
});

export const PanelDescriptionNode = Node.create({
  name: "panelDescription",
  content: "inline*",
  parseHTML: () => [{ tag: 'span[data-type="panelDescription"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, { "data-type": "panelDescription", class: "sx-panel-description" }),
    0,
  ],
});

// --- textElement (dialogue / caption / sfx) --------------------------------

type TextElementKind = "dialogue" | "caption" | "sfx";

function textElementLabel(kind: TextElementKind, character: string, modifier: string) {
  if (kind === "sfx") return "SFX:";
  if (kind === "caption") return character ? `${character.toUpperCase()} (CAPTION):` : "CAPTION:";
  const mod = modifier ? ` (${modifier.toUpperCase()})` : "";
  return `${character ? character.toUpperCase() : "…"}${mod}:`;
}

function TextElementView({ node, updateAttributes, getPos, editor }: NodeViewProps) {
  const { kind, character, modifier } = node.attrs as { kind: TextElementKind; character: string; modifier: string };
  const { ensureCastName } = useCastContext();
  const pos = getPos();
  const index = typeof pos === "number" ? editor.state.doc.resolve(pos).index() : 1;
  const canMoveUp = index > 1; // index 0 within panel is always panelDescription

  return (
    <NodeViewWrapper className={`sx-text-element sx-text-element-${kind}`}>
      <div className="sx-text-element-controls" contentEditable={false}>
        {kind !== "sfx" && (
          <input
            className="sx-character-input"
            list={CAST_DATALIST_ID}
            placeholder="Character"
            defaultValue={character}
            onBlur={(event) => {
              const value = event.target.value.trim();
              updateAttributes({ character: value });
              if (value) ensureCastName(value);
            }}
          />
        )}
        {kind === "dialogue" && (
          <input
            className="sx-modifier-input"
            placeholder="Modifier (OFF, O.S....)"
            defaultValue={modifier}
            onBlur={(event) => updateAttributes({ modifier: event.target.value.trim() })}
          />
        )}
        <select value={kind} onChange={(event) => updateAttributes({ kind: event.target.value })}>
          <option value="dialogue">Dialogue</option>
          <option value="caption">Caption</option>
          <option value="sfx">SFX</option>
        </select>
        <button type="button" disabled={!canMoveUp} onClick={() => typeof pos === "number" && moveSibling(editor, pos, -1)}>
          ↑
        </button>
        <button type="button" onClick={() => typeof pos === "number" && moveSibling(editor, pos, 1)}>
          ↓
        </button>
        <button type="button" onClick={() => typeof pos === "number" && deleteNodeAt(editor, pos, node.nodeSize)}>
          ✕
        </button>
      </div>
      <div className="sx-text-element-line">
        <strong className="sx-text-element-label" contentEditable={false}>
          {textElementLabel(kind, character, modifier)}{" "}
        </strong>
        <NodeViewContent<"span"> className="sx-text-element-content" as="span" />
      </div>
    </NodeViewWrapper>
  );
}

export const TextElementNode = Node.create({
  name: "textElement",
  content: "inline*",
  isolating: true,
  addAttributes() {
    return {
      kind: { default: "dialogue" },
      character: { default: "" },
      modifier: { default: "" },
    };
  },
  parseHTML: () => [{ tag: 'div[data-type="textElement"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "textElement" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(TextElementView);
  },
});

export const scriptNodes = [ScriptDocument, PageNode, NoteNode, PanelNode, PanelDescriptionNode, TextElementNode];
