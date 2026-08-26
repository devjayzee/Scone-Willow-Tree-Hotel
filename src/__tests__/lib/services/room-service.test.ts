import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client
const mockRoomFindMany = vi.fn();
const mockRoomFindUnique = vi.fn();
const mockRoomCreate = vi.fn();
const mockRoomUpdate = vi.fn();
const mockRoomDelete = vi.fn();
const mockBookingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    room: {
      findMany: (...args: unknown[]) => mockRoomFindMany(...args),
      findUnique: (...args: unknown[]) => mockRoomFindUnique(...args),
      create: (...args: unknown[]) => mockRoomCreate(...args),
      update: (...args: unknown[]) => mockRoomUpdate(...args),
      delete: (...args: unknown[]) => mockRoomDelete(...args),
    },
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
  },
}));

vi.mock("@/lib/services/audit-service", () => ({
  createAuditLog: vi.fn(),
  AuditAction: {
    ROOM_CREATED: "ROOM_CREATED",
    ROOM_UPDATED: "ROOM_UPDATED",
    ROOM_DELETED: "ROOM_DELETED",
  },
  EntityType: {
    ROOM: "ROOM",
  },
  sanitizeForAudit: (obj: unknown) => obj,
  getChangedFields: vi.fn(() => []),
}));

// Import after mocks are set up
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getAvailableRooms,
  sortRoomsByNumber,
} from "@/lib/services/room-service";
import { NotFoundError, ConflictError, BusinessRuleError } from "@/lib/errors";

// Helper to create mock room data
function createMockRoom(overrides: Partial<{
  id: string;
  roomNumber: string;
  capacity: number;
  pricePerNight: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "room-1",
    roomNumber: overrides.roomNumber ?? "101",
    capacity: overrides.capacity ?? 2,
    pricePerNight: overrides.pricePerNight ?? 100,
    description: overrides.description ?? "Standard room",
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2024-01-01"),
  };
}

describe("Room Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // sortRoomsByNumber
  // ============================================================
  describe("sortRoomsByNumber", () => {
    it("should sort rooms numerically by room number", () => {
      const rooms = [
        { roomNumber: "10" },
        { roomNumber: "2" },
        { roomNumber: "1" },
        { roomNumber: "100" },
      ];

      const sorted = sortRoomsByNumber(rooms);

      expect(sorted.map((r) => r.roomNumber)).toEqual(["1", "2", "10", "100"]);
    });

    it("should handle non-numeric room numbers", () => {
      const rooms = [
        { roomNumber: "B2" },
        { roomNumber: "A1" },
        { roomNumber: "10" },
      ];

      const sorted = sortRoomsByNumber(rooms);

      // Non-numeric parse to 0, so they come first, then 10
      expect(sorted[2].roomNumber).toBe("10");
    });

    it("should not mutate the original array", () => {
      const rooms = [{ roomNumber: "2" }, { roomNumber: "1" }];
      const original = [...rooms];

      sortRoomsByNumber(rooms);

      expect(rooms).toEqual(original);
    });

    it("should handle empty array", () => {
      const sorted = sortRoomsByNumber([]);
      expect(sorted).toEqual([]);
    });
  });

  // ============================================================
  // getAllRooms
  // ============================================================
  describe("getAllRooms", () => {
    it("should return all rooms sorted by room number", async () => {
      const mockRooms = [
        createMockRoom({ id: "room-2", roomNumber: "102" }),
        createMockRoom({ id: "room-1", roomNumber: "101" }),
        createMockRoom({ id: "room-3", roomNumber: "103" }),
      ];
      mockRoomFindMany.mockResolvedValue(mockRooms);

      const result = await getAllRooms();

      expect(mockRoomFindMany).toHaveBeenCalledOnce();
      expect(result).toHaveLength(3);
      expect(result[0].roomNumber).toBe("101");
      expect(result[1].roomNumber).toBe("102");
      expect(result[2].roomNumber).toBe("103");
    });

    it("should return empty array when no rooms exist", async () => {
      mockRoomFindMany.mockResolvedValue([]);

      const result = await getAllRooms();

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // getRoomById
  // ============================================================
  describe("getRoomById", () => {
    it("should return room with bookings when found", async () => {
      const mockRoom = {
        ...createMockRoom({ id: "room-123" }),
        bookings: [
          {
            id: "booking-1",
            bookingRef: "BK-001",
            guestName: "John Doe",
            checkIn: new Date("2024-03-01"),
            checkOut: new Date("2024-03-05"),
            status: "CONFIRMED",
          },
        ],
      };
      mockRoomFindUnique.mockResolvedValue(mockRoom);

      const result = await getRoomById("room-123");

      expect(mockRoomFindUnique).toHaveBeenCalledWith({
        where: { id: "room-123" },
        include: {
          bookings: {
            orderBy: { checkIn: "desc" },
            take: 10,
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
      expect(result).toEqual(mockRoom);
      expect(result.bookings).toHaveLength(1);
    });

    it("should throw NotFoundError when room does not exist", async () => {
      mockRoomFindUnique.mockResolvedValue(null);

      await expect(getRoomById("non-existent")).rejects.toThrow(NotFoundError);
      await expect(getRoomById("non-existent")).rejects.toThrow("Room not found");
    });
  });

  // ============================================================
  // createRoom
  // ============================================================
  describe("createRoom", () => {
    const validInput = {
      roomNumber: "201",
      capacity: 2,
      pricePerNight: 150,
      description: "Deluxe room",
    };

    it("should create a room when room number is unique", async () => {
      const createdRoom = createMockRoom({
        id: "new-room",
        roomNumber: "201",
        capacity: 2,
        pricePerNight: Number(150),
        description: "Deluxe room",
      });
      mockRoomFindUnique.mockResolvedValue(null); // No existing room
      mockRoomCreate.mockResolvedValue(createdRoom);

      const result = await createRoom(validInput);

      expect(mockRoomFindUnique).toHaveBeenCalledWith({
        where: { roomNumber: "201" },
      });
      expect(mockRoomCreate).toHaveBeenCalledWith({
        data: {
          roomNumber: "201",
          capacity: 2,
          pricePerNight: 150,
          description: "Deluxe room",
        },
      });
      expect(result).toEqual(createdRoom);
    });

    it("should throw ConflictError when room number already exists", async () => {
      mockRoomFindUnique.mockResolvedValue(createMockRoom({ roomNumber: "201" }));

      await expect(createRoom(validInput)).rejects.toThrow(ConflictError);
      await expect(createRoom(validInput)).rejects.toThrow("Room number already exists");
      expect(mockRoomCreate).not.toHaveBeenCalled();
    });

    it("should create room without optional description", async () => {
      const inputWithoutDesc = {
        roomNumber: "202",
        capacity: 1,
        pricePerNight: 80,
      };
      mockRoomFindUnique.mockResolvedValue(null);
      mockRoomCreate.mockResolvedValue(createMockRoom({ roomNumber: "202" }));

      await createRoom(inputWithoutDesc);

      expect(mockRoomCreate).toHaveBeenCalledWith({
        data: {
          roomNumber: "202",
          capacity: 1,
          pricePerNight: 80,
          description: undefined,
        },
      });
    });

    it("should log a ROOM_CREATED audit entry when performedBy is provided", async () => {
      const createdRoom = createMockRoom({ id: "new-room", roomNumber: "201" });
      mockRoomFindUnique.mockResolvedValue(null);
      mockRoomCreate.mockResolvedValue(createdRoom);
      const { createAuditLog } = await import("@/lib/services/audit-service");

      await createRoom(validInput, "user-42");

      expect(createAuditLog).toHaveBeenCalledWith(
        "user-42",
        "ROOM_CREATED",
        "ROOM",
        "new-room",
        expect.objectContaining({ current: expect.anything() })
      );
    });

    it("should not log an audit entry when performedBy is omitted", async () => {
      mockRoomFindUnique.mockResolvedValue(null);
      mockRoomCreate.mockResolvedValue(createMockRoom());
      const { createAuditLog } = await import("@/lib/services/audit-service");

      await createRoom(validInput);

      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // updateRoom
  // ============================================================
  describe("updateRoom", () => {
    const existingRoom = createMockRoom({
      id: "room-1",
      roomNumber: "101",
      capacity: 2,
      pricePerNight: Number(100),
    });

    it("should update room when it exists", async () => {
      const updateData = { capacity: 3, pricePerNight: 120 };
      const updatedRoom = { ...existingRoom, ...updateData };
      mockRoomFindUnique.mockResolvedValue(existingRoom);
      mockRoomUpdate.mockResolvedValue(updatedRoom);

      const result = await updateRoom("room-1", updateData);

      expect(mockRoomUpdate).toHaveBeenCalledWith({
        where: { id: "room-1" },
        data: {
          roomNumber: undefined,
          capacity: 3,
          pricePerNight: 120,
          description: undefined,
        },
      });
      expect(result.capacity).toBe(3);
    });

    it("should throw NotFoundError when room does not exist", async () => {
      mockRoomFindUnique.mockResolvedValue(null);

      await expect(updateRoom("non-existent", { capacity: 3 })).rejects.toThrow(NotFoundError);
      await expect(updateRoom("non-existent", { capacity: 3 })).rejects.toThrow("Room not found");
      expect(mockRoomUpdate).not.toHaveBeenCalled();
    });

    it("should allow changing room number to unused number", async () => {
      const updateData = { roomNumber: "999" };
      mockRoomFindUnique
        .mockResolvedValueOnce(existingRoom) // First call: find existing room
        .mockResolvedValueOnce(null); // Second call: check for conflict
      mockRoomUpdate.mockResolvedValue({ ...existingRoom, roomNumber: "999" });

      const result = await updateRoom("room-1", updateData);

      expect(mockRoomFindUnique).toHaveBeenCalledTimes(2);
      expect(result.roomNumber).toBe("999");
    });

    it("should throw ConflictError when changing to existing room number", async () => {
      const anotherRoom = createMockRoom({ id: "room-2", roomNumber: "102" });
      mockRoomFindUnique
        .mockResolvedValueOnce(existingRoom) // First call: find existing room
        .mockResolvedValueOnce(anotherRoom); // Second call: conflicting room exists

      await expect(updateRoom("room-1", { roomNumber: "102" })).rejects.toThrow(ConflictError);
      expect(mockRoomUpdate).not.toHaveBeenCalled();

      // Reset and test error message
      mockRoomFindUnique
        .mockResolvedValueOnce(existingRoom)
        .mockResolvedValueOnce(anotherRoom);
      await expect(updateRoom("room-1", { roomNumber: "102" })).rejects.toThrow(
        "Room number already exists"
      );
    });

    it("should not check for conflict when room number unchanged", async () => {
      mockRoomFindUnique.mockResolvedValue(existingRoom);
      mockRoomUpdate.mockResolvedValue(existingRoom);

      await updateRoom("room-1", { roomNumber: "101", capacity: 4 });

      // Should only call findUnique once (to get existing room)
      expect(mockRoomFindUnique).toHaveBeenCalledTimes(1);
    });

    it("should log a ROOM_UPDATED audit entry when fields changed and performedBy is provided", async () => {
      const updateData = { capacity: 3 };
      mockRoomFindUnique.mockResolvedValue(existingRoom);
      mockRoomUpdate.mockResolvedValue({ ...existingRoom, ...updateData });
      const { createAuditLog, getChangedFields } = await import(
        "@/lib/services/audit-service"
      );
      vi.mocked(getChangedFields).mockReturnValueOnce(["capacity"]);

      await updateRoom("room-1", updateData, "user-42");

      expect(createAuditLog).toHaveBeenCalledWith(
        "user-42",
        "ROOM_UPDATED",
        "ROOM",
        "room-1",
        expect.objectContaining({
          previous: expect.anything(),
          current: expect.anything(),
          changedFields: ["capacity"],
        })
      );
    });

    it("should not log an audit entry when nothing changed", async () => {
      mockRoomFindUnique.mockResolvedValue(existingRoom);
      mockRoomUpdate.mockResolvedValue(existingRoom);
      const { createAuditLog, getChangedFields } = await import(
        "@/lib/services/audit-service"
      );
      vi.mocked(getChangedFields).mockReturnValueOnce([]);

      await updateRoom("room-1", { capacity: 2 }, "user-42");

      expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("should not log an audit entry when performedBy is omitted", async () => {
      mockRoomFindUnique.mockResolvedValue(existingRoom);
      mockRoomUpdate.mockResolvedValue({ ...existingRoom, capacity: 3 });
      const { createAuditLog } = await import("@/lib/services/audit-service");

      await updateRoom("room-1", { capacity: 3 });

      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // deleteRoom
  // ============================================================
  describe("deleteRoom", () => {
    it("should delete room when it has no active bookings", async () => {
      const roomWithNoBookings = {
        ...createMockRoom({ id: "room-1" }),
        bookings: [],
      };
      mockRoomFindUnique.mockResolvedValue(roomWithNoBookings);
      mockRoomDelete.mockResolvedValue(undefined);

      await deleteRoom("room-1");

      expect(mockRoomFindUnique).toHaveBeenCalledWith({
        where: { id: "room-1" },
        include: {
          bookings: {
            where: {
              status: { in: ["CONFIRMED", "CHECKED_IN"] },
            },
          },
        },
      });
      expect(mockRoomDelete).toHaveBeenCalledWith({
        where: { id: "room-1" },
      });
    });

    it("should throw NotFoundError when room does not exist", async () => {
      mockRoomFindUnique.mockResolvedValue(null);

      await expect(deleteRoom("non-existent")).rejects.toThrow(NotFoundError);
      await expect(deleteRoom("non-existent")).rejects.toThrow("Room not found");
      expect(mockRoomDelete).not.toHaveBeenCalled();
    });

    it("should throw BusinessRuleError when room has active bookings", async () => {
      const roomWithBookings = {
        ...createMockRoom({ id: "room-1" }),
        bookings: [
          { id: "booking-1", status: "CONFIRMED" },
          { id: "booking-2", status: "CHECKED_IN" },
        ],
      };
      mockRoomFindUnique.mockResolvedValue(roomWithBookings);

      await expect(deleteRoom("room-1")).rejects.toThrow(BusinessRuleError);
      await expect(deleteRoom("room-1")).rejects.toThrow(
        "Cannot delete room with active bookings"
      );
      expect(mockRoomDelete).not.toHaveBeenCalled();
    });

    it("should allow deletion when room only has cancelled/checked-out bookings", async () => {
      // Note: The query filters for CONFIRMED/CHECKED_IN, so cancelled bookings
      // won't be in the result. This test verifies the room can be deleted
      // when the filtered bookings array is empty.
      const roomWithNoActiveBookings = {
        ...createMockRoom({ id: "room-1" }),
        bookings: [], // Empty because query filtered out CANCELLED/CHECKED_OUT
      };
      mockRoomFindUnique.mockResolvedValue(roomWithNoActiveBookings);
      mockRoomDelete.mockResolvedValue(undefined);

      await expect(deleteRoom("room-1")).resolves.toBeUndefined();
      expect(mockRoomDelete).toHaveBeenCalled();
    });

    it("should log a ROOM_DELETED audit entry when performedBy is provided", async () => {
      const roomWithNoBookings = {
        ...createMockRoom({ id: "room-1" }),
        bookings: [],
      };
      mockRoomFindUnique.mockResolvedValue(roomWithNoBookings);
      mockRoomDelete.mockResolvedValue(undefined);
      const { createAuditLog } = await import("@/lib/services/audit-service");

      await deleteRoom("room-1", "user-42");

      expect(createAuditLog).toHaveBeenCalledWith(
        "user-42",
        "ROOM_DELETED",
        "ROOM",
        "room-1",
        expect.objectContaining({ previous: expect.anything() })
      );
    });

    it("should not log an audit entry when performedBy is omitted", async () => {
      const roomWithNoBookings = {
        ...createMockRoom({ id: "room-1" }),
        bookings: [],
      };
      mockRoomFindUnique.mockResolvedValue(roomWithNoBookings);
      mockRoomDelete.mockResolvedValue(undefined);
      const { createAuditLog } = await import("@/lib/services/audit-service");

      await deleteRoom("room-1");

      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // getAvailableRooms
  // ============================================================
  describe("getAvailableRooms", () => {
    const checkIn = new Date("2024-03-10");
    const checkOut = new Date("2024-03-15");

    it("should return all rooms when none are booked", async () => {
      const allRooms = [
        createMockRoom({ id: "room-1", roomNumber: "101" }),
        createMockRoom({ id: "room-2", roomNumber: "102" }),
      ];
      mockRoomFindMany.mockResolvedValue(allRooms);
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getAvailableRooms(checkIn, checkOut);

      expect(result).toHaveLength(2);
      expect(result[0].roomNumber).toBe("101");
      expect(result[1].roomNumber).toBe("102");
    });

    it("should exclude rooms with overlapping bookings", async () => {
      const allRooms = [
        createMockRoom({ id: "room-1", roomNumber: "101" }),
        createMockRoom({ id: "room-2", roomNumber: "102" }),
        createMockRoom({ id: "room-3", roomNumber: "103" }),
      ];
      const bookedRooms = [
        { roomId: "room-1" }, // Room 101 is booked
        { roomId: "room-3" }, // Room 103 is booked
      ];
      mockRoomFindMany.mockResolvedValue(allRooms);
      mockBookingFindMany.mockResolvedValue(bookedRooms);

      const result = await getAvailableRooms(checkIn, checkOut);

      expect(result).toHaveLength(1);
      expect(result[0].roomNumber).toBe("102");
    });

    it("should return empty array when all rooms are booked", async () => {
      const allRooms = [
        createMockRoom({ id: "room-1", roomNumber: "101" }),
      ];
      mockRoomFindMany.mockResolvedValue(allRooms);
      mockBookingFindMany.mockResolvedValue([{ roomId: "room-1" }]);

      const result = await getAvailableRooms(checkIn, checkOut);

      expect(result).toHaveLength(0);
    });

    it("should query with correct date overlap conditions", async () => {
      mockRoomFindMany.mockResolvedValue([]);
      mockBookingFindMany.mockResolvedValue([]);

      await getAvailableRooms(checkIn, checkOut);

      expect(mockBookingFindMany).toHaveBeenCalledWith({
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          OR: [
            {
              AND: [
                { checkIn: { lt: checkOut } },
                { checkOut: { gt: checkIn } },
              ],
            },
          ],
        },
        select: { roomId: true },
      });
    });

    it("should return sorted results", async () => {
      const allRooms = [
        createMockRoom({ id: "room-3", roomNumber: "103" }),
        createMockRoom({ id: "room-1", roomNumber: "101" }),
        createMockRoom({ id: "room-2", roomNumber: "102" }),
      ];
      mockRoomFindMany.mockResolvedValue(allRooms);
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getAvailableRooms(checkIn, checkOut);

      expect(result[0].roomNumber).toBe("101");
      expect(result[1].roomNumber).toBe("102");
      expect(result[2].roomNumber).toBe("103");
    });
  });
});
