---
paths:
  - "src/app/api/**/*.ts"
---

# Rule 1: API routes delegate — no business logic, no Prisma

A route handler is glue: authenticate, parse, validate, call ONE service
function, serialize. Everything else belongs in `src/lib/services/`.

## Canonical pattern

From `src/app/api/bookings/route.ts`:

```ts
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const validation = createBookingSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "creating booking");
    }

    const booking = await createBooking(validation.data, session.user.id, session.user.id);
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    return handleApiError(error, "creating booking");
  }
}
```

Requirements:

- Wrap the whole handler in `try/catch`; the catch is always
  `return handleApiError(error, "<verb>ing <thing>")`.
- Auth first: `getServerSession(authOptions)` → throw `UnauthorizedError` from
  `@/lib/errors` (never hand-roll a 401 response). Importing the error class
  from `@/lib/api-error-handler` is equivalent — it re-exports the same
  classes for convenience, and most existing routes use that shorter path.
- Body/query validated with a zod schema from `@/lib/validations/` via
  `safeParse` before touching a service.
- Pass session-derived values (e.g. `session.user.id`) into the service as
  arguments — services never read the session themselves.
- `NextResponse.json(...)` with `{ status: 201 }` for creations; default 200 otherwise.

## Anti-patterns

```ts
// WRONG: Prisma in a route handler
import prisma from "@/lib/prisma";
export async function GET() {
  const rooms = await prisma.room.findMany();   // → move to room-service.ts
}

// WRONG: ad-hoc error responses
return NextResponse.json({ error: "Not allowed" }, { status: 403 });
// → throw new ForbiddenError("...") and let handleApiError shape it

// WRONG: business rules in the route (overlap checks, status transitions,
// availability math) — those live in the service.
```

## Audit checks

```bash
# Prisma must not appear in route handlers
grep -rn "@/lib/prisma\|@prisma/client" src/app/api --include="*.ts" | grep -v "import type"

# Every route file should use handleApiError
grep -rL "handleApiError" src/app/api --include="route.ts"
```

## Allowed exceptions

- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth owns this handler.
- `import type { ... } from "@prisma/client"` (type-only) is fine in routes.
