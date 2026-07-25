import * as Sentry from "@sentry/nextjs";

// Runs once per server instance. Loads the runtime-appropriate Sentry config.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Captures errors thrown while rendering Server Components / Route Handlers.
export const onRequestError = Sentry.captureRequestError;
