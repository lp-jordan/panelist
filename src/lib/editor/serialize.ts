import type { Prisma } from "@/generated/prisma/client";

// Inline rich text (bold/italic spans) is stored as JSON-stringified "runs"
// in the PanelTextElement.text / Panel.description / PageItem.noteText
// string columns — not HTML. Node has no DOM to parse HTML with, and with
// only two marks (bold, italic) runs map 1:1 onto Tiptap's own inline JSON
// shape, so no parsing is needed in either direction.
export type Run = { text: string; bold?: boolean; italic?: boolean };

type PMTextNode = { type: "text"; text: string; marks?: { type: string }[] };

export function runsToInlineContent(runs: Run[]): PMTextNode[] {
  return runs
    .filter((run) => run.text.length > 0)
    .map((run) => ({
      type: "text",
      text: run.text,
      ...(run.bold || run.italic
        ? { marks: [...(run.bold ? [{ type: "bold" }] : []), ...(run.italic ? [{ type: "italic" }] : [])] }
        : {}),
    }));
}

export function inlineContentToRuns(content?: PMTextNode[]): Run[] {
  return (content ?? []).map((node) => ({
    text: node.text ?? "",
    bold: node.marks?.some((mark) => mark.type === "bold") ?? false,
    italic: node.marks?.some((mark) => mark.type === "italic") ?? false,
  }));
}

export function serializeRuns(runs: Run[]): string {
  return JSON.stringify(runs);
}

export function parseRuns(raw: string): Run[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// --- Relational rows -> Tiptap document JSON -------------------------------

type ScriptWithContent = Prisma.ScriptGetPayload<{
  include: {
    pages: {
      include: {
        items: {
          include: {
            panel: { include: { textElements: true } };
          };
        };
      };
    };
  };
}>;

export function scriptToDocJSON(script: ScriptWithContent) {
  const pages = [...script.pages].sort((a, b) => a.order - b.order);

  return {
    type: "doc",
    content:
      pages.length > 0
        ? pages.map((page) => (page.kind === "BLANK" ? freeformPageToJSON(page) : pageToJSON(page)))
        : [emptyPageJSON()],
  };
}

// A blank page's paragraphs are stored as its ordered NOTE items (same run
// serialization as a page note). Always yields at least one paragraph so the
// freeformPage schema (`paragraph+`) is satisfied.
function freeformPageToJSON(page: ScriptWithContent["pages"][number]) {
  const items = [...page.items].sort((a, b) => a.order - b.order);
  const paragraphs = items.map((item) => ({
    type: "paragraph",
    content: runsToInlineContent(parseRuns(item.noteText ?? "")),
  }));
  return {
    type: "freeformPage",
    content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }],
  };
}

function pageToJSON(page: ScriptWithContent["pages"][number]) {
  const items = [...page.items].sort((a, b) => a.order - b.order);
  return {
    type: "page",
    // A page is never rendered with zero children — there'd be no place to
    // put the cursor to start typing. commands.ts relies on this invariant.
    content: items.length > 0 ? items.map(itemToJSON) : [emptyPanelJSON()],
  };
}

function itemToJSON(item: ScriptWithContent["pages"][number]["items"][number]) {
  if (item.type === "NOTE") {
    return { type: "note", content: runsToInlineContent(parseRuns(item.noteText ?? "")) };
  }

  const panel = item.panel!;
  const textElements = [...panel.textElements].sort((a, b) => a.order - b.order);

  return {
    type: "panel",
    content: [
      { type: "panelDescription", content: runsToInlineContent(parseRuns(panel.description)) },
      ...textElements.map((textElement) => ({
        type: "textElement",
        attrs: {
          kind: textElement.type.toLowerCase(),
          character: textElement.character ?? "",
          modifier: textElement.modifier ?? "",
        },
        content: runsToInlineContent(parseRuns(textElement.text)),
      })),
    ],
  };
}

function emptyPanelJSON() {
  return { type: "panel", content: [{ type: "panelDescription" }] };
}

function emptyPageJSON() {
  return { type: "page", content: [emptyPanelJSON()] };
}

// --- Tiptap document JSON -> relational create input ------------------------

export type JSONNode = { type: string; attrs?: Record<string, unknown>; content?: JSONNode[]; text?: string; marks?: { type: string }[] };

export function docJSONToScriptPagesInput(doc: JSONNode): Prisma.PageCreateWithoutScriptInput[] {
  const pages = doc.content ?? [];
  return pages.map((page, pageIndex) =>
    page.type === "freeformPage"
      ? freeformPageToInput(page, pageIndex)
      : {
          order: pageIndex,
          kind: "SCRIPT",
          items: {
            create: (page.content ?? []).map((item, itemIndex) => itemToInput(item, itemIndex)),
          },
        },
  );
}

// A blank page: each paragraph becomes a NOTE item carrying its run-serialized
// text, in order. Kind BLANK is what tells the loader to rebuild a freeformPage.
function freeformPageToInput(page: JSONNode, order: number): Prisma.PageCreateWithoutScriptInput {
  const paragraphs = page.content ?? [];
  return {
    order,
    kind: "BLANK",
    items: {
      create: paragraphs.map((paragraph, paragraphIndex) => ({
        order: paragraphIndex,
        type: "NOTE" as const,
        noteText: serializeRuns(inlineContentToRuns(paragraph.content as PMTextNode[] | undefined)),
      })),
    },
  };
}

function itemToInput(item: JSONNode, order: number): Prisma.PageItemCreateWithoutPageInput {
  if (item.type === "note") {
    return {
      order,
      type: "NOTE",
      noteText: serializeRuns(inlineContentToRuns(item.content as PMTextNode[] | undefined)),
    };
  }

  const children = item.content ?? [];
  const [description, ...textElements] = children;

  return {
    order,
    type: "PANEL",
    panel: {
      create: {
        description: serializeRuns(inlineContentToRuns(description?.content as PMTextNode[] | undefined)),
        textElements: {
          create: textElements.map((textElement, textElementIndex) => ({
            order: textElementIndex,
            type: String(textElement.attrs?.kind ?? "dialogue").toUpperCase() as "DIALOGUE" | "CAPTION" | "SFX" | "NARRATION",
            character: (textElement.attrs?.character as string) || null,
            modifier: (textElement.attrs?.modifier as string) || null,
            text: serializeRuns(inlineContentToRuns(textElement.content as PMTextNode[] | undefined)),
          })),
        },
      },
    },
  };
}
