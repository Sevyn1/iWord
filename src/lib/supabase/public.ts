import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookieless anon Supabase client for reading publicly-readable content
 * (churches, pastors, published sermons). Unlike the cookie-based server
 * client it has no request coupling, so it is safe to call from
 * `generateMetadata`, OpenGraph image routes, and the sitemap.
 *
 * Row Level Security still applies (anon key), so unpublished draft sermons
 * remain hidden. Returns `null` when Supabase isn't configured, letting
 * callers fall back to the bundled seed content.
 */
export function createPublicClient(): SupabaseClient | null {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  return createSupabaseClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
