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
      // Reference images upload through a Server Action (uploadReference), which
      // otherwise caps request bodies at 1 MB — a normal phone photo exceeds it
      // and the action throws "Body exceeded 1 MB limit". Keep this a touch
      // above the action's own 20 MB file cap to leave room for multipart
      // boundaries and the other form fields.
      bodySizeLimit: "22mb",
    },
  },
};

export default nextConfig;
