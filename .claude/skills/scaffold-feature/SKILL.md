---
name: scaffold-feature
description: |
  Generates a full-stack domain slice skeleton for the Willow Tree Hotel
  Next.js codebase: zod validations, service, API routes, wire types,
  TanStack Query hook module, dashboard page, and client component — all
  stubs conforming to .claude/rules/. Use when the user says "add a feature",
  "scaffold X", or "set up the folder structure for X". Requires a feature
  branch and an approved plan at plans/<branch>.md. Do NOT use for editing
  existing domains, designing Prisma schemas (use design-prisma-model), or
  writing business logic.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Scaffold Feature

## Purpose

Generate a consistent, rule-compliant skeleton for a new domain so the
developer fills in business logic instead of wiring layout. Every stub
conforms to the rules under `.claude/rules/`.

## Inputs

Ask before generating — do not guess silently.

1. **Domain name** (singular, kebab-case) — e.g. `payment`, `housekeeping`.
2. **Operations** — default: list, get, create, update, delete. Confirm or trim.
3. **Dashboard page?** — default yes (`src/app/(dashboard)/<domain>s/`).
4. **Role gates** — which operations need `GENERAL_MANAGER` (per the plan).

## Workflow — gates first, in order

1. **Branch gate.** `git rev-parse --abbrev-ref HEAD`. If `main` or
   `development`, STOP:
   ```bash
   git checkout development && git pull --rebase origin development && git checkout -b feat/<domain>
   ```
2. **Plan gate.** Read `plans/<branch>.md` (slashes → dashes). If missing or
   `Status:` is not `approved`, STOP: "Plan-first workflow: no approved plan.
   Invoke the architect, review, mark `Status: approved`, re-run." NEVER flip
   the status yourself.
3. **Clean-tree gate.** `git status --porcelain` — if dirty (beyond the plan
   file), ask the user to commit or stash first.
4. Cross-check domain name + operations against the plan's "Files / To create".
5. Verify none of the target files exist (`src/lib/services/<domain>-service.ts`
   etc.). If any do, stop and report — never overwrite.
6. Create the files from the templates below.
7. Print the follow-up checklist.

## Files to create

```
src/lib/validations/<domain>.ts               zod schemas + inferred input types
src/lib/services/<domain>-service.ts          service stubs (only Prisma caller)
src/app/api/<domain>s/route.ts                GET list / POST create
src/app/api/<domain>s/[id]/route.ts           GET / PATCH / DELETE
src/types/<domain>.ts                         serialized wire types
src/hooks/<domain>/<domain>-api.ts            fetch wrappers
src/hooks/<domain>/<domain>-keys.ts           query-key factory
src/hooks/<domain>/<domain>-queries.ts        useQuery hooks
src/hooks/<domain>/<domain>-mutations.ts      useMutation hooks
src/hooks/<domain>/index.ts                   public surface
src/app/(dashboard)/<domain>s/page.tsx        server page (if dashboard page)
src/components/<domain>/<domain>s-client.tsx  client wrapper (if dashboard page)
src/__tests__/lib/services/<domain>-service.test.ts
```

## Strict rules

- The three gates above are non-negotiable — no exceptions, no overrides.
- NEVER write business logic in stubs — bodies are `// TODO` + thrown
  `Error("Not implemented")` (except the canonical boilerplate shown below).
- NEVER import `@/lib/prisma` outside the service stub (rule 2).
- Route stubs follow rule 1 exactly: session check → zod `safeParse` → one
  service call → `handleApiError` catch.
- Role-gated handlers include the inline `ForbiddenError` check (rule 4) as
  dictated by the plan.
- Query keys come from the factory; no inline keys (rule 5).
- The page stub is a server component with `dynamic = "force-dynamic"` (rule 7).
- Do NOT edit `prisma/schema.prisma` — that's `design-prisma-model` + the human.

## Stub templates

Replace `<domain>`/`<Domain>` (e.g. `payment`/`Payment`). Templates are
abbreviated to the create path — repeat the shape for the other operations the
plan lists.

**`src/lib/validations/<domain>.ts`**

```ts
import { z } from "zod";

export const create<Domain>Schema = z.object({
  // TODO: fields per the approved plan
});

export const update<Domain>Schema = create<Domain>Schema.partial();

export type Create<Domain>SchemaInput = z.infer<typeof create<Domain>Schema>;
export type Update<Domain>SchemaInput = z.infer<typeof update<Domain>Schema>;
```

**`src/lib/services/<domain>-service.ts`**

```ts
import prisma from "@/lib/prisma";
import type { Create<Domain>SchemaInput, Update<Domain>SchemaInput } from "@/lib/validations/<domain>";
import { NotFoundError } from "@/lib/errors";

export async function getAll<Domain>s() {
  return prisma.<domain>.findMany();
}

export async function get<Domain>ById(id: string) {
  const <domain> = await prisma.<domain>.findUnique({ where: { id } });
  if (!<domain>) {
    throw new NotFoundError("<Domain> not found");
  }
  return <domain>;
}

export async function create<Domain>(data: Create<Domain>SchemaInput, userId: string) {
  // TODO: business rules, then prisma.<domain>.create; audit via audit-service
  throw new Error("Not implemented");
}
```

**`src/app/api/<domain>s/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { create<Domain>Schema } from "@/lib/validations/<domain>";
import { getAll<Domain>s, create<Domain> } from "@/lib/services/<domain>-service";
import { handleApiError, UnauthorizedError } from "@/lib/api-error-handler";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }
    return NextResponse.json(await getAll<Domain>s());
  } catch (error) {
    return handleApiError(error, "fetching <domain>s");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }
    const body = await request.json();
    const validation = create<Domain>Schema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "creating <domain>");
    }
    const <domain> = await create<Domain>(validation.data, session.user.id);
    return NextResponse.json(<domain>, { status: 201 });
  } catch (error) {
    return handleApiError(error, "creating <domain>");
  }
}
```

**`src/app/api/<domain>s/[id]/route.ts`** — params are a Promise (Next 16):

```ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }
    const { id } = await params;
    return NextResponse.json(await get<Domain>ById(id));
  } catch (error) {
    return handleApiError(error, "fetching <domain>");
  }
}
```

Role-gated handlers (plan-dictated) add, after the session check:

```ts
if (session.user.role !== "GENERAL_MANAGER") {
  throw new ForbiddenError("Only managers can delete <domain>s");
}
```

**`src/types/<domain>.ts`** — serialized wire shape (rule 3):

```ts
export interface <Domain> {
  id: string;
  createdAt: string; // ISO string over the wire
  updatedAt: string;
  // TODO: fields — Date → string, Decimal → string | number
}
export type Create<Domain>Input = { /* TODO: client-side input shape */ };
```

**`src/hooks/<domain>/<domain>-keys.ts`**

```ts
export const <domain>Keys = {
  all: ["<domain>s"] as const,
  lists: () => [...<domain>Keys.all, "list"] as const,
  list: (filters?: Record<string, string>) => [...<domain>Keys.lists(), filters] as const,
  details: () => [...<domain>Keys.all, "detail"] as const,
  detail: (id: string) => [...<domain>Keys.details(), id] as const,
};
```

**`src/hooks/<domain>/<domain>-api.ts`** — `"use client"`, plain fetch
wrappers throwing on `!response.ok` (copy the shape of
`src/hooks/booking/booking-api.ts`).

**`src/hooks/<domain>/<domain>-queries.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { <Domain> } from "@/types/<domain>";
import { <domain>Keys } from "./<domain>-keys";
import { fetch<Domain>s } from "./<domain>-api";

export function use<Domain>s(initialData?: <Domain>[], initialDataUpdatedAt?: number) {
  return useQuery({
    queryKey: <domain>Keys.list(),
    queryFn: fetch<Domain>s,
    initialData,
    initialDataUpdatedAt,
    staleTime: 1000 * 30,
  });
}
```

**`src/hooks/<domain>/<domain>-mutations.ts`** — plain `useMutation` +
invalidation via `<domain>Keys`; optimistic updates only if the plan calls for
them. **`index.ts`** re-exports the public surface.

**`src/app/(dashboard)/<domain>s/page.tsx`**

```tsx
import { getAll<Domain>s } from "@/lib/services/<domain>-service";
import { <Domain>sClient } from "@/components/<domain>/<domain>s-client";

export const dynamic = "force-dynamic";

export default async function <Domain>sPage() {
  const fetchTime = Date.now();
  const <domain>s = await getAll<Domain>s();
  // TODO: serialize (Date → toISOString, Decimal → toString) per rule 7
  return <<Domain>sClient initial<Domain>s={serialized} fetchTime={fetchTime} />;
}
```

**`src/components/<domain>/<domain>s-client.tsx`** — `"use client"`, seeds
`use<Domain>s(initial<Domain>s, fetchTime)`, renders shadcn primitives.

**`src/__tests__/lib/services/<domain>-service.test.ts`** — rule-8 shape:
closure-captured `vi.fn()` mocks, `vi.mock("@/lib/prisma", () => ({ default:
{...} }))`, import after mocks, `vi.clearAllMocks()` in `beforeEach`, one
`it.todo` per planned service function.

## Follow-up checklist to print after generation

```
✓ Scaffolded <domain> slice
□ Design + migrate the schema (design-prisma-model → prisma migrate dev).
□ Fill zod schemas in src/lib/validations/<domain>.ts.
□ Implement service bodies (+ audit-service entries for mutations).
□ Fill wire types in src/types/<domain>.ts.
□ Implement <domain>-api.ts fetch wrappers + mutations.
□ Build the client UI (table/dialogs; form via use-<domain>-form.ts if needed — rule 6).
□ Add the nav entry in src/components/layout/.
□ Replace it.todo tests with real ones; npm run test:run.
□ Run the architecture-auditor before opening the PR.
```

## Success criteria

- All gates enforced before any file is written.
- Every stub compiles and lints clean.
- Grep checks pass: no `@/lib/prisma` outside the service, `handleApiError` in
  every route, keys only from the factory, page has no `"use client"`.
