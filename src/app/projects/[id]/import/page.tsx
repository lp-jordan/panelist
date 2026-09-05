import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, memberProjectWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PdfImporter } from "@/components/import/PdfImporter";

// Import a finished script as a PDF (V2 — PDF import). Scoped to a project the
// user belongs to; the importer does the browser-side rasterizing.
export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null, ...memberProjectWhere(user.id) },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  return (
    <div className="shell">
      <nav className="nav">
        <Link href={`/projects/${project.id}`} className="nav-back" aria-label={`Back to ${project.name}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {project.name}
        </Link>
        <span className="nav-spacer" />
        <ThemeToggle />
      </nav>

      <main className="shell-inner pullback">
        <h1 className="large-title">Import a PDF script</h1>
        <p className="ref-subtitle">Bring a finished script into {project.name} as image-backed pages.</p>

        <PdfImporter projectId={project.id} />
      </main>
    </div>
  );
}
