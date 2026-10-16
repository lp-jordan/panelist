// PDF import — working out which comic page each PDF page belongs to.
//
// A comic script written in a word processor rarely puts one comic page on one
// PDF page: a page's panels run onto the next sheet, and a two-page spread is
// often described under a single heading. So rather than "one PDF page = one
// comic page", each PDF page gets a `span`:
//   span 0      continues the comic page before it
//   span 1      starts a new comic page
//   span 2+     starts a spread that uses that many page numbers
// Shared by the importer (to show the review grid) and the import action (to
// number the stored pages), so both always agree.

const UNITS: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
  ELEVEN: 11, TWELVE: 12, THIRTEEN: 13, FOURTEEN: 14, FIFTEEN: 15, SIXTEEN: 16,
  SEVENTEEN: 17, EIGHTEEN: 18, NINETEEN: 19,
};
const TENS: Record<string, number> = {
  TWENTY: 20, THIRTY: 30, FORTY: 40, FIFTY: 50, SIXTY: 60, SEVENTY: 70, EIGHTY: 80, NINETY: 90,
};
const CONNECTORS = new Set(["AND", "&", "-", "–", "—", "TO", "THRU", "THROUGH"]);

export const MAX_SPAN = 4;

/** Headings sit at the top of a page, possibly under a title block. */
const HEADING_WINDOW = 400;

// Tokens keep their trailing punctuation so "30/Panel" or "29," can be refused:
// a heading's number is followed by a space, a colon or nothing.
function word(tok: string) {
  return tok.toUpperCase().replace(/[:.]$/, "");
}

/** Read a page number at tokens[i]: "7", "SEVEN", "TWENTY-ONE" or "TWENTY ONE". */
function readNumber(tokens: string[], i: number): { n: number; next: number } | null {
  const raw = tokens[i];
  if (raw == null || /[/,;]/.test(raw)) return null;
  const t = word(raw);
  if (/^\d{1,3}$/.test(t)) return { n: Number(t), next: i + 1 };
  if (UNITS[t] != null) return { n: UNITS[t], next: i + 1 };
  const hy = /^([A-Z]+)-([A-Z]+)$/.exec(t);
  if (hy && TENS[hy[1]] != null && UNITS[hy[2]] != null && UNITS[hy[2]] < 10) {
    return { n: TENS[hy[1]] + UNITS[hy[2]], next: i + 1 };
  }
  if (TENS[t] != null) {
    const unit = tokens[i + 1] != null && !/[/,;]/.test(tokens[i + 1]) ? UNITS[word(tokens[i + 1])] : undefined;
    // "PAGE TWENTY FIVE PANELS" is page 20 with five panels, not page 25.
    const after = tokens[i + 2] ? word(tokens[i + 2]) : "";
    const unitIsPanelCount = after === "PANEL" || after === "PANELS";
    if (unit != null && unit < 10 && !unitIsPanelCount) return { n: TENS[t] + unit, next: i + 2 };
    return { n: TENS[t], next: i + 1 };
  }
  return null;
}

/** What may follow a heading's number: nothing, a panel count, or "PANEL…". */
function looksLikeHeadingTail(tokens: string[], i: number) {
  const t = tokens[i];
  if (t == null) return true;
  if (/^[(—–:-]/.test(t)) return true;
  const w = word(t);
  if (w === "PANEL" || w === "PANELS" || w === "SPLASH" || w === "SPREAD") return true;
  const count = readNumber(tokens, i);
  if (count) {
    const after = tokens[count.next] ? word(tokens[count.next]) : "";
    return after === "PANEL" || after === "PANELS";
  }
  return false;
}

/**
 * Find a page heading ("PAGE ONE", "PAGE 7", "PAGES TWELVE and THIRTEEN") near
 * the top of a PDF page's text. Returns the first and last page number it names.
 */
export function findPageHeading(text: string | null): { first: number; last: number } | null {
  if (!text) return null;
  const tokens = text.slice(0, HEADING_WINDOW).split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const w = word(tokens[i]);
    if (w !== "PAGE" && w !== "PAGES") continue;
    const a = readNumber(tokens, i + 1);
    if (!a) continue;
    let last = a.n;
    let next = a.next;
    if (tokens[next] && CONNECTORS.has(word(tokens[next]))) {
      const b = readNumber(tokens, next + 1);
      if (b && b.n > a.n) {
        last = b.n;
        next = b.next;
      }
    }
    if (looksLikeHeadingTail(tokens, next)) return { first: a.n, last };
  }
  return null;
}

/**
 * Detect where comic pages start. A heading only counts if its number is past
 * the previous one, which filters out mentions like "a version of Page 30 from
 * Issue 2". Pages before the first heading are front matter: they are returned
 * as `frontMatter` so the importer can skip them by default. With no headings
 * at all, every PDF page starts a comic page (the old behavior).
 */
export function detectPageSpans(texts: (string | null)[]): {
  spans: number[];
  frontMatter: boolean[];
  headings: number;
} {
  const spans = texts.map(() => 0);
  let lastNumber = 0;
  let headings = 0;
  let firstHeading = -1;
  texts.forEach((text, i) => {
    const h = findPageHeading(text);
    if (!h || h.first <= lastNumber) return;
    spans[i] = Math.min(MAX_SPAN, h.last - h.first + 1);
    lastNumber = h.last;
    headings++;
    if (firstHeading < 0) firstHeading = i;
  });
  if (headings === 0) {
    return { spans: texts.map(() => 1), frontMatter: texts.map(() => false), headings: 0 };
  }
  return { spans, frontMatter: texts.map((_, i) => i < firstHeading), headings };
}

/**
 * Number the kept PDF pages. Each start takes the next number(s); a
 * continuation shares the current one. A continuation with nothing before it
 * (say, the user kept a title page) starts page 1. Skipped pages get null.
 */
export function assignPageNumbers(pages: { included: boolean; span: number }[]): {
  pageNumbers: (number | null)[];
  total: number;
} {
  let next = 1;
  let current = 0;
  const pageNumbers = pages.map((p) => {
    if (!p.included) return null;
    if (p.span > 0 || current === 0) {
      current = next;
      next += Math.max(1, p.span);
    }
    return current;
  });
  return { pageNumbers, total: next - 1 };
}
