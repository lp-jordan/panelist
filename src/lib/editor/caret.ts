import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

// The text-holding nodes. A collapsed caret that lands anywhere else — most
// visibly at the page level, just before a panel's "Panel N:" label — reads as
// a stray cursor floating outside the writing area. (It still redirects into
// text on the first keystroke, but the visual is confusing.)
const TEXTBLOCKS = new Set(["panelDescription", "textElement", "note", "paragraph"]);

/**
 * Keeps the caret inside the writing area. Certain edits and page re-flows can
 * leave a collapsed selection resting at a structural boundary (e.g. between two
 * isolating panels, where the parent is the `page`, not a text block). This
 * appends a transaction that moves such a caret to the start of the panel it's
 * sitting before — the panel's description, where the action text begins — so it
 * lands exactly where the next keystroke will go.
 */
export const CaretNormalizer = Extension.create({
  name: "caretNormalizer",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("caretNormalizer"),
        appendTransaction(_transactions, _oldState, newState) {
          const { selection } = newState;
          if (!(selection instanceof TextSelection) || !selection.empty) return null;

          const $pos = selection.$head;
          // Already inside a text block — nothing to fix.
          if (TEXTBLOCKS.has($pos.parent.type.name)) return null;

          // Prefer diving into the panel the caret sits before; fall back to the
          // one it sits after. Landing "before a panel" is the reported case.
          const after = $pos.nodeAfter;
          const before = $pos.nodeBefore;
          let target: number | null = null;
          if (after && after.type.name === "panel") {
            // pos → panel open (+1) → panelDescription open (+1) = its content.
            target = $pos.pos + 2;
          } else if (before && before.type.name === "panel") {
            // End of the previous panel's last text block.
            target = $pos.pos - 1;
          }
          if (target == null) return null;

          try {
            const $target = newState.doc.resolve(Math.max(0, Math.min(target, newState.doc.content.size)));
            const next = TextSelection.near($target, 1);
            // Only act if we actually reach a text block — never loop on a doc
            // that has no panel to dive into.
            if (!TEXTBLOCKS.has(next.$head.parent.type.name)) return null;
            return newState.tr.setSelection(next);
          } catch {
            return null;
          }
        },
      }),
    ];
  },
});
