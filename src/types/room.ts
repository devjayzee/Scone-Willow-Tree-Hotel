// Room type for API responses (pricePerNight is serialized as string or number from Decimal)
export interface Room {
  id: string;
  roomNumber: string;
  capacity: number;
  pricePerNight: string | number;
  description: string | null;
}

// Room type with minimal fields for booking context
export interface RoomSummary {
  id: string;
  roomNumber: string;
  pricePerNight: string | number;
  description?: string | null;
}

// Input type for creating a room
export interface CreateRoomInput {
  roomNumber: string;
  capacity?: number;
  pricePerNight?: number;
  description?: string;
}

// Input type for updating a room
export interface UpdateRoomInput {
  roomNumber?: string;
  capacity?: number;
  pricePerNight?: number;
  description?: string;
}
