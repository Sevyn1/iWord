# iWord — Decisions Log

> Records *why* architectural and significant technical decisions were made.
> Append a new entry whenever a meaningful decision is taken. Keep stable facts
> in [AI_CONTEXT.md](AI_CONTEXT.md) and current status in
> [CURRENT_STATE.md](CURRENT_STATE.md). **Never** include secrets or real
> environment-variable values here.

Format: `## YYYY-MM — Title` · **Decision** · **Why** · **Consequences/notes**.

---

## Catalog is DB-first with seed fallback
- **Decision:** `src/lib/content.ts` reads the catalog from Supabase but falls
  back to in-memory sample data when the DB/env is unavailable.
- **Why:** The app must never hard-break in demo/unconfigured environments.
- **Notes:** Same philosophy as "auth-disabled" mode — new integrations should
  degrade gracefully when their env vars are missing.

## Gated audio via signed Storage URLs
- **Decision:** Store audio in a *private* Supabase Storage bucket and serve it
  through `/api/stream/[id]`, which enforces plan/quota, records the listen, then
  `307`-redirects to a short-lived signed URL.
- **Why:** Object storage serves bytes + HTTP range/seek directly, so the
  serverless function never proxies audio and the quota cap cannot be bypassed.
- **Notes:** Requires the service-role key; returns `503` without it or on a
  missing object. This route is the paywall/quota boundary — never bypass it.

## Migrations applied manually in the Dashboard
- **Decision:** SQL migrations are numbered files under `supabase/migrations/`
  and run by hand in the Supabase Dashboard SQL Editor.
- **Why:** No Supabase CLI / `psql` is available on the dev machine.
- **Notes:** Track which migrations are applied in `CURRENT_STATE.md`.

## Roadmap tiers (Aug 2026)
- **Decision:** Tier 1 = enforce/trim paid features + moderation queue + search
  (complete). Tier 2 = Whisper transcription, AI excerpts, weekly digest.
  Tier 3 = admin depth, ingestion queue, downloads, observability.
- **Why:** Sequence foundational integrity and search before AI features and
  operational depth.

## Moderation queue with per-feed auto-publish
- **Decision:** `feeds.auto_publish` gates whether ingested sermons publish
  immediately or land as drafts in `/admin/review`. Migration 011.
- **Why:** Give admins takedown/approval control over ingested content.
- **Notes:** Pre-existing feeds were grandfathered to `true`. Currently new feeds
  are created with `auto_publish: true` in both `addFeed` and `discoverFeeds`
  (auto-approve chosen for now); flip those two upserts back to the DB default
  (`false`) to re-enable review-by-default. `feeds` URL column is `url`;
  `sermons` has `feed_url`.

## Stripe-aware admin plan changes
- **Decision:** `setUserPlan` is Stripe-aware: for active subscribers, paid→paid
  downgrades use a subscription schedule (price swap at period end), →free sets
  `cancel_at_period_end`, and upgrades are refused (require member consent);
  non-subscribers get a plain profile override (comps).
- **Why:** Respect billing correctness and member consent while still allowing
  admin comps.
- **Notes:** The Stripe webhook remains the source of truth for plan sync.

## Transcription: Whisper + cron + local script twin
- **Decision:** Transcribe with OpenAI Whisper (`whisper-1`, model overridable via
  env), downsampling to 16 kHz mono opus via `ffmpeg-static`. Runs as both a
  Vercel cron (`/api/cron/transcribe`, `CRON_SECRET`-gated) and a local script
  (`npm run transcribe`).
- **Why:** Cron handles steady-state new sermons; the local script handles bulk
  backfills without serverless time limits.
- **Notes:** Transcript folded into `search_vec` (weight D). `ffmpeg-static` moved
  to prod dependencies and marked `serverExternalPackages` so Vercel traces the
  binary. Keep script/lib twins in sync.

## Quota guard + watch mode
- **Decision:** Both script and lib detect `insufficient_quota` / quota-exceeded
  errors, leave affected rows *pending*, and stop (never mass-mark failed). The
  script's `--watch` retries every 15 min and auto-resumes when credits return.
- **Why:** OpenAI credit exhaustion should pause the backfill safely, not corrupt
  row state.

## Enrichment only fills blanks
- **Decision:** The transcription pipeline also backfills `duration_sec`
  (`ffmpeg -i` stderr parse — no `ffprobe` in `ffmpeg-static`) and scripture
  (`extractScriptureFromTranscript`, gpt-4o-mini over the transcript head). Empty
  Scripture/Length/Topic tiles are hidden on the sermon page.
- **Why:** Improve metadata coverage without clobbering feed-provided values.
- **Notes:** Never overwrites existing metadata — only fills empty fields.

## AI excerpts as audio clips (not text)
- **Decision:** Ship AI excerpts as shareable *audio* clips. Whisper
  `verbose_json` segment granularity (timestamps free in the same call) →
  gpt-4o-mini picks a contiguous 45–75s window (clamped ≤90s) → `ffmpeg` cuts a
  64k mono mp3 with fades → uploaded to a public `excerpts` bucket. Migration 013.
- **Why:** Audio clips are more shareable and compelling than text pull-quotes.
- **Notes:** Excerpt failure never fails the transcript (`excerpt_status`
  `failed`, transcript still saved). Generation UI-gated to paid.

## Transcripts feed AI, are not emailed
- **Decision:** Stored transcripts are kept verbatim; display formatting
  (`toParagraphs()`) is presentation-only. Transcripts are **not** emailed to
  users — they feed AI excerpts and (future) weekly digest summaries.
- **Why:** Separate raw data from presentation and product surface.

## Ask iWord as the flagship selling point
- **Decision:** Build a RAG Q&A over transcripts with citations that deep-link to
  the exact audio moment, and position it as the headline paid feature. Migration
  014 adds pgvector, `sermon_chunks` (HNSW cosine), and the service-role-only
  `match_sermon_chunks` RPC. `askCatalog()` embeds the question
  (`text-embedding-3-small`, dim 1536), retrieves top-10 (min sim 0.2), and asks
  gpt-4o-mini for a JSON answer citing `[n]`.
- **Why:** Differentiated, high-value feature that leverages the transcript corpus.
- **Notes:** Paid-gated at `/api/ask` and `/ask`. Citations link to
  `/sermons/[slug]?t=SECONDS`; `AudioPlayer` `startAt` seeks on first play (no
  autoplay per browser policy). Embedding is a script/lib twin (`npm run embed`
  ↔ `embedPendingSermons` in cron leftover budget).

## Recommendations: heuristic-later, no ML yet
- **Decision:** No ML recommendations for now; later add a heuristic `getForYou()`
  (follows / topic / popularity / recency / region) behind a seam.
- **Why:** Defer complexity; ship simpler surfaces first.
- **Notes:** Requires populating `listens.duration_sec` (currently always 0).
