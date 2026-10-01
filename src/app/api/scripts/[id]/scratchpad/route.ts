import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getScriptRole } from "@/lib/dal";

// Saves a script's scratch pad. Plain text in the body, so the pad can use the
// same request for its debounced autosave and for navigator.sendBeacon when the
// tab is hidden or closing (a beacon survives unload; a fetch may not).
// Anyone with access to the script may write it: the pad is shared notes, not
// the script, so it stays editable for collaborators and when locked.
const MAX_LENGTH = 100_000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!(await getScriptRole(id, user.id))) return NextResponse.json({ ok: false }, { status: 403 });

  const text = await request.text();
  if (text.length > MAX_LENGTH) return NextResponse.json({ ok: false, error: "too long" }, { status: 413 });

  // Raw SQL so a note doesn't bump Script.updatedAt (@updatedAt would), which
  // drives "last edited" in the library.
  await prisma.$executeRaw`UPDATE "Script" SET "scratchpad" = ${text} WHERE "id" = ${id}`;
  return NextResponse.json({ ok: true });
}
