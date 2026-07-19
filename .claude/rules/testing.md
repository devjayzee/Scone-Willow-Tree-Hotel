---
paths:
  - "src/__tests__/**/*.ts"
  - "src/__tests__/**/*.tsx"
  - "vitest.config.ts"
---

# Rule 8: Tests mirror source; mock Prisma at the module edge

Vitest 4 + jsdom + Testing Library. Every test lives in `src/__tests__/`
mirroring the source path: `src/lib/services/room-service.ts` →
`src/__tests__/lib/services/room-service.test.ts`. New logic in `src/lib/` or
`src/hooks/` ships with a matching test. Verify with `npm run test:run`.

## Canonical pattern

From `src/__tests__/lib/services/audit-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Closure-captured mock fns so assertions can inspect calls
const mockAuditLogCreate = vi.fn();

// 2. Mock the prisma module — note the `default` key (default export)
vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

// 3. Mock the logger to keep output clean
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// 4. Import the module under test AFTER the mocks
import { createAuditLog } from "@/lib/services/audit-service";

describe("Audit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  // ...
});
```

Requirements:

- `vi.mock` factories at top, imports of the unit under test after them
  (vitest hoists mocks — keep the visual order anyway).
- `vi.clearAllMocks()` in `beforeEach`; no state leaking between tests.
- Mock ONLY module edges: `@/lib/prisma`, `@/lib/logger`, `next-auth`.
  Never mock zod schemas, error classes, or pure utils — exercise them for real.
- Service tests assert thrown domain errors
  (`await expect(...).rejects.toThrow(NotFoundError)`), not response shapes.
- Route tests live in `src/__tests__/api/` and test the handler functions.
- CI runs `prisma generate` before tests (`.github/workflows/test.yml`) —
  anything importing `@prisma/client` types needs the generated client.

## Anti-patterns

```ts
// WRONG: colocated test files — this repo mirrors under src/__tests__/
src/lib/services/room-service.test.ts

// WRONG: mocking the unit under test's siblings so deeply the test only
// proves the mocks call each other

// WRONG: hitting a real database in unit tests
```

## Audit checks

```bash
# colocated tests outside the mirror tree
find src -name "*.test.ts" -not -path "src/__tests__/*"

# services without a matching test file
for f in src/lib/services/*-service.ts; do
  t="src/__tests__/lib/services/$(basename "${f%.ts}").test.ts"
  [ -f "$t" ] || echo "missing: $t"
done
```

Known false positive: `booking-service.ts` is a re-export shim — its tests live
under the mirrored folder `src/__tests__/lib/services/booking/`.
