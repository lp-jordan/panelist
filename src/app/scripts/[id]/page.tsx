import Link from "next/link";
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

  return (
    <main style={{ padding: "2rem" }}>
      <p>
        <Link href="/">&larr; Back to Scripts</Link>
      </p>
      <h1 style={{ fontFamily: "sans-serif" }}>{script.title}</h1>
      <ScriptEditor
        scriptId={script.id}
        projectId={script.projectId}
        initialDoc={doc}
        initialCastNames={castMembers.map((c) => c.name)}
      />
    </main>
  );
}
