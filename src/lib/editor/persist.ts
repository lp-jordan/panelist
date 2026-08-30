import "server-only";
import { prisma } from "@/lib/prisma";
import { docJSONToScriptPagesInput, type JSONNode } from "@/lib/editor/serialize";

// The one place that turns an editor doc into the relational page rows and
// writes them. Shared by the saveScriptContent server action (normal autosave)
// and the sendBeacon route (the durable flush on unload), so the two can never
// serialize a script differently — a past mismatch here is how character names
// went missing when a save landed via the less-travelled path.
export async function writeScriptPages(scriptId: string, doc: JSONNode) {
  const pages = docJSONToScriptPagesInput(doc);
  await prisma.$transaction([
    prisma.page.deleteMany({ where: { scriptId } }),
    prisma.script.update({
      where: { id: scriptId },
      data: { pages: { create: pages } },
    }),
  ]);
}
