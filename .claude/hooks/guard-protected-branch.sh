#!/usr/bin/env bash
# PreToolUse guard wired from .claude/settings.json.
#
# Two behaviors, in order:
# 1. Hard block (exit 2). Edit/Write to src/ or prisma/ while on main or
#    development. CLAUDE.md's git workflow requires a <type>/<name> branch
#    for structural changes.
# 2. Soft warn (exit 1). Edit/Write to src/ or prisma/ on a feat/fix/refactor
#    branch when there is no plan file or the plan is Status: draft. Exit 1
#    is non-blocking — the tool call still proceeds — but the stderr message
#    surfaces in the transcript so it's visible.
#
# .claude/, plans/, and docs stay editable everywhere on every branch.
set -euo pipefail

branch="$(git branch --show-current 2>/dev/null || echo '')"

# Only branches that could be doing structural work trigger anything.
case "$branch" in
  main|development|feat/*|refactor/*|fix/*) ;;
  *) exit 0 ;;
esac

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

# Only src/ and prisma/ paths are structural.
case "$rel" in
  src/* | prisma/*) ;;
  *) exit 0 ;;
esac

# Behavior 1: hard block on protected branches.
if [[ "$branch" == "main" || "$branch" == "development" ]]; then
  echo "Blocked: '$rel' is a structural path and the current branch is '$branch'. CLAUDE.md git workflow: branch first (git checkout development && git pull --rebase origin development && git checkout -b <type>/<name>)." >&2
  exit 2
fi

# Behavior 2: soft warn on feat/refactor/fix without an approved plan.
plan_file="plans/$(printf '%s' "$branch" | tr '/' '-').md"
if [[ ! -f "$plan_file" ]]; then
  echo "⚠ Plan-first workflow: no plan at '$plan_file' for branch '$branch'. Consider invoking the architect agent before extensive changes to '$rel'. (Non-blocking.)" >&2
  exit 1
fi
if grep -q "^\*\*Status:\*\* draft" "$plan_file" 2>/dev/null; then
  echo "⚠ Plan-first workflow: '$plan_file' is Status: draft. Flip to 'approved' before extensive changes to '$rel'. (Non-blocking.)" >&2
  exit 1
fi
exit 0
