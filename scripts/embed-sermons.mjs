// Embed transcribed sermons for "Ask iWord" semantic search
// (see supabase/migrations/014_ask_iword_embeddings.sql).
//
// For each sermon with transcript_status = 'done' and embed_status = 'pending':
//   1. group its Whisper segments into ~60-90s passages (chunks)
//   2. embed each chunk with OpenAI text-embedding-3-small (~$0.01 / 500 sermons)
//   3. replace the sermon's rows in sermon_chunks
//
// Resumable and idempotent; quota exhaustion leaves rows pending. The daily
// transcribe cron also embeds new sermons automatically — this script exists
// for bulk backfills.
//
// Usage:
//   node --env-file=.env.local scripts/embed-sermons.mjs [--limit N] [--retry-failed] [--dry-run]

import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const TARGET_CHARS = 1000;
const MAX_CHARS = 1600;
const TARGET_SECONDS = 90;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LIMIT = Number(opt("--limit", "0")) || 0;
const DRY_RUN = flag("--dry-run");
const RETRY_FAILED = flag("--retry-failed");

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/** Group Whisper segments into time-stamped passages (mirror of lib/ingestion/embed.ts). */
function chunkSegments(segments) {
  const chunks = [];
  let buf = [];
  const flush = () => {
    if (buf.length === 0) return;
    const text = buf.map((s) => s.t).join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 40) {
      chunks.push({ seq: chunks.length, startSec: buf[0].s, endSec: buf[buf.length - 1].e, text });
    }
    buf = [];
  };
  for (const seg of segments) {
    if (!seg.t?.trim()) continue;
    buf.push(seg);
    const chars = buf.reduce((n, s) => n + s.t.length + 1, 0);
    const span = seg.e - buf[0].s;
    if (chars >= MAX_CHARS || (chars >= TARGET_CHARS && span >= 20) || span >= TARGET_SECONDS) flush();
  }
  flush();
  return chunks;
}

async function embedTexts(texts) {
  const out = [];
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
    if (!res.ok) throw new Error(`OpenAI embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    out.push(...[...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return out;
}

async function embedSermon(sermon) {
  const chunks = chunkSegments(sermon.transcript_segments ?? []);
  if (chunks.length === 0) throw new Error("no chunks produced");
  const embeddings = await embedTexts(chunks.map((c) => c.text));

  const { error: delErr } = await admin.from("sermon_chunks").delete().eq("sermon_id", sermon.id);
  if (delErr) throw new Error(`chunk delete: ${delErr.message}`);

  const rows = chunks.map((c, i) => ({
    sermon_id: sermon.id,
    seq: c.seq,
    start_sec: c.startSec,
    end_sec: c.endSec,
    text: c.text,
    embedding: embeddings[i],
  }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await admin.from("sermon_chunks").insert(rows.slice(i, i + 50));
    if (error) throw new Error(`chunk insert: ${error.message}`);
  }
  return chunks.length;
}

async function main() {
  if (RETRY_FAILED) {
    const { error } = await admin
      .from("sermons")
      .update({ embed_status: "pending" })
      .eq("embed_status", "failed");
    if (error) throw new Error(error.message);
  }

  let query = admin
    .from("sermons")
    .select("id, slug, transcript_segments")
    .eq("transcript_status", "done")
    .eq("embed_status", "pending")
    .not("transcript_segments", "is", "null")
    .order("published_at", { ascending: false });
  if (LIMIT > 0) query = query.limit(LIMIT);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const sermons = data ?? [];
  console.log(`${sermons.length} sermon(s) to embed with ${EMBEDDING_MODEL}`);
  if (DRY_RUN) {
    for (const s of sermons) console.log(`- ${s.slug} (${chunkSegments(s.transcript_segments ?? []).length} chunks)`);
    return;
  }

  let done = 0;
  let failed = 0;
  for (const s of sermons) {
    try {
      const n = await embedSermon(s);
      await admin.from("sermons").update({ embed_status: "done" }).eq("id", s.id);
      done += 1;
      console.log(`✓ ${s.slug} — ${n} chunks`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/insufficient_quota|exceeded your current quota|credit_balance_exhausted/i.test(message)) {
        console.error(`✗ ${s.slug} — OpenAI quota exhausted; stopping. Sermon left as pending.`);
        break;
      }
      failed += 1;
      console.error(`✗ ${s.slug} — ${message}`);
      await admin.from("sermons").update({ embed_status: "failed" }).eq("id", s.id);
    }
  }
  console.log(`\nDone: ${done} embedded, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
