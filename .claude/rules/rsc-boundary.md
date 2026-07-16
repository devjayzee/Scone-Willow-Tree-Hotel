---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**/*.tsx"
---

# Rule 7: Server Components by default; `'use client'` only on interactive leaves

Pages and layouts stay server-rendered. Interactivity lives in client
components under `src/components/<domain>/`, seeded with server-fetched data.

## Canonical pattern

Dashboard pages are server components that fetch initial data and hand it to a
`*-client.tsx` wrapper:

```tsx
// src/app/(dashboard)/bookings/page.tsx — NO 'use client'
export const dynamic = "force-dynamic";             // dashboards always fetch fresh

export default async function BookingsPage() {
  const fetchTime = Date.now();
  const [bookings, rooms] = await Promise.all([getAllBookings(), getAllRooms()]);
  // serialize: Date → .toISOString(), Decimal → .toString()
  return <BookingsClient initialBookings={serializedBookings} initialRooms={serializedRooms} fetchTime={fetchTime} />;
}
```

```tsx
// src/components/booking/bookings-client.tsx
"use client";
export function BookingsClient({ initialBookings }: Props) {
  const { data } = useBookings(initialBookings, Date.now()); // SSR-seeded query
  // ...
}
```

Requirements:

- `'use client'` goes on the interactive leaf (dialogs, tables, calendar,
  forms, dropdowns) — not on pages, layouts, or purely presentational pieces
  (`booking-status-badge`, skeletons can stay server-compatible).
- Server-fetched data crossing the boundary must be serializable — convert
  `Date` → ISO string, `Decimal` → string/number (matches the wire types in
  `src/types/`, Rule 3).
- Context providers are centralized in `src/components/providers/`.
- Static rendering (icons via lucide-react, badges, layout chrome) stays server-side.

## Anti-patterns

```tsx
// WRONG: 'use client' on a page to "make the build pass" — extract the
// interactive part into components/<domain>/ instead

// WRONG: passing Prisma entities (Date/Decimal fields) straight into a
// client component — serialize first

// WRONG: importing a service into a client component
"use client";
import { getAllRooms } from "@/lib/services/room-service";
```

## Audit checks

```bash
# pages/layouts must not be client components
grep -rln "\"use client\"" "src/app" --include="page.tsx" --include="layout.tsx"

# services leaking into client components
grep -rln "@/lib/services" src/components --include="*.tsx" \
  | xargs grep -ln "\"use client\"" 2>/dev/null
```

## Allowed exceptions

- `src/app/(auth)/login/page.tsx` may be a client page (credential form UX) —
  keep it the only one.
- `not-found.tsx` / `error.tsx` follow Next.js requirements (`error.tsx` must
  be a client component).
