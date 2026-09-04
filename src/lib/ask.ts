import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/ingestion/embed";

/**
 * "Ask iWord" — answers grounded in the sermon catalog.
 *
 * Embed the question, pull the nearest transcript passages via the
 * match_sermon_chunks RPC (migration 014), and have GPT compose an answer that
 * cites passages as [1], [2], … Each citation deep-links to the exact moment
 * in the sermon audio (/sermons/[slug]?t=SECONDS).
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANSWER_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MATCH_COUNT = 10;
const MIN_SIMILARITY = 0.2;

export type AskSource = {
  n: number;
  sermonId: string;
  slug: string;
  title: string;
  pastor: string;
  church: string;
  /** Where the cited passage starts, in whole seconds. */
  startSec: number;
  /** A short quote from the passage for the citation card. */
  quote: string;
};

export type AskResult =
  | { ok: true; answer: string; sources: AskSource[] }
  | { ok: false; error: string; status: number };

type MatchRow = {
  sermon_id: string;
  slug: string;
  title: string;
  pastor_name: string;
  church: string;
  start_sec: number;
  end_sec: number;
  chunk_text: string;
  similarity: number;
};

const SYSTEM_PROMPT =
  "You are the study assistant for iWord, a sermon listening platform. " +
  "You answer questions using ONLY the sermon passages provided — never outside knowledge, and never your own theology. " +
  "Write warmly and plainly, like a thoughtful friend, in 1-3 short paragraphs. " +
  "Cite passages inline with bracketed numbers like [1] or [2][4] immediately after the claims they support; only cite passages you actually drew on. " +
  "If the passages don't really address the question, say so honestly and briefly mention what nearby topics they do cover. " +
  "Do not give medical, legal, or crisis advice; for a crisis, gently suggest talking to a pastor or counselor. " +
  'Respond ONLY with JSON: {"answer": string}';

/** Answer a question from the catalog. Never throws; returns a typed error. */
export async function askCatalog(question: string): Promise<AskResult> {
  const q = question.trim().replace(/\s+/g, " ");
  if (q.length < 3) return { ok: false, error: "Ask a fuller question.", status: 400 };
  if (q.length > 300) return { ok: false, error: "Keep questions under 300 characters.", status: 400 };

  const admin = createAdminClient();
  if (!admin || !process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Ask iWord isn't configured on this server.", status: 503 };
  }

  let embedding: number[];
  try {
    [embedding] = await embedTexts([q]);
  } catch (err) {
    return openAIFailure(err);
  }

  const { data, error } = await admin.rpc("match_sermon_chunks", {
    query_embedding: embedding,
    match_count: MATCH_COUNT,
    min_similarity: MIN_SIMILARITY,
  });
  if (error) return { ok: false, error: `search failed: ${error.message}`, status: 500 };

  const matches = (data ?? []) as MatchRow[];
  if (matches.length === 0) {
    return {
      ok: true,
      answer:
        "I couldn't find anything in the sermon library that speaks to that yet. " +
        "Try rewording your question, or browse the catalog — new sermons are transcribed daily.",
      sources: [],
    };
  }

  const passages = matches
    .map(
      (m, i) =>
        `[${i + 1}] From "${m.title}"${m.pastor_name ? ` by ${m.pastor_name}` : ""}:\n${m.chunk_text}`
    )
    .join("\n\n");

  let raw: string | null;
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: ANSWER_MODEL,
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Question: ${q}\n\nSermon passages:\n\n${passages}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    raw = body.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    return openAIFailure(err);
  }

  let answer = "";
  try {
    answer = String((JSON.parse(raw ?? "{}") as { answer?: string }).answer ?? "").trim();
  } catch {
    answer = (raw ?? "").trim();
  }
  if (!answer) return { ok: false, error: "The assistant returned an empty answer. Try again.", status: 502 };

  // Only surface sources the answer actually cites, renumbered 1..n in order
  // of first appearance so the text and the cards always agree.
  const cited = Array.from(new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), (m) => Number(m[1]))))
    .filter((n) => n >= 1 && n <= matches.length);
  const order = cited.length > 0 ? cited : matches.slice(0, 3).map((_, i) => i + 1);
  const renumber = new Map(order.map((oldN, i) => [oldN, i + 1]));
  answer = answer.replace(/\[(\d+)\]/g, (whole, d) => {
    const n = renumber.get(Number(d));
    return n ? `[${n}]` : "";
  });

  const sources: AskSource[] = order.map((oldN, i) => {
    const m = matches[oldN - 1];
    return {
      n: i + 1,
      sermonId: m.sermon_id,
      slug: m.slug,
      title: m.title,
      pastor: m.pastor_name,
      church: m.church,
      startSec: Math.max(0, Math.floor(m.start_sec)),
      quote: m.chunk_text.length > 220 ? `${m.chunk_text.slice(0, 220).trimEnd()}…` : m.chunk_text,
    };
  });

  return { ok: true, answer, sources };
}

function openAIFailure(err: unknown): AskResult {
  const message = err instanceof Error ? err.message : "unknown error";
  if (/insufficient_quota|exceeded your current quota|credit_balance_exhausted/i.test(message)) {
    return { ok: false, error: "Ask iWord is temporarily unavailable. Please try again later.", status: 503 };
  }
  return { ok: false, error: "Something went wrong answering that. Please try again.", status: 502 };
}
