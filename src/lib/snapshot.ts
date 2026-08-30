import type { JSONNode } from "@/lib/editor/serialize";

// Pure (non-server-action) helpers for the version-history snapshot envelope.
// Kept out of the "use server" actions module so sync functions like
// parseSnapshotContent can be imported directly by server components (a
// "use server" file may only export async actions).

export type SnapshotMeta = {
  title: string;
  author: string;
  draftLabel: string;
  draftDate: string;
};

export type SnapshotEnvelope = { v: 1; doc: JSONNode; meta: SnapshotMeta };

const FALLBACK_META: SnapshotMeta = { title: "Untitled", author: "", draftLabel: "Draft #1", draftDate: "" };

export function serializeSnapshot(doc: JSONNode, meta: SnapshotMeta): string {
  return JSON.stringify({ v: 1, doc, meta } satisfies SnapshotEnvelope);
}

// Tolerant parse: an older or malformed snapshot still yields something the
// preview/restore can work with rather than throwing.
export function parseSnapshotContent(raw: string): SnapshotEnvelope {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "doc" in parsed) {
      return { v: 1, doc: parsed.doc as JSONNode, meta: (parsed.meta as SnapshotMeta) ?? FALLBACK_META };
    }
    // Very old shape: the bare doc JSON with no envelope.
    return { v: 1, doc: parsed as JSONNode, meta: FALLBACK_META };
  } catch {
    return { v: 1, doc: { type: "doc", content: [] }, meta: FALLBACK_META };
  }
}
