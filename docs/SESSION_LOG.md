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
