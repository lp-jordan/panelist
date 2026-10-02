import type { NextConfig } from "next";

// Headers for every response. The Content-Security-Policy is per request (it
// carries a nonce), so it's set in src/proxy.ts instead.
const securityHeaders = [
  // Never load Panelist inside another site's frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let the browser guess a file's type from its contents.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin, never full page URLs, to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HTTPS only, for a year (browsers ignore this over plain http).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Features the app never uses stay off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // @react-pdf/renderer is a client-only PDF generator (used by the additive
  // "Download PDF" export). Keep it out of the server bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      // Server Actions cap request bodies at 1 MB by default. Two actions take
      // files: reference images (20 MB cap) and PDF import, which sends every
      // rasterized page at once (createImportedScript caps the total at
      // 150 MB). Sit a little above the largest so multipart overhead and the
      // other form fields fit; each action still enforces its own limit.
      bodySizeLimit: "160mb",
    },
  },
};

export default nextConfig;
