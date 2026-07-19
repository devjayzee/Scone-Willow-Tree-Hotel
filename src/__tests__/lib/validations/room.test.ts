import { describe, it, expect } from "vitest";
import {
  createRoomSchema,
  updateRoomSchema,
} from "@/lib/validations/room";

describe("Room Validation", () => {
  // ============================================================
  // createRoomSchema
  // ============================================================
  describe("createRoomSchema", () => {
    const validRoom = {
      roomNumber: "101",
      capacity: 2,
      pricePerNight: 150,
    };

    it("should accept valid room with required fields", () => {
      const result = createRoomSchema.safeParse(validRoom);
      expect(result.success).toBe(true);
    });

    it("should accept valid room with description", () => {
      const result = createRoomSchema.safeParse({
        ...validRoom,
        description: "Spacious room with ocean view",
      });
      expect(result.success).toBe(true);
    });

    it("should use default capacity of 1", () => {
      const result = createRoomSchema.safeParse({
        roomNumber: "101",
        pricePerNight: 100,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capacity).toBe(1);
      }
    });

    // Required fields
    it("should reject room without roomNumber", () => {
      const { roomNumber: _roomNumber, ...noRoomNumber } = validRoom;
      const result = createRoomSchema.safeParse(noRoomNumber);
      expect(result.success).toBe(false);
    });

    it("should reject room with empty roomNumber", () => {
      const result = createRoomSchema.safeParse({
        ...validRoom,
        roomNumber: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject room without pricePerNight", () => {
      const { pricePerNight: _pricePerNight, ...noPrice } = validRoom;
      const result = createRoomSchema.safeParse(noPrice);
      expect(result.success).toBe(false);
    });

    // Capacity validation
    it("should accept capacity within range (1-10)", () => {
      [1, 5, 10].forEach(capacity => {
        const result = createRoomSchema.safeParse({ ...validRoom, capacity });
        expect(result.success).toBe(true);
      });
    });

    it("should reject capacity below 1", () => {
      const result = createRoomSchema.safeParse({
        ...validRoom,
        capacity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject capacity above 10", () => {
      const result = createRoomSchema.safeParse({
        ...validRoom,
        capacity: 11,
      });
      expect(result.success).toBe(false);
    });

    // Price validation
    it("should accept zero price", () => {
      const result = createRoomSchema.safeParse({
        ...validRoom,
        pricePerNight: 0,
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative price", () => {
      const result = createRoomSchema.safeParse({
        ...validRoom,
        pricePerNight: -50,
      });
      expect(result.success).toBe(false);
    });

    it("should accept decimal prices", () => {
      const result = createRoomSchema.safeParse({
        ...validRoom,
        pricePerNight: 149.99,
      });
      expect(result.success).toBe(true);
    });

    // Description
    it("should accept room without description", () => {
      const { description: _description, ...noDesc } = { ...validRoom, description: "test" };
      const result = createRoomSchema.safeParse(noDesc);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // updateRoomSchema
  // ============================================================
  describe("updateRoomSchema", () => {
    it("should accept empty update (all optional)", () => {
      const result = updateRoomSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept partial update with roomNumber", () => {
      const result = updateRoomSchema.safeParse({
        roomNumber: "102",
      });
      expect(result.success).toBe(true);
    });

    it("should accept partial update with capacity", () => {
      const result = updateRoomSchema.safeParse({
        capacity: 4,
      });
      expect(result.success).toBe(true);
    });

    it("should accept partial update with price", () => {
      const result = updateRoomSchema.safeParse({
        pricePerNight: 200,
      });
      expect(result.success).toBe(true);
    });

    it("should accept full update", () => {
      const result = updateRoomSchema.safeParse({
        roomNumber: "201",
        capacity: 3,
        pricePerNight: 175,
        description: "Updated description",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid capacity when provided", () => {
      const result = updateRoomSchema.safeParse({
        capacity: 15,
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative price when provided", () => {
      const result = updateRoomSchema.safeParse({
        pricePerNight: -100,
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty roomNumber when provided", () => {
      const result = updateRoomSchema.safeParse({
        roomNumber: "",
      });
      expect(result.success).toBe(false);
    });
  });
});
