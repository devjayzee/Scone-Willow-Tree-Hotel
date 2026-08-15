import { QueryClient } from "@tanstack/react-query";

/**
 * Centralized Cache Invalidation Map
 *
 * This defines all cache relationships in one place.
 * When a primary cache is invalidated, all related caches are also invalidated.
 *
 * Relationships:
 * - bookings: Calendar shows bookings, reports aggregate booking data
 * - rooms: Bookings display room info, calendar uses rooms, reports use room data
 * - calendar: No dependents (it's a consumer)
 * - reports: No dependents (it's a consumer)
 * - staffs: No dependents currently
 *
 * Keys here MUST match `<factory>.all[0]` (see the per-domain
 * `-keys.ts` files under `src/hooks/`).
 * `src/__tests__/lib/query-invalidation.test.ts` enforces this at test
 * time — if any factory's `all` array is renamed, the drift guard fires
 * so the invalidation call never silently no-ops again.
 */
const CACHE_RELATIONSHIPS = {
  bookings: ["calendar", "reports"],
  rooms: ["bookings", "calendar", "reports"],
  calendar: [],
  reports: [],
  staffs: [],
} as const;

type CacheKey = keyof typeof CACHE_RELATIONSHIPS;

/**
 * Invalidates a primary cache and all its related caches.
 *
 * @example
 * // After creating/updating/deleting a booking:
 * invalidateWithRelated(queryClient, "bookings");
 * // This invalidates: bookings, calendar, reports
 *
 * @example
 * // After updating a room:
 * invalidateWithRelated(queryClient, "rooms");
 * // This invalidates: rooms, bookings, calendar, reports
 */
export function invalidateWithRelated(
  queryClient: QueryClient,
  primaryKey: CacheKey
): void {
  // Invalidate the primary cache
  queryClient.invalidateQueries({ queryKey: [primaryKey] });

  // Invalidate all related caches
  const relatedKeys = CACHE_RELATIONSHIPS[primaryKey];
  relatedKeys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}

