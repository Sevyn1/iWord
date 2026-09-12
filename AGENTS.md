<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Shared agent rules for iWord

These rules apply to **all** coding agents working in this repo (GitHub Copilot,
OpenCode, Claude, etc.). They complement — never replace — the Next.js rule above.

## Shared AI memory system

This repo keeps persistent, shared context in a few files so any agent can pick up
where the last one left off. **Before doing substantial work, read all of:**

1. This `AGENTS.md` (shared agent rules).
2. [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md) — stable project knowledge:
   what iWord is, architecture, services, conventions, deployment, constraints.
3. [`docs/DECISIONS.md`](docs/DECISIONS.md) — architectural/technical decisions
   and the reasoning behind them.
4. [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — current work, recently
   completed work, known issues, pending tasks, and next steps.
5. [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md) — append-only narrative of past
   agent sessions (what happened and why), newest first.

## Routine doc updates (every agent, every session)

**This applies to all agents — GitHub Copilot, Claude, OpenCode, and any other.**
Treat updating the memory files as part of finishing the work, not an optional
extra. Do it before you consider a task done (and before pushing):

1. **`docs/CURRENT_STATE.md`** — update after any meaningful change (features
   shipped, migrations applied, issues found/fixed, status changes). Bump the
   `Last updated` date.
2. **`docs/DECISIONS.md`** — append an entry whenever you make an architectural
   or otherwise significant technical decision (record the decision *and why*).
3. **`docs/AI_CONTEXT.md`** — update when a *stable* fact changes (architecture,
   services, conventions, deployment, constraints).
4. **`docs/SESSION_LOG.md`** — append a short entry at the **end of every work
   session** using the template in that file (goal / did / decisions / next).
5. Keep these edits in the **same commit** as the code they describe when
   practical, so history stays coherent.

## Keeping the memory current

- **Keep the split clean:** stable facts live in `AI_CONTEXT.md`; temporary /
  in-progress information lives in `CURRENT_STATE.md`; the running narrative
  lives in `SESSION_LOG.md`; the *why* behind decisions lives in `DECISIONS.md`.
- **Prefer the repo docs over agent-local memory.** Any agent-private notes
  (e.g. an agent's own memory store) are historical/supporting context only —
  when they disagree with current source, migrations, config, or these docs,
  the repo wins.
- **Preserve the Next.js rule:** always consult the local Next.js docs in
  `node_modules/next/dist/docs/` before relying on framework knowledge.

## Security

- **Never** put secrets, API keys, tokens, passwords, or real
  environment-variable *values* into any repo file — including these memory/docs
  files. Reference variable *names* only.
- `.env.local` is gitignored; never commit it or echo its contents into files.

## Project conventions (see `docs/AI_CONTEXT.md` for detail)

- Supabase migrations are applied **manually** in the Dashboard SQL Editor (no
  CLI/`psql`); number new migrations sequentially and note status in
  `CURRENT_STATE.md`.
- Several pipelines are **script + lib twins** (`scripts/*.mjs` ↔
  `src/lib/ingestion/*.ts`) — keep both in sync when changing behavior.
- Backfill/enrichment passes must **only fill blank fields**, never overwrite
  feed-provided metadata.
- Do not bypass the signed-URL streaming gate (`/api/stream/[id]`) — it is the
  paywall/quota boundary.
- Integrations should **degrade gracefully** when their env vars are absent
  (mirror the catalog-fallback / auth-disabled pattern).
