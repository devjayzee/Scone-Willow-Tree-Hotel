import { requireSession } from "@/lib/auth-guard";
import { getAllRooms } from "@/lib/services/room-service";
import { RoomsClient } from "@/components/room/rooms-client";
import type { Room } from "@/types/room";

// requireSession() reads cookies, which forces dynamic rendering — the
// declaration is here so future readers don't wonder why the page isn't
// cached.
export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const fetchTime = Date.now();

  await requireSession("GENERAL_MANAGER");

  const rooms = await getAllRooms();

  const serializedRooms: Room[] = rooms.map((room) => ({
    id: room.id,
    roomNumber: room.roomNumber,
    capacity: room.capacity,
    pricePerNight: room.pricePerNight.toString(),
    description: room.description,
  }));

  return (
    <RoomsClient initialRooms={serializedRooms} fetchTime={fetchTime} />
  );
}
