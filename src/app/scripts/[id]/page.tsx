import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { scriptToDocJSON } from "@/lib/editor/serialize";
import { ScriptEditor } from "@/components/ScriptEditor";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const script = await prisma.script.findUnique({
    where: { id, deletedAt: null },
    include: {
      project: { select: { name: true } },
      pages: {
        include: {
          items: {
            include: { panel: { include: { textElements: true } } },
          },
        },
      },
    },
  });

  if (!script) notFound();

  const castMembers = script.projectId
    ? await prisma.castMember.findMany({ where: { projectId: script.projectId }, orderBy: { name: "asc" } })
    : [];

  const doc = scriptToDocJSON(script);

  // The editor owns the whole screen, nav bar included, because the bar has to
  // show the save state that lives inside it.
  return (
    <ScriptEditor
      scriptId={script.id}
      projectId={script.projectId}
      projectName={script.project?.name ?? null}
      title={script.title}
      author={script.author}
      draftLabel={script.draftLabel}
      // The date field wants a yyyy-mm-dd string; hand it the ISO day.
      draftDate={script.draftDate.toISOString().slice(0, 10)}
      initialDoc={doc}
      initialCastNames={castMembers.map((c) => c.name)}
    />
  );
}
