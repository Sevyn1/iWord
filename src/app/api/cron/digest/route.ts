import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/digest";

/**
 * Scheduled weekly digest send (Sundays — see vercel.json).
 * Auth: same CRON_SECRET bearer scheme as the other crons.
 * Degrades gracefully: without RESEND_API_KEY / RESEND_FROM it reports
 * `skipped` instead of failing.
 */
export const dynamic = "force-dynamic";
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

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit"));
  const limit = Number.isInteger(requested) && requested > 0 ? requested : undefined;
  const onlyEmail = url.searchParams.get("only") ?? undefined;

  const result = await sendWeeklyDigest({ timeBudgetMs: 250_000, limit, onlyEmail });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
