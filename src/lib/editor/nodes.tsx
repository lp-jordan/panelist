import { useEffect, useRef } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { toPageWordNumber } from "./numberToWords";
import { pageIndexAt, panelCountInPage, panelNumberAt } from "./positions";
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

  return (
    <NodeViewWrapper className="sx-page">
      <div className="sx-page-heading" contentEditable={false}>
        {label}
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

function NoteView() {
  return (
    <NodeViewWrapper className="sx-note">
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
      <strong className="sx-panel-label" contentEditable={false}>
        Panel {panelNumber}:{" "}
      </strong>
      <NodeViewContent<"span"> className="sx-panel-body" as="span" />
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
//
// Character name is a single free-text field (e.g. "BONE" or "BONE (OFF)")
// rather than separate character/modifier inputs — one field the user just
// types into reads more like a document and less like a form. `modifier`
// stays in the data model (existing values still round-trip through
// save/load) but isn't exposed as its own control in this pass.

type TextElementKind = "dialogue" | "caption" | "sfx";

function focusEditorBodyAt(editor: NodeViewProps["editor"], pos: number) {
  editor.chain().focus().setTextSelection(pos + 1).run();
}

function TextElementView({ node, updateAttributes, getPos, editor }: NodeViewProps) {
  const { kind, character, autoFocusCharacter } = node.attrs as {
    kind: TextElementKind;
    character: string;
    autoFocusCharacter?: boolean;
  };
  const { ensureCastName } = useCastContext();
  const characterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusCharacter) {
      characterRef.current?.focus();
      updateAttributes({ autoFocusCharacter: false });
    }
    // Only run once, right after this node is created with the flag set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jumpToBody = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    // Blurring this input (about to happen as focus moves to the ProseMirror
    // body) fires onBlur -> updateAttributes -> a transaction that can race
    // with the selection change below. Committing the value here first and
    // deferring the focus move past that transaction avoids the race.
    const value = event.currentTarget.value.trim();
    updateAttributes({ character: value });
    if (value) ensureCastName(value);
    const pos = getPos();
    if (typeof pos === "number") {
      setTimeout(() => focusEditorBodyAt(editor, pos), 0);
    }
  };

  return (
    <NodeViewWrapper className={`sx-text-element sx-text-element-${kind}`}>
      <span className="sx-text-element-label" contentEditable={false}>
        {kind === "sfx" ? (
          "SFX"
        ) : (
          <input
            ref={characterRef}
            className="sx-inline-field"
            list={CAST_DATALIST_ID}
            placeholder={kind === "caption" ? "CAPTION" : "CHARACTER"}
            defaultValue={character}
            size={Math.max(character.length, kind === "caption" ? 7 : 9)}
            onBlur={(event) => {
              const value = event.target.value.trim();
              updateAttributes({ character: value });
              if (value) ensureCastName(value);
            }}
            onKeyDown={jumpToBody}
          />
        )}
        {kind === "caption" && character ? " (CAPTION)" : ""}
        {":"}
      </span>
      <NodeViewContent<"span"> className="sx-text-element-content" as="span" />
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
      autoFocusCharacter: { default: false, rendered: false },
    };
  },
  parseHTML: () => [{ tag: 'div[data-type="textElement"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "textElement" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(TextElementView);
  },
});

export const scriptNodes = [ScriptDocument, PageNode, NoteNode, PanelNode, PanelDescriptionNode, TextElementNode];
