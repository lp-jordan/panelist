import { Fragment, type ReactNode } from "react";
import { toPageWordNumber } from "@/lib/editor/numberToWords";
import type { JSONNode } from "@/lib/editor/serialize";

// Static, server-rendered "print" of a script: the same sheet geometry the
// editor draws, but as plain semantic HTML with no Tiptap and no client-side
// pagination. Page breaks are left to CSS paged media (see print.css), so the
// output is deterministic across browsers and drives the server-side PDF
// export by simply being the page Playwright loads. It renders from the Tiptap
// document JSON (the same shape a version-history Snapshot stores), so the live
// script and any snapshot both flow through here unchanged.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// yyyy-mm-dd -> "Month D, YYYY" without constructing a Date (which would shift
// the day across time zones). "" for a blank/malformed value.
function formatDraftDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return "";
  return `${monthName} ${Number(day)}, ${year}`;
}

type Inline = { type: string; text?: string; marks?: { type: string }[] };

// Inline runs -> React, mirroring the editor's two marks. Both marks nest as
// <strong><em>, matching how bold-italic reads in the reference document.
function renderInline(content: Inline[] | undefined, keyPrefix: string): ReactNode {
  if (!content) return null;
  return content.map((node, i) => {
    if (node.type !== "text" || !node.text) return null;
    const bold = node.marks?.some((m) => m.type === "bold");
    const italic = node.marks?.some((m) => m.type === "italic");
    let el: ReactNode = node.text;
    if (italic) el = <em>{el}</em>;
    if (bold) el = <strong>{el}</strong>;
    return <Fragment key={`${keyPrefix}${i}`}>{el}</Fragment>;
  });
}

const FIXED_LABEL: Record<string, string> = {
  sfx: "SFX",
  narration: "NARRATION",
  caption: "CAPTION",
};

function TextElement({ node }: { node: JSONNode }) {
  const kind = String(node.attrs?.kind ?? "dialogue");
  const character = String(node.attrs?.character ?? "");
  const label = kind === "dialogue" ? `${character}:` : `${FIXED_LABEL[kind] ?? kind.toUpperCase()}:`;
  return (
    <div className={`px-text-element px-text-element-${kind}`}>
      <span className="px-text-element-label">{label}</span>
      <span className="px-text-element-content">{renderInline(node.content, "t")}</span>
    </div>
  );
}

function Panel({ node, panelNo }: { node: JSONNode; panelNo: number }) {
  const children = node.content ?? [];
  const [description, ...lines] = children;
  const hasLines = lines.length > 0;
  return (
    <div className="px-panel">
      <strong className="px-panel-label">{`Panel ${panelNo}: `}</strong>
      <span className="px-panel-body">
        <span className="px-panel-description">{renderInline(description?.content, "d")}</span>
        {lines.map((line, i) => (
          <TextElement key={i} node={line} />
        ))}
      </span>
      {/* A silent panel (no dialogue/caption/SFX) reads "NO COPY" — generated,
          never typed, exactly as the editor renders it. */}
      {!hasLines && <div className="px-no-copy">NO COPY</div>}
    </div>
  );
}

function PageSheet({ node, pageNo }: { node: JSONNode; pageNo: number }) {
  const children = node.content ?? [];
  const panelCount = children.filter((c) => c.type === "panel").length;
  const heading = `${toPageWordNumber(pageNo)} (${panelCount} Panel${panelCount === 1 ? "" : "s"})`;
  let panelNo = 0;
  return (
    <section className="px-page">
      <div className="px-page-heading">{heading}</div>
      <div className="px-page-body">
        {children.map((child, i) => {
          if (child.type === "note") {
            return (
              <div key={i} className="px-note">
                {renderInline(child.content, `n${i}`)}
              </div>
            );
          }
          if (child.type === "panel") {
            panelNo += 1;
            return <Panel key={i} node={child} panelNo={panelNo} />;
          }
          return null;
        })}
      </div>
    </section>
  );
}

function FreeformSheet({ node }: { node: JSONNode }) {
  const paragraphs = node.content ?? [];
  return (
    <section className="px-freeform-page">
      {paragraphs.map((p, i) => (
        <p key={i} className="px-para">
          {renderInline(p.content, `p${i}`)}
        </p>
      ))}
    </section>
  );
}

export type TitlePageMeta = {
  title: string;
  author: string;
  draftLabel: string;
  draftDate: string;
};

function Cover({ title, author, draftLabel, draftDate }: TitlePageMeta) {
  const dateText = formatDraftDate(draftDate);
  return (
    <section className="px-cover">
      <div className="px-cover-titleblock">
        <div className="px-cover-title">{title.trim() || "Untitled"}</div>
        {author.trim() && (
          <div className="px-cover-writtenby">
            <span>Written by</span> <span>{author.trim()}</span>
          </div>
        )}
      </div>
      <div className="px-cover-draft">
        <span className="px-cover-draft-label">{draftLabel.trim() || "Draft #1"}</span>
        {dateText && (
          <>
            <span>:&nbsp;</span>
            <span className="px-cover-draft-date">{dateText}</span>
          </>
        )}
      </div>
    </section>
  );
}

export function ScriptSheets({ doc, meta }: { doc: JSONNode; meta: TitlePageMeta }) {
  const pages = doc.content ?? [];
  // Freeform (blank) pages sit in the flow but are skipped by page numbering,
  // so a separate counter advances only on script pages.
  let scriptPageNo = 0;
  return (
    <div className="px-doc">
      <Cover {...meta} />
      {pages.map((node, i) => {
        if (node.type === "freeformPage") {
          return <FreeformSheet key={i} node={node} />;
        }
        scriptPageNo += 1;
        return <PageSheet key={i} node={node} pageNo={scriptPageNo} />;
      })}
    </div>
  );
}
