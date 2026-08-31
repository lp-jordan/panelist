import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

// Auto-pagination: keep every page a physical sheet by spilling content that
// overflows one sheet onto the next page (creating pages as needed), and
// pulling content back up when a deletion leaves room — so pages fill and empty
// like a real document instead of the sheet stretching past 11in.
//
// The reflow is measurement-based (a sheet's true rendered height only exists at
// runtime), so it runs from the plugin's `view.update`, one structural move per
// pass. Each move strictly reduces the imbalance, and a re-entrancy guard means
// the worst case is "doesn't paginate", never a hang.

const paginationKey = new PluginKey("autoPaginate");

// A move the plugin decides to make, resolved against the current document.
type Move =
  | { kind: "push"; panelPos: number; panelSize: number; pageEnd: number; nextPageContentStart: number | null }
  | { kind: "pull"; panelPos: number; panelSize: number; intoPageContentEnd: number }
  | { kind: "dropEmptyPage"; pagePos: number; pageSize: number };

// Small slack so sub-pixel rounding doesn't read as overflow.
const EPSILON = 2;

// Keep content from packing to the very bottom edge of the sheet. Without this,
// a page filled to its full usable height (padding + content == exactly one
// physical sheet) plus the print stylesheet's forced page-break-after tips the
// last line onto a second, blank physical page — the "PDF saves strangely"
// symptom. Reserving a little bottom margin means the printed box stays just
// under a full page, so each sheet breaks cleanly to the next. Roughly a
// quarter inch at 96dpi.
const BOTTOM_SAFETY = 24;

// Pull-back is deliberately more cautious than push-down: a panel's block margins
// aren't in its offsetHeight, so pulling one up that "just fits" could tip the
// page back into overflow and ping-pong. Requiring this much clear room first
// biases toward a little trailing whitespace instead of an oscillation.
const PULL_SLACK = 22;

// How much content a sheet can hold and how much it currently holds, both in CSS
// px. `usable` is the content box (min-height minus vertical padding), read from
// computed style so it tracks zoom/DPI. `content` is the real rendered height of
// the heading + body, measured by rects — NOT offsetHeight, which the sheet's
// own min-height would pin to a full sheet even when nearly empty. `usable <= 0`
// means the fluid phone layout, which the caller leaves un-paginated.
function measurePage(pageEl: HTMLElement): { usable: number; content: number } {
  const style = getComputedStyle(pageEl);
  const minHeight = parseFloat(style.minHeight) || 0;
  const padTop = parseFloat(style.paddingTop) || 0;
  const padBottom = parseFloat(style.paddingBottom) || 0;
  const usable = minHeight - padTop - padBottom;

  const pageRect = pageEl.getBoundingClientRect();
  const contentTop = pageRect.top + padTop;
  const heading = pageEl.querySelector<HTMLElement>(".sx-page-heading");
  const body = pageEl.querySelector<HTMLElement>(".sx-page-body");
  const lastChild = body?.lastElementChild ?? null;
  const bottoms = [
    heading ? heading.getBoundingClientRect().bottom : contentTop,
    lastChild ? lastChild.getBoundingClientRect().bottom : contentTop,
  ];
  const content = Math.max(...bottoms) - contentTop;
  return { usable, content };
}

function decideMove(view: EditorView): Move | null {
  const { state } = view;
  const pageEls: HTMLElement[] = [];
  state.doc.forEach((node, offset) => {
    if (node.type.name !== "page") return;
    const dom = view.nodeDOM(offset);
    if (dom instanceof HTMLElement) pageEls.push(dom);
  });
  if (pageEls.length === 0) return null;

  const firstMetrics = measurePage(pageEls[0]);
  if (firstMetrics.usable < 200) return null; // fluid/phone layout — leave pages alone

  // Walk the pages with their document positions.
  const pages: { node: PMNode; pos: number; el: HTMLElement }[] = [];
  let i = 0;
  state.doc.forEach((node, offset) => {
    if (node.type.name === "page") {
      pages.push({ node, pos: offset, el: pageEls[i] });
      i++;
    }
  });

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const { usable, content } = measurePage(page.el);
    // Target height is the usable box minus the bottom-safety reserve, so pages
    // fill to just short of the sheet's edge rather than flush against it.
    const target = usable - BOTTOM_SAFETY;
    const overflowing = content > target + EPSILON;

    if (overflowing) {
      // Move this page's LAST panel down. Keep at least one block on the page so
      // a single over-tall panel doesn't ping-pong into an empty page forever.
      const panels: { node: PMNode; pos: number }[] = [];
      let childOffset = page.pos + 1;
      page.node.forEach((child) => {
        if (child.type.name === "panel") panels.push({ node: child, pos: childOffset });
        childOffset += child.nodeSize;
      });
      if (panels.length <= 1) continue; // nothing safe to move

      const last = panels[panels.length - 1];
      const next = pages[p + 1] ?? null;
      return {
        kind: "push",
        panelPos: last.pos,
        panelSize: last.node.nodeSize,
        pageEnd: page.pos + page.node.nodeSize,
        nextPageContentStart: next ? next.pos + 1 : null,
      };
    }

    // Not overflowing: can we pull the next page's first panel up to fill space?
    const next = pages[p + 1];
    if (!next) continue;

    // Never pull content up across a break the writer made themselves. Pulling
    // exists only to undo an *overflow* spill, so a deliberate "New page" (or
    // Ctrl+Enter) is a hard boundary: its panels stay on it even when this page
    // has room, and even after they add more panels. Without this, back-fill
    // reclaims the new page's first panel the moment there's space — the "typing
    // into a new page collapses it into the previous one" bug. The flag is
    // persisted (Page.manualBreak), so the boundary survives save/reload.
    if (next.node.attrs.manualBreak) continue;

    const nextFirstPanelEl = next.el.querySelector<HTMLElement>(".sx-panel");
    if (!nextFirstPanelEl) {
      // Next page has no panels left — fold the empty sheet away.
      if (next.node.childCount === 0) {
        return { kind: "dropEmptyPage", pagePos: next.pos, pageSize: next.node.nodeSize };
      }
      continue;
    }
    // Would the pulled panel still fit on this page, with room to spare?
    // Measured against the same reduced target so pull-up and push-down agree on
    // where the bottom of the page is.
    if (content + nextFirstPanelEl.offsetHeight > target - PULL_SLACK) continue;

    let firstPanelPos: number | null = null;
    let firstPanel: PMNode | null = null;
    let off = next.pos + 1;
    for (let c = 0; c < next.node.childCount; c++) {
      const child = next.node.child(c);
      if (child.type.name === "panel") {
        firstPanelPos = off;
        firstPanel = child;
        break;
      }
      off += child.nodeSize;
    }
    if (firstPanelPos == null || firstPanel == null) continue;

    // Never pull an *empty* panel up: it has no content to fill space with, so
    // the pull just deposits a stray empty panel on the previous page. (The
    // sole-panel guard above already covers a next page whose only panel is
    // empty; this still catches a multi-panel page whose first panel is empty.)
    const panelIsEmpty = firstPanel.childCount === 1 && firstPanel.firstChild!.content.size === 0;
    if (panelIsEmpty) continue;

    return {
      kind: "pull",
      panelPos: firstPanelPos,
      panelSize: firstPanel.nodeSize,
      intoPageContentEnd: page.pos + page.node.nodeSize - 1, // just inside the page's closing token
    };
  }

  return null;
}

// Applies one move, carrying the caret with the panel if it was inside it, so
// typing at a page break follows the text onto the next sheet.
function applyMove(view: EditorView, move: Move): boolean {
  const { state } = view;
  const { schema } = state;
  const tr = state.tr;
  const head = state.selection.head;

  if (move.kind === "dropEmptyPage") {
    tr.delete(move.pagePos, move.pagePos + move.pageSize);
    view.dispatch(tr);
    return true;
  }

  const panelNode = state.doc.nodeAt(move.panelPos);
  if (!panelNode || panelNode.type.name !== "panel") return false;
  const panelSize = panelNode.nodeSize; // trust the live node, not a stale measure

  const caretInPanel = head > move.panelPos && head < move.panelPos + panelSize;
  const caretOffset = head - move.panelPos; // distance from the panel's opening token

  tr.delete(move.panelPos, move.panelPos + panelSize);

  let panelOpenPos: number;
  if (move.kind === "push") {
    if (move.nextPageContentStart != null) {
      panelOpenPos = tr.mapping.map(move.nextPageContentStart);
      tr.insert(panelOpenPos, panelNode);
    } else {
      // No next page — wrap the panel in a fresh sheet appended after this one.
      const newPage = schema.nodes.page.create(null, panelNode);
      const insertAt = tr.mapping.map(move.pageEnd);
      tr.insert(insertAt, newPage);
      panelOpenPos = insertAt + 1; // one past the new page's opening token
    }
  } else {
    // pull: drop it at the end of the previous page's content.
    panelOpenPos = tr.mapping.map(move.intoPageContentEnd);
    tr.insert(panelOpenPos, panelNode);
  }

  if (caretInPanel) {
    const target = Math.min(panelOpenPos + caretOffset, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(target), 1));
  }

  view.dispatch(tr);
  return true;
}

export const AutoPaginate = Extension.create({
  name: "autoPaginate",
  addProseMirrorPlugins() {
    let raf = 0;
    let busy = false;

    const schedule = (view: EditorView) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (busy || view.isDestroyed || view.composing) return;
        busy = true;
        try {
          // One move per flush: apply a single structural move, then let the
          // resulting doc update reschedule us so the next decision reads fresh
          // layout rather than stale measurements. Each move strictly reduces
          // the imbalance, so the document converges over successive frames.
          const move = decideMove(view);
          if (move) applyMove(view, move);
        } finally {
          busy = false;
        }
      });
    };

    return [
      new Plugin({
        key: paginationKey,
        view(view) {
          schedule(view);
          return {
            update: (v) => schedule(v),
            destroy: () => {
              if (raf) cancelAnimationFrame(raf);
            },
          };
        },
      }),
    ];
  },
});
