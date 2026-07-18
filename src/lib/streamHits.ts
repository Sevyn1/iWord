import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * IP-based throttling for the audio stream endpoint, backed by the
 * `stream_hits` table (see migration 005) and keyed on a hashed client IP so we
 * never store raw addresses:
 *
 *  - {@link recentHitCount}: a short sliding-window count that blocks bulk
 *    harvesting of signed URLs (a scraper enumerating every sermon).
 *
 * All helpers are best-effort: when the service-role client isn't configured
 * they degrade gracefully (no store → no throttling) rather than throw.
 */

/** Sliding-window rate limit: max stream starts per IP within the window. */
export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Best-effort client IP from proxy headers (Vercel sets `x-forwarded-for`). */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

/** Stable, non-reversible key for an IP (salted SHA-256). */
export function hashIp(ip: string): string {
  const salt = process.env.STREAM_IP_SALT ?? "iword-stream";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Number of stream starts from this ip_hash within the last `windowSeconds`. */
export async function recentHitCount(
  ipHash: string,
  windowSeconds: number = RATE_LIMIT_WINDOW_SECONDS
): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase) return 0;

  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabase
    .from("stream_hits")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  return count ?? 0;
}

/** Record a stream start for this ip_hash + sermon (powers both checks above). */
export async function recordStreamHit(
  ipHash: string,
  sermonId: string
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from("stream_hits").insert({ ip_hash: ipHash, sermon_id: sermonId });
}
