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
 * - staff: No dependents currently
 */
const CACHE_RELATIONSHIPS = {
  bookings: ["calendar", "reports"],
  rooms: ["bookings", "calendar", "reports"],
  calendar: [],
  reports: [],
  staff: [],
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

/**
 * Invalidates multiple primary caches and all their related caches.
 * Automatically deduplicates to avoid redundant invalidations.
 *
 * @example
 * invalidateMultipleWithRelated(queryClient, ["bookings", "rooms"]);
 */
export function invalidateMultipleWithRelated(
  queryClient: QueryClient,
  primaryKeys: CacheKey[]
): void {
  const allKeys = new Set<string>();

  primaryKeys.forEach((key) => {
    allKeys.add(key);
    CACHE_RELATIONSHIPS[key].forEach((relatedKey) => {
      allKeys.add(relatedKey);
    });
  });

  allKeys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}

/**
 * Gets all cache keys that would be invalidated for a given primary key.
 * Useful for debugging or logging.
 */
export function getInvalidationTargets(primaryKey: CacheKey): string[] {
  return [primaryKey, ...CACHE_RELATIONSHIPS[primaryKey]];
}
