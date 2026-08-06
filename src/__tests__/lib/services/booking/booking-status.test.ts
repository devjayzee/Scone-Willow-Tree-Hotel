import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setupMocks,
  createMockBooking,
  resetMocks,
  mockBookingFindUnique,
  mockBookingUpdate,
} from "./test-utils";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import {
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  updateBooking,
  NotFoundError,
  BusinessRuleError,
} from "@/lib/services/booking";

describe("Booking Status Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
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

    it("should allow check-in from CHECKED_OUT (undo checkout scenario)", async () => {
      // CHECKED_OUT -> CHECKED_IN is valid for undo checkout scenarios
      const checkedOutBooking = { id: "booking-1", status: "CHECKED_OUT", bookingRef: "BK-001", guestName: "John" };
      const checkedInBooking = createMockBooking({ status: "CHECKED_IN" });
      mockBookingFindUnique.mockResolvedValue(checkedOutBooking);
      mockBookingUpdate.mockResolvedValue(checkedInBooking);

      const result = await checkInBooking("booking-1");

      expect(result.status).toBe("CHECKED_IN");
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
  // Status Transition Matrix Tests
  // ============================================================
  describe("Status Transition Validation", () => {
    const statusTransitionTests = [
      // Valid transitions
      { from: "CONFIRMED", to: "CHECKED_IN", valid: true },
      { from: "CONFIRMED", to: "CANCELLED", valid: true },
      { from: "CHECKED_IN", to: "CHECKED_OUT", valid: true },
      { from: "CHECKED_IN", to: "CANCELLED", valid: true },
      { from: "CHECKED_OUT", to: "CHECKED_IN", valid: true }, // Undo checkout
      { from: "CANCELLED", to: "CONFIRMED", valid: true }, // Undo cancel
      // Invalid transitions
      { from: "CONFIRMED", to: "CHECKED_OUT", valid: false },
      { from: "CHECKED_OUT", to: "CONFIRMED", valid: false },
      { from: "CHECKED_OUT", to: "CANCELLED", valid: false },
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
