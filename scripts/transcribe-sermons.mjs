// Transcribe sermon audio with OpenAI Whisper and store the text on the
// sermons row (see supabase/migrations/012_sermon_transcripts.sql).
//
// For each sermon with transcript_status = 'pending':
//   1. download the audio
//   2. downsample to 16 kHz mono Opus (~16 kbps) with ffmpeg so even multi-hour
//      messages fit Whisper's 25 MB per-request cap in a single call
//   3. send it to OpenAI (/v1/audio/transcriptions) and save the plain text
//
// Rows that fail are marked transcript_status = 'failed' and can be retried
// with --retry-failed. The script is resumable: re-running it only picks up
// rows still pending.
//
// Usage:
//   node --env-file=.env.local scripts/transcribe-sermons.mjs [--limit 25] [--retry-failed] [--dry-run] [--watch]
//
// --watch: if OpenAI credits run out mid-run, keep the process alive and retry
// every 15 minutes, resuming automatically once the account is topped up.
//
// Env:
//   OPENAI_API_KEY    required
//   TRANSCRIBE_MODEL  optional, default "whisper-1" ($0.006/min)

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, statSync, openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";

const MODEL = process.env.TRANSCRIBE_MODEL || "whisper-1";
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024; // stay under OpenAI's 25 MB cap
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const CONCURRENCY = 2;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LIMIT = Number(opt("--limit", "0")) || 0;
const DRY_RUN = flag("--dry-run");
const RETRY_FAILED = flag("--retry-failed");
const WATCH = flag("--watch");
const WATCH_RETRY_MS = 15 * 60_000;

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/** Run ffmpeg, rejecting on non-zero exit. */
function ffmpeg(ffmpegArgs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", ...ffmpegArgs]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(0, 300)}`))
    );
  });
}

async function download(url, dest) {
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

async function transcribeFile(path) {
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

async function transcribeSermon(sermon, workDir) {
  const raw = join(workDir, `${sermon.id}-raw`);
  const ogg = join(workDir, `${sermon.id}.ogg`);
  try {
    await download(sermon.audio_url, raw);
    // 16 kHz mono Opus ≈ 7 MB/hour — one Whisper call even for long messages.
    await ffmpeg(["-y", "-i", raw, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "16k", ogg]);

    const { size } = statSync(ogg);
    let text;
    if (size <= MAX_UPLOAD_BYTES) {
      text = await transcribeFile(ogg);
    } else {
      // >~3 h of audio: split into 1-hour segments and stitch the text.
      const pattern = join(workDir, `${sermon.id}-part-%03d.ogg`);
      await ffmpeg(["-y", "-i", ogg, "-f", "segment", "-segment_time", "3600", "-c", "copy", pattern]);
      const parts = [];
      for (let i = 0; ; i++) {
        const part = join(workDir, `${sermon.id}-part-${String(i).padStart(3, "0")}.ogg`);
        try {
          statSync(part);
        } catch {
          break;
        }
        parts.push(await transcribeFile(part));
      }
      text = parts.join("\n").trim();
    }

    if (!text) throw new Error("empty transcript");
    return text;
  } finally {
    for (const f of [raw, ogg]) {
      try {
        rmSync(f);
      } catch {}
    }
  }
}

async function runBatch() {
  const statuses = RETRY_FAILED ? ["pending", "failed"] : ["pending"];
  let query = admin
    .from("sermons")
    .select("id, slug, title, audio_url, duration_sec")
    .in("transcript_status", statuses)
    .not("audio_url", "is", "null")
    .order("published_at", { ascending: false });
  if (LIMIT > 0) query = query.limit(LIMIT);

  const { data, error } = await query;
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }
  const sermons = data ?? [];
  const minutes = sermons.reduce((s, x) => s + (x.duration_sec || 30 * 60), 0) / 60;
  console.log(
    `${sermons.length} sermon(s) to transcribe · ~${Math.round(minutes)} min of audio · est. cost $${(minutes * 0.006).toFixed(2)} (${MODEL})`
  );
  if (DRY_RUN || sermons.length === 0) return { outOfCredits: false };

  const workDir = mkdtempSync(join(tmpdir(), "iword-transcribe-"));
  let done = 0;
  let failed = 0;
  let outOfCredits = false;
  const queue = [...sermons];

  async function worker() {
    for (let sermon = queue.shift(); sermon; sermon = queue.shift()) {
      const label = `${sermon.slug} (${Math.round((sermon.duration_sec || 0) / 60)}m)`;
      try {
        const text = await transcribeSermon(sermon, workDir);
        const { error: upErr } = await admin
          .from("sermons")
          .update({ transcript: text, transcript_status: "done" })
          .eq("id", sermon.id);
        if (upErr) throw new Error(`db update: ${upErr.message}`);
        done += 1;
        console.log(`✓ ${label} — ${text.split(/\s+/).length} words`);
      } catch (err) {
        // Out of OpenAI credits: leave rows as 'pending' and stop, so a plain
        // re-run resumes cleanly after topping up (no --retry-failed needed).
        if (/insufficient_quota|exceeded your current quota/i.test(err.message)) {
          outOfCredits = true;
          queue.length = 0;
          console.error(`✗ ${label} — OpenAI quota exhausted; stopping. Sermon left as pending.`);
          return;
        }
        failed += 1;
        console.error(`✗ ${label} — ${err.message}`);
        await admin.from("sermons").update({ transcript_status: "failed" }).eq("id", sermon.id);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  rmSync(workDir, { recursive: true, force: true });
  console.log(`\nDone: ${done} transcribed, ${failed} failed.`);
  if (outOfCredits && !WATCH)
    console.log("Stopped early: OpenAI credits exhausted. Top up, then re-run `npm run transcribe` to resume.");
  if (failed > 0) console.log("Retry failures with: --retry-failed");
  return { outOfCredits };
}

async function main() {
  for (;;) {
    const { outOfCredits } = await runBatch();
    if (!outOfCredits || !WATCH) return;
    console.log(
      `Waiting for OpenAI credits — retrying in ${WATCH_RETRY_MS / 60_000} min (${new Date(
        Date.now() + WATCH_RETRY_MS
      ).toLocaleTimeString()}). Top up at platform.openai.com; this will resume automatically.`
    );
    await new Promise((r) => setTimeout(r, WATCH_RETRY_MS));
  }
}

main();
