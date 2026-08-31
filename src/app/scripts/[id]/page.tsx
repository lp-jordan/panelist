import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { scriptToDocJSON } from "@/lib/editor/serialize";
import { ScriptEditor } from "@/components/ScriptEditor";
import { ScriptReadView } from "@/components/reference/ScriptReadView";
// The read view reuses the print sheet geometry; its `.px-*` styles are inert
// on the editor render (which doesn't use those classes).
import "./print/print.css";

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

  const meta = {
    title: script.title,
    author: script.author,
    draftLabel: script.draftLabel,
    draftDate: script.draftDate.toISOString().slice(0, 10),
  };

  // Locked → the read-only reference view instead of the editor.
  if (script.locked) {
    const doc = scriptToDocJSON(script);
    const pageCount = (doc.content ?? []).filter((n) => n.type !== "freeformPage").length;

    const [placements, references] = await Promise.all([
      prisma.referencePlacement.findMany({
        where: { reference: { scriptId: id } },
        select: {
          id: true,
          pageNumber: true,
          xPct: true,
          yPct: true,
          reference: { select: { id: true, assetId: true, caption: true } },
        },
      }),
      prisma.reference.findMany({
        where: { scriptId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, assetId: true, caption: true },
      }),
    ]);

    return (
      <ScriptReadView
        scriptId={script.id}
        projectId={script.projectId}
        projectName={script.project?.name ?? null}
        doc={doc}
        meta={meta}
        pageCount={pageCount}
        placements={placements}
        references={references}
      />
    );
  }

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
