// Client-side image downscaling, run before a reference image is uploaded, so
// large source files never reach the server or the DB (reference images ride
// Postgres AssetData blobs — keeping them small is what keeps that cheap).
//
// Quality-first by design: never upscales, uses a generous long-edge cap with
// high-quality stepped resizing, and keeps the original whenever re-encoding
// wouldn't actually help — so a nice, already-reasonable image is left alone.

type Options = { maxEdge?: number; quality?: number };

function canEncodeWebp(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function drawScaled(source: CanvasImageSource, sw: number, sh: number, dw: number, dh: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, sw, sh, 0, 0, dw, dh);
  return canvas;
}

export async function downscaleImage(file: File, { maxEdge = 2560, quality = 0.85 }: Options = {}): Promise<File> {
  // Animated GIF / vector SVG would be flattened or rasterised by canvas —
  // leave them exactly as uploaded.
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // `from-image` bakes in EXIF orientation, so a rotated phone photo stays
    // upright after the canvas round-trip.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // undecodable in this browser (e.g. HEIC) — send the original
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale === 1) {
    bitmap.close?.();
    return file; // already within the cap — don't re-encode a fine image
  }

  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  // Halve repeatedly until within 2× of the target, then the final step. Big
  // one-shot reductions alias/soften; stepped resizing stays crisp.
  let canvas = drawScaled(bitmap, width, height, width, height);
  bitmap.close?.();
  let cw = width;
  let ch = height;
  while (cw > targetW * 2) {
    const nw = Math.max(targetW, Math.round(cw / 2));
    const nh = Math.max(targetH, Math.round(ch / 2));
    canvas = drawScaled(canvas, cw, ch, nw, nh);
    cw = nw;
    ch = nh;
  }
  if (cw !== targetW || ch !== targetH) {
    canvas = drawScaled(canvas, cw, ch, targetW, targetH);
  }

  const type = canEncodeWebp() ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob || blob.size >= file.size) {
    return file; // no real saving — keep the original rather than degrade it
  }

  const ext = type === "image/webp" ? "webp" : "jpg";
  const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
  return new File([blob], name, { type, lastModified: Date.now() });
}
