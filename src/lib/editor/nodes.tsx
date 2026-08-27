import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { toPageWordNumber } from "./numberToWords";
import { pageIndexAt, panelCountInPage, panelNumberAt } from "./positions";
import { useCastContext } from "./CastContext";

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
  const { castNames, ensureCastName } = useCastContext();
  const characterRef = useRef<HTMLInputElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(character);
  const [fieldWidth, setFieldWidth] = useState<number>();
  // Set when an autocomplete suggestion is applied, so the suggested tail can
  // be selected after the value renders (typing then replaces it, as with any
  // type-ahead field).
  const pendingSelection = useRef<[number, number] | null>(null);

  const placeholder = kind === "caption" ? "CAPTION" : "CHARACTER";

  // Verdana is proportional, so the field can't be sized in `ch` units without
  // the colon drifting away from short names. Measuring a hidden copy of the
  // text gives an exact fit.
  useLayoutEffect(() => {
    if (sizerRef.current) setFieldWidth(sizerRef.current.offsetWidth + 1);
  }, [value, placeholder]);

  useLayoutEffect(() => {
    const input = characterRef.current;
    if (input && pendingSelection.current) {
      const [start, end] = pendingSelection.current;
      pendingSelection.current = null;
      input.setSelectionRange(start, end);
    }
  });

  useEffect(() => {
    if (autoFocusCharacter) {
      const input = characterRef.current;
      // select() so a name carried over from the previous line is replaced by
      // typing, but kept if the same character simply keeps talking.
      input?.focus();
      input?.select();
      updateAttributes({ autoFocusCharacter: false });
    }
    // Only run once, right after this node is created with the flag set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    updateAttributes({ character: trimmed });
    if (trimmed) ensureCastName(trimmed);
    return trimmed;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value;
    // Comparing lengths would misread "type over the selected prefilled name"
    // as a deletion — the value gets shorter — and suppress the suggestion on
    // the very first keystroke, which is exactly when it's most useful.
    const inputType = (event.nativeEvent as InputEvent).inputType;
    const isInserting =
      typeof inputType === "string" ? inputType.startsWith("insert") : typed.length > value.length;

    if (isInserting && typed.length > 0) {
      const match = castNames.find(
        (name) => name.toLowerCase().startsWith(typed.toLowerCase()) && name.length > typed.length,
      );
      if (match) {
        pendingSelection.current = [typed.length, match.length];
        setValue(match);
        return;
      }
    }
    setValue(typed);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.key !== "Tab" || event.shiftKey) && event.key !== "Enter") return;
    event.preventDefault();
    // Keep Tab/Enter from reaching the editor's own keymap, which would cycle
    // the line type or start a new line instead of moving into this one.
    event.stopPropagation();

    // Committing here rather than relying on the blur that's about to happen
    // avoids racing the attribute transaction against the selection change.
    commit(value);
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
          <span className="sx-name-field">
            <span className="sx-name-sizer" ref={sizerRef} aria-hidden="true">
              {value || placeholder}
            </span>
            <input
              ref={characterRef}
              className="sx-inline-field"
              placeholder={placeholder}
              value={value}
              style={fieldWidth ? { width: fieldWidth } : undefined}
              onChange={handleChange}
              onBlur={() => commit(value)}
              onKeyDown={handleKeyDown}
            />
          </span>
        )}
        {kind === "caption" && value ? " (CAPTION)" : ""}
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
