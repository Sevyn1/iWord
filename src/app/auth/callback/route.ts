import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";

/**
 * Email confirmation + OAuth callback. Supabase redirects here after the
 * magic link / OAuth provider returns a `code` we trade for a session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorTarget =
    next !== "/"
      ? `/auth/sign-in?error=Could+not+sign+you+in&next=${encodeURIComponent(next)}`
      : "/auth/sign-in?error=Could+not+sign+you+in";
  return NextResponse.redirect(`${origin}${errorTarget}`);
}
