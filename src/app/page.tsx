import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { NewMenu } from "@/components/library/NewMenu";
import { AccountMenu } from "@/components/library/AccountMenu";
import { ProjectMenu } from "@/components/library/ProjectMenu";
import { ScriptRow } from "@/components/library/ScriptRow";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type SearchParams = { q?: string; sort?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await getCurrentUser();
  const { q = "", sort = "updated" } = await searchParams;

  const orderBy = sort === "title" ? { title: "asc" as const } : { updatedAt: "desc" as const };
  const titleFilter = q.trim().length > 0 ? { title: { contains: q.trim() } } : {};

  const [projects, unassignedScripts] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        scripts: {
          where: { deletedAt: null, ...titleFilter },
          orderBy,
          include: { _count: { select: { pages: true } } },
        },
      },
    }),
    prisma.script.findMany({
      where: { projectId: null, deletedAt: null, ...titleFilter },
      orderBy,
      include: { _count: { select: { pages: true } } },
    }),
  ]);

  const searching = q.trim().length > 0;
  const matches = projects.reduce((n, p) => n + p.scripts.length, 0) + unassignedScripts.length;

  return (
    <div className="shell">
      <nav className="nav">
        <span className="nav-title">Panelist</span>
        <span className="nav-spacer" />
        <ThemeToggle />
        <NewMenu projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
        <AccountMenu />
      </nav>

      <main className="shell-inner pullback">
        <h1 className="large-title">Library</h1>

        <LibraryToolbar q={q} sort={sort} />

        {searching && matches === 0 && (
          <div className="group">
            <div className="list">
              <div className="empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <h4>No matches</h4>
                <p>Nothing titled “{q.trim()}”. Try a shorter search.</p>
              </div>
            </div>
          </div>
        )}

        {projects.map((project) => {
          // While searching, a project with no matching scripts is noise.
          if (searching && project.scripts.length === 0) return null;

          return (
            <section className="group" key={project.id}>
              <div className="group-head">
                {project.name}
                <span className="count">
                  {project.scripts.length} script{project.scripts.length === 1 ? "" : "s"}
                </span>
                <span className="group-head-actions">
                  <ProjectMenu id={project.id} name={project.name} scriptCount={project.scripts.length} />
                </span>
              </div>
              <div className="list">
                {project.scripts.length === 0 ? (
                  <div className="empty">
                    <h4>No scripts yet</h4>
                    <p>Add one from the + in the bar above.</p>
                  </div>
                ) : (
                  project.scripts.map((script) => (
                    <ScriptRow
                      key={script.id}
                      id={script.id}
                      title={script.title}
                      draftLabel={script.draftLabel}
                      pageCount={script._count.pages}
                      editedLabel={formatRelativeTime(script.updatedAt)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}

        {!(searching && unassignedScripts.length === 0) && (
          <section className="group">
            <div className="group-head">Unassigned</div>
            <div className="list">
              {unassignedScripts.length === 0 ? (
                <div className="empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h11l5 5v11H4z" />
                    <path d="M15 4v5h5" />
                    <path d="M8 13h8M8 17h5" />
                  </svg>
                  <h4>Nothing loose</h4>
                  <p>Scripts that don’t belong to a project land here.</p>
                </div>
              ) : (
                unassignedScripts.map((script) => (
                  <ScriptRow
                    key={script.id}
                    id={script.id}
                    title={script.title}
                    draftLabel={script.draftLabel}
                    pageCount={script._count.pages}
                    editedLabel={formatRelativeTime(script.updatedAt)}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* Trash lives in the bottom-left corner as a quiet archive control,
          out of the way of the primary top-right actions. */}
      <Link href="/trash" className="archive-fab" aria-label="Trash">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" />
          <path d="M10 12h4" />
        </svg>
        Trash
      </Link>
    </div>
  );
}
