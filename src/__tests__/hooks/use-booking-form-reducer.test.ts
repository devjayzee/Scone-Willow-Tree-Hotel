import { describe, it, expect } from "vitest";
import { format, addDays, parseISO } from "date-fns";
import type { Booking } from "@/types/booking";
import {
  bookingFormReducer,
  INITIAL_BOOKING_FORM_STATE,
  type BookingFormState,
} from "@/hooks/use-booking-form-reducer";

function makeState(overrides: Partial<BookingFormState> = {}): BookingFormState {
  return { ...INITIAL_BOOKING_FORM_STATE, ...overrides };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    bookingRef: "BK-1",
    roomId: "r-1",
    guestName: "Jane",
    guestDateOfBirth: "1990-05-15T00:00:00.000Z",
    guestAddress: "1 Main St",
    guestEmail: "jane@example.com",
    guestPhone: "0400111222",
    vehicleRego: "ABC123",
    additionalGuests: "John",
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
    room: { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "100" },
    ...overrides,
  };
}

describe("bookingFormReducer", () => {
  describe("SET_FIELD", () => {
    it("updates the named string field and leaves others untouched", () => {
      const before = makeState({ guestName: "Old", guestPhone: "0400" });
      const after = bookingFormReducer(before, {
        type: "SET_FIELD",
        field: "guestName",
        value: "New",
      });
      expect(after.guestName).toBe("New");
      expect(after.guestPhone).toBe("0400");
    });

    it("can set the error field", () => {
      const after = bookingFormReducer(makeState(), {
        type: "SET_FIELD",
        field: "error",
        value: "boom",
      });
      expect(after.error).toBe("boom");
    });
  });

  describe("RESET", () => {
    it("returns the initial state regardless of prior state", () => {
      const before = makeState({
        guestName: "Populated",
        roomId: "r-99",
        error: "old error",
      });
      const after = bookingFormReducer(before, { type: "RESET" });
      expect(after).toEqual(INITIAL_BOOKING_FORM_STATE);
    });
  });

  describe("HYDRATE", () => {
    it("maps a full Booking into state including date formatting", () => {
      const booking = makeBooking();
      const after = bookingFormReducer(makeState(), { type: "HYDRATE", booking });

      expect(after.guestName).toBe("Jane");
      expect(after.guestDateOfBirth).toBe("1990-05-15");
      expect(after.guestAddress).toBe("1 Main St");
      expect(after.guestPhone).toBe("0400111222");
      expect(after.guestEmail).toBe("jane@example.com");
      expect(after.vehicleRego).toBe("ABC123");
      expect(after.additionalGuests).toBe("John");
      expect(after.roomId).toBe("r-1");
      expect(after.checkIn).toBe("2026-05-01");
      expect(after.checkInTime).toBe("15:00");
      expect(after.checkOut).toBe("2026-05-05");
      expect(after.checkOutTime).toBe("11:00");
      expect(after.bondDeposit).toBe("150.00");
      expect(after.notes).toBe("VIP");
      expect(after.error).toBe("");
    });

    it("substitutes empty strings for nullable fields", () => {
      const booking = makeBooking({
        guestDateOfBirth: null,
        guestAddress: null,
        guestEmail: null,
        vehicleRego: null,
        additionalGuests: null,
        checkInTime: null,
        checkOutTime: null,
        bondDeposit: null,
        notes: null,
      });
      const after = bookingFormReducer(makeState(), { type: "HYDRATE", booking });

      expect(after.guestDateOfBirth).toBe("");
      expect(after.guestAddress).toBe("");
      expect(after.guestEmail).toBe("");
      expect(after.vehicleRego).toBe("");
      expect(after.additionalGuests).toBe("");
      expect(after.checkInTime).toBe("14:00"); // default
      expect(after.checkOutTime).toBe("10:00"); // default
      expect(after.bondDeposit).toBe("");
      expect(after.notes).toBe("");
    });
  });

  describe("SEED_DATES", () => {
    it("sets checkIn and checkOut, leaves other fields untouched", () => {
      const before = makeState({ guestName: "Kept", roomId: "r-keep" });
      const after = bookingFormReducer(before, {
        type: "SEED_DATES",
        today: "2026-06-01",
        tomorrow: "2026-06-02",
      });

      expect(after.checkIn).toBe("2026-06-01");
      expect(after.checkOut).toBe("2026-06-02");
      expect(after.guestName).toBe("Kept");
      expect(after.roomId).toBe("r-keep");
    });
  });

  describe("CHANGE_CHECK_IN", () => {
    it("clears roomId when check-in changes", () => {
      const before = makeState({ roomId: "r-1", checkIn: "", checkOut: "" });
      const after = bookingFormReducer(before, {
        type: "CHANGE_CHECK_IN",
        value: "2026-05-01",
      });
      expect(after.roomId).toBe("");
    });

    it("auto-advances checkOut when new checkIn >= current checkOut", () => {
      const before = makeState({ checkIn: "2026-05-01", checkOut: "2026-05-03" });
      const after = bookingFormReducer(before, {
        type: "CHANGE_CHECK_IN",
        value: "2026-05-05",
      });
      const expected = format(addDays(parseISO("2026-05-05"), 1), "yyyy-MM-dd");
      expect(after.checkOut).toBe(expected);
    });

    it("also auto-advances when new checkIn equals current checkOut", () => {
      const before = makeState({ checkIn: "2026-05-01", checkOut: "2026-05-03" });
      const after = bookingFormReducer(before, {
        type: "CHANGE_CHECK_IN",
        value: "2026-05-03",
      });
      expect(after.checkOut).not.toBe("2026-05-03");
    });

    it("does not auto-advance when new checkIn is empty", () => {
      const before = makeState({ checkIn: "2026-05-01", checkOut: "2026-05-05" });
      const after = bookingFormReducer(before, {
        type: "CHANGE_CHECK_IN",
        value: "",
      });
      expect(after.checkOut).toBe("2026-05-05");
    });

    it("does not auto-advance when current checkOut is empty", () => {
      const before = makeState({ checkIn: "", checkOut: "" });
      const after = bookingFormReducer(before, {
        type: "CHANGE_CHECK_IN",
        value: "2026-05-01",
      });
      expect(after.checkOut).toBe("");
    });

    it("does not auto-advance when new checkIn is before current checkOut", () => {
      const before = makeState({ checkIn: "2026-05-01", checkOut: "2026-05-10" });
      const after = bookingFormReducer(before, {
        type: "CHANGE_CHECK_IN",
        value: "2026-05-05",
      });
      expect(after.checkOut).toBe("2026-05-10");
    });
  });

  describe("CHANGE_CHECK_OUT", () => {
    it("sets checkOut and clears roomId", () => {
      const before = makeState({
        roomId: "r-1",
        checkIn: "2026-05-01",
        checkOut: "2026-05-03",
      });
      const after = bookingFormReducer(before, {
        type: "CHANGE_CHECK_OUT",
        value: "2026-05-07",
      });
      expect(after.checkOut).toBe("2026-05-07");
      expect(after.roomId).toBe("");
      expect(after.checkIn).toBe("2026-05-01");
    });
  });
});
