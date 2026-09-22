// Client-side PDF export (the app's "Export PDF", replacing the old
// window.print() path). It builds the exported script as a real PDF in the
// writer's browser via @react-pdf/renderer, so the output is identical on every
// device (no dependence on iOS Safari's print rasterizer, device theme, or
// viewport width) and costs no server compute.
//
// The layout mirrors src/components/print/ScriptSheets.tsx (the CSS/print
// version) as closely as react-pdf's box model allows: one physical page per
// stored editor page, so page numbers, headings and panel numbering match what
// the editor shows. Typography uses the built-in Helvetica family (no embedded
// font file) — letterforms differ slightly from the app's Verdana, but wrapping
// is deterministic everywhere.
//
// This module is heavy (it pulls in @react-pdf/renderer), so it is only ever
// loaded through a dynamic import from the export handler — never at page load.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import { toPageWordNumber } from "@/lib/editor/numberToWords";

// The app renders scripts in Verdana, which is proprietary and can't be embedded
// in a distributed PDF. DejaVu Sans is a free, metric-similar humanist sans (wide
// like Verdana, unlike the narrow built-in Helvetica), so it's the closest legal
// match. Served from /public/fonts and fetched by react-pdf at render time.
const FONT = "DejaVu Sans";
Font.register({
  family: FONT,
  fonts: [
    { src: "/fonts/DejaVuSans.ttf", fontWeight: "normal", fontStyle: "normal" },
    { src: "/fonts/DejaVuSans-Bold.ttf", fontWeight: "bold", fontStyle: "normal" },
    { src: "/fonts/DejaVuSans-Oblique.ttf", fontWeight: "normal", fontStyle: "italic" },
    { src: "/fonts/DejaVuSans-BoldOblique.ttf", fontWeight: "bold", fontStyle: "italic" },
  ],
});
// DejaVu Sans has no hyphenation dictionary here and we don't want mid-word
// breaks in a script anyway — split only on existing spaces.
Font.registerHyphenationCallback((word) => [word]);

// --- document shape (a subset of the Tiptap/ProseMirror JSON) ---------------

type Mark = { type: string };
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: Node[];
};

export type ScriptPdfMeta = {
  title: string;
  author: string;
  draftLabel: string;
  draftDate: string; // yyyy-mm-dd
};

// --- geometry (points; 1in = 72pt) ------------------------------------------

// Geometry mirrors print.css (the app's read-view sheets), converted to PDF
// points: 1in = 72pt, and CSS px → pt is ×0.75 (96px = 72pt). The app body is
// 0.9rem = 14.4px = 10.8pt with line-height 1.6; panels/headings tighten to 1.2;
// margins are 0.9rem (10.8pt) around panels/notes and 0.35rem (4.2pt) around
// text elements. Matching these fixes the sizing/line-spacing drift vs the app.
// (Font is the built-in Helvetica family — Verdana is proprietary and can't be
// embedded; letterforms differ slightly, so horizontal wrapping won't be
// identical, but vertical rhythm and scale now match.)
const MARGIN = 72; // 1in page padding
const TAB = 144; // 2in dialogue tab / hanging indent
const BASE = 10.8; // 0.9rem body

const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    fontFamily: FONT,
    fontSize: BASE,
    lineHeight: 1.6,
    color: "#000",
    backgroundColor: "#fff",
  },
  heading: {
    fontFamily: FONT,
    fontWeight: "bold",
    fontSize: 17.3, // 1.6em of 0.9rem
    lineHeight: 1.2,
    textDecoration: "underline",
    marginBottom: 12, // 1rem
  },
  // NB: react-pdf resolves lineHeight against the default 18pt (not the
  // inherited page fontSize) for a Text inside a View, so every text style that
  // sets lineHeight must also set fontSize or the leading comes out ~2x. Margins
  // don't collapse either, so block gaps use one side only (marginBottom for
  // block separation, marginTop within a panel) to match the app's collapsed
  // spacing.
  panel: { marginBottom: 10.8 }, // 0.9rem between blocks
  panelLine: { fontSize: BASE, lineHeight: 1.2 },
  bold: { fontFamily: FONT, fontWeight: "bold" },
  noCopy: { fontSize: BASE, marginTop: 2.4, lineHeight: 1.2 }, // 0.2rem
  note: { marginBottom: 10.8, fontSize: BASE, fontFamily: FONT, fontWeight: "bold", fontStyle: "italic", lineHeight: 1.6 },
  textRow: { flexDirection: "row", marginTop: 4.2 }, // 0.35rem
  textLabel: { width: TAB, fontSize: BASE, textTransform: "uppercase" },
  textContent: { flex: 1, fontSize: BASE, lineHeight: 1.6 },
  para: { marginBottom: 7.6, fontSize: BASE, lineHeight: 1.6 }, // 0.7em
  // cover
  coverPage: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    fontFamily: FONT,
    fontSize: BASE,
    lineHeight: 1.6,
    color: "#000",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: {
    fontFamily: FONT,
    fontWeight: "bold",
    fontSize: 19.2, // 1.6rem
    lineHeight: 1.2,
    textDecoration: "underline",
    textTransform: "uppercase",
    textAlign: "center",
  },
  coverWrittenBy: { marginTop: 7.5, textAlign: "center" }, // 10px
  coverDraft: {
    position: "absolute",
    left: MARGIN,
    bottom: MARGIN,
    flexDirection: "row",
    fontFamily: FONT,
    fontWeight: "bold",
  },
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDraftDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return "";
  return `${monthName} ${Number(day)}, ${year}`;
}

const FIXED_LABEL: Record<string, string> = {
  sfx: "SFX",
  narration: "NARRATION",
  caption: "CAPTION",
};

// Inline runs -> react-pdf <Text> spans. `invert` flips the marks for notes,
// which are bold+italic by default so a bold/italic run drops that trait
// (mirrors print.css .px-note strong/em).
function inlineSpans(content: Node[] | undefined, keyPrefix: string, invert = false) {
  if (!content) return null;
  return content
    .filter((n) => n.type === "text" && n.text)
    .map((n, i) => {
      const bold = n.marks?.some((m) => m.type === "bold") ?? false;
      const italic = n.marks?.some((m) => m.type === "italic") ?? false;
      const effBold = invert ? !bold : bold;
      const effItalic = invert ? !italic : italic;
      return (
        <Text
          key={`${keyPrefix}${i}`}
          style={{ fontFamily: FONT, fontWeight: effBold ? "bold" : "normal", fontStyle: effItalic ? "italic" : "normal" }}
        >
          {n.text}
        </Text>
      );
    });
}

function TextElementRow({ node, keyPrefix }: { node: Node; keyPrefix: string }) {
  const kind = String(node.attrs?.kind ?? "dialogue");
  const character = String(node.attrs?.character ?? "");
  const label = kind === "dialogue" ? `${character}:` : `${FIXED_LABEL[kind] ?? kind.toUpperCase()}:`;
  return (
    <View style={styles.textRow} wrap={false}>
      <Text style={styles.textLabel}>{label}</Text>
      <Text style={styles.textContent}>{inlineSpans(node.content, keyPrefix)}</Text>
    </View>
  );
}

function PanelBlock({ node, panelNo }: { node: Node; panelNo: number }) {
  const children = node.content ?? [];
  const [description, ...lines] = children;
  const hasLines = lines.length > 0;
  return (
    <View style={styles.panel} wrap={false}>
      <Text style={styles.panelLine}>
        <Text style={styles.bold}>{`Panel ${panelNo}: `}</Text>
        {inlineSpans(description?.content, "d")}
      </Text>
      {lines.map((line, i) => (
        <TextElementRow key={i} node={line} keyPrefix={`t${i}`} />
      ))}
      {!hasLines && <Text style={styles.noCopy}>NO COPY</Text>}
    </View>
  );
}

function ScriptPageView({ node, pageNo }: { node: Node; pageNo: number }) {
  const children = node.content ?? [];
  const panelCount = children.filter((c) => c.type === "panel").length;
  const heading = `${toPageWordNumber(pageNo)} (${panelCount} Panel${panelCount === 1 ? "" : "s"})`;
  // Sequential panel numbers within this page, precomputed per index so the map
  // reads a stable value instead of mutating a counter mid-render.
  const panelNumbers = new Map<number, number>();
  children.forEach((child, i) => {
    if (child.type === "panel") panelNumbers.set(i, panelNumbers.size + 1);
  });
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.heading}>{heading}</Text>
      {children.map((child, i) => {
        if (child.type === "note") {
          return (
            <Text key={i} style={styles.note} wrap={false}>
              {inlineSpans(child.content, `n${i}`, true)}
            </Text>
          );
        }
        if (child.type === "panel") {
          return <PanelBlock key={i} node={child} panelNo={panelNumbers.get(i)!} />;
        }
        return null;
      })}
    </Page>
  );
}

function FreeformPageView({ node }: { node: Node }) {
  const paragraphs = node.content ?? [];
  return (
    <Page size="LETTER" style={styles.page}>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.para}>
          {inlineSpans(p.content, `p${i}`)}
        </Text>
      ))}
    </Page>
  );
}

function CoverView({ meta }: { meta: ScriptPdfMeta }) {
  const dateText = formatDraftDate(meta.draftDate);
  return (
    <Page size="LETTER" style={styles.coverPage}>
      <View>
        <Text style={styles.coverTitle}>{meta.title.trim() || "Untitled"}</Text>
        {meta.author.trim() ? (
          <Text style={styles.coverWrittenBy}>{`Written by ${meta.author.trim()}`}</Text>
        ) : null}
      </View>
      <View style={styles.coverDraft}>
        <Text>{meta.draftLabel.trim() || "Draft #1"}</Text>
        {dateText ? <Text style={styles.bold}>{`: `}</Text> : null}
        {dateText ? <Text>{dateText}</Text> : null}
      </View>
    </Page>
  );
}

export function ScriptDocument({ doc, meta }: { doc: Node; meta: ScriptPdfMeta }) {
  const pages = doc.content ?? [];
  // Script pages get a 1-based number; freeform pages are skipped by numbering.
  // Precomputed per index rather than mutating a counter mid-render.
  const scriptPageNumbers = new Map<number, number>();
  pages.forEach((node, i) => {
    if (node.type !== "freeformPage") scriptPageNumbers.set(i, scriptPageNumbers.size + 1);
  });
  return (
    <Document title={meta.title || "Script"}>
      <CoverView meta={meta} />
      {pages.map((node, i) => {
        if (node.type === "freeformPage") {
          return <FreeformPageView key={i} node={node} />;
        }
        return <ScriptPageView key={i} node={node} pageNo={scriptPageNumbers.get(i)!} />;
      })}
    </Document>
  );
}

// Build the PDF as a Blob, ready to download. Runs entirely client-side.
export async function generateScriptPdfBlob(doc: Node, meta: ScriptPdfMeta): Promise<Blob> {
  return pdf(<ScriptDocument doc={doc} meta={meta} />).toBlob();
}
