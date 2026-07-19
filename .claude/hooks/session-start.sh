#!/usr/bin/env bash
# SessionStart hook wired from .claude/settings.json.
# Prints branch + plan status once at session start so Claude doesn't have
# to spend tool calls figuring out where the work stands. Stdout is
# injected into the session context per Claude Code hooks docs.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
branch="$(git branch --show-current 2>/dev/null || echo '')"
[[ -n "$branch" ]] || exit 0

case "$branch" in
  main|development)
    echo "Branch: $branch — structural edits to src/ or prisma/ are hard-blocked on this branch. Create a feat/, fix/, or refactor/ branch first."
    ;;
  feat/* | refactor/* | fix/*)
    plan_file="plans/$(printf '%s' "$branch" | tr '/' '-').md"
    if [[ ! -f "$plan_file" ]]; then
      echo "Branch: $branch — no plan at '$plan_file'. Run the architect agent for feature/refactor work; a bare fix may proceed."
    elif grep -q "^\*\*Status:\*\* approved" "$plan_file" 2>/dev/null; then
      echo "Branch: $branch — plan '$plan_file' is Status: approved."
    elif grep -q "^\*\*Status:\*\* draft" "$plan_file" 2>/dev/null; then
      echo "Branch: $branch — plan '$plan_file' is Status: draft. Flip to 'approved' before extensive work."
    else
      echo "Branch: $branch — plan at '$plan_file' (status unclear)."
    fi
    ;;
  *)
    echo "Branch: $branch"
    ;;
esac
exit 0
