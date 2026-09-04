import Link from "next/link";
import { getCurrentUser, memberProjectWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { NewMenu } from "@/components/library/NewMenu";
import { AccountMenu } from "@/components/library/AccountMenu";
import { ProjectMenu } from "@/components/library/ProjectMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type SearchParams = { q?: string };

// The Library is a project index. Scripts are created and live inside their
// project's hub, so there's no loose-script section here anymore.
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  const { q = "" } = await searchParams;

  const query = q.trim();
  const searching = query.length > 0;

  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      ...memberProjectWhere(user.id),
      ...(searching ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      scripts: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  return (
    <div className="shell">
      <nav className="nav">
        <span className="nav-title">Panelist</span>
        <span className="nav-spacer" />
        <ThemeToggle />
        <NewMenu mode="project" />
        <AccountMenu />
      </nav>

      <main className="shell-inner pullback">
        <h1 className="large-title">Library</h1>

        <LibraryToolbar q={q} />

        {projects.length === 0 ? (
          <div className="group">
            <div className="list">
              {searching ? (
                <div className="empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  <h4>No matches</h4>
                  <p>No project named “{query}”. Try a shorter search.</p>
                </div>
              ) : (
                <div className="empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7h6l2 2h10v10H3z" />
                  </svg>
                  <h4>No projects yet</h4>
                  <p>Create your first project from the + in the bar above. Scripts live inside a project.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <section className="group">
            <div className="group-head">Projects</div>
            <div className="list">
              {projects.map((project) => (
                <div className="row" key={project.id}>
                  <span className="row-main">
                    <Link href={`/projects/${project.id}`} className="row-title row-link">
                      {project.name}
                    </Link>
                    <span className="row-sub">
                      {project.scripts.length} issue{project.scripts.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ProjectMenu id={project.id} name={project.name} scriptCount={project.scripts.length} contextSelector=".row" />
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
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
