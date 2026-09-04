import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ReferenceLibraryClient, type ReferenceCard } from "@/components/reference/ReferenceLibraryClient";

// Per-issue reference library (project-hub decision: each script carries its
// own reference set). Reached from the References action on an issue row.
export default async function ScriptReferencePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const script = await prisma.script.findFirst({
    where: { id, deletedAt: null, ...accessibleScriptWhere(user.id) },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { name: true } },
      references: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          caption: true,
          assetId: true,
          collections: { select: { collectionId: true } },
          _count: { select: { placements: true } },
        },
      },
      collections: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, _count: { select: { references: true } } },
      },
    },
  });

  if (!script) notFound();

  const references: ReferenceCard[] = script.references.map((ref) => ({
    id: ref.id,
    assetId: ref.assetId,
    caption: ref.caption,
    placementCount: ref._count.placements,
    collectionIds: ref.collections.map((c) => c.collectionId),
  }));

  const collections = script.collections.map((c) => ({ id: c.id, name: c.name, count: c._count.references }));

  // Back to the issue's project hub, or the Library if it's unassigned.
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
        <p className="ref-subtitle">Reference</p>

        <ReferenceLibraryClient scriptId={script.id} references={references} collections={collections} />
      </main>
    </div>
  );
}
