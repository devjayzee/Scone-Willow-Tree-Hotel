/**
 * Sort rooms numerically by room number. Generic over any shape with a
 * `roomNumber` field so both the server (Prisma `Room`) and client
 * (optimistic-update cache entries) can share one implementation.
 */
export function sortRoomsByNumber<T extends { roomNumber: string }>(
  rooms: T[]
): T[] {
  return [...rooms].sort((a, b) => {
    const numA = parseInt(a.roomNumber) || 0;
    const numB = parseInt(b.roomNumber) || 0;
    return numA - numB;
  });
}
