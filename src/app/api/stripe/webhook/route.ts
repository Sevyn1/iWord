import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/account";

// Stripe needs the raw, unparsed body to verify the signature.
export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the source of truth for a member's plan. Checkout and the
 * billing portal only start flows; this handler reacts to the resulting
 * subscription events and writes `plan` (+ Stripe ids/status) to the profile
 * using the service-role client (no user session is present here).
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "billing_unconfigured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId =
          session.client_reference_id ??
          session.metadata?.supabase_user_id ??
          null;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            String(session.subscription)
          );
          await syncSubscription(stripe, subscription, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await syncSubscription(stripe, subscription, null);
        break;
      }
      default:
        // Ignore unrelated events.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Higher rank wins when a customer briefly holds more than one subscription. */
const PLAN_RANK: Record<Plan, number> = { free: 0, devoted: 1, patron: 2 };

/**
 * Resolve a member's effective plan from *all* their active subscriptions
 * rather than the single one in the current event. This keeps a member on
 * their highest active tier even when another (e.g. duplicate) subscription
 * is canceled.
 */
async function resolvePlanForCustomer(
  stripe: Stripe,
  customerId: string
): Promise<{ plan: Plan; subscriptionId: string | null; status: string }> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  let best: { plan: Plan; subscriptionId: string | null; status: string } = {
    plan: "free",
    subscriptionId: null,
    status: "canceled",
  };

  for (const sub of subs.data) {
    const isActive = sub.status === "active" || sub.status === "trialing";
    if (!isActive) continue;
    const plan = planForPriceId(sub.items.data[0]?.price?.id ?? null) ?? "free";
    if (PLAN_RANK[plan] > PLAN_RANK[best.plan]) {
      best = { plan, subscriptionId: sub.id, status: sub.status };
    }
  }

  return best;
}

/** Recompute a member's plan from Stripe and persist it on the profile. */
async function syncSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  userIdHint: string | null
) {
  const supabase = createAdminClient();
  if (!supabase) return;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Source the plan from the customer's current active subscriptions so that
  // canceling one of several subscriptions doesn't wrongly drop the member.
  const resolved = await resolvePlanForCustomer(stripe, customerId);

  const update = {
    plan: resolved.plan,
    stripe_subscription_id: resolved.subscriptionId ?? subscription.id,
    stripe_status: resolved.subscriptionId ? resolved.status : subscription.status,
  };

  // Match by the Stripe customer id (set on the profile during checkout).
  const { data } = await supabase
    .from("profiles")
    .update(update)
    .eq("stripe_customer_id", customerId)
    .select("id");

  // Fallback for the very first event: no profile carries this customer id yet,
  // so match by the user id from checkout metadata and backfill the customer id.
  if ((!data || data.length === 0) && userIdHint) {
    await supabase
      .from("profiles")
      .update({ ...update, stripe_customer_id: customerId })
      .eq("id", userIdHint);
  }
}
