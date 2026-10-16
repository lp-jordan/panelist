import type { ReactNode } from "react";

// The imported-PDF equivalent of ScriptSheets: each page is a rasterized image
// filling a sheet, reusing the same .px-page geometry so the read view's
// reference pins overlay by x/y exactly as they do over a written script.
// Front matter (pageNumber null) renders as an unnumbered .px-freeform-page, so
// it's shown but skipped by the numbered-sheet count the pins index into.
// A comic page can run over several PDF pages: only the first sheet carrying a
// number is that page's .px-page (with its pin overlay and data-page-no); the
// sheets continuing it render unnumbered, like front matter.

export type ImportedSheetPage = { assetId: string; pageNumber: number | null };

export function ImportedSheets({
  pages,
  renderPageOverlay,
}: {
  pages: ImportedSheetPage[];
  renderPageOverlay?: (pageNo: number) => ReactNode;
}) {
  const seen = new Set<number>();
  return (
    <div className="px-doc">
      {pages.map((page) => {
        const continues = page.pageNumber != null && seen.has(page.pageNumber);
        if (page.pageNumber != null) seen.add(page.pageNumber);
        return page.pageNumber == null || continues ? (
          <section key={page.assetId} className="px-freeform-page px-page--image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/assets/${page.assetId}`}
              alt={continues ? `Page ${page.pageNumber}, continued` : ""}
              className="px-image"
            />
          </section>
        ) : (
          <section key={page.assetId} className="px-page px-page--image" data-page-no={page.pageNumber}>
            {renderPageOverlay?.(page.pageNumber)}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/assets/${page.assetId}`} alt={`Page ${page.pageNumber}`} className="px-image" />
          </section>
        );
      })}
    </div>
  );
}
