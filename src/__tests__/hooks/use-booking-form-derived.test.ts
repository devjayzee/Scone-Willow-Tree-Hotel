import { describe, it, expect } from "vitest";
import type { RoomSummary } from "@/types/room";
import { computeBookingFormDerived } from "@/hooks/use-booking-form-derived";

function makeRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: "r-1",
    roomNumber: "101",
    capacity: 2,
    pricePerNight: 100,
    ...overrides,
  };
}

const EMPTY_INPUT = {
  availableRooms: [],
  roomId: "",
  checkIn: "",
  checkOut: "",
  bondDeposit: "",
  guestName: "",
  guestPhone: "",
};

describe("computeBookingFormDerived", () => {
  it("returns zero/false defaults for an empty state", () => {
    const result = computeBookingFormDerived(EMPTY_INPUT);
    expect(result).toEqual({
      selectedRoom: undefined,
      pricePerNight: 0,
      nights: 0,
      totalPrice: 0,
      bondAmount: 0,
      canProceedToStay: false,
      canProceedToSummary: false,
    });
  });

  it("picks selectedRoom by id from availableRooms", () => {
    const rooms = [makeRoom({ id: "r-1" }), makeRoom({ id: "r-2", roomNumber: "102" })];
    const result = computeBookingFormDerived({ ...EMPTY_INPUT, availableRooms: rooms, roomId: "r-2" });
    expect(result.selectedRoom?.roomNumber).toBe("102");
  });

  it("reads pricePerNight when the room stores it as a number", () => {
    const rooms = [makeRoom({ id: "r-1", pricePerNight: 175 })];
    const result = computeBookingFormDerived({ ...EMPTY_INPUT, availableRooms: rooms, roomId: "r-1" });
    expect(result.pricePerNight).toBe(175);
  });

  it("parses pricePerNight when the room stores it as a string", () => {
    const rooms = [makeRoom({ id: "r-1", pricePerNight: "175.50" })];
    const result = computeBookingFormDerived({ ...EMPTY_INPUT, availableRooms: rooms, roomId: "r-1" });
    expect(result.pricePerNight).toBe(175.5);
  });

  it("computes nights as differenceInDays(checkOut, checkIn)", () => {
    const result = computeBookingFormDerived({
      ...EMPTY_INPUT,
      checkIn: "2026-05-01",
      checkOut: "2026-05-05",
    });
    expect(result.nights).toBe(4);
  });

  it("multiplies nights × pricePerNight for totalPrice", () => {
    const rooms = [makeRoom({ id: "r-1", pricePerNight: 100 })];
    const result = computeBookingFormDerived({
      ...EMPTY_INPUT,
      availableRooms: rooms,
      roomId: "r-1",
      checkIn: "2026-05-01",
      checkOut: "2026-05-04",
    });
    expect(result.totalPrice).toBe(300);
  });

  it("parses bondDeposit into bondAmount and returns 0 when empty", () => {
    expect(
      computeBookingFormDerived({ ...EMPTY_INPUT, bondDeposit: "150" }).bondAmount
    ).toBe(150);
    expect(
      computeBookingFormDerived({ ...EMPTY_INPUT, bondDeposit: "" }).bondAmount
    ).toBe(0);
  });

  it("canProceedToStay requires both guestName and guestPhone", () => {
    expect(
      computeBookingFormDerived({ ...EMPTY_INPUT, guestName: "Jane", guestPhone: "0400" }).canProceedToStay
    ).toBe(true);
    expect(
      computeBookingFormDerived({ ...EMPTY_INPUT, guestName: "Jane" }).canProceedToStay
    ).toBe(false);
    expect(
      computeBookingFormDerived({ ...EMPTY_INPUT, guestPhone: "0400" }).canProceedToStay
    ).toBe(false);
  });

  it("canProceedToSummary requires roomId, checkIn, checkOut, and nights > 0", () => {
    const rooms = [makeRoom({ id: "r-1" })];
    const full = computeBookingFormDerived({
      ...EMPTY_INPUT,
      availableRooms: rooms,
      roomId: "r-1",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
    });
    expect(full.canProceedToSummary).toBe(true);

    // same day (nights = 0) → cannot proceed
    const sameDay = computeBookingFormDerived({
      ...EMPTY_INPUT,
      availableRooms: rooms,
      roomId: "r-1",
      checkIn: "2026-05-01",
      checkOut: "2026-05-01",
    });
    expect(sameDay.canProceedToSummary).toBe(false);
  });
});
