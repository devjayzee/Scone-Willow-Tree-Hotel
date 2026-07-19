# Plans

Per-branch design documents produced by the `architect` agent (or by hand)
before implementation starts. See "Plan-first workflow" in the root
`CLAUDE.md` for the process and rules.

- One plan per feature branch: `plans/<branch>.md` (slashes → dashes).
- A plan starts as `Status: draft`; only a human marks it `approved`.
- No structural code lands on a feature branch without an approved plan.
- Plans are gitignored (local-only). Delete the plan after the PR merges —
  git history is the source of truth.

## Plan template

```markdown
# Plan: <short-name>

**Branch:** <git-branch>
**Type:** feat | fix | chore | refactor
**Created:** <YYYY-MM-DD>
**Status:** draft | approved | in-progress | done

## Goal

<1 paragraph — what success looks like and why>

## Approach

<numbered steps; include schema blocks, endpoint tables, hook/component
designs here when relevant>

## Files

### To create
- <path> — <one-line purpose>

### To modify
- <path> — <what changes>

## Open decisions

<bullets the human must decide before code starts>

## Risks / unknowns

<bullets>

## Acceptance criteria

- [ ] <observable outcome>

## Estimated scope

- Lines changed: ~N · Files touched: ~N · Complexity: small | medium | large
```
