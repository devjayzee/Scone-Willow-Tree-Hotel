---
name: architecture-auditor
description: Architecture audit skill for the Willow Tree Hotel codebase. Scans against the project's hard rules (.claude/rules/ 1-8), runs quantitative analysis scripts, and produces a report per .claude/templates/audit-report.md. Use when auditing for architectural consistency, rule violations, dependency issues, or technical debt assessment.
---

# Architecture Auditor Skill

Structured audit of this Next.js App Router + Prisma codebase. The audit has
two halves: **rule compliance** (the project's own hard rules) and
**quantitative health** (metrics scripts). Read-only — audits flag, they don't
refactor.

## Quick start

1. **Run the core scripts** (always, before any findings):

```bash
bash .claude/skills/architecture-auditor/scripts/analyze-structure.sh src/
bash .claude/skills/architecture-auditor/scripts/check-circular-deps.sh src/
bash .claude/skills/architecture-auditor/scripts/calculate-metrics.sh src/
```

Optional deeper passes:

```bash
bash .claude/skills/architecture-auditor/scripts/analyze-dependencies.sh src/   # madge/dep-cruiser if installed
bash .claude/skills/architecture-auditor/scripts/analyze-git-history.sh src/    # churn × complexity
```

2. **Check rule compliance.** The 8 hard rules live in `.claude/rules/` and
   each file ends with an "Audit checks" section containing runnable greps.
   Read each rule, run its checks, post-filter through suppression markers:

| # | Rule file | Checks |
|---|-----------|--------|
| 1 | `api-route-delegation.md` | Prisma/business logic in routes; missing `handleApiError` |
| 2 | `service-layer.md` | HTTP/session imports in services; prisma outside allowed zone |
| 3 | `validation-schemas.md` | `z.object` outside validations; `Date` in wire types |
| 4 | `auth-guard.md` | handlers missing session checks |
| 5 | `server-state-tanstack.md` | `fetch` in components; inline query keys |
| 6 | `form-patterns.md` | react-hook-form usage; fetch in form components |
| 7 | `rsc-boundary.md` | client pages/layouts; services in client components |
| 8 | `testing.md` | colocated tests; services without tests |

Each rule documents its own allowed exceptions and known false positives —
apply them before reporting.

## Suppression markers

Respect `// claude-allow: rule-N — <reason>` (inline or the line above a
match). A marked line is NOT a violation — list it under "Suppressed" in the
report. If the reason is missing or thin, list it under "Suspicious
suppressions" instead. Never treat a suppressed line as a finding.

## Severity classification

| Severity | Qualitative | Quantitative triggers |
|----------|-------------|----------------------|
| **Critical** | Hard-rule violation on a hot path; cascading failures | Circular deps, CC>50, Ca>20 |
| **High** | Hard-rule violation; significant maintenance burden | CC>20, Ce>12, LOC>500 |
| **Medium** | Convention drift, minor coupling | CC>10, Ce>8, LOC>300 |
| **Low** | Best-practice deviation, nit | Warning-level threshold breach |

Thresholds and formulas: [references/architecture-metrics.md](references/architecture-metrics.md).

## Context7 verification

Before flagging a framework-pattern violation (not covered by a project rule),
verify against live docs:

| Framework | Library ID |
|-----------|------------|
| Next.js | `/vercel/next.js` |
| React | `/facebook/react` |
| Prisma | `/prisma/docs` |
| NextAuth.js | `/nextauthjs/next-auth` |

Workflow: `resolve-library-id("<lib>", "<question>")` →
`query-docs("<id>", "<specific question>")` → cite in the finding.

## Report format

Follow `.claude/templates/audit-report.md` exactly: one section per rule (even
when clean), `file:line` on every finding, one-line mechanical fix, Suppressed
and Suspicious-suppressions sections, standard summary block.

## References

- [references/architecture-metrics.md](references/architecture-metrics.md) — CC, Ca/Ce, LCOM, Instability thresholds
- [references/nextjs-architecture.md](references/nextjs-architecture.md) — App Router patterns, server/client split
- [references/eslint-architecture-rules.md](references/eslint-architecture-rules.md) — lint rules to codify findings
- [references/arc42-report-template.md](references/arc42-report-template.md) — long-form architecture documentation (only when asked for full docs)
