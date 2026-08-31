import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
