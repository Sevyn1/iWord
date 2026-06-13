"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { PAID_PLANS, type Plan } from "@/lib/account";
import { getStripe, isStripeConfigured, priceIdForPlan } from "@/lib/stripe";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Begin a subscription change for the signed-in user.
 *
 * - With Stripe configured: paid plans open a Checkout Session; downgrading to
 *   free opens the billing portal (so the subscription is canceled there).
 * - Without Stripe (demo mode): the plan is written directly to the profile,
 *   matching the pre-billing behaviour so the app still works locally.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const plan = String(formData.get("plan") ?? "") as Plan;
  if (plan !== "free" && !PAID_PLANS.includes(plan)) {
    redirect("/pricing?error=Invalid%20plan");
  }

  const supabase = await createClient();
  if (!supabase) redirect("/pricing?error=Billing%20unavailable");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=/pricing`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  // Demo mode — no real billing configured. Keep the old direct-set behaviour.
  if (!isStripeConfigured()) {
    const { error } = await supabase
      .from("profiles")
      .update({ plan })
      .eq("id", user.id);
    if (error) redirect(`/pricing?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/", "layout");
    revalidatePath("/account");
    redirect(plan === "free" ? "/pricing?canceled=1" : "/account?upgraded=1");
  }

  const stripe = getStripe();
  if (!stripe) redirect("/pricing?error=Billing%20unavailable");

  const baseUrl = await getBaseUrl();

  // Downgrade to free → manage/cancel the live subscription in the portal.
  if (plan === "free") {
    if (profile?.stripe_customer_id) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${baseUrl}/account`,
      });
      redirect(portal.url);
    }
    // No subscription on file — nothing to cancel.
    redirect("/account");
  }

  const priceId = priceIdForPlan(plan);
  if (!priceId) redirect("/pricing?error=Plan%20not%20available");

  const customerId = await ensureCustomer(
    stripe,
    supabase,
    user.id,
    user.email ?? undefined,
    profile?.stripe_customer_id ?? null
  );

  // Already subscribed → change the existing subscription's price in place
  // (Stripe prorates the difference) instead of opening a second subscription.
  const existing = await getActiveSubscription(stripe, customerId);
  if (existing) {
    const item = existing.items.data[0];
    const alreadyOnPlan =
      item?.price?.id === priceId && !existing.cancel_at_period_end;

    if (!alreadyOnPlan && item) {
      await stripe.subscriptions.update(existing.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        metadata: { supabase_user_id: user.id, plan },
      });
      // Optimistic write so /account reflects immediately; the webhook remains
      // the source of truth and will reconcile the same value.
      await supabase.from("profiles").update({ plan }).eq("id", user.id);
    }

    revalidatePath("/", "layout");
    revalidatePath("/account");
    redirect("/account?upgraded=1");
  }

  // First-time subscriber → start a Checkout Session.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { supabase_user_id: user.id, plan },
    subscription_data: { metadata: { supabase_user_id: user.id } },
    allow_promotion_codes: true,
    success_url: `${baseUrl}/account?upgraded=1`,
    cancel_url: `${baseUrl}/pricing?canceled=1`,
  });

  if (!session.url) redirect("/pricing?error=Could%20not%20start%20checkout");
  redirect(session.url);
}

/** Open the Stripe billing portal so a paid member can manage/cancel. */
export async function manageBilling(): Promise<void> {
  const supabase = await createClient();
  if (!supabase) redirect("/account?error=Billing%20unavailable");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=/account`);

  const stripe = getStripe();
  if (!stripe) redirect("/account?error=Billing%20unavailable");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    redirect("/pricing");
  }

  const baseUrl = await getBaseUrl();
  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${baseUrl}/account`,
  });
  redirect(portal.url);
}

/** The member's current active (or trialing) subscription, if any. */
async function getActiveSubscription(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  return (
    subs.data.find(
      (s) => s.status === "active" || s.status === "trialing"
    ) ?? null
  );
}

/** Find or create the Stripe customer for a user and persist its id. */
async function ensureCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  userId: string,
  email: string | undefined,
  existingCustomerId: string | null
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}
