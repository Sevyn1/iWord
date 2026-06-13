import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresh the Supabase session cookies on every request so server components
 * always see an up-to-date user. No-op if Supabase isn't configured yet.
 *
 * In Next.js 16 this file convention is named `proxy` (formerly `middleware`).
 */
export async function proxy(request: NextRequest) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() triggers the session refresh.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and audio.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav|mp3|m4a)$).*)",
  ],
};
