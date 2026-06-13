import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSermonById } from "@/lib/sermons";
import {
  getCurrentAccount,
  isPaidPlan,
  FREE_MONTHLY_STREAMS,
} from "@/lib/account";
import { getMonthlyListenedIds } from "@/lib/listens";

// Audio lives outside `public/` so it can't be fetched directly — every byte is
// served through this gated handler. The files are bundled into the serverless
// function via `outputFileTracingIncludes` in next.config.ts.
const AUDIO_DIR = path.join(process.cwd(), "private", "audio");

/**
 * Authoritative, permissioned audio gate. The client pre-checks the monthly cap
 * (to show the upgrade modal), but this endpoint is the source of truth and also
 * serves the raw audio bytes — so the asset path itself is protected and the cap
 * can't be bypassed by hitting a static URL.
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

  return streamAudio(sermon.audioUrl, range);
}

async function streamAudio(audioUrl: string, range: string | null) {
  const fileName = path.basename(audioUrl); // e.g. demo-1.wav
  const filePath = path.join(AUDIO_DIR, fileName);

  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: "asset_missing" }, { status: 404 });
  }

  const total = data.length;
  const baseHeaders: Record<string, string> = {
    "Content-Type": "audio/wav",
    "Accept-Ranges": "bytes",
    // Permissioned content: never let a shared cache/CDN store it.
    "Cache-Control": "private, no-store",
  };

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;

    if (start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
      });
    }

    const chunk = data.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${total}`,
      },
    });
  }

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
}

async function recordListen(userId: string, sermonId: string) {
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.from("listens").insert({ user_id: userId, sermon_id: sermonId });
}
