import { Extension } from "@tiptap/core";
import { insertNodeAndFocus, insertTextElementInCurrentPanel } from "./commands";

// Anticipates the next likely element, the way Final Draft does: after a
// panel description, prompt for dialogue; after a dialogue/caption/sfx line,
// offer another line of the same kind (and same character, for consecutive
// lines); after a note, start the next panel.
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
            attrs: { kind: "dialogue", character: "", modifier: "" },
            content: [],
          });
          return true;
        }

        if (parentType === "textElement") {
          const { kind, character } = $from.parent.attrs as { kind: string; character: string };
          insertNodeAndFocus(editor, insertPos, {
            type: "textElement",
            attrs: { kind, character, modifier: "" },
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

      // Convenience: jump straight to a fresh dialogue line in the current
      // panel from anywhere inside it, without hunting for the end.
      "Mod-Enter": () => {
        insertTextElementInCurrentPanel(this.editor, "dialogue");
        return true;
      },
    };
  },
});
