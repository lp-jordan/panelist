import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { scriptToDocJSON, type JSONNode } from "@/lib/editor/serialize";
import { computeScriptReport } from "@/lib/report";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import "@/app/scripts/[id]/report/report.css";

export const metadata: Metadata = { title: "Script — Report" };

export default async function ScriptReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const script = await prisma.script.findFirst({
    where: { id, deletedAt: null, ...accessibleScriptWhere(user.id) },
    include: {
      project: { select: { id: true, name: true } },
      pages: { include: { items: { include: { panel: { include: { textElements: true } } } } } },
    },
  });
  if (!script) notFound();

  // Imported PDFs have no editor structure to analyze.
  const isImported = script.source === "IMPORTED_PDF";
  const report = isImported ? null : computeScriptReport(scriptToDocJSON(script) as JSONNode);

  const backHref = `/scripts/${script.id}`;
  const maxPanels = report ? Math.max(1, ...report.perPage.map((p) => p.panels)) : 1;
  const maxCharLines = report ? Math.max(1, ...report.characters.map((c) => c.lines)) : 1;

  return (
    <div className="rp-shell">
      <nav className="nav">
        <Link href={backHref} className="nav-back" aria-label="Back to script">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="nav-back-label">Script</span>
        </Link>
        <span className="nav-spacer" />
        <span className="nav-title">{script.title} — Report</span>
        <span className="nav-spacer" />
        <span className="nav-theme"><ThemeToggle /></span>
      </nav>

      <main className="rp-body">
        {isImported || !report ? (
          <p className="rp-empty">This is an imported PDF — there’s no script structure to report on.</p>
        ) : (
          <>
            {/* Summary tiles */}
            <section className="rp-tiles">
              <Tile label="Pages" value={report.totals.pages} />
              <Tile label="Panels" value={report.totals.panels} />
              <Tile label="Characters" value={report.totals.characters} />
              <Tile label="Total words" value={report.totals.totalWords.toLocaleString()} />
              <Tile label="Dialogue words" value={report.totals.dialogueWords.toLocaleString()} />
              <Tile label="Panels / page" value={report.averages.panelsPerPage} />
              <Tile label="Dialogue / panel" value={report.averages.dialogueLinesPerPanel} />
              <Tile label="Silent panels" value={`${report.averages.silentPanelPct}%`} />
            </section>

            {/* Cast */}
            <section className="rp-section">
              <h2 className="rp-h2">Cast <span className="rp-count">{report.characters.length}</span></h2>
              {report.characters.length === 0 ? (
                <p className="rp-empty">No dialogue yet.</p>
              ) : (
                <div className="rp-table" role="table">
                  <div className="rp-tr rp-thead" role="row">
                    <span role="columnheader">Character</span>
                    <span role="columnheader" className="rp-num">Lines</span>
                    <span role="columnheader" className="rp-num">Words</span>
                    <span role="columnheader" className="rp-num">Panels</span>
                    <span role="columnheader" className="rp-num">Pages</span>
                    <span role="columnheader" className="rp-num">Range</span>
                  </div>
                  {report.characters.map((c) => (
                    <div className="rp-tr" role="row" key={c.name}>
                      <span role="cell" className="rp-char">
                        <span className="rp-bar" style={{ width: `${(c.lines / maxCharLines) * 100}%` }} aria-hidden="true" />
                        <span className="rp-char-name">{c.name}</span>
                      </span>
                      <span role="cell" className="rp-num">{c.lines}</span>
                      <span role="cell" className="rp-num">{c.words}</span>
                      <span role="cell" className="rp-num">{c.panels}</span>
                      <span role="cell" className="rp-num">{c.pages}</span>
                      <span role="cell" className="rp-num">{c.firstPage === c.lastPage ? `p${c.firstPage}` : `p${c.firstPage}–${c.lastPage}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Element breakdown */}
            {report.elementTypes.length > 0 && (
              <section className="rp-section">
                <h2 className="rp-h2">Copy by type</h2>
                <div className="rp-chips">
                  {report.elementTypes.map((e) => (
                    <span className="rp-chip" key={e.kind}>
                      <span className="rp-chip-k">{e.kind}</span>
                      <span className="rp-chip-v">{e.count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Per-page pacing */}
            <section className="rp-section">
              <h2 className="rp-h2">Pacing <span className="rp-sub">panels per page</span></h2>
              <div className="rp-pages">
                {report.perPage.map((p) => (
                  <div className="rp-page-row" key={p.page}>
                    <span className="rp-page-no">p{p.page}</span>
                    <span className="rp-page-track">
                      <span className="rp-page-fill" style={{ width: `${(p.panels / maxPanels) * 100}%` }} />
                    </span>
                    <span className="rp-page-meta">{p.panels} pnl · {p.dialogueLines} line{p.dialogueLines === 1 ? "" : "s"} · {p.words}w</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rp-tile">
      <span className="rp-tile-v">{value}</span>
      <span className="rp-tile-l">{label}</span>
    </div>
  );
}
