# Plans

Per-branch design documents produced by the `architect` agent (or by hand)
before implementation starts. See "Plan-first workflow" in the root
`CLAUDE.md` for the template and rules.

- One plan per feature branch: `plans/<branch>.md` (slashes → dashes).
- A plan starts as `Status: draft`; only a human marks it `approved`.
- No structural code lands on a feature branch without an approved plan.
- Plans are gitignored (local-only). Delete the plan after the PR merges —
  git history is the source of truth.
