"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAID_PLANS, type Plan } from "@/lib/account";

/**
 * Manually set a user's plan. This is a comp/override — it does NOT touch
 * Stripe billing. Use for granting complimentary access or fixing sync issues.
 */
export async function setUserPlan(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const plan = String(formData.get("plan") ?? "") as Plan;

  if (!userId) return;
  if (plan !== "free" && !PAID_PLANS.includes(plan)) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("profiles").update({ plan }).eq("id", userId);
  revalidatePath("/admin");
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
