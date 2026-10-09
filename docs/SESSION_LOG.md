# iWord — Session Log

> A running, append-only narrative of AI-agent work sessions. Each agent
> (Copilot, Claude, OpenCode, etc.) appends a short entry at the **end of every
> work session** so the next agent can see not just *what* the state is, but
> *what just happened and why*. Newest entries go at the **top**.
>
> This complements — does not replace — the other memory files: durable facts go
> in [AI_CONTEXT.md](AI_CONTEXT.md), decisions + rationale in
> [DECISIONS.md](DECISIONS.md), and live status in [CURRENT_STATE.md](CURRENT_STATE.md).
> **Never** include secrets or real environment-variable values here.

## Entry template

```
## YYYY-MM-DD — <short title> (<agent>)
- **Goal:** what the session set out to do.
- **Did:** key changes made (link commits/files where useful).
- **Decisions:** anything added to DECISIONS.md (or "none").
- **Open/next:** what's left, gotchas, or follow-ups for the next agent.
```

---

## 2026-10-09 — Weekly digest shipped (GitHub Copilot)
- **Goal:** Build the promised weekly digest/newsletter: personalized from what
  members follow and listen to, plus trending/new sermons with their write-ups.
- **Did:** Migration 015 (`newsletter_subscribers`, applied via Dashboard);
  `src/lib/digest.ts` (recipient collection incl. member seeding, batched
  follows/listens signals, section assembly, branded HTML renderer, Resend via
  fetch); `/api/newsletter/subscribe` + `/api/newsletter/unsubscribe` (token,
  friendly HTML page) + `/api/cron/digest` (bearer CRON_SECRET, Sundays 09:00
  UTC in `vercel.json`); homepage strip wired to real storage via
  `DigestSignup.tsx`. Verified locally against the live DB: subscribe (valid +
  invalid), unsubscribe, re-subscribe, cron 401, graceful skip without Resend,
  homepage success state.
- **Decisions:** Members auto-included with a single token unsubscribe; Resend
  via fetch; skip-clean degradation (see DECISIONS.md).
- **Open/next:** Verify a real sending domain in Resend and update
  `RESEND_FROM` — done same session: Resend account created (GitHub OAuth),
  send-only API key generated, env set in Vercel production + `.env.local`,
  personalized test digest sent to the owner
  (`/api/cron/digest?only=…` → `sent: 1, failed: 0`), production redeployed so
  the Sunday cron sees the env. Until a domain is verified,
  `onboarding@resend.dev` only delivers to the account owner. Also consider a
  likes feature to deepen personalization, and an account-page digest toggle.

## 2026-10-09 — Ask iWord floating widget (GitHub Copilot)
- **Goal:** Surface Ask iWord site-wide as a corner chatbot, expandable to the
  full page, instead of living only on `/ask`.
- **Did:** Added `src/components/AskWidget.tsx` (client; launcher + panel,
  Escape closes, hidden on `/ask` + `/admin`, lifts above MiniPlayer when audio
  plays), added a `compact` prop to `AskClient`, wired into `layout.tsx` with
  `canAsk={isPaidPlan(account?.plan)}`. Debugged two dev-env traps: Next 16
  blocks cross-origin dev resources from LAN IPs (fixed via `allowedDevOrigins`
  in `next.config.ts`) and `vercel env pull` `"[SENSITIVE]"` placeholders crash
  Sentry's client init and kill hydration (blanked them in `.env.local`).
  Verified both widget states (upsell + paid compact ask) in the browser.
- **Decisions:** none new (reuses the existing paid-gate pattern; server API
  remains the enforcement point).
- **Open/next:** Consider remembering panel open-state across navigations, and
  a small "new answer" badge when a background answer completes.

## 2026-10-09 — Ask iWord taken LIVE end-to-end (GitHub Copilot)
- **Goal:** Take the already-shipped Ask iWord (RAG Q&A) live in production.
- **Did:**
  - Provisioned this machine (`aihub`): `npm install`, Vercel CLI login +
    `vercel link` (project `i-word`), rebuilt the gitignored `.env.local`
    (Vercel "Sensitive" vars are write-only, so keys were recovered via the
    dashboards: Supabase `sb_secret_*` service key + a fresh look at OpenAI
    keys — the active one ends `_sUA`; the revoked Nov-2025 key still floating
    around in old notes ends `k1YA` and is dead).
  - Applied **migration 014** via the Supabase Dashboard SQL Editor
    ("Success. No rows returned") and verified `sermon_chunks` + RPC live.
  - Ran `npm run embed`: **94 sermons → 2,263 chunks, 0 failed** (~1¢).
  - Verified retrieval directly (guilt/forgiveness → Sproul "Forgiveness"
    @ 324s/831s/234s) and did a full E2E on production `/ask` with the owner
    account (set to plan `devoted`): grounded answer, 6 citations across 2
    sermons, play buttons deep-linking to the exact second.
  - Added a disagreement rule to the `askCatalog()` system prompt (report
    differing pastors by name; never blend into fake consensus).
- **Decisions:** "Ask iWord reports pastor disagreement, never harmonizes it"
  (see DECISIONS.md).
- **Open/next:** Transcription backfill remains the big lever (94 of ~570+
  transcribed); owner profile `stripe_status` is `canceled` so a future Stripe
  webhook may flip the manually-set `devoted` plan back.

## 2026-10-09 — Logo redesign: "Radiant Book" (GitHub Copilot)
- **Goal:** Replace the logo mark with a new concept.
- **Did:** Proposed 4 SVG concepts (radiant book, lamp/flame, sound-wave "i",
  cross-dot "i") rendered side-by-side for the user; user chose **A — Radiant
  Book** (open book under a burst of light). Rewrote the SVG in
  `src/components/Logo.tsx`, keeping the palette, outer ring, wordmark, and the
  `size`/`showWordmark`/`className` props API unchanged. Verified with
  `tsc --noEmit` and a live `next dev` render (navbar + homepage).
- **Decisions:** Kept the logo as a pure inline-SVG React component (no asset
  files) — single source of truth, themable, zero extra requests.
- **Open/next:** none — favicon follow-up completed same day (below).
- **Follow-up (same session):** Added `src/app/icon.svg` (simplified Radiant
  Book on a navy rounded tile for small-size legibility) and regenerated
  `src/app/favicon.ico` from it (PNG-encoded 16/32/48, built with `sharp`).
  Verified both are served with correct `<link rel="icon">` tags per the
  Next.js app-icons file convention and remain legible at 16px.

## 2026-09-11 — Shared-memory freshness check (GitHub Copilot)
- **Goal:** Add a lightweight, non-blocking reminder to update shared memory when
  code changes without a corresponding doc update.
- **Did:** Added `scripts/check-memory-freshness.sh` (POSIX sh, no deps),
  `.githooks/pre-commit`, and an `npm run check:memory` script; documented usage
  in the README. Ignores doc-only, formatting-only (whitespace), lock-file, and
  asset changes. Enabled locally via `git config core.hooksPath .githooks`.
- **Decisions:** Keep it a warning (exit 0), not a gate, for now.
- **Open/next:** Could promote to a hard CI gate later if desired.

## 2026-09-11 — Shared AI memory system + verification pass (GitHub Copilot)
- **Goal:** Stand up a persistent shared memory system so all coding agents keep
  aligned across sessions, without changing app behavior.
- **Did:**
  - Expanded `AGENTS.md` around the untouched Next.js rules block with shared
    rules, the memory-file reading requirement, and project conventions.
  - Added `.github/copilot-instructions.md` pointing at the shared memory files.
  - Created `docs/AI_CONTEXT.md`, `docs/DECISIONS.md`, `docs/CURRENT_STATE.md`.
  - Verification pass against the repo: migration 014 re-labelled *application
    status unknown* (not "unapplied"), stale transcription/backfill counts moved
    to a dated historical note, and confirmed commit hashes exist in git history.
  - Fixed the README env-template reference (`.env.local.example` →
    `.env.example`, the file that actually exists).
  - Reframed the agent-local `/memories/repo/iword.md` as historical/supporting
    context that defers to these repo docs.
  - Commits: `fdee847` (memory system + README fix), `5f38c3d` (logged the work
    in CURRENT_STATE).
- **Decisions:** Adopted the shared-memory file layout and the "session log +
  routine doc updates" workflow (see DECISIONS.md).
- **Open/next:** Take Ask iWord live (apply migration 014, top up OpenAI, run
  `npm run embed`, E2E test) and finish the transcription backfill — see
  `docs/CURRENT_STATE.md` for the current task list.
