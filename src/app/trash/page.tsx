import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { restoreProject, deleteProjectForever } from "@/app/actions/projects";
import { restoreScript, deleteScriptForever } from "@/app/actions/scripts";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function TrashPage() {
  await verifySession();

  const [projects, scripts] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
    prisma.script.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: { project: true },
    }),
  ]);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900 }}>
      <h1>Trash</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Projects</h2>
        {projects.length === 0 && <p style={{ color: "#666" }}>Nothing here.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {projects.map((project) => (
            <li key={project.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0" }}>
              <span style={{ flex: 1 }}>{project.name}</span>
              <form action={restoreProject}>
                <input type="hidden" name="id" value={project.id} />
                <button type="submit">Restore</button>
              </form>
              <form action={deleteProjectForever}>
                <input type="hidden" name="id" value={project.id} />
                <ConfirmSubmitButton confirmMessage={`Permanently delete "${project.name}"? Its scripts move to Unassigned. This cannot be undone.`}>
                  Delete forever
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Scripts</h2>
        {scripts.length === 0 && <p style={{ color: "#666" }}>Nothing here.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {scripts.map((script) => (
            <li key={script.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0" }}>
              <span style={{ flex: 1 }}>
                {script.title} <span style={{ color: "#666" }}>— {script.project?.name ?? "Unassigned"}</span>
              </span>
              <form action={restoreScript}>
                <input type="hidden" name="id" value={script.id} />
                <button type="submit">Restore</button>
              </form>
              <form action={deleteScriptForever}>
                <input type="hidden" name="id" value={script.id} />
                <ConfirmSubmitButton confirmMessage={`Permanently delete "${script.title}"? This cannot be undone.`}>
                  Delete forever
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
