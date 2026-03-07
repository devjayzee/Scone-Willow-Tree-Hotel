import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client
const mockBookingFindMany = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockBookingFindFirst = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingUpdate = vi.fn();
const mockBookingDelete = vi.fn();
const mockRoomFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
      findUnique: (...args: unknown[]) => mockBookingFindUnique(...args),
      findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
      create: (...args: unknown[]) => mockBookingCreate(...args),
      update: (...args: unknown[]) => mockBookingUpdate(...args),
      delete: (...args: unknown[]) => mockBookingDelete(...args),
    },
    room: {
      findUnique: (...args: unknown[]) => mockRoomFindUnique(...args),
    },
  },
}));

// Mock audit service
vi.mock("@/lib/services/audit-service", () => ({
  createAuditLog: vi.fn(),
  AuditAction: {
    BOOKING_CREATED: "BOOKING_CREATED",
    BOOKING_UPDATED: "BOOKING_UPDATED",
    BOOKING_DELETED: "BOOKING_DELETED",
    BOOKING_CHECKED_IN: "BOOKING_CHECKED_IN",
    BOOKING_CHECKED_OUT: "BOOKING_CHECKED_OUT",
    BOOKING_CANCELLED: "BOOKING_CANCELLED",
  },
  EntityType: {
    BOOKING: "BOOKING",
  },
  sanitizeForAudit: (obj: unknown) => obj,
  getChangedFields: vi.fn(() => []),
}));

// Import after mocks are set up
import {
  getAllBookings,
  getBookingById,
  getBookingByRef,
  createBooking,
  updateBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  deleteBooking,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "@/lib/services/booking-service";

// Helper to create mock booking data
function createMockBooking(
  overrides: Partial<{
    id: string;
    bookingRef: string;
    roomId: string;
    guestName: string;
    guestDateOfBirth: Date | null;
    guestAddress: string | null;
    guestEmail: string;
    guestPhone: string | null;
    vehicleRego: string | null;
    additionalGuests: string | null;
    checkIn: Date;
    checkInTime: string | null;
    checkOut: Date;
    checkOutTime: string | null;
    bondDeposit: number | null;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    room: { id: string; roomNumber: string; pricePerNight: number };
    createdBy: { id: string; firstName: string; lastName: string } | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "booking-1",
    bookingRef: overrides.bookingRef ?? "BK-20240301-001",
    roomId: overrides.roomId ?? "room-1",
    guestName: overrides.guestName ?? "John Doe",
    guestDateOfBirth: overrides.guestDateOfBirth ?? null,
    guestAddress: overrides.guestAddress ?? "123 Main St",
    guestEmail: overrides.guestEmail ?? "john@example.com",
    guestPhone: overrides.guestPhone ?? "0400123456",
    vehicleRego: overrides.vehicleRego ?? null,
    additionalGuests: overrides.additionalGuests ?? null,
    checkIn: overrides.checkIn ?? new Date("2024-03-10"),
    checkInTime: overrides.checkInTime ?? "14:00",
    checkOut: overrides.checkOut ?? new Date("2024-03-15"),
    checkOutTime: overrides.checkOutTime ?? "10:00",
    bondDeposit: overrides.bondDeposit ?? null,
    status: overrides.status ?? "CONFIRMED",
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2024-01-01"),
    room: overrides.room ?? { id: "room-1", roomNumber: "101", pricePerNight: 100 },
    createdBy: overrides.createdBy ?? { id: "user-1", firstName: "Admin", lastName: "User" },
  };
}

describe("Booking Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // getAllBookings
  // ============================================================
  describe("getAllBookings", () => {
    it("should return all bookings ordered by check-in date descending", async () => {
      const mockBookings = [
        createMockBooking({ id: "booking-2", checkIn: new Date("2024-03-15") }),
        createMockBooking({ id: "booking-1", checkIn: new Date("2024-03-10") }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getAllBookings();

      expect(mockBookingFindMany).toHaveBeenCalledOnce();
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no bookings exist", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getAllBookings();

      expect(result).toEqual([]);
    });

    it("should filter by status when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({ status: "CONFIRMED" });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "CONFIRMED" }),
        })
      );
    });

    it("should filter by roomId when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({ roomId: "room-123" });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ roomId: "room-123" }),
        })
      );
    });

    it("should filter by date range when provided", async () => {
      const startDate = new Date("2024-03-01");
      const endDate = new Date("2024-03-31");
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({ startDate, endDate });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkIn: { gte: startDate },
            checkOut: { lte: endDate },
          }),
        })
      );
    });

    it("should combine multiple filters", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({
        status: "CHECKED_IN",
        roomId: "room-1",
      });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "CHECKED_IN",
            roomId: "room-1",
          }),
        })
      );
    });
  });

  // ============================================================
  // getBookingById
  // ============================================================
  describe("getBookingById", () => {
    it("should return booking when found", async () => {
      const mockBooking = createMockBooking({ id: "booking-123" });
      mockBookingFindUnique.mockResolvedValue(mockBooking);

      const result = await getBookingById("booking-123");

      expect(mockBookingFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "booking-123" },
        })
      );
      expect(result).toEqual(mockBooking);
    });

    it("should throw NotFoundError when booking does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(getBookingById("non-existent")).rejects.toThrow(NotFoundError);
      await expect(getBookingById("non-existent")).rejects.toThrow("Booking not found");
    });
  });

  // ============================================================
  // getBookingByRef
  // ============================================================
  describe("getBookingByRef", () => {
    it("should return booking when found by reference", async () => {
      const mockBooking = createMockBooking({ bookingRef: "BK-20240301-001" });
      mockBookingFindUnique.mockResolvedValue(mockBooking);

      const result = await getBookingByRef("BK-20240301-001");

      expect(mockBookingFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingRef: "BK-20240301-001" },
        })
      );
      expect(result).toEqual(mockBooking);
    });

    it("should throw NotFoundError when booking reference does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(getBookingByRef("BK-INVALID")).rejects.toThrow(NotFoundError);
      await expect(getBookingByRef("BK-INVALID")).rejects.toThrow("Booking not found");
    });
  });

  // ============================================================
  // createBooking
  // ============================================================
  describe("createBooking", () => {
    const validInput = {
      roomId: "room-1",
      guestName: "Jane Smith",
      guestEmail: "jane@example.com",
      checkIn: "2024-03-20",
      checkOut: "2024-03-25",
    };

    it("should create a booking with unique booking reference", async () => {
      const createdBooking = createMockBooking({
        bookingRef: "BK-20240320-001",
        guestName: "Jane Smith",
      });
      mockBookingFindFirst.mockResolvedValue(null); // No overlapping booking
      mockRoomFindUnique.mockResolvedValue({ id: "room-1", roomNumber: "101" });
      mockBookingCreate.mockResolvedValue(createdBooking);

      const result = await createBooking(validInput, "user-1");

      expect(mockBookingCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestName: "Jane Smith",
            guestEmail: "jane@example.com",
            roomId: "room-1",
          }),
        })
      );
      expect(result.bookingRef).toMatch(/^BK-\d{8}-\d{3}$/);
    });

    it("should throw ConflictError when room has overlapping booking", async () => {
      const overlappingBooking = {
        bookingRef: "BK-20240301-001",
        guestName: "Existing Guest",
        checkIn: new Date("2024-03-18"),
        checkOut: new Date("2024-03-22"),
      };
      mockBookingFindFirst.mockResolvedValue(overlappingBooking);

      await expect(createBooking(validInput, "user-1")).rejects.toThrow(ConflictError);
      await expect(createBooking(validInput, "user-1")).rejects.toThrow(
        /Room is not available/
      );
      expect(mockBookingCreate).not.toHaveBeenCalled();
    });

    it("should throw NotFoundError when room does not exist", async () => {
      mockBookingFindFirst.mockResolvedValue(null); // No overlapping
      mockRoomFindUnique.mockResolvedValue(null); // Room not found

      await expect(createBooking(validInput, "user-1")).rejects.toThrow(NotFoundError);
      await expect(createBooking(validInput, "user-1")).rejects.toThrow("Room not found");
      expect(mockBookingCreate).not.toHaveBeenCalled();
    });

    it("should create booking with optional fields", async () => {
      const inputWithOptionals = {
        ...validInput,
        guestDateOfBirth: "1990-05-15",
        guestAddress: "456 Oak Ave",
        guestPhone: "0412345678",
        vehicleRego: "ABC123",
        additionalGuests: "Guest 2\nGuest 3",
        checkInTime: "15:00",
        checkOutTime: "11:00",
        bondDeposit: 200,
        notes: "Early check-in requested",
      };
      mockBookingFindFirst.mockResolvedValue(null);
      mockRoomFindUnique.mockResolvedValue({ id: "room-1", roomNumber: "101" });
      mockBookingCreate.mockResolvedValue(createMockBooking());

      await createBooking(inputWithOptionals, "user-1");

      expect(mockBookingCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestAddress: "456 Oak Ave",
            guestPhone: "0412345678",
            vehicleRego: "ABC123",
            bondDeposit: 200,
          }),
        })
      );
    });
  });

  // ============================================================
  // updateBooking
  // ============================================================
  describe("updateBooking", () => {
    const existingBooking = createMockBooking({
      id: "booking-1",
      status: "CONFIRMED",
    });

    it("should update booking when it exists", async () => {
      const updateData = { guestName: "Updated Name" };
      const updatedBooking = { ...existingBooking, ...updateData };
      mockBookingFindUnique.mockResolvedValue(existingBooking);
      mockBookingUpdate.mockResolvedValue(updatedBooking);

      const result = await updateBooking("booking-1", updateData);

      expect(mockBookingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "booking-1" },
          data: expect.objectContaining({ guestName: "Updated Name" }),
        })
      );
      expect(result.guestName).toBe("Updated Name");
    });

    it("should throw NotFoundError when booking does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(updateBooking("non-existent", { guestName: "Test" })).rejects.toThrow(
        NotFoundError
      );
      expect(mockBookingUpdate).not.toHaveBeenCalled();
    });

    it("should validate status transitions", async () => {
      mockBookingFindUnique.mockResolvedValue(existingBooking);

      // CONFIRMED -> CHECKED_IN is valid
      mockBookingUpdate.mockResolvedValue({ ...existingBooking, status: "CHECKED_IN" });
      await expect(
        updateBooking("booking-1", { status: "CHECKED_IN" })
      ).resolves.toBeDefined();

      // Reset mocks for next test
      vi.clearAllMocks();
      mockBookingFindUnique.mockResolvedValue(existingBooking);

      // CONFIRMED -> CHECKED_OUT is invalid
      await expect(updateBooking("booking-1", { status: "CHECKED_OUT" })).rejects.toThrow(
        BusinessRuleError
      );
      await expect(updateBooking("booking-1", { status: "CHECKED_OUT" })).rejects.toThrow(
        /Cannot change status from CONFIRMED to CHECKED_OUT/
      );
    });

    it("should check for overlaps when dates change", async () => {
      const overlappingBooking = {
        bookingRef: "BK-20240301-002",
        guestName: "Other Guest",
        checkIn: new Date("2024-03-22"),
        checkOut: new Date("2024-03-28"),
      };
      mockBookingFindUnique.mockResolvedValue(existingBooking);
      mockBookingFindFirst.mockResolvedValue(overlappingBooking);

      await expect(
        updateBooking("booking-1", { checkIn: "2024-03-20", checkOut: "2024-03-25" })
      ).rejects.toThrow(ConflictError);
      expect(mockBookingUpdate).not.toHaveBeenCalled();
    });

    it("should allow date changes when no overlap exists", async () => {
      mockBookingFindUnique.mockResolvedValue(existingBooking);
      mockBookingFindFirst.mockResolvedValue(null); // No overlap
      mockBookingUpdate.mockResolvedValue({
        ...existingBooking,
        checkIn: new Date("2024-04-01"),
        checkOut: new Date("2024-04-05"),
      });

      const result = await updateBooking("booking-1", {
        checkIn: "2024-04-01",
        checkOut: "2024-04-05",
      });

      expect(mockBookingUpdate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // checkInBooking
  // ============================================================
  describe("checkInBooking", () => {
    it("should check in a CONFIRMED booking", async () => {
      const confirmedBooking = { id: "booking-1", status: "CONFIRMED", bookingRef: "BK-001", guestName: "John" };
      const checkedInBooking = createMockBooking({ status: "CHECKED_IN" });
      mockBookingFindUnique.mockResolvedValue(confirmedBooking);
      mockBookingUpdate.mockResolvedValue(checkedInBooking);

      const result = await checkInBooking("booking-1");

      expect(mockBookingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "booking-1" },
          data: { status: "CHECKED_IN" },
        })
      );
      expect(result.status).toBe("CHECKED_IN");
    });

    it("should throw NotFoundError when booking does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(checkInBooking("non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw BusinessRuleError when booking is already checked in", async () => {
      const checkedInBooking = { id: "booking-1", status: "CHECKED_IN", bookingRef: "BK-001", guestName: "John" };
      mockBookingFindUnique.mockResolvedValue(checkedInBooking);

      await expect(checkInBooking("booking-1")).rejects.toThrow(BusinessRuleError);
      await expect(checkInBooking("booking-1")).rejects.toThrow(
        /Cannot change status from CHECKED_IN to CHECKED_IN/
      );
    });

    it("should throw BusinessRuleError when booking is cancelled", async () => {
      const cancelledBooking = { id: "booking-1", status: "CANCELLED", bookingRef: "BK-001", guestName: "John" };
      mockBookingFindUnique.mockResolvedValue(cancelledBooking);

      await expect(checkInBooking("booking-1")).rejects.toThrow(BusinessRuleError);
    });

    it("should throw BusinessRuleError when booking is checked out", async () => {
      const checkedOutBooking = { id: "booking-1", status: "CHECKED_OUT", bookingRef: "BK-001", guestName: "John" };
      mockBookingFindUnique.mockResolvedValue(checkedOutBooking);

      await expect(checkInBooking("booking-1")).rejects.toThrow(BusinessRuleError);
    });
  });

  // ============================================================
  // checkOutBooking
  // ============================================================
  describe("checkOutBooking", () => {
    it("should check out a CHECKED_IN booking", async () => {
      const checkedInBooking = { id: "booking-1", status: "CHECKED_IN", bookingRef: "BK-001", guestName: "John" };
      const checkedOutBooking = createMockBooking({ status: "CHECKED_OUT" });
      mockBookingFindUnique.mockResolvedValue(checkedInBooking);
      mockBookingUpdate.mockResolvedValue(checkedOutBooking);

      const result = await checkOutBooking("booking-1");

      expect(mockBookingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "booking-1" },
          data: { status: "CHECKED_OUT" },
        })
      );
      expect(result.status).toBe("CHECKED_OUT");
    });

    it("should throw NotFoundError when booking does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(checkOutBooking("non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw BusinessRuleError when booking is CONFIRMED (not checked in)", async () => {
      const confirmedBooking = { id: "booking-1", status: "CONFIRMED", bookingRef: "BK-001", guestName: "John" };
      mockBookingFindUnique.mockResolvedValue(confirmedBooking);

      await expect(checkOutBooking("booking-1")).rejects.toThrow(BusinessRuleError);
      await expect(checkOutBooking("booking-1")).rejects.toThrow(
        /Cannot change status from CONFIRMED to CHECKED_OUT/
      );
    });

    it("should throw BusinessRuleError when booking is already checked out", async () => {
      const checkedOutBooking = { id: "booking-1", status: "CHECKED_OUT", bookingRef: "BK-001", guestName: "John" };
      mockBookingFindUnique.mockResolvedValue(checkedOutBooking);

      await expect(checkOutBooking("booking-1")).rejects.toThrow(BusinessRuleError);
    });
  });

  // ============================================================
  // cancelBooking
  // ============================================================
  describe("cancelBooking", () => {
    it("should cancel a CONFIRMED booking", async () => {
      const confirmedBooking = { id: "booking-1", status: "CONFIRMED", bookingRef: "BK-001", guestName: "John" };
      const cancelledBooking = createMockBooking({ status: "CANCELLED" });
      mockBookingFindUnique.mockResolvedValue(confirmedBooking);
      mockBookingUpdate.mockResolvedValue(cancelledBooking);

      const result = await cancelBooking("booking-1");

      expect(mockBookingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "booking-1" },
          data: { status: "CANCELLED" },
        })
      );
      expect(result.status).toBe("CANCELLED");
    });

    it("should cancel a CHECKED_IN booking", async () => {
      const checkedInBooking = { id: "booking-1", status: "CHECKED_IN", bookingRef: "BK-001", guestName: "John" };
      const cancelledBooking = createMockBooking({ status: "CANCELLED" });
      mockBookingFindUnique.mockResolvedValue(checkedInBooking);
      mockBookingUpdate.mockResolvedValue(cancelledBooking);

      const result = await cancelBooking("booking-1");

      expect(result.status).toBe("CANCELLED");
    });

    it("should throw NotFoundError when booking does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(cancelBooking("non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw BusinessRuleError when booking is already cancelled", async () => {
      const cancelledBooking = { id: "booking-1", status: "CANCELLED", bookingRef: "BK-001", guestName: "John" };
      mockBookingFindUnique.mockResolvedValue(cancelledBooking);

      await expect(cancelBooking("booking-1")).rejects.toThrow(BusinessRuleError);
    });

    it("should throw BusinessRuleError when booking is checked out", async () => {
      const checkedOutBooking = { id: "booking-1", status: "CHECKED_OUT", bookingRef: "BK-001", guestName: "John" };
      mockBookingFindUnique.mockResolvedValue(checkedOutBooking);

      await expect(cancelBooking("booking-1")).rejects.toThrow(BusinessRuleError);
    });
  });

  // ============================================================
  // deleteBooking
  // ============================================================
  describe("deleteBooking", () => {
    it("should delete a CANCELLED booking", async () => {
      const cancelledBooking = {
        id: "booking-1",
        bookingRef: "BK-001",
        guestName: "John",
        guestEmail: "john@example.com",
        status: "CANCELLED",
        room: { roomNumber: "101" },
      };
      mockBookingFindUnique.mockResolvedValue(cancelledBooking);
      mockBookingDelete.mockResolvedValue(undefined);

      const result = await deleteBooking("booking-1");

      expect(mockBookingDelete).toHaveBeenCalledWith({
        where: { id: "booking-1" },
      });
      expect(result.deleted).toBe(true);
      expect(result.message).toBe("Booking deleted successfully");
    });

    it("should delete a CHECKED_OUT booking", async () => {
      const checkedOutBooking = {
        id: "booking-1",
        bookingRef: "BK-001",
        guestName: "John",
        guestEmail: "john@example.com",
        status: "CHECKED_OUT",
        room: { roomNumber: "101" },
      };
      mockBookingFindUnique.mockResolvedValue(checkedOutBooking);
      mockBookingDelete.mockResolvedValue(undefined);

      const result = await deleteBooking("booking-1");

      expect(mockBookingDelete).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });

    it("should throw NotFoundError when booking does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(deleteBooking("non-existent")).rejects.toThrow(NotFoundError);
      await expect(deleteBooking("non-existent")).rejects.toThrow("Booking not found");
      expect(mockBookingDelete).not.toHaveBeenCalled();
    });

    it("should throw BusinessRuleError when booking is CONFIRMED", async () => {
      const confirmedBooking = {
        id: "booking-1",
        bookingRef: "BK-001",
        guestName: "John",
        guestEmail: "john@example.com",
        status: "CONFIRMED",
        room: { roomNumber: "101" },
      };
      mockBookingFindUnique.mockResolvedValue(confirmedBooking);

      await expect(deleteBooking("booking-1")).rejects.toThrow(BusinessRuleError);
      await expect(deleteBooking("booking-1")).rejects.toThrow(
        /Cannot delete booking with status CONFIRMED/
      );
      expect(mockBookingDelete).not.toHaveBeenCalled();
    });

    it("should throw BusinessRuleError when booking is CHECKED_IN", async () => {
      const checkedInBooking = {
        id: "booking-1",
        bookingRef: "BK-001",
        guestName: "John",
        guestEmail: "john@example.com",
        status: "CHECKED_IN",
        room: { roomNumber: "101" },
      };
      mockBookingFindUnique.mockResolvedValue(checkedInBooking);

      await expect(deleteBooking("booking-1")).rejects.toThrow(BusinessRuleError);
      await expect(deleteBooking("booking-1")).rejects.toThrow(
        /Cancel or check out first/
      );
      expect(mockBookingDelete).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Status Transition Matrix Tests
  // ============================================================
  describe("Status Transition Validation", () => {
    const statusTransitionTests = [
      // Valid transitions
      { from: "CONFIRMED", to: "CHECKED_IN", valid: true },
      { from: "CONFIRMED", to: "CANCELLED", valid: true },
      { from: "CHECKED_IN", to: "CHECKED_OUT", valid: true },
      { from: "CHECKED_IN", to: "CANCELLED", valid: true },
      // Invalid transitions
      { from: "CONFIRMED", to: "CHECKED_OUT", valid: false },
      { from: "CHECKED_OUT", to: "CONFIRMED", valid: false },
      { from: "CHECKED_OUT", to: "CHECKED_IN", valid: false },
      { from: "CHECKED_OUT", to: "CANCELLED", valid: false },
      { from: "CANCELLED", to: "CONFIRMED", valid: false },
      { from: "CANCELLED", to: "CHECKED_IN", valid: false },
      { from: "CANCELLED", to: "CHECKED_OUT", valid: false },
    ];

    it.each(statusTransitionTests)(
      "transition from $from to $to should be $valid",
      async ({ from, to, valid }) => {
        const existingBooking = createMockBooking({ status: from });
        mockBookingFindUnique.mockResolvedValue(existingBooking);

        if (valid) {
          mockBookingUpdate.mockResolvedValue({ ...existingBooking, status: to });
          await expect(updateBooking("booking-1", { status: to as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" })).resolves.toBeDefined();
        } else {
          await expect(updateBooking("booking-1", { status: to as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" })).rejects.toThrow(
            BusinessRuleError
          );
        }
      }
    );
  });
});
