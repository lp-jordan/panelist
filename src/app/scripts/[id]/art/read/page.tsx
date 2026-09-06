import { notFound } from "next/navigation";
import { getCurrentUser, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { presignDownload, artStorageConfigured } from "@/lib/art-storage";
import { ArtReaderClient, type ReaderPage } from "@/components/art/ArtReaderClient";

// V3 — reader mode. Launched from the art overview: swipe through the whole
// book showing each comic page's CURRENT version, to get a feel for it as a
// finished object. Read-only; no uploads, versions or notes here.
//
// Page numbering is derived exactly as the art overview does (SCRIPT pages for
// editor scripts, non-null-pageNumber ImportedPages for imported PDFs), so the
// reader always has the same page set the overview shows.
export default async function ArtReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const { page: pageParam } = await searchParams;

  const script = await prisma.script.findFirst({
    where: { id, deletedAt: null, ...accessibleScriptWhere(user.id) },
    select: {
      id: true,
      title: true,
      source: true,
      pages: { where: { kind: "SCRIPT" }, select: { id: true } },
      importedPages: { where: { pageNumber: { not: null } }, select: { id: true } },
      artPages: {
        select: {
          pageNumber: true,
          currentVersionId: true,
          versions: {
            select: { id: true, mime: true, previewKey: true, previewStatus: true },
          },
        },
      },
    },
  });

  if (!script) notFound();

  const pageCount = script.source === "IMPORTED_PDF" ? script.importedPages.length : script.pages.length;
  const byNumber = new Map(script.artPages.map((ap) => [ap.pageNumber, ap]));
  const storageReady = artStorageConfigured();

  // Presign an inline preview URL for each page's current version. Presigning is
  // local crypto (no network), so per-page is cheap; the URLs are short-lived,
  // which is fine for a read-through session.
  const pages: ReaderPage[] = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => i + 1).map(async (pageNumber): Promise<ReaderPage> => {
      const ap = byNumber.get(pageNumber);
      const cur = ap ? ap.versions.find((v) => v.id === ap.currentVersionId) ?? null : null;
      if (!cur) return { pageNumber, previewUrl: null, mime: null, status: null };
      const ready = cur.previewStatus === "READY";
      const previewUrl = ready && cur.previewKey && storageReady ? await presignDownload(cur.previewKey) : null;
      return { pageNumber, previewUrl, mime: cur.mime, status: cur.previewStatus };
    }),
  );

  const start = pageParam && /^\d+$/.test(pageParam) ? Number(pageParam) : 1;

  return (
    <ArtReaderClient
      scriptId={script.id}
      title={script.title}
      pages={pages}
      startPage={Math.min(Math.max(1, start), Math.max(1, pageCount))}
    />
  );
}
