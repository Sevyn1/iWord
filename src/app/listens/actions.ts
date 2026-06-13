"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Record that the current user started listening to a sermon.
 * Silent no-op when signed out or Supabase isn't configured — playback should
 * never be blocked by analytics.
 */
export async function recordListen(sermonId: string): Promise<void> {
  if (!sermonId) return;
  const supabase = await createClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("listens").insert({ user_id: user.id, sermon_id: sermonId });
}
