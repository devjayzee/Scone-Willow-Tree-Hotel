import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setupMocks,
  createMockBooking,
  resetMocks,
  mockBookingFindUnique,
  mockBookingFindFirst,
  mockBookingCreate,
  mockBookingUpdate,
  mockBookingDelete,
  mockRoomFindUnique,
} from "./test-utils";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import {
  createBooking,
  updateBooking,
  deleteBooking,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "@/lib/services/booking-service";

describe("Booking Mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
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
});
