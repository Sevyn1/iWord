import { createAdminClient } from "@/lib/supabase/admin";
import type { TranscriptSegment } from "./transcribe";

/**
 * Embeddings for "Ask iWord" (see migration 014).
 *
 * Transcribed sermons are chunked into ~60-90s passages (grouped from their
 * Whisper segments, so every chunk knows its start/end time) and embedded with
 * OpenAI text-embedding-3-small. /api/ask embeds the user's question, calls
 * the match_sermon_chunks RPC, and answers with citations that deep-link to
 * the exact moment in the audio.
 *
 * This pass is independent of transcription: it reads transcript_segments off
 * the row, so it can run in the cron's leftover budget or via
 * scripts/embed-sermons.mjs for bulk backfills. Idempotent per sermon —
 * existing chunks are replaced.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

/** Target chunk shape: big enough to carry an idea, small enough to cite. */
const TARGET_CHARS = 1000;
const MAX_CHARS = 1600;
const TARGET_SECONDS = 90;

export type Chunk = { seq: number; startSec: number; endSec: number; text: string };

/** Group Whisper segments into overlapping-free, time-stamped passages. */
export function chunkSegments(segments: TranscriptSegment[]): Chunk[] {
  const chunks: Chunk[] = [];
  let buf: TranscriptSegment[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    const text = buf.map((s) => s.t).join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 40) {
      chunks.push({
        seq: chunks.length,
        startSec: buf[0].s,
        endSec: buf[buf.length - 1].e,
        text,
      });
    }
    buf = [];
  };

  for (const seg of segments) {
    if (!seg.t?.trim()) continue;
    buf.push(seg);
    const chars = buf.reduce((n, s) => n + s.t.length + 1, 0);
    const span = seg.e - buf[0].s;
    if (chars >= MAX_CHARS || (chars >= TARGET_CHARS && span >= 20) || span >= TARGET_SECONDS) {
      flush();
    }
  }
  flush();
  return chunks;
}

/** Embed a batch of texts. Throws on API errors (quota errors bubble up). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  // The embeddings endpoint accepts arrays; stay well under request limits.
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch, dimensions: EMBEDDING_DIM }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

/** Chunk + embed one sermon and replace its rows in sermon_chunks. */
export async function embedSermon(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  sermonId: string,
  segments: TranscriptSegment[]
): Promise<number> {
  const chunks = chunkSegments(segments);
  if (chunks.length === 0) throw new Error("no chunks produced");

  const embeddings = await embedTexts(chunks.map((c) => c.text));

  const { error: delErr } = await admin.from("sermon_chunks").delete().eq("sermon_id", sermonId);
  if (delErr) throw new Error(`chunk delete: ${delErr.message}`);

  const rows = chunks.map((c, i) => ({
    sermon_id: sermonId,
    seq: c.seq,
    start_sec: c.startSec,
    end_sec: c.endSec,
    text: c.text,
    embedding: embeddings[i],
  }));
  // Insert in modest batches to keep payloads small.
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await admin.from("sermon_chunks").insert(rows.slice(i, i + 50));
    if (error) throw new Error(`chunk insert: ${error.message}`);
  }
  return chunks.length;
}

/**
 * Embed sermons whose transcript is done but embedding is still pending.
 * Runs newest-first until the time budget runs out; quota errors stop the run
 * and leave rows pending so the next run resumes cleanly.
 */
export async function embedPendingSermons(options?: {
  limit?: number;
  timeBudgetMs?: number;
}): Promise<{ done: string[]; failed: { slug: string; error: string }[]; remaining: number }> {
  const limit = options?.limit ?? 40;
  const timeBudgetMs = options?.timeBudgetMs ?? 60_000;
  const startedAt = Date.now();
  const result = { done: [] as string[], failed: [] as { slug: string; error: string }[], remaining: 0 };

  const admin = createAdminClient();
  if (!admin || !process.env.OPENAI_API_KEY) return result;

  const { data, count } = await admin
    .from("sermons")
    .select("id, slug, transcript_segments", { count: "exact" })
    .eq("transcript_status", "done")
    .eq("embed_status", "pending")
    .not("transcript_segments", "is", "null")
    .order("published_at", { ascending: false })
    .limit(limit);
  result.remaining = count ?? 0;

  for (const s of data ?? []) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    try {
      await embedSermon(admin, s.id as string, (s.transcript_segments ?? []) as TranscriptSegment[]);
      await admin.from("sermons").update({ embed_status: "done" }).eq("id", s.id);
      result.done.push(s.slug as string);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      if (/insufficient_quota|exceeded your current quota|credit_balance_exhausted/i.test(message)) {
        result.failed.push({ slug: s.slug as string, error: "OpenAI quota exhausted; left pending" });
        break;
      }
      result.failed.push({ slug: s.slug as string, error: message });
      await admin.from("sermons").update({ embed_status: "failed" }).eq("id", s.id);
    }
  }

  result.remaining = Math.max(0, result.remaining - result.done.length - result.failed.length);
  return result;
}
