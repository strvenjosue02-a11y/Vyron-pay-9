#!/bin/bash
set -euo pipefail

# Only for Claude Code cloud sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# npm install only when package.json / lockfile / this script changed since the last success.
if [ -f package.json ]; then
  hashes=node_modules/.session-start.sha256
  if ! sha256sum --check --status "$hashes" 2>/dev/null; then
    rm -f "$hashes"
    npm install --no-audit --no-fund >&2
    sha256sum .claude/hooks/session-start.sh package.json package-lock.json 2>/dev/null > "$hashes" || rm -f "$hashes"
  fi
fi

# Collective memory: surface the lessons and open hand-offs as session context.
if [ -d .claude/memory ]; then
  echo "Memoria colectiva (.claude/memory): lee LESSONS.md antes de programar y atiende HANDOFF.md."
  echo "--- LESSONS.md ---"
  cat .claude/memory/LESSONS.md 2>/dev/null || true
  echo "--- HANDOFF.md (abierto) ---"
  sed -n '/^## Abierto/,/^## Cerrado/p' .claude/memory/HANDOFF.md 2>/dev/null | sed '$d' || true
fi
