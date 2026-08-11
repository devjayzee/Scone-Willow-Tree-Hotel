---
paths:
  - "src/app/(dashboard)/**/*.tsx"
  - "src/app/api/**/*.ts"
  - "src/lib/auth-guard.ts"
  - "src/middleware.ts"
  - "src/lib/auth.ts"
---

# Rule 4: Auth at the boundary — session check + inline role gate

Three layers of protection:

1. **Middleware (`src/middleware.ts`, `withAuth`)** — fast-path UX redirect
   for unauthenticated users on dashboard routes. Also rate-limits credential
   logins (5 attempts / 15 min on `/api/auth/callback/credentials`). NOT the
   security boundary — `withAuth` calls `getToken()` internally, which decodes
   the JWE but does NOT invoke the `jwt` callback, so revocation/expiry never
   runs here (#181).
2. **Dashboard pages/layout** — `(dashboard)/layout.tsx` calls
   `await requireSession()` from `@/lib/auth-guard`. Role-restricted pages
   pass a role (or role array). `requireSession` uses `getServerSession`,
   which DOES run the `jwt` callback — so a deactivated or expired session
   gets kicked out before any RSC data fetch. This is the page-side
   security boundary.
3. **API routes** — every handler calls `getServerSession` itself. Middleware
   protection is not enough — middleware config can drift.

## Canonical patterns

**API route:**

```ts
const session = await getServerSession(authOptions);
if (!session?.user) {
  throw new UnauthorizedError();
}
```

**Dashboard page (role-gated):**

```tsx
import { requireSession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function StaffsPage() {
  const session = await requireSession("GENERAL_MANAGER");
  // ...
}
```

Role gate (from `src/app/api/staffs/route.ts`) — inline, with a human-readable
reason:

```ts
if (session.user.role !== "GENERAL_MANAGER") {
  throw new ForbiddenError("Only managers can view staff list");
}
```

Current role gates (keep this list true when adding gates):

**API-level (server-enforced in the handler):**

| Action | Required role |
|---|---|
| Staff CRUD (`/api/staffs/**`) | `GENERAL_MANAGER` |
| Room mutations (`POST /api/rooms`, `PUT`/`DELETE /api/rooms/[id]`) | `GENERAL_MANAGER` |
| Delete booking (`DELETE /api/bookings/[id]`) | `GENERAL_MANAGER` |
| Reports (`GET /api/reports`) | `MANAGER` or `GENERAL_MANAGER` |
| Room reads (`GET /api/rooms`, `GET /api/rooms/[id]`) | any authenticated user |
| Everything else | any authenticated user |

**Page-level (server-side `requireSession` in each page + layout):**

| Path | Required role |
|---|---|
| `/rooms`, `/reports` | `MANAGER` or `GENERAL_MANAGER` |
| `/staff` | `GENERAL_MANAGER` |
| Every other dashboard page | any authenticated user (layout gate) |

Middleware's role redirects in `src/middleware.ts` are the fast-path UX
mirror of these; the server-side `requireSession` calls are the security
boundary because they invoke `getServerSession` and therefore run the
revocation/expiry logic in the `jwt` callback.

Keep both middleware and page-side gates when adding a new gated area — the
middleware redirect is the snappier UX; the page-side call is the guarantee.

Requirements:

- `session.user.id` / `session.user.role` exist via the augmentation in
  `src/types/next-auth.d.ts` — extend that file if the session shape grows.
- Role comparisons use the string literals from the Prisma `Role` enum
  (`GENERAL_MANAGER`, `MANAGER`, `STAFF`).
- Throw `UnauthorizedError` (401) for "who are you", `ForbiddenError` (403)
  for "you can't do that" — don't mix them up.

## Anti-patterns

```ts
// WRONG: trusting middleware alone for an API route (middleware config can drift)
export async function GET() { return NextResponse.json(await getAllStaff()); }

// WRONG: role check buried in a service — services are session-free (Rule 2)

// WRONG: client-supplied identity
const { userId } = await request.json(); // → use session.user.id
```

## Audit checks

```bash
# API handlers missing a session check
grep -rL "getServerSession" src/app/api --include="route.ts" | grep -v "api/auth/"

# dashboard pages missing a requireSession call
grep -rL "requireSession" "src/app/(dashboard)" --include="page.tsx" --include="layout.tsx"
```

## Allowed exceptions

- `src/app/api/auth/**` — NextAuth internals and the public
  `rate-limit-status` endpoint.
