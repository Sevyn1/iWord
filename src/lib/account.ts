import { createClient } from "@/lib/supabase/server";

export type Plan = "free" | "devoted" | "patron";

export const PAID_PLANS: Plan[] = ["devoted", "patron"];

/** Number of distinct sermons a free (Seeker) member may stream per month. */
export const FREE_MONTHLY_STREAMS = 3;

export function isPaidPlan(plan: Plan | null | undefined): boolean {
  return plan === "devoted" || plan === "patron";
}

export function planLabel(plan: Plan): string {
  switch (plan) {
    case "devoted":
      return "Devoted";
    case "patron":
      return "Patron";
    default:
      return "Seeker";
  }
}

type Account = {
  userId: string;
  email: string;
  plan: Plan;
};

/**
 * Returns the current signed-in user along with their subscription plan,
 * or null when signed out / Supabase isn't configured.
 */
export async function getCurrentAccount(): Promise<Account | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan as Plan | undefined) ?? "free";

  return { userId: user.id, email: user.email ?? "", plan };
}
