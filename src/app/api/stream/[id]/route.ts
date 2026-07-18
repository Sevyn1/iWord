import { NextResponse } from "next/server";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSermonById } from "@/lib/content";
import {
  getCurrentAccount,
  isPaidPlan,
  FREE_MONTHLY_STREAMS,
} from "@/lib/account";
import { getMonthlyListenedIds } from "@/lib/listens";
import { getSignedSermonUrl } from "@/lib/storage";
import {
  ANON_MONTHLY_STREAMS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_SECONDS,
  anonymousMonthlyIds,
  getClientIp,
  hashIp,
  recentHitCount,
  recordStreamHit,
} from "@/lib/streamHits";

/**
 * Authoritative, permissioned audio gate. The client pre-checks the monthly cap
 * (to show the upgrade modal), but this endpoint is the source of truth: it
 * verifies the plan/quota, records the listen, then hands the listener a
 * short-lived signed Storage URL via redirect — object storage serves the bytes
 * (and Range/seek) directly, so the audio path is never publicly reachable and
 * the cap can't be bypassed.
 *
 * - Paid plans: always allowed.
 * - Free plans: allowed if the sermon was already streamed this month, or if
 *   they're still under the monthly limit. Otherwise 403.
 * - Signed-out users: allowed up to a per-IP monthly sample cap (there's no
 *   server identity to track, so the free cap is enforced by IP instead).
 *
 * On top of the plan/quota gate, every stream start is rate-limited per IP to
 * stop bulk harvesting of the signed URLs (429 when the window is exceeded).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sermon = await getSermonById(id);
  if (!sermon) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const account = await getCurrentAccount();
  const clientIp = getClientIp(request);
  const ipHash = clientIp ? hashIp(clientIp) : null;

  const range = request.headers.get("range");
  // A "stream start" is the initial (full or first-chunk) request — not the
  // seek/range requests. We gate, rate-limit, and record on starts only.
  const isInitialRequest = !range || /^bytes=0-/.test(range);

  // Decide whether this listener may stream this sermon.
  let allowed = false;
  if (isPaidPlan(account?.plan)) {
    allowed = true;
  } else if (account) {
    const monthly = new Set(await getMonthlyListenedIds());
    allowed = monthly.has(sermon.id) || monthly.size < FREE_MONTHLY_STREAMS;
  } else if (ipHash) {
    // Anonymous: cap distinct sermons per IP per month.
    const monthly = new Set(await anonymousMonthlyIds(ipHash));
    allowed = monthly.has(sermon.id) || monthly.size < ANON_MONTHLY_STREAMS;
  } else {
    // No identity and no resolvable IP (unusual) — allow this single request.
    allowed = true;
  }

  if (!allowed) {
    return NextResponse.json(
      {
        error: "stream_limit",
        limit: account ? FREE_MONTHLY_STREAMS : ANON_MONTHLY_STREAMS,
      },
      { status: 403 }
    );
  }

  // Rate limit stream starts per IP to block bulk harvesting of signed URLs.
  if (ipHash && isInitialRequest) {
    const recent = await recentHitCount(ipHash);
    if (recent >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) },
        }
      );
    }
  }

  // Record the listen once per playback — on the initial request only, not on
  // every seek. Authenticated listens power the free cap + "recently played";
  // the per-IP hit powers the anonymous cap and rate limit.
  if (isInitialRequest) {
    if (account) await recordListen(account.userId, sermon.id);
    if (ipHash) await recordStreamHit(ipHash, sermon.id);
  }

  // Resolve the audio source. Ingested (podcast) sermons carry a full external
  // enclosure URL — we stream those from the source. Uploaded sermons store a
  // Storage object key, which we hand back as a short-lived signed URL. Either
  // way we redirect so object storage / the source serves the bytes (and Range
  // requests) directly — the serverless function never proxies the audio.
  const isExternal = /^https?:\/\//i.test(sermon.audioUrl);
  let target = isExternal
    ? sermon.audioUrl
    : await getSignedSermonUrl(path.basename(sermon.audioUrl));
  if (!target) {
    return NextResponse.json({ error: "audio_unavailable" }, { status: 503 });
  }

  // A browser on our HTTPS site will refuse to load an insecure http:// audio
  // resource (mixed content), so some feeds' enclosures won't play. Resolve the
  // redirect chain server-side to obtain the final URL, which is virtually
  // always HTTPS, and hand the listener that instead.
  if (/^http:\/\//i.test(target)) {
    target = (await resolveHttpsUrl(target)) ?? target.replace(/^http:\/\//i, "https://");
  }

  return NextResponse.redirect(target, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function recordListen(userId: string, sermonId: string) {
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.from("listens").insert({ user_id: userId, sermon_id: sermonId });
}

/**
 * Follow an insecure http:// enclosure's redirects server-side to discover the
 * final URL (podcast tracking links almost always land on an HTTPS asset). We
 * try a HEAD first (cheap), then fall back to a ranged GET for hosts that don't
 * support HEAD. Returns the resolved URL only if it's HTTPS, else null.
 */
async function resolveHttpsUrl(url: string): Promise<string | null> {
  for (const init of [
    { method: "HEAD" as const },
    { method: "GET" as const, headers: { Range: "bytes=0-0" } },
  ]) {
    try {
      const res = await fetch(url, { ...init, redirect: "follow" });
      if (res.ok && /^https:\/\//i.test(res.url)) return res.url;
    } catch {
      /* try next strategy */
    }
  }
  return null;
}
