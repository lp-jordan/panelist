import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ReferenceLibraryClient, type ReferenceCard } from "@/components/reference/ReferenceLibraryClient";

// Per-project reference library (V2 §2 / roadmap decision: references live
// inside a book). Reached from each project on the home Library.
export default async function ProjectReferencePage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      references: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          caption: true,
          assetId: true,
          _count: { select: { placements: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const references: ReferenceCard[] = project.references.map((ref) => ({
    id: ref.id,
    assetId: ref.assetId,
    caption: ref.caption,
    placementCount: ref._count.placements,
  }));

  return (
    <div className="shell">
      <nav className="nav">
        <Link href="/" className="nav-back" aria-label="Back to Library">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Library
        </Link>
        <span className="nav-spacer" />
        <ThemeToggle />
      </nav>

      <main className="shell-inner pullback">
        <h1 className="large-title">{project.name}</h1>
        <p className="ref-subtitle">Reference</p>

        <ReferenceLibraryClient projectId={project.id} references={references} />
      </main>
    </div>
  );
}
