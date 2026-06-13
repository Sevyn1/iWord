import Stripe from "stripe";
import type { Plan } from "@/lib/account";

/**
 * Server-only Stripe client. Returns `null` when `STRIPE_SECRET_KEY` isn't set
 * so the app can fall back to "demo billing" (set the plan directly without a
 * real charge). Never import this into client components.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/** Whether real Stripe billing is configured (vs. the demo plan-set fallback). */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_DEVOTED &&
      process.env.STRIPE_PRICE_PATRON
  );
}

/** Stripe Price id for a paid plan, from env. */
export function priceIdForPlan(plan: Plan): string | null {
  switch (plan) {
    case "devoted":
      return process.env.STRIPE_PRICE_DEVOTED ?? null;
    case "patron":
      return process.env.STRIPE_PRICE_PATRON ?? null;
    default:
      return null;
  }
}

/** Reverse map: which plan a given Stripe Price id corresponds to. */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_DEVOTED) return "devoted";
  if (priceId === process.env.STRIPE_PRICE_PATRON) return "patron";
  return null;
}
