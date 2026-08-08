import { spawn } from "node:child_process";
import { openAsBlob } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function transcribeFile(path: string): Promise<string> {
  const form = new FormData();
  form.append("file", await openAsBlob(path, { type: "audio/ogg" }), "audio.ogg");
  form.append("model", MODEL);
  form.append("response_format", "text");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.text()).trim();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Download, downsample, and transcribe one audio URL. */
export async function transcribeAudioUrl(audioUrl: string, workDir: string): Promise<string> {
  const raw = join(workDir, "raw");
  const ogg = join(workDir, "audio.ogg");
  try {
    await download(audioUrl, raw);
    await ffmpeg(["-y", "-i", raw, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "16k", ogg]);

    const { size } = await stat(ogg);
    if (size <= MAX_UPLOAD_BYTES) return await transcribeFile(ogg);

    // >~3 h of audio: split into 1-hour segments and stitch the text.
    const pattern = join(workDir, "part-%03d.ogg");
    await ffmpeg(["-y", "-i", ogg, "-f", "segment", "-segment_time", "3600", "-c", "copy", pattern]);
    const parts: string[] = [];
    for (let i = 0; ; i++) {
      const part = join(workDir, `part-${String(i).padStart(3, "0")}.ogg`);
      if (!(await fileExists(part))) break;
      parts.push(await transcribeFile(part));
    }
    return parts.join("\n").trim();
  } finally {
    await rm(raw, { force: true }).catch(() => {});
    await rm(ogg, { force: true }).catch(() => {});
  }
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
    .select("id, slug, audio_url", { count: "exact" })
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
      const text = await transcribeAudioUrl(sermon.audio_url as string, workDir);
      if (!text) throw new Error("empty transcript");
      const { error: upErr } = await admin
        .from("sermons")
        .update({ transcript: text, transcript_status: "done" })
        .eq("id", sermon.id);
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
