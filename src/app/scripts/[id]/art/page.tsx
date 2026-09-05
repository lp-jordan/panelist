import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, accessibleScriptWhere, getScriptRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { presignDownload, artStorageConfigured } from "@/lib/art-storage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ArtPipelineClient, type ArtPageData } from "@/components/art/ArtPipelineClient";

// V2 Phase E — per-issue art page overview + versions + notes. The page COUNT
// is derived from the script's SCRIPT pages (BLANK pages are skipped by
// numbering); art is anchored by pageNumber, never Page.id.
export default async function ScriptArtPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const script = await prisma.script.findFirst({
    where: { id, deletedAt: null, ...accessibleScriptWhere(user.id) },
    select: {
      id: true,
      title: true,
      locked: true,
      source: true,
      projectId: true,
      project: { select: { name: true } },
      pages: { where: { kind: "SCRIPT" }, select: { id: true } },
      // Imported PDFs number their pages via ImportedPage, not editor pages.
      importedPages: { where: { pageNumber: { not: null } }, select: { id: true } },
      artPages: {
        select: {
          pageNumber: true,
          currentVersionId: true,
          versions: {
            orderBy: { version: "desc" },
            select: {
              id: true,
              version: true,
              bytes: true,
              mime: true,
              note: true,
              previewKey: true,
              previewStatus: true,
              originalName: true,
              createdAt: true,
              uploader: { select: { id: true, name: true } },
            },
          },
          comments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              body: true,
              xPct: true,
              yPct: true,
              resolved: true,
              createdAt: true,
              author: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!script) notFound();

  const role = await getScriptRole(script.id, user.id);
  const pageCount = script.source === "IMPORTED_PDF" ? script.importedPages.length : script.pages.length;
  const byNumber = new Map(script.artPages.map((ap) => [ap.pageNumber, ap]));

  // Presign inline preview URLs for each CURRENT version that has a web-viewable
  // preview. Presigning is local crypto (no network), so doing it per page is
  // cheap. URLs are short-lived — fine for a page view.
  const pages: ArtPageData[] = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => i + 1).map(async (pageNumber): Promise<ArtPageData> => {
      const ap = byNumber.get(pageNumber);
      if (!ap) {
        return { pageNumber, current: null, versionCount: 0, versions: [], comments: [] };
      }
      const currentRow = ap.versions.find((v) => v.id === ap.currentVersionId) ?? null;
      const previewUrl =
        currentRow?.previewKey && artStorageConfigured()
          ? await presignDownload(currentRow.previewKey)
          : null;

      return {
        pageNumber,
        versionCount: ap.versions.length,
        current: currentRow
          ? {
              versionId: currentRow.id,
              version: currentRow.version,
              mime: currentRow.mime,
              previewUrl,
              previewStatus: currentRow.previewStatus,
            }
          : null,
        versions: ap.versions.map((v) => ({
          id: v.id,
          version: v.version,
          bytes: v.bytes,
          note: v.note,
          previewStatus: v.previewStatus,
          isCurrent: v.id === ap.currentVersionId,
          uploaderName: v.uploader?.name ?? "Someone",
          createdLabel: formatRelativeTime(v.createdAt),
        })),
        comments: ap.comments.map((c) => ({
          id: c.id,
          body: c.body,
          xPct: c.xPct,
          yPct: c.yPct,
          resolved: c.resolved,
          authorId: c.author?.id ?? null,
          authorName: c.author?.name ?? "Someone",
          createdLabel: formatRelativeTime(c.createdAt),
        })),
      };
    }),
  );

  const latestUpload = script.artPages
    .flatMap((ap) => ap.versions.map((v) => v.createdAt))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const backHref = script.projectId ? `/projects/${script.projectId}` : "/";
  const backLabel = script.project?.name ?? "Library";

  return (
    <div className="shell">
      <nav className="nav">
        <Link href={backHref} className="nav-back" aria-label={`Back to ${backLabel}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
        <span className="nav-spacer" />
        <ThemeToggle />
      </nav>

      <main className="shell-inner pullback">
        <h1 className="large-title">{script.title}</h1>
        <p className="ref-subtitle">Art pages</p>

        <ArtPipelineClient
          scriptId={script.id}
          pages={pages}
          isOwner={role === "OWNER"}
          currentUserId={user.id}
          locked={script.locked}
          storageReady={artStorageConfigured()}
          latestUploadLabel={latestUpload ? formatRelativeTime(latestUpload) : null}
        />
      </main>
    </div>
  );
}
