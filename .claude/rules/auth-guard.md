---
paths:
  - "src/app/api/**/*.ts"
  - "src/middleware.ts"
  - "src/lib/auth.ts"
---

# Rule 4: Auth at the boundary — session check + inline role gate

Two layers of protection, both mandatory:

1. **Pages:** `src/middleware.ts` (`withAuth`) redirects unauthenticated users
   away from `(dashboard)` routes. It also rate-limits credential logins via
   Upstash (5 attempts / 15 min on `/api/auth/callback/credentials`).
2. **API routes:** middleware protection is NOT enough — every handler
   re-checks the session itself.

## Canonical pattern

```ts
const session = await getServerSession(authOptions);
if (!session?.user) {
  throw new UnauthorizedError();
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

| Action | Required role |
|---|---|
| Staff CRUD (`/api/staffs/**`) | `GENERAL_MANAGER` |
| Delete booking (`DELETE /api/bookings/[id]`) | `GENERAL_MANAGER` |
| Everything else in the dashboard | any authenticated user |

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
# handlers missing a session check
grep -rL "getServerSession" src/app/api --include="route.ts" | grep -v "api/auth/"
```

## Allowed exceptions

- `src/app/api/auth/**` — NextAuth internals and the public
  `rate-limit-status` endpoint.
