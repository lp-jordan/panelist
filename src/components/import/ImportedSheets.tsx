import type { ReactNode } from "react";

// The imported-PDF equivalent of ScriptSheets: each page is a rasterized image
// filling a sheet, reusing the same .px-page geometry so the read view's
// reference pins overlay by x/y exactly as they do over a written script.
// Front matter (pageNumber null) renders as an unnumbered .px-freeform-page, so
// it's shown but skipped by the numbered-sheet count the pins index into.

export type ImportedSheetPage = { assetId: string; pageNumber: number | null };

export function ImportedSheets({
  pages,
  renderPageOverlay,
}: {
  pages: ImportedSheetPage[];
  renderPageOverlay?: (pageNo: number) => ReactNode;
}) {
  return (
    <div className="px-doc">
      {pages.map((page) =>
        page.pageNumber == null ? (
          <section key={page.assetId} className="px-freeform-page px-page--image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/assets/${page.assetId}`} alt="" className="px-image" />
          </section>
        ) : (
          <section key={page.assetId} className="px-page px-page--image">
            {renderPageOverlay?.(page.pageNumber)}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/assets/${page.assetId}`} alt={`Page ${page.pageNumber}`} className="px-image" />
          </section>
        ),
      )}
    </div>
  );
}
