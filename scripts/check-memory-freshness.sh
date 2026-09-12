#!/bin/sh
# check-memory-freshness.sh
#
# Warn (never block) when application/source code changes but none of the shared
# AI-memory docs were updated in the same change set. See AGENTS.md.
#
# Usage:
#   sh scripts/check-memory-freshness.sh            # check staged changes
#                                                   # (falls back to unstaged)
#   sh scripts/check-memory-freshness.sh <ref>      # check a ref/range vs work tree
#   sh scripts/check-memory-freshness.sh A..B       # check a commit range
#   npm run check:memory                            # convenience wrapper
#
# It also runs automatically as a pre-commit reminder once hooks are enabled:
#   git config core.hooksPath .githooks
#
# Exit code is always 0 — this is a nudge, not a gate.

set -eu

MEMORY_DOCS="docs/CURRENT_STATE.md docs/SESSION_LOG.md docs/DECISIONS.md docs/AI_CONTEXT.md"

# `changed` = every changed file; `nows` = same list but with whitespace-only
# (formatting-only) changes dropped, so reformatting alone never trips the check.
if [ "${1:-}" != "" ]; then
  changed=$(git diff --name-only --diff-filter=ACMR "$1")
  nows=$(git diff --name-only --diff-filter=ACMR --ignore-all-space "$1")
else
  changed=$(git diff --cached --name-only --diff-filter=ACMR)
  nows=$(git diff --cached --name-only --diff-filter=ACMR --ignore-all-space)
  if [ -z "$changed" ]; then
    # Nothing staged (manual run) — look at unstaged working-tree changes.
    changed=$(git diff --name-only --diff-filter=ACMR)
    nows=$(git diff --name-only --diff-filter=ACMR --ignore-all-space)
  fi
fi

[ -z "$changed" ] && exit 0

# If a shared-memory doc is part of the change set, nothing to remind about.
for f in $changed; do
  for m in $MEMORY_DOCS; do
    [ "$f" = "$m" ] && exit 0
  done
done

# Otherwise, keep only meaningful source/app code (skip docs, markdown, lock
# files, config templates, and binary/asset files).
code_changed=""
for f in $nows; do
  case "$f" in
    docs/*|*.md|*.mdx) continue ;;
    package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lockb|npm-shrinkwrap.json) continue ;;
    *.lock) continue ;;
    .env.example|*.example) continue ;;
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.svg|*.ico|*.wav|*.mp3|*.woff|*.woff2) continue ;;
    .gitignore|.gitattributes|LICENSE) continue ;;
    *) code_changed="$code_changed $f" ;;
  esac
done

code_changed=$(printf '%s' "$code_changed" | sed 's/^ *//')

if [ -n "$code_changed" ]; then
  printf '\n\033[33m⚠  Shared-memory reminder\033[0m\n'
  printf 'Source/app code changed, but none of the shared-memory docs did:\n'
  for m in $MEMORY_DOCS; do printf '  - %s\n' "$m"; done
  printf '\nChanged code files:\n'
  for f in $code_changed; do printf '  • %s\n' "$f"; done
  printf '\nConsider updating shared memory (see AGENTS.md).'
  printf ' This is only a warning — your commit will proceed.\n\n'
fi

exit 0
