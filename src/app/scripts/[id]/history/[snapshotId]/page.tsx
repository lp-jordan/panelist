import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { parseSnapshotContent } from "@/lib/snapshot";
import { ScriptSheets } from "@/components/print/ScriptSheets";
import type { JSONNode } from "@/lib/editor/serialize";
import "../../print/print.css";

export const metadata: Metadata = {
  title: "Version preview",
};

// Read-only preview of one saved version, rendered through the same sheet
// component as the print/export view — so a snapshot reads exactly as it would
// print. Opened from the history panel.
export default async function SnapshotPreviewPage({
  params,
}: {
  params: Promise<{ id: string; snapshotId: string }>;
}) {
  await verifySession();
  const { id, snapshotId } = await params;

  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
    select: { content: true, scriptId: true },
  });
  if (!snapshot || snapshot.scriptId !== id) notFound();

  const { doc, meta } = parseSnapshotContent(snapshot.content);

  return <ScriptSheets doc={doc as JSONNode} meta={meta} />;
}
