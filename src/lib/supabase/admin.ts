import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for trusted server-side work (minting signed
 * Storage URLs, admin reads). It bypasses Row Level Security, so it must NEVER
 * be imported into client components or exposed to the browser — keep it behind
 * route handlers / server-only libs.
 *
 * Returns `null` when the service-role key isn't configured, so callers can
 * gracefully fall back (e.g. the stream route streams from disk instead).
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
