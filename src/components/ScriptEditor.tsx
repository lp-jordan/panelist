"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AllSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { scriptNodes } from "@/lib/editor/nodes";
import { ScriptKeymap } from "@/lib/editor/keymap";
import { CaretNormalizer } from "@/lib/editor/caret";
import { AutoPaginate } from "@/lib/editor/pagination";
import { deleteSelectionRoundedToNodes } from "@/lib/editor/commands";
import { findAncestorPos } from "@/lib/editor/positions";
import type { JSONNode } from "@/lib/editor/serialize";
import { saveScriptContent, addCastMemberFromEditor, updateScriptMeta } from "@/app/actions/editor";
import { createAutoSnapshot } from "@/app/actions/snapshots";
import { HistorySheet } from "./HistorySheet";
import { ShortcutsSheet } from "./ShortcutsSheet";
import { TitlePageSheet, type TitlePageValues } from "./TitlePageSheet";
import { TitlePagePrint } from "./TitlePagePrint";
import { PageOutline } from "./PageOutline";
import { EditorContextMenu } from "./EditorContextMenu";
import { FormatSheet } from "./FormatSheet";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import "./script-editor.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// How long Delete must be held (pointer keyboards) before a section clears.
const HOLD_MS = 650;

// Automatic session checkpoints: at most one every few minutes of active
// editing (plus one when the tab is hidden/left with unsaved edits), so the
// history is a useful timeline rather than a checkpoint per keystroke. The
// server also drops a checkpoint whose content matches the previous one.
const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

// The guard toast has three faces: a hold-in-progress ring (desktop), a
// tap-through "Clear it" button (touch, and the fallback after a released
// hold), and the delete it eventually performs.
type GuardToast = { text: string; holding?: boolean; onConfirm?: () => void };

export function ScriptEditor({
  scriptId,
  projectId,
  projectName,
  title,
  author,
  draftLabel,
  draftDate,
  initialDoc,
  initialCastNames,
}: {
  scriptId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  author: string;
  draftLabel: string;
  draftDate: string;
  initialDoc: JSONNode;
  initialCastNames: string[];
}) {
  // Backing out lands on the script's project hub, not the Library, so you
  // return to where the script lives. Unassigned scripts still fall back home.
  const backHref = projectId ? `/projects/${projectId}` : "/";
  const backLabel = projectName ?? "Library";

  const [castNames, setCastNames] = useState(initialCastNames);
  // Title-page fields live here so an edit updates the nav title immediately,
  // without waiting on a server round trip / revalidation.
  const [meta, setMeta] = useState<TitlePageValues>({ title, author, draftLabel, draftDate });
  const [titlePageOpen, setTitlePageOpen] = useState(false);
  const saveMeta = (next: TitlePageValues) => {
    setMeta(next);
    updateScriptMeta(scriptId, next).catch((err) => console.error("meta save failed", err));
  };
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [scrolled, setScrolled] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  // The mobile actions sheet (Home 2).
  const [formatOpen, setFormatOpen] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  // Desktop-only: whether the floating page navigator is collapsed to a chip.
  // Read lazily from localStorage — the editor is client-only, so there's no
  // server render of this to mismatch.
  const [outlineCollapsed, setOutlineCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("sx-outline-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleOutlineCollapsed = () =>
    setOutlineCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("sx-outline-collapsed", next ? "1" : "0");
      } catch {
        // Non-persistent is fine — the panel still collapses for this session.
      }
      return next;
    });
  const knownNames = useRef(new Set(initialCastNames.map((name) => name.toLowerCase())));
  // Autosave bookkeeping: a debounce timer, a guard so two saves never overlap,
  // and a flag recording edits that arrive while a save is in flight.
  const autosaveTimer = useRef<number | undefined>(undefined);
  const savingRef = useRef(false);
  const dirtyDuringSave = useRef(false);
  // True while there are edits not yet written to the pages table. Drives the
  // sendBeacon flush on unload, so a name typed just before a reload isn't lost.
  const pendingSaveRef = useRef(false);
  // Version-history bookkeeping: whether the document changed since the last
  // checkpoint, and when that checkpoint was taken. Seeded to now so the first
  // checkpoint waits out the interval (or fires on tab-hide, whichever's first).
  const dirtySinceSnapshot = useRef(false);
  const lastSnapshotAt = useRef(Date.now());

  // The toast shown when a keystroke would land on the page's auto-formatting
  // rather than editable text.
  const [guardToast, setGuardToast] = useState<GuardToast | null>(null);
  const guardDismiss = useRef<number | undefined>(undefined);
  const holdTimer = useRef<number | undefined>(undefined);
  const holdingRef = useRef(false);
  // Set once a hold completes and the physical key is still down, so the
  // auto-repeat keydowns that follow don't fall through to plain deletion.
  const suppressRef = useRef(false);
  const guardView = useRef<EditorView | null>(null);

  // One controller behind a ref, wired up once, so the editor's key handlers
  // (also created once) always reach current logic. Everything it closes over
  // is a stable ref or setState, so there's no stale-closure risk.
  const guardRef = useRef<{
    blocked: () => void;
    beginHold: () => void;
    cancelHold: () => void;
    confirm: () => void;
  } | null>(null);
  useEffect(() => {
    const api = {
      // A blocked keystroke with no hold gesture (typing/Enter, or Delete on a
      // touch device): an explanatory toast the user can tap to break through.
      blocked() {
        window.clearTimeout(holdTimer.current);
        holdingRef.current = false;
        window.clearTimeout(guardDismiss.current);
        setGuardToast({
          text: "Selection contains auto-formatted content",
          onConfirm: () => api.confirm(),
        });
        guardDismiss.current = window.setTimeout(() => setGuardToast(null), 4000);
      },
      // Desktop hold begins: show the filling ring and complete after HOLD_MS.
      beginHold() {
        if (holdingRef.current) return; // ignore the auto-repeat keydowns
        holdingRef.current = true;
        window.clearTimeout(guardDismiss.current);
        setGuardToast({ text: "Hold to delete", holding: true });
        holdTimer.current = window.setTimeout(() => {
          suppressRef.current = true; // the key is still down as we delete
          api.confirm();
        }, HOLD_MS);
      },
      // Delete released before the ring filled — fall back to the tap toast.
      cancelHold() {
        if (!holdingRef.current) return;
        window.clearTimeout(holdTimer.current);
        holdingRef.current = false;
        api.blocked();
      },
      // Perform the rounded delete and clear the toast.
      confirm() {
        window.clearTimeout(holdTimer.current);
        window.clearTimeout(guardDismiss.current);
        holdingRef.current = false;
        const view = guardView.current;
        setGuardToast(null);
        if (view) deleteSelectionRoundedToNodes(view);
      },
    };
    guardRef.current = api;
    return () => {
      window.clearTimeout(guardDismiss.current);
      window.clearTimeout(holdTimer.current);
    };
  }, []);

  const editor = useEditor({
    editorProps: {
      // The page/panel/character labels aren't editable text — they're computed
      // from the document. Selecting and copying across them is fine, but an
      // edit over a selection that spans them (most reachably a Select-All)
      // would delete whole panels and pages — it wiped the sheet before this
      // guard existed. handleKeyDown runs before every edit and before the
      // ScriptKeymap, so it's the reliable place to catch it.
      handleKeyDown(view, event) {
        const isDeleteKey = event.key === "Backspace" || event.key === "Delete";
        // A hold that already fired keeps the key physically down; swallow its
        // auto-repeats until release so they don't delete past the section. Only
        // genuine auto-repeats (`event.repeat`) are swallowed — a fresh press
        // clears the flag, so a missed key-up can never permanently disable
        // Backspace/Delete.
        if (isDeleteKey && suppressRef.current) {
          if (event.repeat) {
            event.preventDefault();
            return true;
          }
          suppressRef.current = false;
        }

        const { selection } = view.state;
        if (selection.empty) return false; // a caret — normal editing and shortcuts

        // Ordinary selections can't cross a line/panel/page boundary (the nodes
        // are `isolating`); Select-All can, and it's the one that does damage.
        const spansFormatting =
          selection instanceof AllSelection || !selection.$from.sameParent(selection.$to);
        if (!spansFormatting) return false; // a selection within one line — fine to edit

        // A freeform (blank) page is a plain document with no computed labels to
        // protect, so a selection spanning its paragraphs is ordinary editing —
        // only guard when the selection actually reaches script pages.
        const fromFree = findAncestorPos(view.state, selection.from, "freeformPage");
        const toFree = findAncestorPos(view.state, selection.to, "freeformPage");
        if (fromFree != null && fromFree === toFree) return false;

        // Delete/Backspace is the deliberate "nuke this section" gesture. On a
        // pointer keyboard it's hold-to-confirm (a ring fills, then the section
        // clears, rounded out to whole nodes). Touch keyboards can't hold, so
        // there it's a tap-through toast instead.
        if (isDeleteKey) {
          event.preventDefault();
          guardView.current = view;
          const coarse =
            typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
          if (coarse) guardRef.current?.blocked();
          else guardRef.current?.beginHold();
          return true;
        }

        // Typing or Enter over such a selection can't be a hold gesture, so
        // block it and point at the tap-through toast.
        const overwrites =
          event.key === "Enter" ||
          (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey);
        if (!overwrites) return false; // arrows, shortcuts, Escape, etc. pass through

        event.preventDefault();
        guardView.current = view;
        guardRef.current?.blocked();
        return true;
      },
      // Paste from an external app (Google Docs, Word, a browser) arrives as
      // block HTML — paragraphs, divs, trailing empty blocks. The script schema
      // is rigid (page › panel › description/lines), so that block structure got
      // coerced into stray empty panels: the pasted action landed, then an empty
      // panel tagged "NO COPY" appeared beneath it. Sanitize external paste down
      // to clean inline text so it just drops into the current line. Internal
      // copy/paste (ProseMirror marks its own clipboard HTML with `data-pm-slice`)
      // is left untouched, so copying a whole panel still pastes as a panel.
      handlePaste(view, event) {
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (html.includes("data-pm-slice")) return false; // internal — keep structure

        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (!text.trim()) return false;

        // Collapse the block whitespace external editors carry (newlines between
        // paragraphs, indentation) into single spaces — action/dialogue is a
        // flowing line here, not a multi-paragraph document.
        const cleaned = text.replace(/\s+/g, " ").trim();
        event.preventDefault();
        view.dispatch(view.state.tr.insertText(cleaned).scrollIntoView());
        return true;
      },
      handleDOMEvents: {
        // Releasing Delete/Backspace ends a hold: if the ring hadn't filled yet
        // it falls back to the tap toast, and it clears the post-delete suppress.
        keyup(_view, event) {
          if (event.key === "Backspace" || event.key === "Delete") {
            suppressRef.current = false;
            guardRef.current?.cancelHold();
          }
          return false;
        },
      },
    },
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
      CaretNormalizer,
      AutoPaginate,
    ],
    content: initialDoc,
    immediatelyRender: false,
    onFocus: () => setEditorFocused(true),
    onBlur: () => setEditorFocused(false),
  });

  const ensureCastName = useCallback(
    (name: string) => {
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
    },
    [projectId],
  );

  // The plain-DOM node views read the cast list and the "remember this name"
  // callback from editor storage (there's no React context to reach into), so
  // keep that storage current as the cast grows.
  useEffect(() => {
    if (!editor) return;
    const cast = (editor.storage as { castRegistry?: { names: string[]; ensure: (name: string) => void } })
      .castRegistry;
    if (!cast) return;
    // Tiptap's editor.storage is intended to be mutated in place; the compiler's
    // immutability check doesn't know that.
    // eslint-disable-next-line react-hooks/immutability
    cast.names = castNames;
    cast.ensure = ensureCastName;
  }, [editor, castNames, ensureCastName]);

  const save = useCallback(async () => {
    if (!editor) return;
    // Never overlap saves — if one is running, note that more was typed and let
    // the finishing save start another. Keeps requests ordered and the pill honest.
    if (savingRef.current) {
      dirtyDuringSave.current = true;
      return;
    }
    savingRef.current = true;
    setStatus("saving");
    try {
      // Force a plain-JSON round trip before crossing the Server Action
      // boundary — Tiptap's getJSON() output tripped Next's "temporary
      // client reference" guard otherwise.
      const plainDoc = JSON.parse(JSON.stringify(editor.getJSON())) as JSONNode;
      // Cleared before the await: this doc is now being persisted, and any edit
      // that lands during the await flips it back on via onUpdate (and
      // dirtyDuringSave re-runs the save).
      pendingSaveRef.current = false;
      await saveScriptContent(scriptId, plainDoc);
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      console.error("save failed", err);
      setStatus("error");
    } finally {
      savingRef.current = false;
      if (dirtyDuringSave.current) {
        dirtyDuringSave.current = false;
        // Via a ref so this callback doesn't reference itself (which the React
        // Compiler can't memoize) — flush the edits that landed mid-save.
        saveRef.current();
      }
    }
  }, [editor, scriptId]);

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Save straight away, cancelling any pending debounce — for ⌘S, the toolbar
  // button, and blurring out of the editor.
  const saveNow = useCallback(() => {
    window.clearTimeout(autosaveTimer.current);
    save();
  }, [save]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  // Autosave: a content edit schedules a save ~1s after typing stops (the way a
  // cloud doc does), and blurring the editor flushes it right away. Manual ⌘S
  // still works and just pre-empts the timer.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      dirtySinceSnapshot.current = true;
      pendingSaveRef.current = true;
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(save, 1000);
    };
    const onBlur = () => {
      if (autosaveTimer.current !== undefined) saveNow();
    };
    editor.on("update", onUpdate);
    editor.on("blur", onBlur);
    return () => {
      editor.off("update", onUpdate);
      editor.off("blur", onBlur);
      window.clearTimeout(autosaveTimer.current);
    };
  }, [editor, save, saveNow]);

  // The current editor state as the snapshot envelope expects it. Kept behind a
  // ref so the interval/visibility listeners below don't re-bind on every edit.
  const getLiveState = useCallback(() => {
    const doc = editor
      ? (JSON.parse(JSON.stringify(editor.getJSON())) as JSONNode)
      : ({ type: "doc", content: [] } as JSONNode);
    return { doc, meta };
  }, [editor, meta]);
  const liveStateRef = useRef(getLiveState);
  useEffect(() => {
    liveStateRef.current = getLiveState;
  }, [getLiveState]);

  // Write an automatic checkpoint if the doc has changed since the last one and
  // enough time has passed (or `force`, on tab-hide). Fire-and-forget: a failed
  // checkpoint must never interrupt writing, and autosave is the real safety net.
  const maybeAutoSnapshot = useCallback(
    (force: boolean) => {
      if (!dirtySinceSnapshot.current) return;
      if (!force && Date.now() - lastSnapshotAt.current < AUTO_SNAPSHOT_INTERVAL_MS) return;
      const { doc, meta: liveMeta } = liveStateRef.current();
      dirtySinceSnapshot.current = false;
      lastSnapshotAt.current = Date.now();
      createAutoSnapshot(scriptId, doc, liveMeta).catch((err) => console.error("auto snapshot failed", err));
    },
    [scriptId],
  );

  useEffect(() => {
    const id = window.setInterval(() => maybeAutoSnapshot(false), 60_000);
    // Leaving or backgrounding the tab ends the session — durably flush any
    // unsaved edits and checkpoint, regardless of the debounce/interval.
    const flush = () => {
      // A beacon completes during unload where the autosave fetch would be
      // cancelled — this is what saves a name typed just before a reload.
      if (pendingSaveRef.current && editor) {
        try {
          const blob = new Blob([JSON.stringify(editor.getJSON())], { type: "application/json" });
          if (navigator.sendBeacon(`/api/scripts/${scriptId}/save`, blob)) {
            pendingSaveRef.current = false;
          }
        } catch {
          // Ignore — the snapshot below is still taken as a fallback.
        }
      }
      maybeAutoSnapshot(true);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, [maybeAutoSnapshot, editor, scriptId]);

  // The nav bar only earns its hairline once there is content behind it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // How far the software keyboard overlaps the bottom of the layout viewport.
  // On iOS Safari a `position: fixed; bottom: 0` element is NOT pushed above the
  // keyboard — the keyboard overlays it — so the touch toolbar was rendering
  // hidden behind the keyboard. visualViewport shrinks when the keyboard opens;
  // the difference from window.innerHeight is the keyboard's height, which we
  // apply as the toolbar's bottom offset so it rides just above the keys.
  const [keyboardInset, setKeyboardInset] = useState(0);
  const recomputeInset = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Coalesce the flurry of resize/scroll events iOS fires while it scrolls the
    // caret into view into a single per-frame update. Reading them raw made the
    // toolbar jump around as the offset settled; one rAF-batched read per frame
    // keeps it steady.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        recomputeInset();
      });
    };
    recomputeInset();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
    };
  }, [recomputeInset]);

  // When the editor gains focus the keyboard animates in, but iOS often doesn't
  // fire a visualViewport event until the user scrolls — which is why the bar
  // used to stay hidden until a "fake" scroll nudged it up. Re-measure across
  // the keyboard's open animation so it lands in place on its own. (On blur the
  // single trailing read settles it back to 0.)
  useEffect(() => {
    recomputeInset();
    if (!editorFocused) return;
    const timers = [120, 280, 480, 700].map((ms) => window.setTimeout(recomputeInset, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [editorFocused, recomputeInset]);

  // The editor is client-only (immediatelyRender: false), so it's null for a
  // beat after mount — and stays null if Tiptap fails to initialise. Render the
  // frame plus a loading state rather than nothing, so a slow or broken mount
  // is never an unexplained blank screen.
  if (!editor) {
    return (
      <div className="sx-shell">
        <nav className="nav">
          <Link href={backHref} className="nav-back" aria-label={backLabel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <span className="nav-back-label">{backLabel}</span>
          </Link>
          <span className="nav-spacer" />
          <span className="nav-title">{meta.title}</span>
          <span className="nav-spacer" />
        </nav>
        <div className="sx-loading">
          <span className="sx-spinner" aria-hidden="true" />
          Loading editor…
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sx-shell">
        <nav className="nav" data-scrolled={scrolled}>
          <Link href={backHref} className="nav-back" aria-label={backLabel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <span className="nav-back-label">{backLabel}</span>
          </Link>
          {/* Opens the page outline as a left drawer; only shown where the
              persistent sidebar isn't (phones/tablets). */}
          <button
            type="button"
            className="icon-btn nav-pages-btn"
            onClick={() => setOutlineOpen(true)}
            aria-label="Pages"
            aria-expanded={outlineOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="nav-spacer" />
          <span className="nav-title">{meta.title}</span>
          <span className="nav-spacer" />
          <SavePill status={status} />
          {/* Desktop-only in the bar; on phones the appearance choice moves into
              the actions sheet's Appearance section. */}
          <span className="nav-theme">
            <ThemeToggle />
          </span>

          {/* The secondary actions. Inline on desktop; on phones they'd overrun
              the bar and get clipped off-screen, so there they collapse into the
              single actions sheet (see .nav-actions in the CSS). */}
          <span className="nav-actions-inline">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setHistoryOpen(true)}
              title="Version history"
              aria-label="Version history"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 106 5.3L3 8" />
                <path d="M12 7v5l4 2" />
              </svg>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTitlePageOpen(true)}
              title="Title page"
              aria-label="Title page"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M9 8h6M10 12h4" />
              </svg>
            </button>
            {/* Export to PDF is the browser's print-to-PDF against a print
                stylesheet, so the exported sheets match the editor exactly.
                Save first so the print reflects the latest edits. */}
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                saveNow();
                window.print();
              }}
              title="Export PDF"
              aria-label="Export PDF"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-3a2 2 0 012-2h16a2 2 0 012 2v3a2 2 0 01-2 2h-2" />
                <path d="M6 14h12v7H6z" />
              </svg>
            </button>
            <button type="button" className="icon-btn" onClick={saveNow} title="Save (Ctrl/Cmd+S)" aria-label="Save">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <path d="M17 21v-8H7v8M7 3v5h8" />
              </svg>
            </button>
          </span>

          {/* Phones: one button that opens the actions sheet (Home 2). Hidden on
              desktop, where the actions sit inline above. */}
          <button
            type="button"
            className="icon-btn nav-actions-menu"
            onClick={() => setFormatOpen(true)}
            aria-label="Actions"
            aria-haspopup="dialog"
            aria-expanded={formatOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 8h11M5 8a2 2 0 104 0 2 2 0 10-4 0M8 16h11M19 16a2 2 0 10-4 0 2 2 0 104 0" />
            </svg>
          </button>
        </nav>

        <div className="sx-body">
          {/* Backs the mobile drawer; inert on desktop where the outline is a
              persistent sidebar. */}
          <div className="sx-outline-scrim" data-open={outlineOpen} onClick={() => setOutlineOpen(false)} />
          <PageOutline
            editor={editor}
            open={outlineOpen}
            onNavigate={() => setOutlineOpen(false)}
            collapsed={outlineCollapsed}
            onToggleCollapse={toggleOutlineCollapsed}
          />

          <div className="sx-canvas">
            {/* Print-only: the cover sheet that leads the exported PDF. Hidden
                on screen (edited via the title-page dialog instead). */}
            <TitlePagePrint {...meta} />
            <EditorContent editor={editor} className="sx-editor" />
            <EditorContextMenu editor={editor} />

            <div className="sx-hints">
              <span>
                <kbd>&crarr;</kbd> next line
              </span>
              <span>
                <kbd>&crarr;&crarr;</kbd> next panel
              </span>
              <span>
                <kbd>&#8677;</kbd> change type
              </span>
              <button type="button" className="btn-plain" style={{ fontSize: "var(--text-fine)", padding: "3px 8px" }} onClick={() => setShortcutsOpen(true)}>
                All shortcuts
              </button>
            </div>
          </div>
        </div>
      </div>

      <FormatSheet
        editor={editor}
        open={formatOpen}
        onClose={() => setFormatOpen(false)}
        onSave={saveNow}
        onExport={() => {
          saveNow();
          window.print();
        }}
        onTitlePage={() => setTitlePageOpen(true)}
        onHistory={() => setHistoryOpen(true)}
      />

      <div
        className="sx-hint-toast"
        // When the keyboard is up, ride above it so the tap-through "Clear it"
        // button stays reachable.
        style={keyboardInset > 0 ? { bottom: `${keyboardInset + 12}px` } : undefined}
        data-show={guardToast !== null}
        data-holding={guardToast?.holding || undefined}
        role="status"
        aria-live="polite"
      >
        {guardToast?.holding ? (
          <svg
            className="sx-hold-ring"
            viewBox="0 0 20 20"
            style={{ "--sx-hold-ms": `${HOLD_MS}ms` } as CSSProperties}
            aria-hidden="true"
          >
            <circle className="sx-hold-ring-track" cx="10" cy="10" r="8" fill="none" strokeWidth="2.4" />
            <circle className="sx-hold-ring-fill" cx="10" cy="10" r="8" fill="none" strokeWidth="2.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
        )}
        <span className="sx-hint-text">{guardToast?.text}</span>
        {guardToast?.onConfirm && (
          <button type="button" className="sx-hint-action" onClick={() => guardRef.current?.confirm()}>
            Clear it
          </button>
        )}
      </div>

      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <HistorySheet
        scriptId={scriptId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        getLiveState={getLiveState}
      />

      <TitlePageSheet
        open={titlePageOpen}
        values={meta}
        onClose={() => setTitlePageOpen(false)}
        onSave={saveMeta}
      />
    </>
  );
}

function SavePill({ status }: { status: SaveStatus }) {
  return (
    <span className="sx-save-pill" data-state={status} role="status" aria-live="polite">
      {status === "saving" && (
        <>
          <span className="sx-spinner" aria-hidden="true" />
          Saving
        </>
      )}
      {status === "saved" && (
        <>
          <svg className="sx-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12.5l5.5 5.5L20 6.5" />
          </svg>
          Saved
        </>
      )}
      {status === "error" && "Couldn’t save — ⌘S to retry"}
    </span>
  );
}
