import { spawn } from "node:child_process";
import { openAsBlob } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractScriptureFromTranscript, pickExcerptWindow } from "./enrich";

/**
 * Whisper transcription for ingested sermons (see migration 012).
 *
 * Pipeline per sermon: download audio → downsample to 16 kHz mono Opus with the
 * bundled ffmpeg (~7 MB/hour, so long messages fit Whisper's 25 MB cap in one
 * call) → OpenAI /v1/audio/transcriptions → save transcript on the row, where
 * a trigger folds it into full-text search.
 *
 * Used by the /api/cron/transcribe route to pick up new episodes automatically;
 * scripts/transcribe-sermons.mjs is the standalone twin for large local
 * backfills. Keep the two in sync when changing the pipeline.
 */

const MODEL = process.env.TRANSCRIBE_MODEL || "whisper-1";
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 4 * 60_000;

export type TranscribeRunResult = {
  done: string[];
  failed: { slug: string; error: string }[];
  remaining: number;
};

/** One transcript segment: start/end seconds + text. Stored as jsonb. */
export type TranscriptSegment = { s: number; e: number; t: string };

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary unavailable"));
      return;
    }
    const proc = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(0, 300)}`))
    );
  });
}

async function download(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "iWordBot/1.0 (+https://iword.app)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeFile(
  path: string,
  offsetSec = 0
): Promise<{ text: string; segments: TranscriptSegment[] }> {
  const form = new FormData();
  form.append("file", await openAsBlob(path, { type: "audio/ogg" }), "audio.ogg");
  form.append("model", MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    text?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  };
  return {
    text: (data.text ?? "").trim(),
    segments: (data.segments ?? []).map((s) => ({
      s: Math.round((s.start + offsetSec) * 10) / 10,
      e: Math.round((s.end + offsetSec) * 10) / 10,
      t: s.text.trim(),
    })),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a media file's duration via `ffmpeg -i` (no ffprobe in ffmpeg-static).
 * ffmpeg exits non-zero without an output file, but still prints
 * "Duration: HH:MM:SS.cc" to stderr. Returns 0 when unknown.
 */
export function probeDurationSec(input: string): Promise<number> {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve(0);
    const proc = spawn(ffmpegPath, ["-hide_banner", "-i", input]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      resolve(m ? Math.round(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) : 0);
    });
  });
}

/**
 * Download, downsample, and transcribe one audio URL. The downloaded original
 * is kept at `rawPath` (inside workDir) so the caller can cut an excerpt from
 * it; the caller owns workDir cleanup.
 */
export async function transcribeAudioUrl(
  audioUrl: string,
  workDir: string
): Promise<{ text: string; segments: TranscriptSegment[]; durationSec: number; rawPath: string }> {
  const raw = join(workDir, "raw");
  const ogg = join(workDir, "audio.ogg");
  await download(audioUrl, raw);
  await ffmpeg(["-y", "-i", raw, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "16k", ogg]);
  const durationSec = await probeDurationSec(ogg);

  const { size } = await stat(ogg);
  if (size <= MAX_UPLOAD_BYTES) {
    const { text, segments } = await transcribeFile(ogg);
    return { text, segments, durationSec, rawPath: raw };
  }

  // >~3 h of audio: split into 1-hour segments, stitch text, offset timestamps.
  const pattern = join(workDir, "part-%03d.ogg");
  await ffmpeg(["-y", "-i", ogg, "-f", "segment", "-segment_time", "3600", "-c", "copy", pattern]);
  const texts: string[] = [];
  const segments: TranscriptSegment[] = [];
  for (let i = 0; ; i++) {
    const part = join(workDir, `part-${String(i).padStart(3, "0")}.ogg`);
    if (!(await fileExists(part))) break;
    const chunk = await transcribeFile(part, i * 3600);
    texts.push(chunk.text);
    segments.push(...chunk.segments);
  }
  return { text: texts.join("\n").trim(), segments, durationSec, rawPath: raw };
}

/**
 * Cut the AI-chosen ~60s window from the original audio, upload it to the
 * public `excerpts` bucket, and return { url, text } — or null when no window
 * could be chosen. Fade in/out keeps abrupt cuts pleasant.
 */
export async function generateExcerpt(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  sermon: { id: string; slug: string; title: string },
  rawPath: string,
  segments: TranscriptSegment[],
  workDir: string
): Promise<{ url: string; text: string } | null> {
  const pick = await pickExcerptWindow(sermon.title, segments);
  if (!pick) return null;

  const clip = join(workDir, "excerpt.mp3");
  const len = pick.endSec - pick.startSec;
  await ffmpeg([
    "-y",
    "-ss", String(pick.startSec),
    "-t", String(len),
    "-i", rawPath,
    "-vn", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k",
    "-af", `afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, len - 0.8)}:d=0.8`,
    clip,
  ]);

  const key = `${sermon.slug}.mp3`;
  const { error: upErr } = await admin.storage
    .from("excerpts")
    .upload(key, await openAsBlob(clip, { type: "audio/mpeg" }), {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`excerpt upload: ${upErr.message}`);

  const { data } = admin.storage.from("excerpts").getPublicUrl(key);
  return { url: data.publicUrl, text: pick.text };
}

/**
 * Transcribe pending sermons (newest first) until the time budget runs out.
 * Called by the daily cron so new episodes get transcripts automatically; each
 * run does as many as fit in the serverless window and the rest roll over.
 */
export async function transcribePendingSermons(options?: {
  limit?: number;
  timeBudgetMs?: number;
}): Promise<TranscribeRunResult & { ok: boolean; error?: string }> {
  const limit = options?.limit ?? 8;
  const timeBudgetMs = options?.timeBudgetMs ?? 240_000;
  const startedAt = Date.now();

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Supabase service role not configured", done: [], failed: [], remaining: 0 };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "OPENAI_API_KEY not configured", done: [], failed: [], remaining: 0 };
  }

  const { data, error, count } = await admin
    .from("sermons")
    .select("id, slug, title, audio_url, scripture, duration_sec", { count: "exact" })
    .eq("transcript_status", "pending")
    .not("audio_url", "is", "null")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    return { ok: false, error: error.message, done: [], failed: [], remaining: 0 };
  }

  const result: TranscribeRunResult = { done: [], failed: [], remaining: count ?? 0 };

  for (const sermon of data ?? []) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    const workDir = await mkdtemp(join(tmpdir(), "iword-transcribe-"));
    try {
      const { text, segments, durationSec, rawPath } = await transcribeAudioUrl(
        sermon.audio_url as string,
        workDir
      );
      if (!text) throw new Error("empty transcript");
      const update: Record<string, unknown> = {
        transcript: text,
        transcript_segments: segments,
        transcript_status: "done",
      };
      // Backfill metadata the feed never provided, now that we have the audio
      // in hand and the transcript to read.
      if (!sermon.duration_sec && durationSec > 0) update.duration_sec = durationSec;
      if (!sermon.scripture) {
        const scripture = await extractScriptureFromTranscript(sermon.title as string, text);
        if (scripture) update.scripture = scripture;
      }
      // Cut + upload the shareable ~60s excerpt while the audio is in hand.
      try {
        const excerpt = await generateExcerpt(
          admin,
          { id: sermon.id as string, slug: sermon.slug as string, title: sermon.title as string },
          rawPath,
          segments,
          workDir
        );
        if (excerpt) {
          update.excerpt_url = excerpt.url;
          update.excerpt_text = excerpt.text;
          update.excerpt_status = "done";
        } else {
          update.excerpt_status = "failed";
        }
      } catch {
        update.excerpt_status = "failed";
      }
      const { error: upErr } = await admin.from("sermons").update(update).eq("id", sermon.id);
      if (upErr) throw new Error(`db update: ${upErr.message}`);
      result.done.push(sermon.slug as string);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      // Out of OpenAI credits: leave the row as 'pending' and stop so the next
      // run resumes cleanly instead of marking the whole batch failed.
      if (/insufficient_quota|exceeded your current quota/i.test(message)) {
        result.failed.push({ slug: sermon.slug as string, error: "OpenAI quota exhausted; left pending" });
        break;
      }
      result.failed.push({ slug: sermon.slug as string, error: message });
      await admin.from("sermons").update({ transcript_status: "failed" }).eq("id", sermon.id);
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  result.remaining = Math.max(0, result.remaining - result.done.length - result.failed.length);
  return { ok: true, ...result };
}

/**
 * Backfill metadata for sermons transcribed before the pipeline learned to
 * fill it: scripture read from the transcript by AI, duration probed from the
 * remote audio header. Runs in the transcribe cron's leftover time so gaps
 * close automatically in the background.
 */
export async function enrichTranscribedSermons(options?: {
  limit?: number;
  timeBudgetMs?: number;
}): Promise<{ scriptureFilled: number; durationFilled: number }> {
  const limit = options?.limit ?? 40;
  const timeBudgetMs = options?.timeBudgetMs ?? 45_000;
  const startedAt = Date.now();
  const out = { scriptureFilled: 0, durationFilled: 0 };

  const admin = createAdminClient();
  if (!admin) return out;

  const { data: noScripture } = await admin
    .from("sermons")
    .select("id, title, transcript")
    .eq("transcript_status", "done")
    .eq("scripture", "")
    .not("transcript", "is", "null")
    .order("published_at", { ascending: false })
    .limit(limit);
  for (const s of noScripture ?? []) {
    if (Date.now() - startedAt > timeBudgetMs) return out;
    const scripture = await extractScriptureFromTranscript(s.title as string, s.transcript as string);
    if (scripture === null) return out; // AI unavailable/failing — try next run
    if (scripture) {
      await admin.from("sermons").update({ scripture }).eq("id", s.id);
      out.scriptureFilled += 1;
    }
  }

  const { data: noDuration } = await admin
    .from("sermons")
    .select("id, audio_url")
    .eq("duration_sec", 0)
    .eq("transcript_status", "done")
    .not("audio_url", "is", "null")
    .limit(limit);
  for (const s of noDuration ?? []) {
    if (Date.now() - startedAt > timeBudgetMs) return out;
    const durationSec = await probeDurationSec(s.audio_url as string);
    if (durationSec > 0) {
      await admin.from("sermons").update({ duration_sec: durationSec }).eq("id", s.id);
      out.durationFilled += 1;
    }
  }

  return out;
}
