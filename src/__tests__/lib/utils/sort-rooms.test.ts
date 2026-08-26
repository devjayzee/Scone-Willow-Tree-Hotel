import { describe, it, expect } from "vitest";
import { sortRoomsByNumber } from "@/lib/utils/sort-rooms";

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
