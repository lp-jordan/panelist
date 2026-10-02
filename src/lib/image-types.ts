// Image types Panelist will store and serve back from its own origin. Raster
// formats only: SVG is also "image/*" but can carry script, and the type comes
// from the uploading browser, so it can't be trusted to mean "harmless image".
export const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
