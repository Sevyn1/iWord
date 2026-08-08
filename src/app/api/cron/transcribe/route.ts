import { NextResponse } from "next/server";
import { transcribePendingSermons } from "@/lib/ingestion/transcribe";

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

  const result = await transcribePendingSermons({ limit, timeBudgetMs: 240_000 });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
