import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, memberProjectWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NewMenu } from "@/components/library/NewMenu";
import { ScriptRow } from "@/components/library/ScriptRow";
import { ScriptDropZone } from "@/components/library/ScriptDropZone";
import { MembersPanel } from "@/components/project/MembersPanel";

// The project hub (V2 project-hub IA): a project opens to its issues, and each
// issue row is the jumping-off point into its script, its references, and
// (later) its art page layout.
export default async function ProjectHubPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const [project, projects] = await Promise.all([
    prisma.project.findFirst({
      where: { id, deletedAt: null, ...memberProjectWhere(user.id) },
      select: {
        id: true,
        name: true,
        scripts: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          include: { _count: { select: { pages: true } } },
        },
        members: {
          select: { role: true, user: { select: { id: true, name: true, email: true } } },
        },
        invites: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, token: true },
        },
      },
    }),
    prisma.project.findMany({
      where: { deletedAt: null, ...memberProjectWhere(user.id) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!project) notFound();

  const isOwner = project.members.some((m) => m.user.id === user.id && m.role === "OWNER");

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
        <NewMenu mode="script" projectId={project.id} />
      </nav>

      <main className="shell-inner pullback">
        <h1 className="large-title">{project.name}</h1>
        <p className="ref-subtitle">
          {project.scripts.length} issue{project.scripts.length === 1 ? "" : "s"}
        </p>

        <section className="group">
          <ScriptDropZone projectId={project.id}>
            {project.scripts.length === 0 ? (
              <div className="empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4h11l5 5v11H4z" />
                  <path d="M15 4v5h5" />
                  <path d="M8 13h8M8 17h5" />
                </svg>
                <h4>No issues yet</h4>
                <p>Add one from the + in the bar above, or drag one here.</p>
              </div>
            ) : (
              project.scripts.map((script) => (
                <ScriptRow
                  key={script.id}
                  id={script.id}
                  projectId={project.id}
                  title={script.title}
                  draftLabel={script.draftLabel}
                  pageCount={script._count.pages}
                  editedLabel={formatRelativeTime(script.updatedAt)}
                  projects={projects}
                  locked={script.locked}
                />
              ))
            )}
          </ScriptDropZone>
        </section>

        <MembersPanel
          projectId={project.id}
          isOwner={isOwner}
          members={project.members.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            isSelf: m.user.id === user.id,
          }))}
          invites={project.invites}
        />
      </main>
    </div>
  );
}
