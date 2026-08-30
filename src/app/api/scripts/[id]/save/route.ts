import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { writeScriptPages } from "@/lib/editor/persist";
import type { JSONNode } from "@/lib/editor/serialize";

// The durable-flush endpoint. The editor sends the doc here with
// navigator.sendBeacon when the tab is hidden or unloading — a beacon is
// guaranteed to complete during unload, where a normal fetch (and therefore the
// autosave server action) would be cancelled. Without this, an edit made in the
// last second before a reload — most visibly a character name you just typed —
// never reached the pages the loader reads, and looked "dropped on load".
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;
  let doc: JSONNode;
  try {
    doc = (await request.json()) as JSONNode;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await writeScriptPages(id, doc);
  return NextResponse.json({ ok: true });
}
