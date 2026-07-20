import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BookingStatus } from "@prisma/client";

// Mock prisma at the module edge (Rule 8).
const mockBookingFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
    },
  },
}));

// Import unit under test AFTER mocks are set up.
import {
  generateBookingRef,
  findOverlappingBooking,
  validateStatusTransition,
} from "@/lib/services/booking/booking-utils";
import { BusinessRuleError } from "@/lib/errors";

describe("booking-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateBookingRef", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Freeze "today" so the test asserts a stable prefix.
      vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns BK-YYYYMMDD-001 when there are no bookings today", async () => {
      mockBookingFindFirst.mockResolvedValue(null);

      const ref = await generateBookingRef();

      expect(ref).toBe("BK-20260315-001");
      expect(mockBookingFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingRef: { startsWith: "BK-20260315-" } },
          orderBy: { bookingRef: "desc" },
        })
      );
    });

    it("increments the sequence when a booking already exists today", async () => {
      mockBookingFindFirst.mockResolvedValue({
        bookingRef: "BK-20260315-004",
      });

      const ref = await generateBookingRef();

      expect(ref).toBe("BK-20260315-005");
    });

    it("pads single-digit sequences to three digits", async () => {
      mockBookingFindFirst.mockResolvedValue({
        bookingRef: "BK-20260315-008",
      });

      const ref = await generateBookingRef();

      expect(ref).toBe("BK-20260315-009");
    });

    it("pads triple-digit sequences correctly (no over-padding)", async () => {
      mockBookingFindFirst.mockResolvedValue({
        bookingRef: "BK-20260315-042",
      });

      const ref = await generateBookingRef();

      expect(ref).toBe("BK-20260315-043");
    });

    it("handles bookings without a numeric suffix by treating them as zero", async () => {
      // Defensive: if the last segment isn't a number, parseInt returns NaN
      // and the fallback in the code substitutes 0 -> next = 1.
      mockBookingFindFirst.mockResolvedValue({
        bookingRef: "BK-20260315-",
      });

      const ref = await generateBookingRef();

      expect(ref).toBe("BK-20260315-001");
    });
  });

  describe("findOverlappingBooking", () => {
    const roomId = "room-1";
    const checkIn = new Date("2026-04-10");
    const checkOut = new Date("2026-04-15");

    it("passes room + status filter + all three overlap patterns", async () => {
      mockBookingFindFirst.mockResolvedValue(null);

      await findOverlappingBooking(roomId, checkIn, checkOut);

      const call = mockBookingFindFirst.mock.calls[0][0];
      expect(call.where.roomId).toBe(roomId);
      expect(call.where.status).toEqual({ in: ["CONFIRMED", "CHECKED_IN"] });
      expect(call.where.OR).toHaveLength(3);
      // Select projects only the fields the caller needs for its error message.
      expect(call.select).toEqual({
        bookingRef: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
      });
    });

    it("excludes the given booking id when provided (update path)", async () => {
      mockBookingFindFirst.mockResolvedValue(null);

      await findOverlappingBooking(roomId, checkIn, checkOut, "existing-id");

      const call = mockBookingFindFirst.mock.calls[0][0];
      expect(call.where.id).toEqual({ not: "existing-id" });
    });

    it("does not include the id filter when no exclusion is passed (create path)", async () => {
      mockBookingFindFirst.mockResolvedValue(null);

      await findOverlappingBooking(roomId, checkIn, checkOut);

      const call = mockBookingFindFirst.mock.calls[0][0];
      expect(call.where.id).toBeUndefined();
    });

    it("returns the overlapping booking when Prisma finds one", async () => {
      const overlap = {
        bookingRef: "BK-20260410-001",
        guestName: "Existing Guest",
        checkIn: new Date("2026-04-11"),
        checkOut: new Date("2026-04-14"),
      };
      mockBookingFindFirst.mockResolvedValue(overlap);

      const result = await findOverlappingBooking(roomId, checkIn, checkOut);

      expect(result).toEqual(overlap);
    });

    it("returns null when there is no overlap", async () => {
      mockBookingFindFirst.mockResolvedValue(null);

      const result = await findOverlappingBooking(roomId, checkIn, checkOut);

      expect(result).toBeNull();
    });
  });

  describe("validateStatusTransition", () => {
    // The state machine per booking-constants.ts VALID_STATUS_TRANSITIONS:
    //   CONFIRMED   -> CHECKED_IN | CANCELLED
    //   CHECKED_IN  -> CHECKED_OUT | CANCELLED
    //   CHECKED_OUT -> CHECKED_IN         (undo checkout)
    //   CANCELLED   -> CONFIRMED          (undo cancel)
    const validTransitions: Array<[BookingStatus, BookingStatus]> = [
      ["CONFIRMED", "CHECKED_IN"],
      ["CONFIRMED", "CANCELLED"],
      ["CHECKED_IN", "CHECKED_OUT"],
      ["CHECKED_IN", "CANCELLED"],
      ["CHECKED_OUT", "CHECKED_IN"],
      ["CANCELLED", "CONFIRMED"],
    ];

    it.each(validTransitions)("allows %s -> %s", (from, to) => {
      expect(() => validateStatusTransition(from, to)).not.toThrow();
    });

    const invalidTransitions: Array<[BookingStatus, BookingStatus]> = [
      // CONFIRMED cannot skip to CHECKED_OUT
      ["CONFIRMED", "CHECKED_OUT"],
      // CHECKED_IN cannot go back to CONFIRMED (only via undo-checkout path)
      ["CHECKED_IN", "CONFIRMED"],
      // CHECKED_OUT cannot go straight to CANCELLED
      ["CHECKED_OUT", "CANCELLED"],
      // CHECKED_OUT cannot go to CONFIRMED
      ["CHECKED_OUT", "CONFIRMED"],
      // CANCELLED cannot go directly to CHECKED_IN
      ["CANCELLED", "CHECKED_IN"],
      // CANCELLED cannot go to CHECKED_OUT
      ["CANCELLED", "CHECKED_OUT"],
    ];

    it.each(invalidTransitions)(
      "throws BusinessRuleError on %s -> %s",
      (from, to) => {
        expect(() => validateStatusTransition(from, to)).toThrow(
          BusinessRuleError
        );
        expect(() => validateStatusTransition(from, to)).toThrow(
          `Cannot change status from ${from} to ${to}`
        );
      }
    );
  });
});
