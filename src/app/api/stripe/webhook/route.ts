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
          await syncSubscription(subscription, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await syncSubscription(subscription, null);
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

/** Map a Stripe subscription to a plan and persist it on the profile. */
async function syncSubscription(
  subscription: Stripe.Subscription,
  userIdHint: string | null
) {
  const supabase = createAdminClient();
  if (!supabase) return;

  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price?.id ?? null;

  // Active/trialing → the subscribed plan; otherwise drop to free.
  const isActive = status === "active" || status === "trialing";
  const plan: Plan = isActive ? planForPriceId(priceId) ?? "free" : "free";

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const update = {
    plan,
    stripe_subscription_id: subscription.id,
    stripe_status: status,
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
