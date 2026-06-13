"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type FollowResult = { ok: boolean; following: boolean; error?: string };

/**
 * Follow or unfollow a pastor. Returns the new state so the client can update
 * optimistically. Redirects to sign-in if the visitor isn't authenticated.
 */
export async function toggleFollow(
  pastorId: string,
  currentlyFollowing: boolean,
): Promise<FollowResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, following: currentlyFollowing, error: "Supabase is not configured." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent("/pastors")}`);
  }

  if (currentlyFollowing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("user_id", user.id)
      .eq("pastor_id", pastorId);
    if (error) return { ok: false, following: true, error: error.message };
  } else {
    const { error } = await supabase
      .from("follows")
      .insert({ user_id: user.id, pastor_id: pastorId });
    if (error) return { ok: false, following: false, error: error.message };
  }

  revalidatePath("/account");
  revalidatePath("/pastors", "layout");
  return { ok: true, following: !currentlyFollowing };
}
