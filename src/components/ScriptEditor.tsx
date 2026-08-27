"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { scriptNodes } from "@/lib/editor/nodes";
import { ScriptKeymap } from "@/lib/editor/keymap";
import { CastContext, CAST_DATALIST_ID } from "@/lib/editor/CastContext";
import { insertPage, insertPanelAfterCurrent, insertNoteAfterCurrent, insertTextElementInCurrentPanel } from "@/lib/editor/commands";
import type { JSONNode } from "@/lib/editor/serialize";
import { saveScriptContent, addCastMemberFromEditor } from "@/app/actions/editor";
import "./script-editor.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ScriptEditor({
  scriptId,
  projectId,
  initialDoc,
  initialCastNames,
}: {
  scriptId: string;
  projectId: string | null;
  initialDoc: JSONNode;
  initialCastNames: string[];
}) {
  const [castNames, setCastNames] = useState(initialCastNames);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const knownNames = useRef(new Set(initialCastNames.map((name) => name.toLowerCase())));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        document: false,
        paragraph: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        underline: false,
        strike: false,
        hardBreak: false,
        gapcursor: false,
        trailingNode: false,
      }),
      ...scriptNodes,
      ScriptKeymap,
    ],
    content: initialDoc,
    immediatelyRender: false,
  });

  const ensureCastName = (name: string) => {
    const key = name.toLowerCase();
    if (knownNames.current.has(key)) return;
    knownNames.current.add(key);
    setCastNames((prev) => [...prev, name]);
    if (projectId) {
      addCastMemberFromEditor(projectId, name).catch(() => {
        // Best-effort — the name still autocompletes for the rest of this
        // session even if the persist call fails.
      });
    }
  };

  const save = async () => {
    if (!editor) return;
    setStatus("saving");
    try {
      // Force a plain-JSON round trip before crossing the Server Action
      // boundary — Tiptap's getJSON() output tripped Next's "temporary
      // client reference" guard otherwise.
      const plainDoc = JSON.parse(JSON.stringify(editor.getJSON())) as JSONNode;
      await saveScriptContent(scriptId, plainDoc);
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      console.error("save failed", err);
      setStatus("error");
    }
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <CastContext.Provider value={{ castNames, ensureCastName }}>
      <datalist id={CAST_DATALIST_ID}>
        {castNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="sx-save-bar">
        <button type="button" onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save (Ctrl/Cmd+S)"}
        </button>
        {status === "saved" && <span style={{ color: "green" }}>Saved</span>}
        {status === "error" && <span style={{ color: "crimson" }}>Save failed — try again</span>}
      </div>

      <div className="sx-toolbar">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </button>
        <span style={{ width: "1px", background: "#ccc" }} />
        <button type="button" onClick={() => insertPage(editor)}>+ Page</button>
        <button type="button" onClick={() => insertPanelAfterCurrent(editor)}>+ Panel</button>
        <button type="button" onClick={() => insertNoteAfterCurrent(editor)}>+ Note</button>
        <button type="button" onClick={() => insertTextElementInCurrentPanel(editor, "dialogue")}>+ Dialogue</button>
        <button type="button" onClick={() => insertTextElementInCurrentPanel(editor, "caption")}>+ Caption</button>
        <button type="button" onClick={() => insertTextElementInCurrentPanel(editor, "sfx")}>+ SFX</button>
      </div>

      <EditorContent editor={editor} className="sx-editor" />
    </CastContext.Provider>
  );
}
