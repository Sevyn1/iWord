import { NextResponse } from "next/server";
import { ingestAllFeeds } from "@/lib/ingestion/orchestrator";

/**
 * Scheduled ingestion endpoint.
 *
 * Hit daily by Vercel Cron (see vercel.json). Runs the full ingestion pass:
 * optional Podcast Index discovery, then scan every active feed and add any new
 * episodes to the catalog.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
 * is set in the project env. We require it so the endpoint can't be triggered by
 * the public. If CRON_SECRET isn't configured the route refuses to run.
 */
export const dynamic = "force-dynamic";
// Ingestion fans out to network + AI calls; give it room. Raise on Vercel Pro
// if you add many feeds (Hobby caps at 60s).
export const maxDuration = 60;

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

  const result = await ingestAllFeeds();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  const added = result.results.reduce((sum, r) => sum + r.added, 0);
  const failed = result.results.filter((r) => !r.ok).length;
  return NextResponse.json({
    ok: true,
    feeds: result.results.length,
    discovered: result.discovered,
    added,
    failed,
    results: result.results,
  });
}
