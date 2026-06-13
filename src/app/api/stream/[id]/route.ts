import { NextResponse } from "next/server";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSermonById } from "@/lib/sermons";
import {
  getCurrentAccount,
  isPaidPlan,
  FREE_MONTHLY_STREAMS,
} from "@/lib/account";
import { getMonthlyListenedIds } from "@/lib/listens";
import { getSignedSermonUrl } from "@/lib/storage";

/**
 * Authoritative, permissioned audio gate. The client pre-checks the monthly cap
 * (to show the upgrade modal), but this endpoint is the source of truth: it
 * verifies the plan/quota, records the listen, then hands the listener a
 * short-lived signed Storage URL via redirect — object storage serves the bytes
 * (and Range/seek) directly, so the audio path is never publicly reachable and
 * the cap can't be bypassed.
 *
 * - Paid plans: always allowed.
 * - Signed-out users: allowed (no server identity to track; the client cap
 *   still applies for the session).
 * - Free plans: allowed if the sermon was already streamed this month, or if
 *   they're still under the monthly limit. Otherwise 403.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sermon = getSermonById(id);
  if (!sermon) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const account = await getCurrentAccount();

  // Decide whether this listener may stream this sermon.
  let allowed = false;
  if (!account || isPaidPlan(account.plan)) {
    allowed = true;
  } else {
    const monthly = new Set(await getMonthlyListenedIds());
    allowed = monthly.has(sermon.id) || monthly.size < FREE_MONTHLY_STREAMS;
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "stream_limit", limit: FREE_MONTHLY_STREAMS },
      { status: 403 }
    );
  }

  const range = request.headers.get("range");
  // Record the listen once per playback — on the initial (full or first-chunk)
  // request only, not on every seek's range request.
  const isInitialRequest = !range || /^bytes=0-/.test(range);
  if (account && isInitialRequest) {
    await recordListen(account.userId, sermon.id);
  }

  const objectKey = path.basename(sermon.audioUrl); // e.g. demo-1.wav

  // Hand the listener a short-lived signed URL and redirect, so object storage
  // serves the bytes (and Range requests) directly — the serverless function
  // never proxies the audio. The redirect is uncacheable so each playback
  // re-checks the gate and gets a fresh, expiring URL.
  const signedUrl = await getSignedSermonUrl(objectKey);
  if (!signedUrl) {
    return NextResponse.json({ error: "audio_unavailable" }, { status: 503 });
  }

  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function recordListen(userId: string, sermonId: string) {
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.from("listens").insert({ user_id: userId, sermon_id: sermonId });
}
