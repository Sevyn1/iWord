import * as Sentry from "@sentry/nextjs";

// Browser Sentry initialization. Next.js runs this before the app becomes
// interactive. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    debug: false,
  });
}

// Report App Router client-side navigations to Sentry (lightweight).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
