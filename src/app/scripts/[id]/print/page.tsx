import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, accessibleScriptWhere } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { scriptToDocJSON, type JSONNode } from "@/lib/editor/serialize";
import { ScriptSheets } from "@/components/print/ScriptSheets";
import "./print.css";

export const metadata: Metadata = {
  // A predictable tab/print-header title; the browser's own print header is
  // suppressed by @page in the PDF path, but this keeps the on-screen tab tidy.
  title: "Script — Print",
};

// The static print/export view of a script: server-rendered sheets, no editor.
// A human can open it and print; the server-side PDF export renders this exact
// URL through headless Chromium. Same auth gate as the editor.
export default async function ScriptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const script = await prisma.script.findFirst({
    where: { id, deletedAt: null, ...accessibleScriptWhere(user.id) },
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

  const doc = scriptToDocJSON(script) as JSONNode;

  return (
    <ScriptSheets
      doc={doc}
      meta={{
        title: script.title,
        author: script.author,
        draftLabel: script.draftLabel,
        draftDate: script.draftDate.toISOString().slice(0, 10),
      }}
    />
  );
}
