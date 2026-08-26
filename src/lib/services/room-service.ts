import prisma from "@/lib/prisma";
import type { Room as PrismaRoom } from "@prisma/client";
import type { CreateRoomInput, UpdateRoomInput } from "@/lib/validations/room";
import { NotFoundError, ConflictError, BusinessRuleError } from "@/lib/errors";
import {
  createAuditLog,
  AuditAction,
  EntityType,
  sanitizeForAudit,
  getChangedFields,
} from "./audit-service";

// Number of recent bookings to include when fetching a room's detail view.
const RECENT_BOOKINGS_LIMIT = 10;

// Utility function to sort rooms numerically by room number
export function sortRoomsByNumber<T extends { roomNumber: string }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => {
    const numA = parseInt(a.roomNumber) || 0;
    const numB = parseInt(b.roomNumber) || 0;
    return numA - numB;
  });
}

// Get all rooms sorted by room number
export async function getAllRooms(): Promise<PrismaRoom[]> {
  const rooms = await prisma.room.findMany();
  return sortRoomsByNumber(rooms);
}

// Get a single room by ID with recent bookings
export async function getRoomById(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { checkIn: "desc" },
        take: RECENT_BOOKINGS_LIMIT,
        select: {
          id: true,
          bookingRef: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          status: true,
        },
      },
    },
  });

  if (!room) {
    throw new NotFoundError("Room not found");
  }

  return room;
}

// Create a new room
export async function createRoom(
  data: CreateRoomInput,
  performedBy?: string
): Promise<PrismaRoom> {
  // Check if room number already exists
  const existingRoom = await prisma.room.findUnique({
    where: { roomNumber: data.roomNumber },
  });

  if (existingRoom) {
    throw new ConflictError("Room number already exists");
  }

  const room = await prisma.room.create({
    data: {
      roomNumber: data.roomNumber,
      capacity: data.capacity,
      pricePerNight: data.pricePerNight,
      description: data.description,
    },
  });

  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.ROOM_CREATED,
      EntityType.ROOM,
      room.id,
      {
        current: sanitizeForAudit({
          roomNumber: room.roomNumber,
          capacity: room.capacity,
          pricePerNight: room.pricePerNight,
          description: room.description,
        }),
      }
    );
  }

  return room;
}

// Update an existing room
export async function updateRoom(
  id: string,
  data: UpdateRoomInput,
  performedBy?: string
): Promise<PrismaRoom> {
  const existingRoom = await prisma.room.findUnique({
    where: { id },
  });

  if (!existingRoom) {
    throw new NotFoundError("Room not found");
  }

  // Check if new room number conflicts with another room
  if (data.roomNumber && data.roomNumber !== existingRoom.roomNumber) {
    const conflictingRoom = await prisma.room.findUnique({
      where: { roomNumber: data.roomNumber },
    });
    if (conflictingRoom) {
      throw new ConflictError("Room number already exists");
    }
  }

  const room = await prisma.room.update({
    where: { id },
    data: {
      roomNumber: data.roomNumber,
      capacity: data.capacity,
      pricePerNight: data.pricePerNight,
      description: data.description,
    },
  });

  if (performedBy) {
    const changedFields = getChangedFields(
      existingRoom as unknown as Record<string, unknown>,
      data as Record<string, unknown>
    );

    if (changedFields.length > 0) {
      await createAuditLog(
        performedBy,
        AuditAction.ROOM_UPDATED,
        EntityType.ROOM,
        id,
        {
          previous: sanitizeForAudit(
            Object.fromEntries(
              changedFields.map((f) => [
                f,
                existingRoom[f as keyof typeof existingRoom],
              ])
            )
          ),
          current: sanitizeForAudit(
            Object.fromEntries(
              changedFields.map((f) => [f, data[f as keyof typeof data]])
            )
          ),
          changedFields,
        }
      );
    }
  }

  return room;
}

// Delete a room (checks for active bookings)
export async function deleteRoom(id: string, performedBy?: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
        },
      },
    },
  });

  if (!room) {
    throw new NotFoundError("Room not found");
  }

  if (room.bookings.length > 0) {
    throw new BusinessRuleError("Cannot delete room with active bookings");
  }

  await prisma.room.delete({
    where: { id },
  });

  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.ROOM_DELETED,
      EntityType.ROOM,
      id,
      {
        previous: sanitizeForAudit({
          roomNumber: room.roomNumber,
          capacity: room.capacity,
          pricePerNight: room.pricePerNight,
          description: room.description,
        }),
      }
    );
  }
}

// Get available rooms for a date range
export async function getAvailableRooms(checkIn: Date, checkOut: Date): Promise<PrismaRoom[]> {
  // Get all rooms
  const allRooms = await prisma.room.findMany();

  // Find rooms with overlapping bookings
  const bookedRoomIds = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      OR: [
        {
          // Booking starts before our checkout and ends after our checkin
          AND: [
            { checkIn: { lt: checkOut } },
            { checkOut: { gt: checkIn } },
          ],
        },
      ],
    },
    select: { roomId: true },
  });

  const bookedIds = new Set(bookedRoomIds.map((b) => b.roomId));

  // Filter available rooms and sort
  const availableRooms = allRooms.filter((room) => !bookedIds.has(room.id));
  return sortRoomsByNumber(availableRooms);
}
