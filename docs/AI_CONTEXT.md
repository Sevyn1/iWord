# iWord — AI Context (Stable Project Knowledge)

> **Scope:** This file holds *stable* facts about iWord — what it is, its
> architecture, services, conventions, and constraints. Put *temporary* or
> *in-progress* information in [CURRENT_STATE.md](CURRENT_STATE.md), and record
> *why* decisions were made in [DECISIONS.md](DECISIONS.md).
>
> **Never** put secrets, API keys, tokens, passwords, or real environment-variable
> values in this file (or any docs file). Reference variable *names* only.

## What iWord is

A YouTube-style streaming platform for church sermons. Listeners browse pastors
from around the world, stream or download messages, follow creators, and (for
paid tiers) use AI features like audio excerpts and a RAG-powered "Ask iWord"
Q&A over sermon transcripts. The repo hosts the **web app** (originally an MVP
prototype with sample content, now backed by a real DB-first catalog).

## Stack

| Layer      | Tool                                                  |
| ---------- | ----------------------------------------------------- |
| Framework  | Next.js 16 (App Router, TypeScript, Turbopack)        |
| UI         | Tailwind CSS v4                                        |
| Typography | Fraunces (display) + Inter (UI), via `next/font`      |
| Data / Auth| Supabase (Postgres + RLS + Storage + pgvector)        |
| Payments   | Stripe (subscriptions, webhook-driven plan sync)      |
| Audio      | Native HTML5 `<audio>` (single shared element)        |
| AI         | OpenAI (Whisper transcription, gpt-4o-mini, embeddings)|
| Media      | `ffmpeg-static` (transcode / clip / probe duration)   |
| Monitoring | Sentry (`@sentry/nextjs`), Vercel Analytics + Speed Insights |
| Hosting    | Vercel (cron jobs, auto-deploy on push to `main`)     |

> **Framework caveat:** This is Next.js 16, which has breaking changes vs. older
> versions. Agents **must** read the relevant guide in
> `node_modules/next/dist/docs/` before writing framework code (see `AGENTS.md`).

## Architecture overview

- **Catalog is DB-first** with a seed fallback: `src/lib/content.ts` reads from
  Supabase and falls back to in-memory sample data when the DB/env is absent, so
  the app never hard-breaks without configuration.
- **Auth-optional degradation:** If Supabase env vars are missing, Supabase calls
  no-op ("auth disabled" mode) so the demo still runs.
- **Gated audio streaming:** Audio lives in a *private* Supabase Storage bucket
  (`sermons`). `/api/stream/[id]` enforces plan/quota, records the listen, mints a
  short-lived **signed Storage URL**, and `307`-redirects to it. Object storage
  serves the bytes + HTTP range/seek directly — the serverless function never
  proxies audio, so the quota cap can't be bypassed. Requires the service-role key;
  without it (or a missing object) it returns `503`.
- **Ingestion pipeline** (`src/lib/ingestion/`): discovers and normalizes podcast
  feeds (iTunes / PodcastIndex / RSS), orchestrates fetch → normalize → publish.
  Feeds have an `auto_publish` flag feeding a moderation queue.
- **Transcription + enrichment pipeline:** OpenAI Whisper transcribes audio;
  `enrich.ts` backfills duration and scripture from transcripts. Runs both as a
  local script (`npm run transcribe`) and a Vercel cron (`/api/cron/transcribe`).
- **AI audio excerpts:** Whisper `verbose_json` segment timestamps → gpt-4o-mini
  picks a contiguous 45–75s window → `ffmpeg` cuts an mp3 clip → uploaded to a
  public `excerpts` bucket. Surfaced via `ExcerptPlayer.tsx` (paid-gated generation).
- **Ask iWord (RAG):** `sermon_chunks` table (pgvector, HNSW cosine) holds
  embedded transcript chunks. `src/lib/ask.ts` embeds the question, runs the
  `match_sermon_chunks` RPC, and asks gpt-4o-mini for a cited JSON answer.
  Citations deep-link to the exact audio moment (`/sermons/[slug]?t=SECONDS`).
  Paid-gated at `/api/ask` and the `/ask` page.

## Key directories

```
src/
  app/                 # App Router routes
    api/
      ask/             # RAG Q&A endpoint (paid-gated)
      cron/            # ingest/, transcribe/ (Vercel cron; CRON_SECRET bearer)
      search/          # typeahead suggest endpoint (CDN-cached)
      stream/          # gated signed-URL audio streaming
      stripe/webhook/  # Stripe webhook (source of truth for plan sync)
      img-probe/
    admin/             # /admin (gated by profiles.is_admin): content, feeds, review
    sermons/, pastors/, churches/, pricing/, ask/, account/, auth/ ...
  components/          # Navbar, AudioPlayer, ExcerptPlayer, AskClient, SermonCard ...
  lib/
    content.ts         # DB-first catalog + search + typeahead
    ask.ts             # RAG Q&A (askCatalog)
    ingestion/         # discovery, rss, itunes, podcastindex, normalize,
                       # orchestrator, transcribe, enrich, embed, types
    supabase/          # client.ts, server.ts, public.ts, admin.ts (service role)
    stripe.ts, pricing.ts, listens.ts, follows.ts, admin.ts, ... 
scripts/               # one-off + backfill node scripts (see package.json)
supabase/
  schema.sql           # full schema
  migrations/          # 001..014 (applied manually in Dashboard SQL Editor)
```

## Data model (high level)

Core tables: `profiles` (incl. `is_admin`, `plan`), `pastors`, `churches`,
`sermons`, `feeds`, `follows`, `listens`, `stream_hits`, moderation queue,
`sermon_chunks` (embeddings). Notable columns:

- `sermons.search_vec` — trigger-maintained `tsvector` (migration 010); powers
  `search_sermons(q)` RPC consumed by `searchSermons()`.
- `sermons.transcript` / `transcript_status` — Whisper output (migration 012).
- `sermons.transcript_segments` (jsonb) / `excerpt_text` / `excerpt_status` /
  `excerpt_url` — AI excerpts (migration 013).
- `sermons.embed_status` + `sermon_chunks(vector(1536))` — Ask iWord (migration 014).
- **Column gotcha:** the `feeds` table's URL column is `url`; the `sermons` table
  has a separate `feed_url`. Don't confuse them.

## Conventions

- **Migrations are applied manually** in the Supabase Dashboard SQL Editor — there
  is no Supabase CLI / `psql` available on the dev machine. Number new migrations
  sequentially and note application status in `CURRENT_STATE.md`.
- **Script + lib twins:** Several pipelines exist as both a Vercel cron lib
  (`src/lib/ingestion/*.ts`) and a local CLI script (`scripts/*.mjs`). Keep the
  twin implementations in sync when changing pipeline behavior.
- **Only fill blanks:** Enrichment/backfill passes must never overwrite
  feed-provided metadata — they only populate empty fields.
- **Quota safety:** Transcription/embedding code detects OpenAI quota-exhaustion
  errors and leaves rows *pending* (never mass-marks them failed).
- **Idempotent backfills:** Embedding/excerpt generation replace-all per sermon so
  re-runs are safe.
- **Env-optional degradation:** New integrations should degrade gracefully when
  their env vars are absent (mirror the auth-disabled / catalog-fallback pattern).

## Deployment

- Hosted on **Vercel**; pushing to `origin/main` auto-deploys.
- **Cron jobs** (`vercel.json`): `/api/cron/ingest` daily at `08:00`,
  `/api/cron/transcribe` daily at `08:30` (runs transcribe → enrich → embed within
  a time budget; leftover pending rows roll to the next run). Cron routes are
  guarded by a `CRON_SECRET` bearer token.
- `next.config.ts` marks `ffmpeg-static` as `serverExternalPackages` so Vercel
  traces the native binary into the cron function. Sentry source-map upload runs
  only when a Sentry auth token is present.

## Environment variables (names only — never store values here)

Supabase URL + anon key + service-role key; Stripe secret + webhook signing
secret + price IDs (`STRIPE_MODE` toggles `*_TEST` / `*_LIVE`); OpenAI API key
(`OPENAI_API_KEY`, optional `OPENAI_MODEL` / `TRANSCRIBE_MODEL`); `CRON_SECRET`;
`STREAM_IP_SALT`; optional Podcast Index key/secret; Sentry org/project/auth-token.
See [`.env.example`](../.env.example) / Vercel project settings for the
authoritative list. **Do not** paste any real values into docs.

## Important constraints

- Never bypass the signed-URL streaming gate — it's the paywall/quota boundary.
- Never commit secrets. `.env.local` is gitignored.
- Respect Next.js 16 breaking changes (read local docs first).
- Keep pipeline script/lib twins in sync.
- OpenAI-cost-bearing operations (Whisper, embeddings) can be large for full
  backfills — check `CURRENT_STATE.md` for current backfill status and cost.
