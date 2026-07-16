---
paths:
  - "src/lib/validations/**/*.ts"
  - "src/types/**/*.ts"
---

# Rule 3: Zod owns input validation; `src/types/` owns the wire format

Two distinct type homes with distinct jobs — don't blur them:

- `src/lib/validations/<domain>.ts` — zod schemas that validate **inputs** at
  the API boundary. Server-side input types are inferred from them.
- `src/types/<domain>.ts` — hand-written **serialized response** shapes the
  client consumes (dates as ISO strings, `Decimal` as `string | number`),
  plus client-side input types.

## Canonical pattern

From `src/lib/validations/booking.ts`:

```ts
// Reusable field schemas at the top
const phoneSchema = z.string().min(1, "Mobile number is required").regex(...);

export const createBookingSchema = z.object({ ... });
export const updateBookingSchema = z.object({ ... });

// Inferred input types — never hand-write these
export type CreateBookingSchemaInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingSchemaInput = z.infer<typeof updateBookingSchema>;
```

From `src/types/booking.ts` (wire format — dates already serialized):

```ts
export interface Booking {
  id: string;
  checkIn: string;            // ISO string over the wire, not Date
  bondDeposit?: string | number | null;  // Decimal serializes
  status: BookingStatus;      // re-exported from @prisma/client
  // ...
}
```

Requirements:

- Every new API input gets a schema in `src/lib/validations/` with
  user-readable error messages (they surface in API responses).
- Enum values mirror the Prisma enums (`z.enum(["CONFIRMED", ...])`).
- Share field schemas (phone, dates, password) within the file instead of
  repeating regexes.
- Client code imports types from `@/types/<domain>`, not from validations.

## Anti-patterns

```ts
// WRONG: zod schema defined inside a component or route file
const schema = z.object({ ... }); // → move to src/lib/validations/

// WRONG: hand-written interface duplicating a schema for server-side input
interface CreateRoomBody { roomNumber: string; ... } // → z.infer<typeof createRoomSchema>

// WRONG: Date fields in src/types/ wire types — JSON has no Date
checkIn: Date;
```

## Audit checks

```bash
# schemas defined outside lib/validations
grep -rn "z\.object(" src/app src/components src/hooks --include="*.ts" --include="*.tsx"

# Date-typed fields leaking into wire types
grep -n ": Date" src/types/*.ts | grep -v "next-auth.d.ts"
```

## Allowed exceptions

- `src/types/next-auth.d.ts` — module augmentation, its own format.
- Prisma model/enum types may be re-exported from `@prisma/client` for convenience.
