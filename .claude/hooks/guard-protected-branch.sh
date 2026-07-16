#!/usr/bin/env bash
# PreToolUse guard wired from .claude/settings.json. Blocks Edit/Write to
# src/ or prisma/ while on main or development — CLAUDE.md's git workflow
# requires a <type>/<name> branch for structural changes. Docs, .claude/,
# and plans/ stay editable everywhere.
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || echo '')"
if [[ "$branch" != "main" && "$branch" != "development" ]]; then
  exit 0
fi

input="$(cat)"
if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo '')"
else
  file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
fi
[[ -n "$file_path" ]] || exit 0

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"
[[ -n "$repo_root" ]] || exit 0

# Strip whichever root spelling matches — macOS reports /var vs /private/var
# depending on symlink resolution, and hooks may receive either form.
phys_pwd="$(pwd -P)"
rel="$file_path"
for prefix in "$repo_root" "$PWD" "$phys_pwd"; do
  [[ -n "$prefix" ]] && rel="${rel#"$prefix"/}"
done
case "$rel" in
  src/* | prisma/*)
    echo "Blocked: '$rel' is a structural path and the current branch is '$branch'. CLAUDE.md git workflow: branch first (git checkout development && git pull --rebase origin development && git checkout -b <type>/<name>)." >&2
    exit 2
    ;;
esac
exit 0
