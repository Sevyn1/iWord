import { createClient } from "@/lib/supabase/server";

/**
 * Returns the set of pastor ids the current user follows.
 * Empty set when signed out or Supabase isn't configured.
 */
export async function getFollowedPastorIds(): Promise<Set<string>> {
  const supabase = await createClient();
  if (!supabase) return new Set();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("follows")
    .select("pastor_id")
    .eq("user_id", user.id);

  return new Set((data ?? []).map((row) => row.pastor_id as string));
}

export async function isFollowingPastor(pastorId: string): Promise<boolean> {
  const ids = await getFollowedPastorIds();
  return ids.has(pastorId);
}
