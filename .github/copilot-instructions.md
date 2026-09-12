# GitHub Copilot instructions for iWord

This project uses a **shared AI memory system** so all coding agents stay aligned
across sessions. These Copilot-specific instructions point to the shared files —
follow them together with [`AGENTS.md`](../AGENTS.md).

## Read before substantial work

Before making non-trivial changes, read all of:

1. [`AGENTS.md`](../AGENTS.md) — shared agent rules.
2. [`docs/AI_CONTEXT.md`](../docs/AI_CONTEXT.md) — stable project knowledge
   (what iWord is, architecture, services, conventions, deployment, constraints).
3. [`docs/DECISIONS.md`](../docs/DECISIONS.md) — architectural/technical decisions
   and their rationale.
4. [`docs/CURRENT_STATE.md`](../docs/CURRENT_STATE.md) — current work, recently
   completed work, known issues, pending tasks, and next steps.
5. [`docs/SESSION_LOG.md`](../docs/SESSION_LOG.md) — append-only narrative of past
   agent sessions (newest first).

## Keep the memory current

Updating the memory files is part of finishing the work — do it before a task is
done (and before pushing):

- Update [`docs/CURRENT_STATE.md`](../docs/CURRENT_STATE.md) after any meaningful
  change (and bump its `Last updated` date).
- Add an entry to [`docs/DECISIONS.md`](../docs/DECISIONS.md) whenever you make an
  architectural or significant technical decision (record what and _why_).
- Append a short entry to [`docs/SESSION_LOG.md`](../docs/SESSION_LOG.md) at the
  end of each work session using the template in that file.
- Update [`docs/AI_CONTEXT.md`](../docs/AI_CONTEXT.md) when a _stable_ fact changes.
- Keep stable facts in `AI_CONTEXT.md`; keep temporary/in-progress info in
  `CURRENT_STATE.md`. Prefer these repo docs over any agent-local memory store.

## Framework

This is **Next.js 16** with breaking changes vs. older versions. Always read the
relevant guide in `node_modules/next/dist/docs/` before writing framework code —
do not rely on training-data assumptions.

## Security

Never put secrets, API keys, tokens, passwords, or real environment-variable
_values_ into any repo file, including these instructions and the `docs/` memory
files. Reference variable _names_ only. `.env.local` is gitignored — never commit
or echo its contents.

## Key conventions (details in `docs/AI_CONTEXT.md`)

- Supabase migrations are applied **manually** in the Dashboard SQL Editor.
- Keep **script + lib twins** (`scripts/*.mjs` ↔ `src/lib/ingestion/*.ts`) in sync.
- Backfill/enrichment only fills blank fields; never overwrite feed metadata.
- Never bypass the signed-URL streaming gate (`/api/stream/[id]`).
- New integrations should degrade gracefully when env vars are absent.

## Shared AI Hub Policy

Follow the same project-routing principles used by the AI hub.

For simple, repetitive, or low-risk tasks, prefer concise low-compute solutions.
For bounded implementation work, reason only as deeply as needed.
Reserve heavy reasoning for architecture, difficult debugging, security-sensitive changes, cross-file refactors, and ambiguous requirements.

Before substantial work, read:

- AGENTS.md
- docs/AI_CONTEXT.md
- docs/DECISIONS.md
- docs/CURRENT_STATE.md

After meaningful work:

- update docs/CURRENT_STATE.md
- update docs/DECISIONS.md when a significant technical decision was made
- append a session entry to docs/SESSION_LOG.md

Treat these files as shared project memory across Copilot, OpenCode, Claude, and other agents.
