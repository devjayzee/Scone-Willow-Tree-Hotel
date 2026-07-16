---
paths:
  - "src/hooks/**/*.ts"
---

# Rule 5: Server state lives in TanStack Query, structured per domain

Components never call `fetch` and never hold server data in `useState`. Each
domain gets a hook module under `src/hooks/` following the shape of
`src/hooks/booking/`:

```
src/hooks/<domain>/
├── <domain>-api.ts        plain fetch wrappers ("use client")
├── <domain>-keys.ts       query-key factory
├── <domain>-queries.ts    useQuery hooks
├── <domain>-mutations.ts  useMutation hooks (optimistic where it helps UX)
└── index.ts               public surface
```

Smaller domains may use a single `use-<domain>s.ts` file until they grow.

## Canonical patterns

Key factory (`booking-keys.ts`) — keys come ONLY from here:

```ts
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (filters?: { status?: string }) => [...bookingKeys.lists(), filters] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
};
```

Query hook (`booking-queries.ts`) — supports SSR seeding:

```ts
export function useBookings(initialData?: Booking[], initialDataUpdatedAt?: number) {
  return useQuery({
    queryKey: bookingKeys.list(),
    queryFn: fetchBookings,
    initialData,
    initialDataUpdatedAt,
    staleTime: 1000 * 30, // match how fast the data actually changes
  });
}
```

Fetch wrapper (`booking-api.ts`) — throws on `!response.ok` with the server's
error message:

```ts
export async function createBookingApi(data: CreateBookingInput): Promise<Booking> {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to create booking");
  }
  return response.json();
}
```

Mutations: use the optimistic-update helpers
(`use-optimistic-booking.ts` pattern) for high-frequency UX paths; plain
`useMutation` + invalidation via `@/lib/query-invalidation` otherwise.

## Anti-patterns

```ts
// WRONG: fetch inside a component
useEffect(() => { fetch("/api/rooms").then(...) }, []);

// WRONG: inline query keys — cache invalidation will miss them
useQuery({ queryKey: ["bookings", "list"], ... }); // → bookingKeys.list()

// WRONG: copying server data into local state
const [bookings, setBookings] = useState(data);
```

## Audit checks

```bash
# fetch calls outside hooks' *-api.ts wrappers
grep -rn "fetch(\"/api\|fetch(\`/api" src/components src/app --include="*.tsx"

# inline query keys bypassing factories
grep -rn "queryKey: \[\"" src/hooks --include="*.ts"
```
