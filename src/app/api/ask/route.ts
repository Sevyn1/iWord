import { NextResponse } from "next/server";
import { getCurrentAccount, isPaidPlan } from "@/lib/account";
import { askCatalog } from "@/lib/ask";

/**
 * Ask iWord — POST { question } → { answer, sources }.
 *
 * Gated to paid plans (it spends OpenAI tokens per call); the /ask page shows
 * signed-out and free visitors an upgrade prompt instead of the form.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  }
  if (!isPaidPlan(account.plan)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  let question = "";
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await askCatalog(question);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ answer: result.answer, sources: result.sources });
}
