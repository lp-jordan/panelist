import Link from "next/link";
import { getCurrentUser, memberProjectWhere, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { restoreProject, deleteProjectForever } from "@/app/actions/projects";
import { restoreScript, deleteScriptForever } from "@/app/actions/scripts";
import { TrashRow } from "@/components/library/TrashRow";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default async function TrashPage() {
  const user = await getCurrentUser();

  const [projects, scripts] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: { not: null }, ...memberProjectWhere(user.id) },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.script.findMany({
      where: { deletedAt: { not: null }, ...accessibleScriptWhere(user.id) },
      orderBy: { deletedAt: "desc" },
      include: { project: true },
    }),
  ]);

  const isEmpty = projects.length === 0 && scripts.length === 0;

  return (
    <div className="shell">
      <nav className="nav">
        <Link href="/" className="nav-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Library
        </Link>
        <span className="nav-spacer" />
        <ThemeToggle />
      </nav>

      <main className="shell-inner pullback">
        <h1 className="large-title">Trash</h1>

        {isEmpty && (
          <section className="group">
            <div className="list">
              <div className="empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
                <h4>Trash is empty</h4>
                <p>Anything you move here can be restored until you delete it for good.</p>
              </div>
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section className="group">
            <div className="group-head">
              Projects <span className="count">{projects.length}</span>
            </div>
            <div className="list">
              {projects.map((project) => (
                <TrashRow
                  key={project.id}
                  id={project.id}
                  kind="project"
                  title={project.name}
                  sublabel={project.deletedAt ? `Moved to Trash ${formatRelativeTime(project.deletedAt)}` : ""}
                  restoreAction={restoreProject}
                  deleteAction={deleteProjectForever}
                  deleteDescription="Its scripts move to Unassigned. This cannot be undone."
                />
              ))}
            </div>
          </section>
        )}

        {scripts.length > 0 && (
          <section className="group">
            <div className="group-head">
              Scripts <span className="count">{scripts.length}</span>
            </div>
            <div className="list">
              {scripts.map((script) => (
                <TrashRow
                  key={script.id}
                  id={script.id}
                  kind="script"
                  title={script.title}
                  sublabel={`${script.project?.name ?? "Unassigned"}${
                    script.deletedAt ? ` · moved to Trash ${formatRelativeTime(script.deletedAt)}` : ""
                  }`}
                  restoreAction={restoreScript}
                  deleteAction={deleteScriptForever}
                  deleteDescription="The script and all its pages go with it. This cannot be undone."
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
