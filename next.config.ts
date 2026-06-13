import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the private audio files into the streaming route's serverless
  // function so they're readable at runtime (they live outside `public/` and
  // are served only through the gated /api/stream handler).
  outputFileTracingIncludes: {
    "/api/stream/*": ["./private/audio/**/*"],
  },
};

export default nextConfig;
