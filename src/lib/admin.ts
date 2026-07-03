import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns true when the signed-in user has the `is_admin` flag set on their
 * profile. Reads the caller's own row through the user session (RLS-safe).
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin === true;
}

/**
 * Page/action guard. Redirects non-admins away (signed-out users to sign-in,
 * everyone else home). Returns the admin user's id when authorized.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  if (!supabase) redirect("/");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_admin !== true) redirect("/");
  return user.id;
}
