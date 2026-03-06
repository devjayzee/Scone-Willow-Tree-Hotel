import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllRooms } from "@/lib/services/room-service";
import { RoomsClient } from "@/components/room/rooms-client";
import type { Room } from "@/types/room";

export default async function RoomsPage() {
  const session = await getServerSession(authOptions);
  const isManager = session?.user?.role === "GENERAL_MANAGER";

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

  return <RoomsClient initialRooms={serializedRooms} isManager={isManager} />;
}
