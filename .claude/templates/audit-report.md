# Audit report — shared template

The `architecture-auditor` agent/skill and any ad-hoc audit output must follow
this shape. Consistent phrasing means readers (and future audits) can compare
findings across runs.

## Structure

```markdown
# <Report Title> — <YYYY-MM-DD>

Audited: <scope — e.g. src/, N files>. Scripts run: <list>.

## Suppressed (informational)

- `path/file.ts:LINE` — rule <N> suppressed: "<reason from marker>".

## Suspicious suppressions (informational)

- `path/file.ts:LINE` — rule <N> suppressed but the reason is missing or thin.

## Rule <N> — <name>

Source: `.claude/rules/<rule-file>.md`

- `path/file.ts:LINE` — <one-line description of the violation>. Fix: <one-line mechanical fix>.

(…one section per rule 1–8, in order, even if the section only says "No violations.")

## Quantitative findings

- `path/file.ts` — <metric breach, e.g. LOC=540 (>500), CC=24>. Fix: <one-line direction>.

## Summary

- Total findings: <N> (hard=<N>, soft=<N>)
- Severity counts: Critical=<N> High=<N> Medium=<N> Low=<N>
- Worst area: <rule or module>
```

## Vocabulary

- **Hard rule violation** — breaks one of the 8 rules in `.claude/rules/`.
- **Soft smell / nit** — convention drift or judgment call with no rule anchor.
- **Mechanical fix** — a specific, unambiguous edit that closes the finding.
  One sentence. If it needs a paragraph, it's a design discussion — flag it as
  such and point to the `architect` agent.
- **file:line** — `src/lib/foo.ts:42`, backticked. Never a bare path.
- **Section per rule** — include the heading even when clean; write
  "No violations." — do NOT omit clean rules.

## What NOT to write

- Multi-paragraph explanations — one sentence per finding.
- Redesign proposals — audits flag, they don't refactor.
- Generic style nits with no rule anchor.
- Findings without `file:line` evidence.
- Findings on suppressed lines.
