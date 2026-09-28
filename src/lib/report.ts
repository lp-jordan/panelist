import type { JSONNode } from "@/lib/editor/serialize";

// Read-only analytics computed from a script's Tiptap document JSON (the same
// shape scriptToDocJSON produces). Pure and dependency-free so it can run on the
// server for the report page, or in a test. Characters come from dialogue cues,
// which are free-text strings today (not linked cast entities), so variants like
// "BENNET" and "BENNET FIELDS" count separately — that's surfaced, not hidden.

export type CharacterStat = {
  name: string;
  lines: number; // dialogue elements spoken
  words: number; // words of dialogue
  panels: number; // distinct panels they speak in
  pages: number; // distinct script pages they appear on
  firstPage: number;
  lastPage: number;
};

export type PageStat = {
  page: number;
  panels: number;
  dialogueLines: number;
  words: number; // description + all element text on the page
};

export type ScriptReport = {
  totals: {
    pages: number; // numbered script pages
    documentPages: number; // freeform/blank pages
    panels: number;
    silentPanels: number; // panels with no dialogue/caption/SFX/narration
    textElements: number;
    dialogueWords: number;
    totalWords: number; // descriptions + all elements
    characters: number; // distinct dialogue cues
  };
  averages: {
    panelsPerPage: number;
    dialogueLinesPerPanel: number;
    wordsPerPanel: number;
    silentPanelPct: number; // 0–100
  };
  elementTypes: { kind: string; count: number }[]; // dialogue/caption/sfx/narration
  characters: CharacterStat[]; // sorted by lines desc, then name
  perPage: PageStat[];
};

const KINDS = ["dialogue", "caption", "sfx", "narration"] as const;

// Concatenate the plain text of an inline content array (text nodes).
function inlineText(content: JSONNode[] | undefined): string {
  if (!content) return "";
  return content.map((n) => (n.type === "text" ? n.text ?? "" : "")).join("");
}

function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function computeScriptReport(doc: JSONNode): ScriptReport {
  const pages = doc.content ?? [];

  const charMap = new Map<string, CharacterStat & { _pages: Set<number>; _panels: Set<string> }>();
  const elementCounts = new Map<string, number>();
  const perPage: PageStat[] = [];

  let scriptPageNo = 0;
  let documentPages = 0;
  let totalPanels = 0;
  let silentPanels = 0;
  let totalTextElements = 0;
  let dialogueWords = 0;
  let totalWords = 0;

  for (const page of pages) {
    if (page.type === "freeformPage") {
      documentPages += 1;
      for (const para of page.content ?? []) totalWords += countWords(inlineText(para.content));
      continue;
    }

    scriptPageNo += 1;
    const children = page.content ?? [];
    let pagePanels = 0;
    let pageDialogueLines = 0;
    let pageWords = 0;

    children.forEach((child, panelIndex) => {
      if (child.type === "note") {
        const w = countWords(inlineText(child.content));
        pageWords += w;
        totalWords += w;
        return;
      }
      if (child.type !== "panel") return;

      pagePanels += 1;
      totalPanels += 1;
      const [description, ...elements] = child.content ?? [];
      const descWords = countWords(inlineText(description?.content));
      pageWords += descWords;
      totalWords += descWords;

      if (elements.length === 0) silentPanels += 1;

      for (const el of elements) {
        const kind = String(el.attrs?.kind ?? "dialogue");
        const words = countWords(inlineText(el.content));
        totalTextElements += 1;
        elementCounts.set(kind, (elementCounts.get(kind) ?? 0) + 1);
        pageWords += words;
        totalWords += words;

        if (kind === "dialogue") {
          pageDialogueLines += 1;
          dialogueWords += words;
          const name = String(el.attrs?.character ?? "").trim() || "(unnamed)";
          let stat = charMap.get(name);
          if (!stat) {
            stat = { name, lines: 0, words: 0, panels: 0, pages: 0, firstPage: scriptPageNo, lastPage: scriptPageNo, _pages: new Set(), _panels: new Set() };
            charMap.set(name, stat);
          }
          stat.lines += 1;
          stat.words += words;
          stat._pages.add(scriptPageNo);
          stat._panels.add(`${scriptPageNo}:${panelIndex}`);
          stat.firstPage = Math.min(stat.firstPage, scriptPageNo);
          stat.lastPage = Math.max(stat.lastPage, scriptPageNo);
        }
      }
    });

    perPage.push({ page: scriptPageNo, panels: pagePanels, dialogueLines: pageDialogueLines, words: pageWords });
  }

  const characters: CharacterStat[] = [...charMap.values()]
    .map((c) => ({ name: c.name, lines: c.lines, words: c.words, panels: c._panels.size, pages: c._pages.size, firstPage: c.firstPage, lastPage: c.lastPage }))
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));

  const elementTypes = KINDS.map((kind) => ({ kind, count: elementCounts.get(kind) ?? 0 })).filter((e) => e.count > 0);

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    totals: {
      pages: scriptPageNo,
      documentPages,
      panels: totalPanels,
      silentPanels,
      textElements: totalTextElements,
      dialogueWords,
      totalWords,
      characters: characters.length,
    },
    averages: {
      panelsPerPage: scriptPageNo ? round1(totalPanels / scriptPageNo) : 0,
      dialogueLinesPerPanel: totalPanels ? round1(pageDialogueTotal(perPage) / totalPanels) : 0,
      wordsPerPanel: totalPanels ? round1(perPage.reduce((s, p) => s + p.words, 0) / totalPanels) : 0,
      silentPanelPct: totalPanels ? Math.round((silentPanels / totalPanels) * 100) : 0,
    },
    elementTypes,
    characters,
    perPage,
  };
}

function pageDialogueTotal(perPage: PageStat[]): number {
  return perPage.reduce((s, p) => s + p.dialogueLines, 0);
}
