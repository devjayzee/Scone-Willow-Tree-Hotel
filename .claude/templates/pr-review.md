# PR review — shared template

Any PR review of this repo (hand-run or automated) follows this decision tree
and vocabulary, so authors know exactly what a comment means.

## Decision matrix

| Decision | When |
|----------|------|
| 🛑 **Request changes (CI)** | The Vitest job (`.github/workflows/test.yml`) failed. Do NOT proceed to architectural review — CI first. |
| ❌ **Request changes** | CI green AND at least one unambiguous hard-rule (1–8) violation with a mechanical fix. |
| ✅ **Approve** | CI green AND zero hard-rule violations. |
| 💬 **Comment** | CI green, but findings are nits / ambiguous / design judgment calls. |

Approval requires BOTH green tests AND clean architecture — never approve on
green tests alone.

## Approve template

```markdown
Rules review: no hard-rule violations across <N> files. CI: green.

<optional Nits (non-blocking): list — max 3 items>
```

## Request-changes template

```markdown
Rules review: <N> hard-rule violation(s) block approval. CI: green.

**Rule <N> — <name>:** `path/file.ts:LINE` — <one-line description>. Fix: <mechanical fix>.

<repeat per violation>

<optional nit list AFTER the blocking findings, clearly separated>
```

## Comment template (nits only)

```markdown
Rules review: no hard-rule violations. CI: green.

Nits (non-blocking):

- `path/file.ts:LINE` — <one-line observation>.
```

## Vocabulary

- **`file:line`** — mandatory on every actionable finding.
- **Nit** — non-blocking; always in a separate `Nits (non-blocking):` list.
- **Mechanical fix** — one sentence. Needs a paragraph? It's a design
  discussion — Comment, don't block.
- **Hard-rule violation** — cite rule number + name from `.claude/rules/`.

## What NOT to write

- Multi-paragraph justifications — file an issue instead of blocking.
- Redesign proposals in a review comment.
- Blocking on style that ESLint/Prettier doesn't catch.
- Findings without `file:line`.

## Suppression markers

Respect `// claude-allow: rule-N — <reason>` markers: a marked line is never a
Request-changes. Thin or missing reason → flag as Comment only.

## Plan check

Feature/refactor PRs should reference their (now-deleted) plan's acceptance
criteria in the description. A PR that exceeds ~500 changed lines or spans
multiple domains should have been split at plan time — flag it as a Comment.
