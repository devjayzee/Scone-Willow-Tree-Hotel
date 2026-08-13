# CLAUDE.md

Hotel management system for the Willow Tree Hotel (Scone): bookings, rooms,
staff, calendar, and reports behind a role-gated dashboard.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Database:** PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- **Auth:** NextAuth 4 (credentials + `@auth/prisma-adapter`), role-based (`GENERAL_MANAGER`, `MANAGER`, `STAFF`)
- **Validation:** Zod 4 (`src/lib/validations/`)
- **Forms:** custom form-state hooks (`use-<domain>-form.ts`) — react-hook-form
  is intentionally NOT a dependency; do not add it. Adopting it is a
  project-wide decision, not a per-component one.
- **Server state:** TanStack Query 5 (query-key factories)
- **UI:** shadcn/ui (Radix + CVA) + Tailwind 4, lucide-react icons, sonner toasts
- **Rate limiting:** Upstash Redis (login attempts, in middleware)
- **Testing:** Vitest 4 + jsdom + Testing Library

## Commands

```bash
npm run dev            # dev server
npm run build          # prisma generate && next build
npm run lint           # eslint (enforces architecture rules 1/2/5/6/7)
npm run typecheck      # tsc --noEmit (fast type check)
npm run test           # vitest watch mode
npm run test:run       # vitest single run (use this to verify)
npm run test:coverage  # coverage report
npx prisma generate    # regenerate client after schema changes
npx prisma migrate dev # create/apply migration
npx prisma db seed     # runs prisma/seed.ts via tsx
```

Environment lives in `.env` (never read or print it); `.env.example` documents
the shape. Required: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Optional:
`RESEND_API_KEY` + `EMAIL_FROM` (transactional email; unset → emails are
logged to console instead of sent).

## Architecture

Layered, domain-foldered. The request flow for every API route:

```
Route handler (src/app/api/**)          auth check + zod parse only
  → Service (src/lib/services/**)       business logic, ONLY place Prisma is used
    → Prisma singleton (src/lib/prisma.ts)
```

Client components never fetch directly — they go through TanStack Query hooks
in `src/hooks/`, which call the API routes.

### Directory map

```
src/
├── app/
│   ├── (auth)/login/          public auth pages
│   ├── (dashboard)/           protected pages: bookings, calendar, reports, rooms, staff
│   └── api/                   route handlers: auth, bookings, calendar, reports, rooms, staffs
├── components/
│   ├── ui/                    shadcn primitives — do not hand-edit style conventions
│   └── <domain>/              auth, booking, calendar, layout, providers, report, room, staff
├── hooks/                     TanStack Query hooks (use-bookings, use-rooms, ...)
│   └── booking/               per-domain module: *-api.ts, *-keys.ts, *-queries.ts, *-mutations.ts
├── lib/
│   ├── services/              one *-service.ts per domain + audit-service.ts
│   ├── validations/           zod schemas per domain
│   ├── constants/  utils/     shared constants and helpers
│   ├── auth.ts                NextAuth authOptions
│   ├── prisma.ts              Prisma client singleton
│   ├── errors.ts              AppError + NotFound/Conflict/Validation/Unauthorized/Forbidden/BusinessRule errors
│   └── api-error-handler.ts   handleApiError(error, context) → NextResponse
├── types/                     domain types + next-auth.d.ts (session augmentation)
├── __tests__/                 mirrors src/ structure (api/, hooks/, lib/)
└── middleware.ts              withAuth route protection + Upstash login rate limit (5 / 15 min)
```

## Shared infrastructure (already wired — reuse, never duplicate)

- `prisma` singleton from `@/lib/prisma`
- Error classes from `@/lib/errors`; every route handler ends with
  `catch (error) { return handleApiError(error, "<doing what>") }`
- `authOptions` from `@/lib/auth`; session shape augmented in `src/types/next-auth.d.ts`
- `@/lib/logger` for logging, `@/lib/query-invalidation` for cache invalidation helpers
- Client-side API calls: plain `fetch` wrapped in per-domain `*-api.ts` functions
  (see `src/hooks/booking/booking-api.ts`), consumed only by query/mutation hooks
- Audit trail via `audit-service.ts` — mutations to core entities should log

## Hard rules

Detailed, path-scoped rules live in `.claude/rules/` (each applies when
touching its `paths:`). Summary:

| # | Rule | File | One-liner |
|---|------|------|-----------|
| 1 | API routes delegate | `.claude/rules/api-route-delegation.md` | auth → zod `safeParse` → one service call → `handleApiError`; no Prisma/logic in routes |
| 2 | Services own Prisma | `.claude/rules/service-layer.md` | `import prisma from "@/lib/prisma"` only in services; throw domain errors; HTTP/session-free |
| 3 | Zod inputs, typed wire | `.claude/rules/validation-schemas.md` | schemas + `z.infer` inputs in `lib/validations/`; serialized response types in `src/types/` |
| 4 | Auth at the boundary | `.claude/rules/auth-guard.md` | every handler checks session; role gates inline (`ForbiddenError`); middleware protects pages |
| 5 | TanStack server state | `.claude/rules/server-state-tanstack.md` | per-domain hook modules; key factories; no `fetch`/server-`useState` in components |
| 6 | Form patterns | `.claude/rules/form-patterns.md` | custom `use-<domain>-form.ts` hooks + presentational steps; NO react-hook-form |
| 7 | RSC boundary | `.claude/rules/rsc-boundary.md` | pages stay server components; serialize before crossing to `'use client'` leaves |
| 8 | Testing | `.claude/rules/testing.md` | tests mirror source under `src/__tests__/`; mock prisma/logger at module edge |

### Suppression markers

An intentional rule exception is marked inline (or on the line above):
`// claude-allow: rule-N — <reason>`. Audits and PR reviews respect markers;
a thin or missing reason gets flagged as informational, never as a violation.

Additional conventions (no rule file yet):

- **Prisma schema style:** `cuid()` ids, camelCase fields (no `@map`), money as
  `Decimal @db.Decimal(10, 2)`, enums for statuses, explicit relation names for
  multiple relations to the same model (`"CreatedBy"`).
- **Dashboard pages** opt out of static prerender per data volatility and
  serialize Prisma entities (`Date` → ISO string, `Decimal` → string) before
  passing them to `*-client.tsx` components. Two acceptable patterns:
  - `export const dynamic = "force-dynamic"` for pages whose data changes
    constantly (bookings, calendar).
  - `export const revalidate = <seconds>` for pages whose data is
    slower-moving; pick the window from actual change rate (rooms/staff:
    300s, reports: 60s).

## Agents & skills

- **`architect` agent** (`.claude/agents/architect.md`) — designs schema
  changes, API contracts, services, hooks, and UI structure BEFORE
  implementation. Invoke for any new feature or structural change; it writes a
  plan to `plans/<branch>.md` and stops for approval.
- **`architecture-auditor` agent** (`.claude/agents/architecture-auditor.md`) —
  read-only architecture health audit; runs the scripts under
  `.claude/skills/architecture-auditor/scripts/` before reporting.
- **`design-prisma-model` skill** — proposes schema blocks in this project's
  style (cuid, camelCase, `Decimal(10,2)`, indexed FKs). Output-only; never
  edits `schema.prisma` or runs migrations.
- **`scaffold-feature` skill** — generates a full-stack domain slice
  (validations → service → routes → types → hooks → page → client → test
  stubs). Hard-gated: feature branch + approved plan + clean tree.

## Plan-first workflow

For feature branches (`feat/*`, `refactor/*`, and any `fix/*` that changes
structure), a plan document is required before code:

1. Create the branch off `development`.
2. The `architect` agent (or you) writes `plans/<branch>.md` (slashes →
   dashes), `Status: draft`.
3. The human reviews and flips `Status: approved`. Nothing else happens first.
4. If the plan exceeds ~500 changed lines or more than one domain, split it
   into sequenced branches at plan time.
5. After the PR merges, delete the plan — git history is the source of truth.

Plans are gitignored (`plans/*` except `plans/README.md`) — local-only. The
plan template lives in `plans/README.md`.

## Git workflow

- **Permanent branches:** `main` (production, deploys to Vercel on push) and
  `development` (integration, default PR target for features). Both are
  never deleted or recreated.
- **Feature branches** (`feat/*`, `fix/*`, `refactor/*`, `chore/*`, `test/*`,
  `docs/*`) branch off `development`, PR into `development`, and are
  auto-deleted on merge by `.github/workflows/auto-delete-feature-branch.yml`.
- **Release PRs** promote `development` → `main`. `enforce-release-source.yml`
  fails any PR to `main` whose head is not `development`, `hotfix/*`, or
  Dependabot. `development` is preserved through the merge.
- **Hotfix branches** (`hotfix/<name>`) branch off `main`, fix a targeted
  prod issue, and PR directly to `main` — bypassing `development` so
  in-flight integration work isn't dragged into the incident fix.
- **Dependabot** — `.github/dependabot.yml` targets `development` for
  weekly version updates. Security-update PRs always target `main` (a
  GitHub-side limitation — `target-branch` doesn't apply to security PRs),
  and the guard exempts `dependabot[bot]` so those land straight to `main`.
- **After any `main` advance** (release PR, hotfix PR, or Dependabot
  security PR), sync locally:
  ```
  git checkout main && git pull
  git checkout development && git pull
  git merge main --no-edit
  git push origin development
  ```
  Keeps the two branches in step and prevents lockfile conflicts on the
  next release.
- Conventional commits: `feat(scope):`, `fix(scope):`, `refactor(scope):`, `chore(scope):`, `test:`, `docs:`.
- PRs merge as merge commits (squash and rebase disabled at the repo level
  to preserve per-commit history).
- CI (`.github/workflows/test.yml`) runs the Vitest suite; `prisma generate`
  must run before tests.
- Never commit `.env`. Never push directly to `main` — enforced client-side
  by `.githooks/pre-push`. New checkouts need one-time setup:
  `git config core.hooksPath .githooks`. Emergency bypass:
  `git push --no-verify`.
- A `PreToolUse` hook (`.claude/hooks/guard-protected-branch.sh`) governs
  Edit/Write to `src/` and `prisma/`:
  - **Blocks** on `main` / `development` (structural changes require a
    `<type>/<name>` branch).
  - **Warns** (non-blocking) on `feat/*` / `refactor/*` / `fix/*` when
    `plans/<branch>.md` is missing or `Status: draft`.
  - `.claude/`, `plans/`, and docs stay editable everywhere.
- A `SessionStart` hook (`.claude/hooks/session-start.sh`) prints the current
  branch and plan status so the assistant doesn't have to derive it.
- PR reviews follow `.claude/templates/pr-review.md` (decision matrix,
  vocabulary, suppression-marker handling).
