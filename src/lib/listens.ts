import { createClient } from "@/lib/supabase/server";

/**
 * Returns the user's recently played sermon ids, most recent first, de-duped.
 * Empty when signed out or Supabase isn't configured.
 */
export async function getRecentSermonIds(limit = 8): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("listens")
    .select("sermon_id, listened_at")
    .eq("user_id", user.id)
    .order("listened_at", { ascending: false })
    .limit(60);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of data ?? []) {
    const id = row.sermon_id as string;
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
      if (ordered.length >= limit) break;
    }
  }
  return ordered;
}

/**
 * Distinct sermon ids the current user has streamed in the current calendar
 * month — used to enforce the free plan's monthly streaming cap.
 * Empty when signed out or Supabase isn't configured.
 */
export async function getMonthlyListenedIds(): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const { data } = await supabase
    .from("listens")
    .select("sermon_id")
    .eq("user_id", user.id)
    .gte("listened_at", monthStart);

  return Array.from(new Set((data ?? []).map((row) => row.sermon_id as string)));
}
