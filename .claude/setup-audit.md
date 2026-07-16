# Claude Setup Audit & Improvement Plan

Audited 2026-07-16 against reference projects `nuwebakes-api` and `nuwebakes-web`
(`/Users/jeromezarate/development/personal-projects/nuwebakes/`).

## Current state

| Artifact | This project | nuwebakes (reference) |
|---|---|---|
| CLAUDE.md | none | ~350–530 line spec: stack, architecture, rule index, workflows |
| Rules | none | 8 (api) / 20 (web) path-scoped rules |
| Agents | 1 (architecture-auditor, audit-only) | architect + designer (design-first, plan-gated) |
| Skills | 1 (architecture-auditor, ~5,300 lines) | 4 each: design-prisma-model, design-api-contract/client, scaffold-feature, audit |
| Templates | none | audit-report.md, pr-review.md |
| settings.json (shared) | none | `.env` read-deny + SessionStart/PreToolUse hooks |

## Problems and fixes

### 1. No CLAUDE.md — the biggest gap
**Problem:** Every session starts blind. Claude must re-derive that this is
Next.js 16 + Prisma 7 + NextAuth + the `route → service → prisma` layering every
time. The existing agent/skill are undiscoverable without an index.

**Fix:** Root CLAUDE.md (~200 lines) modeled on nuwebakes: stack, commands
(dev/test/lint, prisma), architecture map (`(auth)`/`(dashboard)` route groups,
API routes → `lib/services` → prisma singleton), conventions, rule-index table,
agent/skill index, `main`/`development` git workflow.

### 2. The setup can only criticize, never guide
**Problem:** The only artifacts audit code *after* it's written. Nothing shapes
code *while* it's written — no rules, no architect agent, no scaffold/design
skills. Nothing stops Prisma calls landing directly in a route handler.

**Fix:** Add the builder side, adapted from nuwebakes:
- `architect` agent — designs before code, writes `plans/<branch>.md` with a
  `Status: approved` gate
- Skills: `design-prisma-model` (UUID PKs, `@map` snake_case, bounded VarChar,
  integer centavos for money, index coverage — drop multi-tenant `businessId`),
  `scaffold-feature`, `design-component`

### 3. No rules despite real, discoverable conventions
**Problem:** The codebase has consistent patterns (routes: auth → validate →
service → `handleApiError`; Zod in `lib/validations`; shadcn forms; TanStack
Query) but none are codified, so they erode with every edit.

**Fix:** `.claude/rules/` with ~8 path-scoped rules (nuwebakes format: `paths:`
frontmatter, canonical + anti-pattern examples from actual code, grep audit
checks):
- `api-route-delegation` — routes: auth → validate → service → handleApiError
- `service-layer` — Prisma only in services
- `validation-schemas` — Zod in lib/validations, infer types
- `rsc-boundary` — server default, 'use client' leaves
- `server-state-tanstack` — TanStack Query patterns, query keys
- `form-patterns` — RHF + zodResolver + shadcn Form
- `auth-guard` — getServerSession/middleware, role checks
- `testing` — Vitest, `src/__tests__` mirroring

**Caveat:** nuwebakes-web rules encode FSD layering; this project uses domain
folders + a service layer. Adapt, don't copy.

### 4. The auditor skill is 5,300 lines, ~65% generic textbook
**Problem:** `references/` holds ~3,400 lines of SOLID/ISO-25010/code-smells/DDD
theory Claude already knows — context bloat, no project-specific signal. The
auditor also exists as both a 378-line agent AND a 241-line skill (two sources
of truth).

**Fix:** Delete `solid-principles.md`, `iso-25010-quality-model.md`,
`code-smells.md`, `ddd-patterns.md`. Keep `nextjs-architecture.md`,
`architecture-metrics.md`, `arc42-report-template.md`,
`eslint-architecture-rules.md`, and the 6 scripts. Slim the agent to a thin
wrapper that invokes the skill.

### 5. Settings: no hardening, arbitrary allowlist
**Problem:** No shared `settings.json`; nothing denies `.env` reads (DB +
Upstash credentials); local allowlist is odd (`magick`, `convert`) and misses
daily commands. No hooks.

**Fix:** Committed `.claude/settings.json`: deny `Read(./.env*)`, allow
`npm run test/lint/build`, `npx prisma generate/validate`; `PreToolUse`
branch-guard hook (block edits on `main`/`development`); optional SessionStart
context script.

### 6. No templates
**Fix:** Adapt `audit-report.md` and `pr-review.md` from nuwebakes-api, with the
`// claude-allow: rule-N — reason` suppression-marker convention.

## Implementation checklist (priority order)

- [x] 1. CLAUDE.md (highest leverage)
- [x] 2. `.claude/rules/` (~8 files encoding actual conventions)
- [x] 3. Architect agent + plan-first workflow
- [x] 4. Skills: design-prisma-model, scaffold-feature
- [x] 5. Settings hardening + hooks
- [x] 6. Slim auditor skill + add templates
