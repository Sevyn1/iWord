import { NextResponse } from "next/server";
import { transcribePendingSermons, enrichTranscribedSermons } from "@/lib/ingestion/transcribe";
import { embedPendingSermons } from "@/lib/ingestion/embed";

/**
 * Scheduled transcription endpoint.
 *
 * Runs daily after the ingest cron (see vercel.json) and transcribes pending
 * sermons — newest first — until its time budget runs out. Anything left over
 * rolls to the next run, so the catalog converges on fully-transcribed without
 * manual work. Large backfills should use `npm run transcribe` locally instead.
 *
 * Auth: same CRON_SECRET bearer scheme as /api/cron/ingest.
 */
export const dynamic = "force-dynamic";
// Download + ffmpeg + Whisper for several sermons; needs the full window.
// Vercel clamps this to the plan's max (Hobby with Fluid compute allows 300s).
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Optional ?limit= for manual runs; the schedule uses the default batch.
  const requested = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 8) : 8;

  const startedAt = Date.now();
  const result = await transcribePendingSermons({ limit, timeBudgetMs: 200_000 });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  // Spend leftover time closing metadata gaps (scripture/duration) on sermons
  // transcribed before the pipeline learned to fill them.
  const enriched = await enrichTranscribedSermons({
    timeBudgetMs: Math.max(0, 250_000 - (Date.now() - startedAt)),
  });
  // …then embed any transcribed-but-unembedded sermons for Ask iWord. Cheap
  // and fast (text-only), so it usually clears the whole backlog here.
  const embedded = await embedPendingSermons({
    timeBudgetMs: Math.max(0, 280_000 - (Date.now() - startedAt)),
  });
  return NextResponse.json({ ...result, enriched, embedded });
}
