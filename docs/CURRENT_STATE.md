# iWord — Current State

> *Temporary / in-progress* information: what's being worked on, what's recently
> done, known issues, pending tasks, and next steps. Keep *stable* facts in
> [AI_CONTEXT.md](AI_CONTEXT.md) and *why* decisions were made in
> [DECISIONS.md](DECISIONS.md). Update this file after meaningful changes.
> **Never** include secrets or real environment-variable values here.
>
> _Last updated: 2026-10-09_

## Migrations

- Migration files exist in `supabase/migrations/` through **014**
  (`014_ask_iword_embeddings.sql`).
- Migrations are applied **manually** in the Supabase Dashboard SQL Editor, so
  *application status cannot be proven from the repo alone.* Confirm against the
  live database before assuming a migration is (un)applied.
- **Migration 014 (Ask iWord: pgvector, `sermon_chunks`, `match_sermon_chunks`
  RPC): application status unknown** — the file is present in the repo but there
  is no repo-verifiable signal that it has been run in Supabase. Per prior notes
  it was still pending; verify before taking Ask iWord live (see pending tasks).

## Recently completed

- **Logo redesign — "Radiant Book"** — `src/components/Logo.tsx` mark replaced:
  the sun-dotted "i" is now an open book under a burst of light (same gold/navy
  /cream palette, same outer ring, same props API `size`/`showWordmark`/
  `className`). Pure inline SVG, no new assets; all usages (Navbar, Footer,
  auth pages, error/not-found, homepage) pick it up automatically. Verified via
  `tsc --noEmit` and a live dev-server render. `src/app/favicon.ico` was NOT
  updated and still reflects no particular mark — candidate follow-up.
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

1. **Take Ask iWord live** (highest priority — flagship feature):
   - Apply **migration 014** in the Supabase Dashboard SQL Editor.
   - Top up OpenAI credits.
   - Run `npm run embed` (~$0.01 per ~500 sermons) to populate `sermon_chunks`.
   - Do a real Q&A end-to-end test with citations + deep-link playback.
2. **Finish the transcription backfill** (counts not repo-verifiable — check the
   live DB / admin stats first; prior notes estimated ~480 pending, ~$80–90 for
   the full corpus): top up OpenAI, then run
   `npm run transcribe -- --watch --retry-failed` locally. The `--watch` flag
   auto-resumes when credits return.
3. **Tier 2 remaining:** Resend weekly digest (transcription + excerpts done).
4. **Tier 3 (later):** admin depth, ingestion queue, downloads, observability.
5. **Recommendations (later):** populate `listens.duration_sec`, then add a
   heuristic `getForYou()` behind a seam.

## Operational notes

- Push to `origin/main` auto-deploys via Vercel.
- Cron: `/api/cron/ingest` 08:00, `/api/cron/transcribe` 08:30 (transcribe →
  enrich → embed within a time budget; leftovers roll to the next run).
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
