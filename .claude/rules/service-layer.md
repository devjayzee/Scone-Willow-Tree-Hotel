---
paths:
  - "src/lib/services/**/*.ts"
---

# Rule 2: Services own business logic and are the only Prisma callers

`src/lib/services/` is the single home for **business-logic services**:
domain rules and database access. One `<domain>-service.ts` per domain;
split into a `<domain>/` folder module (with `index.ts` re-exports) only
when the file grows past ~300 lines — see `src/lib/services/booking/`
and its compat shim `booking-service.ts`.

**Outbound infrastructure adapters** (transport-layer plumbing for
side effects like email, SMS, storage, PDF, webhooks) are a distinct
category and live outside `services/` — see the "Infrastructure
adapters" section below.

## Canonical pattern

From `src/lib/services/room-service.ts`:

```ts
import prisma from "@/lib/prisma";                       // default import
import type { CreateRoomInput } from "@/lib/validations/room";
import { NotFoundError, ConflictError } from "@/lib/errors";

export async function getRoomById(id: string) {
  const room = await prisma.room.findUnique({ where: { id }, include: { ... } });
  if (!room) {
    throw new NotFoundError("Room not found");
  }
  return room;
}

export async function createRoom(data: CreateRoomInput): Promise<PrismaRoom> {
  const existing = await prisma.room.findUnique({ where: { roomNumber: data.roomNumber } });
  if (existing) {
    throw new ConflictError("Room number already exists");
  }
  // ...
}
```

Requirements:

- Plain exported async functions (no classes). Input types come from
  `z.infer` types in `@/lib/validations/`.
- Failures are thrown domain errors from `@/lib/errors`
  (`NotFoundError`, `ConflictError`, `BusinessRuleError`, ...) — never return
  `NextResponse`, never `throw new Error("...")` for expected failures.
- Services are HTTP-free and session-free: no `next/server`, no
  `getServerSession`. Caller identity arrives as arguments (`userId`).
- Mutations on core entities record an audit entry via
  `@/lib/services/audit-service`.
- Pure helpers (e.g. `sortRoomsByNumber`) are exported so tests can hit them directly.

## Anti-patterns

```ts
// WRONG: HTTP concerns in a service
import { NextResponse } from "next/server";

// WRONG: reading the session inside a service
const session = await getServerSession(authOptions);

// WRONG: swallowing failures
return null; // when the room is missing → throw new NotFoundError(...)
```

## Audit checks

```bash
# services must be HTTP- and session-free
grep -rn "next/server\|next-auth" src/lib/services --include="*.ts"

# prisma imports outside the allowed zone
grep -rln "@/lib/prisma" src --include="*.ts" --include="*.tsx" \
  | grep -v "^src/lib/services/" | grep -v "^src/lib/auth.ts" | grep -v "^src/__tests__/"
```

## Infrastructure adapters — outside this rule

Outbound side effects with a swappable transport (email, SMS, storage,
PDF, webhooks) live at `src/lib/<name>/`, **not** under `services/`.
They are Prisma-free peers of the service layer, not services
themselves.

Shape:

- `src/lib/<name>/<name>-transport.ts` — the interface + a singleton
  factory that picks the implementation from env.
- `src/lib/<name>/<provider>-transport.ts` — one file per concrete
  implementation (real provider, dev/log fallback, test double).
- `src/lib/<name>/templates/` — optional; pure render functions with
  no I/O.
- Any supporting helpers (env guards, URL builders) alongside.

Canonical example: `src/lib/email/` (`email-transport.ts` interface,
`resend-transport.ts` + `dev-transport.ts` implementations, `templates/`
for `password-reset` and `invite-setup`, `app-url.ts` for the
`NEXTAUTH_URL` guard).

Requirements:

- MUST NOT import `@/lib/prisma`. If an adapter needs persistence
  (e.g. an outbox table), it calls a service — services own Prisma,
  not adapters.
- MAY be called by services OR by route handlers directly (a route
  that only dispatches a side effect and does no domain work doesn't
  need a passthrough service).
- Fail fast on missing prod config (see `src/lib/email/email-transport.ts`
  for the pattern — throw at module load if a dev-only fallback would
  leak in prod).
- Tests mock the transport interface, not the provider.

Promote to its own rule file (`.claude/rules/infra-adapters.md`) once
the second adapter lands and there's a real cross-module pattern to
document.

## Allowed exceptions

- `src/lib/auth.ts` imports prisma for the NextAuth adapter + credential checks.
- `prisma/seed.ts` instantiates its own client.
- Infrastructure adapters at `src/lib/<name>/` (see above) are legitimate
  Prisma-free peers of `services/` and are not violations of this rule.
