// How a reference looks wherever it's shown: its image, or, for a link
// reference, a tile with the site's name. A reference is one or the other
// (Reference.assetId vs Reference.url); callers never branch on it themselves.

export type RefSource = { assetId: string | null; url: string | null };

/** "www.pinterest.com/pin/123" → "pinterest.com". */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function LinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </svg>
  );
}

/**
 * The reference's visual. `className` lands on the <img> for an image, or on
 * the link tile, so each caller keeps its own sizing.
 */
export function RefVisual({
  source,
  alt,
  className,
  lazy,
}: {
  source: RefSource;
  alt: string;
  className?: string;
  lazy?: boolean;
}) {
  if (source.assetId) {
    // Plain <img>: bytes come from the session-gated /api/assets route, so
    // Next's image optimizer would only add a hop.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={`/api/assets/${source.assetId}`} alt={alt} loading={lazy ? "lazy" : undefined} />;
  }
  return (
    <span className={`ref-linktile${className ? ` ${className}` : ""}`} role="img" aria-label={alt}>
      <LinkGlyph />
      <span className="ref-linktile-host">{source.url ? linkHost(source.url) : "Link"}</span>
    </span>
  );
}

/** "Open link" for a link reference; nothing for an image. */
export function RefOpenLink({ source, className }: { source: RefSource; className?: string }) {
  if (!source.url) return null;
  return (
    <a className={className} href={source.url} target="_blank" rel="noopener noreferrer">
      Open {linkHost(source.url)}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="13" height="13">
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
