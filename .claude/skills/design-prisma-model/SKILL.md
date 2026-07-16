---
name: design-prisma-model
description: |
  Proposes a Prisma schema block for the Willow Tree Hotel codebase with the
  project's conventions applied: cuid() primary keys, camelCase fields with
  no @map, Decimal(10,2) money, SCREAMING_SNAKE enums, @unique natural keys,
  named relations, indexed foreign keys and query paths, createdAt/updatedAt
  timestamps. Outputs the exact schema.prisma block to paste plus rationale
  and next steps. Use when the user says "design the Prisma model for X",
  "model the X table", or "add a schema for X". Do NOT use to run
  migrations, modify schema.prisma directly, or scaffold feature folders
  (use scaffold-feature for that).
allowed-tools: Read, Glob, Grep
---

# Design Prisma Model

## Purpose

Produce a convention-conforming Prisma schema proposal that the user reviews
before adding to `prisma/schema.prisma` and running a migration. Output-only —
does not modify files or run commands.

## When to use

- "design the Prisma model for X" / "model the X table"
- "what should the database look like for X?"
- "design the relations between X and Y"

Do NOT use for running migrations, generating seed data, or scaffolding folders.

## Inputs

Ask for any not provided — do not guess silently.

1. **Entity name** (PascalCase singular) — e.g. `Housekeeping`, `Payment`.
2. **Fields** — name, type, constraints. If unspecified, ask for the minimum set.
3. **Relations** — which existing models (`User`, `Room`, `Booking`, `AuditLog`)
   does this relate to, and in what cardinality?
4. **Status lifecycle?** — if the entity has states, model them as an enum.
5. **Soft delete / archival?** — default no; flag explicitly if needed.

Before proposing, Read `prisma/schema.prisma` to use existing model/enum names
and avoid duplicates.

## Strict rules

- NEVER edit `prisma/schema.prisma`. The user reviews and pastes.
- NEVER run `prisma migrate` or `prisma generate`.
- ALWAYS use `id String @id @default(cuid())` — this codebase uses cuid, NOT
  UUIDs and NOT autoincrement.
- NEVER add `@map`/`@@map` — fields stay camelCase, model names stay PascalCase
  (matches every existing model).
- Money is `Decimal @db.Decimal(10, 2)` (see `Room.pricePerNight`,
  `Booking.bondDeposit`) — never `Float`, never integer cents.
- Statuses are schema enums with SCREAMING_SNAKE values (`BookingStatus`).
- Natural keys get `@unique` (`roomNumber`, `bookingRef`, `email`). If the
  entity needs a human-readable reference, follow the `bookingRef` pattern
  (unique string generated in the service).
- Relations defined on BOTH sides; use a named relation when a model relates
  to the same model more than once or directionally
  (`@relation("CreatedBy", ...)` ← Booking/User reference).
- `@@index` on every foreign key and every WHERE/ORDER BY path
  (see `Booking`: `@@index([roomId])`, `@@index([checkIn, checkOut])`,
  `@@index([status])`) — Postgres does not auto-index FK columns.
- `createdAt DateTime @default(now())` + `updatedAt DateTime @updatedAt` on
  every entity; append-only tables (like `AuditLog`) take `createdAt` only.
- Strings stay unbounded in the schema — length limits are enforced by zod at
  the API boundary (rule 3). `Json?` is acceptable for flexible payloads
  (`AuditLog.details`).
- Flag `onDelete` behavior explicitly. Existing relations use the default
  (restrict); recommend `Cascade` only with a stated reason.

## Workflow

1. Confirm entity name and field list.
2. Read `prisma/schema.prisma` for context.
3. Apply the rules above; produce the output sections.

## Output format

### 1. Schema block

```prisma
model Payment {
  id          String        @id @default(cuid())
  booking     Booking       @relation(fields: [bookingId], references: [id])
  bookingId   String
  amount      Decimal       @db.Decimal(10, 2)
  method      PaymentMethod
  status      PaymentStatus @default(PENDING)
  reference   String        @unique
  notes       String?
  createdBy   User          @relation("PaymentCreatedBy", fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([bookingId])
  @@index([status])
  @@index([createdAt])
}
```

(Shape mirrors the shipped `Booking` model — new proposals follow it. Include
the back-relation lines to add to existing models, e.g. `payments Payment[]`
on `Booking`.)

### 2. Rationale

Bullets explaining non-obvious choices only (index coverage for the hot list
queries, relation naming, enum lifecycle, onDelete decision).

### 3. Next steps

```
1. Paste the block into prisma/schema.prisma (+ back-relations on existing models).
2. Run: npx prisma format
3. Run: npx prisma migrate dev --name add_<feature>
4. Run: npx prisma generate
5. Add zod schemas in src/lib/validations/<feature>.ts (rule 3).
6. Implement src/lib/services/<feature>-service.ts (rule 2).
7. Update prisma/seed.ts if the entity needs seed data.
```

## Success criteria

- Block conforms to every strict rule above (cuid, no @map, Decimal money,
  indexed FKs, bidirectional relations, timestamps).
- Every field has a justified type; back-relations for existing models included.
- Rationale covers only non-obvious choices.
