import { describe, it, expect } from "vitest";
import {
  createBookingSchema,
  updateBookingSchema,
  updateBookingStatusSchema,
} from "@/lib/validations/booking";

describe("Booking Validation", () => {
  // ============================================================
  // createBookingSchema
  // ============================================================
  describe("createBookingSchema", () => {
    const validBooking = {
      roomId: "room-123",
      guestName: "John Doe",
      guestPhone: "0412345678",
      checkIn: "2024-03-15",
      checkOut: "2024-03-20",
    };

    it("should accept valid booking with required fields only", () => {
      const result = createBookingSchema.safeParse(validBooking);
      expect(result.success).toBe(true);
    });

    it("should accept valid booking with all optional fields", () => {
      const fullBooking = {
        ...validBooking,
        guestDateOfBirth: "1990-05-15",
        guestAddress: "123 Main St, Sydney NSW 2000",
        guestEmail: "john@example.com",
        vehicleRego: "ABC123",
        additionalGuests: "Jane Doe\nJim Doe",
        checkInTime: "14:00",
        checkOutTime: "10:00",
        bondDeposit: 200,
        notes: "Late arrival expected",
      };
      const result = createBookingSchema.safeParse(fullBooking);
      expect(result.success).toBe(true);
    });

    // Required field validation
    it("should reject booking without roomId", () => {
      const { roomId, ...noRoomId } = validBooking;
      const result = createBookingSchema.safeParse(noRoomId);
      expect(result.success).toBe(false);
    });

    it("should reject booking without guestName", () => {
      const { guestName, ...noGuestName } = validBooking;
      const result = createBookingSchema.safeParse(noGuestName);
      expect(result.success).toBe(false);
    });

    it("should reject booking without guestPhone", () => {
      const { guestPhone, ...noGuestPhone } = validBooking;
      const result = createBookingSchema.safeParse(noGuestPhone);
      expect(result.success).toBe(false);
    });

    it("should reject booking without checkIn", () => {
      const { checkIn, ...noCheckIn } = validBooking;
      const result = createBookingSchema.safeParse(noCheckIn);
      expect(result.success).toBe(false);
    });

    it("should reject booking without checkOut", () => {
      const { checkOut, ...noCheckOut } = validBooking;
      const result = createBookingSchema.safeParse(noCheckOut);
      expect(result.success).toBe(false);
    });

    // Phone number validation
    it("should accept valid Australian mobile numbers", () => {
      const validPhones = [
        "0412345678",       // Standard mobile (10 digits)
        "+61412345678",     // International with +61
      ];
      validPhones.forEach(phone => {
        const result = createBookingSchema.safeParse({ ...validBooking, guestPhone: phone });
        expect(result.success).toBe(true);
      });
    });

    it("should accept valid international phone numbers", () => {
      const validPhones = [
        "+12025551234",     // US format
        "+442071234567",    // UK format
      ];
      validPhones.forEach(phone => {
        const result = createBookingSchema.safeParse({ ...validBooking, guestPhone: phone });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid phone numbers", () => {
      const invalidPhones = [
        "123",
        "phone",
        "",
      ];
      invalidPhones.forEach(phone => {
        const result = createBookingSchema.safeParse({ ...validBooking, guestPhone: phone });
        expect(result.success).toBe(false);
      });
    });

    // Date validation
    it("should reject checkout before checkin", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        checkIn: "2024-03-20",
        checkOut: "2024-03-15",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i =>
          i.message.includes("Check-out date must be after check-in date")
        )).toBe(true);
      }
    });

    it("should reject checkout same as checkin", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        checkIn: "2024-03-15",
        checkOut: "2024-03-15",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        checkIn: "not-a-date",
      });
      expect(result.success).toBe(false);
    });

    // Time validation
    it("should accept valid time formats", () => {
      const validTimes = ["00:00", "14:30", "23:59", "9:00"];
      validTimes.forEach(time => {
        const result = createBookingSchema.safeParse({
          ...validBooking,
          checkInTime: time,
        });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid time formats", () => {
      const invalidTimes = ["25:00", "14:60", "invalid"];
      invalidTimes.forEach(time => {
        const result = createBookingSchema.safeParse({
          ...validBooking,
          checkInTime: time,
        });
        expect(result.success).toBe(false);
      });
    });

    // Length validations
    it("should reject guest name over 100 characters", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        guestName: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should reject address over 500 characters", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        guestAddress: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject vehicle rego over 20 characters", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        vehicleRego: "a".repeat(21),
      });
      expect(result.success).toBe(false);
    });

    it("should reject notes over 2000 characters", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        notes: "a".repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    // Bond deposit validation
    it("should accept zero bond deposit", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        bondDeposit: 0,
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative bond deposit", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        bondDeposit: -100,
      });
      expect(result.success).toBe(false);
    });

    // Email validation
    it("should accept valid email", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        guestEmail: "john@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty email", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        guestEmail: "",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        guestEmail: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // updateBookingSchema
  // ============================================================
  describe("updateBookingSchema", () => {
    it("should accept empty update (all optional)", () => {
      const result = updateBookingSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept partial update", () => {
      const result = updateBookingSchema.safeParse({
        guestName: "Updated Name",
      });
      expect(result.success).toBe(true);
    });

    it("should accept status update", () => {
      const validStatuses = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"];
      validStatuses.forEach(status => {
        const result = updateBookingSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      const result = updateBookingSchema.safeParse({
        status: "INVALID_STATUS",
      });
      expect(result.success).toBe(false);
    });

    it("should accept nullable fields", () => {
      const result = updateBookingSchema.safeParse({
        guestAddress: null,
        guestPhone: null,
        bondDeposit: null,
      });
      expect(result.success).toBe(true);
    });

    it("should validate dates only when both provided", () => {
      // Single date should pass without cross-validation
      const singleDate = updateBookingSchema.safeParse({
        checkIn: "2024-03-15",
      });
      expect(singleDate.success).toBe(true);

      // Both dates with invalid range should fail
      const invalidRange = updateBookingSchema.safeParse({
        checkIn: "2024-03-20",
        checkOut: "2024-03-15",
      });
      expect(invalidRange.success).toBe(false);
    });
  });

  // ============================================================
  // updateBookingStatusSchema
  // ============================================================
  describe("updateBookingStatusSchema", () => {
    it("should accept valid status values", () => {
      const validStatuses = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"];
      validStatuses.forEach(status => {
        const result = updateBookingStatusSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      const result = updateBookingStatusSchema.safeParse({ status: "PENDING" });
      expect(result.success).toBe(false);
    });

    it("should require status field", () => {
      const result = updateBookingStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
