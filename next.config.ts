import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  // Source-map upload / release management. Read from env so the build works
  // with or without a Sentry account configured.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Only upload source maps when an auth token is present (i.e. in CI/Vercel
  // with SENTRY_AUTH_TOKEN set); otherwise skip cleanly.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  // Quiet build output unless running in CI.
  silent: !process.env.CI,
  telemetry: false,
});

