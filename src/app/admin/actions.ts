"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAID_PLANS, type Plan } from "@/lib/account";
import { getStripe, priceIdForPlan } from "@/lib/stripe";

const PLAN_RANK: Record<Plan, number> = { free: 0, devoted: 1, patron: 2 };

/** Subscription statuses where the member is being billed by Stripe. */
const BILLED_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Land back on the dashboard with a status banner. */
function finish(notice: string): never {
  revalidatePath("/admin");
  redirect(`/admin?notice=${encodeURIComponent(notice)}`);
}

/**
 * Set a user's plan.
 *
 * Members without active Stripe billing: plain profile override (comps, fixing
 * sync issues). Members with an active subscription: the change is made in
 * Stripe so billing always matches access —
 *   · downgrade to a lower paid tier → subscription schedule swaps the price at
 *     period end (they keep what they paid for, then get charged the new rate)
 *   · downgrade to free → cancel at period end
 *   · upgrade → refused; only the member can consent to higher charges
 * The Stripe webhook syncs `profiles.plan` when each change takes effect.
 */
export async function setUserPlan(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const plan = String(formData.get("plan") ?? "") as Plan;

  if (!userId) return;
  if (plan !== "free" && !PAID_PLANS.includes(plan)) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, stripe_status")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return;
  if (profile.plan === plan) return;

  const subscriptionId = profile.stripe_subscription_id as string | null;
  const billed =
    Boolean(subscriptionId) && BILLED_STATUSES.has(profile.stripe_status ?? "");
  const stripe = billed ? getStripe() : null;

  // No active billing (or Stripe not configured): plain comp/override.
  if (!billed || !stripe) {
    await admin.from("profiles").update({ plan }).eq("id", userId);
    revalidatePath("/admin");
    return;
  }

  if (PLAN_RANK[plan] > PLAN_RANK[profile.plan as Plan]) {
    finish(
      "This member has an active subscription — upgrades that raise their charges need their consent, so they must upgrade themselves from the pricing page."
    );
  }

  if (plan === "free") {
    await stripe.subscriptions.update(subscriptionId!, {
      cancel_at_period_end: true,
    });
    finish(
      "Subscription set to cancel at period end. They keep their current plan until then; the webhook drops them to Seeker when it lapses."
    );
  }

  // Paid → lower paid tier: schedule the cheaper price for the next period.
  const newPriceId = priceIdForPlan(plan);
  if (!newPriceId) {
    finish("Stripe price for the target plan isn't configured — no change made.");
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId!);
  const item = sub.items.data[0];
  const existingScheduleId =
    typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
  const schedule = existingScheduleId
    ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
    : await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
  const currentPhase = schedule.phases[0];

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: [{ price: item.price.id, quantity: item.quantity ?? 1 }],
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date,
      },
      { items: [{ price: newPriceId, quantity: 1 }] },
    ],
  });

  finish(
    "Downgrade scheduled in Stripe. They keep their current plan until the period ends, then are billed at the lower rate; the webhook updates their plan automatically."
  );
}

/**
 * Grant or revoke admin access for a user. Only the service role can flip this
 * column (enforced by a DB trigger), so it must go through the admin client.
 */
export async function setUserAdmin(formData: FormData) {
  const currentAdminId = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const makeAdmin = String(formData.get("isAdmin") ?? "") === "true";

  if (!userId) return;
  // Prevent an admin from removing their own access (avoid lockout).
  if (userId === currentAdminId && !makeAdmin) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("profiles").update({ is_admin: makeAdmin }).eq("id", userId);
  revalidatePath("/admin");
}
