import type { Room as PrismaRoom } from "@prisma/client";
import type { Room } from "@/types/room";

/**
 * Serialize a Prisma Room for a dashboard page's initial client props —
 * Decimal `pricePerNight` becomes a string, matching Rule 7's RSC
 * boundary convention. Shared by bookings/calendar/rooms pages so the
 * same entity crosses the boundary in one shape everywhere. Returns the
 * stricter `Room` (description required) rather than `RoomSummary`
 * (description optional) — `Room` is a subtype of `RoomSummary`, so it
 * satisfies every call site, including `rooms/page.tsx` which needs the
 * stricter shape for `RoomsClient`.
 */
export function serializeRoom(room: PrismaRoom): Room {
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    capacity: room.capacity,
    pricePerNight: room.pricePerNight.toString(),
    description: room.description,
  };
}
