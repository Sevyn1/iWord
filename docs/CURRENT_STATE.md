# iWord — Current State

> *Temporary / in-progress* information: what's being worked on, what's recently
> done, known issues, pending tasks, and next steps. Keep *stable* facts in
> [AI_CONTEXT.md](AI_CONTEXT.md) and *why* decisions were made in
> [DECISIONS.md](DECISIONS.md). Update this file after meaningful changes.
> **Never** include secrets or real environment-variable values here.
>
> _Last updated: 2026-10-09_

## Migrations

- Migration files exist in `supabase/migrations/` through **015**
  (`015_weekly_digest.sql`).
- Migrations are applied **manually** in the Supabase Dashboard SQL Editor, so
  *application status cannot be proven from the repo alone.* Confirm against the
  live database before assuming a migration is (un)applied.
- **Migration 015 (weekly digest: `newsletter_subscribers`): APPLIED 2026-10-09**
  — run via the Dashboard SQL Editor; subscribe/unsubscribe lifecycle verified
  against the live DB.
- **Migration 014 (Ask iWord: pgvector, `sermon_chunks`, `match_sermon_chunks`
  RPC): APPLIED 2026-10-09** — run via the Dashboard SQL Editor and verified
  against the live DB (`sermon_chunks` responds, RPC returns ranked matches).

## Recently completed

- **Navbar decluttered (2026-10-09)** — top nav is now Home / Browse / Clips /
  Churches (+ Following for members). "Ask" removed (the floating AskWidget
  bubble is the entry point) and "Pricing" removed (Subscribe CTA + footer
  already link it). Admin link remains gated by `profiles.is_admin`
  (server-checked in `UserMenu`) — it only appears for admin accounts.
- **Content expansion run (2026-10-09, partial)** — manual ingest pass added 4
  new sermons from existing feeds. **10 curated pastor feeds registered** via
  iTunes search (Tony Evans, Charles Stanley, David Jeremiah, Adrian Rogers,
  Greg Laurie, Alistair Begg, Priscilla Shirer, Michael Youssef, Voddie
  Baucham, Billy Graham/BGEA) with **auto_publish=true per owner request** —
  the next ingest (daily 08:00 cron) will take their episodes straight live.
  Flip `feeds.auto_publish` back to false afterwards if future episodes should
  go through `/admin/review`. A broader term-based discovery pass
  (`INGEST_DISCOVERY_TERMS` set locally) was started but stopped mid-run by
  the owner; any feeds it registered default to review.
- **"Daily Bread" clips feed (2026-10-09)** — `/clips`: a Shorts/TikTok-style
  vertical feed of the ~90 AI sermon excerpts (`ClipsFeed.tsx` + `getClips()`
  in `lib/content.ts`, shuffled per request). Scroll-snap, one shared audio
  element (first tap unlocks autoplay per browser policy), auto-advance on
  clip end, progress bar, quote overlay on sermon art/hue gradient, Web
  Share/clipboard share, and a "Hear the full sermon" CTA funnelling into the
  catalog/paywall. Free for everyone (growth surface — the excerpts bucket is
  already public). "Clips" added to the navbar; the Ask widget hides on
  `/clips` to keep the feed immersive.
- **Weekly digest shipped (2026-10-09)** — `src/lib/digest.ts` +
  `/api/newsletter/{subscribe,unsubscribe}` + `/api/cron/digest` (Sundays 09:00
  UTC, CRON_SECRET bearer; see `vercel.json`) + migration 015
  (`newsletter_subscribers`, applied). Members are auto-included (seeded into
  the subscribers table for a unified token unsubscribe); personalized sections
  built from `follows` + last-30-day `listens` ("New from pastors you follow",
  "Because you've been listening"), plus "Trending this week" and "New in the
  library" — every sermon with its AI write-up (`summary`). Homepage strip now
  actually stores signups via `DigestSignup.tsx` (previously it just redirected
  to sign-up). **Resend configured 2026-10-09**: `RESEND_API_KEY` +
  `RESEND_FROM` set in Vercel production and `.env.local`; test digest sent and
  delivered to the owner. **Caveat:** the sender is `onboarding@resend.dev`
  (no verified domain yet), which only delivers to the Resend account owner's
  email — verify a real domain in Resend and update `RESEND_FROM` before the
  digest can reach other subscribers.
  Full subscribe → unsubscribe → re-subscribe lifecycle verified locally
  against the live DB.
- **Ask iWord floating widget (site-wide)** — `AskWidget.tsx` renders a gold
  "Ask" launcher bottom-right on every page (hidden on `/ask` and `/admin`),
  opening a compact chat-style panel that reuses `AskClient` (new `compact`
  prop). Expand icon jumps to the full `/ask` page; paid members get the
  question box, others a short Devoted upsell (mirrors the page gate — the API
  stays the enforcement point). Lifts above the MiniPlayer via `usePlayer()`.
  Dev note: `allowedDevOrigins` added to `next.config.ts` for LAN-IP preview,
  and `vercel env pull` writes literal `"[SENSITIVE]"` placeholders that crash
  Sentry client init (breaking hydration) — blank them out in `.env.local`.
- **Ask iWord is LIVE in production (2026-10-09)** — migration 014 applied,
  `npm run embed` backfilled **94 transcribed sermons → 2,263 chunks, 0 failed**,
  and a full E2E test passed on the live site: signed-in Devoted account asked a
  real question, got a grounded answer with 6 citations across 2 sermons, each
  deep-linking to the exact second (`?t=…`). Semantic search verified directly
  (guilt/forgiveness → R.C. Sproul "Forgiveness" @ 5:24 etc.). System prompt
  gained a disagreement rule (see DECISIONS). Ops notes: this machine now has a
  populated `.env.local` (Vercel-linked; service key + OpenAI key current);
  owner account `favourojo24@gmail.com` set to plan `devoted` (was `free`,
  `stripe_status` is `canceled` — a future Stripe webhook may rewrite the plan).
- **Logo redesign — "Radiant Book"** — `src/components/Logo.tsx` mark replaced:
  the sun-dotted "i" is now an open book under a burst of light (same gold/navy
  /cream palette, same outer ring, same props API `size`/`showWordmark`/
  `className`). Pure inline SVG, no new assets; all usages (Navbar, Footer,
  auth pages, error/not-found, homepage) pick it up automatically. Verified via
  `tsc --noEmit` and a live dev-server render. Follow-up completed:
  `src/app/icon.svg` (simplified mark on a navy tile) added and
  `src/app/favicon.ico` regenerated from it (PNG-encoded 16/32/48) so tab icons
  match the new brand.
- **Shared AI memory system** added (`fdee847`) — `AGENTS.md` shared rules (around
  the untouched Next.js block), `.github/copilot-instructions.md`, and
  `docs/{AI_CONTEXT,DECISIONS,CURRENT_STATE}.md`. Verified uncertain items against
  the repo: migration 014 marked *application status unknown* (not "unapplied"),
  stale transcription/backfill counts moved to a dated historical note, and the
  README env-template reference fixed from `.env.local.example` to `.env.example`.
  Follow-up added `docs/SESSION_LOG.md` plus a routine "update docs every session"
  workflow wired into `AGENTS.md` + Copilot instructions (all agents inherit it).
- **Shared-memory freshness check** — `scripts/check-memory-freshness.sh`
  (POSIX sh, no deps) + `.githooks/pre-commit` + `npm run check:memory`. Prints a
  non-blocking warning when source/app code changed but no shared-memory doc did;
  ignores doc/formatting/lock/asset-only changes. Enable hooks with
  `git config core.hooksPath .githooks`.
- **Ask iWord (RAG Q&A)** shipped in code (`e7da94f`) — flagship paid feature.
  `/ask` page (paid → `AskClient`, free/anon → upsell), `/api/ask` (paid-gated),
  citations deep-link to `/sermons/[slug]?t=SECONDS`, `AudioPlayer.startAt` seeks
  on first play. Per prior manual testing: `/ask` rendered, `503` was graceful
  when quota was dead, and a `?t=754` deep-link played at 12:34. Not yet live
  end-to-end (needs migration 014 applied + embeddings generated).
- **AI audio excerpts** shipped (`b761750`) — `ExcerptPlayer.tsx`, public
  `excerpts` bucket, Web Share/clipboard. Reported E2E-verified on a sample
  sermon in prior notes.
- **Sermon page design polish** (`b5b3577`, `3a360d3`, `f492cb0`) — transcript
  `<details>` closed by default, unified section rhythm, full-width gold excerpt
  band, single hero card with cover-art/hue background + scrim.
- **Transcript display** — prominent formatted transcript section with
  auto-generated disclaimer; `toParagraphs()` groups sentences and repairs
  initials-based splits (e.g. "R.C. Sproul").
- **Scripture/duration backfill** wired into the transcription pipeline
  (fills blanks only).
- **Admin transcription stats row** (`b5f6a4d`) on the dashboard
  (transcribed/pending/failed/excerpts + backfill hint).
- **Search** — full-text `search_sermons(q)` RPC (migration 010) + relevance sort;
  **typeahead** suggest endpoint + Navbar `SearchBox`.
- **Moderation queue** (migration 011) — `/admin/review`, per-feed Auto/Review
  toggle, dashboard pending-count badge.

## Known issues / caveats

- **Transcription backfill was stalled** on OpenAI credit exhaustion. Live counts
  are **not repo-verifiable** — check the Supabase `sermons` table
  (`transcript_status`) or the admin dashboard transcription stats row for
  current numbers. See the dated historical note below for the last recorded
  snapshot (do not treat it as current).
- **`comingSoon` "Soon" badge system was lost in a reversion** (Aug 2026):
  `pricing.ts` features are plain strings again. `searchSermons` /
  `getSearchSuggestions` were also lost and rebuilt (`3109f33`). Rebuild the
  "Soon" badges if that UX is wanted again.
- **`listens.duration_sec` is always 0** — blocks the future heuristic
  `getForYou()` recommendations until populated. (Verify against current code if
  relying on this.)

## Pending tasks / next steps

1. ~~**Take Ask iWord live**~~ — **DONE 2026-10-09** (migration applied, 94
   sermons embedded, E2E verified on production — see "Recently completed").
2. **Finish the transcription backfill** (counts not repo-verifiable — check the
   live DB / admin stats first; prior notes estimated ~480 pending, ~$80–90 for
   the full corpus): top up OpenAI, then run
   `npm run transcribe -- --watch --retry-failed` locally. The `--watch` flag
   auto-resumes when credits return.
3. ~~**Tier 2 remaining:** Resend weekly digest~~ — **shipped + Resend
   configured 2026-10-09**. Remaining: verify a real sending domain in Resend
   and update `RESEND_FROM` (the `onboarding@resend.dev` sender only delivers
   to the account owner).
4. **Tier 3 (later):** admin depth, ingestion queue, downloads, observability.
5. **Recommendations (later):** populate `listens.duration_sec`, then add a
   heuristic `getForYou()` behind a seam.

## Operational notes

- Push to `origin/main` auto-deploys via Vercel.
- Cron: `/api/cron/ingest` 08:00, `/api/cron/transcribe` 08:30 (transcribe →
  enrich → embed within a time budget; leftovers roll to the next run),
  `/api/cron/digest` Sundays 09:00 (weekly digest email via Resend).
- Admin: `/admin` gated by `profiles.is_admin` (only the service role can set it).

## Historical notes (dated snapshots — NOT current)

> These figures come from prior working notes and were accurate only on the
> dates shown. They are kept for context; re-verify against the live database
> before acting on them.

- **2026-09-03 backfill snapshot:** OpenAI credits exhausted shortly after the
  2026-08-07 backfill kickoff. Approx state at that check: ~90 transcribed,
  ~480 pending, ~44 failed. Failed rows' audio URLs were fine — failures were
  AI-side; retrying flips them back to pending via the quota guard.
- **Full-corpus cost estimate (prior notes):** ~$80–90 to transcribe the
  remaining backlog (~480 sermons); embeddings ~$0.01 per ~500 sermons.
