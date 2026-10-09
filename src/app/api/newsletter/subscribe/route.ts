import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Newsletter signup from the homepage digest strip. Upserts into
 * newsletter_subscribers; re-subscribing clears a previous unsubscribe.
 */
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = String(body.email ?? "")
      .trim()
      .toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json(
      { error: "Signups aren't available right now. Please try again later." },
      { status: 503 }
    );
  }

  const { error } = await db
    .from("newsletter_subscribers")
    .upsert({ email, source: "homepage", unsubscribed_at: null }, { onConflict: "email" });
  if (error) {
    return NextResponse.json(
      { error: "Couldn't save your signup. Please try again." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
