import Stripe from "stripe";
import type { Plan } from "@/lib/account";

export type StripeMode = "test" | "live";

/**
 * Which Stripe environment to use, from `STRIPE_MODE` ("test" | "live").
 * Defaults to "test" so a misconfigured deploy never accidentally charges
 * real cards.
 */
export function stripeMode(): StripeMode {
  return process.env.STRIPE_MODE === "live" ? "live" : "test";
}

/**
 * Read a Stripe env var, preferring a mode-specific override
 * (e.g. `STRIPE_SECRET_KEY_LIVE`) and falling back to the base name
 * (`STRIPE_SECRET_KEY`). This lets you keep both the test and live values
 * defined at once and flip between them with a single `STRIPE_MODE` flag —
 * no code changes and no risk of overwriting the other environment's keys.
 */
function stripeEnv(name: string): string | undefined {
  const suffixed = process.env[`${name}_${stripeMode().toUpperCase()}`];
  return suffixed ?? process.env[name];
}

/**
 * Server-only Stripe client. Returns `null` when no secret key is set
 * so the app can fall back to "demo billing" (set the plan directly without a
 * real charge). Never import this into client components.
 */
export function getStripe(): Stripe | null {
  const key = stripeEnv("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key);
}

/** The active Stripe webhook signing secret for the current mode. */
export function getStripeWebhookSecret(): string | undefined {
  return stripeEnv("STRIPE_WEBHOOK_SECRET");
}

/** Whether real Stripe billing is configured (vs. the demo plan-set fallback). */
export function isStripeConfigured(): boolean {
  return Boolean(
    stripeEnv("STRIPE_SECRET_KEY") &&
      stripeEnv("STRIPE_PRICE_DEVOTED") &&
      stripeEnv("STRIPE_PRICE_PATRON")
  );
}

/** Stripe Price id for a paid plan, from env. */
export function priceIdForPlan(plan: Plan): string | null {
  switch (plan) {
    case "devoted":
      return stripeEnv("STRIPE_PRICE_DEVOTED") ?? null;
    case "patron":
      return stripeEnv("STRIPE_PRICE_PATRON") ?? null;
    default:
      return null;
  }
}

/** Reverse map: which plan a given Stripe Price id corresponds to. */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === stripeEnv("STRIPE_PRICE_DEVOTED")) return "devoted";
  if (priceId === stripeEnv("STRIPE_PRICE_PATRON")) return "patron";
  return null;
}
