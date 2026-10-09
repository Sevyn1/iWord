import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Token-based one-click unsubscribe (linked from every digest email).
 * Returns a small friendly page rather than JSON since it's opened in a browser.
 */
export const dynamic = "force-dynamic";

function page(title: string, message: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — ${SITE_NAME}</title></head>
<body style="margin:0;background:#f5efe2;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;padding:32px;max-width:420px;">
    <div style="font-size:22px;color:#1B2138;"><span style="color:#B5853A;">i</span>Word</div>
    <h1 style="font-size:24px;color:#1B2138;margin:18px 0 8px;">${title}</h1>
    <p style="font-size:15px;color:#4c4639;line-height:1.6;">${message}</p>
    <a href="${SITE_URL}" style="display:inline-block;margin-top:16px;padding:10px 22px;border-radius:999px;background:#B5853A;color:#fff;text-decoration:none;font-size:14px;">Back to ${SITE_NAME}</a>
  </div>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return page("Something's missing", "This unsubscribe link looks incomplete.");

  const db = createAdminClient();
  if (!db) return page("Try again later", "We couldn't process this right now.");

  const { data, error } = await db
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("token", token)
    .select("email")
    .maybeSingle();

  if (error || !data) {
    return page("Link not recognized", "This unsubscribe link is invalid or was already used.");
  }
  return page(
    "You're unsubscribed",
    "You won't receive the weekly digest anymore. You can re-subscribe any time from the homepage."
  );
}
