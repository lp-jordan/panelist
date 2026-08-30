import { Node, Extension, mergeAttributes, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { toPageWordNumber } from "./numberToWords";
import { pageIndexAt, panelCountInPage, panelNumberAt, findAncestorPos } from "./positions";
import { deleteRangeAndFocusNear, endPanelFromEmptyLine } from "./commands";

// These node views are plain DOM, not React. The panel/line labels ("Panel 1:",
// "SFX:") and the character-name field used to be React components, but deleting
// a line destroys its node view, and Tiptap tears React node views down on a
// microtask that races ProseMirror's synchronous DOM removal — which threw
// "removeChild … not a child" and killed the editor. With plain DOM, ProseMirror
// owns the whole lifecycle and there is no second renderer to race. Computed
// labels are recomputed on the editor's `update` event; the name field is a bare
// <input> whose value it owns outright.

// --- cast registry --------------------------------------------------------

// The character-name autocomplete needs the current cast list. React context is
// gone with the React node views, so the list (and the "remember this name"
// callback) live in editor storage, which ScriptEditor keeps in sync.
type CastStorage = { names: string[]; ensure: (name: string) => void };

export const CastRegistry = Extension.create({
  name: "castRegistry",
  addStorage(): CastStorage {
    return { names: [], ensure: () => {} };
  },
});

function castStorage(editor: Editor): CastStorage {
  return (editor.storage as unknown as { castRegistry: CastStorage }).castRegistry;
}

// Shared: ignore DOM mutations to a node view's chrome (computed labels, the
// name input) — only what happens inside `contentDOM` is the document's.
// (`Node` here is the DOM node, not Tiptap's — hence globalThis.Node.)
function ignoreOutside(contentDOM: HTMLElement) {
  return (mutation: MutationRecord | { type: "selection"; target: globalThis.Node }): boolean => {
    if (mutation.type === "selection") return false;
    // Anything inside the editable content is the document's — never ignore it.
    if (contentDOM.contains(mutation.target)) return false;
    // The browser sometimes removes (or re-inserts) the content element itself —
    // e.g. it prunes the empty <span> when the last character is deleted. That
    // mutation's target is the node-view root, not the content element, so the
    // plain containment check would treat it as chrome and ignore it, desyncing
    // the DOM from the document. Never ignore a mutation that adds or removes the
    // content element; let ProseMirror reconcile it.
    if (mutation.type === "childList") {
      for (const removed of mutation.removedNodes) if (removed === contentDOM) return false;
      for (const added of mutation.addedNodes) if (added === contentDOM) return false;
    }
    // Otherwise it's chrome (computed labels, the name input, NO COPY) — ignore.
    return true;
  };
}

// --- doc ------------------------------------------------------------------

export const ScriptDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "(page | freeformPage)+",
});

// --- freeform (blank) page ------------------------------------------------
//
// A plain document page: paragraphs with the standard bold/italic marks, no
// panel scaffolding and no computed heading. It's `isolating` like a script
// page (edits and selections stay within it), skipped by page numbering
// (see pageIndexAt), and never auto-paginated. Rare by design — a place to
// drop a cover blurb, a letter, an aside — so it has no node view chrome; the
// sheet look is pure CSS.

export const ParagraphNode = Node.create({
  name: "paragraph",
  content: "inline*",
  parseHTML: () => [{ tag: "p" }],
  renderHTML: ({ HTMLAttributes }) => ["p", mergeAttributes(HTMLAttributes, { class: "sx-para" }), 0],
});

export const FreeformPageNode = Node.create({
  name: "freeformPage",
  content: "paragraph+",
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="freeformPage"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "freeformPage", class: "sx-freeform-page" }),
    0,
  ],
});

// --- page -----------------------------------------------------------------

export const PageNode = Node.create({
  name: "page",
  content: "(note|panel)*",
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="page"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "page" }), 0],
  addNodeView() {
    return ({ editor, node, getPos }) => {
      let current = node as PMNode;

      const dom = document.createElement("div");
      dom.className = "sx-page";

      const heading = document.createElement("div");
      heading.className = "sx-page-heading";
      heading.contentEditable = "false";

      const body = document.createElement("div");
      body.className = "sx-page-body";

      dom.append(heading, body);

      const render = () => {
        const pos = typeof getPos === "function" ? getPos() : undefined;
        const pageIndex = typeof pos === "number" ? pageIndexAt(editor.state, pos) : 0;
        const panelCount = panelCountInPage(current);
        const headingText = `${toPageWordNumber(pageIndex + 1)} (${panelCount} Panel${panelCount === 1 ? "" : "s"})`;
        if (heading.textContent !== headingText) heading.textContent = headingText;
      };
      render();

      const onUpdate = () => render();
      editor.on("update", onUpdate);

      return {
        dom,
        contentDOM: body,
        update(updated) {
          if (updated.type.name !== "page") return false;
          current = updated;
          render();
          return true;
        },
        ignoreMutation: ignoreOutside(body),
        destroy() {
          editor.off("update", onUpdate);
        },
      };
    };
  },
});

// --- note -----------------------------------------------------------------

export const NoteNode = Node.create({
  name: "note",
  content: "inline*",
  parseHTML: () => [{ tag: 'div[data-type="note"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "note" }), 0],
  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.className = "sx-note";
      return { dom, contentDOM: dom };
    };
  },
});

// --- panel + panelDescription ---------------------------------------------

export const PanelNode = Node.create({
  name: "panel",
  content: "panelDescription textElement*",
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="panel"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "panel" }), 0],
  addNodeView() {
    return ({ editor, node, getPos }) => {
      let current = node as PMNode;

      const dom = document.createElement("div");
      dom.className = "sx-panel";

      const label = document.createElement("strong");
      label.className = "sx-panel-label";
      label.contentEditable = "false";

      // Panel description flows straight on from "Panel N:", so the body is a
      // span (inline) that also carries the block dialogue lines beneath it.
      const body = document.createElement("span");
      body.className = "sx-panel-body";

      dom.append(label, body);

      let noCopy: HTMLDivElement | null = null;

      const render = () => {
        const pos = typeof getPos === "function" ? getPos() : undefined;
        const panelNumber = typeof pos === "number" ? panelNumberAt(editor.state, pos) : 1;
        const labelText = `Panel ${panelNumber}: `;
        if (label.textContent !== labelText) label.textContent = labelText;

        // First child is always the panelDescription; more children means the
        // panel has dialogue/caption/etc. lines. Empty panels read "NO COPY".
        const hasLines = current.childCount > 1;
        if (!hasLines && !noCopy) {
          noCopy = document.createElement("div");
          noCopy.className = "sx-no-copy";
          noCopy.contentEditable = "false";
          noCopy.textContent = "NO COPY";
          dom.appendChild(noCopy);
        } else if (hasLines && noCopy) {
          noCopy.remove();
          noCopy = null;
        }
      };
      render();

      const onUpdate = () => render();
      editor.on("update", onUpdate);

      return {
        dom,
        contentDOM: body,
        update(updated) {
          if (updated.type.name !== "panel") return false;
          current = updated;
          render();
          return true;
        },
        ignoreMutation: ignoreOutside(body),
        destroy() {
          editor.off("update", onUpdate);
        },
      };
    };
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

// --- textElement (dialogue / sfx / narration / caption) -------------------
//
// Character name is a single free-text field (e.g. "BONE" or "BONE (OFF)")
// rather than separate character/modifier inputs — one field the user just
// types into reads more like a document and less like a form. `modifier`
// stays in the data model (existing values still round-trip through
// save/load) but isn't exposed as its own control in this pass.

type TextElementKind = "dialogue" | "caption" | "sfx" | "narration";

// Every kind but "dialogue" is a fixed label with no character name. "dialogue"
// is the one that shows the editable CHARACTER field.
const FIXED_LABEL: Record<Exclude<TextElementKind, "dialogue">, string> = {
  sfx: "SFX",
  narration: "NARRATION",
  caption: "CAPTION",
};

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
    return ({ editor, node, getPos }) => {
      let current = node as PMNode;
      const kind = current.attrs.kind as TextElementKind;

      const dom = document.createElement("div");
      dom.className = `sx-text-element sx-text-element-${kind}`;

      const label = document.createElement("span");
      label.className = "sx-text-element-label";
      label.contentEditable = "false";

      const content = document.createElement("span");
      content.className = "sx-text-element-content";

      let input: HTMLInputElement | null = null;
      let sizer: HTMLSpanElement | null = null;

      if (kind === "dialogue") {
        const field = document.createElement("span");
        field.className = "sx-name-field";

        sizer = document.createElement("span");
        sizer.className = "sx-name-sizer";
        sizer.setAttribute("aria-hidden", "true");

        input = document.createElement("input");
        input.className = "sx-inline-field";
        input.placeholder = "CHARACTER";
        input.value = (current.attrs.character as string) || "";

        field.append(sizer, input);
        label.append(field, document.createTextNode(":"));
      } else {
        label.append(document.createTextNode(`${FIXED_LABEL[kind]}:`));
      }

      dom.append(label, content);

      // Verdana is proportional, so the field can't be sized in `ch` units
      // without the colon drifting away from short names. A hidden copy of the
      // text is measured to get an exact fit.
      const resize = () => {
        if (!input || !sizer) return;
        // An empty field collapses to nothing — just the caret waiting before
        // the ":" — rather than reserving a character's worth of width for the
        // placeholder (which laid out as a lone clipped letter on new lines).
        if (input.value.length === 0) {
          sizer.textContent = "";
          input.style.width = "0px";
          return;
        }
        sizer.textContent = input.value;
        input.style.width = `${sizer.offsetWidth + 1}px`;
      };

      const commit = (raw: string) => {
        const trimmed = raw.trim();
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos === "number" && trimmed !== current.attrs.character) {
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, character: trimmed }),
          );
        }
        if (trimmed) castStorage(editor).ensure(trimmed);
      };

      if (input && sizer) {
        resize();

        input.addEventListener("input", (event) => {
          const inputType = (event as InputEvent).inputType;
          const isInserting = typeof inputType === "string" ? inputType.startsWith("insert") : true;
          const typed = input!.value;

          if (isInserting && typed.length > 0) {
            const match = castStorage(editor).names.find(
              (name) => name.toLowerCase().startsWith(typed.toLowerCase()) && name.length > typed.length,
            );
            if (match) {
              // Keep exactly what the user typed and append only the tail they
              // haven't, with that tail selected so the next keypress overwrites
              // it — preserving the user's casing (typing "Bone" against a
              // stored "BONE" stays "Bone").
              const completed = typed + match.slice(typed.length);
              input!.value = completed;
              input!.setSelectionRange(typed.length, completed.length);
              resize();
              return;
            }
          }
          resize();
        });

        input.addEventListener("blur", () => commit(input!.value));

        input.addEventListener("keydown", (event) => {
          // Backspace in an empty name field: the input swallows the key, so it
          // never reaches the editor's own Backspace handler — do the same
          // "delete the line / back out to the one above" here.
          if (event.key === "Backspace" && input!.value.length === 0) {
            const pos = typeof getPos === "function" ? getPos() : undefined;
            if (typeof pos !== "number") return;
            event.preventDefault();
            event.stopPropagation();
            if (current.content.size === 0) {
              deleteRangeAndFocusNear(editor, pos, pos + current.nodeSize, -1);
            } else {
              editor.chain().focus().setTextSelection(Math.max(0, pos - 1)).run();
            }
            return;
          }

          const isTab = event.key === "Tab" && !event.shiftKey;
          const isEnter = event.key === "Enter";
          if (!isTab && !isEnter) return;
          event.preventDefault();
          // Keep Tab/Enter from reaching the editor's keymap, which would cycle
          // the line type or start a new line instead of moving into this one.
          event.stopPropagation();
          const pos = typeof getPos === "function" ? getPos() : undefined;

          // Enter on a brand-new, empty dialogue line (no name typed, no dialogue
          // yet) means "done with this panel" — start the next panel, the same as
          // the double-Enter gesture from the body. Saves a keystroke: previously
          // you had to Enter into the body first and then Enter again.
          if (isEnter && input!.value.trim().length === 0 && current.content.size === 0 && typeof pos === "number") {
            const panelPos = findAncestorPos(editor.state, pos, "panel");
            if (panelPos != null) {
              endPanelFromEmptyLine(editor, pos, panelPos);
              return;
            }
          }

          commit(input!.value);
          if (typeof pos === "number") {
            setTimeout(() => editor.chain().focus().setTextSelection(pos + 1).run(), 0);
          }
        });

        // A name carried over from the previous line lands selected, so typing
        // replaces it but Tab keeps it — matching the old behaviour.
        if (current.attrs.autoFocusCharacter) {
          requestAnimationFrame(() => {
            if (!input || !input.isConnected) return;
            input.focus();
            input.select();
            const pos = typeof getPos === "function" ? getPos() : undefined;
            if (typeof pos === "number") {
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, autoFocusCharacter: false }),
              );
            }
          });
        }
      }

      return {
        dom,
        contentDOM: content,
        update(updated) {
          if (updated.type.name !== "textElement") return false;
          // A kind change (Tab cycling) swaps the whole label — let ProseMirror
          // rebuild the node view rather than mutating it in place.
          if (updated.attrs.kind !== current.attrs.kind) return false;
          current = updated;
          // Sync an externally-changed name into the field, but never while the
          // user is typing in it.
          if (input && document.activeElement !== input) {
            const next = (updated.attrs.character as string) || "";
            if (input.value !== next) {
              input.value = next;
              resize();
            }
          }
          return true;
        },
        // Events from the name input are the input's own — keep ProseMirror from
        // treating them as edits to the document.
        stopEvent: (event) => !!input && (event.target === input || input.contains(event.target as globalThis.Node)),
        ignoreMutation: ignoreOutside(content),
        destroy() {},
      };
    };
  },
});

export const scriptNodes = [
  ScriptDocument,
  ParagraphNode,
  FreeformPageNode,
  PageNode,
  NoteNode,
  PanelNode,
  PanelDescriptionNode,
  TextElementNode,
  CastRegistry,
];
