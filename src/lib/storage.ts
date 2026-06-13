import { createAdminClient } from "@/lib/supabase/admin";

/** Private Supabase Storage bucket that holds sermon audio. */
export const SERMON_BUCKET = "sermons";

/** How long a minted signed URL stays valid (seconds). Generous enough to
 * cover a full listen + seeking, short enough that a leaked link expires. */
const DEFAULT_TTL_SECONDS = 60 * 60 * 2; // 2 hours

/**
 * Mint a short-lived signed URL for a sermon audio object so the browser can
 * stream it directly from object storage (with native Range support) instead of
 * proxying bytes through the serverless function.
 *
 * Returns `null` when Storage isn't configured or the object is missing, letting
 * the caller fall back to a local stream.
 */
export async function getSignedSermonUrl(
  key: string,
  expiresIn: number = DEFAULT_TTL_SECONDS
): Promise<string | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(SERMON_BUCKET)
    .createSignedUrl(key, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
