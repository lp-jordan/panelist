"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// A rasterized PDF page is a downscaled PNG — a few hundred KB each. Cap per
// page and overall so a runaway import can't dump hundreds of MB into Postgres.
const MAX_PAGES = 300;
const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;

type PageMeta = { included: boolean; text: string | null };

export type ImportResult = { error?: string; scriptId?: string };

/**
 * Create a script from an uploaded PDF (V2 — PDF import). The client has already
 * rasterized each page to a PNG and lifted its text in the browser; here we just
 * store them. Pages arrive in original order as `image` files, parallel to a
 * `meta` JSON array marking which count (excluded = front matter). Included
 * pages get sequential comic page numbers; the script lands locked, read-only.
 */
export async function createImportedScript(formData: FormData): Promise<ImportResult> {
  const user = await getCurrentUser();

  const title = formData.get("title");
  const projectIdRaw = formData.get("projectId");
  const metaRaw = formData.get("meta");
  const images = formData.getAll("image").filter((v): v is File => v instanceof File);

  if (typeof title !== "string" || title.trim().length === 0) return { error: "Give the script a title." };
  if (typeof metaRaw !== "string") return { error: "Something went wrong reading the PDF." };

  let meta: PageMeta[];
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return { error: "Something went wrong reading the PDF." };
  }
  if (!Array.isArray(meta) || meta.length !== images.length) {
    return { error: "Page data didn't line up — try the import again." };
  }
  if (images.length === 0) return { error: "That PDF had no pages." };
  if (images.length > MAX_PAGES) return { error: `Too many pages (max ${MAX_PAGES}).` };
  if (!meta.some((m) => m.included)) return { error: "Keep at least one page." };

  // Only import into a project the user actually belongs to; otherwise loose.
  let projectId = typeof projectIdRaw === "string" && projectIdRaw.length > 0 ? projectIdRaw : null;
  if (projectId) {
    const member = await prisma.projectMember.findFirst({ where: { projectId, userId: user.id }, select: { id: true } });
    if (!member) projectId = null;
  }

  // Read all bytes up front (and validate) before opening the transaction.
  let total = 0;
  const buffers: Uint8Array[] = [];
  for (const file of images) {
    if (file.size > MAX_PAGE_BYTES) return { error: "One of the pages was too large." };
    total += file.size;
    if (total > MAX_TOTAL_BYTES) return { error: "That PDF is too large to import." };
    buffers.push(new Uint8Array(await file.arrayBuffer()));
  }

  let pageNumber = 0;
  const rows = meta.map((m, i) => ({
    order: i,
    pageNumber: m.included ? ++pageNumber : null,
    text: m.text && m.text.trim().length > 0 ? m.text : null,
    bytes: buffers[i],
  }));

  const script = await prisma.$transaction(async (tx) => {
    const created = await tx.script.create({
      data: {
        title: title.trim(),
        projectId,
        ownerId: user.id,
        author: user.name,
        source: "IMPORTED_PDF",
        locked: true,
        draftLabel: "Imported",
        draftDate: new Date(),
      },
    });

    for (const row of rows) {
      const asset = await tx.asset.create({
        data: { kind: "PDF_PAGE", storageKey: "", mime: "image/png", bytes: row.bytes.length },
      });
      await tx.asset.update({ where: { id: asset.id }, data: { storageKey: `db:${asset.id}` } });
      // .slice() yields Uint8Array<ArrayBuffer>, the exact type Prisma's Bytes wants.
      await tx.assetData.create({ data: { assetId: asset.id, data: row.bytes.slice() } });
      await tx.importedPage.create({
        data: { scriptId: created.id, order: row.order, pageNumber: row.pageNumber, assetId: asset.id, text: row.text },
      });
    }

    return created;
  }, { timeout: 30000 });

  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  return { scriptId: script.id };
}
