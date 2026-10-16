// PDF import limits, shared by the importer (which checks before sending) and
// the import action (which enforces them).

export const MAX_IMPORT_PAGES = 300;
export const MAX_IMPORT_PAGE_BYTES = 8 * 1024 * 1024;

// The whole import is one request, and the proxy (src/proxy.ts) buffers at most
// 10 MB of a request body (Next's default proxyClientMaxBodySize); past that the
// upload is cut off. Stay under it, with room for the form's text fields and
// multipart overhead.
export const MAX_IMPORT_BYTES = 9.5 * 1024 * 1024;

// Page images the importer produces: WebP, or JPEG where the browser can't
// encode WebP (Safari). PNG is accepted for imports from before the switch.
export const IMPORT_IMAGE_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

export function formatMB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
