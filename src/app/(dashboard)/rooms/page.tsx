import { requireSession } from "@/lib/auth-guard";
import { getAllRooms } from "@/lib/services/room-service";
import { RoomsClient } from "@/components/room/rooms-client";
import type { Room } from "@/types/room";

// requireSession() reads cookies, which forces dynamic rendering — the
// declaration is here so future readers don't wonder why the page isn't
// cached.
export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  // Track when data was fetched for cache freshness
  const fetchTime = Date.now();

  const session = await requireSession(["MANAGER", "GENERAL_MANAGER"]);
  const isManager = session.user.role === "GENERAL_MANAGER";

  // Fetch rooms server-side
  const rooms = await getAllRooms();

  // Convert Prisma Decimal to number for client serialization
  const serializedRooms: Room[] = rooms.map((room) => ({
    id: room.id,
    roomNumber: room.roomNumber,
    capacity: room.capacity,
    pricePerNight: room.pricePerNight.toString(),
    description: room.description,
  }));

  return (
    <RoomsClient
      initialRooms={serializedRooms}
      isManager={isManager}
      fetchTime={fetchTime}
    />
  );
}
