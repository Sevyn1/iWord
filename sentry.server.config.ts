import * as Sentry from "@sentry/nextjs";

// Server-side (Node.js runtime) Sentry initialization. Loaded from
// `src/instrumentation.ts` via `register()`. No-op until a DSN is configured,
// so local dev and preview deploys without Sentry stay completely silent.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Keep tracing light on launch; override with SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    debug: false,
  });
}
