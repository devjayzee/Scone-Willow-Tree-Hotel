import { describe, it, expect } from "vitest";
import { bookingToPDFData } from "@/lib/utils/pdf/booking-registration/pdf-types";
import type { Booking } from "@/types/booking";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    bookingRef: "BK-20260501-001",
    roomId: "r-1",
    guestName: "Jane Smith",
    guestDateOfBirth: "1990-05-15T00:00:00.000Z",
    guestAddress: "1 Main St",
    guestEmail: "jane@example.com",
    guestPhone: "0400111222",
    vehicleRego: "ABC123",
    additionalGuests: "John Smith",
    checkIn: "2026-05-01T00:00:00.000Z",
    checkInTime: "15:00",
    checkOut: "2026-05-05T00:00:00.000Z",
    checkOutTime: "11:00",
    bondDeposit: "150.00",
    ratePerNight: "120.00",
    status: "CONFIRMED",
    isPaid: false,
    notes: "VIP",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    room: {
      id: "r-1",
      roomNumber: "101",
      capacity: 2,
      pricePerNight: "200.00",
    },
    ...overrides,
  };
}

describe("bookingToPDFData", () => {
  it("maps every guest + stay + room field into the flat PDF shape", () => {
    const result = bookingToPDFData(makeBooking());

    expect(result).toEqual({
      guestName: "Jane Smith",
      guestDateOfBirth: "1990-05-15T00:00:00.000Z",
      guestAddress: "1 Main St",
      guestEmail: "jane@example.com",
      guestPhone: "0400111222",
      vehicleRego: "ABC123",
      additionalGuests: "John Smith",
      checkIn: "2026-05-01T00:00:00.000Z",
      checkInTime: "15:00",
      checkOut: "2026-05-05T00:00:00.000Z",
      checkOutTime: "11:00",
      bondDeposit: "150.00",
      roomNumber: "101",
      pricePerNight: 120,
    });
  });

  it("reads booking.ratePerNight, NOT booking.room.pricePerNight", () => {
    const result = bookingToPDFData(
      makeBooking({
        ratePerNight: "80.00",
        room: {
          id: "r-1",
          roomNumber: "101",
          capacity: 2,
          pricePerNight: "200.00", // current room price is $200 …
        },
      }),
    );

    // … but the snapshot is $80, and the PDF must reflect the charged rate.
    expect(result.pricePerNight).toBe(80);
  });

  it("parses a string ratePerNight (Decimal-serialized) to a number", () => {
    const result = bookingToPDFData(makeBooking({ ratePerNight: "199.50" }));
    expect(result.pricePerNight).toBe(199.5);
    expect(typeof result.pricePerNight).toBe("number");
  });

  it("passes through a numeric ratePerNight unchanged", () => {
    const result = bookingToPDFData(makeBooking({ ratePerNight: 250 }));
    expect(result.pricePerNight).toBe(250);
  });

  it("preserves nullable fields as-is (dateOfBirth, address, vehicleRego)", () => {
    const result = bookingToPDFData(
      makeBooking({
        guestDateOfBirth: null,
        guestAddress: null,
        vehicleRego: null,
      }),
    );
    expect(result.guestDateOfBirth).toBeNull();
    expect(result.guestAddress).toBeNull();
    expect(result.vehicleRego).toBeNull();
  });

  it("preserves a null bondDeposit", () => {
    const result = bookingToPDFData(makeBooking({ bondDeposit: null }));
    expect(result.bondDeposit).toBeNull();
  });

  it("preserves a null guestEmail", () => {
    const result = bookingToPDFData(makeBooking({ guestEmail: null }));
    expect(result.guestEmail).toBeNull();
  });
});
