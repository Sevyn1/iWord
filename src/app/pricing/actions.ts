"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PAID_PLANS, type Plan } from "@/lib/account";

/**
 * Sets the current user's subscription plan. This is a demo stand-in for a
 * real Stripe checkout — it simply records the chosen plan on the profile so
 * the rest of the app can tell paid members from free accounts.
 */
export async function selectPlan(formData: FormData): Promise<void> {
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

  const { error } = await supabase
    .from("profiles")
    .update({ plan })
    .eq("id", user.id);

  if (error) {
    redirect(`/pricing?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/account");
  redirect(plan === "free" ? "/pricing?canceled=1" : "/account?upgraded=1");
}
