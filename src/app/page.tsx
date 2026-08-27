import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { createProject, archiveProject, renameProject } from "@/app/actions/projects";
import { createScript, archiveScript, duplicateScript, renameScript } from "@/app/actions/scripts";

type SearchParams = { q?: string; sort?: string };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900 }}>
      <h1>Scripts</h1>

      <form style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input type="text" name="q" placeholder="Search by title" defaultValue={q} />
        <select name="sort" defaultValue={sort}>
          <option value="updated">Last edited</option>
          <option value="title">Title</option>
        </select>
        <button type="submit">Apply</button>
      </form>

      <section style={{ marginBottom: "2rem" }}>
        <h2>New project</h2>
        <form action={createProject} style={{ display: "flex", gap: "0.5rem" }}>
          <input type="text" name="name" placeholder="Project name" required />
          <button type="submit">Create project</button>
        </form>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>New script</h2>
        <form action={createScript} style={{ display: "flex", gap: "0.5rem" }}>
          <input type="text" name="title" placeholder="Script title" required />
          <select name="projectId" defaultValue="">
            <option value="">Unassigned</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button type="submit">Create script</button>
        </form>
      </section>

      {projects.map((project) => (
        <section key={project.id} style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2>{project.name}</h2>
            <form action={renameProject} style={{ display: "flex", gap: "0.25rem" }}>
              <input type="hidden" name="id" value={project.id} />
              <input type="text" name="name" defaultValue={project.name} />
              <button type="submit">Rename</button>
            </form>
            <form action={archiveProject}>
              <input type="hidden" name="id" value={project.id} />
              <button type="submit">Archive project</button>
            </form>
          </div>
          <ScriptList scripts={project.scripts} />
        </section>
      ))}

      <section style={{ marginBottom: "2rem" }}>
        <h2>Unassigned</h2>
        <ScriptList scripts={unassignedScripts} />
      </section>
    </main>
  );
}

type ScriptCard = {
  id: string;
  title: string;
  draftLabel: string;
  updatedAt: Date;
  _count: { pages: number };
};

function ScriptList({ scripts }: { scripts: ScriptCard[] }) {
  if (scripts.length === 0) {
    return <p style={{ color: "#666" }}>No scripts.</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {scripts.map((script) => (
        <li
          key={script.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.5rem 0",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ flex: 1 }}>
            <strong>{script.title}</strong>{" "}
            <span style={{ color: "#666" }}>
              — {script.draftLabel} · {script._count.pages} page{script._count.pages === 1 ? "" : "s"} · edited{" "}
              {formatRelativeTime(script.updatedAt)}
            </span>
          </div>
          <form action={renameScript} style={{ display: "flex", gap: "0.25rem" }}>
            <input type="hidden" name="id" value={script.id} />
            <input type="text" name="title" defaultValue={script.title} />
            <button type="submit">Rename</button>
          </form>
          <form action={duplicateScript}>
            <input type="hidden" name="id" value={script.id} />
            <button type="submit">Duplicate</button>
          </form>
          <form action={archiveScript}>
            <input type="hidden" name="id" value={script.id} />
            <button type="submit">Archive</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
