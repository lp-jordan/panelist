"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { toPageWordNumber } from "@/lib/editor/numberToWords";
import { insertPage, insertBlankPage, deletePageAt, movePage } from "@/lib/editor/commands";

// `index` is the top-level child index in the document (script and blank pages
// share the sequence). `pageNumber` is the 1-based number shown for script
// pages; blank pages carry null — they're skipped by numbering.
type PageEntry = {
  index: number;
  pos: number;
  kind: "page" | "freeform";
  pageNumber: number | null;
  panelCount: number;
};

// Reads the current list of pages straight from the document. Cheap enough to
// run on every transaction — a script is a handful of pages, not thousands.
function readPages(editor: Editor): PageEntry[] {
  const pages: PageEntry[] = [];
  let pageNumber = 0;
  editor.state.doc.forEach((node, offset, index) => {
    if (node.type.name === "page") {
      pageNumber++;
      let panelCount = 0;
      node.forEach((child) => {
        if (child.type.name === "panel") panelCount++;
      });
      pages.push({ index, pos: offset, kind: "page", pageNumber, panelCount });
    } else if (node.type.name === "freeformPage") {
      pages.push({ index, pos: offset, kind: "freeform", pageNumber: null, panelCount: 0 });
    }
  });
  return pages;
}

// Scrolls the window so as much of the page as possible is on screen: a page
// that fits below the sticky nav is centered in that space; a page taller than
// the screen is aligned just under the nav so it reads from the top. Beats
// scrollIntoView({block:"start"}), which always pins the top even when the whole
// page would have fit.
function framePageInView(el: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const navHeight = (document.querySelector(".nav") as HTMLElement | null)?.offsetHeight ?? 52;
  const gap = 12;
  const available = window.innerHeight - navHeight;
  const rect = el.getBoundingClientRect();
  const pageTop = window.scrollY + rect.top;

  const target =
    rect.height <= available - gap * 2
      ? pageTop - navHeight - (available - rect.height) / 2 // fits: center it
      : pageTop - navHeight - gap; // taller than the screen: top under the nav

  window.scrollTo({ top: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
}

// Which page the caret is currently in, by index — so the outline can mark it.
function activePageIndex(editor: Editor): number {
  const { from } = editor.state.selection;
  let active = 0;
  editor.state.doc.forEach((node, offset, index) => {
    if ((node.type.name === "page" || node.type.name === "freeformPage") && from >= offset) active = index;
  });
  return active;
}

/**
 * A sticky outline of the script's pages: jump to any page, see the active one,
 * and add a page without reaching for the keyboard shortcut. It reads the live
 * document, so it stays correct as pages are added, removed, or reordered.
 *
 * Desktop: a persistent left sidebar. Mobile: the same panel as a drawer that
 * slides in from the left (`open`), closing itself after a jump (`onNavigate`).
 */
export function PageOutline({
  editor,
  open = false,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  editor: Editor;
  open?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [pages, setPages] = useState<PageEntry[]>(() => readPages(editor));
  const [active, setActive] = useState(0);
  // Index being dragged, and the index its drop would land before/after.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Right-click menu: which page, and where to anchor the popover.
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  // Dismiss the context menu on any outside click or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    const sync = () => {
      setPages(readPages(editor));
      setActive(activePageIndex(editor));
    };
    sync();
    // `transaction` covers both content edits and selection moves.
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor]);

  const goTo = (pos: number) => {
    // Land the caret at the first real text position *inside* the page (its
    // panel description), not at `pos + 1` — that's the page-content boundary,
    // before the panel, where a keystroke gets reabsorbed into "Panel 1:".
    // TextSelection.near(bias +1) dives forward into the description; a plain
    // setTextSelection(pos + 1) would leave the caret stranded at the boundary.
    const { state, view } = editor;
    const target = Math.min(pos + 1, state.doc.content.size);
    const selection = TextSelection.near(state.doc.resolve(target), 1);
    // scrollIntoView is left off: framePageInView does the scrolling below.
    view.dispatch(state.tr.setSelection(selection));
    view.focus();

    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) framePageInView(dom);
    onNavigate?.();
  };

  const addPage = () => {
    insertPage(editor);
    // The new page is appended last; jump to it once the transaction lands.
    requestAnimationFrame(() => {
      const all = readPages(editor);
      const last = all[all.length - 1];
      if (last) goTo(last.pos);
    });
  };

  const addBlank = () => {
    insertBlankPage(editor);
    // Inserted after the current page (not necessarily last); frame whichever
    // page now holds the caret once the transaction lands.
    requestAnimationFrame(() => {
      const caret = editor.state.selection.from;
      const landed = [...readPages(editor)].reverse().find((p) => p.pos < caret);
      if (landed) goTo(landed.pos);
    });
  };

  const deletePage = (index: number) => {
    setMenu(null);
    const page = pages[index];
    if (!page) return;
    deletePageAt(editor, page.pos);
    // readPages re-syncs via the transaction listener.
  };

  // Commit a drag: `dragIndex` moves to sit where `dropIndex` points. Dropping
  // after its original slot shifts the target down by one, as with any splice.
  const endDrag = () => {
    if (dragIndex !== null && dropIndex !== null) {
      const to = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
      movePage(editor, dragIndex, to);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <aside className="sx-outline" data-open={open} data-collapsed={collapsed} aria-label="Pages">
      <div className="sx-outline-head">
        {/* Collapsed, the whole header is the expand target; expanded, only the
            chevron collapses. Hidden on mobile, where the drawer opens/closes
            through the nav button instead. */}
        <button
          type="button"
          className="sx-outline-collapse"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show pages" : "Collapse pages"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="sx-outline-title">Pages</span>
        <span className="sx-outline-count">{pages.length}</span>
      </div>
      <ol className="sx-outline-list" ref={listRef}>
        {pages.map((page, i) => (
          <li
            key={page.index}
            draggable
            data-dragging={dragIndex === i || undefined}
            data-drop-before={dropIndex === i && dragIndex !== null ? "true" : undefined}
            data-drop-after={
              dropIndex === i + 1 && dragIndex !== null && i === pages.length - 1
                ? "true"
                : undefined
            }
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
              // Firefox needs data set for a drag to start at all.
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const rect = e.currentTarget.getBoundingClientRect();
              const after = e.clientY - rect.top > rect.height / 2;
              setDropIndex(after ? i + 1 : i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              endDrag();
            }}
            onDragEnd={endDrag}
          >
            <button
              type="button"
              className="sx-outline-item"
              aria-current={page.index === active ? "true" : undefined}
              onClick={() => goTo(page.pos)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ index: i, x: e.clientX, y: e.clientY });
              }}
            >
              {page.kind === "freeform" ? (
                <>
                  <span className="sx-outline-num sx-outline-num-blank" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
                      <path d="M13 3v5h5" />
                    </svg>
                  </span>
                  <span className="sx-outline-label">
                    Blank page
                    <span className="sx-outline-sub">Freeform</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="sx-outline-num">{page.pageNumber}</span>
                  <span className="sx-outline-label">
                    {toPageWordNumber(page.pageNumber ?? 1)}
                    <span className="sx-outline-sub">
                      {page.panelCount} panel{page.panelCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </>
              )}
            </button>
          </li>
        ))}
      </ol>

      {menu && (
        <div
          className="sx-outline-menu"
          role="menu"
          style={{ top: menu.y, left: menu.x }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="sx-outline-menu-item is-danger"
            disabled={pages.length <= 1}
            onClick={() => deletePage(menu.index)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
            </svg>
            Delete page
          </button>
        </div>
      )}
      <button type="button" className="sx-outline-add" onClick={addPage}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New page
      </button>
      <button type="button" className="sx-outline-add sx-outline-add-blank" onClick={addBlank} title="Freeform page, skipped by numbering (Ctrl/Cmd+Shift+B)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
          <path d="M13 3v5h5" />
        </svg>
        Blank page
      </button>
    </aside>
  );
}
